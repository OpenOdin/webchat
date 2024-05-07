const path = require("path");
const webpack = require("webpack");

module.exports = {
    mode: "production",
    entry: "./build/Globals.js",
    output: {
        path: path.resolve(__dirname, "build"),
        filename: "./Globals-browser.js",
        pathinfo: true,
        library: {
            type: "umd",
            name: "add",
        }
    },
    resolve: {
        alias: {
            "fs": false,
            "http": false,
            "os": false,
            "net": false,
            "tls": false,
            "https": false,
            "sqlite3": false,
            "postgresql-client": false
        },
        extensions: [".tsx", ".ts", ".js"],
        fallback: {
            crypto: require.resolve("crypto-browserify"),
            path:   require.resolve("path-browserify"),
            stream: require.resolve("stream-browserify"),
            buffer: require.resolve("buffer/")
        }
    },
    module: {
          noParse: /\/node_modules\/process\//,
    },
    plugins: [
          new webpack.ProvidePlugin({
              process: "process/browser.js",
          }),
          new webpack.DefinePlugin({
              process: {
                  env: {
                      "process.env.NODE_ENV" : JSON.stringify("production")
                  }
              }
        })
    ]
};
