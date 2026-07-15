import native from './native';

/**
 * 使用 AES 加密文本
 * @param  {string} data 要加密的文本字符串
 * @param  {string} token AES key
 * @param  {string} cipherIV AES token
 * @return {Uint8Array} 返回加密后的数据
 */
const encrypt = (data, token, cipherIV) => {
    return native.crypto.encrypt(data, token, cipherIV);
};

/**
 * 使用 AES 解密文本
 * @param  {Uint8Array|ArrayBuffer} data 要解密的数据
 * @param  {string} token AES key
 * @param  {string} cipherIV AES token
 * @return {string} 返回解密后的文本
 */
const decrypt = (data, token, cipherIV) => {
    return native.crypto.decrypt(data, token, cipherIV);
};

export default {
    encrypt,
    decrypt
};
