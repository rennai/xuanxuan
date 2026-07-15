import electron, {
    BrowserWindow, app as ElectronApp, Tray, Menu, nativeImage, globalShortcut, ipcMain, dialog, shell
} from 'electron';
import Path from 'path';
import fse from 'fs-extra';
import EVENT from './remote-events';
import events from './events';
import Lang, {onLangChange} from './lang-remote';

if (typeof DEBUG === 'undefined') {
    global.DEBUG = process.env.NODE_ENV === 'debug' || process.env.NODE_ENV === 'development';
} else {
    global.DEBUG = DEBUG;
}

/**
 * 应用窗口索引
 * @type {number}
 * @private
 */
let appWindowIndex = 0;

/**
 * 是否是 Mac OS 系统
 * @type {boolean}
 * @private
 */
const IS_MAC_OSX = process.platform === 'darwin';

/**
 * 是否显示调试日志信息
 * @type {boolean}
 * @private
 */
const SHOW_LOG = DEBUG;

/**
 * callRemote 反射 RPC 白名单。
 * contextIsolation 安全模型下，渲染进程（含被 XSS 攻破的场景）只能调用此清单内的方法。
 * execOsascript / createWindow / quit / sendToWindow 等危险方法不在此列：
 *   - execOsascript 可执行任意 shell（RCE），登录项改用 app.setLoginItemSettings
 *   - createWindow 的 webPreferences 会被渲染进程传入值浅合并覆盖（沙箱逃逸）
 *   - sendToWindow 可向任意窗口伪造 IPC 消息
 * 此清单须与 preload.js 暴露的方法保持同步。
 */
const REMOTE_METHOD_WHITELIST = new Set([
    // 文件操作
    'fs_outputFile', 'fs_copy', 'fs_pathExists', 'fs_ensureDir',
    'fs_readJson', 'fs_writeJson', 'fs_remove', 'fs_stat',
    // 对话框
    'dialog_showMessageBox', 'dialog_showSaveDialog', 'dialog_showOpenDialog',
    // 全局快捷键
    'shortcut_isRegistered',
    // App / Screen
    'app_getPath', 'app_getLocale', 'app_getName',
    'app_getLoginItemSettings', 'app_setLoginItemSettings',
    'screen_getAllDisplays', 'screen_getPrimaryDisplay',
    // 窗口 / 托盘 / Dock
    'createAppWindow', 'closeWindow', 'showAndFocusWindow',
    'trayTooltip', 'flashTrayIcon', 'dockBadgeLabel', 'dockBounce'
]);

/**
 * 将错误回送给渲染进程（避免 callRemote 的 Promise 永久挂起）。
 * @param {Event} e IPC 事件
 * @param {string} callBackEventName 回调事件名
 * @param {Error|*} error 错误对象
 */
const sendRemoteError = (e, callBackEventName, error) => {
    const message = String((error && error.message) || error);
    try {
        e.sender.send(callBackEventName, {__error: true, message});
    } catch (_) {
        // 窗口已销毁，忽略
    }
};

if (DEBUG && process.type === 'renderer') {
    console.error('AppRemote must run in main process.');
}

/**
 * Electron 主进程运行时管理类
 *
 * @class AppRemote
 */
class AppRemote {
    /**
     * 创建一个主进程运行时管理类实例
     * @memberof AppRemote
     */
    constructor() {
        /**
         * 保存打开的所有窗口实例
         * @type {Object<string, BrowserWindow>}
         */
        this.windows = {};

        /**
         * 保存应用运行时配置
         * @type {Object}
         */
        this.appConfig = {};

        // 绑定渲染进程请求退出事件
        ipcMain.on(EVENT.app_quit, () => {
            this.quit();
        });

        // 绑定与渲染进程通信事件
        // [upgrade] contextIsolation 安全：反射 RPC 受白名单约束，仅允许 REMOTE_METHOD_WHITELIST 内的方法
        ipcMain.on(EVENT.remote, (e, method, callBackEventName, ...args) => {
            if (!REMOTE_METHOD_WHITELIST.has(method)) {
                if (SHOW_LOG) console.warn(`\n>> Blocked remote call to non-whitelisted method: ${method}`);
                sendRemoteError(e, callBackEventName, new Error(`Method '${method}' is not allowed`));
                return;
            }
            let result;
            try {
                const target = this[method];
                result = typeof target === 'function' ? target.call(this, ...args) : target;
            } catch (err) {
                // 同步抛出也回送错误，避免渲染进程 callRemote 永久挂起
                console.error('\n>> ERROR: Remote call threw synchronously.', method, err);
                sendRemoteError(e, callBackEventName, err);
                return;
            }
            if (result instanceof Promise) {
                result.then(x => {
                    try {
                        e.sender.send(callBackEventName, x);
                    } catch (err) {
                        console.error('\n>> ERROR: Cannot send remote result to BrowserWindow.', err);
                    }
                    return x;
                }).catch(error => {
                    // [upgrade] 回送错误到渲染进程，避免 callRemote 的 Promise 永久挂起
                    console.warn('Remote error', error);
                    sendRemoteError(e, callBackEventName, error);
                });
            } else {
                try {
                    e.sender.send(callBackEventName, result);
                } catch (err) {
                    console.error('\n>> ERROR: Cannot send remote result to BrowserWindow.', err);
                }
            }
            if (DEBUG) {
                console.info('\n>> Accept remote call', `${callBackEventName}.${method}(`, args, ')');
            }
        });

        // 绑定渲染进程请求发送消息到其他窗口渲染进程事件
        ipcMain.on(EVENT.remote_send, (e, windowName, eventName, ...args) => {
            const browserWindow = this.windows[windowName];
            if (browserWindow) {
                browserWindow.webContents.send(eventName, ...args);
            }
        });

        // 绑定渲染进程请求绑定主进程事件
        ipcMain.on(EVENT.remote_on, (e, eventId, event) => {
            events.on(event, (...args) => {
                try {
                    e.sender.send(eventId, ...args);
                } catch (_) {
                    this.off(eventId);
                    if (SHOW_LOG) {
                        console.error(`\n>> Remote event '${event}' has be force removed, because window is closed.`, e);
                    }
                }
            });
            // this._eventsMap[eventId] = {remote: true, id: remoteOnEventId};
            if (SHOW_LOG) console.log('\n>> REMOTE EVENT on', event, eventId);
        });

        // 绑定渲染进程请求取消绑定主进程事件
        ipcMain.on(EVENT.remote_off, (e, eventId) => {
            events.off(eventId);
            if (SHOW_LOG) console.log('\n>> REMOTE EVENT off', eventId);
        });

        // 绑定渲染进程请求触发主进程事件
        ipcMain.on(EVENT.remote_emit, (e, eventId, ...args) => {
            events.emit(eventId, ...args);
            if (SHOW_LOG) console.log('\n>> REMOTE EVENT emit', eventId);
        });

        // 绑定渲染进程通知准备就绪事件
        ipcMain.on(EVENT.app_ready, (e, config, windowName) => {
            if (windowName) {
                Object.assign(this.appConfig, config);
                this.createTrayIcon(windowName);
            }
            if (SHOW_LOG) console.log('\n>> App ready.');
        });

        onLangChange(() => {
            this.createAppMenu();
            this.createDockMenu();
        });

        // 当前窗口控制（channel = 'window'，用 e.sender 定位 BrowserWindow）
        ipcMain.on('window', (e, method, callBackEventName, ...args) => {
            const win = BrowserWindow.fromWebContents(e.sender);
            // [upgrade] 无窗口时回送错误，避免渲染进程 callWindow 永久挂起
            if (!win) {
                if (callBackEventName) sendRemoteError(e, callBackEventName, new Error('BrowserWindow not found'));
                return;
            }
            const wc = win.webContents;
            let result;
            switch (method) {
            case 'show': win.show(); break;
            case 'hide': win.hide(); break;
            case 'minimize': win.minimize(); break;
            case 'restore': win.restore(); break;
            case 'focus': win.focus(); break;
            case 'close': win.close(); break;
            case 'reload': wc.reload(); break;
            case 'setTitle': win.setTitle(args[0]); break;
            case 'setSkipTaskbar': win.setSkipTaskbar(args[0]); break;
            case 'flashFrame': win.flashFrame(args[0]); break;
            case 'openDevTools':
                // [upgrade] 仅开发模式允许开 DevTools，防止被攻破的渲染进程探查 preload 隔离世界
                if (DEBUG) wc.openDevTools(args[0] ? {mode: args[0]} : undefined);
                break;
            case 'copy': wc.copy(); break;
            case 'selectAll': wc.selectAll(); break;
            case 'isFocused': result = win.isFocused(); break;
            case 'isMinimized': result = win.isMinimized(); break;
            case 'isVisible': result = win.isVisible(); break;
            default: break;
            }
            if (callBackEventName) {
                try {
                    e.sender.send(callBackEventName, result);
                } catch (err) {
                    console.error('\n>> ERROR: Cannot send window result to BrowserWindow.', err);
                }
            }
        });

        // 全局快捷键（register 需要回调渲染进程，走独立 channel 'shortcut.register' 等）
        ipcMain.on('shortcut.register', (e, accelerator, cbEventName) => {
            globalShortcut.register(accelerator, () => {
                e.sender.send(cbEventName);
            });
        });
        ipcMain.on('shortcut.unregister', (e, accelerator) => {
            globalShortcut.unregister(accelerator);
        });
        ipcMain.on('shortcut.unregisterAll', () => {
            globalShortcut.unregisterAll();
        });

        // [dev] 渲染进程控制台错误转发
        ipcMain.on('renderer-console', (e, level, message) => {
            console.log(`[renderer:${level}] ${message}`);
        });

        // [upgrade] 同步获取 app 信息（preload 启动时调用，需 sendSync）
        ipcMain.on('app:get-info', (e) => {
            e.returnValue = {
                userDataPath: ElectronApp.getPath('userData'),
                desktopPath: ElectronApp.getPath('desktop'),
                appPath: Path.resolve(ElectronApp.getAppPath(), '..'),
                appRoot: process.env.ELECTRON_APP_ROOT || ElectronApp.getAppPath(),
            };
        });

        // [upgrade] 渲染进程经 callRemote 调用的 app/screen 方法（反射 RPC）
        // app_getPath / app_getLocale / app_getName / app_getLoginItemSettings / app_setLoginItemSettings
        // screen_getAllDisplays / screen_getPrimaryDisplay 已在下方类方法区定义

        // [upgrade] 上下文菜单 popup（主进程创建 Menu 并弹出）
        ipcMain.on('menu.popup', (e, template, x, y) => {
            const win = BrowserWindow.fromWebContents(e.sender);
            const menu = Menu.buildFromTemplate(template);
            // [upgrade] Electron 43 Menu.popup 用 options 签名；x/y 缺省时定位到鼠标位置
            const popupOpts = {};
            if (typeof x === 'number') popupOpts.x = x;
            if (typeof y === 'number') popupOpts.y = y;
            menu.popup(win, popupOpts);
        });
    }

    /**
     * 创建应用菜单
     *
     * @memberof AppRemote
     * @return {void}
     */
    createAppMenu() {
        if (process.platform === 'darwin') {
            const template = [{
                label: Lang.string('app.title'),
                submenu: [{
                    label: Lang.string('menu.about'),
                    selector: 'orderFrontStandardAboutPanel:'
                }, {
                    type: 'separator'
                }, {
                    label: 'Services',
                    submenu: []
                }, {
                    type: 'separator'
                }, {
                    label: Lang.string('menu.hideCurrentWindow'),
                    accelerator: 'Command+H',
                    selector: 'hide:'
                }, {
                    label: Lang.string('menu.hideOtherWindows'),
                    accelerator: 'Command+Shift+H',
                    selector: 'hideOtherApplications:'
                }, {
                    label: Lang.string('menu.showAllWindows'),
                    selector: 'unhideAllApplications:'
                }, {
                    type: 'separator'
                }, {
                    label: Lang.string('menu.quit'),
                    accelerator: 'Command+Q',
                    click: () => {
                        this.quit();
                    }
                }]
            },
            {
                label: Lang.string('menu.edit'),
                submenu: [{
                    label: Lang.string('menu.undo'),
                    accelerator: 'Command+Z',
                    selector: 'undo:'
                }, {
                    label: Lang.string('menu.redo'),
                    accelerator: 'Shift+Command+Z',
                    selector: 'redo:'
                }, {
                    type: 'separator'
                }, {
                    label: Lang.string('menu.cut'),
                    accelerator: 'Command+X',
                    selector: 'cut:'
                }, {
                    label: Lang.string('menu.copy'),
                    accelerator: 'Command+C',
                    selector: 'copy:'
                }, {
                    label: Lang.string('menu.paste'),
                    accelerator: 'Command+V',
                    selector: 'paste:'
                }, {
                    label: Lang.string('menu.selectAll'),
                    accelerator: 'Command+A',
                    selector: 'selectAll:'
                }]
            },
            {
                label: Lang.string('menu.view'),
                submenu: (DEBUG) ? [{
                    label: Lang.string('menu.reload'),
                    accelerator: 'Command+R',
                    click: () => {
                        this.currentFocusWindow.webContents.reload();
                    }
                }, {
                    label: Lang.string('menu.toggleFullscreen'),
                    accelerator: 'Ctrl+Command+F',
                    click: () => {
                        this.currentFocusWindow.setFullScreen(!this.currentFocusWindow.isFullScreen());
                    }
                }, {
                    label: Lang.string('menu.toggleDeveloperTool'),
                    accelerator: 'Alt+Command+I',
                    click: () => {
                        this.currentFocusWindow.toggleDevTools();
                    }
                }] : [{
                    label: Lang.string('menu.toggleFullscreen'),
                    accelerator: 'Ctrl+Command+F',
                    click: () => {
                        this.currentFocusWindow.setFullScreen(!this.currentFocusWindow.isFullScreen());
                    }
                }]
            },
            {
                label: Lang.string('menu.window'),
                submenu: [{
                    label: Lang.string('menu.minimize'),
                    accelerator: 'Command+M',
                    selector: 'performMiniaturize:'
                }, {
                    label: Lang.string('menu.close'),
                    accelerator: 'Command+W',
                    selector: 'performClose:'
                }, {
                    type: 'separator'
                }, {
                    label: Lang.string('menu.bringAllToFront'),
                    selector: 'arrangeInFront:'
                }]
            },
            {
                label: Lang.string('menu.help'),
                submenu: [{
                    label: Lang.string('menu.website'),
                    click() {
                        shell.openExternal(this.appConfig.pkg.homepage);
                    }
                }, {
                    label: Lang.string('menu.project'),
                    click() {
                        shell.openExternal('https://github.com/easysoft/xuanxuan');
                    }
                }, {
                    label: Lang.string('menu.community'),
                    click() {
                        shell.openExternal('https://github.com/easysoft/xuanxuan');
                    }
                }, {
                    label: Lang.string('menu.issues'),
                    click() {
                        shell.openExternal('https://github.com/easysoft/xuanxuan/issues');
                    }
                }]
            }];

            const menu = Menu.buildFromTemplate(template);
            Menu.setApplicationMenu(menu);
        }
    }

    // 初始化并设置 Electron 应用入口路径
    init(entryPath) {
        if (!entryPath) {
            throw new Error('Argument entryPath must be set on init app-remote.');
        }

        this.entryPath = entryPath;
        global.entryPath = entryPath;
    }

    /**
     * 创建程序坞图标右键菜单
     * @return {void}
     * @memberof AppRemote
     */
    createDockMenu() {
        if (IS_MAC_OSX) {
            const dockMenu = Menu.buildFromTemplate([
                {
                    label: Lang.string('menu.createNewWindow'),
                    click: () => {
                        this.createAppWindow();
                    }
                }
            ]);
            ElectronApp.dock.setMenu(dockMenu);
        }
    }

    /**
     * 通知主进程准备就绪并打开主界面窗口
     * @memberof AppRemote
     * @return {void}
     */
    ready() {
        this.openOrCreateWindow();

        this.createDockMenu();

        // 创建应用窗口菜单
        this.createAppMenu();

        // 设置关于窗口
        if (typeof ElectronApp.setAboutPanelOptions === 'function' && this.appConfig.pkg) {
            ElectronApp.setAboutPanelOptions({
                applicationName: Lang.title,
                applicationVersion: this.appConfig.pkg.version,
                copyright: 'Copyright (C) 2017 cnezsoft.com',
                credits: `Licence: ${this.appConfig.pkg.license}`,
                version: DEBUG ? '[debug]' : ''
            });
        }
    }

    /**
     * 移除通知栏图标
     *
     * @param {string} windowName 窗口名称
     * @memberof AppRemote
     * @return {void}
     */
    removeTrayIcon(windowName) {
        if (this._traysData && this._traysData[windowName]) {
            const trayData = this._traysData[windowName];
            const {tray} = trayData;
            if (tray) {
                tray.destroy();
            }
            trayData.tray = null;
            delete this._traysData[windowName];
        }
    }

    /**
     * 初始化通知栏图标功能
     * @memberof AppRemote
     * @param {string} [windowName='main'] 窗口名称
     * @return {void}
     */
    createTrayIcon(windowName = 'main') {
        if (!this._traysData) {
            /**
             * 所有窗口中通知栏图标管理器数据
             * @type {Object[]}
             */
            this._traysData = {};
        }

        // 尝试移除旧的图标
        this.removeTrayIcon(windowName);

        // 创建一个通知栏图标
        const tray = new Tray(`${this.entryPath}/${this.appConfig.media['image.path']}tray-icon-16.png`);

        // 设置通知栏图标右键菜单功能
        const trayContextMenu = Menu.buildFromTemplate([
            {
                label: Lang.string('common.open'),
                click: () => {
                    this.showAndFocusWindow();
                }
            }, {
                label: Lang.string('common.exit'),
                click: () => {
                    const browserWindow = this.windows[windowName];
                    if (browserWindow) {
                        browserWindow.webContents.send(EVENT.remote_app_quit, 'quit');
                    }
                }
            }
        ]);

        // 设置通知栏图标鼠标提示
        tray.setToolTip(Lang.string('app.title'));

        // 绑定通知栏图标点击事件
        tray.on('click', () => {
            this.showAndFocusWindow(windowName);
        });

        // 绑定通知栏图标右键点击事件
        tray.on('right-click', () => {
            tray.popUpContextMenu(trayContextMenu);
        });

        this._traysData[windowName] = {
            /**
             * 通知栏图标管理器
             * @type {Tray}
             * @private
             */
            tray,

            /**
             * 通知栏图标闪烁计数器
             * @type {number}
             * @private
             */
            iconCounter: 0
        };

        /**
         * 通知栏图标图片缓存
         * @type {string[]}
         * @private
         */
        this._trayIcons = [
            nativeImage.createFromPath(`${this.entryPath}/${this.appConfig.media['image.path']}tray-icon-16.png`),
            nativeImage.createFromPath(`${this.entryPath}/${this.appConfig.media['image.path']}tray-icon-transparent.png`)
        ];
    }

    /**
     * 创建应用窗口
     *
     * @param {Object} options Electron 窗口初始化选项
     * @memberof AppRemote
     * @return {void}
     */
    createAppWindow(options) {
        const hasMainWindow = !!this.mainWindow;
        const windowName = hasMainWindow ? `main-${appWindowIndex++}` : 'main';
        options = Object.assign({
            width: 900,
            height: 650,
            minWidth: 400,
            minHeight: 650,
            url: `index.html?_name=${windowName}`,
            hashRoute: '/index',
            name: windowName,
            resizable: true,
            debug: DEBUG
        }, options);

        if (DEBUG && !hasMainWindow) {
            const display = electron.screen.getPrimaryDisplay();
            options.height = display.workAreaSize.height;
            options.width = 800;
            options.x = display.workArea.x;
            options.y = display.workArea.y;
        }

        const appWindow = this.createWindow(options);

        appWindow.on('close', e => {
            if (this.markClose && this.markClose[windowName]) return;
            const now = new Date().getTime();
            if (this.lastRequestCloseTime && (now - this.lastRequestCloseTime) < 1000) {
                dialog.showMessageBox(appWindow, {
                    buttons: [Lang.string('common.exitIM'), Lang.string('common.cancel')],
                    defaultId: 0,
                    type: 'question',
                    message: Lang.string('common.comfirmQuiteIM')
                }).then(({response}) => {
                    if (response === 0) {
                        setTimeout(() => {
                            this.closeWindow(windowName);
                        }, 0);
                    }
                    return null;
                }).catch(() => {});
            } else {
                this.lastRequestCloseTime = now;
                if (appWindow) {
                    appWindow.webContents.send(EVENT.remote_app_quit);
                }
            }
            e.preventDefault();
            return false;
        });

        // 绑定右键菜单事件
        appWindow.webContents.on('context-menu', (e, props) => {
            const {isEditable} = props;
            if (isEditable) {
                /**
                 * 文本输入框右键菜单
                 * @type {Menu}
                 * @private
                 */
                const inputMenu = Menu.buildFromTemplate([
                    {role: 'undo', label: Lang.string('menu.undo')},
                    {role: 'redo', label: Lang.string('menu.redo')},
                    {type: 'separator'},
                    {role: 'cut', label: Lang.string('menu.cut')},
                    {role: 'copy', label: Lang.string('menu.copy')},
                    {role: 'paste', label: Lang.string('menu.paste')},
                    {type: 'separator'},
                    {role: 'selectall', label: Lang.string('menu.selectAll')}
                ]);
                inputMenu.popup(appWindow);
            }
        });

        if (!hasMainWindow) {
            /**
             * 主窗口实例
             * @type {BrowserWindow}
             */
            this.mainWindow = appWindow;
        }

        return windowName;
    }

    /**
     * 创建应用窗口，所有可用的窗口初始化选项参考 @see https://electronjs.org/docs/api/browser-window#new-browserwindowoptions
     * @param {string} name 窗口名称，用户内部查询窗口实例
     * @param {Object} options Electron 窗口初始化选项
     * @memberof AppRemote
     * @return {BrowserWindow} 创建的应用窗口实例
     */
    createWindow(name, options) {
        if (typeof name === 'object') {
            options = name;
            // eslint-disable-next-line prefer-destructuring
            name = options.name;
        }

        options = Object.assign({
            name,
            showAfterLoad: true,
            hashRoute: `/${name}`,
            url: 'index.html',
            autoHideMenuBar: !IS_MAC_OSX,
            backgroundColor: '#ffffff',
            show: DEBUG,
            webPreferences: {}
        }, options);

        // [upgrade] 安全：webPreferences 的安全关键字段始终由主进程强制，忽略渲染进程传入值。
        // 防止经 createAppWindow 反射调用时传入 {nodeIntegration:true, contextIsolation:false} 实现沙箱逃逸。
        options.webPreferences = Object.assign({}, options.webPreferences, {
            nodeIntegration: false,
            contextIsolation: true,
            // sandbox:false 让 preload 可用 Node crypto/fs/path/os（contextIsolation 仍隔离渲染进程主世界）
            sandbox: false,
            preload: Path.join(__dirname, 'platform/electron/preload.js'),
        });

        let browserWindow = this.windows[name];
        if (browserWindow) {
            throw new Error(`The window with name '${name}' has already be created.`);
        }

        const windowSetting = Object.assign({}, options);
        ['url', 'showAfterLoad', 'debug', 'hashRoute', 'onLoad', 'beforeShow', 'afterShow', 'onClosed'].forEach(optionName => {
            delete windowSetting[optionName];
        });
        browserWindow = new BrowserWindow(windowSetting);
        if (DEBUG) {
            console.log(`>> Create window "${name}" with setting: `, windowSetting);
        }

        this.windows[name] = browserWindow;
        browserWindow.on('closed', () => {
            delete this.windows[name];
            if (options.onClosed) {
                options.onClosed(name);
            }
            this.tryQuiteOnAllWindowsClose();
        });

        browserWindow.webContents.on('did-finish-load', () => {
            if (options.showAfterLoad) {
                if (options.beforeShow) {
                    options.beforeShow(browserWindow, name);
                }
                browserWindow.show();
                browserWindow.focus();
                if (options.afterShow) {
                    options.afterShow(browserWindow, name);
                }
            }
            if (options.onLoad) {
                options.onLoad(browserWindow);
            }
        });

        // 阻止应用窗口导航到其他地址
        browserWindow.webContents.on('will-navigate', event => {
            event.preventDefault();
        });

        // 阻止应用内的链接打开新窗口（Electron 24+ 移除 new-window 事件，改用 setWindowOpenHandler）
        browserWindow.webContents.setWindowOpenHandler(({url}) => {
            browserWindow.webContents.send(EVENT.open_url, url);
            return {action: 'deny'};
        });

        // [upgrade] contextIsolation：转发当前窗口事件给渲染进程（preload window.on 监听）
        ['focus', 'blur', 'minimize', 'restore'].forEach(evt => {
            browserWindow.on(evt, () => {
                browserWindow.webContents.send(`window.${evt}`);
            });
        });

        let {url} = options;
        if (url) {
            // [upgrade] 开发模式从 Vite dev server 加载（XXC_PLATFORM=electron），生产从 file:// 加载
            const devServerUrl = process.env.VITE_DEV_SERVER_URL;
            if (devServerUrl) {
                url = `${devServerUrl}/${url}`;
            } else if (!url.startsWith('file://') && !url.startsWith('http://') && !url.startsWith('https://')) {
                url = `file://${this.entryPath}/${options.url}`;
            }
            if (DEBUG) {
                url += url.includes('?') ? '&react_perf' : '?react_perf';
            }
            if (options.hashRoute) {
                url += `#${options.hashRoute}`;
            }
            browserWindow.loadURL(url);
        }

        if (options.debug && DEBUG) {
            browserWindow.webContents.openDevTools({mode: 'bottom'});
            browserWindow.webContents.on('context-menu', (e, props) => {
                const {x, y} = props;
                Menu.buildFromTemplate([{
                    label: Lang.string('debug.inspectElement'),
                    click() {
                        browserWindow.inspectElement(x, y);
                    }
                }]).popup(browserWindow);
            });

            browserWindow.webContents.on('crashed', () => {
                const messageBoxOptions = {
                    type: 'info',
                    title: 'Renderer process crashed.',
                    message: 'The renderer process has been crashed, you can reload or close it.',
                    buttons: ['Reload', 'Close']
                };
                if (DEBUG) {
                    console.error(`\n>> ERROR: ${messageBoxOptions.message}`);
                }
                dialog.showMessageBox(messageBoxOptions).then(({response}) => {
                    if (response === 0) {
                        browserWindow.reload();
                    } else {
                        browserWindow.close();
                    }
                    return null;
                }).catch(() => {});
            });
        }

        return browserWindow;
    }

    /**
     * 打开主窗口
     *
     * @memberof AppRemote
     * @return {void}
     */
    openOrCreateWindow() {
        const {currentFocusWindow} = this;
        if (!currentFocusWindow) {
            this.createAppWindow();
        } else if (!currentFocusWindow.isVisible()) {
            currentFocusWindow.show();
            currentFocusWindow.focus();
        }
    }

    /**
     * 获取主窗口实例
     * @memberof AppRemote
     * @type {BrowserWindow}
     */
    get mainWindow() {
        return this.windows.main;
    }

    /**
     * 设置主窗口实例
     * @param {BrowserWindow} mainWindow 主窗口实例
     * @memberof AppRemote
     */
    set mainWindow(mainWindow) {
        if (!mainWindow) {
            delete this.windows.main;
        } else {
            this.windows.main = mainWindow;
        }
    }

    /**
     * 关闭指定名称的窗口
     * @param {string} winName 窗口名称
     * @returns {boolean} 如果返回 `true` 则为关闭成功，否则为关闭失败（可能找不到指定名称的窗口）
     */
    closeWindow(winName) {
        // 移除窗口对应的通知栏图标
        this.removeTrayIcon(winName);

        // 获取已保存的窗口对象
        const win = this.windows[winName];
        if (SHOW_LOG) console.log('>> closeWindow', winName);
        if (win) {
            // 将窗口标记为关闭，跳过询问用户关闭策略步骤
            if (!this.markClose) {
                this.markClose = {};
            }
            this.markClose[winName] = true;
            win.close();
            return true;
        }
        return false;
    }

    /**
     * 尝试退出，如果所有窗口都被关闭
     *
     * @memberof AppRemote
     * @return {void}
     */
    tryQuiteOnAllWindowsClose() {
        let hasWindowOpen = false;
        Object.keys(this.windows).forEach(windowName => {
            if (!hasWindowOpen && this.windows[windowName] && !this.markClose[windowName]) {
                hasWindowOpen = true;
            }
        });
        if (SHOW_LOG) console.log('>> tryQuiteOnAllWindowsClose', hasWindowOpen);
        if (!hasWindowOpen) {
            this.quit();
        }
    }

    // /**
    //  * 关闭所有窗口
    //  * @return {void}
    //  */
    // closeAllWindows() {
    //     Object.keys(this.windows).forEach(winName => this.closeWindow(winName));
    // }

    /**
     * 获取当前激活的窗口
     * @memberof AppRemote
     * @type {BrowserWindow}
     */
    get currentFocusWindow() {
        const focusedWindowName = Object.keys(this.windows).find(winName => this.windows[winName].isFocused());
        return focusedWindowName ? this.windows[focusedWindowName] : (this.mainWindow || this.windows[Object.keys(this.windows)[0]]);
    }

    /**
     * 通过 IPC 向所有应用窗口渲染渲染进程发送消息
     *
     * @param {string} channel 事件频道
     * @param {...any} args 事件参数
     * @return {void}
     * @memberof AppRemote
     */
    sendToWindows(channel, ...args) {
        Object.keys(this.windows).forEach(name => {
            this.sendToWindow(name, channel, ...args);
        });
    }

    /**
     * 通过 IPC 向指定名称的应用窗口渲染渲染进程发送消息
     *
     * @param {string} name 应用窗口名称
     * @param {string} channel 事件频道
     * @param {...any} args 事件参数
     * @return {void}
     * @memberof AppRemote
     */
    sendToWindow(name, channel, ...args) {
        const browserWindow = this.windows[name];
        if (browserWindow) {
            browserWindow.webContents.send(channel, ...args);
        }
    }

    /**
     * 设置通知栏图标工具提示（鼠标悬停显示）消息
     *
     * @param {string|boolean} tooltip 要设置的消息文本，如果设置为 `false`，则显示应用默认名称
     * @param {string} [windowName='main'] 窗口名称
     * @memberof AppRemote
     * @return {void}
     */
    trayTooltip(tooltip, windowName = 'main') {
        const trayData = this._traysData && this._traysData[windowName];
        if (trayData) {
            trayData.tray.setToolTip(tooltip || Lang.string('app.title'));
        }
    }

    /**
     * 闪烁通知栏图标
     *
     * @param {boolean} [flash=true] 如果设置为 `true` 则闪烁图标；如果设置为 `false` 则取消闪烁图标
     * @param {string} [windowName='main'] 窗口名称
     * @memberof AppRemote
     * @return {void}
     */
    flashTrayIcon(flash = true, windowName = 'main') {
        const trayData = this._traysData && this._traysData[windowName];
        if (trayData) {
            if (flash) {
                if (!trayData.flashTask) {
                    trayData.flashTask = setInterval(() => {
                        if (trayData.tray) {
                            trayData.tray.setImage(this._trayIcons[(trayData.iconCounter++) % 2]);
                        }
                    }, 400);
                }
            } else {
                if (trayData.flashTask) {
                    clearInterval(trayData.flashTask);
                    trayData.flashTask = null;
                }
                trayData.tray.setImage(this._trayIcons[0]);
            }
        }
    }

    /**
     * 显示并激活指定名称的窗口，如果不指定名称，则激活并显示主窗口
     *
     * @param {string} [windowName='main'] 窗口名称
     * @memberof AppRemote
     * @return {void}
     */
    showAndFocusWindow(windowName = 'main') {
        const browserWindow = this.windows[windowName];
        if (browserWindow) {
            if (browserWindow.isMinimized()) {
                browserWindow.restore();
            } else {
                browserWindow.show();
            }
            browserWindow.focus();
        }
    }

    /**
     * 尝试询问用户是否要创建一个新窗口
     *
     * @memberof AppRemote
     * @return {void}
     */
    confirmCreateAppWindow() {
        this.showAndFocusWindow();
        dialog.showMessageBox(this.currentFocusWindow, {
            buttons: [Lang.string('common.confirm'), Lang.string('common.cancel')],
            defaultId: 0,
            type: 'question',
            message: Lang.string('common.confirmCreateAppWindow')
        }).then(({response}) => {
            if (response === 0) {
                this.createAppWindow();
            }
            return null;
        }).catch(() => {});
    }

    /**
     * 立即关闭并退出应用程序
     *
     * @memberof AppRemote
     * @return {void}
     */
    // eslint-disable-next-line class-methods-use-this
    quit() {
        if (SHOW_LOG) console.log('>> quit');
        try {
            globalShortcut.unregisterAll();
        } catch (_) {} // eslint-disable-line
        ElectronApp.quit();
    }

    /**
     * 设置 Mac Dock 栏应用图标上的圆点提示文本
     *
     * @param {string} label 提示文本
     * @memberof AppRemote
     * @return {void}
     */
    // eslint-disable-next-line class-methods-use-this
    dockBadgeLabel(label) {
        if (IS_MAC_OSX) {
            ElectronApp.dock.setBadge(label);
        }
    }

    /**
     * 使 Mac Dock 栏应用图标弹跳并引起用户注意
     *
     * @param {string} [type='informational'] Dock 栏应用图标弹跳类型
     * @memberof AppRemote
     * @return {void}
     */
    // eslint-disable-next-line class-methods-use-this
    dockBounce(type = 'informational') {
        if (IS_MAC_OSX) {
            ElectronApp.dock.bounce(type);
        }
    }

    // ─── contextIsolation 安全模型：callRemote 反射 RPC 调用的方法 ───

    /**
     * 文件操作（fs 白名单）
     * @memberof AppRemote
     * @return {Promise}
     */
    // eslint-disable-next-line class-methods-use-this
    fs_outputFile(file, data) {return fse.outputFile(file, Buffer.from(data));}
    // eslint-disable-next-line class-methods-use-this
    fs_copy(src, dest) {return fse.copy(src, dest);}
    // eslint-disable-next-line class-methods-use-this
    fs_pathExists(p) {return fse.pathExists(p);}
    // eslint-disable-next-line class-methods-use-this
    fs_ensureDir(p) {return fse.ensureDir(p);}
    // eslint-disable-next-line class-methods-use-this
    fs_readJson(p) {return fse.readJSON(p, {throws: false});}
    // eslint-disable-next-line class-methods-use-this
    fs_writeJson(p, obj) {return fse.writeJSON(p, obj);}
    // eslint-disable-next-line class-methods-use-this
    fs_remove(p) {return fse.remove(p);}
    /**
     * 获取文件状态
     * @param {string} p 文件路径
     * @returns {Promise} 纯对象（Stats 方法经 IPC 结构化克隆会丢失原型，故提取数据字段）
     */
    // eslint-disable-next-line class-methods-use-this
    async fs_stat(p) {
        const st = await fse.stat(p);
        return {
            size: st.size,
            mtime: st.mtime,
            mtimeMs: st.mtimeMs,
            ctime: st.ctime,
            birthtime: st.birthtime,
            isFile: st.isFile(),
            isDirectory: st.isDirectory()
        };
    }

    /**
     * 对话框（主进程 API）
     * @memberof AppRemote
     * @return {Promise}
     */
    // eslint-disable-next-line class-methods-use-this
    dialog_showMessageBox(options) {return dialog.showMessageBox(options);}
    // eslint-disable-next-line class-methods-use-this
    dialog_showSaveDialog(options) {return dialog.showSaveDialog(options);}
    // eslint-disable-next-line class-methods-use-this
    dialog_showOpenDialog(options) {return dialog.showOpenDialog(options);}

    /**
     * 全局快捷键是否已注册
     * @memberof AppRemote
     * @return {boolean}
     */
    // eslint-disable-next-line class-methods-use-this
    shortcut_isRegistered(accelerator) {return globalShortcut.isRegistered(accelerator);}

    // ─── App API（callRemote 反射 RPC 调用） ───
    // eslint-disable-next-line class-methods-use-this
    app_getPath(name) {return ElectronApp.getPath(name);}
    // eslint-disable-next-line class-methods-use-this
    app_getLocale() {return ElectronApp.getLocale();}
    // eslint-disable-next-line class-methods-use-this
    app_getName() {return ElectronApp.getName();}
    // eslint-disable-next-line class-methods-use-this
    app_getLoginItemSettings() {return ElectronApp.getLoginItemSettings();}
    // eslint-disable-next-line class-methods-use-this
    app_setLoginItemSettings(settings) {return ElectronApp.setLoginItemSettings(settings);}

    // ─── Screen API（callRemote 反射 RPC 调用） ───
    // eslint-disable-next-line class-methods-use-this
    screen_getAllDisplays() {return electron.screen.getAllDisplays();}
    // eslint-disable-next-line class-methods-use-this
    screen_getPrimaryDisplay() {return electron.screen.getPrimaryDisplay();}
}

/**
 * Electron 主进程运行时管理类全局唯一实例
 * @type {AppRemote}
 */
const app = new AppRemote();

export default app;
