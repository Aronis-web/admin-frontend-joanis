const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable package exports to avoid issues with packages that have incorrect exports configuration
config.resolver.unstable_enablePackageExports = false;

// Exclude electron, dist, and web-build folders from Metro bundler
config.resolver.blockList = [
  /electron\/.*/,
  /dist\/.*/,
  /web-build\/.*/,
  /.*\/electron\/.*/,
  /.*\\electron\\.*/
];

// Force axios to use browser version instead of node version
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'axios') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/axios/dist/esm/axios.js'),
      type: 'sourceFile',
    };
  }

  // Let Metro handle all other modules normally
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;