# Electron 安全模型迁移 + 升级（Goal 3 + Goal 4 合并）

> **状态**：进行中
> **日期**：2026-07-15

## 背景：Goal 3 无法在 Electron 4 完成

原 Goal 3 计划在 Electron 4 上落地 `contextBridge` + `contextIsolation` 安全模型。
经核实（Electron GitHub tag 核对）：**`contextBridge` 模块在 Electron 7.1.0 才引入**，
`docs/api/context-bridge.md` 在 v4.0.0 tag 下不存在。`contextIsolation` 选项虽在 Electron 4
可用（默认 false），但 `contextBridge.exposeInMainWorld` 不可用——而 Goal 3 的 Done-when #1
与 Constraints 强制要求 `contextBridge.exposeInMainWorld`。

**决策**（用户确认）：跳到 Goal 4，先升级 Electron 到最新稳定版（43.1.0），再在新版本上
落地安全模型。本次范围 = **仅 Electron 升级 + 安全模型**（不含三平台打包，打包留作后续）。

## 架构：preload 桥 + contextIsolation

- `nodeIntegration: false`、`contextIsolation: true`、`webSecurity` 移除。
- 新建 `app/platform/electron/preload.js`：CJS，通过 `contextBridge.exposeInMainWorld('electron', {...})`
  暴露白名单 API（ipc/crypto/env/buildIn/app/clipboard/shell/dialog/window/shortcut/menu/nativeImage/fs/screen）。
- 渲染进程不再 import electron/node，改读 `window.electron.*`（经 `native.js` 统一入口）。
- crypto：preload 内 Node crypto（无需 IPC 往返），返回 Uint8Array 跨桥。
- socket：原生 WebSocket（不再依赖 ws 库），参考 browser/socket.js。
- 复用 app-remote.js 现有 `ipcMain.on(EVENT.remote)` 反射 RPC，不另起 IPC。

## 已知限制

1. **扩展系统暂禁用**：`app/exts/` 7 处 `import path` 依赖 Node 文件系统，contextIsolation 下
   渲染进程无法直接访问。`ExtsRuntime`/`ExtsView` 别名指向 `platform/browser/exts.js`（`false` 存根），
   扩展加载功能暂不启用。待后续将扩展文件操作改为 IPC 桥接后恢复。

2. **截图功能简化**：`platform/electron/screenshot.js` 原实现用 desktopCapturer + RecordRTC +
   Remote.BrowserWindow（428 行），contextIsolation 下需重新设计截屏流程。当前保留最小接口
   （`captureAndCutScreenImage` 事件契约），完整截图切割迁移延后。

3. **AES 加密端到端未验证**：mock server 当前明文收发（`encryptEnable: false`），与 browser 基线
   一致。crypto 已接 preload Node crypto（AES-256-CBC 字节与服务器一致），但因 mock 不支持加密，
   加密端到端通信无法在本环境验证。结构/单元级已验证，端到端延后至真实后端联调。

4. **三平台打包未做**：`build/package.js`（823 行）归档 + electron-builder 声明式配置 + Windows/Linux/
   macOS arm64 构建留作后续 follow-up（原 Goal 4 范围）。

5. **WebSocket 自定义头与自签证书**：`socket.js` 由 `ws` 库改用原生 `WebSocket` 后，无法在握手阶段
   发送自定义 HTTP 头（浏览器 WebSocket API 限制）。旧实现发送 `headers:{version}` 并按连接关闭 TLS
   校验（`rejectUnauthorized:false`），新版丢失这两项。影响：
   - 若真实 xxd 服务端在 WS 升级时校验 `version` 头，新版客户端会被拒绝升级（mock server 不校验，
     故本地无法发现）。
   - 自签 `wss` 连接依赖 `main.development.js` 的全局 `ignore-certificate-errors` 开关（生产 main.js
     同样打包此开关），存在全局 MITM 风险；原生 WebSocket 无法按连接关闭 TLS 校验。
   待真实后端联调时评估：版本号改用 subprotocol 或首条登录消息携带；自签证书引导用户安装而非全局
   关校验，或为 wss 域配置合法证书。

## 文件变更清单

- 新建：`app/platform/electron/preload.js`、`app/platform/electron/native.js`
- 新建：`build/main.mjs`（esbuild 构建 main/preload）、`build/launch-dev.mjs`（Electron dev 启动）
- 改写渲染模块：`event-emitter/env/build-in/crypto/remote/clipboard/notify/shortcut/contextmenu/
  socket/language/ui/net/dialog/image/screenshot/webview/index.js`（共 18 文件）
- 主进程：`app-remote.js`（webPreferences/setWindowOpenHandler/dialog Promise/window.* IPC/fs_*/
  shortcut/dialog_*/osascript 反射方法）、`main.development.js`（去 electron-debug）
- 构建：`vite.config.ts`（Platform 别名按 XXC_PLATFORM 切换 electron/browser）、`package.json`
  （scripts: dev:browser/dev:electron/build:main/build:renderer；main entry；devEngines）
