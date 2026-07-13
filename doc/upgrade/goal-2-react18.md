# Goal 2：React 16 → 18 升级 + 老依赖替换

> **依赖**：Goal 1 完成（需要 Vite 基线 + mock server 作为验证环境）
> **对应计划**：`doc/upgrade/xxc-upgrade-plan.md` 的阶段 3

以下为可直接粘贴到 `/goal` 命令的完整内容：

---

```
/goal 将 xxc 客户端的 React 从 16 升级到 18，保留 class 组件不动，替换不兼容 React 18 的老依赖，使主界面在 React 18 下行为与 Goal 1 截图基线一致。

First action: 读取以下文件并报告关键信息，等待确认后再动手：
- doc/upgrade/xxc-upgrade-plan.md（重点看「老依赖替换清单」「React 相关必改项」章节）
- doc/upgrade/screenshots/（Goal 1 截图基线，作为回归对照）
- xxc/app/index.js:29（ReactDOM.render 第一处）
- xxc/app/components/display.js:33（ReactDOM.render 第二处）
- 运行 `grep -rn "componentWillMount\|componentWillReceiveProps\|componentWillUpdate" xxc/app --include="*.js" | grep -v node_modules` 报告旧生命周期方法的精确位置和数量
- 运行 `grep -rn "draft-js\|react-chatview\|emojione\|react-split-pane\|ion-sound" xxc/app --include="*.js" | grep -v node_modules` 报告老依赖的使用文件清单

Scope:
  - xxc/package.json（react/react-dom 升 18，替换老依赖）
  - xxc/app/index.js（ReactDOM.render → createRoot）
  - xxc/app/components/display.js（ReactDOM.render → createRoot）
  - 29 处旧生命周期方法所在文件（加 UNSAFE_ 前缀或重写）
  - 6 处 react-chatview 使用文件 → react-virtuoso
  - 12 处 emojione 使用文件 → emoji-mart
  - 4 处 react-split-pane 使用文件 → react-resizable-panels
  - 2 处 ion-sound 使用文件 → HTML5 Audio
  - views/common/draft-editor.js（506 行，draft-js 临时锁 0.11 兼容 React 18，不替换为 Lexical）
  - 不改 Electron 版本（仍 4）
  - 不改 Platform 抽象层接口

Constraints:
  - 保留 110 个 class 组件，不改写为函数组件 / hooks
  - react-router-dom 若有 breaking，先评估能否留在 v4，不强制升级
  - draft-js 不替换为 Lexical（工作量过大），临时锁 draft-js@0.11 让它在 React 18 下先跑起来
  - 不改 core/network/ 下的协议和 socket 逻辑
  - 不动 mock server（Goal 1 的产物继续用）
  - 替换老依赖时，新库的 API 形状差异由调用方适配，不改 Platform 接口

Done when:
  1. `pnpm install` 成功，react/react-dom 为 18.x（package.json 里版本号确认）
  2. `pnpm dev` 启动，控制台无 React 18 deprecation warning（关于 ReactDOM.render / 旧生命周期）
  3. app/index.js 和 app/components/display.js 均使用 createRoot（grep 确认无 ReactDOM.render 残留）
  4. 旧生命周期方法全部加 UNSAFE_ 前缀或重写（grep 确认无裸 componentWill* 残留）
  5. react-chatview / emojione / emojione-picker / react-split-pane / ion-sound 从 package.json 移除，无残留 import
  6. 登录界面渲染与 Goal 1 截图一致（视觉对照）
  7. 连 mock server 后主界面渲染与 Goal 1 截图一致：聊天列表、会话切换、消息气泡、表情选择、分栏拖拽均可交互
  8. draft-js 编辑器（views/common/draft-editor.js）在 React 18 下能编辑文字不崩溃（临时方案可接受）

Stop if:
  - React 18 升级后，主界面与 Goal 1 截图出现大面积布局错乱（非个别组件，疑似全局样式失效）—— 排查 mzui less 与 React 18 兼容性
  - draft-js@0.11 在 React 18 下崩溃且无降级方案 —— 记录现象，可临时屏蔽 draft-editor 改用 textarea 占位
  - react-virtuoso / emoji-mart / react-resizable-panels 新依赖 pnpm install 失败 —— 记录错误，换备选库
  - 替换 react-chatview 后消息列表虚拟滚动行为与原版差异巨大（消息定位/加载更多失效）—— 记录差异，不强行修复，评估是否影响核心功能
  - 任何改动修改了 core/network/socket-message.js 或 mock server

Use a token budget of 150K tokens for this goal.
```

---

**关键设计选择**：
- First action 先 grep 出 29 处旧生命周期和老依赖使用清单的精确位置，避免遗漏
- draft-js 明确不替换（Lexical 迁移工作量过大），临时锁 0.11，降低本 goal 风险
- 验收项第 6-7 条用 Goal 1 截图做视觉回归对照，这是保留基线的核心价值
- Stop-if 覆盖了最大风险：React 18 全局样式失效、draft-js 崩溃、虚拟滚动行为差异
- 不改 Electron 和协议，边界清晰
