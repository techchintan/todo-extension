const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  entry: {
    popup: path.resolve('src/popup/popup.jsx'),
    options: path.resolve('src/options/options.jsx'),
    background: path.resolve('src/background/background.js'),
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(jpg|jpeg|png|woff|woff2|eot|ttf|svg)$/,
        type: 'asset/resource'
      }
    ]
  },
  resolve: {
    extensions: ['.jsx', '.js'],
  },
  
  plugins: [
    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false,
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve('src/static'),
          to: path.resolve('dist'),
        }
      ]
    }),
    ...getHtmlPlugins([
      'popup',
      'options'
    ]),
  ],
  output: {
    filename: '[name].js',
    path: path.resolve('dist'),
  },
  // Keep each extension page self-contained. Split chunks cause blank
  // options/popup pages when watch and production builds overwrite dist.
  optimization: {
    runtimeChunk: false,
    splitChunks: false,
  }
}

function getHtmlPlugins(chunks) {
  return chunks.map(chunk => new HtmlPlugin({
    title: 'QuickTask',
    filename: `${chunk}.html`,
    chunks: [chunk],
  }))
}
