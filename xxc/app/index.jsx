/**
 * 入口文件：index.js
 * 这是 Electron 渲染进程启动的主窗口入口文件
 */

import React from 'react';
import ReactDOM from 'react-dom';
import './style/app.less';
import './utils/debug.js';
import './utils/react-debug.js';
import _HomeIndex from './views/index/index.jsx';
import {ready} from './core/runtime.js';
import {triggerReady} from './core/ui.js';
import withReplaceView from './views/with-replace-view.js';
import registerDialogCommands from './views/register-dialogs-commands.js';

/**
 * HomeIndex 可替换组件形式
 * @type {Class<HomeIndex>}
 * @private
 */
const HomeIndex = withReplaceView(_HomeIndex);

console.log('[Index] Adding no-animation class');
document.body.classList.add('no-animation');

// 喧喧运行时管理程序就绪时加载 React 界面组件
console.log('[Index] Registering ready callback');
ready(() => {
    console.log('[Index] Runtime ready callback triggered');
    const appElement = document.getElementById('appContainer');
    console.log('[Index] Rendering React app');
    ReactDOM.render(<HomeIndex />, appElement, () => {
        console.log('[Index] React app rendered');
        const loadingElement = document.getElementById('loading');
        if (loadingElement && loadingElement.parentNode) {
            console.log('[Index] Removing loading element');
            loadingElement.parentNode.removeChild(loadingElement);
        } else {
            console.warn('[Index] Loading element not found');
        }

        setTimeout(() => {
            console.log('[Index] Removing no-animation class');
            document.body.classList.remove('no-animation');
        }, 2000);

        // 注册对话框命令
        console.log('[Index] Registering dialog commands');
        registerDialogCommands();

        // 触发界面就绪事件
        console.log('[Index] Triggering UI ready');
        triggerReady();
    });
});
