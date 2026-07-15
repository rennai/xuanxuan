/**
 * Electron 桌面能力统一入口（渲染进程侧）
 *
 * contextIsolation:true 下，渲染进程不再直接 import electron / node。
 * preload.js 通过 contextBridge.exposeInMainWorld('electron', ...) 暴露白名单 API。
 * 本模块仅导出 window.electron，供 platform/electron/ 各模块引用，
 * 替代原来的 `import {ipcRenderer/remote/clipboard/...} from 'electron'`。
 */

/**
 * 暴露的桌面能力（由 preload.js 注入到 window.electron）
 * @type {Object}
 */
const api = globalThis.electron;

export default api;
