import React from 'react';
import Modal from '../../components/modal.jsx';
import _TodoEditor from './todo-editer.jsx';
import Lang from '../../core/lang.js';
import withReplaceView from '../with-replace-view.js';

/**
 * TodoEditor 可替换组件形式
 * @type {Class<TodoEditor>}
 * @private
 */
const TodoEditor = withReplaceView(_TodoEditor);

/**
 * 显示待办编辑对话框
 * @param {Object} todo 待办对象
 * @param {function} callback 回调函数
 * @return {void}
 */
export const showTodoEditDialog = (todo, callback) => {
    const modalId = 'app-todo-editor-dialog';
    return Modal.show({
        title: Lang.string(todo.id ? 'todo.edit' : 'todo.create'),
        id: modalId,
        actions: false,
        style: {width: 600},
        content: <TodoEditor defaultTodo={todo} onRequestClose={() => (Modal.hide(modalId))} />
    }, callback);
};

export default {
    show: showTodoEditDialog,
};
