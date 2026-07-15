/**
 * Electron preload 脚本（contextIsolation + contextBridge 安全模型）
 *
 * 渲染进程不再直接访问 Node / Electron API。本脚本运行在隔离的 preload
 * 上下文（有 Node 权限），通过 contextBridge.exposeInMainWorld 暴露白名单 API。
 * 复用 app-remote.js 现有的 ipcMain.on(EVENT.remote) 反射 RPC 模式，不另起 IPC。
 *
 * 暴露的 window.electron 命名空间包含渲染进程需要的全部桌面能力。
 * 不暴露 require、不暴露整个 electron 对象。
 */

 
const {contextBridge, ipcRenderer, clipboard, nativeImage, shell} = require('electron');
const nodeCrypto = require('crypto');
const nodeFs = require('fs');
const nodePath = require('path');
const nodeOs = require('os');

/**
 * IPC 事件常量（与 remote-events.js 保持一致）
 */
const EVENT = {
    remote: 'remote',
    remote_on: 'remote.on',
    remote_off: 'remote.off',
    remote_emit: 'remote.emit',
    remote_send: 'remote.send',
    remote_app_quit: 'remote.app.quit',
    capture_screen: 'capture.screen',
    app_ready: 'app.ready',
    open_url: 'window.open_url',
    remote_lang_change: 'remote.lang.change',
    lang_change: 'app.lang.change',
};

/**
 * 当前窗口控制 IPC 频道前缀
 */
const WIN_CHANNEL = 'window';

// ─── IPC 事件总线（复用现有 EVENT.remote 反射 RPC） ───────────────────

/**
 * 已绑定事件清单（eventsMap），用于 remoteOff 取消绑定
 * @type {Object}
 */
const eventsMap = {};

/**
 * 事件 ID 递增种子
 * @type {number}
 */
let idSeed = Date.now() + Math.floor(Math.random() * 100000);

/**
 * 调用主进程方法（复用 app-remote.js ipcMain.on(EVENT.remote) 反射 RPC）
 * @param {string} method AppRemote 方法名
 * @param  {...any} args 调用参数
 * @returns {Promise} 主进程返回结果
 */
const callRemote = (method, ...args) => new Promise((resolve) => {
    const callBackEventName = `${EVENT.remote}.${idSeed++}`;
    ipcRenderer.once(callBackEventName, (e, remoteResult) => {
        resolve(remoteResult);
    });
    ipcRenderer.send(EVENT.remote, method, callBackEventName, ...args);
});

/**
 * 通过 IPC 向主进程发送事件
 * @param {string} eventName 事件名称
 * @param  {...any} args 事件参数
 */
const ipcSend = (eventName, ...args) => {
    ipcRenderer.send(eventName, ...args);
};

/**
 * 绑定 IPC 事件
 * @param {string} event 事件名称
 * @param {function} listener 回调函数
 * @returns {Symbol} 事件 ID
 */
const ipcOn = (event, listener) => {
    ipcRenderer.on(event, listener);
    const name = Symbol(event);
    eventsMap[name] = {listener, name: event, ipc: true};
    return name;
};

/**
 * 绑定一次性 IPC 事件
 * @param {string} event 事件名称
 * @param {function} listener 回调函数
 * @returns {Symbol} 事件 ID
 */
const ipcOnce = (event, listener) => {
    const name = Symbol(event);
    const bindedListener = (...args) => {
        remoteOff(name);
        listener(...args);
    };
    ipcRenderer.once(event, bindedListener);
    eventsMap[name] = {listener: bindedListener, name: event, ipc: true};
    return name;
};

/**
 * 在渲染进程绑定主进程 EventEmitter 上的事件
 * @param {string} event 事件名称
 * @param {function} listener 回调函数
 * @returns {string} 事件 ID
 */
const remoteOn = (event, listener) => {
    const eventId = `${EVENT.remote_on}.${event}.${idSeed++}`;
    const ipcEventName = ipcOn(eventId, (e, ...args) => {
        listener(...args, e);
    });
    eventsMap[eventId] = {remote: true, id: ipcEventName};
    ipcRenderer.send(EVENT.remote_on, eventId, event);
    return eventId;
};

/**
 * 触发主进程 EventEmitter 上的事件
 * @param {string} event 事件名称
 * @param  {...any} args 事件参数
 */
const remoteEmit = (event, ...args) => {
    ipcRenderer.send(EVENT.remote_emit, event, ...args);
};

/**
 * 取消绑定事件
 * @param  {...any} names 事件 ID
 */
const remoteOff = (...names) => {
    names.forEach(name => {
        const event = eventsMap[name];
        if (event) {
            if (event.remote) {
                remoteOff(event.id);
                ipcSend(EVENT.remote_off, name);
            } else if (event.ipc) {
                ipcRenderer.removeListener(event.name, event.listener);
            }
            delete eventsMap[name];
        }
    });
};

/**
 * 向其他窗口渲染进程发送消息
 * @param {string} windowName 窗口名称
 * @param {string} eventName 事件名称
 * @param  {...any} args 事件参数
 */
const sendToWindow = (windowName, eventName, ...args) => {
    ipcRenderer.send(EVENT.remote_send, windowName, eventName, ...args);
};

const sendToMainWindow = (eventName, ...args) => sendToWindow('main', eventName, ...args);
const onRequestQuit = listener => ipcOn(EVENT.remote_app_quit, listener);
const onRequestOpenUrl = listener => ipcOn(EVENT.open_url, listener);

// ─── 当前窗口控制（经 IPC 到主进程，操作 sender 对应的 BrowserWindow） ────

/**
 * 调用当前窗口方法（经 IPC channel = WIN_CHANNEL，主进程用 e.sender 定位窗口）
 * @param {string} method 方法名
 * @param  {...any} args 参数
 * @returns {Promise} 结果
 */
const callWindow = (method, ...args) => new Promise((resolve) => {
    const callBackEventName = `${WIN_CHANNEL}.${method}.${idSeed++}`;
    ipcRenderer.once(callBackEventName, (e, result) => {
        resolve(result);
    });
    ipcRenderer.send(WIN_CHANNEL, method, callBackEventName, ...args);
});

// ─── Crypto（preload 上下文内 Node crypto，无需 IPC 往返） ─────────────

/**
 * AES-256-CBC 加密
 * @param {string} data 明文
 * @param {string} token AES key
 * @param {string} cipherIV AES IV
 * @returns {Uint8Array} 密文（Uint8Array 以便跨 contextBridge + 原生 WebSocket）
 */
const encrypt = (data, token, cipherIV) => {
    const cipher = nodeCrypto.createCipheriv('aes-256-cbc', token, cipherIV);
    let crypted = cipher.update(data, 'utf8', 'binary');
    crypted += cipher.final('binary');
    return new Uint8Array(Buffer.from(crypted, 'binary'));
};

/**
 * AES-256-CBC 解密
 * @param {Uint8Array|ArrayBuffer} data 密文
 * @param {string} token AES key
 * @param {string} cipherIV AES IV
 * @returns {string} 明文
 */
const decrypt = (data, token, cipherIV) => {
    const buf = Buffer.from(data);
    const decipher = nodeCrypto.createDecipheriv('aes-256-cbc', token, cipherIV);
    let decoded = decipher.update(buf, 'binary', 'utf8');
    decoded += decipher.final('utf8');
    return decoded;
};

// ─── 静态预计算值（preload 在渲染进程启动前同步计算） ───────────────

const platformStr = nodeOs.platform();
const isOSX = platformStr === 'darwin';
const isWindowsOS = platformStr === 'win32';
const isLinux = !isOSX && !isWindowsOS;
// [upgrade] app 是主进程模块，preload（渲染进程侧）不可直接 require。
// 经同步 IPC 获取 userDataPath/desktopPath/appPath/appRoot。
const appInfo = ipcRenderer.sendSync('app:get-info');
const {userDataPath} = appInfo;
const {desktopPath} = appInfo;
const tmpPath = nodePath.join(userDataPath, 'temp');
const {appPath} = appInfo;
const {appRoot} = appInfo;

/**
 * 从 URL query 中提取窗口名（与 env.js 旧逻辑一致）
 * @returns {Object} URL 参数表
 */
const getUrlParams = () => {
    const params = {};
    try {
        new URL(window.location.href).searchParams.forEach((v, k) => {
            params[k] = v;
        });
    } catch (_) {} // eslint-disable-line no-empty
    return params;
};

const urlParams = getUrlParams();
const windowName = urlParams._name || 'main';

// ─── Build-in 配置（preload 预读静态 JSON，渲染进程同步访问） ─────────

const buildInBasePath = nodePath.resolve(appRoot, 'build-in');
const readJsonSafe = (file) => {
    try {
        const content = nodeFs.readFileSync(file, 'utf8');
        return content ? JSON.parse(content) : null;
    } catch (_) {  
        return null;
    }
};
const buildInPath = buildInBasePath;
const buildInConfig = readJsonSafe(nodePath.join(buildInBasePath, 'config.json'));
const buildInExtensions = readJsonSafe(nodePath.join(buildInBasePath, 'extensions.json'));

// ─── 文件操作（经 IPC 到主进程，白名单方法） ───────────────────

const fs = {
    outputFile: (file, data) => callRemote('fs_outputFile', file, data instanceof Uint8Array ? Array.from(data) : data),
    copy: (src, dest) => callRemote('fs_copy', src, dest),
    pathExists: (p) => callRemote('fs_pathExists', p),
    ensureDir: (p) => callRemote('fs_ensureDir', p),
    readJson: (p) => callRemote('fs_readJson', p),
    writeJson: (p, obj) => callRemote('fs_writeJson', p, obj),
    remove: (p) => callRemote('fs_remove', p),
    stat: (p) => callRemote('fs_stat', p),
};

// ─── 暴露白名单 API 到渲染进程 ─────────────────────────────

contextBridge.exposeInMainWorld('electron', {
    EVENT,

    // IPC 事件总线
    callRemote,
    ipcSend,
    ipcOn,
    ipcOnce,
    remoteOn,
    remoteEmit,
    remoteOff,
    sendToWindow,
    sendToMainWindow,
    onRequestQuit,
    onRequestOpenUrl,

    // 当前窗口控制
    window: {
        show: () => callWindow('show'),
        hide: () => callWindow('hide'),
        minimize: () => callWindow('minimize'),
        restore: () => callWindow('restore'),
        focus: () => callWindow('focus'),
        close: () => callWindow('close'),
        reload: () => callWindow('reload'),
        setTitle: (title) => callWindow('setTitle', title),
        setSkipTaskbar: (skip) => callWindow('setSkipTaskbar', skip),
        flashFrame: (flag) => callWindow('flashFrame', flag),
        isFocused: () => callWindow('isFocused'),
        isMinimized: () => callWindow('isMinimized'),
        isVisible: () => callWindow('isVisible'),
        openDevTools: (mode) => callWindow('openDevTools', mode),
        copy: () => callWindow('copy'),
        selectAll: () => callWindow('selectAll'),
        on: (event, listener) => ipcOn(`${WIN_CHANNEL}.${event}`, listener),
    },

    // Crypto（preload 内 Node crypto）
    crypto: {encrypt, decrypt},

    // 静态环境
    env: {
        arch: process.arch,
        platform: platformStr,
        os: isOSX ? 'mac' : isWindowsOS ? 'windows' : platformStr,
        isWindowsOS,
        isOSX,
        isLinux,
        dataPath: userDataPath,
        desktopPath,
        tmpPath,
        appPath,
        appRoot,
        windowName,
    },

    // Build-in（预读静态 JSON）
    buildIn: {
        buildInPath,
        config: buildInConfig,
        extensions: buildInExtensions,
        getBuildInConfig: () => buildInConfig,
        getBuildInExtensions: () => buildInExtensions,
    },

    // App（主进程 API，经 IPC 异步调用）
    app: {
        getPath: (name) => callRemote('app_getPath', name),
        getLocale: () => callRemote('app_getLocale'),
        getName: () => callRemote('app_getName'),
        getAppPath: () => appPath,
        getLoginItemSettings: () => callRemote('app_getLoginItemSettings'),
        setLoginItemSettings: (settings) => callRemote('app_setLoginItemSettings', settings),
    },

    // Clipboard（renderer 可用 API，经 preload 包装；image 用 dataURL 跨桥）
    clipboard: {
        readText: () => clipboard.readText(),
        writeText: (text) => clipboard.writeText(text),
        readHTML: () => clipboard.readHTML(),
        writeHTML: (markup) => clipboard.writeHTML(markup),
        readImage: () => {
            const img = clipboard.readImage();
            return img.isEmpty() ? null : img.toDataURL();
        },
        writeImage: (dataUrl) => {
            if (dataUrl) {
                clipboard.writeImage(nativeImage.createFromDataURL(dataUrl));
            }
        },
        write: (data) => clipboard.write(data),
        writeImageFromUrl: (url, dataType = 'path') => {
            if (url.startsWith('file://')) {
                url = url.substr(7);
            }
            const img = dataType === 'base64' ? nativeImage.createFromDataURL(url) : nativeImage.createFromPath(url);
            clipboard.writeImage(img);
        },
        getNewImage: () => {
            const img = clipboard.readImage();
            if (img && !img.isEmpty()) {
                const size = img.getSize();
                const base64 = img.toDataURL();
                return {
                    name: `clipboard-image-${size.width}x${size.height}.png`,
                    type: 'base64',
                    base64,
                    width: size.width,
                    height: size.height,
                    size: Math.ceil((4 * (base64.length / 3)) + (base64.length % 3 !== 0 ? 4 : 0)),
                };
            }
            return null;
        },
    },

    // Shell
    shell: {
        openExternal: (url) => shell.openExternal(url),
        showItemInFolder: (p) => shell.showItemInFolder(p),
        openItem: (p) => shell.openPath(p),
    },

    // Dialog（主进程 API，经 IPC）
    dialog: {
        showMessageBox: (options) => callRemote('dialog_showMessageBox', options),
        showSaveDialog: (options) => callRemote('dialog_showSaveDialog', options),
        showOpenDialog: (options) => callRemote('dialog_showOpenDialog', options),
    },

    // Global shortcut（主进程 API，经 IPC）
    shortcut: {
        register: (accelerator, callback) => {
            const cbEventName = `shortcut.${idSeed++}`;
            ipcOn(cbEventName, () => callback());
            ipcSend('shortcut.register', accelerator, cbEventName);
        },
        unregister: (accelerator) => ipcSend('shortcut.unregister', accelerator),
        unregisterAll: () => ipcSend('shortcut.unregisterAll'),
        isRegistered: (accelerator) => callRemote('shortcut_isRegistered', accelerator),
    },

    // Menu（主进程 API，经 IPC 异步调用）
    menu: {
        buildFromTemplate: (template) => template,
        popup: (template, x, y) => {
            if (typeof x === 'object') {
                y = x.clientY;
                x = x.clientX;
            }
            ipcSend('menu.popup', template, x, y);
        },
    },

    // NativeImage（renderer 可用 API，经 preload 包装为 dataURL）
    nativeImage: {
        createFromPath: (p) => nativeImage.createFromPath(p),
        createFromDataURL: (url) => nativeImage.createFromDataURL(url),
    },

    // 文件操作（经 IPC 白名单）
    fs,

    // Screen（主进程 API，经 IPC 异步调用）
    screen: {
        getAllDisplays: () => callRemote('screen_getAllDisplays'),
        getPrimaryDisplay: () => callRemote('screen_getPrimaryDisplay'),
    },
});

// [dev] 将渲染进程控制台错误转发到主进程日志（便于终端查看）
if (process.env.NODE_ENV === 'development') {
    const originalError = console.error;
    console.error = (...args) => {
        ipcRenderer.send('renderer-console', 'error', args.map(a => {
            try {return typeof a === 'object' ? JSON.stringify(a).substring(0, 500) : String(a);} catch (e) {return String(a);}
        }).join(' '));
        originalError(...args);
    };
    window.addEventListener('error', (e) => {
        ipcRenderer.send('renderer-console', 'error', `Uncaught: ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`);
    });
    window.addEventListener('unhandledrejection', (e) => {
        ipcRenderer.send('renderer-console', 'error', `UnhandledRejection: ${e.reason && e.reason.message ? e.reason.message : String(e.reason)}`);
    });
}
