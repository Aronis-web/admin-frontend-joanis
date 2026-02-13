const { getDefaultConfig } = require('expo/metro-config');

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

module.exports = config;