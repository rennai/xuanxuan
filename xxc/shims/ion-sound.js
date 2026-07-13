// ion-sound shim（浏览器 mock 基线）
// 真实 ion-sound 是 2015 年 jQuery 插件，Vite 下 `import 'ion-sound'` 会因 UMD/this 绑定问题崩溃；
// 声音对登录与主界面渲染非关键，此处提供 no-op，保持 platform/common/sound.js 可用。
// 后续若需真实音效，改用 HTML5 Audio 并移除此 shim（同时删 vite.config.ts 里的 ion-sound 别名）。
if (typeof window !== 'undefined') {
    if (!window.ion) {
        window.ion = {};
    }
    if (!window.ion.sound) {
        const noop = () => {};
        window.ion.sound = Object.assign(noop, {
            play: noop,
            pause: noop,
            stop: noop,
            volume: noop,
            destroy: noop,
            preload: noop,
        });
    }
}

export default null;
