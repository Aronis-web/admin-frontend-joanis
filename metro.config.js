const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure proper module resolution
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Exclude test files from bundle
config.resolver.blockList = [
  /.*\.test\.(js|ts|tsx)$/,
];

// Handle Node.js and Electron modules that shouldn't be in web bundle
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Return empty module for electron-specific packages
  const electronModules = [
    'electron',
    'electron-updater',
    'express',
  ];

  if (electronModules.includes(moduleName)) {
    return {
      type: 'empty',
    };
  }

  // Use default resolution for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;