import path from 'node:path';
import {defineConfig, type Plugin} from 'vite';
import {transform as esbuildTransform} from 'esbuild';

// 喧喧客户端浏览器开发基线（Vite 8）
// 阶段 1：Platform 指向 browser，让现有 React 16 代码在浏览器渲染。
// 不动 React / Electron 版本；详见 doc/upgrade/xxc-upgrade-plan.md
//
// JSX 处理：代码在 .js 中使用 JSX（airbnb 约定）。Vite 8 的 oxc 对 .js 不启用 JSX，
// 且 oxc.include 在 8.1.4 上未生效（bug 或文档与实现不符）。@vitejs/plugin-react@6 也用 oxc
// 且其 config hook 会覆盖 oxc 配置。故用一个自写的 enforce:'pre' 插件，在 oxc 之前用
// esbuild 把 .js/.jsx 的 JSX 转成 React.createElement（classic runtime，React 16.4 无 jsx-runtime）。
// oxc 拿到的已是合法 JS，不再报 "JSX syntax is disabled"。
// class fields（static x=、fn=()=>）为 ES2022，现代 Chromium 原生支持，esbuild 也认。
// 复刻原 .babelrc 的 babel-plugin-add-module-exports 行为：
// 对只有 named exports、没有 export default 的模块，自动追加一个聚合所有 named exports
// 的 default export，使 `import x from './mod'` 能拿到含所有 named 的对象。
// 原项目大量文件依赖此行为（如 core/index.js: import todo from './todo'）。
// 在原始源码（esbuild 转换前）上扫描，追加后再交 esbuild 处理。
function addDefaultExportIfNeeded(code: string): string {
  if (/\bexport\s+default\b/.test(code)) return code;
  const names = new Set<string>();
  // export const/let/var NAME
  const re1 = /\bexport\s+(?:const|let|var)\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re1.exec(code)) !== null) {
    if (m[1].startsWith('{')) {
      m[1].slice(1, -1).split(',').forEach(s => {
        const n = s.split(/\s+as\s+/)[0].trim();
        if (n) names.add(n);
      });
    } else {
      names.add(m[1]);
    }
  }
  // export function NAME
  const re2 = /\bexport\s+function\s+([A-Za-z_$][\w$]*)/g;
  while ((m = re2.exec(code)) !== null) {
    names.add(m[1]);
  }
  // export class NAME
  const re3 = /\bexport\s+class\s+([A-Za-z_$][\w$]*)/g;
  while ((m = re3.exec(code)) !== null) {
    names.add(m[1]);
  }
  if (names.size === 0) return code;
  const list = Array.from(names).join(', ');
  return `${code}\nexport default {${list}};\n`;
}

function jsxInJsPlugin(): Plugin {
  const appDir = path.resolve(__dirname, 'app');
  return {
    name: 'xxc-jsx-in-js',
    enforce: 'pre',
    async transform(code, id) {
      // 只处理 app/ 下的 .js/.jsx（跳过 node_modules、?query 虚拟模块）
      if (!id.startsWith(appDir)) return null;
      if (!/\.(jsx?)$/.test(id)) return null;
      if (id.includes('?')) return null;
      const withDefault = addDefaultExportIfNeeded(code);
      try {
        const result = await esbuildTransform(withDefault, {
          loader: 'jsx',
          jsxFactory: 'React.createElement',
          jsxFragment: 'React.Fragment',
          target: 'es2022',
          sourcemap: 'inline',
        });
        return {code: result.code, map: result.map ? JSON.parse(result.map) : undefined};
      } catch {
        // 转换失败交给后续 oxc 报错，不掩盖
        return null;
      }
    },
  };
}

export default defineConfig(({command}) => ({
  root: path.resolve(__dirname, 'app'),
  publicDir: false,

  plugins: [jsxInJsPlugin()],

  resolve: {
    alias: [
      {find: 'Platform', replacement: path.resolve(__dirname, 'app/platform/browser/index.js')},
      {find: 'Config', replacement: path.resolve(__dirname, 'app/config')},
      // 浏览器不支持扩展，指向 false 存根（不指向 exts/runtime.js，避免拖入 Node import）
      {find: 'ExtsRuntime', replacement: path.resolve(__dirname, 'app/platform/browser/exts.js')},
      {find: 'ExtsView', replacement: path.resolve(__dirname, 'app/platform/browser/exts.js')},
      // htmlparser@1.7.7 用 `this.Tautologistics` 依赖顶层 this=global，Vite ESM 下崩溃；
      // 用浏览器原生 DOMParser 的最小 shim 替代（markdown.js 仅用 Parser/DefaultHandler）
      {find: 'htmlparser', replacement: path.resolve(__dirname, 'shims/htmlparser.js')},
    ],
  },

  define: {
    DEBUG: command === 'serve' ? 'true' : 'false',
  },

  server: {
    port: 5173,
    host: '127.0.0.1',
  },
}));
