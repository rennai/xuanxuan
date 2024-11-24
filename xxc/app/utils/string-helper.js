/**
 * 格式化字符串
 * @param {string} str 要格式化的字符串
 * @param  {...any} args 格式化参数
 * @return  {string} 格式化后的字符串
 * @example <caption>通过参数序号格式化</caption>
 *     var hello = $.format('{0} {1}!', 'Hello', 'world');
 *     // hello 值为 'Hello world!'
 * @example <caption>通过对象名称格式化</caption>
 *     var say = $.format('Say {what} to {who}', {what: 'hello', who: 'you'});
 *     // say 值为 'Say hello to you'
 */
export const formatString = (str, ...args) => {
    let result = str;
    if (args.length > 0) {
        let reg;
        if (args.length === 1 && (typeof args[0] === 'object')) {
            // eslint-disable-next-line prefer-destructuring
            args = args[0];
            Object.keys(args).forEach(key => {
                if (args[key] !== undefined) {
                    reg = new RegExp(`({${key}})`, 'g');
                    result = result.replace(reg, args[key]);
                }
            });
        } else {
            for (let i = 0; i < args.length; i++) {
                if (args[i] !== undefined) {
                    reg = new RegExp(`({[${i}]})`, 'g');
                    result = result.replace(reg, args[i]);
                }
            }
        }
    }
    return result;
};

/**
 * 检查字符串是否为未定义（`null` 或者 `undefined`）或者为空字符串
 * @param  {string} s 要检查的字符串
 * @return {boolean}
 */
export const isEmptyString = s => (s === undefined || s === null || s === '');

/**
 * 检查字符串是否不是空字符串
 * @param  {string} s 要检查的字符串
 * @return {boolean}
 */
export const isNotEmptyString = s => !isEmptyString(s);

/**
 * 检查字符串是否不是空字符串，如果为空则返回第二个参数给定的字符串，否则返回字符串自身
 * @param  {string} s 要检查的字符串
 * @param  {string} thenStr 如果为空字符串时要返回的字符串
 * @return {boolean}
 */
export const ifEmptyStringThen = (str, thenStr) => {
    return isEmptyString(str) ? thenStr : str;
};

/**
 * 格式化字节值为包含单位的字符串
 * @param {number} bytes 字节大小
 * @param {number} [decimals=2] 保留的小数点尾数
 * @return {string} 格式化后的字符串
 */
export const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const StringHelper = {
    format: formatString,
    isEmpty: isEmptyString,
    isNotEmpty: isNotEmptyString,
    ifEmptyThen: ifEmptyStringThen,
    formatBytes,
    formatString,
};

export default StringHelper;
