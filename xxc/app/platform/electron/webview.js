import {showInputContextMenu, showSelectionContextMenu} from './contextmenu';

/**
 * 初始化 WebView 上的右键菜单
 *
 * [upgrade] contextIsolation 安全模型下，webview.getWebContents() 需走主进程。
 * 当前主流程未使用 WebView 扩展能力，保留接口签名但内部不再直接获取 webContents。
 * 右键菜单改用 DOM 事件触发（与浏览器端行为一致）。
 * @param {WebView} webview WebView 实例
 * @return {void}
 */
export const initWebview = (webview) => {
    if (!webview) {
        return;
    }
    // [upgrade] contextIsolation 下 webview.getWebContents() 不可用，改用 DOM contextmenu 事件
    webview.addEventListener && webview.addEventListener('contextmenu', (e) => {
        if (e.isEditable) {
            showInputContextMenu(e.clientX, e.clientY);
        } else if (e.selectionText && e.selectionText.trim() !== '') {
            showSelectionContextMenu(e.clientX, e.clientY);
        }
    });
};

export default {
    initWebview,
};
