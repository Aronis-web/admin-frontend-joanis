const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure proper module resolution
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Disable package exports to avoid issues with packages that have incorrect exports configuration
config.resolver.unstable_enablePackageExports = false;

// Resolve memoize-one to the ESM version to avoid missing CJS file issue
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'memoize-one') {
    return {
      filePath: require.resolve('memoize-one/dist/memoize-one.esm.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

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

module.exports = config;