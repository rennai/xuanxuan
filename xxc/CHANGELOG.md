# Changelog

## [Unreleased]

### Changed
- 升级项目依赖到最新版本
  - Node.js 要求升级到 18.x 及以上
  - npm 要求升级到 10.x 及以上
  - webpack 升级到 5.89.0
  - Babel 升级到 7.x
  - 其他依赖包升级到最新稳定版本

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

### Removed
- 移除过时的 webpack 插件和配置
- 移除不必要的 babel 转换插件
- 清理过时的依赖包
