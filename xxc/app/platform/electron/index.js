import native from './native';
import sound from '../common/sound';
import env from './env';
import screenshot from './screenshot';
import contextmenu from './contextmenu';
import remote from './remote';
import EventEmitter from './event-emitter';
import image from './image';
import ui from './ui';
import notify from './notify';
import shortcut from './shortcut';
import dialog from './dialog';
import net from './net';
import crypto from './crypto';
import Socket from './socket';
import clipboard from './clipboard';
import webview from './webview';
import buildIn, {buildInPath} from './build-in';
import language, {initLanguage} from './language';

export const init = ({config, lang}) => {
    if (config) {
        // 初始化声音播放模块（HTML5 Audio）
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
    // [upgrade] contextIsolation 下渲染进程通过 native.fs（IPC 白名单）访问文件
    fs: native.fs,
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
