/**
 * 入口文件：main.development.js
 * 这是 Electron 主进程的入口文件
 */

import {app as ElectronApp} from 'electron';
import application from './platform/electron/app-remote.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 禁用自签发证书警告
ElectronApp.commandLine.appendSwitch('ignore-certificate-errors');

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 记录入口文件所在目录
application.init(__dirname);

// 当 Electron 初始化完毕且创建完窗口时调用
ElectronApp.on('ready', async () => {
    // 打开主窗口
    application.ready();
});

// 当所有窗口关闭时退出应用
ElectronApp.on('window-all-closed', () => {
    application.tryQuiteOnAllWindowsClose();
});

// 当应用被激活时打开主窗口
ElectronApp.on('activate', () => {
    application.openOrCreateWindow();
});

// 监听第二个实例启动事件
ElectronApp.on('second-instance', (event, commandLine, workingDirectory) => {
    application.openOrCreateWindow();
});

// 监听 URL 协议调用事件
ElectronApp.on('open-url', (event, url) => {
    // 设置事件已经被处理
    event.preventDefault();
    // 处理传入的 URL
    application.handleRemoteUrl(url);
});
