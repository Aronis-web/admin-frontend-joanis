const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure proper module resolution
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Exclude electron, dist, and web-build folders from Metro bundler
config.resolver.blockList = [
  /electron\/.*/,
  /dist\/.*/,
  /web-build\/.*/,
  /.*\/electron\/.*/,
  /.*\\electron\\.*/
];

// Watchman configuration to ignore folders
config.watchFolders = [path.resolve(__dirname)];
config.resolver.watchFolders = [path.resolve(__dirname)];

// Explicitly set source extensions and asset extensions
config.resolver.sourceExts = ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs'];
config.resolver.assetExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ttf', 'otf', 'woff', 'woff2'];

// Alias memoize-one to vendored version
config.resolver.extraNodeModules = {
  'memoize-one': path.resolve(__dirname, 'vendor/memoize-one'),
};

module.exports = config;