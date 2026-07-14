import React from 'react';
import EmojiMartPicker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import Popover from '../../components/popover';
import Lang from '../../core/lang';
import profile from '../../core/profile';
import Emojione from '../../components/emojione';

/**
 * emoji-mart 分类标题（id 与 @emoji-mart/data 内置分类对应）
 * 通过 `i18n.categories` 传入，对应 emoji-mart v5 Picker 的 i18n 形状。
 * @type {Object<string, string>}
 * @private
 */
const categoryLabels = {
    people: Lang.string('emoji.category.people', '表情与人物'),
    nature: Lang.string('emoji.category.nature', '动物与自然'),
    food: Lang.string('emoji.category.food', '食物与饮料'),
    activity: Lang.string('emoji.category.activity', '活动'),
    travel: Lang.string('emoji.category.travel', '旅行与地点'),
    objects: Lang.string('emoji.category.objects', '物体'),
    symbols: Lang.string('emoji.category.symbols', '符号'),
    flags: Lang.string('emoji.category.flags', '旗帜'),
};

/**
 * emoji-mart i18n（分类标题本地化）
 * @type {Object}
 * @private
 */
const i18n = {
    categories: categoryLabels,
    search: Lang.string('common.search', '搜索'),
    categorieslabel: Lang.string('emoji.categories', '表情分类'),
};

/**
 * 显示 Emoji 选择提示面板
 *
 * 原使用已归档的 `emojione-picker`（其内部 `componentWillMount` 在 React 18 下触发
 * deprecation warning），改用 `emoji-mart`（`@emoji-mart/react` + `@emoji-mart/data`）。
 * 调用方 `onSelectEmoji` 期望的数据形状为 `{unicode, shortname, name}`：
 * - `unicode`：原生 emoji 字符（emoji-mart 的 `native`）
 * - `shortname`：emojione 短名，如 `:grinning:`（emoji-mart 的 `shortcodes[0]`）
 * - `name`：显示名（emoji-mart 的 `name`）
 * 此处做形状适配，不改 Platform 接口，也不改下游 `Emojione.convert` / `Emojione.emojioneList` 用法。
 *
 * @param {{x: number, y: number}} position 提示框显示位置
 * @param {function(data: Object)} onSelectEmoji 当选择 Emoji 表情时的回调函数
 * @param {function} callback 回调函数
 * @return {void}
 */
export const showEmojiPopover = (position, onSelectEmoji, callback) => {
    const popoverId = 'app-emoji-popover';
    const {enableSearchInEmojionePicker} = profile.userConfig;
    return Popover.show(
        position,
        <EmojiMartPicker
            data={data}
            // emoji-mart 默认即含搜索框；这里按原配置开关搜索
            searchPosition={enableSearchInEmojionePicker ? 'sticky' : 'none'}
            previewPosition="none"
            skinTonePosition="none"
            perLine={7}
            i18n={i18n}
            // 尺寸由下方 Popover 的 width/height 控制（emoji-mart 会自适应容器）
            onEmojiSelect={emoji => {
                if (onSelectEmoji) {
                    const shortname = (emoji.shortcodes && emoji.shortcodes[0]) || `:${emoji.id}:`;
                    // 不传 unicode（保持 undefined），与原 emojione-picker 行为一致。
                    // 消费方 im-ui.js 调用 `Emojione.convert(emoji.unicode || emojioneList[shortname].uc_base)`，
                    // convert 期望 hex code point 字符串（如 "1f600"）；若传 native char 会返回 \u0000。
                    // unicode 为 undefined 时走 uc_base fallback，由 convert 正确转成原生字符。
                    onSelectEmoji({
                        shortname,
                        name: emoji.name,
                    });
                }
                Popover.hide(popoverId);
            }}
        />,
        {
            id: popoverId, width: 280, height: 261, cache: true
        },
        callback
    );
};

export default {
    show: showEmojiPopover,
};
