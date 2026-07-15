// 浏览器剪贴板：优先 navigator.clipboard（安全上下文），不可用或失败时回退 execCommand。
// 替代已移除的 clipboard-polyfill；writeText/write 返回 Promise，调用方按需 catch。

/**
 * 是否可用异步剪贴板（navigator.clipboard 仅在安全上下文 HTTPS / localhost 存在）
 * @return {boolean}
 */
const hasAsyncClipboard = () => typeof navigator !== 'undefined'
    && navigator.clipboard
    && typeof navigator.clipboard.writeText === 'function';

/**
 * 用隐藏 textarea + execCommand('copy') 复制纯文本（非安全上下文或权限被拒时的回退）
 * @param {string} text 要复制的文本
 * @return {boolean} 是否复制成功
 */
const copyTextFallback = text => {
    if (typeof document === 'undefined' || !document.body) {
        return false;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    let ok;
    try {
        ok = document.execCommand('copy');
    } catch {
        ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
};

/**
 * 将文本复制到剪切板
 * @param {string} text 要复制的文本
 * @return {Promise<void>}
 */
export const writeText = text => {
    if (hasAsyncClipboard()) {
        return navigator.clipboard.writeText(text).catch(() => copyTextFallback(text));
    }
    return Promise.resolve(copyTextFallback(text));
};

/**
 * 将内容写入剪切板中
 * @param {{text: string, html: string}} data 内容
 * @return {Promise<void>}
 */
export const write = data => {
    if (hasAsyncClipboard() && typeof navigator.clipboard.write === 'function' && typeof ClipboardItem !== 'undefined') {
        const items = {};
        if (data.html !== undefined) {
            items['text/html'] = new Blob([data.html], {type: 'text/html'});
        }
        if (data.text !== undefined) {
            items['text/plain'] = new Blob([data.text], {type: 'text/plain'});
        }
        if (Object.keys(items).length === 0) {
            return Promise.resolve();
        }
        return navigator.clipboard.write([new ClipboardItem(items)]).catch(() => {
            // 写入失败时回退纯文本（若提供）
            if (data.text !== undefined) {
                copyTextFallback(data.text);
            }
        });
    }
    // 非安全上下文：仅能回退纯文本
    return Promise.resolve(copyTextFallback(data.text !== undefined ? data.text : ''));
};

/**
 * 将 HTML 文本复制到剪切板
 * @param {string} html 要复制的 HTML 文本
 * @return {Promise<void>}
 */
export const writeHTML = html => write({html});

export default {
    write,
    writeText,
    // readText: () => navigator.clipboard.readText(),
    writeHTML,
    // readHTML,
    // readImage,
    // saveImage,
};
