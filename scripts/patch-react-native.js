// scripts/patch-react-native.js
// Patch React Native's setUpXHR.js to use a different import for abort-controller

const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('PATCHING REACT NATIVE setUpXHR.js');
console.log('========================================\n');

const workingDir = process.cwd();
const setUpXHRPath = path.join(
  workingDir,
  'node_modules',
  'react-native',
  'Libraries',
  'Core',
  'setUpXHR.js'
);

console.log('[patch-rn] Working directory:', workingDir);
console.log('[patch-rn] Target file:', setUpXHRPath);

if (!fs.existsSync(setUpXHRPath)) {
  console.error('[patch-rn] ❌ File not found:', setUpXHRPath);
  process.exit(1);
}

// Read the file
let content = fs.readFileSync(setUpXHRPath, 'utf8');
console.log('[patch-rn] File read successfully');

// Check if already patched
if (content.includes('// PATCHED BY scripts/patch-react-native.js')) {
  console.log('[patch-rn] ✅ File already patched, skipping');
  process.exit(0);
}

// Replace the problematic import
const originalImport = `  () => require('abort-controller/dist/abort-controller').AbortController, // flowlint-line untyped-import:off`;
const patchedImport = `  () => {
    // PATCHED BY scripts/patch-react-native.js
    try {
      return require('abort-controller/dist/abort-controller.js').AbortController;
    } catch (e1) {
      try {
        return require('abort-controller').AbortController;
      } catch (e2) {
        console.warn('[React Native] Could not load AbortController, using stub');
        return class AbortController {
          constructor() { this.signal = { aborted: false }; }
          abort() { this.signal.aborted = true; }
        };
      }
    }
  }, // flowlint-line untyped-import:off`;

if (!content.includes(originalImport)) {
  console.error('[patch-rn] ❌ Original import pattern not found in file');
  console.error('[patch-rn] File might have been updated. Please check manually.');
  process.exit(1);
}

// Apply the patch
content = content.replace(originalImport, patchedImport);

// Also patch AbortSignal
const originalSignalImport = `  () => require('abort-controller/dist/abort-controller').AbortSignal, // flowlint-line untyped-import:off`;
const patchedSignalImport = `  () => {
    // PATCHED BY scripts/patch-react-native.js
    try {
      return require('abort-controller/dist/abort-controller.js').AbortSignal;
    } catch (e1) {
      try {
        return require('abort-controller').AbortSignal;
      } catch (e2) {
        console.warn('[React Native] Could not load AbortSignal, using stub');
        return class AbortSignal {
          constructor() { this.aborted = false; }
        };
      }
    }
  }, // flowlint-line untyped-import:off`;

if (content.includes(originalSignalImport)) {
  content = content.replace(originalSignalImport, patchedSignalImport);
}

// Write the patched file
fs.writeFileSync(setUpXHRPath, content, 'utf8');

console.log('[patch-rn] ✅ File patched successfully');
console.log('[patch-rn] Applied fallback import logic for AbortController and AbortSignal');
console.log('\n========================================\n');
