import native from './native';
import env from './env';
import {ipcSend, remoteOn} from './remote';
import EVENTS from './remote-events';
import {getJSON} from '../common/network';

/**
 * 获取语言表数据
 * @param {String} langName 语言名称
 * @return {Promise<Map<String, String>>} 语言表数据对象
 */
export const loadLangData = (langName) => {
    const name = langName || getPlatformLangName();
    // [upgrade] contextIsolation 下渲染进程无法读本地文件，改用 HTTP 获取（同 browser 基线）。
    return getJSON(`lang/${name}.json`);
};

/**
 * 获取系统平台所使用的默认语言名称
 * @return {String} 系统默认语言名称
 */
export const getPlatformLangName = () => {
    // [upgrade] contextIsolation 下 app.getLocale 经 IPC 异步返回，此处同步用 navigator.language（同 browser 基线）
    return (navigator.language || 'en').toLowerCase();
};

/**
 * 处理语言变更事件
 * @param {String} langName 当前语言名称
 * @param {String} langData 当前语言数据
 * @return {void}
 */
export const handleLangChange = (langName, langData) => {
    ipcSend(EVENTS.remote_lang_change, langName, langData, env.windowName);
};

/**
 * 语言变更处理函数
 * @type {function}
 * @private
 */
let requestChangeLangHandler = null;

/**
 * 设置请求变更语言处理函数
 * @param {function(string)} handler 处理函数
 * @return {void}
 */
export const setRequestChangeLangHandler = (handler) => {
    requestChangeLangHandler = handler;
};

/**
 * 初始化语言访问功能
 * @return {void}
 */
export const initLanguage = () => {
    // 处理其他窗口请求变更语言事件
    remoteOn(EVENTS.remote_lang_change, (e, langName, langData, windowName) => {
        if (requestChangeLangHandler && windowName !== env.windowName) {
            requestChangeLangHandler(langName);
        }
    });
};


export default {
    loadLangData,
    getPlatformLangName,
    handleLangChange,
    setRequestChangeLangHandler,
};
