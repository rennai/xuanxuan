import React from 'react';
import Modal from '../../components/modal.jsx';
import _About from './about.jsx';
import Lang from '../../core/lang.js';
import withReplaceView from '../with-replace-view.js';

/**
 * UserAvatar 可替换组件形式
 * @type {Class<UserAvatar>}
 * @private
 */
const About = withReplaceView(_About);

/**
 * 显示应用关于对话框
 * @param {function} callback 回调函数
 * @return {void}
 */
export const showAboutDialog = (callback) => {
    return Modal.show({
        title: Lang.string('common.about'),
        actions: false,
        id: 'app-about-dialog',
        content: <About />
    }, callback);
};

export default {
    show: showAboutDialog,
};
