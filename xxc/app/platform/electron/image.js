import native from './native';

/**
 * 图片处理模块（Electron）
 *
 * [upgrade] contextIsolation 安全模型下，nativeImage 不能跨桥传递对象。
 * 当前渲染进程无消费者（platform.image 未被 views/components/core 使用），
 * 保留最小接口供后续扩展，文件保存走 IPC。
 */

/**
 * 将 Base64 字符串转换为 Uint8Array
 * @param {string} base64Str Base64 字符串
 * @return {Uint8Array} Uint8Array
 */
export const base64ToBuffer = base64Str => {
    const matches = base64Str.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        throw new Error('Invalid base64 image string.');
    }
    const binary = atob(matches[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

/**
 * 保存图片
 * @param {NativeImage|string|Uint8Array} image 图片
 * @param {string} filePath 保存路径
 * @returns {Promise} 使用 Promise 异步返回处理结果
 */
export const saveImage = (image, filePath) => {
    const basename = filePath.split('/').pop();
    const file = {
        path: filePath,
        name: basename,
    };
    if (typeof image === 'string') {
        file.base64 = image;
        image = base64ToBuffer(image);
        file.size = image.length;
    }
    if (image instanceof Uint8Array) {
        return native.fs.outputFile(filePath, image).then(() => file);
    }
    return Promise.reject(new Error('Cannot convert image to a buffer.'));
};

export const createFromPath = (p) => native.nativeImage.createFromPath(p);
export const createFromDataURL = (url) => native.nativeImage.createFromDataURL(url);

export default {
    base64ToBuffer,
    saveImage,
    createFromPath,
    createFromDataURL
};
