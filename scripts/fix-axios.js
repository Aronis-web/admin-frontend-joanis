#!/usr/bin/env node
// scripts/fix-axios.js
// Fix axios to use browser version instead of node version in React Native

const fs = require('fs');
const path = require('path');

const axiosPackageJsonPath = path.join(__dirname, '../node_modules/axios/package.json');

console.log('[fix-axios] Starting axios fix script...');
console.log('[fix-axios] Working directory:', process.cwd());
console.log('[fix-axios] Script directory:', __dirname);
console.log('[fix-axios] Looking for axios at:', axiosPackageJsonPath);

// Check if axios is installed
if (!fs.existsSync(axiosPackageJsonPath)) {
  console.log('[fix-axios] ⚠️  axios not found, skipping (this is normal during initial install)');
  console.log('[fix-axios] ✅ Exiting gracefully');
  process.exit(0);
}

console.log('[fix-axios] ✅ axios package.json found');

try {
  const packageJson = JSON.parse(fs.readFileSync(axiosPackageJsonPath, 'utf8'));

  console.log('[fix-axios] Current main:', packageJson.main);
  console.log('[fix-axios] Current module:', packageJson.module);

  // Change main to point to browser version
  packageJson.main = './dist/browser/axios.cjs';

  // Change module to point to browser ESM version
  packageJson.module = './dist/esm/axios.js';

  // Simplify exports to always use browser version
  if (packageJson.exports && packageJson.exports['.']) {
    packageJson.exports['.'] = {
      types: packageJson.exports['.'].types,
      'react-native': './dist/browser/axios.cjs',
      browser: './dist/browser/axios.cjs',
      default: './dist/browser/axios.cjs'
    };
  }

  fs.writeFileSync(axiosPackageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');

  console.log('[fix-axios] ✅ Successfully fixed axios package.json');
  console.log('[fix-axios]    main: ./dist/browser/axios.cjs');
  console.log('[fix-axios]    module: ./dist/esm/axios.js');
  console.log('[fix-axios]    exports: simplified to always use browser version');
  console.log('[fix-axios] ✅ Script completed successfully');
  process.exit(0);
} catch (error) {
  console.error('[fix-axios] ❌ Error fixing axios:', error.message);
  console.error('[fix-axios] Stack trace:', error.stack);
  // Don't fail the build, just warn
  console.error('[fix-axios] ⚠️  Continuing anyway...');
  process.exit(0);
}
