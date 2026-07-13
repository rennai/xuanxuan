import profile from './profile';
import members from './members';
import im from './im';
import db from './db';
import server from './server';
import notice from './notice';
import events from './events';
import ui from './ui';
import models from './models';
import todo from './todo';

const app = {
    profile,
    members,
    im,
    db,
    server,
    notice,
    events,
    ui,
    models,
    todo,

    get user() {
        return profile.user;
    }
};

if (DEBUG) {
    global.$.App = app;
}

// [upgrade] 追加 named re-exports，复刻原 webpack + babel-plugin-add-module-exports
// 的 CJS interop 宽松行为（允许 `import {profile} from '../core'`）。
// Vite 严格 ESM 不允许从 default 对象取 named，故显式导出。
export {
    profile,
    members,
    im,
    db,
    server,
    notice,
    events,
    ui,
    models,
    todo,
};

export default app;
