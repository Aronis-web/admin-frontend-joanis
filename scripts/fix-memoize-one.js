#!/usr/bin/env node

/**
 * Fix memoize-one package resolution issue
 * This script ensures memoize-one 6.0.0 is installed correctly
 */

const fs = require('fs');
const path = require('path');

const memoizeOnePath = path.join(__dirname, '..', 'node_modules', 'memoize-one');
const packageJsonPath = path.join(memoizeOnePath, 'package.json');

console.log('🔧 Checking memoize-one installation...');

if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log(`📦 Found memoize-one version: ${packageJson.version}`);

  // Check if the main file exists
  const mainFile = path.join(memoizeOnePath, packageJson.main || 'dist/memoize-one.cjs.js');

  if (!fs.existsSync(mainFile)) {
    console.log(`❌ Main file not found: ${mainFile}`);
    console.log('🔄 Attempting to fix...');

    // Try to find the correct file
    const distDir = path.join(memoizeOnePath, 'dist');
    if (fs.existsSync(distDir)) {
      const files = fs.readdirSync(distDir);
      console.log(`📁 Files in dist: ${files.join(', ')}`);

      // Look for .esm.js or .js files
      const esmFile = files.find(f => f.endsWith('.esm.js'));
      const jsFile = files.find(f => f.endsWith('.js') && !f.endsWith('.esm.js'));
      const mjsFile = files.find(f => f.endsWith('.mjs'));

      if (esmFile || jsFile || mjsFile) {
        const correctFile = esmFile || jsFile || mjsFile;
        packageJson.main = `dist/${correctFile}`;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(`✅ Updated main to: dist/${correctFile}`);
      } else {
        console.log('❌ No suitable file found in dist directory');
      }
    } else {
      // If dist doesn't exist, check root directory
      const rootFiles = fs.readdirSync(memoizeOnePath);
      console.log(`📁 Files in root: ${rootFiles.join(', ')}`);

      const jsFile = rootFiles.find(f => f.endsWith('.js') && f !== 'package.json');
      if (jsFile) {
        packageJson.main = jsFile;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(`✅ Updated main to: ${jsFile}`);
      }
    }
  } else {
    console.log('✅ memoize-one is correctly installed');
  }
} else {
  console.log('⚠️ memoize-one not found in node_modules');
}
