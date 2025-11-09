# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**喧喧** 是一个开源的企业级即时通讯平台，支持桌面客户端（Windows、Mac、Linux）和浏览器客户端。项目采用多层架构设计，通过 WebSocket 实现实时通信。

## 开发命令

### 桌面客户端开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run hot-server

# 启动客户端（热重载模式）
npm run start-hot

# 快速启动（跳过扩展安装）
npm run start-hot-fast

# 构建项目
npm run build

# 构建调试版本
npm run build-debug

# 打包应用
npm run package

# 打包特定平台
npm run package-mac     # macOS
npm run package-win     # Windows
npm run package-linux   # Linux
npm run package-browser # 浏览器版本

# 代码检查
npm run eslint
```

### 代码质量检查
```bash
# ESLint 检查
npm run lint

# 修复 ESLint 问题
npm run lint:fix
```

### 测试
```bash
# 运行测试
npm test

# 运行测试并覆盖
npm run test:coverage
```

## 项目架构

### 整体架构
```
客户端 (Electron/浏览器) → XXD 中间服务器 → 然之协同/XXB 后端
```

### 前端技术栈
- **框架**: React + Redux
- **构建工具**: Webpack 4
- **UI 框架**: Material-UI
- **桌面客户端**: Electron 4.0.0
- **实时通信**: WebSocket (ws)
- **文件上传**: tus-js-client (支持断点续传)

### 目录结构
```
xxc/
├── app/                # 应用源代码
│   ├── component/      # 通用 React 组件
│   ├── redux/          # Redux 状态管理
│   ├── views/          # 页面组件
│   │   ├── system/     # 系统级页面
│   │   ├── user/       # 用户相关页面
│   │   └── team/       # 团队管理页面
│   ├── utils/          # 工具函数
│   ├── app/            # 应用核心逻辑
│   ├── exts/           # 扩展系统
│   ├── platform/       # 平台适配层
│   │   ├── electron/   # Electron 平台实现
│   │   └── browser/    # 浏览器平台实现
│   └── config/         # 配置文件
├── tools/              # 构建工具和配置
└── build/              # 构建脚本
```

### 核心模块
- **main.development.js**: Electron 主进程入口文件
- **app/platform/**: 跨平台抽象层，支持 Electron 和浏览器
- **app/config/**: 应用配置管理
- **app/exts/**: 扩展系统，支持插件、应用和主题
- **app/component/**: 可复用的 React 组件
- **app/utils/**: 工具函数集合

### 扩展系统

喧喧支持三种扩展类型：
- **Plugin**: 功能插件
- **App**: 应用扩展
- **Theme**: 主题

扩展配置文件位于 `app/exts/extension-config.js`，按需加载并支持扩展间通信。

## 重要配置

### 环境变量
- `REACT_APP_XXD_HOST`: XXD 服务器地址
- `REACT_APP_XXD_PORT`: XXD 服务器端口 (默认 11443)
- `REACT_APP_DEBUG`: 调试模式开关
- `NODE_ENV`: 环境设置 (development/production/debug)
- `HOT`: 热重载开关
- `SKIP_INSTALL_EXTENSIONS`: 跳过扩展安装

### 开发环境要求
- Node.js 8.x+ (推荐 8.11.3)
- npm 5.x+
- XXD 服务器需要配合然之协同/XXB 后端系统

## 常见问题

### 启动问题
- 确保 XXD 服务器正常运行
- 检查防火墙设置，确保 WebSocket 连接可用
- 验证服务器地址和端口配置正确

### 构建问题
- 清理 node_modules 重新安装依赖：`rm -rf node_modules && npm install`
- 检查 Node.js 版本兼容性

### 扩展开发
- 参考 `examples/extensions/` 目录下的示例扩展
- 使用平台抽象层 API 进行跨平台开发
- 扩展间通过扩展系统进行通信

## 版本信息

- Electron: 4.0.0
- React: 16.4.1
- Node 支持: 8.x+ (适合 M1/M2 芯片)

## 部署说明

### 桌面端部署
1. 运行 `npm run package` 生成安装包
2. 在目标机器安装并配置服务器地址
3. 启动应用登录使用

### 浏览器端部署
1. 将代码部署到 Web 服务器
2. 配置 XXD 服务器地址
3. 通过浏览器访问使用

## 开发工作流

### 开发模式
1. 启动热重载服务器：`npm run hot-server`
2. 启动客户端：`npm run start-hot`
3. 修改代码后自动重载

### 生产构建
1. 构建主进程：`npm run build-main`
2. 构建渲染进程：`npm run build-renderer`
3. 打包应用：`npm run package`

### 调试模式
- 构建调试版本：`npm run build-debug`
- 打包调试版本：`npm run package-debug`
- 启用 Source Map 支持和详细日志