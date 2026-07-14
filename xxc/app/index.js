/**
 * 入口文件：index.js
 * 这是 Electron 渲染进程启动的主窗口入口文件
 */

import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import './style/app.less';
import './utils/debug';
import './utils/react-debug';
import _HomeIndex from './views/index';
import {ready} from './core/runtime';
import {triggerReady} from './core/ui';
import withReplaceView from './views/with-replace-view';
import registerDialogCommands from './views/register-dialogs-commands';

/**
 * HomeIndex 可替换组件形式
 * @type {Class<HomeIndex>}
 * @private
 */
const HomeIndex = withReplaceView(_HomeIndex);

document.body.classList.add('no-animation');

// 喧喧运行时管理程序就绪时加载 React 界面组件
ready(() => {
    const appElement = document.getElementById('appContainer');
    const root = createRoot(appElement);
    // React 18：ReactDOM.render 已废弃，改用 createRoot。原 render 的第三个参数
    // callback 在首次渲染提交后执行；这里用 flushSync 保证同步提交，随后立即执行
    // 移除 loading、注册对话框命令、触发界面就绪事件等收尾逻辑，行为与旧版一致。
    flushSync(() => {
        root.render(<HomeIndex />);
    });

    const loadingElement = document.getElementById('loading');
    loadingElement.parentNode.removeChild(loadingElement);

    setTimeout(() => {
        document.body.classList.remove('no-animation');
    }, 2000);

    // 注册对话框命令
    registerDialogCommands();

    // 触发界面就绪事件
    triggerReady();
});
