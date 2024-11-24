import Socket from './socket.js';
import clipboard from './clipboard.js';
import sound from '../common/sound.js';
import crypto from './crypto.js';
import EventEmitter from './event-emitter.js';
import env from './env.js';
import ui from './ui.js';
import dialog from './dialog.js';
import notify from './notify.js';
import net from './net.js';

/**
 * 浏览器平台上所有可用的模块
 */
export default {
    type: 'browser',
    Socket,
    clipboard,
    crypto,
    EventEmitter,
    env,
    ui,
    notify,
    sound,
    net,
    dialog,
};
