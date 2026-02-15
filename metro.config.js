const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package exports to use react-native specific exports (like axios browser version)
config.resolver.unstable_enablePackageExports = true;

// Exclude electron, dist, and web-build folders from Metro bundler
config.resolver.blockList = [
  /electron\/.*/,
  /dist\/.*/,
  /web-build\/.*/,
  /.*\/electron\/.*/,
  /.*\\electron\\.*/
];

module.exports = config;