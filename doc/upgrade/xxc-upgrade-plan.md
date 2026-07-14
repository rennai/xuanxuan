# 喧喧客户端（xxc）现代化重构计划

> **状态**：规划完成，待启动
> **分支**：`upgrade`
> **最后更新**：基于 2026-07-13 代码现状实测

## 执行入口（5 个 /goal，按顺序执行）

本计划已拆分为 6 个独立的 `/goal`，每个是一段可直接粘贴执行的命令。本文档是它们的共享参考（调查数据、必改清单、风险表）。

- **Goal 1**：`doc/upgrade/goal-1-bootstrap.md` — Vite 基线 + 浏览器视觉基线 + Mock Server（任务 0 + 阶段 1 + 阶段 2）
- **Goal 2**：`doc/upgrade/goal-2-react18.md` — React 16 → 18 + 老依赖替换（阶段 3）
- **Goal 2.1**：`doc/upgrade/goal-2.1-deps-upgrade.md` — 前端依赖批量升级（react-router-dom、dexie、pinyin、hotkeys-js、uuid 等，marked 默认保持 0.4.0 条件升级）（阶段 3 补充）
- **Goal 2.2**：`doc/upgrade/goal-2.2-eslint-cleanup.md` — ESLint 恢复（ESLint 9 flat config）+ 死配置清理（.babelrc / webpack configs / .eslintrc / .eslintignore）（阶段 3 补充）
- **Goal 3**：`doc/upgrade/goal-3-electron-security.md` — Electron 安全模型迁移，preload + contextIsolation（阶段 4）
- **Goal 4**：`doc/upgrade/goal-4-upgrade-platforms.md` — Electron + Node 升级 + 三平台构建（阶段 5）

**依赖链**：Goal 1 → Goal 2 → Goal 2.1 → Goal 2.2 → Goal 3 → Goal 4，必须按顺序执行。每个 goal 的 Done-when 都依赖前一个 goal 的产物（尤其 Goal 1 的截图基线和 mock server）。Goal 2.1 在浏览器基线上验证依赖升级，Goal 2.2 恢复 ESLint 并清理死配置，为后续所有 goal 提供 lint 把关。

> **回归策略**：项目的回归验证基于截图视觉对照（`doc/upgrade/screenshots/`）+ `agent-browser` 技能按需做浏览器端验证（导航、截图、对照基线）。不引入独立测试框架——项目历史上零测试，升级过程中 AI agent 用 `agent-browser` 即可完成浏览器端验证，升级完成后如需补充自动化测试可另行评估。`@playwright/test` 仅保留用于 `mock-server/screenshot.mjs` 截图脚本。

## 目标

将 xxc 客户端从过时的技术栈迁移到现代工具链，并恢复三平台（Windows / Linux / macOS arm64）构建能力。

| 维度 | 现状 | 目标 |
|------|------|------|
| Node | 8.x（devEngines 声明，实际无法安装） | 22 LTS 或 24 |
| 构建工具 | Webpack 4 + Babel 6 | Vite 8 + esbuild/SWC |
| 包管理 | npm 5 / yarn（lockfile v1，已无法安装） | pnpm 11 |
| 前端框架 | React 16（class 组件为主，110 个） | React 18（保留 class 组件） |
| 桌面框架 | Electron 4（nodeIntegration:true） | 最新 Electron（preload + contextIsolation） |
| 打包 | electron-builder 20 + 823 行自定义 package.js | 现代 electron-builder 声明式配置 |
| 三平台 | Windows x64 / Linux x64 / macOS x64 | Windows / Linux / **macOS arm64** |

**React 不一步到 19 / 不全面改 hooks**——先让项目稳定跑起来，组件范式现代化留到后续可选阶段。

## 关键约束（实测得出的硬事实）

这些是重构期间必须遵守的边界，违反任何一条都会显著放大风险。

### 1. Platform 抽象层不可绕过

`app/platform/{electron,browser,common}` 通过 webpack 别名 `Platform` 注入。所有系统能力（socket、加密、文件、通知、剪贴板等）必须经由 `Platform` 模块访问。**Electron 安全模型迁移阶段，这条边界只会更重要**——渲染进程绝不能直接 import Electron / Node API。

当前全局只有 **7 处** `import path from 'path'`，全在 `app/exts/` 扩展系统内（`build-in/index.js`、`ui.js`、`app-extension.js`、`theme.js`、`server/index.js`、`manager.js`、`base-extension.js`）。渲染进程业务代码（`views/`、`components/`、`core/`）对 Node 内置模块**零直接依赖**。这是整个重构最大的有利条件。

### 2. 后端协议是规整的 JSON 信封，不是分散的 REST

客户端与后端的契约全部收敛在 `App.server` 对象 + 一份 `{module, method, params}` 信封上：

- **登录握手**（HTTPS）：`core/network/api.js:requestServerInfo()` 向 `xxd` POST `{module:'chat', method:'login', params:[serverName, account, passwordForServer, '']}`，回 `{chatPort, token, serverVersion, socketUrl, uploadFileSize, ranzhiUrl}`
- **实时消息**（WebSocket）：`core/network/socket.js:login()` 建连后，所有交互都是 `SocketMessage`（`{module, method, params, data, result, v, lang}`），由 `core/server/server-handlers.js` 按 `module/method` 分发

详见 `core/network/socket-message.js`、`doc/api.md`、`doc/client-events.md`。

### 3. 渲染进程已有完整的 IPC 架构

主进程/渲染进程通信走自定义 IPC（`platform/electron/remote.js` + `platform/electron/app-remote.js`），**不是已废弃的 `@electron/remote`**。这给 Electron 安全模型迁移提供了好得多的起点。`app-remote.js` 里 `ipcMain.on(EVENT.remote, ...)` 已经实现了"渲染进程通过 IPC 调用主进程方法"的机制，迁移时可以复用这个模式。

### 4. 已废弃 API 与必改清单（已定位）

以下是升级期间必须处理的具体硬点，已逐一定位到文件行号：

**Electron 相关（阶段 3-4）：**
- `app/platform/electron/app-remote.js:560-563` — `webPreferences: { nodeIntegration: true, webSecurity: false }`，必须改为 `nodeIntegration: false` + `contextIsolation: true` + preload 脚本
- `app/platform/electron/app-remote.js:611` — `new-window` 事件，Electron 24+ 已移除，改用 `webContents.setWindowOpenHandler`
- `app/platform/electron/app-remote.js` 多处 — `dialog.showMessageBox` 回调风格，新版已 Promise 化
- `app/platform/electron/crypto.js` — `import crypto from 'crypto'` + `crypto.createCipheriv`，迁移到 Web Crypto API 或走 preload
- `app/platform/electron/socket.js` — `import WS from 'ws'`，改用浏览器原生 `WebSocket`（`platform/browser/socket.js` 已有参考实现）
- `app/platform/electron/index.js` — `import fs from 'fs-extra'`，文件操作走 IPC 到主进程

**React 相关（阶段 2）：**
- `app/index.js:29` — `ReactDOM.render(<HomeIndex />, appElement, callback)`，React 19 移除，改 `createRoot` + `root.render`（callback 用 `setTimeout` 或 effect 替代）
- `app/components/display.js:33` — 同上，另一处 `ReactDOM.render`
- 29 处旧生命周期方法（`componentWillMount` / `componentWillReceiveProps` / `componentWillUpdate`），React 18 需加 `UNSAFE_` 前缀或重写
- 50 处 string ref（`ref="xxx"`），React 18 仍支持但建议改 `createRef`，非阻塞

**构建相关（阶段 1）：**
- `app/index.html` 内联脚本硬编码了 `bundle.js` 路径和 `localhost:3000` 热更新逻辑，Vite 接管后这段要清理
- `app/index.html` 内联脚本定义了全局 `window.global = window` 和 `process` polyfill，需评估 Vite 下是否仍需要
- `app/index.js` 顶部 `import './style/app.less'`，`app.less` 通过 `@import` 聚合了 72 个 less 文件（含 `mzui/` 子框架），Vite 需配 less 处理

### 5. 老依赖替换清单（已定位使用范围）

以下依赖已停止维护或不兼容新版本，必须替换。使用范围已实测：

| 依赖 | 版本 | 问题 | 使用范围 | 替代方案 |
|------|------|------|----------|----------|
| `draft-js` | 0.10.5 | 已停止维护，React 18+ 有已知问题 | `views/common/draft-editor.js`（506 行）、`exts/external-api.js` | Lexical 或 `@payloadcms/react-rich-text`，需评估 |
| `react-chatview` | 0.2.5 | 不兼容 React 18 | `core/im/im-ui.js`、`views/chats/{message-list,chat-view,chat-header,external,chats-cache}.js`（6 文件） | 自研虚拟列表或用 `react-virtuoso` |
| `emojione` / `emojione-picker` | 3.1.7 | 项目已归档 | 12 文件 | `emoji-mart` 或 Twemoji |
| `react-split-pane` | 0.1.66 | 不维护 | `exts/external-api.js`、`utils/debug.js`、`views/chats/{chat-view,index}.js` | `react-resizable-panels` 或 `allotment` |
| `ion-sound` | 3.0.7 | 不维护 | `platform/common/sound.js`、`platform/electron/index.js` | HTML5 Audio 直接用 |
| `extract-text-webpack-plugin` | 4.0.0-beta | Webpack 专有，Vite 不需要 | 构建配置 | 直接删除 |
| `babili-webpack-plugin` | 0.1.2 | Webpack 专有，早已废弃 | 构建配置 | Vite 自带 esbuild 压缩 |
| `uglifyjs-webpack-plugin` | 1.2.7 | Webpack 专有 | 构建配置 | esbuild/terser |
| `fbjs-scripts` | 0.8.3 | 用于 `check-dev-engines` | postinstall 脚本 | 删除或换 `@node-rs/helper` |
| `electron-debug` | 2.0.0 | 不兼容新 Electron | `main.development.js:23` | Electron 内置 `openDevTools` |
| `electron-devtools-installer` | 2.2.4 | 兼容性需验证 | `main.development.js:67` | `electron-devtools-installer` 新版或手动安装 |

## 基线策略：不复活老基线，建立浏览器基线

**决定：不尝试在 Node 8 + Electron 4 上跑通现有代码。**

理由：
1. `upgrade` 分支相对 master 只有文档改动，xxc 代码零改动，**没有沉没成本**需要保住。
2. 老工具链（Webpack4/Babel6/electron-builder20）整体要被替换，复活它的投入不会沉淀。
3. 2026 年复活 Node 8 是泥潭（Electron 4 下载、native 模块编译、淘宝镜像迁移、lockfile v1 兼容性），且这套环境极脆弱，不适合作为长期回归参考。

**替代方案：建立浏览器视觉基线。**

利用项目已有的 `platform/browser/` 实现（socket 用原生 WebSocket、crypto/net 有浏览器版本），直接用 Vite 在浏览器里渲染现有 React 代码。配合 mock server 让登录"成功"，进入主界面。这比复活 Electron 4 快一个数量级，且这个基线在后续所有阶段持续有效。

## 执行阶段

共 5 个阶段 + 1 个可选阶段。顺序经过仔细推敲，**不要调换阶段 2 和 3**（React 升级和 Electron 安全模型迁移必须分开，否则回归 bug 会交织）。

---

### 任务 0：更新 AGENTS.md（重构启动的第一项）

在每个 agent 开始工作前，它读到的 AGENTS.md 必须反映重构状态，否则会被老命令误导。

**动作：**
- 在 AGENTS.md 顶部加重构状态横幅，指向本计划文档
- 横幅内容：说明 xxc 正在迁移，xxc 相关 npm scripts 为旧工具链命令、大部分已失效，xxd/xxb/ranzhi 章节不受影响
- 不预写未实现的新命令（遵循"单一事实源"原则），等每阶段跑通后再更新对应章节

**验证：** 横幅存在且指向 `doc/upgrade/xxc-upgrade-plan.md`。

---

### 阶段 1：脚手架迁移（Vite 基线 + 浏览器视觉基线）

**目标：** 让现有 React 代码在新工具链上跑起来，建立可 HMR 的开发环境。此阶段不动 React/Electron 版本。

**步骤：**

1. **初始化新工具链**
   - 用 pnpm 11 重新初始化 `xxc/`（旧的 `package.json` / `package-lock.json` / `yarn.lock` 归档备份）
   - 安装 Vite 8 + `electron-vite`（为后续主进程做准备，本阶段只用 renderer 部分）
   - 配置 `vite.config.ts`：
     - `resolve.alias`：`Platform` → `./app/platform/browser/index.js`（阶段 1 用 browser，阶段 3 切回 electron）、`Config` → `./app/config/index.js`、`ExtsRuntime` → `./app/exts/runtime.js`、`ExtsView` → `./app/views/exts/index.js`
     - less 处理（72 个 less 文件含 `mzui/` 子框架）
     - 定义全局变量 `DEBUG`（替代 webpack DefinePlugin）、`HOT` 等
   - 清理构建专有老依赖：`extract-text-webpack-plugin`、`babili-webpack-plugin`、`uglifyjs-webpack-plugin`、`fbjs-scripts`

2. **改造入口**
   - `app/index.html`：移除内联的 bundle.js 路径脚本、`localhost:3000` 热更新逻辑、`window.global`/`process` polyfill（Vite 接管 HMR）；保留 `appContainer`、`loading` 结构
   - `app/index.js`：`ReactDOM.render` 暂时保留（阶段 2 才改 createRoot），确认能渲染

3. **浏览器渲染验证**
   - `pnpm dev` 启动 Vite，`Platform` 指向 browser 实现
   - 确认登录界面（`views/login/form.js`）能渲染、表单可交互
   - 截图留存，作为视觉基线

**验证标准：**
- `pnpm dev` 能启动，HMR 工作
- 登录界面在浏览器中正确渲染（与 `doc/img/preview.png` 对照大致一致）
- `npm run eslint`（或等价 lint）通过

**已知风险：**
- `mzui/` 是内嵌的 UI 子框架（非 npm 包），less 依赖链可能复杂，需确认 Vite less 插件能处理
- `index.html` 的 polyfill 移除后，代码里对 `window.global` / `window.process` 的依赖要排查

---

### 阶段 2：Mock Server + 主界面亮起

**目标：** 让登录能"成功"，主界面（聊天列表、会话、通知）能渲染，为后续所有阶段提供可验证的环境。

**为什么 mock 在这阶段而非阶段 1：** 阶段 1 只需登录界面渲染（无需后端），本阶段要驱动登录后的界面，必须有数据来源。

**步骤：**

1. **搭建 mock server（独立 Node 脚本，约 150-200 行）**
   - **不**用 vite mock 插件——核心是 WebSocket 长连接，插件处理不了
   - 用 `ws` + `http`/`express` 起两个端点：
     - HTTPS 11443：POST 登录握手，回固定 `{chatPort: 11444, token, serverVersion, socketUrl: 'ws://localhost:11444', uploadFileSize, ranzhiUrl}`
     - WebSocket 11444：按 `{module, method, params}` 信封回放假数据
   - mock 数据来源：`doc/api.md`、`doc/client-events.md` 的协议定义 + `core/server/server-handlers.js` 的客户端解析逻辑反推
   - 最小数据集：登录成功响应、成员列表、1-2 个聊天会话、一条示例消息、响应 ping 心跳
   - 加密：参考 `platform/browser/crypto.js` 的 AES-256-CBC 实现，mock server 需对应加解密

2. **让客户端连上 mock**
   - Vite 配置代理或环境变量指向 mock server
   - 确认登录流程走通：`requestServerInfo` → 拿 token → `socket.login` → 主界面渲染

3. **截图留存主界面**
   - 聊天列表、单个会话、消息气泡、通知——作为后续重构的视觉参考

**验证标准：**
- mock server 启动后，客户端能登录成功
- 主界面完整渲染（聊天列表非空、会话可切换、消息可见）
- socket 全链路验证（登录握手 → token → WebSocket 建连 → 消息收发 → ping 心跳）

**已知风险：**
- 加密握手是第一个难点：客户端 `socket.js` 默认 `encryptEnable: true`，mock server 必须实现匹配的 AES-256-CBC。若调试困难，可临时在 mock 中关闭加密（`encryptEnable: false`）先跑通流程，再补加密。
- `server-handlers.js` 对特定 `module/method` 的处理逻辑需逐一对照，遗漏会导致界面空白或报错。

---

### 阶段 3：React 16 → 18

**目标：** 升级 React 到 18，保留 class 组件，只改必改项。

**为什么不在阶段 1 一起做：** 阶段 1 的优先级是工具链稳定（先有一个能 dev/build 的环境），React 升级的回归要在稳定环境里验证才清晰。

**步骤：**

1. **升级 React 依赖**
   - `react` / `react-dom` → 18.x
   - 评估 `react-router-dom@4` → 6（breaking changes 多，若路由不复杂可暂留 4 或升到 5）

2. **必改项（已定位）**
   - `app/index.js:29` + `app/components/display.js:33`：`ReactDOM.render` → `createRoot` + `root.render`
   - 29 处旧生命周期方法：加 `UNSAFE_` 前缀或重写（grep 确认位置后逐一处理）

3. **老依赖替换（已定位使用范围）**
   - `react-chatview`（6 文件）→ `react-virtuoso` 或自研虚拟列表
   - `emojione` / `emojione-picker`（12 文件）→ `emoji-mart`
   - `react-split-pane`（4 文件）→ `react-resizable-panels`
   - `draft-js`（`draft-editor.js` 506 行 + `external-api.js`）→ Lexical（这个工作量最大，建议最后做，可临时锁 `draft-js@0.11` 兼容 React 18）
   - `ion-sound`（2 文件）→ HTML5 Audio

4. **验证**
   - 登录界面 + 主界面（含 mock 数据）行为与阶段 2 截图一致
   - 消息列表滚动、表情选择、分栏拖拽等交互正常

**验证标准：**
- React 18 无控制台 warning（关于 deprecated API）
- 所有阶段 2 截图的界面行为一致
- `draft-js` 若未替换，确认在 React 18 下不崩溃（可接受临时方案）

---

### 阶段 4：Electron 安全模型迁移

**目标：** 从 `nodeIntegration: true` 迁移到 `contextIsolation: true` + preload。**此阶段不升 Electron 版本**，仍在 Electron 4 上用新安全模型跑稳。

**为什么单独成阶段且在 React 升级之后：** 这步引入最多回归（所有 Node 能力访问点都要改道），必须和 React 升级的回归隔离，否则两类 bug 交织极难调试。放在 React 升级后，是因为 React 升级后的界面是验证安全模型迁移是否破坏功能的基准。

**步骤：**

1. **创建 preload 脚本**
   - 新建 `app/platform/electron/preload.js`，通过 `contextBridge.exposeInMainWorld` 暴露白名单 API
   - 复用 `app-remote.js` 现有的 IPC 模式（`ipcMain.on(EVENT.remote, ...)`）

2. **改造 webPreferences**
   - `app/platform/electron/app-remote.js:560-563`：`nodeIntegration: false`、`contextIsolation: true`、`preload: path.join(__dirname, 'preload.js')`、移除 `webSecurity: false`

3. **渲染进程 Node 能力迁移（已定位）**
   - `platform/electron/crypto.js`：`crypto.createCipheriv` → Web Crypto API（`SubtleCrypto`）或走 preload 桥接主进程 Node crypto
   - `platform/electron/socket.js`：`ws` → 浏览器原生 `WebSocket`（参考 `platform/browser/socket.js` 实现）
   - `platform/electron/index.js`：`fs-extra` → IPC 到主进程
   - `app/exts/` 7 处 `import path` → 扩展系统文件操作走 IPC

4. **废弃 API 修复（已定位）**
   - `app-remote.js:611`：`new-window` → `webContents.setWindowOpenHandler`
   - `app-remote.js` 多处：`dialog.showMessageBox` 回调 → Promise 风格
   - `main.development.js:23`：`electron-debug` → Electron 内置 `openDevTools`
   - `main.development.js:67`：`electron-devtools-installer` → 验证新版兼容性或手动安装

**验证标准：**
- Electron 4 下以新安全模型启动，登录界面 + 主界面（mock 数据）行为与阶段 3 一致
- 控制台无 `nodeIntegration` 相关警告
- socket 加密通信正常（crypto 迁移后）

**已知风险：**
- `exts/` 扩展系统的文件操作改造可能较复杂，扩展包的加载/解压逻辑依赖 `fs`/`path` 较深
- Web Crypto API 与 Node crypto 的 AES-256-CBC 行为差异需验证（IV/key 格式）

---

### 阶段 5：Electron + Node 升级 + 三平台构建

**目标：** 升级到最新 Electron + Node 22/24，恢复三平台（含 macOS arm64）构建。

**为什么放最后：** 安全模型在阶段 4 已经稳定，版本升级的回归（Electron API breaking changes）在这个干净基础上最容易定位。

**步骤：**

1. **升级 Electron**
   - electron → 最新稳定版
   - 逐版本核对 breaking changes（4 → 最新跨度大，重点查 `BrowserWindow`、`webContents`、`Menu`、`Tray`、`dialog`、`app` API 变更）
   - 升级 `electron-builder` 到最新

2. **Node 22/24**
   - 确认 `devEngines` 更新
   - 用 fnm 已装的 Node 22 或 24 验证

3. **重写打包配置**
   - 823 行 `build/package.js` → `electron-builder` 声明式配置（`electron-builder.yml` 或 `package.json` 的 `build` 字段）
   - 用 `electron-vite` 的主进程/渲染进程/preload 三入口构建
   - 保留原 `package.js` 的平台/arch/debug/beta 参数语义（参考其 `commander` 定义），但实现用 electron-builder

4. **三平台构建验证**
   - macOS arm64：本地构建（Apple Silicon，`fnm` 已有环境）
   - Windows：交叉编译或 CI
   - Linux：交叉编译或 CI
   - 浏览器版：`package-browser` 等价命令

**验证标准：**
- 三平台均产出可启动的安装包
- macOS arm64 安装包在 Apple Silicon 上运行正常
- 各平台登录界面 + 主界面（连 mock）行为一致

**已知风险：**
- Electron 跨多个大版本的 API breaking changes 需逐一处理，这是本阶段主要工作量
- macOS 代码签名（Developer ID）若需要，是额外流程；若仅自用可先用 ad-hoc 签名

---

### 阶段 6（可选）：React 19 + 组件现代化

**非必选，视精力决定。**

- React 18 → 19
- 110 个 class 组件 → 函数组件 + hooks（按模块逐步迁移，非一次性）
- string ref → `createRef` / `useRef`（50 处）
- 评估 Draft.js → Lexical 是否完成（若阶段 3 临时保留的话）

## 后端验证策略

整个重构过程**不需要真实 Go/PHP 后端**（`xxd`/`xxb`/`ranzhi`）：

- 阶段 1-2：mock server 提供数据
- 阶段 3-5：mock server 持续作为验证环境
- 真实后端联调：仅在最终端到端测试时才需要，届时单独评估是否复活 `xxd`（GOPATH 模式，需 `GO111MODULE=off` + sqlite3 CGO）或用现代技术重写

`xxb`（PHP）的 `Makefile` 依赖同级 `zdoo/` 目录，**仓库内没有 `zdoo/`**，这条路目前走不通，不在重构范围内。

## 风险登记表

| 风险 | 概率 | 影响 | 阶段 | 缓解 |
|------|------|------|------|------|
| mzui less 依赖链 Vite 难处理 | 中 | 中 | 1 | 先跑通看报错，必要时拆 less 或临时内联 |
| Draft.js React 18 不兼容 | 高 | 中 | 3 | 临时锁 0.11 版本，Lexical 迁移延后 |
| exts 扩展系统 fs/path 改造复杂 | 中 | 高 | 4 | 若扩展非核心功能，可临时禁用扩展加载 |
| Web Crypto 与 Node crypto 行为差异 | 中 | 高 | 4 | 优先走 preload 桥接主进程 Node crypto，而非纯 Web Crypto |
| Electron 跨多版本 API breaking | 高 | 高 | 5 | 分小步升级（4→某中间版→最新），每步验证 |
| mock 加密握手调试困难 | 中 | 中 | 2 | 先关加密跑通，再补 |

## 参考文档

- 项目上岗说明：`AGENTS.md`（重构启动后顶部会有横幅指向本文档）
- 客户端开发：`doc/client-developer.md`
- 服务器协议：`doc/api.md`、`doc/client-events.md`
- 扩展机制：`doc/extension.md`
- xxd 开发：`doc/xxd-developer.md`
- 浏览器端部署：`doc/browser-usage.md`
