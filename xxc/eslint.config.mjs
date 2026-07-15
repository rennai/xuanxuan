// ESLint 9 flat config（喧喧客户端浏览器开发基线）
// 取代旧 .eslintrc（airbnb）+ .eslintignore。
// 规则覆盖：以各插件 recommended 为基底（恢复大部分 airbnb 覆盖），
// 再叠加从旧 .eslintrc 迁移的项目自定义约定（4 空格、object-curly-spacing: never、
// JSX 允许 .js/.jsx、react/sort-comp 等）。
// 别名解析对应 vite.config.ts 的 resolve.alias：eslint-import-resolver-vite 需要 viteConfig
// 对象（无法直接 require .ts 且 defineConfig 是函数），故在此按 vite.config.ts 的别名
// 手工构造等价对象（源以 vite.config.ts 为准，别名变更需同步）。
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import importPlugin from 'eslint-plugin-import';
import promise from 'eslint-plugin-promise';
import jsxAllay from 'eslint-plugin-jsx-a11y';
import compat from 'eslint-plugin-compat';
import globals from 'globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 与 vite.config.ts 的 resolve.alias 保持一致（仅含 lint 需解析的别名）
const viteConfig = {
    resolve: {
        alias: [
            {find: 'Platform', replacement: path.resolve(__dirname, 'app/platform/browser/index.js')},
            {find: 'Config', replacement: path.resolve(__dirname, 'app/config')},
            {find: 'ExtsRuntime', replacement: path.resolve(__dirname, 'app/platform/browser/exts.js')},
            {find: 'ExtsView', replacement: path.resolve(__dirname, 'app/platform/browser/exts.js')},
            {find: 'htmlparser', replacement: path.resolve(__dirname, 'shims/htmlparser.js')},
        ],
    },
};

// 插件 recommended 可能是对象或数组，统一拍平后展开
const flat = (config) => (Array.isArray(config) ? config : [config]);

export default [
    {
        // 全局忽略（合并自旧 .eslintignore，仅保留 lint 相关项，丢弃 logs/pids/.DS_Store 等 gitignore 风格条目）
        ignores: [
            'node_modules/**',
            'app/node_modules/**',
            'app/assets/**', // vendored（pace.min.js 等），旧 .eslintignore 的 assets 在任意层级均忽略
            'dist/**',
            'web-dist/**',
            'release/**',
            'coverage/**',
            'lib-cov/**',
            'build/Release/**',
            'app/main.js',
            'app/main.js.map',
            'app/main.development.js',
            'main.js',
            'main.js.map',
            '__snapshots__/**',
            '.idea/**',
            '.eslintcache',
        ],
    },

    // 基底 recommended（叠加 react/promise/jsx-a11y/import/compat，恢复大部分 airbnb 覆盖）
    js.configs.recommended,
    ...flat(react.configs.flat.recommended),
    ...flat(importPlugin.flatConfigs.recommended),
    ...flat(promise.configs['flat/recommended']),
    ...flat(jsxAllay.flatConfigs.recommended),
    ...flat(compat.configs['flat/recommended']),

    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: {jsx: true},
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                DEBUG: 'writable',
                Pace: 'writable',
            },
        },
        settings: {
            react: {version: 'detect'},
            'import/resolver': {
                vite: {viteConfig},
            },
        },
        rules: {
            // —— 以下从旧 .eslintrc 逐条迁移的项目自定义约定（54 条）——
            // 注：旧 .eslintrc 的 valid-jsdoc（warn）在 ESLint 9 已移除，无法迁移，放弃。
            'arrow-parens': 'off',
            'consistent-return': 'off',
            'comma-dangle': 'off',
            'generator-star-spacing': 'off',
            'import/no-extraneous-dependencies': 'off',
            'prefer-destructuring': ['warn', {array: false, object: true}],
            'no-console': 'off',
            'no-use-before-define': 'off',
            'no-multi-assign': 'off',
            'compat/compat': 'off', // 旧配置即关闭；compat recommended 注册插件，但此规则需 browserslist 且噪音大，沿用关闭
            'promise/param-names': 'error',
            'promise/catch-or-return': 'error',
            'promise/no-native': 'off',
            'react/sort-comp': ['error', {
                order: ['type-annotations', 'static-methods', 'lifecycle', 'everything-else', 'render'],
            }],
            'react/jsx-no-bind': 'off',
            'react/jsx-filename-extension': ['error', {extensions: ['.js', '.jsx']}],
            'react/prefer-stateless-function': 'off',
            'react/no-array-index-key': 'warn',
            'object-curly-spacing': ['error', 'never'],
            'indent': ['error', 4],
            'no-unused-vars': 'warn',
            'no-param-reassign': 'off',
            'max-len': 'off',
            'keyword-spacing': 'warn',
            'default-case': 'off',
            'prefer-const': 'warn',
            'react/forbid-prop-types': 'off',
            'block-spacing': ['error', 'never'],
            'jsx-a11y/no-static-element-interactions': 'off',
            'jsx-a11y/anchor-is-valid': 'off',
            'jsx-a11y/click-events-have-key-events': 'off',
            'no-plusplus': 'off',
            'no-bitwise': 'off',
            'no-continue': 'off',
            'no-else-return': 'warn',
            'no-nested-ternary': 'off',
            'no-mixed-operators': 'warn',
            'no-underscore-dangle': 'off',
            'react/jsx-indent': ['warn', 4],
            'react/jsx-indent-props': ['warn', 4],
            'prefer-template': 'warn',
            'no-shadow': 'warn',
            'promise/always-return': 'warn',
            'arrow-body-style': 'warn',
            // 项目依赖 add-module-exports 约定（vite.config.ts 的 jsxInJsPlugin 在构建期
            // 为仅有 named exports 的模块聚合 default export）。该注入对 ESLint 静态导出分析
            // 不可见（旧 babel-module 解析器经 babel 转换可见），故 import/default 会误报，关闭。
            'import/default': 'off',
            'import/no-unresolved': 'warn',
            'import/no-named-as-default-member': 'warn',
            'import/extensions': 'off',
            'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
            'class-methods-use-this': 'warn',
            'no-lonely-if': 'warn',
            'react/jsx-no-target-blank': 'warn',
            'react/jsx-one-expression-per-line': 'off',
            'jsx-a11y/anchor-has-content': 'off',
            'jsx-a11y/media-has-caption': 'off',

            // 以下为各 recommended 自带、但 airbnb 基线未含的新增规则（晚于 airbnb 时代）。
            // 目标是「恢复 airbnb 覆盖」而非超出，故降为 warn：可见但不新增阻断性 error。
            'promise/no-return-wrap': 'warn',
            'no-setter-return': 'warn',
            'no-useless-assignment': 'warn',
            'preserve-caught-error': 'warn',
        },
    },
];
