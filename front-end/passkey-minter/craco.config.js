const webpack = require('webpack');

module.exports = {
    webpack: {
        configure: (webpackConfig) => {
            webpackConfig.resolve.fallback = {
                ...webpackConfig.resolve.fallback,
                "stream": require.resolve("stream-browserify"),
                "buffer": require.resolve("buffer"),
                "process": require.resolve("process/browser"), // ✅ Add this line
            };
            webpackConfig.plugins = [
                ...webpackConfig.plugins,
                new webpack.ProvidePlugin({
                    Buffer: ["buffer", "Buffer"],
                    process: "process/browser", // ✅ Add this line
                }),
            ];
            return webpackConfig;
        },
    },
};