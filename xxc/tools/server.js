/* eslint-disable no-console */
/**
 * Setup and run the development server for Hot-Module-Replacement
 * https://webpack.github.io/docs/hot-module-replacement-with-webpack.html
 */

import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import { spawn } from 'child_process';
import minimist from 'minimist';
import open from 'open';

import electronConfig from './webpack.config.development.js';
import browserConfig from './webpack.config.browser.development.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取命令行参数
const argv = minimist(process.argv.slice(2));

// 根据参数判断 target 是否是 browser
const isBrowserTarget = argv.target === 'browser';
if (isBrowserTarget) {
  console.log('Server for browser target.');
}

// 根据 target 参数使用不同的 webpack 配置
const config = isBrowserTarget ? browserConfig : electronConfig;
const app = express();
const compiler = webpack(config);
const PORT = process.env.PORT || 3000;

// 创建 Webpack 开发中间件
const wdm = webpackDevMiddleware(compiler, {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
  },
  publicPath: config.output.publicPath,
});

// 使用 Webpack 开发中间件
app.use(wdm);

// 使用 Webpack 热更新中间件
app.use(webpackHotMiddleware(compiler));

if (isBrowserTarget) {
  app.use(express.static(path.resolve(__dirname, '../app/')));
}

const onCompilationComplete = () => {
  if (!isBrowserTarget) {
    // 在编译完成后启动 Electron
    const proc = spawn('npm', ['run', 'start-hot'], {
      shell: true,
      env: process.env,
      stdio: 'inherit'
    });

    proc.on('close', code => {
      console.log('Process exited with code ' + code);
    });
  }
};

let isFirstCompile = true;

compiler.hooks.done.tap('ServerJS', stats => {
  const hasErrors = stats.hasErrors();
  const hasWarnings = stats.hasWarnings();

  if (!hasErrors && !hasWarnings && isFirstCompile) {
    console.log('First compilation completed successfully.');
    
    if (isBrowserTarget) {
      open(`http://localhost:${PORT}`);
    } else {
      onCompilationComplete();
    }
    
    isFirstCompile = false;
  }
});

app.listen(PORT, '0.0.0.0', err => {
  if (err) {
    console.error(err);
    return;
  }

  console.log(`Listening at http://localhost:${PORT}`);
});
