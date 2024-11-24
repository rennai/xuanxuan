import profile from './profile/index.js';
import members from './members.js';
import im from './im/index.js';
import db from './db/index.js';
import server from './server/index.js';
import notice from './notice.js';
import events from './events.js';
import ui from './ui.js';
import models from './models/index.js';
import todo from './todo.js';

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
