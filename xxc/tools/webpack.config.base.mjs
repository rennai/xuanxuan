/**
 * Base webpack config used across other specific configs
 */

import path from 'path';
import { fileURLToPath } from 'url';
import appPkg from '../app/package.json' assert { type: "json" };
const externals = appPkg.dependencies || {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: 'production',
  target: 'electron-renderer',

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            presets: [
              '@babel/preset-env',
              '@babel/preset-react'
            ],
            plugins: [
              '@babel/plugin-proposal-class-properties',
              '@babel/plugin-transform-runtime'
            ]
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.less$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                javascriptEnabled: true,
                math: 'always',
              },
            },
          },
        ],
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024, // 8kb
          },
        },
      },
    ],
  },

  output: {
    path: path.join(__dirname, '../app'),
    filename: '[name].js',
    publicPath: '/',
    library: {
      type: 'commonjs2',
    },
  },

  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    mainFields: ['browser', 'module', 'main'],
    alias: {
      Platform: path.resolve(__dirname, '../app/platform/electron'),
      Config: path.resolve(__dirname, '../app/config/'),
      ExtsRuntime: path.resolve(__dirname, '../app/exts/runtime.js'),
      ExtsView: path.resolve(__dirname, '../app/views/exts/index.js'),
    },
    modules: [
      path.join(__dirname, '../app'),
      'node_modules',
    ],
  },

  plugins: [],

  externals: [...Object.keys(externals || {}), 'electron-debug'],

  optimization: {
    moduleIds: 'deterministic',
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
        },
      },
    },
  },
};
