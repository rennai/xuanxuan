# Goal 3：Electron 安全模型迁移（preload + contextIsolation）

> **依赖**：Goal 2.2 完成（需要 React 18 + 稳定依赖基线 + ESLint 把关作为迁移后的功能验证基准）
> **对应计划**：`doc/upgrade/xxc-upgrade-plan.md` 的阶段 4

以下为可直接粘贴到 `/goal` 命令的完整内容：

---

```
/goal 将 xxc 客户端的 Electron 架构从 nodeIntegration:true 迁移到 contextIsolation:true + preload 脚本，使渲染进程不再直接访问 Node/Electron API，但仍通过 Platform 抽象层提供等价能力。此阶段不升级 Electron 版本（仍 4），先在新安全模型下跑稳。

First action: 读取以下文件并报告关键信息，等待确认后再动手：
- doc/upgrade/xxc-upgrade-plan.md（重点看「Electron 相关必改项」「关键约束」章节）
- doc/upgrade/screenshots/（回归基线）
- xxc/app/platform/electron/app-remote.js（主进程，重点看 560-563 行 webPreferences、611 行 new-window、ipcMain.on 事件）
- xxc/app/platform/electron/crypto.js（Node crypto.createCipheriv）
- xxc/app/platform/electron/socket.js（ws 库）
- xxc/app/platform/electron/index.js（import fs from 'fs-extra'）
- xxc/app/platform/browser/socket.js（原生 WebSocket 参考，已验证可用）
- xxc/app/platform/browser/crypto.js（浏览器 crypto 参考）
- 运行 `grep -rn "import.*from 'fs\|import.*from 'path\|import.*from 'crypto\|import.*'ws'" xxc/app/platform/electron --include="*.js"` 报告渲染进程 Node 依赖的精确清单
- 运行 `grep -rn "import.*from 'path'" xxc/app/exts --include="*.js"` 报告 exts 目录的 7 处 path 依赖

Scope:
  - xxc/app/platform/electron/preload.js（新建，contextBridge.exposeInMainWorld 暴露白名单 API）
  - xxc/app/platform/electron/app-remote.js（webPreferences 改造、new-window→setWindowOpenHandler、dialog Promise 化）
  - xxc/app/platform/electron/crypto.js（Web Crypto API 或走 preload 桥接 Node crypto）
  - xxc/app/platform/electron/socket.js（ws → 原生 WebSocket，参考 platform/browser/socket.js）
  - xxc/app/platform/electron/index.js（fs-extra → IPC 到主进程）
  - xxc/app/exts/ 下 7 处 import path（扩展系统文件操作走 IPC）
  - xxc/app/main.development.js（electron-debug → 内置 openDevTools，electron-devtools-installer 兼容性验证）
  - xxc/vite.config.ts（Platform 别名从 browser 切回 electron，加 electron-vite 主进程/preload 构建配置）
  - 不升 Electron 版本（仍 4）
  - 不改 mock server 和协议

Constraints:
  - 渲染进程（views/components/core）代码不能直接 import 任何 Node 内置模块或 Electron API，必须经 Platform 或 preload 暴露的 window API
  - contextIsolation 必须为 true，nodeIntegration 必须为 false
  - preload 脚本暴露的 API 必须是白名单（contextBridge.exposeInMainWorld），不能直接暴露 require
  - 复用 app-remote.js 现有的 IPC 模式（ipcMain.on EVENT.remote），不另起一套 IPC
  - crypto 迁移优先走 preload 桥接主进程 Node crypto（与服务器端 AES-256-CBC 行为一致），Web Crypto API 仅作备选
  - exts/ 扩展系统的文件操作若改造过于复杂，可临时禁用扩展加载功能（记录为已知限制）
  - 不改 React 版本（18）
  - 不改 socket-message.js 信封协议

Done when:
  1. xxc/app/platform/electron/preload.js 存在，使用 contextBridge.exposeInMainWorld 暴露白名单 API
  2. app-remote.js 中 webPreferences 为 `{ nodeIntegration: false, contextIsolation: true, preload: <preload.js路径> }`，webSecurity: false 已移除
  3. app-remote.js 中无 new-window 事件监听（grep 确认），改为 setWindowOpenHandler
  4. grep 确认 platform/electron/ 下无 `import WS from 'ws'`（改用原生 WebSocket）
  5. grep 确认 platform/electron/ 下无 `import crypto from 'crypto'`（走 preload 或 Web Crypto）
  6. grep 确认 platform/electron/index.js 下无 `import fs from 'fs-extra'`（走 IPC）
  7. `pnpm dev` 启动 Electron（非浏览器），登录界面渲染，控制台无 nodeIntegration 相关警告
  8. 连 mock server 后登录成功，主界面渲染与 Goal 2 截图一致：聊天列表、会话、消息、通知可见
  9. socket 加密通信正常（crypto 迁移后消息仍可正常收发，无解密失败）
  10. 截图留存到 doc/upgrade/screenshots/（Electron 新安全模式下的主界面）

Stop if:
  - Electron 4 不支持 contextIsolation 或 contextBridge（版本太老）—— 记录 Electron 4 的 contextIsolation 支持情况，可能需要直接跳到 Goal 4 先升 Electron 再做安全模型
  - crypto 迁移后 AES-256-CBC 加解密与 mock server 不匹配（消息解密失败）—— 优先走 preload 桥接 Node crypto 而非 Web Crypto
  - exts/ 扩展系统改造导致扩展无法加载 —— 临时禁用扩展功能，不阻塞核心迁移
  - ws → 原生 WebSocket 后 socket 连接行为异常（心跳/ping 逻辑失效）—— 对照 platform/browser/socket.js 已验证的实现排查
  - 任何改动修改了 socket-message.js 信封协议或 mock server
  - 渲染进程代码（views/components/core）出现直接 import Node/Electron 的情况（必须经 Platform 或 preload）

Use a token budget of 200K tokens for this goal.
```

---

**关键设计选择**：
- First action 先 grep 出所有 Node 依赖精确清单，这是迁移的完整工作面
- crypto 优先走 preload 桥接而非 Web Crypto——Node crypto 与服务器 AES-256-CBC 行为一致，Web Crypto 有 IV/key 格式差异风险
- 复用现有 IPC 模式而非另起一套，降低改动面
- 验收项用 grep 确认无残留依赖（机械可验证）
- Stop-if 第一条很关键：Electron 4 可能太老不支持 contextIsolation，若如此需要调整策略先升版本——这是阶段顺序的一个潜在分叉
- exts 允许临时禁用，避免扩展系统拖垮核心迁移
