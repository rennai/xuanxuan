import native from './native';
import {getSearchParam} from '../../utils/html-helper';

/**
 * 访问地址参数表
 * @type {Map<string, string>}
 * @private
 */
const urlParams = getSearchParam();

/**
 * 当前窗口名称
 * @type {string}
 */
const windowName = urlParams._name || native.env.windowName;

/**
 * 当前运行的操作系统是否是 Mac
 * @type {boolean}
 * @private
 */
const isOSX = native.env.isOSX;

/**
 * 当前运行的操作系统是否是 Windows
 * @type {boolean}
 * @private
 */
const isWindowsOS = native.env.isWindowsOS;

/**
 * 当前运行的操作系统是否是 Linux
 * @type {boolean}
 * @private
 */
const isLinux = native.env.isLinux;

/**
 * 当前操作系统运行环境信息
 * @type {Object}
 * @property {string} os 操作系统类型，包括 MacOS(`'osx'`)，Windows(`'windows'`) 或 Linux(`'linux'`)
 * @property {boolean} isWindowsOS 当前运行的操作系统是否是 Windows
 * @property {boolean} isOSX 当前运行的操作系统是否是 Mac OS
 * @property {boolean} isLinux 当前运行的操作系统是否是 Linux
 * @property {string} arch 当前运行的操作系统架构类型
 * @property {string} desktopPath 用户桌面文件夹路径
 * @property {string} tmpPath 用户临时文件存储路径
 * @property {string} dataPath 用户个人数据文件夹路径
 * @property {string} appPath Electron 应用文件程序夹路径
 * @property {string} appRoot Electron 应用根目录路径
 */
export default {
    arch: native.env.arch,
    os: native.env.os,
    isWindowsOS,
    isOSX,
    isLinux,
    dataPath: native.env.dataPath,
    desktopPath: native.env.desktopPath,
    tmpPath: native.env.tmpPath,
    get appPath() {
        return native.env.appPath;
    },
    appRoot: native.env.appRoot,
    windowName,
};
