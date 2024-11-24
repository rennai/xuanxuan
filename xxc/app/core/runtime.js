import {loadExtensionsModules} from '../exts/runtime.js'; // eslint-disable-line
import events from './events.js';
import lang, {initLang} from './lang.js';
import config from '../config/index.js';
import platform from '../platform/index.js';

/**
 * 运行时事件表
 * @type {Object<string, string>}
 * @private
 */
const EVENT = {
    ready: 'runtime.ready',
};

/**
 * 应用是否准备就绪（所有扩展加载完毕）
 * @type {boolean}
 * @private
 */
let isReadied = false;

/**
 * 绑定应用准备就绪事件
 * @param {Function} listener 事件回调函数
 * @return {boolean|Symbol} 如果应用已经准备就绪会立即执行回调函数并返回 `false`，否则会返回一个事件 ID
 */
export const ready = (listener) => {
    console.log('[Runtime] Ready called, isReadied =', isReadied);
    if (isReadied) {
        console.log('[Runtime] Already ready, executing listener immediately');
        listener();
        return false;
    }
    console.log('[Runtime] Not ready yet, registering listener');
    return events.once(EVENT.ready, listener);
};

/**
 * 触发界面准备就绪事件
 * @private
 * @return {void}
 */
const sayReady = () => {
    console.log('[Runtime] Saying ready');
    isReadied = true;
    events.emit(EVENT.ready);
    console.log('[Runtime] Ready event emitted');
};

const run = async () => {
    try {
        console.log('[Runtime] Starting initialization');
        // 初始化应用
        console.log('[Runtime] Initializing language');
        await initLang(config.lang);
        console.log('[Runtime] Loading extension modules');
        loadExtensionsModules();
        console.log('[Runtime] Initializing platform');
        platform.init({config, lang});
        console.log('[Runtime] All initialization complete');
        sayReady();
    } catch (error) {
        console.error('[Runtime] Error during initialization:', error);
    }
};

run();

export default {ready};
