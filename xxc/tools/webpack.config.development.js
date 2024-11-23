/* eslint-disable max-len */
/**
 * Build config for development process that uses Hot-Module-Replacement
 * https://webpack.github.io/docs/hot-module-replacement-with-webpack.html
 */

import { fileURLToPath } from 'url';
import path from 'path';
import webpack from 'webpack';
import { merge } from 'webpack-merge';
import baseConfig from './webpack.config.base.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = process.env.PORT || 3000;

export default merge(baseConfig, {
  mode: 'development',
  target: 'electron-renderer',

  devtool: 'eval-source-map',

  entry: {
    bundle: [
      `webpack-hot-middleware/client?path=http://localhost:${port}/__webpack_hmr`,
      './app/index'
    ],
  },

  output: {
    path: path.join(__dirname, '../app/dist'),
    publicPath: `http://localhost:${port}/dist/`,
    filename: '[name].js',
  },

  module: {
    rules: [
      // Fonts
      {
        test: /\.(woff|woff2|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10 * 1024 // 10kb
          }
        },
        generator: {
          filename: 'fonts/[name][ext]'
        }
      },
      {
        test: /\.less$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
              importLoaders: 1
            }
          },
          {
            loader: 'less-loader',
            options: {
              sourceMap: true,
              lessOptions: {
                strictMath: true,
                noIeCompat: true
              }
            }
          }
        ]
      }
    ]
  },

  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
      DEBUG: true
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true
    })
  ],
});
