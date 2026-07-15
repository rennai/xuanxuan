import native from './native';
import network, {downloadFile as downloadFileOrigin, uploadFile as uploadFileOrigin} from '../common/network';
import {createUserDataPath} from './ui';

const fs = native.fs;

/**
 * 下载文件
 * @param {string} url 文件下载地址
 * @param {string} fileSavePath 文件保存路径
 * @param {function(progresss: number)} onProgress 下载进度变更事件回调函数
 * @returns {Promise} 使用 Promise 异步返回处理文件下载结果
 */
export const downloadFileWithRequest = (url, fileSavePath, onProgress) => {
    return downloadFileOrigin(url, null, onProgress).then(async fileBuffer => {
        const buffer = new Uint8Array(fileBuffer);
        return fs.outputFile(fileSavePath, buffer);
    });
};

/**
 * 文件缓存对象
 * @private
 * @type {Object}
 */
const filesCache = {};

/**
 * 创建文件缓存路径
 * @param {{storageName: string}|FileData} file 文件对象
 * @param {{identify: string}|User} user 用户实例
 * @param {string} [dirName='image'] 缓存目录
 * @return {string} 创建文件缓存路径
 * @private
 */
const createCachePath = (file, user, dirName = 'images') => {
    return createUserDataPath(user, file.storageName, dirName);
};

/**
 * 检查文件是否已经缓存
 * @param {{localPath: string, path: string, gid: string}|FileData} file 文件对象
 * @param {{identify: string}|User} user 用户实例
 * @param {string} [dirName='image'] 缓存目录
 * @returns {Promise} 使用 Promise 异步返回处理结果
 * @private
 */
const checkFileCache = async (file, user, dirName = 'images') => {
    if (file.path) {
        return false;
    }
    if (file.localPath) {
        filesCache[file.gid] = file.localPath;
        return file.localPath;
    }
    let cachePath = filesCache[file.gid];
    if (cachePath) {
        file.localPath = cachePath;
        return cachePath;
    }
    cachePath = createCachePath(file, user, dirName);
    const exists = await fs.pathExists(cachePath);
    if (exists) {
        filesCache[file.gid] = cachePath;
        file.localPath = cachePath;
        return cachePath;
    }
    return false;
};

/**
 * 下载并保存文件到本地缓存
 * @param {User} user 用户实例
 * @param {FileData} file 文件对象
 * @param {function(progresss: number)} onProgress 下载进度变更事件回调函数
 * @returns {Promise} 使用 Promise 异步返回处理文件下载结果
 */
export const downloadFile = async (user, file, onProgress) => {
    const cachePath = await checkFileCache(file, user);
    const url = file.url || file.makeUrl(user);
    const fileSavePath = file.path || createCachePath(file, user);
    if (cachePath) {
        if (DEBUG) {
            console.collapse('HTTP DOWNLOAD', 'blueBg', url, 'bluePale', 'Cached', 'greenPale');
            console.log('file', file);
            console.groupEnd();
        }
        if (fileSavePath !== cachePath) {
            await fs.copy(cachePath, fileSavePath);
            return file;
        }
        return file;
    }

    await downloadFileWithRequest(url, fileSavePath, onProgress);
    if (DEBUG) {
        console.collapse('HTTP DOWNLOAD', 'blueBg', url, 'bluePale', 'OK', 'greenPale');
        console.log('file', file);
        console.groupEnd();
    }
    file.localPath = fileSavePath;
    filesCache[file.gid] = file.localPath;
    return file;
};

/**
 * 上传文件
 * @param {User} user 用户实例
 * @param {FileData} file 文件对象
 * @param {function(progresss: number)} onProgress 上传进度变更事件回调函数
 * @param {boolean} [copyCache=false] 是否将原始文件拷贝到缓存目录
 * @returns {Promise} 使用 Promise 异步返回处理上传文件结果
 */
export const uploadFile = async (user, file, onProgress, copyCache = false) => {
    const {originFile} = file;
    if (!originFile) {
        return console.warn('Upload file fail, cannot get origin file object.', file);
    }
    const serverUrl = user.uploadUrl;
    const form = new FormData();
    form.append('file', file.originData, file.name);
    form.append('userID', user.id);
    form.append('gid', file.cgid);
    file.form = form;

    const remoteData = await uploadFileOrigin(file, serverUrl, xhr => {
        xhr.setRequestHeader('ServerName', user.serverName);
        xhr.setRequestHeader('Authorization', user.token);
    }, onProgress);

    const finishUpload = () => {
        if (DEBUG) {
            console.collapse('HTTP UPLOAD Request', 'blueBg', serverUrl, 'bluePale', 'OK', 'greenPale');
            console.log('files', file);
            console.log('remoteData', remoteData);
            console.groupEnd();
        }
        return remoteData;
    };

    if (copyCache) {
        const copyPath = createCachePath(file, user, copyCache === true ? 'images' : copyCache);
        file.localPath = copyPath;

        if (originFile.blob) {
            const buffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (reader.readyState === 2) {
                        resolve(new Uint8Array(reader.result));
                    }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file.blob);
            });
            await fs.outputFile(copyPath, buffer);
            return finishUpload();
        }
        if (originFile.path) {
            await fs.copy(originFile.path, copyPath);
            return finishUpload();
        }
    }
    return finishUpload();
};

network.uploadFile = uploadFile;
network.downloadFile = downloadFile;
network.checkFileCache = checkFileCache;

export default network;
