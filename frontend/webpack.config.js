const internalIp = require("internal-ip");
const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const Dotenv = require("dotenv-webpack");

const PUBLIC_PATH = "/static/frontend/";
const DEV_PREFIX = "/dendrobium";

const PORT = 4000;

const PRODUCTION_MODE = process.env.NODE_ENV === "production";
const copyPatterns = PRODUCTION_MODE
  ? [{ from: "public" }]
  : [{ from: "public", ignore: ["**/Data/**"] }];

if (!PRODUCTION_MODE) {
  console.log(
    `\n\nWhen done building, your application will be available at http://${internalIp.v4.sync()}:${PORT}\n\n\n`
  );
}

module.exports = {
  context: __dirname,
  mode: process.env.NODE_ENV || "development",
  entry: ["./index.tsx"],
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, PUBLIC_PATH.replace("/", "")),
    publicPath: PRODUCTION_MODE ? PUBLIC_PATH : "auto",
  },
  devtool: "source-map",
  resolve: {
    extensions: [".ts", ".tsx", ".mjs", ".js", ".json", ".css"],
    alias: {
      "@": path.resolve("lib"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "@phylocanvas/phylocanvas.gl": path.resolve(
        __dirname,
        "node_modules/@phylocanvas/phylocanvas.gl/dist/bundle.min.js"
      ),
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(
        __dirname,
        "templates",
        "frontend",
        PRODUCTION_MODE ? "" : "dev",
        "index.html"
      ),
      filename: "index.html",
      inject: PRODUCTION_MODE,
    }),
    new CopyWebpackPlugin(copyPatterns),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.optimize.AggressiveMergingPlugin(),
    new Dotenv(),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          configFile: "tsconfig.json",
        },
        exclude: [/node_modules/],
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.txt$/,
        resourceQuery: /raw/,
        type: "asset/source",
      },
      {
        enforce: "pre",
        test: /\.js$/,
        loader: "source-map-loader",
        exclude: [/node_modules/],
      },
      {
        test: /\.(woff2|png|jp(e*)g|gif|svg)$/,
        loader: "file-loader",
        options: {
          name: "icons|fonts/[name].[ext]",
          outputPath: PUBLIC_PATH,
        },
      },
    ],
  },
  devServer: {
    //watchFiles: `.${PUBLIC_PATH}`,
    compress: true,
    port: PORT,
    hot: true,
    open: true,
    historyApiFallback: {
      rewrites: [
        { from: /^\/dendrobium(?:\/.*)?$/, to: "/index.html" },
        { from: /./, to: "/index.html" },
      ],
    },
    allowedHosts: "all",
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        return middlewares;
      }

      devServer.app.use((req, _res, next) => {
        if (!req.url) {
          next();
          return;
        }

        if (
          req.url === `${DEV_PREFIX}/Data` ||
          req.url.startsWith(`${DEV_PREFIX}/Data/`)
        ) {
          next();
          return;
        }

        if (req.url.startsWith(`${DEV_PREFIX}/`)) {
          req.url = req.url.slice(DEV_PREFIX.length) || "/";
        }
        next();
      });

      return middlewares;
    },
    static: [
      {
        directory: path.join(__dirname, "public", "Data"),
        publicPath: `${DEV_PREFIX}/Data`,
        watch: false, // 提供即時 Data 檔案，避免 in-memory stale assets
      },
    ],
  },
};
