const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure proper module resolution
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Exclude electron folder from the bundle (it's only for desktop builds)
config.resolver.blockList = [
  /electron\/.*/,
  /.*\.test\.(js|ts|tsx)$/,
];

// Don't resolve these Node.js modules in the web bundle
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Block electron-related modules from being bundled
  if (moduleName === 'electron' ||
      moduleName === 'electron-updater' ||
      moduleName.startsWith('electron/')) {
    return {
      type: 'empty',
    };
  }

  // Use default resolution for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;