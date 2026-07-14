# Goal 2.1：前端依赖批量升级

> **依赖**：Goal 2 完成（需要 React 18 + 浏览器基线 + mock server 作为验证环境）
> **后续**：Goal 2.2（ESLint 恢复 + 死配置清理）依赖本 goal 产出的稳定依赖基线；Goal 3 依赖本 goal + Goal 2.2
> **对应计划**：`doc/upgrade/xxc-upgrade-plan.md` 阶段 3 补充

## 为什么插在 Goal 3 之前（goal-2.1）

1. **验证环境已就绪**：Goal 2 产出了浏览器基线 + mock server，依赖升级可在浏览器端完整验证（登录 → 主界面 → Markdown 渲染 → 拼音搜索 → 剪贴板 → 快捷键 → 路由跳转），不需要 Electron。
2. **隔离两类回归**：Goal 3 要重写 `platform/electron/crypto.js`、`socket.js`、`index.js`，如果同时升依赖，dep 升级的回归和 Electron 安全模型的回归会交织。先升依赖、稳住基线，Goal 3 只面对安全模型问题。
3. **uuid 深路径导入已存隐患**：`platform/electron/ui.js`、`exts/manager.js`、`core/models/entity.js` 用 `import uuid from 'uuid/v4'`，uuid v7+ 已移除此路径。Goal 3 会触碰 `electron/` 目录，先修掉避免交叉。
4. **external-api.js 依赖重导出需先行稳定**：`exts/external-api.js` 向扩展暴露 marked/uuid/compareVersions/hotkeys/pinyin/md5 等模块，Goal 3 可能临时禁用 exts，先把这些 re-export 的 API 形状固定下来。

## 依赖升级总览

| 依赖 | 当前 → 目标 | 风险 | 使用文件数 | 迁移要点 |
|------|------------|------|-----------|---------|
| uuid | 3.1.0 → 14.x | 低 | 5 | `uuid/v4` 深路径 → named `{v4}` |
| compare-versions | 3.1.0 → 6.x | 低 | 3 | 纯 ESM，API 不变 |
| md5 | 2.2.1 → 2.3.0 | 低 | 6 | patch |
| aes-js | 3.1.0 → 3.1.2 | 低 | 1 | patch |
| prop-types | 15.6.2 → 15.8.1 | 低 | 全局 | minor |
| remove-markdown | 0.3.0 → 0.6.x | 低 | 1 | API 兼容 |
| wolfy87-eventemitter | 5.2.2 → 5.2.9 | 低 | 1 | patch（库已归档但稳定） |
| less | 3.13.0 → 4.x | 低 | devDep | 验证 mzui less 编译 |
| highlight.js | 9.9.0 → 11.x | 中 | 1 | 验证 `highlightAuto` 导入与返回值 |
| dexie | 2.0.4 → 4.x | 中 | 1 | 验证 `Dexie.exists` / `new Dexie` / stores API |
| pinyin | 2.8.3 → 4.x | 中 | 2 | 验证 `STYLE_NORMAL` 等常量是否保留 |
| hotkeys-js | 3.3.5 → 4.x | 中 | 3 | 验证 `hotkeys()` / `setScope` / `deleteScope` |
| clipboard-polyfill | 2.7.0 → 移除 | 中 | 1 | `clipboard.DT()` → 原生 `navigator.clipboard` |
| react-router-dom | 4.3.1 → 5.3.4 | 低 | 6 | v5 与 v4 API 几乎一致（Switch/Route component=/Redirect/Link/NavLink 均保留），改动极小 |
| marked | 0.4.0（条件升级至 18.x） | 高 | 2 | 默认保持 0.4.0；仅当与其他升级后依赖不兼容时升 v18+，用 DOMPurify 替代 sanitize 选项 |

> **react-router-dom 选择 v5 而非 v6**：v5 是 v4 的平滑升级（API 几乎零改动，class 组件无需 withRouter 兼容 HOC，无 Switch→Routes / component→element / Redirect→Navigate 迁移）。v6 的 hooks 化路由对 110 个 class 组件不友好，当前不值得为路由升一个大版本付出那么大迁移成本。
> **marked 条件升级**：0.4.0 已在 Goal 2 浏览器基线中验证可用，默认不升级。仅当其他依赖升级后导致不兼容时才升 v18+（无中间版本降级，sanitize 移除后用 DOMPurify 做后置过滤）。实测 sanitize 选项在 marked v4.0.0 才移除，v3.x 仍保留——但 v3 仍属老旧版本，不值得作为中间态，要么不动要么直接 v18+。

---

以下为可直接粘贴到 `/goal` 命令的完整内容：

---

```
/goal 将 xxc 客户端的前端依赖批量升级到现代版本，覆盖 router、数据库、拼音、快捷键、剪贴板、UUID、版本比较、代码高亮等全部落后依赖，使主界面在浏览器基线下行为与 Goal 2 截图基线一致。marked 默认保持 0.4.0 不升级（条件升级策略见下文）。

First action: 读取以下文件并报告关键信息，等待确认后再动手：
- doc/upgrade/xxc-upgrade-plan.md（重点看「老依赖替换清单」）
- doc/upgrade/goal-2-react18.md（Goal 2 的约束与已替换项，避免重复）
- doc/upgrade/screenshots/（Goal 2 截图基线，回归对照）
- xxc/app/exts/external-api.js（扩展 API 重导出层，所有第三方依赖的集中暴露点）
- xxc/app/utils/markdown.js（marked + highlight.js 使用，marked 条件升级时需改）
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

Scope:
  - xxc/package.json（所有目标依赖升版本，移除 clipboard-polyfill）
  - xxc/pnpm-lock.yaml（pnpm install 自动更新）

  【第一批：patch / minor，无 breaking】
  - md5 2.2.1 → 2.3.0（6 文件：core/network/socket.js, core/models/file-data.js, core/profile/user.js, core/profile/user-config.js, core/im/im-chats.js, exts/external-api.js）
  - aes-js 3.1.0 → 3.1.2（platform/browser/crypto.js）
  - prop-types 15.6.2 → 15.8.1（全局，无代码改动）
  - remove-markdown 0.3.0 → 0.6.x（core/todo/index.js，API 兼容）
  - wolfy87-eventemitter 5.2.2 → 5.2.9（platform/browser/event-emitter.js 直接 import；core/events.js 经 platform.access('EventEmitter') 间接获取，patch）
  - less 3.13.0 → 4.x（devDep，验证 mzui 72 个 less 文件编译）

  【第二批：ESM 化，import 路径变更】
  - uuid 3.1.0 → 14.x（5 文件）：
    - app/core/models/file-data.js: `import UUID from 'uuid'` + `UUID()` → `import {v4 as UUID} from 'uuid'` + `UUID()`
    - app/core/models/entity.js: `import UUID from 'uuid/v4'` + `UUID()` → `import {v4 as UUID} from 'uuid'` + `UUID()`（深路径，v14 必报错）
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
  - pinyin 2.8.3 → 4.x（utils/pinyin.js 包装层 + exts/external-api.js，共 2 文件直接 import）：
    - 验证 `PinYin.STYLE_NORMAL`、`PinYin.STYLE_FIRST_LETTER`、`PinYin.STYLE_INITIALS` 常量是否保留
    - 验证 `PinYin(str, {style})` 调用签名
  - hotkeys-js 3.3.5 → 4.x（3 文件 + exts/external-api.js）：
    - app/components/image-cutter.js: `hotkeys(key, scope, handler)`、`hotkeys.setScope`、`hotkeys.deleteScope`
    - app/components/input-control.js
    - app/views/chats/menu-search-list.js: `hotkeys(key, scope, handler)` + `hotkeys.deleteScope`（up/down/enter/esc，直接重度使用）
  - clipboard-polyfill 2.7.0 → 移除（1 文件 platform/browser/clipboard.js）：
    - `clipboard.writeText` → `navigator.clipboard.writeText`
    - `new clipboard.DT()` + `clipboard.write(dt)` → `navigator.clipboard.write([new ClipboardItem({...})])`
    - 从 package.json 移除 clipboard-polyfill

  【第四批：react-router-dom 升级】
  - react-router-dom 4.3.1 → 5.3.4（6 文件，v5 与 v4 API 几乎一致，改动极小）：
    - app/views/index/index.js: 验证 HashRouter/Route/Switch 兼容（v5 无 breaking）
    - app/views/chats/index.js: 验证 Route render props + props.match.url 兼容
    - app/views/main/index.js: 同上
    - app/views/main/navbar.js: 验证 Route/Link 兼容
    - app/views/chats/chat-list-item.js: 验证 Link 兼容
    - app/views/exts/index.js: 验证 NavLink/Redirect 兼容
    - 若编译/运行时有 deprecation warning，按 v5 文档调整（v5 对部分 v4 用法有 console.warn 但仍工作）

  【条件项：marked 兼容性检查（默认不升级）】
  - marked 当前 0.4.0，已在 Goal 2 浏览器基线中验证可用。本 goal 默认保持 0.4.0 不升级。
  - 所有其他依赖升级完成后，验证 marked 0.4.0 仍正常工作（Markdown 渲染、代码高亮、HTML 过滤）。
  - 仅当 marked 0.4.0 与其他升级后的依赖不兼容（编译或运行时错误）时，升级到 v18+：
    - `new Marked.Renderer()` → `marked.Renderer` 或 `new marked.Renderer()`
    - `renderer.code = (code, lang) => {}` → v18 签名变更（确认是 (code, infoString, escaped) 还是 ({text, lang, escaped})）
    - `sanitize: true` + `sanitizer: fn` 选项已移除（v4.0.0 起移除）→ 用 DOMPurify 对 marked.parse() 输出做后置过滤
    - `Marked.setOptions({...})` → `marked.use()`
    - `Marked(string)` → `marked.parse(string)`
    - `headerIds: false` 选项已移除 → v18 默认不生成 header ID，直接删除该选项即可
    - 引入 DOMPurify 依赖，用 DOMPurify.sanitize(html, {ALLOWED_TAGS, ALLOWED_ATTR}) 做后置过滤，可复用现有 allowedTags 白名单作配置
    - 评估是否可移除旧 htmlparser 依赖（DOMPurify 取代其 sanitizer 角色）

  【收尾：适配层】
  - app/exts/external-api.js: 所有 nodeModules 重导出更新为新 API 形状（uuid → {v4}，compare-versions → 新 API，etc.）；marked 重导出仅在 marked 升级时才更新
  - app/exts/external-api.js: `__non_webpack_require__('jquery')` → Vite 下 `__non_webpack_require__` 未定义，exts stub 模式下该分支不执行；若浏览器基线构建时触发 ReferenceError，则在 exts stub 入口提前 return 或 try/catch 包裹，记录现象，不阻塞本 goal

  不改 React 版本（18）
  不改 Platform 抽象层接口
  不改 core/network/socket-message.js 协议
  不动 mock server
  不改 platform/electron/crypto.js 和 platform/electron/socket.js 的功能逻辑（这两个文件 Goal 3 会重写，本 goal 只修 uuid import 等不涉及功能的导入变更）

Constraints:
  - 保留 110 个 class 组件，不改写为函数组件 / hooks
  - react-router-dom v5 与 v4 API 几乎一致，保留 class 组件（Switch/Route component=/Redirect/Link/NavLink 均兼容），无需写 withRouter 兼容 HOC
  - marked 默认保持 0.4.0 不升级；仅当证明与其他升级后依赖不兼容时才升级到 v18+（无中间版本降级），届时用 DOMPurify 做后置过滤
  - clipboard-polyfill 移除后用 navigator.clipboard 原生 API，浏览器基线（Chromium）完全支持
  - 每个依赖升级后单独验证对应功能点，不要一次性全改后才发现问题
  - 依赖管理必须用 pnpm 命令（在 xxc/ 目录下执行 pnpm add / pnpm remove），不手动编辑 package.json dependencies / devDependencies 字段
  - 升级顺序严格按四批递进：patch/minor → ESM → API 变更 → react-router，每批验证通过后再进下一批
  - extract-zip 不在本 goal 范围（用到时再补，不提前添加）

Done when:
  1. pnpm install 成功，package.json 中所有目标依赖升级到目标版本或经 Stop-if 记录的降级版本（降级原因已记录）
  2. clipboard-polyfill 从 package.json 移除，grep 确认 app/ 下无 clipboard-polyfill import 残留
  3. grep 确认 app/ 下无 `from 'uuid/v4'` 深路径导入
  4. pnpm dev 启动，控制台无依赖相关的 import 错误或 warning
  5. 登录界面渲染与 Goal 2 截图一致
  6. 连 mock server 后主界面渲染与 Goal 2 截图一致：聊天列表、会话切换、消息气泡均可交互
  7. Markdown 消息渲染正确：代码高亮（highlight.js 颜色生效）、代码块文件名解析、HTML 过滤生效（无 XSS 漏洞）
  8. 聊天列表拼音搜索正常（输入拼音首字母能匹配到联系人）
  9. 快捷键功能正常（image-cutter 的 esc/enter 触发、input-control 快捷键录入、menu-search-list 的 up/down/enter/esc）
  10. 剪贴板复制正常（复制消息文本、复制代码块内容到系统剪贴板）
  11. 路由跳转正常：会话切换时 URL hash 变化、navbar 链接跳转、image-cutter 路由参数（:file）正确解析
  12. 版本比较逻辑正常（登录时 serverVersion 检查不报错，功能开关正确判断）
  13. 本地数据库正常（dexie 升级后消息历史可读写，无 IndexedDB schema 报错）
  14. UUID 生成正常（file-data/entity 的 gid 生成不报错，消息可发送）
  15. external-api.js 的 nodeModules 所有重导出与新 API 形状一致（uuid 为函数、compare-versions 为新 API）
  16. 截图留存到 doc/upgrade/screenshots/（依赖升级后的主界面 + Markdown 渲染 + 拼音搜索）
  17. marked 版本状态明确：保持 0.4.0（已验证与其他升级后依赖兼容）或升级到 v18+ 并用 DOMPurify 过滤

Stop if:
  - marked 0.4.0 与其他升级后的依赖不兼容 —— 必须升级到 v18+（无中间版本），用 DOMPurify 做后置过滤；若 v18+ 迁移超出预算，保持 0.4.0 并记录不兼容现象，不阻塞其他依赖升级
  - react-router-dom v5 升级后路由行为异常（页面白屏、URL 不更新、props.match 为空）—— 对照 v5 changelog 排查，若为 v5 已知 breaking 则调整用法，否则回退 v4.3.1
  - pinyin v4 移除 STYLE_NORMAL / STYLE_FIRST_LETTER / STYLE_INITIALS 常量且无替代映射 —— 临时锁定 pinyin v3，记录现象
  - dexie v4 升级后 IndexedDB schema 不兼容导致数据库打不开 —— 临时锁定 dexie v3，记录现象
  - hotkeys-js v4 API 变化导致快捷键失效且无法适配 —— 临时锁定 hotkeys-js v3
  - 任何依赖升级导致主界面无法渲染（大面积白屏或 JS 崩溃）—— 回退该依赖到原版本，继续其他依赖
  - 任何改动修改了 core/network/socket-message.js 或 mock server

Use a token budget of 150K tokens for this goal.
```

---

**关键设计选择**：
- **插在 Goal 2 和 Goal 3 之间**：依赖升级在浏览器基线验证，不碰 Electron，为 Goal 3 提供干净基线，避免两类回归交织
- **react-router-dom 选择 v5.3.4**：v5 是 v4 的平滑升级，API 几乎零改动（Switch/Route component=/Redirect/Link/NavLink 全部保留），110 个 class 组件无需 withRouter 兼容 HOC。v6 的 hooks 化路由对 class 组件不友好，当前不值得为此付出迁移成本
- **marked 条件升级而非强制升级**：0.4.0 已在 Goal 2 浏览器基线中验证可用，默认不升级以规避 14 个大版本跨度的迁移风险；仅当其他依赖升级导致不兼容时才升 v18+，届时用 DOMPurify 替代已移除的 sanitize 选项做后置过滤。实测 sanitize 在 v4.0.0 才移除，不存在有效的中间降级版本（v9 与 v18 一样无 sanitize），故无中间态
- **clipboard-polyfill 直接移除而非升级**：现代浏览器原生 navigator.clipboard 完全够用，减少一个废弃依赖
- **升级顺序按风险递增分四批**：patch/minor → ESM → API 变更 → react-router，每批验证通过后再进下一批，定位问题范围最小化
- **Stop-if 对每个高风险依赖都有独立的降级方案**（临时锁定或降级版本），不因单个依赖阻塞全局
- **marked 升级时用 DOMPurify 做后置过滤**：marked v18 移除 sanitize 选项后，用 DOMPurify 对输出 HTML 做后置过滤，复用现有 allowedTags 白名单作配置，安全强度远高于手写 per-tag sanitizer；可评估移除旧 htmlparser 依赖
- **extract-zip 用到再补**：浏览器基线下 exts 被 stub 不加载 extract-zip，不提前添加无用依赖，用到时再补
