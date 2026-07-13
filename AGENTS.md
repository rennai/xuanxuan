# AGENTS.md

本文件为在此仓库工作的 AI agent 提供项目级上岗说明。仅记录从代码不易直接看出的项目专属事实。

## 项目简介

喧喧（Xuanxuan）是青岛易软天创出品的企业即时通信解决方案，由客户端 + 中转服务器 + 业务后端三段组成。许可证为 ZPL 1.2。官方主页 http://xuan.im。

整体架构（客户端不直连业务后端）：

- 客户端 ↔ `xxd`（WebSocket / HTTPS）↔ 业务后端（HTTP / HTTPS）
- `xxd` 仅做消息转发与文件中转，**不持久化用户资料和消息**；所有数据由业务后端提供。

## 四大子系统目录

- `xxc/`：客户端。Webpack 4 + Electron 4 + React 16 + Babel 6。这是日常前端开发的主要落点。
- `xxd/`：Go 中转服务器，提供 WebSocket 和 HTTPS 接口。入口 `xxd/main.go`。
- `xxb/`：独立业务后端（基于 ZDoo / PHP 框架），不依赖然之协同。通过根目录 `Makefile` 构建（需 `zdoo/` 源）。
- `ranzhi/`：然之协同服务器端扩展（PHP），作为另一种业务后端。

客户端源码细分见 `doc/client-developer.md`「源码结构」，关键目录：`xxc/app/core`（核心模块）、`xxc/app/components`（通用 React 组件）、`xxc/app/views`（视图）、`xxc/app/utils`（工具）、`xxc/app/exts`（扩展运行时）。

## 关键命令

### 客户端（在 `xxc/` 下执行）

```bash
npm install              # 安装依赖；首次较慢，见下方镜像提示
npm run hot-server       # 启动 React 热更新 dev server（保持运行）
npm run start-hot        # 另开窗口：启动 Electron 开发客户端
npm run start-hot-fast   # 同上，但跳过自动安装 React DevTools
npm run eslint           # 对 ./app 做 lint（airbnb 规则集，必跑）
npm run build            # 生产构建（main + renderer）
npm run package          # 打包当前平台安装包
npm run package-mac      # 其它：package-win / package-win-32 / package-linux / package-browser / package-debug / package-all
```

`devEngines` 要求 Node >= 8.x、npm >= 5.x（开发者基准为 Node 8.11.3）。依赖较老，国内网络建议配置淘宝 npm 镜像与 `ELECTRON_MIRROR`，详见 `doc/client-developer.md`。

### xxd 服务器（Go，GOPATH 模式）

无 `go.mod`，按 GOPATH 方式开发：把 `xxd/` 链接或拷贝到 `$GOPATH/src/xxd`，包名即 `xxd`。

```bash
go run main.go                       # 源码运行
go build -o xxd main.go              # 编译
# 跨平台交叉编译见 build_multi_platform.sh / build_xgo_platform.sh
```

Go 依赖需手动 `go get`：`github.com/Unknwon/goconfig`、`github.com/gorilla/websocket`、`github.com/mattn/go-sqlite3`。配置文件为 `xxd/config/xxd.conf`（端口、HTTPS 开关、上传路径、业务后端列表）。SQLite3 交叉编译注意 CGO，详见 `doc/xxd-developer.md`。

### xxb 后端（PHP）

根目录 `make` 触发 `xxb/Makefile`，从同级 `zdoo/` 抽取框架与模块拼装。修改 `xxb/` 前先确认 `zdoo/` 源是否就位。

## 架构边界与改动规则

- **平台抽象层不可绕过**：`xxc/app/platform/{electron,browser,common}` 通过 webpack 别名 `Platform` 注入（桌面默认指向 `platform/electron/index.js`，浏览器构建切换为 `platform/browser`）。访问系统能力（剪贴板、通知、文件、socket、加密等）必须经由 `Platform` 模块或导出的 `platformCall` / `platformHas` / `platformAccess`，不要直接 import Electron / 浏览器 API，否则浏览器端会编译/运行失败。
- **模块别名**：eslint `import/resolver` 与 webpack 共同识别 `Platform`、`Config`、`ExtsRuntime`、`ExtsView`。新增跨目录引用优先用这些别名。
- **入口文件**：Electron 主进程入口 `xxc/app/main.development.js`（编译产物 `main.js` 已被 gitignore，勿手改）；渲染进程入口 `xxc/app/index.js` 与 `xxc/app/index.html`。
- **xxd 只转发**：不要在 `xxd/` 增加业务数据存储逻辑；新数据接口应由业务后端（`xxb/` 或 `ranzhi/`）实现，`xxd` 仅转发。
- **扩展系统仅限桌面端**：扩展（plugin / app / theme）只支持 Electron，浏览器端不支持。扩展逻辑集中在 `xxc/app/exts/`，打包格式与 `xext` 配置见 `doc/extension.md`。

## 编码与构建约定

- **Lint**：airbnb 规则集，4 空格缩进，`object-curly-spacing: never`（花括号内无空格），JSX 允许 `.js`/`.jsx`。改动 `xxc/app` 前后都跑 `npm run eslint`。
- **全局变量**：lint 已声明 `DEBUG` 和 `Pace` 为全局；DEBUG 模式下会把 `$platform` / `$Platform` 挂到 global 便于调试。
- **国际化**：界面文案集中在 `xxc/app/lang/{en,zh-cn,zh-tw}.json`，另有 `xxc/app/config/lang.json`。新增用户可见文案需三语同步。
- **生成产物勿手改**：`xxc/app/main.js`、`bundle.js`、`style.css`、`xxc/app/dist`、`xxc/release` 等均为构建产物并被 gitignore。
- **配置与密钥**：`xxc/build/build-config.*.json`、`electron-builder.json`、`xxd/certificate`、`xxd/log`、`xxd/tmpfile` 均为本地/敏感产物，已 gitignore，不要提交。

## 改动前应先读的文档

- `doc/client-developer.md`：客户端环境、构建、打包、源码结构（改 `xxc/` 前必读）。
- `doc/xxd-developer.md`：xxd Go 环境与编译（改 `xxd/` 前必读）。
- `doc/extension.md`：扩展机制与 `xext` 配置（改 `xxc/app/exts/` 前必读）。
- `doc/api.md`、`doc/client-events.md`、`doc/server.md`：客户端 ↔ 服务器接口与事件。
- `doc/browser-usage.md`：浏览器端部署约束（需官方证书）。
- `CHANGES.md`：版本变更记录。
