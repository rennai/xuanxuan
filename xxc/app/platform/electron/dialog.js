import native from './native';
import env from './env';
import {showOpenDialog} from '../common/open-file-button';
import {downloadFileWithRequest} from './net';
import {base64ToBuffer} from './image';

/**
 * 上次在文件保存对话框中选择的文件保存位置
 * @type {string}
 * @private
 */
let lastFileSavePath = '';

/**
 * 获取文件名（仅文件名部分）
 * @param {string} filename 完整路径
 * @return {string} 文件名
 */
const basename = filename => {
    const idx = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
    return idx >= 0 ? filename.substring(idx + 1) : filename;
};

/**
 * 获取目录路径
 * @param {string} filename 完整路径
 * @return {string} 目录路径
 */
const dirname = filename => {
    const idx = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
    return idx >= 0 ? filename.substring(0, idx) : '';
};

/**
 * 拼接路径
 * @param  {...string} parts 路径片段
 * @return {string} 拼接后的路径
 */
const join = (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/');

/**
 * 显示文件保存对话框
 * @param {{sourceFilePath: string}} options 选项
 * @param {function(result: boolean)} callback 保存完成后的回调函数，其中参数 `result` 为是否成功保存文件
 * @return {void}
 */
export const showSaveDialog = async (options, callback) => {
    if (options.sourceFilePath) {
        const {sourceFilePath} = options;
        delete options.sourceFilePath;
        return showSaveDialog(options, async filename => {
            if (filename) {
                if (sourceFilePath === filename) {
                    if (callback) {
                        callback(filename);
                    }
                } else {
                    try {
                        await native.fs.copy(sourceFilePath, filename);
                        if (callback) {
                            callback(filename);
                        }
                    } catch (err) {
                        if (callback) {
                            callback(err);
                        }
                    }
                }
            } else if (callback) {
                callback();
            }
        });
    }

    let filename = options.filename || '';
    delete options.filename;
    if (filename) {
        filename = basename(filename);
    }

    options = Object.assign({
        defaultPath: join(lastFileSavePath || env.desktopPath, filename)
    }, options);

    const result = await native.dialog.showSaveDialog(options);
    const filePath = result && result.filePath;
    if (filePath) {
        lastFileSavePath = dirname(filePath);
    }
    if (callback) {
        callback(filePath);
    }
};

/**
 * 显示 Electron 内置的文件保存对话框
 * @param {{title: string, defaultPath: string, properties: string[]}} options 选项
 * @param {function(result: boolean)} callback 保存完成后的回调函数，其中参数 `result` 为是否成功保存文件
 * @return {void}
 */
export const showRemoteOpenDialog = async (options, callback) => {
    options = Object.assign({
        defaultPath: env.desktopPath,
        properties: ['openFile']
    }, options);
    const result = await native.dialog.showOpenDialog(options);
    if (callback) {
        callback(result && result.filePaths);
    }
};

/**
 * 根据图片地址和存储类型保存图片
 * @param {string} url 图片地址
 * @param {string} dataType 图片类型
 * @returns {Promise} 使用 Promise 异步返回处理结果
 */
export const saveAsImageFromUrl = (url, dataType) => new Promise((resolve, reject) => {
    const isBase64Image = url.startsWith('data:image/') || dataType === 'base64';
    const isBlob = url.startsWith('blob:');
    if (isBlob) {
        throw new Error('Cannot support save blob image in electron.');
    } else if (!isBase64Image && url.startsWith('file://')) {
        url = url.substr(7);
    }
    showSaveDialog({
        filename: (isBase64Image || isBlob) ? 'xuanxuan-image.png' : basename(url),
        sourceFilePath: (isBase64Image || isBlob) ? null : url
    }, filename => {
        if (!filename) {
            reject();
            return;
        }
        if (isBase64Image) {
            // [upgrade] 解码 base64 data URL 为二进制再写入（等价于旧 nativeImage.createFromDataURL(url).toPNG()）
            native.fs.outputFile(filename, base64ToBuffer(url)).then(() => {
                resolve(filename);
            }).catch(reject);
        } else if (isBlob) {
            return downloadFileWithRequest(url, filename).then(() => {
                resolve(filename);
            }).catch(reject);
        } else {
            // 非 base64/blob：sourceFilePath 已在 showSaveDialog 内 fs.copy 完成
            resolve(filename);
        }
    }).catch(reject); // [upgrade] showSaveDialog 为 async，捕获其内部 await reject 避免 unhandledrejection + 外层挂起
});

export default {
    showSaveDialog,
    showOpenDialog,
    saveAsImageFromUrl
};
