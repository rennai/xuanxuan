import fs from 'fs-extra';
import sound from '../common/sound.js';
import env from './env.js';
import screenshot from './screenshot.js';
import contextmenu from './contextmenu.js';
import remote from './remote.js';
import EventEmitter from './event-emitter.js';
import image from './image.js';
import ui from './ui.js';
import notify from './notify.js';
import shortcut from './shortcut.js';
import dialog from './dialog.js';
import net from './net.js';
import crypto from './crypto.js';
import Socket from './socket.js';
import clipboard from './clipboard.js';
import webview from './webview.js';
import buildIn, {buildInPath} from './build-in.js';
import language, {initLanguage} from './language.js';

if (process.type !== 'renderer') {
    throw new Error('platform/electron/index.js must run in renderer process.');
}

export const init = ({config, lang}) => {
    if (config) {
        // 初始化 ion-sound 声音播放模块
        sound.init(config.media['sound.path']);

        // 初始化界面交互功能模块
        ui.init(config);
    }

    if (lang) {
        contextmenu.setLangObj(lang);
    }

    initLanguage();

    if (DEBUG) {
        console.color('Build-in Path', 'greenBg', buildInPath, 'greenPale');
    }
};

const platform = {
    type: 'electron',
    init,
    language,
    env,
    screenshot,
    contextmenu,
    EventEmitter,
    remote,
    image,
    ui,
    shortcut,
    dialog,
    fs,
    sound,
    net,
    crypto,
    Socket,
    notify,
    clipboard,
    webview,
    buildIn,
};

export default platform;
