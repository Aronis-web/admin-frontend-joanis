const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable package exports - we'll use custom resolver instead
config.resolver.unstable_enablePackageExports = false;

// Exclude electron, dist, and web-build folders from Metro bundler
config.resolver.blockList = [
  /electron\/.*/,
  /dist\/.*/,
  /web-build\/.*/,
  /.*\/electron\/.*/,
  /.*\\electron\\.*/
];

// Custom resolver to force axios to use browser version
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force axios to use browser version
  if (moduleName === 'axios') {
    const axiosBrowserPath = path.join(
      __dirname,
      'node_modules/axios/dist/browser/axios.cjs'
    );

    return {
      filePath: axiosBrowserPath,
      type: 'sourceFile',
    };
  }

  // Use default resolver for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;