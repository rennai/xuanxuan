import React from 'react';
import Modal from '../../components/modal.jsx';
import App from '../../core/index.js';
import _MemberProfile from './member-profile.jsx';
import withReplaceView from '../with-replace-view.js';

/**
 * MemberProfile 可替换组件形式
 * @type {Class<MemberProfile>}
 * @private
 */
const MemberProfile = withReplaceView(_MemberProfile);

/**
 * 显示成员个人资料对话框
 * @param {number|{id: number}} memberId 成员 ID 或成员对象
 * @param {function} callback 对话框显示完成时的回调函数
 * @return {void}
 */
export const showProfileDialog = (memberId, callback) => {
    if (typeof memberId === 'object') {
        memberId = memberId.id;
    }
    const modalId = `member-${memberId}`;
    return Modal.show({
        actions: false,
        id: modalId,
        headingClassName: 'dock-right dock-top',
        className: 'app-member-profile-dialog',
        content: <MemberProfile memberId={memberId} onRequestClose={() => (Modal.hide(modalId))} />
    }, callback);
};

export default {
    show: showProfileDialog,
};
