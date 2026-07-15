import native from './native';

const cb = native.clipboard;

/**
 * 将指定的图片复制到剪切板
 * @param {string} url 图片地址
 * @param {string} [dataType='path'] 数据类型
 * @return {void}
 */
export const writeImageFromUrl = (url, dataType = 'path') => {
    cb.writeImageFromUrl(url, dataType);
};

/**
 * 上次剪切板中的图片信息
 * @type {{name: string, type: string, base64: string, width: number, height: number, size: number}}
 * @private
 */
let lastNewImage = cb.getNewImage();

/**
 * 获取剪切板中的新的图片信息
 * @return {{name: string, type: string, base64: string, width: number, height: number, size: number}} 图片信息对象
 */
export const getNewImage = () => {
    const currentImage = cb.getNewImage();
    if (!lastNewImage || !currentImage || currentImage.base64 !== lastNewImage.base64) {
        lastNewImage = currentImage;
        return currentImage;
    }
    return null;
};

/**
 * 获取剪切板中的文本内容
 * @param {?string} type 内容类型
 * @return {string} 剪贴板中的纯文本内容。
 */
export const readText = (...args) => cb.readText(...args);

/**
 * 将文本内容写入剪切板中
 * @param {string} text 文本内容
 * @param {?string} type 内容类型
 * @return {void}
 */
export const writeText = (...args) => cb.writeText(...args);

/**
 * 获取剪切板中的图片内容
 * @param {?string} type 内容类型
 * @return {string} 返回剪贴板中的图像内容（dataURL）
 */
export const readImage = (...args) => cb.readImage(...args);

/**
 * 将图片内容写入剪切板中
 * @param {string} dataUrl 图片内容（dataURL）
 * @param {?string} type 内容类型
 * @return {void}
 */
export const writeImage = (...args) => cb.writeImage(...args);

/**
 * 获取剪切板中的HTML内容
 * @param {?string} type 内容类型
 * @return {string} 返回剪贴板中的HTML内容
 */
export const readHTML = (...args) => cb.readHTML(...args);

/**
 * 将HTML内容写入剪切板中
 * @param {string} markup HTML内容
 * @param {?string} type 内容类型
 * @return {void}
 */
export const writeHTML = (...args) => cb.writeHTML(...args);

/**
 * 将内容写入剪切板中
 * @param {{text: string, html: string, image: NativeImage, rtf: string, bookmark: string}} data 内容
 * @param {?string} type 内容类型
 * @return {void}
 */
export const write = (...args) => cb.write(...args);

export default {
    readText,
    writeText,
    readImage,
    writeImage,
    readHTML,
    writeHTML,
    write,
    writeImageFromUrl,
    getNewImage,
};
