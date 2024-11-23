# 喧喧（xuanxuan）

企业即时通讯平台客户端

## 项目简介

喧喧是一个企业即时通讯平台的客户端应用，基于 Electron 开发，支持 Windows、macOS 和 Linux 等多个平台。

## 技术栈

- Electron
- React
- Webpack
- Babel
- Node.js

## 项目结构

```
xxc/
├── app/                    # 主要应用源代码
│   ├── assets/            # 静态资源文件
│   ├── build-in/          # 内置功能模块
│   ├── components/        # React 组件
│   ├── config/           # 配置文件
│   ├── core/             # 核心功能模块
│   ├── exts/             # 扩展功能
│   ├── lang/             # 国际化语言文件
│   ├── media/            # 媒体文件
│   ├── platform/         # 平台相关代码
│   ├── style/            # 样式文件
│   ├── utils/            # 工具函数
│   ├── views/            # 视图组件
│   ├── index.html        # 主页面
│   ├── index.js          # 入口文件
│   └── main.development.js # Electron 主进程文件
├── build/                 # 构建相关配置
├── examples/              # 示例代码
├── resources/            # 资源文件
├── tools/                # 开发工具和脚本
├── .babelrc             # Babel 配置
├── .editorconfig        # 编辑器配置
├── .esdoc.json         # ESDoc 文档配置
├── .eslintrc           # ESLint 配置
├── package.json        # 项目配置和依赖
└── yarn.lock           # Yarn 依赖版本锁定文件
```

## 开发指南

### 环境要求

- Node.js
- npm 或 yarn

### 安装依赖

```bash
npm install
# 或
yarn install
```

### 开发命令

- 启动开发服务器：`npm start` 或 `yarn start`
- 热重载开发：`npm run start-hot` 或 `yarn start-hot`
- 构建应用：`npm run build` 或 `yarn build`

### 打包命令

- Mac 版本：`npm run package-mac`
- Windows 版本：`npm run package-win`
- Linux 版本：`npm run package-linux`

## 调试版本

可以使用以下命令构建和打包调试版本：

- 构建调试版本：`npm run build-debug`
## 开发指南

### 环境要求

- Node.js
- npm 或 yarn

### 安装依赖

```bash
npm install
# 或
yarn install
- 打包调试版本：`npm run package-debug`

## 许可证

[请在此处添加许可证信息]
