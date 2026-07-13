// 喧喧 mock server（独立 Node 脚本，非 vite 插件）
// 阶段 2：让客户端登录成功并渲染主界面。
//   - HTTP 登录握手端点：POST http://127.0.0.1:11443/serverInfo（本基线用 HTTP，配合 ui.json skipHTTPSecurityAlert）
//   - WebSocket 消息回放：ws://127.0.0.1:11444/ws
// 加密：阶段 2 暂关闭（客户端 platform/browser/socket.js encryptEnable=false），mock 收发均为明文 JSON 文本帧。
// 信封 {module, method, params, data, result, v, lang} 不可改。
// 详见 doc/upgrade/xxc-upgrade-plan.md 阶段 2、doc/api.md、doc/client-events.md。

import http from 'node:http';
import {WebSocketServer} from 'ws';

const HTTP_PORT = 11443;
const WS_PORT = 11444;
const HOST = '127.0.0.1';

// 32 字符 token（AES-256 key 长度；当前虽关加密，保留以便后续补 AES，cipherIV = token.substr(0,16)）
const TOKEN = '0123456789abcdef0123456789abcdef';

// ---- 固定 mock 数据 ----
const now = Date.now();
const members = [
    {id: 1, account: 'admin', realname: '管理员', realnames: {'zh-cn': '管理员'}, avatar: '', role: 'dev', dept: 1, status: 'online', admin: 'super', gender: 'u', email: '', mobile: '', site: '', phone: '', deleted: false},
    {id: 2, account: 'alice', realname: 'Alice', realnames: {'zh-cn': 'Alice'}, avatar: '', role: 'dev', dept: 1, status: 'online', admin: 'no', gender: 'f', email: '', mobile: '', site: '', phone: '', deleted: false},
];
const loginUser = members[0]; // 登录用户 = admin（id=1）
const chats = [
    {id: 101, gid: 'xuanxuan-group-1', name: '测试群', type: 'group', admins: '1', committers: '', subject: 0, public: false, createdBy: 'admin', createdDate: now, editedBy: '', editedDate: 0, lastActiveTime: now, dismissDate: 0, star: false, hide: false, mute: false, category: '', members: [{id: 1}, {id: 2}]},
];
const messages = [
    {id: 5001, gid: 'msg-gid-1', cgid: 'xuanxuan-group-1', user: 2, date: now - 60000, type: 'normal', contentType: 'text', content: '你好，这是 mock 服务器推送的测试消息 👋', order: 1},
    {id: 5002, gid: 'msg-gid-2', cgid: 'xuanxuan-group-1', user: 1, date: now - 30000, type: 'normal', contentType: 'plain', content: '收到，主界面已亮起。', order: 2},
];
const roles = {dev: '开发者'};
const depts = [{id: 1, name: '研发部', parent: 0}];

// 构造 SocketMessage 信封
const envelope = (method, data, extra = {}) => JSON.stringify({
    module: 'chat',
    method,
    result: 'success',
    v: '1.7.0',
    lang: 'zh-cn',
    data,
    ...extra,
});

// ---- HTTP 登录握手 ----
const httpServer = http.createServer((req, res) => {
    // 客户端运行在 vite 5173，跨端口，需 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url && req.url.endsWith('/serverInfo')) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            // body 形如 data=<urlencoded JSON>；不校验账号密码，一律放行
            const serverInfo = {
                chatPort: String(WS_PORT),
                token: TOKEN,
                version: '1.7.0',
                socketUrl: `ws://${HOST}:${WS_PORT}/ws`,
                uploadFileSize: 10485760,
                ranzhiUrl: '',
            };
            console.log(`[http] /serverInfo login -> ws=${serverInfo.socketUrl}`);
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(serverInfo));
        });
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

httpServer.listen(HTTP_PORT, HOST, () => {
    console.log(`[mock] HTTP 登录握手: http://${HOST}:${HTTP_PORT}/serverInfo`);
});

// ---- WebSocket 消息回放 ----
const wss = new WebSocketServer({port: WS_PORT, host: HOST, path: '/ws'}, () => {
    console.log(`[mock] WebSocket: ws://${HOST}:${WS_PORT}/ws`);
});

wss.on('connection', (ws) => {
    console.log('[ws] client connected');

    ws.on('message', (raw) => {
        let req;
        try {
            req = JSON.parse(raw.toString());
        } catch (e) {
            console.warn('[ws] non-JSON frame, ignore');
            return;
        }
        const {method} = req;
        console.log(`[ws] <- chat/${method}`);

        switch (method) {
            case 'login': {
                // 1) 回登录成功（data.id 决定 user.id）
                ws.send(envelope('login', loginUser));
                // 2) 登录成功后主动推送：成员列表 -> 会话列表 -> 消息（文档约定 xxd 主动推送）
                setTimeout(() => {
                    ws.send(envelope('usergetlist', members, {roles, depts}));
                    ws.send(envelope('getlist', chats));
                    ws.send(envelope('message', messages));
                    console.log('[ws] -> pushed usergetlist / getlist / message');
                }, 50);
                break;
            }
            case 'settings': {
                ws.send(envelope('settings', {lastSaveTime: 0}));
                break;
            }
            case 'usergetlist': {
                ws.send(envelope('usergetlist', members, {roles, depts}));
                break;
            }
            case 'getlist': {
                ws.send(envelope('getlist', chats));
                break;
            }
            case 'history': {
                // params: [gid, recPerPage, pageID, recTotal, continued, startDate]
                const gid = req.params && req.params[0];
                const list = gid ? messages.filter(m => m.cgid === gid) : [];
                ws.send(envelope('history', list, {
                    pager: {recPerPage: 50, pageID: 1, recTotal: list.length, gid: gid || '', continued: false},
                }));
                break;
            }
            case 'ping': {
                ws.send(envelope('pong', null));
                break;
            }
            default: {
                // 其它 method：回 success，避免客户端 listenMessage 超时挂起
                ws.send(envelope(method, null));
            }
        }
    });

    ws.on('close', () => console.log('[ws] client disconnected'));
    ws.on('error', (err) => console.warn('[ws] error:', err.message));
});

// 心跳：每 90s 广播 pong，保持客户端 lastHandTime（version>=1.5 启用 socketPing，客户端不发 ping）
setInterval(() => {
    wss.clients.forEach(c => {
        if (c.readyState === 1) {
            c.send(envelope('pong', null));
        }
    });
}, 90 * 1000);

console.log('[mock] 启动完成（加密已关闭）。登录：server=http://127.0.0.1:11443  account=admin  password=任意');
