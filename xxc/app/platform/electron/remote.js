import native from './native';
import EVENT from './remote-events';

const ipc = native;

/**
 * 调用远程（主进程）方法或获取属性值
 * @param {string} method 远程（主进程）方法或属性
 * @param  {...any} args 调用方法时的参数
 * @returns {Promise} 使用 Promise 异步返回处理结果
 */
export const callRemote = (method, ...args) => {
    return ipc.callRemote(method, ...args);
};

/**
 * 使用 IPC 向 Electron 主进程发送事件消息
 * @param  {string}    eventName 事件名称
 * @param  {...any} args 事件参数
 * @return {void}
 */
export const ipcSend = (eventName, ...args) => {
    ipc.ipcSend(eventName, ...args);
};

/**
 * 使用 IPC 绑定进程间事件
 * @param  {string} event 事件名称
 * @param  {function} listener 事件回调函数
 * @return {Symbol} 事件 ID
 */
export const ipcOn = (event, listener) => {
    return ipc.ipcOn(event, listener);
};

/**
 * 使用 IPC 绑定进程间一次性事件
 * @param  {string} event 事件名称
 * @param  {function} listener 事件回调函数
 * @return {Symbol} 事件 ID
 */
export const ipcOnce = (event, listener) => {
    return ipc.ipcOnce(event, listener);
};

/**
 * 使用 IPC 在渲染进程绑定主进程上的普通事件
 * @param  {string} event 事件名称
 * @param  {function} listener 事件回调函数
 * @return {string} 事件 ID
 */
export const remoteOn = (event, listener) => {
    return ipc.remoteOn(event, listener);
};

/**
 * 使用 IPC 在渲染进程触发主进程上的普通事件
 * @param  {string} event 事件名称
 * @param  {...any} args 事件参数
 * @return {string} 事件 ID
 */
export const remoteEmit = (event, ...args) => {
    ipc.remoteEmit(event, ...args);
};

/**
 * 在当前应用窗口对应的渲染进程向其他应用窗口渲染进程发送消息
 * @param {string} windowName 窗口名称
 * @param {string} eventName 消息事件名称
 * @param  {...any} args 事件参数
 * @return {void}
 */
export const sendToWindow = (windowName, eventName, ...args) => {
    ipc.sendToWindow(windowName, eventName, ...args);
};

/**
 * 在当前应用窗口对应的渲染进程向主窗口渲染进程发送消息
 * @param {string} eventName 消息事件名称
 * @param  {...any} args 事件参数
 * @return {void}
 */
export const sendToMainWindow = (eventName, ...args) => {
    return sendToWindow('main', eventName, ...args);
};

/**
 * 使用 IPC 在渲染进程取消绑定主进程上的普通事件
 * @param  {...string} names 事件名称
 * @return {void}
 */
export const remoteOff = (...names) => {
    ipc.remoteOff(...names);
};

/**
 * 绑定主进程通知将要关闭应用程序事件
 * @param {function} listener 事件回调函数
 * @return {Symbol} 事件 ID
 */
export const onRequestQuit = listener => ipc.onRequestQuit(listener);

/**
 * 绑定主进程通知要打开网址事件
 * @param {function} listener 事件回调函数
 * @return {Symbol} 事件 ID
 */
export const onRequestOpenUrl = listener => ipc.onRequestOpenUrl(listener);

export default {
    EVENT,
    call: callRemote,
    on: remoteOn,
    emit: remoteEmit,
    off: remoteOff,
    ipcOn,
    ipcSend,
    ipcOnce,
    sendToWindow,
    sendToMainWindow,
    onRequestQuit
};
