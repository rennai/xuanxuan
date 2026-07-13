# Goal 4：Electron + Node 升级 + 三平台构建

> **依赖**：Goal 3 完成（安全模型已在 Electron 4 上稳定）
> **对应计划**：`doc/upgrade/xxc-upgrade-plan.md` 的阶段 5

以下为可直接粘贴到 `/goal` 命令的完整内容：

---

```
/goal 将 xxc 客户端的 Electron 升级到最新稳定版，Node 升级到 22 LTS 或 24，重写打包配置（823 行 package.js → electron-builder 声明式），恢复三平台构建：Windows、Linux、macOS arm64。

First action: 读取以下文件并报告关键信息，等待确认后再动手：
- doc/upgrade/xxc-upgrade-plan.md（重点看「目标」「Electron 相关必改项」章节）
- doc/upgrade/screenshots/（回归基线）
- xxc/package.json（当前 Electron 版本、electron-builder 版本、scripts）
- xxc/build/package.js（823 行，重点看 PLATFORMS/ARCHS 定义、commander 参数、平台/arch/debug/beta 逻辑）
- xxc/build/electron-builder.json（若存在）或 package.json 的 build 字段
- xxc/app/main.development.js（主进程入口）
- xxc/app/platform/electron/app-remote.js（检查 Goal 3 改造后的 BrowserWindow/Menu/Tray/dialog 用法）
- 运行 `pnpm list electron electron-builder` 报告当前版本
- 运行 `node -v && pnpm -v` 报告本地版本

Scope:
  - xxc/package.json（electron 升最新，electron-builder 升最新，devEngines 更新，scripts 重写）
  - xxc/electron-builder.yml 或 xxc/package.json build 字段（新建声明式配置，替代 build/package.js）
  - xxc/build/package.js（废弃或归档，不删除，留作参数语义参考）
  - xxc/app/main.development.js（适配新 Electron API breaking changes）
  - xxc/app/platform/electron/app-remote.js（适配 BrowserWindow/Tray/Menu/dialog 等跨版本 API 变更）
  - xxc/vite.config.ts（electron-vite 主进程/渲染进程/preload 三入口构建配置完善）
  - 不改 React 版本（18）
  - 不改 mock server 和协议
  - 不改 socket-message.js

Constraints:
  - 三平台必须产出安装包：Windows（x64）、Linux（x64）、macOS（arm64）
  - macOS arm64 优先验证（本地 Apple Silicon，fnm 已有 Node 24 环境）
  - 打包配置用 electron-builder 声明式（yml 或 package.json build），不保留 823 行命令式脚本逻辑
  - 保留原 package.js 的参数语义（platform/arch/debug/beta），但实现用 electron-builder 的对应机制
  - 跨多个 Electron 大版本升级时，分小步走（4→某中间稳定版→最新），每步启动验证，不一跳到底
  - 代码签名：若没有 Developer ID，先用 ad-hoc 签名（macOS）或跳过签名，不阻塞构建
  - 不改 React 版本和 Platform 接口
  - 不动 mock server

Done when:
  1. package.json 中 electron 为最新稳定版（非 beta），electron-builder 为最新稳定版
  2. devEngines 更新为 node >= 22
  3. build/package.js 已归档（移到 build/legacy/ 或标记 deprecated），新的 electron-builder 配置存在
  4. macOS arm64：`pnpm build:mac` 产出 .dmg 或 .app，在 Apple Silicon 上启动后登录界面正常
  5. Windows：`pnpm build:win` 产出 .exe 或 .nsis 安装包（交叉编译或 CI，可不在本机启动但必须构建成功）
  6. Linux：`pnpm build:linux` 产出 AppImage 或 .deb（交叉编译或 CI，必须构建成功）
  7. macOS arm64 安装包连 mock server 后主界面渲染与 Goal 3 截图一致
  8. Electron 主进程控制台无 deprecation warning（关于使用的 API）
  9. 截图留存到 doc/upgrade/screenshots/（最终三平台产物的 macOS 主界面）

Stop if:
  - Electron 升级后 BrowserWindow / Tray / Menu / dialog / globalShortcut 等主进程 API 出现 breaking change 导致 app-remote.js 大面积报错 —— 按小步升级策略退回上一稳定版本，记录 breaking change 清单
  - electron-builder 配置迁移后丢失了原 package.js 的某个参数能力（如 beta 版本号生成、debug 版本、clean）—— 记录缺失能力，评估是否需要补
  - macOS arm64 构建失败（native 模块编译问题）—— 排查 electron-rebuild / @electron/rebuild
  - Windows/Linux 交叉编译失败（wine / Docker 环境问题）—— 记录环境要求，可标记为需 CI 环境构建，不阻塞 macOS 验证
  - electron-vite 主进程构建配置与 preload/renderer 的 entry 关系无法对齐 —— 记录配置难点，评估是否需要拆分三个 vite config
  - 任何改动修改了 React 版本、socket-message.js 信封协议或 mock server

Use a token budget of 200K tokens for this goal.
```

---

**关键设计选择**：
- First action 强制报告当前版本和本地环境，确认起点
- Electron 跨多版本升级约束为"分小步"，避免 4→最新一跳到底无法定位 breaking change
- macOS arm64 作为首要验证平台（本地环境），Windows/Linux 可接受只构建成功不本地启动
- 打包配置明确要求声明式替代命令式，但保留原参数语义
- 代码签名不阻塞（ad-hoc 或跳过），把签名作为后续独立流程
- Stop-if 覆盖 native 模块编译、交叉编译环境、electron-vite 配置难点
- 这是最后一个 goal，完成后整个重构结束，三平台安装包可用
