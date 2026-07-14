# Goal 2.1：前端依赖批量升级 + ESLint 恢复 + 死配置清理

> **依赖**：Goal 2 完成（需要 React 18 + 浏览器基线 + mock server 作为验证环境）
> **后续**：Goal 2.2（测试框架）和 Goal 3 依赖本 goal 产出的稳定依赖基线
> **对应计划**：`doc/upgrade/xxc-upgrade-plan.md` 阶段 3 补充

## 为什么插在 Goal 3 之前（goal-2.1）

1. **验证环境已就绪**：Goal 2 产出了浏览器基线 + mock server，依赖升级可在浏览器端完整验证（登录 → 主界面 → Markdown 渲染 → 拼音搜索 → 剪贴板 → 快捷键 → 路由跳转），不需要 Electron。
2. **隔离两类回归**：Goal 3 要重写 `platform/electron/crypto.js`、`socket.js`、`index.js`，如果同时升依赖，dep 升级的回归和 Electron 安全模型的回归会交织。先升依赖、稳住基线，Goal 3 只面对安全模型问题。
3. **uuid 深路径导入已存隐患**：`platform/electron/ui.js` 和 `exts/manager.js` 用 `import uuid from 'uuid/v4'`，uuid v7+ 已移除此路径。Goal 3 会触碰 `electron/` 目录，先修掉避免交叉。
4. **external-api.js 依赖重导出需先行稳定**：`exts/external-api.js` 向扩展暴露 marked/uuid/compareVersions/hotkeys/pinyin/md5 等模块，Goal 3 可能临时禁用 exts，先把这些 re-export 的 API 形状固定下来。
5. **ESLint 已完全断裂**：`.eslintrc` 仍在 git 中但用的是 Babel 6 时代配置（`parser: "babel-eslint"`、`extends: "airbnb"`、`import/resolver: babel-module`），这些包在 Vite 迁移时全部被丢弃，`package.json` 无 eslint 相关 devDep 也无 lint 脚本。AGENTS.md 仍声明 `npm run eslint` 为必跑命令但该命令已失效。后续每个 goal 改代码都没有 lint 把关，需要在本 goal 恢复。
6. **死配置文件需清理**：`.babelrc`（Babel 6 预设，Vite 用 esbuild 已接管）、`tools/webpack.config.*.js`（7 个文件，Vite 已取代）、`.eslintignore`（flat config 用 ignores 字段替代）均为遗留死文件，仍在 git 中造成误导。

## 依赖升级总览

| 依赖 | 当前 → 目标 | 风险 | 使用文件数 | 迁移要点 |
|------|------------|------|-----------|---------|
| uuid | 3.1.0 → 14.x | 低 | 4 | `uuid/v4` 深路径 → named `{v4}` |
| compare-versions | 3.1.0 → 6.x | 低 | 3 | 纯 ESM，API 不变 |
| md5 | 2.2.1 → 2.3.0 | 低 | 6 | patch |
| aes-js | 3.1.0 → 3.1.2 | 低 | 1 | patch |
| prop-types | 15.6.2 → 15.8.1 | 低 | 全局 | minor |
| remove-markdown | 0.3.0 → 0.6.x | 低 | 1 | API 兼容 |
| wolfy87-eventemitter | 5.2.2 → 5.2.9 | 低 | 1 | patch（库已归档但稳定） |
| less | 3.13.0 → 4.x | 低 | devDep | 验证 mzui less 编译 |
| highlight.js | 9.9.0 → 11.x | 中 | 1 | 验证 `highlightAuto` 导入与返回值 |
| dexie | 2.0.4 → 4.x | 中 | 1 | 验证 `Dexie.exists` / `new Dexie` / stores API |
| pinyin | 2.8.3 → 4.x | 中 | 5 | 验证 `STYLE_NORMAL` 等常量是否保留 |
| hotkeys-js | 3.3.5 → 4.x | 中 | 3 | 验证 `hotkeys()` / `setScope` / `deleteScope` |
| clipboard-polyfill | 2.7.0 → 移除 | 中 | 1 | `clipboard.DT()` → 原生 `navigator.clipboard` |
| react-router-dom | 4.3.1 → 5.3.4 | 低 | 6 | v5 与 v4 API 几乎一致（Switch/Route component=/Redirect/Link/NavLink/withRouter 均保留），改动极小 |
| marked | 0.4.0 → 18.x | 高 | 2 | 14 个大版本跨度：renderer.code 签名变、sanitize/sanitizer 选项移除、setOptions→use、headerIds 移除 |

> **react-router-dom 选择 v5 而非 v6**：v5 是 v4 的平滑升级（API 几乎零改动，class 组件无需 withRouter 兼容 HOC，无 Switch→Routes / component→element / Redirect→Navigate 迁移）。v6 的 hooks 化路由对 110 个 class 组件不友好，当前不值得为路由升一个大版本付出那么大迁移成本。
> **marked 降级方案**：若 v18 API 变化无法在预算内修复，临时锁定到中间兼容版本（如 v9）。

## 框架级工具恢复

| 项目 | 现状 | 目标 | 要点 |
|------|------|------|------|
| ESLint | `.eslintrc` 用 Babel 6 配置，包全部丢失，无 lint 脚本 | ESLint 9 flat config | `eslint.config.mjs`，`@eslint/js` recommended + `eslint-plugin-react` + 自定义规则保留项目约定 |
| airbnb 规则集 | `eslint-config-airbnb` 不支持 ESLint 9 flat config | 迁移为 `@eslint/js` recommended + 手动规则 | 将 `.eslintrc` 的 60+ 条 rules 逐条迁移到 flat config，保留 4 空格缩进、`object-curly-spacing: never` 等项目约定 |
| import resolver | `eslint-import-resolver-babel-module`（Babel 6 时代） | `eslint-import-resolver-vite` | 解析 Platform/Config/ExtsRuntime/ExtsView 别名 |
| `.babelrc` | Babel 6 预设，Vite 已用 esbuild 接管 | 删除 | 死文件 |
| `tools/webpack.config.*.js` | 7 个 webpack 配置文件 | 删除 | Vite 已取代 |
| `.eslintignore` | 旧 ignore 列表 | 合并到 flat config `ignores` 字段，删除文件 |
| `lint` 脚本 | 不存在 | `pnpm lint` + `pnpm lint:fix` | `eslint app/ --fix` |

---

以下为可直接粘贴到 `/goal` 命令的完整内容：

---

```
/goal 将 xxc 客户端的前端依赖批量升级到现代版本，覆盖 router、markdown、数据库、拼音、快捷键、剪贴板、UUID、版本比较、代码高亮等全部落后依赖，使主界面在浏览器基线下行为与 Goal 2 截图基线一致。

First action: 读取以下文件并报告关键信息，等待确认后再动手：
- doc/upgrade/xxc-upgrade-plan.md（重点看「老依赖替换清单」）
- doc/upgrade/goal-2-react18.md（Goal 2 的约束与已替换项，避免重复）
- doc/upgrade/screenshots/（Goal 2 截图基线，回归对照）
- xxc/app/exts/external-api.js（扩展 API 重导出层，所有第三方依赖的集中暴露点）
- xxc/app/utils/markdown.js（marked + highlight.js 重度使用，迁移风险最高）
- xxc/app/utils/pinyin.js（pinyin 包装层）
- xxc/app/views/index/index.js（react-router 顶层路由）
- xxc/app/views/chats/index.js（react-router render props + props.match.url）
- xxc/app/views/main/index.js（react-router render props + props.match.url）
- xxc/app/core/db/database.js（dexie 使用）
- xxc/app/platform/browser/clipboard.js（clipboard-polyfill 使用）
- xxc/app/core/server/index.js（compare-versions 重度使用，登录版本检查）
- 运行 `grep -rn "from 'uuid/v4'\|from 'uuid'" xxc/app --include="*.js" | grep -v node_modules` 报告 uuid 导入清单
- 运行 `grep -rn "react-router\|Route\|Switch\|Redirect\|NavLink\|props\.match\|props\.history\|props\.location\|withRouter" xxc/app --include="*.js" | grep -v node_modules` 报告路由 API 使用清单
- 运行 `grep -rn "from 'marked'" xxc/app --include="*.js" | grep -v node_modules` 报告 marked 使用文件
- 运行 `grep -rn "from 'compare-versions'\|from 'highlight.js'\|from 'dexie'\|from 'pinyin'\|from 'hotkeys-js'\|from 'clipboard-polyfill'\|from 'remove-markdown'\|from 'md5'\|from 'aes-js'\|from 'wolfy87-eventemitter'\|from 'prop-types'" xxc/app --include="*.js" | grep -v node_modules` 报告全部目标依赖导入清单
- 读取 xxc/.eslintrc（旧 Babel 6 时代 eslint 配置，60+ 条 rules 需迁移到 flat config）
- 读取 xxc/.babelrc（Babel 6 预设，死文件待删除）
- 运行 `ls xxc/tools/webpack.config.*.js` 报告遗留 webpack 配置文件清单（待删除）

Scope:
  - xxc/package.json（所有目标依赖升版本，移除 clipboard-polyfill，补 extract-zip）
  - xxc/pnpm-lock.yaml（pnpm install 自动更新）

  【第一批：patch / minor，无 breaking】
  - md5 2.2.1 → 2.3.0（6 文件：core/network/socket.js, core/models/file-data.js, core/profile/user.js, core/profile/user-config.js, core/im/im-chats.js, exts/external-api.js）
  - aes-js 3.1.0 → 3.1.2（platform/browser/crypto.js）
  - prop-types 15.6.2 → 15.8.1（全局，无代码改动）
  - remove-markdown 0.3.0 → 0.6.x（core/todo/index.js，API 兼容）
  - wolfy87-eventemitter 5.2.2 → 5.2.9（core/events.js 底层，patch）
  - less 3.13.0 → 4.x（devDep，验证 mzui 72 个 less 文件编译）

  【第二批：ESM 化，import 路径变更】
  - uuid 3.1.0 → 14.x（4 文件）：
    - app/core/models/file-data.js: `import UUID from 'uuid'` + `UUID()` → `import {v4 as UUID} from 'uuid'` + `UUID()`
    - app/exts/external-api.js: `import uuid from 'uuid'` → `import {v4 as uuid} from 'uuid'`，nodeModules.uuid 改为函数引用
    - app/exts/manager.js: `import uuid from 'uuid/v4'` → `import {v4 as uuid} from 'uuid'`
    - app/platform/electron/ui.js: `import uuid from 'uuid/v4'` → `import {v4 as uuid} from 'uuid'`（浏览器基线下不加载但需修复 import）
  - compare-versions 3.1.0 → 6.x（3 文件：core/server/index.js, exts/manager.js, exts/external-api.js，纯 ESM，默认导出 API 不变）

  【第三批：API 变更，需逐个验证】
  - highlight.js 9.9.0 → 11.x（1 文件 utils/markdown.js）：
    - 验证 `import HighlightJS from 'highlight.js'` 导入路径
    - 验证 `HighlightJS.highlightAuto(code, langArray)` 返回值结构（{language, value}）
  - dexie 2.0.4 → 4.x（1 文件 core/db/database.js）：
    - 验证 `new Dexie(name)`、`Dexie.exists(name)`、`db.version(n).stores({...})` API
    - 验证 entity-schema.js 中 Dexie 表格式字符串兼容性
  - pinyin 2.8.3 → 4.x（utils/pinyin.js 包装层 + exts/external-api.js）：
    - 验证 `PinYin.STYLE_NORMAL`、`PinYin.STYLE_FIRST_LETTER`、`PinYin.STYLE_INITIALS` 常量是否保留
    - 验证 `PinYin(str, {style})` 调用签名
  - hotkeys-js 3.3.5 → 4.x（3 文件 + exts/external-api.js）：
    - app/components/image-cutter.js: `hotkeys(key, scope, handler)`、`hotkeys.setScope`、`hotkeys.deleteScope`
    - app/components/input-control.js
    - app/components/display-layer.js（间接使用，验证）
  - clipboard-polyfill 2.7.0 → 移除（1 文件 platform/browser/clipboard.js）：
    - `clipboard.writeText` → `navigator.clipboard.writeText`
    - `new clipboard.DT()` + `clipboard.write(dt)` → `navigator.clipboard.write([new ClipboardItem({...})])`
    - 从 package.json 移除 clipboard-polyfill

  【第四批：高风险，API 大版本跨度】
  - marked 0.4.0 → 18.x（2 文件：utils/markdown.js, exts/external-api.js）：
    - `new Marked.Renderer()` → 确认 v18 创建 renderer 的方式（marked.Renderer 或 new Renderer）
    - `renderer.code = (code, lang) => {}` → v18 签名变更（确认是 (code, infoString) 还是 ({text, lang})）
    - `sanitize: true` + `sanitizer: fn` 选项已移除 → 改为对 marked.parse() 输出做后置过滤（复用现有 sanitizer 函数）
    - `Marked.setOptions({...})` → `marked.setOptions()` 或 `marked.use()`，部分选项（headerIds）已移除需用 extension 替代
    - `Marked(string)` → `marked.parse(string)`
    - 不引入 DOMPurify，复用现有 sanitizer 逻辑做后置过滤
  - react-router-dom 4.3.1 → 5.3.4（6 文件，v5 与 v4 API 几乎一致，改动极小）：
    - app/views/index/index.js: 验证 HashRouter/Route/Switch 兼容（v5 无 breaking）
    - app/views/chats/index.js: 验证 Route render props + props.match.url 兼容
    - app/views/main/index.js: 同上
    - app/views/main/navbar.js: 验证 Route/Link 兼容
    - app/views/chats/chat-list-item.js: 验证 Link 兼容
    - app/views/exts/index.js: 验证 NavLink/Redirect 兼容
    - 若编译/运行时有 deprecation warning，按 v5 文档调整（v5 对部分 v4 用法有 console.warn 但仍工作）

  【收尾：补依赖 + 适配层】
  - extract-zip: 补到 package.json dependencies（exts/ 3 文件使用：manager.js, external-api.js, server/index.js；浏览器基线下被 stub 不加载，为 Goal 3/4 恢复 exts 预备）
  - app/exts/external-api.js: 所有 nodeModules 重导出更新为新 API 形状（uuid → {v4}，marked → 新 API，etc.）
  - app/exts/external-api.js: `__non_webpack_require__('jquery')` → 评估 Vite 下替代方案（exts stub 下可能不触发，记录现象即可，不阻塞）

  【第五批：ESLint 恢复 + 死配置清理】
  - 新建 xxc/eslint.config.mjs（ESLint 9 flat config）：
    - 基于 @eslint/js recommended + eslint-plugin-react
    - 从旧 .eslintrc 迁移全部自定义 rules（4 空格缩进、object-curly-spacing: never、JSX 允许 .js/.jsx、react/sort-comp 等 60+ 条）
    - import resolver 用 eslint-import-resolver-vite（解析 Platform/Config/ExtsRuntime/ExtsView 别名，对应 vite.config.ts 的 resolve.alias）
    - globals 用 globals 包声明 browser + node 环境，DEBUG/Pace 为自定义全局
    - ignores 字段合并旧 .eslintignore 内容（node_modules、dist、release、main.js 等）
  - 安装 devDependencies: eslint@9, @eslint/js, eslint-plugin-react, eslint-plugin-import, eslint-import-resolver-vite, globals
  - package.json scripts 加: `"lint": "eslint app/"`, `"lint:fix": "eslint app/ --fix"`
  - 删除 xxc/.eslintrc（被 eslint.config.mjs 取代）
  - 删除 xxc/.eslintignore（被 flat config ignores 字段取代）
  - 删除 xxc/.babelrc（Vite 用 esbuild 接管，死文件）
  - 删除 xxc/tools/webpack.config.*.js（7 个文件，Vite 已取代 webpack）
  - build/package.js 暂不删除（Goal 4 会重写为 electron-builder 声明式配置，删除时机在 Goal 4）
  - 运行 pnpm lint，修复因依赖升级产生的 lint 错误（如新 import 写法、unused vars 等），不修复旧有遗留 warning（不在本 goal 范围）

  不改 React 版本（18）
  不改 Platform 抽象层接口
  不改 core/network/socket-message.js 协议
  不动 mock server
  不改 platform/electron/crypto.js 和 platform/electron/socket.js 的功能逻辑（这两个文件 Goal 3 会重写，本 goal 只修 uuid import 等不涉及功能的导入变更）

Constraints:
  - 保留 110 个 class 组件，不改写为函数组件 / hooks
  - react-router-dom v5 与 v4 API 几乎一致，保留 class 组件（Switch/Route component=/Redirect/Link/NavLink/withRouter 均兼容），无需写 withRouter 兼容 HOC
  - marked v18 的 sanitize 移除后，复用现有 sanitizer 函数对输出 HTML 做后置过滤，不引入 DOMPurify（减少新依赖）
  - clipboard-polyfill 移除后用 navigator.clipboard 原生 API，浏览器基线（Chromium）完全支持
  - 每个依赖升级后单独验证对应功能点，不要一次性全改后才发现问题
  - 依赖管理必须用 pnpm 命令（在 xxc/ 目录下执行 pnpm add / pnpm remove），不手动编辑 package.json dependencies / devDependencies 字段
  - 升级顺序严格按四批递进：patch/minor → ESM → API 变更 → 高风险（marked/router），每批验证通过后再进下一批
  - ESLint 用 flat config（eslint.config.mjs），不保留旧 .eslintrc 格式；不引入 eslint-config-airbnb（不支持 ESLint 9 flat config）
  - ESLint 规则迁移保留项目原有约定（4 空格、object-curly-spacing: never、JSX 允许 .js 等），不改编码风格
  - 删除死配置文件前确认无其他引用（grep 确认 .babelrc / webpack configs 不被 vite.config.ts 或其他脚本引用）
  - pnpm lint 的目标是「lint 能跑通 + 依赖升级引入的 lint 错误为 0」，不要求修复全部历史遗留 warning（历史 warning 数量可能很大，超出本 goal 预算）

Done when:
  1. pnpm install 成功，package.json 中所有目标依赖版本号符合本 goal 指定
  2. clipboard-polyfill 从 package.json 移除，grep 确认 app/ 下无 clipboard-polyfill import 残留
  3. extract-zip 在 package.json dependencies 中
  4. grep 确认 app/ 下无 `from 'uuid/v4'` 深路径导入
  5. pnpm dev 启动，控制台无依赖相关的 import 错误或 warning
  6. 登录界面渲染与 Goal 2 截图一致
  7. 连 mock server 后主界面渲染与 Goal 2 截图一致：聊天列表、会话切换、消息气泡均可交互
  8. Markdown 消息渲染正确：代码高亮（highlight.js 颜色生效）、代码块文件名解析、HTML 过滤（sanitizer 后置过滤生效，无 XSS 漏洞）
  9. 聊天列表拼音搜索正常（输入拼音首字母能匹配到联系人）
  10. 快捷键功能正常（image-cutter 的 esc/enter 触发、input-control 快捷键录入）
  11. 剪贴板复制正常（复制消息文本、复制代码块内容到系统剪贴板）
  12. 路由跳转正常：会话切换时 URL hash 变化、navbar 链接跳转、image-cutter 路由参数（:file）正确解析
  13. 版本比较逻辑正常（登录时 serverVersion 检查不报错，功能开关正确判断）
  14. 本地数据库正常（dexie 升级后消息历史可读写，无 IndexedDB schema 报错）
  15. UUID 生成正常（file-data gid 生成不报错，消息可发送）
  16. external-api.js 的 nodeModules 所有重导出与新 API 形状一致（uuid 为函数、marked 为新 API）
  17. 截图留存到 doc/upgrade/screenshots/（依赖升级后的主界面 + Markdown 渲染 + 拼音搜索）
  18. xxc/eslint.config.mjs 存在，pnpm lint 可执行（不崩溃、不报配置错误）
  19. grep 确认 xxc/ 下无 .eslintrc、.eslintignore、.babelrc 文件（已删除）
  20. grep 确认 xxc/tools/ 下无 webpack.config.*.js 文件（已删除）
  21. pnpm lint 输出中无因依赖升级引入的 error（如新 import 写法、解析失败）；历史遗留 warning 可存在但不阻塞
  22. package.json scripts 中有 lint 和 lint:fix 命令

Stop if:
  - marked v18 API 变化导致 Markdown 渲染无法在预算内修复（renderer.code 签名、sanitize 移除、headerIds 移除）—— 临时锁定 marked 到中间兼容版本（如 v9），记录现象，不阻塞其他依赖升级
  - react-router-dom v5 升级后路由行为异常（页面白屏、URL 不更新、props.match 为空）—— 对照 v5 changelog 排查，若为 v5 已知 breaking 则调整用法，否则回退 v4.3.1
  - pinyin v4 移除 STYLE_NORMAL / STYLE_FIRST_LETTER / STYLE_INITIALS 常量且无替代映射 —— 临时锁定 pinyin v3，记录现象
  - dexie v4 升级后 IndexedDB schema 不兼容导致数据库打不开 —— 临时锁定 dexie v3，记录现象
  - hotkeys-js v4 API 变化导致快捷键失效且无法适配 —— 临时锁定 hotkeys-js v3
  - 任何依赖升级导致主界面无法渲染（大面积白屏或 JS 崩溃）—— 回退该依赖到原版本，继续其他依赖
  - 任何改动修改了 core/network/socket-message.js 或 mock server
  - ESLint flat config 迁移后历史遗留 warning 数量巨大（数百条以上），修复工作量超出预算 —— 只修复因依赖升级引入的 error，历史 warning 记录数量但不批量修复
  - eslint-import-resolver-vite 无法解析 vite.config.ts 中的别名 —— 改用手动 settings.import/resolver.paths 配置，或退而用 eslint-plugin-import 的 import/no-unresolved: off

Use a token budget of 200K tokens for this goal.
```

---

**关键设计选择**：
- **插在 Goal 2 和 Goal 3 之间**：依赖升级在浏览器基线验证，不碰 Electron，为 Goal 3 提供干净基线，避免两类回归交织
- **react-router-dom 选择 v5.3.4**：v5 是 v4 的平滑升级，API 几乎零改动（Switch/Route component=/Redirect/Link/NavLink/withRouter 全部保留），110 个 class 组件无需 withRouter 兼容 HOC。v6 的 hooks 化路由对 class 组件不友好，当前不值得为此付出迁移成本
- **marked 是最高风险项**：14 个大版本跨度，sanitize 机制移除需重构 sanitization 流程（后置过滤而非选项传入）；Stop-if 允许临时锁中间版本
- **clipboard-polyfill 直接移除而非升级**：现代浏览器原生 navigator.clipboard 完全够用，减少一个废弃依赖
- **升级顺序按风险递增分四批**：patch/minor → ESM → API 变更 → 高风险（marked/router），每批验证通过后再进下一批，定位问题范围最小化
- **extract-zip 补到 package.json**：虽然浏览器基线下 exts 被 stub，但为 Goal 3/4 恢复 exts 预备，避免到时候缺依赖
- **Stop-if 对每个高风险依赖都有独立的降级方案**（临时锁定或降级版本），不因单个依赖阻塞全局
- **不引入 DOMPurify**：marked 的 sanitize 移除后复用现有 sanitizer 函数做后置过滤，减少新依赖
- **ESLint 选 ESLint 9 flat config 而非 ESLint 10**：ESLint 9 插件生态最成熟稳定；放弃 eslint-config-airbnb（不支持 flat config），改为 @eslint/js recommended + 手动迁移项目原有 60+ 条 rules，保留编码约定不变
- **死配置清理只删确定无引用的文件**：.babelrc / .eslintignore / .eslintrc / tools/webpack.config.*.js 直接删；build/package.js 留到 Goal 4 重写后再删
- **lint 目标务实**：只要求「能跑通 + 依赖升级引入的 error 归零」，不要求修复全部历史遗留 warning（可能数百条，超出预算）
