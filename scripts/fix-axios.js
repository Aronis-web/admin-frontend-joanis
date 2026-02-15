// scripts/fix-axios.js
// Fix axios to use browser version instead of node version in React Native

const fs = require('fs');
const path = require('path');

const axiosPackageJsonPath = path.join(__dirname, '../node_modules/axios/package.json');

console.log('[fix-axios] Fixing axios to use browser version...');

try {
  const packageJson = JSON.parse(fs.readFileSync(axiosPackageJsonPath, 'utf8'));

  // Change main to point to browser version
  packageJson.main = './dist/browser/axios.cjs';

  // Change module to point to browser ESM version
  packageJson.module = './dist/esm/axios.js';

  fs.writeFileSync(axiosPackageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');

  console.log('[fix-axios] ✅ Successfully fixed axios package.json');
  console.log('[fix-axios]    main: ./dist/browser/axios.cjs');
  console.log('[fix-axios]    module: ./dist/esm/axios.js');
} catch (error) {
  console.error('[fix-axios] ❌ Error fixing axios:', error.message);
  process.exit(1);
}
