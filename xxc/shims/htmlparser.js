// htmlparser shim（浏览器 Vite 基线）
// htmlparser@1.7.7 是 2010 年老式 CJS 包，源码用 `this.Tautologistics = {}` 依赖顶层 `this`
// 为全局对象，Vite/Rolldown ESM 严格模式下 `this=undefined` 导致崩溃。
// markdown.js 只用到 DefaultHandler + Parser.parseComplete + handler.dom[0].attribs，
// 用浏览器原生 DOMParser 实现等价功能，避免加载原始包。
// 不改信封协议、不改业务逻辑；仅浏览器基线替代 Node CJS 包。
// 详见 doc/upgrade/xxc-upgrade-plan.md 阶段 1。

// 最小 DefaultHandler：parseComplete 后 dom 存解析结果
class DefaultHandler {
    constructor() {
        this.dom = null;
    }
}

class Parser {
    constructor(handler) {
        this.handler = handler;
    }
    parseComplete(html) {
        // 用 DOMParser 解析为 HTML，提取首层子节点的 attribs
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const firstChild = doc.body.firstElementChild;
        const attribs = {};
        if (firstChild && firstChild.attributes) {
            for (let i = 0; i < firstChild.attributes.length; i++) {
                const attr = firstChild.attributes[i];
                attribs[attr.name] = attr.value;
            }
        }
        this.handler.dom = firstChild ? [{attribs}] : [];
    }
}

export {Parser, DefaultHandler};
export const RssHandler = DefaultHandler;
export const ElementType = {};
export const DomUtils = {};
export default {Parser, DefaultHandler, RssHandler, ElementType, DomUtils};
