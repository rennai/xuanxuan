import native from './native';

/**
 * 语言文本访问对象
 * @type {Object}
 * @private
 */
let lang = null;

const menuApi = native.menu;

/**
 * 设置语言文本访问对象
 * @param {Object} langObj 语言文本访问对象
 * @return {void}
 */
const setLangObj = langObj => {
    lang = langObj;
};

/**
 * 创建上下文菜单实例
 * @param {Object[]} menu 要创建的上下文菜单项清单
 * @return {Object[]} 上下文菜单项清单
 */
export const createContextMenu = menu => {
    if (Array.isArray(menu)) {
        return menu;
    }
    return menu;
};

/**
 * 显示右键上下文菜单
 * @param {Object[]} menu 要创建的上下文菜单项清单
 * @param {number} x 菜单显示在 X 轴上的位置
 * @param {number} y 菜单显示在 Y 轴上的位置
 * @param {BrowserWindow} windowObj 应用窗口实例
 * @return {void}
 */
export const popupContextMenu = (menu, x, y, windowObj) => {
    if (typeof x === 'object') {
        y = x.clientY;
        x = x.clientX;
    }
    menu = createContextMenu(menu);
    menuApi.popup(menu, x, y);
};

/**
 * 显示文本输入框右键上下文菜单
 * @param {BrowserWindow} windowObj 应用窗口实例
 * @param {number} x 菜单显示在 X 轴上的位置
 * @param {number} y 菜单显示在 Y 轴上的位置
 * @return {void}
 */
export const showInputContextMenu = (x, y, windowObj) => {
    /**
     * 文本输入框右键菜单
     * @type {Menu}
     * @private
     */
    const INPUT_MENU = [
        {role: 'undo', label: lang.string('menu.undo')},
        {role: 'redo', label: lang.string('menu.redo')},
        {type: 'separator'},
        {role: 'cut', label: lang.string('menu.cut')},
        {role: 'copy', label: lang.string('menu.copy')},
        {role: 'paste', label: lang.string('menu.paste')},
        {type: 'separator'},
        {role: 'selectall', label: lang.string('menu.selectAll')}
    ];
    popupContextMenu(INPUT_MENU, x, y, windowObj);
};

/**
 * 显示选中的文本右键上下文菜单
 * @param {BrowserWindow} windowObj 应用窗口实例
 * @param {number} x 菜单显示在 X 轴上的位置
 * @param {number} y 菜单显示在 Y 轴上的位置
 * @return {void}
 */
export const showSelectionContextMenu = (x, y, windowObj) => {
    /**
     * 文本选择右键菜单
     * @type {Menu}
     * @private
     */
    const SELECT_MENU = [
        {role: 'copy', label: lang.string('menu.copy')},
        {type: 'separator'},
        {role: 'selectall', label: lang.string('menu.selectAll')}
    ];
    popupContextMenu(SELECT_MENU, x, y, windowObj);
};

export default {
    setLangObj,
    createContextMenu,
    popupContextMenu,
    showSelectionContextMenu,
    showInputContextMenu
};
