# Goal 2.2：ESLint 恢复 + 死配置清理

> **依赖**：Goal 2.1 完成（需要稳定的依赖基线，ESLint 需 lint 升级后的新 import 写法）
> **后续**：Goal 3 依赖本 goal 产出的 lint 把关能力
> **对应计划**：`doc/upgrade/xxc-upgrade-plan.md` 阶段 3 补充

## 为什么需要 Goal 2.2

1. **ESLint 已完全断裂**：`.eslintrc` 仍在 git 中但用的是 Babel 6 时代配置（`parser: "babel-eslint"`、`extends: "airbnb"`、`import/resolver: babel-module`），这些包在 Vite 迁移时全部被丢弃，`package.json` 无 eslint 相关 devDep 也无 lint 脚本。AGENTS.md 仍声明 `npm run eslint` 为必跑命令但该命令已失效。后续每个 goal 改代码都没有 lint 把关，需要在本 goal 恢复。
2. **死配置文件需清理**：`.babelrc`（Babel 6 预设，Vite 用 esbuild 已接管）、`tools/webpack.config.*.js`（7 个文件，Vite 已取代）、`tools/server.js`（webpack dev server，import 了待删的 webpack 配置，本身也是死文件）、`.eslintignore`（flat config 用 ignores 字段替代）均为遗留死文件，仍在 git 中造成误导。

## 框架级工具恢复

| 项目 | 现状 | 目标 | 要点 |
|------|------|------|------|
| ESLint | `.eslintrc` 用 Babel 6 配置，包全部丢失，无 lint 脚本 | ESLint 9 flat config | `eslint.config.mjs`，`@eslint/js` recommended + 各插件 recommended + 自定义规则保留项目约定 |
| airbnb 规则集 | `eslint-config-airbnb` 不支持 ESLint 9 flat config | 迁移为 @eslint/js + 各插件 recommended + 手动规则 | 旧 `.eslintrc` 有 55 条自定义 rules，迁移到 flat config 并叠加 `eslint-plugin-react/promise/jsx-a11y` 的 recommended 配置恢复大部分 airbnb 覆盖；保留 4 空格缩进、`object-curly-spacing: never` 等项目约定 |
| import resolver | `eslint-import-resolver-babel-module`（Babel 6 时代） | `eslint-import-resolver-vite` | 解析 Platform/Config/ExtsRuntime/ExtsView 别名 |
| `.babelrc` | Babel 6 预设，Vite 已用 esbuild 接管 | 删除 | 死文件 |
| `tools/webpack.config.*.js` | 7 个 webpack 配置文件 | 删除 | Vite 已取代 |
| `tools/server.js` | webpack dev server，import 待删的 webpack 配置 | 删除 | 与 webpack 配置同属一套死链路，不删会留悬空 import |
| `.eslintignore` | 旧 ignore 列表（实际含大量 gitignore 风格条目：logs/pids/*.log/.DS_Store 等约 20 项） | 合并到 flat config `ignores` 字段（只取 lint 相关项），删除文件 |
| `lint` 脚本 | 不存在 | `pnpm lint` + `pnpm lint:fix` | `eslint app/` |
| AGENTS.md | 仍写 `npm run eslint`、airbnb、`import/resolver` 与 webpack 共识别 | 同步更新为 `pnpm lint` + flat config + vite alias | 第 37/64/78/79 行 |

---

以下为可直接粘贴到 `/goal` 命令的完整内容：

---

```
/goal 恢复 xxc 客户端的 ESLint lint 能力（ESLint 9 flat config），清理遗留死配置文件（.babelrc / webpack configs / server.js / .eslintrc / .eslintignore），同步更新 AGENTS.md 的 lint 描述，使 pnpm lint 可执行且无因 Goal 2.1 依赖升级引入的 error。

First action: 读取以下文件并报告关键信息，等待确认后再动手：
- doc/upgrade/goal-2.1-deps-upgrade.md（Goal 2.1 升级了哪些依赖，lint 需适配新 import 写法）
- xxc/.eslintrc（旧 Babel 6 时代 eslint 配置，55 条 rules 需迁移到 flat config）
- xxc/.eslintignore（旧 ignore 列表，实际含大量 gitignore 风格条目，合并时只取 lint 相关项）
- xxc/.babelrc（Babel 6 预设，死文件待删除）
- xxc/tools/server.js（webpack dev server，import 待删的 webpack 配置，一并删除）
- xxc/vite.config.ts（确认 resolve.alias 配置，ESLint import resolver 需对应）
- AGENTS.md（第 37/64/78/79 行 lint 描述需同步更新）
- 运行 `grep -rn "webpack.config\|babelrc" xxc/ --include="*.js" --include="*.ts" --exclude-dir=node_modules` 报告死配置文件引用清单（预期命中：vite.config.ts 第 15 行注释含 .babelrc 字样属说明非引用可忽略；tools/server.js 第 15-16 行 import webpack.config.development 和 webpack.config.browser.development——server.js 本身也是死文件，一并删除）

Scope:
  - xxc/eslint.config.mjs（新建，ESLint 9 flat config）
  - xxc/package.json（devDependencies 补 eslint 相关包，scripts 加 lint / lint:fix）
  - xxc/pnpm-lock.yaml（pnpm install 自动更新）
  - AGENTS.md（更新 lint 命令与规则集描述）

  【ESLint flat config 创建】
  - 新建 xxc/eslint.config.mjs（ESLint 9 flat config）：
    - 基于 @eslint/js recommended + eslint-plugin-react recommended + eslint-plugin-promise recommended + eslint-plugin-jsx-a11y recommended + eslint-plugin-import recommended
    - 叠加各插件 recommended 恢复大部分 airbnb 规则覆盖
    - 从旧 .eslintrc 迁移全部 55 条自定义 rules（4 空格缩进、object-curly-spacing: never、JSX 允许 .js/.jsx、react/sort-comp 等），逐条迁移保留项目约定
    - import resolver 用 eslint-import-resolver-vite（解析 Platform/Config/ExtsRuntime/ExtsView 别名，对应 vite.config.ts 的 resolve.alias）
    - globals 用 globals 包声明 browser + node 环境，DEBUG/Pace 为自定义全局
    - ignores 字段只合并旧 .eslintignore 中 lint 相关项（node_modules、dist、release、main.js 等），丢弃 gitignore 风格条目（logs/pids/*.log/.DS_Store 等）
    - 旧配置有 parserOptions.allowImportExportEverywhere: true，flat config 默认用 espree 不支持此项；若代码中有嵌套 import/export 导致 espree 报错，引入 @babel/eslint-parser 或 typescript-eslint parser 作为兜底
  - 安装 devDependencies: eslint@9, @eslint/js, eslint-plugin-react, eslint-plugin-import, eslint-plugin-promise, eslint-plugin-jsx-a11y, eslint-plugin-compat, eslint-import-resolver-vite, globals
  - package.json scripts 加: `"lint": "eslint app/"`, `"lint:fix": "eslint app/ --fix"`

  【死配置清理】
  - 删除 xxc/.eslintrc（被 eslint.config.mjs 取代）
  - 删除 xxc/.eslintignore（被 flat config ignores 字段取代）
  - 删除 xxc/.babelrc（Vite 用 esbuild 接管，死文件）
  - 删除 xxc/tools/webpack.config.*.js（7 个文件，Vite 已取代 webpack）
  - 删除 xxc/tools/server.js（webpack dev server，import 待删的 webpack 配置，同属一套死链路）
  - build/package.js 暂不删除（Goal 4 会重写为 electron-builder 声明式配置，删除时机在 Goal 4）

  【AGENTS.md 同步更新】
  - 第 37 行：`npm run eslint` → `pnpm lint`（+ `pnpm lint:fix`），airbnb 规则集 → ESLint 9 flat config
  - 第 64 行：eslint `import/resolver` 与 webpack 共同识别 → eslint-import-resolver-vite 与 vite.config.ts 的 resolve.alias 共同识别
  - 第 78 行：airbnb 规则集 → ESLint 9 flat config（@eslint/js + react/promise/jsx-a11y recommended）；`npm run eslint` → `pnpm lint`
  - 第 79 行：lint 已声明 DEBUG 和 Pace 为全局 → flat config 用 globals 包声明（保留 DEBUG/Pace 全局）

  【lint 修复】
  - 运行 pnpm lint，修复因 Goal 2.1 依赖升级产生的 lint 错误（如新 import 写法、unused vars 等），不修复旧有遗留 warning（不在本 goal 范围）

  不改 Goal 2.1 已升级的依赖版本
  不改业务代码逻辑（只改 import 写法等 lint 相关修复）
  不动 mock server

Constraints:
  - ESLint 用 flat config（eslint.config.mjs），不保留旧 .eslintrc 格式；不引入 eslint-config-airbnb（不支持 ESLint 9 flat config）
  - 叠加各插件 recommended 配置（react/promise/jsx-a11y/import）恢复大部分 airbnb 覆盖，非仅 @eslint/js recommended
  - ESLint 规则迁移保留项目原有约定（4 空格、object-curly-spacing: never、JSX 允许 .js 等），不改编码风格
  - eslint-plugin-compat 的 compat/compat 规则需 browserslist 配置；若噪音过大可在 flat config 中关闭该单条规则（记录现象）
  - 删除死配置文件前确认无其他引用（grep 确认 .babelrc / webpack configs / server.js 不被 vite.config.ts 或其他脚本引用，注释中的 .babelrc 字样可忽略）
  - 依赖管理必须用 pnpm 命令（在 xxc/ 目录下执行 pnpm add），不手动编辑 package.json devDependencies 字段
  - AGENTS.md 更新只改 lint/别名 相关描述，不改其他章节
  - pnpm lint 的目标是「lint 能跑通 + 依赖升级引入的 lint 错误为 0」，不要求修复全部历史遗留 warning（历史 warning 数量可能很大，超出本 goal 预算）

Done when:
  1. xxc/eslint.config.mjs 存在，pnpm lint 可执行（不崩溃、不报配置错误）
  2. grep 确认 xxc/ 下无 .eslintrc、.eslintignore、.babelrc 文件（已删除）
  3. grep 确认 xxc/tools/ 下无 webpack.config.*.js 和 server.js（已删除）
  4. pnpm lint 输出中无因依赖升级引入的 error（如新 import 写法、解析失败）；历史遗留 warning 可存在但不阻塞
  5. package.json scripts 中有 lint 和 lint:fix 命令
  6. package.json devDependencies 中有 eslint@9, @eslint/js, eslint-plugin-react, eslint-plugin-import, eslint-plugin-promise, eslint-plugin-jsx-a11y, eslint-plugin-compat, eslint-import-resolver-vite, globals
  7. AGENTS.md 中 grep 确认无 `npm run eslint`、无 `airbnb` 残留（第 37/64/78/79 行已更新为 pnpm lint + flat config + vite alias）

Stop if:
  - ESLint flat config 迁移后历史遗留 warning 数量巨大（数百条以上），修复工作量超出预算 —— 只修复因依赖升级引入的 error，历史 warning 记录数量但不批量修复
  - eslint-import-resolver-vite 无法解析 vite.config.ts 中的别名 —— 改用手动 settings.import/resolver.paths 配置，或退而用 eslint-plugin-import 的 import/no-unresolved: off
  - eslint-plugin-compat 的 compat/compat 规则因缺少 browserslist 配置产生大量噪音 —— 关闭该单条规则，记录现象

Use a token budget of 120K tokens for this goal.
```

---

**关键设计选择**：
- **ESLint 选 ESLint 9 flat config 而非 ESLint 10**：ESLint 9 插件生态最成熟稳定（eslint-plugin-react@7.37.5、eslint-plugin-import@2.32.0 的 peerDeps 均含 `^9` 但不含 10）；放弃 eslint-config-airbnb（peerDeps 仅 `^7.32 || ^8.2`，不支持 flat config），改为 @eslint/js recommended + 各插件 recommended + 手动迁移项目原有 55 条 rules，保留编码约定不变
- **叠加各插件 recommended 而非仅 @eslint/js recommended**：airbnb 原本强制数百条规则，仅用 @eslint/js recommended（约 50 条）会大幅降低把关能力，与 Goal 3"依赖 lint 把关"的定位冲突。叠加 react/promise/jsx-a11y/import 各插件的 recommended 配置，在 flat config 原生支持下恢复大部分 airbnb 覆盖，工作量增加有限
- **补装旧配置隐式引入的 3 个插件**：旧 .eslintrc 有 10 条 rules 依赖 eslint-plugin-promise（4 条）、eslint-plugin-jsx-a11y（5 条）、eslint-plugin-compat（1 条），这些靠 `extends: airbnb` 隐式带入；放弃 airbnb 后必须显式安装，否则 flat config 报 `Definition for rule 'xxx' was not found`
- **死配置清理只删确定无引用的文件**：.babelrc / .eslintignore / .eslintrc / tools/webpack.config.*.js / tools/server.js 直接删；build/package.js 留到 Goal 4 重写后再删
- **AGENTS.md 同步更新**：恢复 lint 的同时更新 AGENTS.md 第 37/64/78/79 行（npm run eslint → pnpm lint、airbnb → flat config + 各插件 recommended、import/resolver → eslint-import-resolver-vite + vite alias），否则文档与实际工具链再次脱节
- **lint 目标务实**：只要求「能跑通 + 依赖升级引入的 error 归零」，不要求修复全部历史遗留 warning（可能数百条，超出预算）
- **拆分为独立 goal**：ESLint 恢复 + 死配置清理是纯工具链工作（无运行时回归风险），与 Goal 2.1 的依赖升级（有运行时回归风险、需逐功能验证）性质不同，拆分后各自验证链路清晰
