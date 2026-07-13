# Goal 1：建立 Vite 基线 + 浏览器视觉基线 + Mock Server

> **依赖**：无（首个 goal）
> **对应计划**：`doc/upgrade/xxc-upgrade-plan.md` 的任务 0 + 阶段 1 + 阶段 2

以下为可直接粘贴到 `/goal` 命令的完整内容：

---

```
/goal 在 xxc/ 下建立 Vite 8 + pnpm 开发基线，让现有 React 16 代码在浏览器中渲染，并通过独立 mock server 让登录成功、主界面亮起。

First action: 读取以下文件并报告关键信息，等待确认后再动手：
- doc/upgrade/xxc-upgrade-plan.md（完整计划，重点看「关键约束」「基线策略」「阶段 1-2」章节）
- xxc/app/index.html（入口 HTML，注意内联脚本）
- xxc/app/index.js（渲染进程入口，注意 ReactDOM.render）
- xxc/app/platform/browser/index.js（浏览器平台模块）
- xxc/app/platform/browser/socket.js（浏览器 WebSocket 实现，mock 参照）
- xxc/app/core/network/api.js（登录握手 requestServerInfo）
- xxc/app/core/network/socket-message.js（消息信封格式）

Scope:
  - xxc/package.json（用 pnpm 11 重新初始化，旧 package-lock.json / yarn.lock 备份后删除）
  - xxc/vite.config.ts（新建）
  - xxc/app/index.html（清理内联脚本，保留 appContainer / loading 结构）
  - xxc/mock-server/（新建，独立 Node 脚本，HTTP + WebSocket）
  - AGENTS.md（顶部加重构状态横幅）
  - 不改 React / Electron 版本（仍是 16 / 4）

Constraints:
  - Platform 抽象层不可绕过：所有系统能力必须经 Platform 模块，vite resolve.alias 的 Platform 指向 ./app/platform/browser/index.js
  - 别名必须配置：Platform→browser、Config→config/、ExtsRuntime→exts/runtime、ExtsView→views/exts/
  - 全局变量 DEBUG 必须定义（替代 webpack DefinePlugin）
  - 不改 core/network/socket-message.js 的信封协议格式
  - 不动 xxd/ xxb/ ranzhi/ 目录
  - 不改 React 版本（ReactDOM.render 暂时保留，Goal 2 才改）
  - mock server 是独立脚本，不用 vite mock 插件（核心是 WebSocket 长连接，插件处理不了）
  - 不预写未验证的新命令进 AGENTS.md

Done when:
  1. AGENTS.md 顶部有重构状态横幅，指向 doc/upgrade/xxc-upgrade-plan.md
  2. xxc/vite.config.ts 存在，resolve.alias 配置了 4 个别名（Platform 指向 browser），less 处理已配，DEBUG 全局已定义
  3. xxc/ 下 `pnpm install` 成功退出（退出码 0）
  4. `pnpm dev` 启动 Vite dev server，HMR 工作（修改 React 组件后浏览器自动刷新）
  5. 登录界面（views/login/form.js）在浏览器中渲染，表单可见、可输入、可点击
  6. xxc/mock-server/ 下有可运行的 mock server 脚本（pnpm 脚本或 node 直接运行），提供 HTTPS 登录握手端点 + WebSocket 消息回放
  7. 客户端连上 mock server 后登录成功，主界面渲染（聊天列表非空、至少 1 个会话可见、消息气泡显示）
  8. 截图留存到 doc/upgrade/screenshots/：至少登录界面 + 主界面 2 张，作为后续 goal 的视觉回归基线

Stop if:
  - mzui/ less 依赖链导致 Vite 构建失败，且 30 分钟内无法解决（需评估是否预编译 mzui 为静态 css）
  - app/index.js 对 window.global / window.process 的依赖在 Vite 下无法用 polyfill 解决
  - 任何改动修改了 core/network/socket-message.js 的信封协议字段（module/method/params/data/result/v/lang）
  - 任何改动在渲染进程代码里直接 import Node 内置模块或 Electron API（必须走 Platform 别名）
  - pnpm install 因某个老依赖（fbjs-scripts / electron-debug 等）失败 —— 先从 package.json 移除该依赖再重试，记录移除清单

Use a token budget of 200K tokens for this goal.
```

---

**关键设计选择**：
- First action 强制先读计划文档和 7 个关键文件，避免凭猜测动手
- Platform 别名指向 browser 是阶段 1 的核心决策——利用已有的浏览器实现绕过 Electron
- mock server 明确要求独立脚本而非 vite 插件，因为 WebSocket 长连接插件管不了
- 截图留存作为验收项，是后续 3 个 goal 的回归基线
- Stop-if 覆盖 mzui less 复杂度、全局变量 polyfill、协议保护、Platform 边界保护
