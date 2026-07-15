import React from 'react';
import ReactDOM from 'react-dom';
import ReactSplitPane from '../components/split-pane';
import EmojiMartPicker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import marked from 'marked';
import md5 from 'md5';
import extractZip from 'extract-zip';
import emojione from '../components/emojione';
import DraftJs from 'draft-js';
import {compareVersions} from 'compare-versions';
import hotkeys from 'hotkeys-js';
import {pinyin} from 'pinyin';
import {v4 as uuidV4, v1 as uuidV1} from 'uuid';
import HTMLParser from 'htmlparser';
import platform from '../platform';
import components from '../components';
import lang from '../core/lang';
import utils from '../utils';
import app from '../core';
import views from '../views/external';

// 还原 uuid v3 默认导出形态（可调用 + .v1/.v4），保持扩展经 nodeModules.uuid 调用的向后兼容
const uuid = (...args) => uuidV4(...args);
uuid.v1 = uuidV1;
uuid.v4 = uuidV4;

/**
 * 所有第三方 node 模块
 * @type {Map<string, any>}
 */
const nodeModules = {
    React,
    ReactDOM,
    ReactSplitPane,
    // 保留原导出名 EmojionePicker 以兼容旧扩展代码，同时新增 EmojiMartPicker 别名
    EmojionePicker: props => <EmojiMartPicker data={data} {...props} />,
    EmojiMartPicker: props => <EmojiMartPicker data={data} {...props} />,
    marked,
    md5,
    fs: platform.access('fs'),
    extractZip,
    emojione,
    DraftJs,
    HTMLParser,
    compareVersions,
    hotkeys,
    pinyin,
    uuid,
    get jquery() {
        return __non_webpack_require__('jquery'); // eslint-disable-line
    }
};

/**
 * 导出开放给扩展的模块
 * @type {Map<string, any>}
 */
export default {
    lang,
    components,
    utils,
    platform,
    app,
    views,
    nodeModules,
};
