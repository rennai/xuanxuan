/**
 * 声音播放模块（HTML5 Audio 实现，替代已停止维护的 ion-sound）
 *
 * 原 ion-sound 是 2015 年的 jQuery 插件，Vite 下 `import 'ion-sound'` 因 UMD/this 绑定
 * 会崩溃。这里改用浏览器原生 HTML5 Audio，保留原 `init` / `play` 接口，不改 Platform 接口。
 * 音频文件位于 `media/sound/`，默认使用 `.mp3`（现代浏览器均支持）。
 */

let soundPath = '';
const audioCache = new Map();

/**
 * 预加载指定音效
 * @param {string} name 音效名称（不含扩展名）
 * @return {HTMLAudioElement} 音频元素
 * @private
 */
const preload = name => {
    let audio = audioCache.get(name);
    if (audio) {
        return audio;
    }
    audio = new Audio(soundPath + name + '.mp3');
    audio.preload = 'auto';
    audio.volume = 1;
    audioCache.set(name, audio);
    return audio;
};

/**
 * 初始化声音播放模块
 * @param {string} path 声音媒体文件路径
 * @return {void}
 */
export const initSound = path => {
    soundPath = path || '';
    // 预加载 message 音效（原 ion-sound 配置 preload:true）
    preload('message');
    if (DEBUG) {
        console.groupCollapsed('%cSOUND inited', 'display: inline-block; font-size: 10px; color: #689F38; background: #CCFF90; border: 1px solid #CCFF90; padding: 1px 5px; border-radius: 2px;');
        console.log('path', soundPath);
        console.groupEnd();
    }
};

/**
 * 播放声音
 * @param {string} sound 声音名称
 * @return {void}
 */
export const playSound = sound => {
    const name = typeof sound === 'string' ? sound : null;
    if (!name) {
        return;
    }
    const audio = preload(name);
    // multiplay：克隆节点以支持重叠播放（原 ion-sound multiplay:true）
    const clone = audio.cloneNode();
    clone.volume = 1;
    const playing = clone.play();
    // 浏览器自动播放策略可能拦截，忽略拒绝（play 返回 Promise）
    if (playing && typeof playing.catch === 'function') {
        playing.catch(() => {});
    }
};

export default {
    init: initSound,
    play: playSound
};
