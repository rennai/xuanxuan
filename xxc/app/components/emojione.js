/**
 * Emojione 兼容模块（自包含实现）
 *
 * 原依赖 npm `emojione`（项目已归档）。该包虽不依赖 React、在 React 18 下无兼容性问题，
 * 但为满足依赖清理目标，此处用 `@emoji-mart/data` 派生的静态映射表（`emoji-data.json`）
 * 复刻原 emojione 在本仓库被用到的全部 API，移除对 emojione npm 包的依赖。
 *
 * 复刻的 API（与原 emojione 同名同形状，调用方无需改动）：
 * - `shortnameToUnicode(str)` — `:grinning:` → `😀`，文本内多个 shortname 也会替换
 * - `toShort(str)` — `😀` → `:grinning:`，文本内 unicode emoji 转 shortname
 * - `toImage(str)` — `:shortname:` → `<img class="emojione" .../>` HTML（用于 dangerouslySetInnerHTML）
 * - `convert(str)` — 把 hex code point 字符串（如 `1f600`）转成 unicode char（复刻原行为：传原生 char 进去会得 \u0000）
 * - `emojioneList[shortname]` — `{unicode, uc_base, uc_output, name}` 查表
 *   ⚠️ 注意：本实现的 `unicode` 字段是**原生字符**（如 `"😀"`），不是原 emojione 的 hex code point
 *   （如 `"1f600"`）。拼图片路径用 `uc_base`（hex），不要用 `unicode`。
 * - `mapUnicodeCharactersToShort()` — 返回 `{nativeChar: ':shortname:'}` 映射对象
 * - `regUnicode` — 匹配 unicode emoji 的正则（用于 draft-editor 的 decorator 扫描）
 * - `imagePathPNG` / `imageType` / `cacheBustParam` — 图片资源路径配置（由 Config 注入）
 */
import emojiData from './emoji-data.json';
import Config from '../config';

const {shortnameMap, unicodeToShort} = emojiData;

/**
 * 图片资源路径（由 Config 注入，保持与原 emojione.imagePathPNG 一致）
 * @type {string}
 */
let imagePathPNG = Config.media['emojione.imagePathPNG'] || 'media/emojione/png/';

/**
 * 图片资源类型
 * @type {string}
 */
let imageType = Config.media['emojione.imageType'] || 'png';

/**
 * 缓存破坏参数（原 emojione 默认为空字符串）
 * @type {string}
 */
let cacheBustParam = '';

/**
 * shortname 正则（匹配 `:xxx:` 形式，排除含空格的）
 * @type {RegExp}
 * @private
 */
const shortnameRegex = /:([-a-z0-9_+]+):/gi;

/**
 * unicode emoji 正则（用于 toShort / draft-editor 扫描）
 *
 * 直接从 `unicodeToShort` 的全部 key（1870 个 native char）构建交替匹配正则，
 * 保证数据集中出现的每一个 emoji（含多码点序列：旗帜、键帽、ZWJ 序列）都能被精确匹配，
 * 不会像手写码点区间那样遗漏零散 BMP 字符（如 © ⭐ 🃏 🆎 等）。
 * 按字符串长度降序排列，使多码点序列（如 🇨🇳 = 两个 regional indicator）优先于
 * 其子串被匹配，避免把旗帜拆成两个单字符。
 * @type {RegExp}
 */
const regUnicode = (() => {
    const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sorted = Object.keys(unicodeToShort).sort((a, b) => b.length - a.length);
    return new RegExp(sorted.map(escapeRe).join('|'), 'gu');
})();

/**
 * 把 hex code point 字符串转成 unicode char
 * @param {string} code hex 字符串，如 `1f600` 或 `1f468-200d-2764`（连字符分隔多 code point）
 * @return {string} 对应 unicode 字符串
 * @private
 */
const codePointToChar = code => {
    if (!code || typeof code !== 'string') {
        return '\u0000';
    }
    // 复刻原 emojione.convert：仅当传入的是 hex 字符串才正确解析；传原生 char 会得 \u0000
    if (!/^[0-9a-fA-F-]+$/.test(code)) {
        return '\u0000';
    }
    try {
        return code.split('-').map(h => String.fromCodePoint(parseInt(h, 16))).join('');
    } catch (e) {
        return '\u0000';
    }
};

/**
 * shortname 转 unicode 字符
 * @param {string} str 含 `:shortname:` 的字符串
 * @return {string} 替换后的字符串
 */
const shortnameToUnicode = str => {
    if (!str || typeof str !== 'string') {
        return str;
    }
    return str.replace(shortnameRegex, (match, shortname) => {
        const entry = shortnameMap[`:${shortname}:`];
        return entry ? entry.unicode : match;
    });
};

/**
 * unicode emoji 转 shortname
 * @param {string} str 含 unicode emoji 的字符串
 * @return {string} 替换为 `:shortname:` 的字符串
 */
const toShort = str => {
    if (!str || typeof str !== 'string') {
        return str;
    }
    return str.replace(regUnicode, match => unicodeToShort[match] || match);
};

/**
 * 生成 emojione `<img>` 标签 HTML
 *
 * 原 emojione 默认 `imageTitleTag=false`（无 title 属性），此处同样不输出 title。
 * `alt` 用原生 unicode 字符而非 shortname，原因是 toImage 分两步替换（先原生→img，
 * 再 shortname→img）；若 alt 用 shortname（如 `:grinning:`），第二步的 shortnameRegex
 * 会匹配到第一步生成的 img 标签 alt 属性内的 shortname，导致嵌套替换。
 * 用 unicode 字符作 alt 可避免该问题，且 alt 文本对外表现为表情本身，语义合理。
 * @param {Object} entry shortnameMap 条目（含 unicode、uc_base）
 * @return {string} `<img class="emojione" alt="😀" src="..."/>` HTML
 * @private
 */
const emojiToImgHtml = entry => {
    const ucBase = entry.uc_base || '';
    const src = `${imagePathPNG}${ucBase}.${imageType}${cacheBustParam}`;
    return `<img class="emojione" alt="${entry.unicode || ''}" src="${src}"/>`;
};

/**
 * 把字符串中的 emoji（原生 unicode 字符和 `:shortname:` 两种形式）转成 `<img>` 标签 HTML
 *
 * 复刻原 emojione.toImage 的两步行为：先 unicodeToImage（原生字符 → img），
 * 再 shortnameToImage（`:shortname:` → img），使两种形式的表情都能渲染为 PNG 图片。
 * @param {string} str 含 emoji 的字符串
 * @return {string} 含 `<img class="emojione" .../>` 的 HTML
 */
const toImage = str => {
    if (!str || typeof str !== 'string') {
        return str;
    }
    // 先把原生 unicode emoji 转 img（复刻原 emojione unicodeToImage 步骤）
    str = str.replace(regUnicode, match => {
        const shortname = unicodeToShort[match];
        if (!shortname) {
            return match;
        }
        const entry = shortnameMap[shortname];
        if (!entry) {
            return match;
        }
        return emojiToImgHtml(entry);
    });
    // 再把 :shortname: 转 img
    return str.replace(shortnameRegex, (match, shortname) => {
        const entry = shortnameMap[`:${shortname}:`];
        if (!entry) {
            return match;
        }
        return emojiToImgHtml(entry);
    });
};

/**
 * hex code point 字符串转 unicode char（复刻原 emojione.convert）
 * @param {string} code hex 字符串
 * @return {string} unicode 字符
 */
const convert = code => codePointToChar(code);

/**
 * emojioneList（复刻原 emojione.emojioneList 的形状）
 * 按 `:shortname:` 索引，值为 `{unicode, uc_base, uc_output, name}`
 * @type {Object}
 */
const emojioneList = {};
for (const shortname of Object.keys(shortnameMap)) {
    const entry = shortnameMap[shortname];
    emojioneList[shortname] = {
        unicode: entry.unicode,
        uc_base: entry.uc_base,
        uc_output: entry.uc_output,
        name: entry.name,
    };
}

/**
 * 返回 native char → `:shortname:` 的映射对象
 * @return {Object}
 */
const mapUnicodeCharactersToShort = () => ({...unicodeToShort});

const Emojione = {
    get imagePathPNG() { return imagePathPNG; },
    set imagePathPNG(v) { imagePathPNG = v; },
    get imageType() { return imageType; },
    set imageType(v) { imageType = v; },
    get cacheBustParam() { return cacheBustParam; },
    set cacheBustParam(v) { cacheBustParam = v; },
    shortnameToUnicode,
    toShort,
    toImage,
    convert,
    emojioneList,
    mapUnicodeCharactersToShort,
    regUnicode,
};

export default Emojione;
