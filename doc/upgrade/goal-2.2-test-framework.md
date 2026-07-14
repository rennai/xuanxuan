# Goal 2.2：测试框架引入（vitest + Playwright E2E）

> **依赖**：Goal 2.1 完成（需要稳定的依赖基线 + ESLint 把关 + 浏览器开发基线 + mock server）
> **后续**：Goal 3 依赖本 goal 产出的测试基线做回归验证
> **对应计划**：`doc/upgrade/xxc-upgrade-plan.md` 阶段 3 补充

## 为什么单独成 goal

项目历史上**零测试文件**，没有测试基线。从零引入测试框架需要：
- 搭建 vitest 单元测试环境（纯函数 / 工具函数层）
- 搭建 Playwright E2E 测试环境（基于现有 mock server + 浏览器基线）
- 编写第一批冒烟测试作为后续 goal 的回归基线

这项工作与依赖升级性质不同（一个是修旧、一个是建新），放在 Goal 2.1 之后可以让测试跑在稳定依赖上，放在 Goal 3 之前可以为 Electron 安全模型迁移提供自动化回归验证。

## 测试策略

| 层级 | 工具 | 覆盖范围 | 理由 |
|------|------|---------|------|
| 单元测试 | vitest | `app/utils/`、`app/core/` 纯函数模块（markdown、pinyin、store、compare-versions 等） | 无 React 依赖，可独立测试，快速反馈 |
| E2E 测试 | Playwright | 登录流程、主界面渲染、聊天列表、消息收发、路由跳转 | 基于 Goal 1 的 mock server + 浏览器基线，端到端验证核心路径 |
| 组件测试 | 暂不引入 | — | 110 个 class 组件 + 无测试基线，组件测试 ROI 低，留到后续 |

---

以下为可直接粘贴到 `/goal` 命令的完整内容：

---

```
/goal 为 xxc 客户端从零引入测试框架：vitest 做单元测试（纯函数 / 工具函数层），Playwright 做 E2E 测试（基于现有 mock server + 浏览器基线），编写第一批冒烟测试作为后续 goal 的回归基线。

First action: 读取以下文件并报告关键信息，等待确认后再动手：
- doc/upgrade/goal-2.1-deps-upgrade.md（确认依赖基线和 ESLint 已就绪）
- doc/upgrade/screenshots/（Goal 2 截图基线，E2E 测试的视觉参考）
- xxc/mock-server/index.mjs（mock server 结构，E2E 测试需要启动它）
- xxc/mock-server/screenshot.mjs（现有 Playwright 截图脚本，可复用浏览器启动逻辑）
- xxc/vite.config.ts（Vite 配置，vitest 可复用 resolve.alias）
- xxc/app/utils/markdown.js（单元测试目标：marked 渲染 + sanitizer 过滤）
- xxc/app/utils/pinyin.js（单元测试目标：拼音转换）
- xxc/app/utils/store.js（单元测试目标：localStorage 包装）
- xxc/app/utils/html-helper.js（单元测试目标：HTML 工具函数）
- 运行 `grep -rn "export function\|export const\|export default function" xxc/app/utils --include="*.js" | grep -v node_modules` 报告 utils 下可测试的纯函数清单
- 运行 `cat xxc/package.json | node -e "const p=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('scripts:', JSON.stringify(p.scripts)); console.log('devDeps:', JSON.stringify(p.devDependencies))"` 报告当前脚本和 devDeps

Scope:
  - xxc/package.json（加 devDependencies: vitest, @playwright/test 已装；加 scripts: test, test:unit, test:e2e）
  - xxc/vitest.config.ts（新建，复用 vite.config.ts 的 resolve.alias，test.environment 为 jsdom 用于 localStorage/DOM）
  - xxc/playwright.config.ts（新建，baseURL 指向 Vite dev server，webServer 自动启动 mock server）
  - xxc/app/utils/__tests__/markdown.test.js（marked 渲染、代码高亮、sanitizer 过滤、allowedTags 白名单）
  - xxc/app/utils/__tests__/pinyin.test.js（拼音转换、风格常量、分隔符）
  - xxc/app/utils/__tests__/store.test.js（localStorage 序列化/反序列化、get/set/remove/clear）
  - xxc/app/utils/__tests__/html-helper.test.js（strip、escape 等工具函数）
  - xxc/tests/e2e/login.spec.js（登录界面渲染、表单交互、连 mock server 登录成功进入主界面）
  - xxc/tests/e2e/main-view.spec.js（主界面渲染：聊天列表非空、会话切换、消息可见、路由 hash 变化）
  - xxc/tests/e2e/helpers/mock-server.mjs（E2E 测试启动/停止 mock server 的辅助模块，复用 mock-server/index.mjs）

  不改 React 版本（18）
  不改现有业务代码（只加测试文件和配置）
  不改 Platform 抽象层接口
  不改 mock server 协议

Constraints:
  - 单元测试只覆盖纯函数模块（utils/），不测 React 组件（110 个 class 组件无测试基线，组件测试 ROI 低）
  - E2E 测试基于浏览器基线（Vite dev server + mock server），不测 Electron
  - vitest 复用 vite.config.ts 的 resolve.alias（Platform/Config 等），不重复维护别名
  - E2E 测试的 webServer 配置自动启动 Vite dev server 和 mock server，测试结束自动关闭
  - 测试文件放在对应模块的 __tests__/ 目录（单元测试）或 tests/e2e/ 目录（E2E），不污染 app/ 源码目录结构
  - 不引入 @testing-library/react（组件测试留到后续）
  - 不追求高覆盖率，第一批只写冒烟测试（核心路径能跑通即可），为后续 goal 提供回归基线
  - 依赖管理必须用 pnpm 命令，不手动编辑 package.json

Done when:
  1. pnpm install 成功，package.json devDependencies 含 vitest、@playwright/test
  2. package.json scripts 含 test、test:unit、test:e2e
  3. xxc/vitest.config.ts 存在，resolve.alias 与 vite.config.ts 一致
  4. xxc/playwright.config.ts 存在，webServer 配置能自动启动 Vite + mock server
  5. pnpm test:unit 成功运行，至少 4 个测试文件（markdown、pinyin、store、html-helper）全部通过
  6. pnpm test:e2e 成功运行，至少 2 个 spec 文件（login、main-view）全部通过
  7. E2E 测试覆盖核心路径：登录界面渲染 → 表单填写 → 连 mock 登录成功 → 主界面渲染（聊天列表、消息、路由）
  8. pnpm test（跑全部测试）成功通过，无失败
  9. pnpm lint 通过（测试文件也符合 ESLint 规则）

Stop if:
  - vitest 无法复用 vite.config.ts 的 resolve.alias（Platform 等别名解析失败）—— 改为在 vitest.config.ts 中显式声明 alias，不依赖 vite.config.ts
  - Playwright E2E 测试启动 Vite + mock server 后登录流程走不通（mock server 协议不匹配）—— 先确认 mock-server/index.mjs 是否能独立运行，排查环境问题
  - jsdom 环境下 localStorage / DOM API 不完整导致 store.test.js 失败 —— 改用 happy-dom 或跳过依赖完整 DOM 的用例
  - 任何改动修改了现有业务代码或 mock server 协议

Use a token budget of 150K tokens for this goal.
```

---

**关键设计选择**：
- **vitest 而非 jest**：vitest 与 Vite 原生集成，复用 vite.config.ts 的 alias 和 transform，零额外配置；jest 需要单独配 Babel/transform，与 Vite 生态割裂
- **单元测试只覆盖 utils/ 纯函数**：项目无测试基线，先从 ROI 最高的纯函数层开始；110 个 class 组件的组件测试留到后续
- **E2E 基于浏览器基线而非 Electron**：复用 Goal 1 的 mock server + Vite dev server，端到端验证核心路径；Electron E2E 留到 Goal 4
- **playwright.config.ts 的 webServer 自动管理**：测试启动时自动拉起 Vite + mock server，结束时自动关闭，CI 友好
- **不追求高覆盖率**：第一批只写冒烟测试（登录 + 主界面 + 核心工具函数），目标是为 Goal 3+ 提供回归基线，不是补全测试债
- **测试文件不污染 app/ 源码目录**：单元测试放 `__tests__/`，E2E 放 `tests/e2e/`，保持源码目录干净
