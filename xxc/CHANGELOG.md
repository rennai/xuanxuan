# Changelog

## [Unreleased]

### Changed
- 升级项目依赖到最新版本
  - Node.js 要求升级到 18.x 及以上
  - npm 要求升级到 10.x 及以上
  - webpack 升级到 5.89.0
  - Babel 升级到 7.x
  - Electron 升级到 28.3.3
  - electron-builder 升级到 24.9.1
  - electron-debug 升级到 3.2.0
  - 其他依赖包升级到最新稳定版本
- 将所有React组件文件扩展名从.js改为.jsx，优化代码组织结构
  - 重命名所有React组件文件
  - 更新相应的导入语句
  - 保持webpack配置兼容性
- 代码优化和重构
  - 优化组件生命周期方法
  - 改进错误处理和异常捕获
  - 修复开发环境下的加载问题
    - 更新 webpack 开发配置，优化热更新设置
    - 改进 Content Security Policy 配置，支持开发服务器
    - 优化脚本加载和错误处理机制
    - 修复扩展加载逻辑
- UI/UX改进
  - 优化对话框和弹出层的交互体验
  - 改进消息列表的滚动性能
  - 优化图片加载和显示效果
- 开发工具链升级
  - 更新ESLint配置和规则
  - 优化开发时热重载功能
  - 改进调试工具集成

### Added
- 添加 macOS Apple Silicon (M1/M2) 芯片支持
  - 支持 arm64 架构的应用打包
  - 支持同时打包 x64 和 arm64 架构的通用二进制文件
  - 优化 macOS 应用配置，支持深色模式

### Updated
- 更新 webpack 配置使用 ES 模块语法
  - 替换 `__dirname` 为 `import.meta.url` 和 `fileURLToPath`
  - 更新资源处理方式，使用 webpack 5 的资源模块
  - 优化生产环境构建配置，使用 `TerserPlugin` 替代 `UglifyJsPlugin`
  - 改进开发环境配置，优化热模块替换（HMR）
  - 使用 `MiniCssExtractPlugin` 替代 `ExtractTextPlugin`

### Improved
- 改进 Babel 配置
  - 使用 `@babel/preset-env` 和 `@babel/preset-react`
  - 添加现代化的 Babel 插件支持
  - 优化生产环境和开发环境的特定配置
- 开发服务器优化
  - 更新 webpack-dev-middleware 配置
  - 改进错误处理和生命周期管理
  - 优化开发体验和构建性能

### Fixed
- 修复在某些情况下消息发送失败的问题
- 修复图片预览可能导致应用崩溃的问题
- 修复通知提醒设置不生效的问题
- 修复搜索功能的性能问题

### Removed
- 移除过时的 webpack 插件和配置
- 移除不必要的 babel 转换插件
- 清理过时的依赖包
