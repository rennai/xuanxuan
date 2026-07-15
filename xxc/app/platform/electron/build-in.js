import native from './native';

/**
 * 内置扩展存储根路径
 * @type {string}
 */
export const buildInPath = native.buildIn.buildInPath;

/**
 * 获取内置运行时配置
 * @return {Object} 运行时配置对象
 */
export const getBuildInConfig = () => {
    return native.buildIn.getBuildInConfig();
};

/**
 * 获取内置扩展清单
 * @return {Object[]} 获取内置扩展对象列表，如果为 null 则表示没有内置扩展
 */
export const getBuildInExtensions = () => {
    return native.buildIn.getBuildInExtensions();
};

export default {
    buildInPath,
    getBuildInConfig,
    getBuildInExtensions,
};
