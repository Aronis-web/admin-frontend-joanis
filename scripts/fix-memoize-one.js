// scripts/fix-memoize-one.js
const fs = require("fs");
const path = require("path");

function listDir(p) {
  try {
    return fs.readdirSync(p);
  } catch (e) {
    return null;
  }
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const cwd = process.cwd();

// Fix memoize-one
const pkgDir = path.join(cwd, "node_modules", "memoize-one");
const distDir = path.join(pkgDir, "dist");
const targetFile = path.join(distDir, "memoize-one.cjs.js");
const pkgJsonFile = path.join(pkgDir, "package.json");

console.log("[fix-memoize-one] cwd:", cwd);
console.log("[fix-memoize-one] pkgDir:", pkgDir);
console.log("[fix-memoize-one] distDir exists?", fs.existsSync(distDir));
console.log("[fix-memoize-one] distDir list:", listDir(distDir));

if (!fs.existsSync(pkgDir)) {
  console.error("[fix-memoize-one] memoize-one not found. FAIL.");
  process.exit(1);
}

ensureDir(distDir);

// SIEMPRE reescribe el archivo (para que nada lo deje a medias)
const code = `'use strict';

function defaultIsEqual(newArgs, lastArgs) {
  if (newArgs.length !== lastArgs.length) return false;
  for (var i = 0; i < newArgs.length; i++) {
    if (newArgs[i] !== lastArgs[i]) return false;
  }
  return true;
}

function memoizeOne(resultFn, isEqual) {
  if (typeof resultFn !== 'function') {
    throw new Error('memoize-one: expected a function');
  }

  var equalityFn = typeof isEqual === 'function' ? isEqual : defaultIsEqual;

  var lastThis;
  var lastArgs = null;
  var lastResult;
  var called = false;

  function memoized() {
    var newThis = this;
    var newArgs = Array.prototype.slice.call(arguments);

    if (called && lastArgs && lastThis === newThis && equalityFn(newArgs, lastArgs)) {
      return lastResult;
    }

    lastThis = newThis;
    lastArgs = newArgs;
    lastResult = resultFn.apply(newThis, newArgs);
    called = true;
    return lastResult;
  }

  memoized.clear = function () {
    called = false;
    lastThis = undefined;
    lastArgs = null;
    lastResult = undefined;
  };

  return memoized;
}

module.exports = memoizeOne;
module.exports.default = memoizeOne;
module.exports.memoizeOne = memoizeOne;
`;

fs.writeFileSync(targetFile, code, "utf8");

console.log("[fix-memoize-one] wrote:", targetFile);
console.log("[fix-memoize-one] file exists now?", fs.existsSync(targetFile));

// Copiar el archivo a la raíz del paquete para que Metro lo encuentre
const rootFile = path.join(pkgDir, "index.js");
try {
  const sourceFile = path.join(distDir, "memoize-one.js");
  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, rootFile);
    console.log("[fix-memoize-one] Copied to root:", rootFile);
  }
} catch (e) {
  console.error("[fix-memoize-one] Failed to copy to root:", e.message);
}

// Cambiar el package.json para que apunte al archivo en la raíz
try {
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile, "utf8"));
  pkgJson.main = "index.js";
  fs.writeFileSync(pkgJsonFile, JSON.stringify(pkgJson, null, 2), "utf8");
  console.log("[fix-memoize-one] Updated package.json main to:", pkgJson.main);
} catch (e) {
  console.error("[fix-memoize-one] Failed to update package.json:", e.message);
}

console.log("[fix-memoize-one] distDir list after:", listDir(distDir));

if (!fs.existsSync(targetFile)) {
  console.error("[fix-memoize-one] FAILED to create target file. FAIL.");
  process.exit(1);
}

// Fix @sentry/react-native
console.log("\n[fix-sentry] Starting Sentry fix...");
const sentryPkgDir = path.join(cwd, "node_modules", "@sentry", "react-native");
const sentryDistDir = path.join(sentryPkgDir, "dist");
const sentryPkgJsonFile = path.join(sentryPkgDir, "package.json");

console.log("[fix-sentry] sentryPkgDir:", sentryPkgDir);
console.log("[fix-sentry] sentryDistDir exists?", fs.existsSync(sentryDistDir));
console.log("[fix-sentry] sentryDistDir list:", listDir(sentryDistDir));

if (fs.existsSync(sentryPkgDir)) {
  try {
    const sentryPkgJson = JSON.parse(fs.readFileSync(sentryPkgJsonFile, "utf8"));
    console.log("[fix-sentry] Original main:", sentryPkgJson.main);

    // Verificar si el archivo principal existe
    const originalMain = sentryPkgJson.main || "dist/js/index.js";
    const originalMainPath = path.join(sentryPkgDir, originalMain);
    console.log("[fix-sentry] Original main path:", originalMainPath);
    console.log("[fix-sentry] Original main exists?", fs.existsSync(originalMainPath));

    // Intentar leer el archivo para verificar si realmente es accesible
    let canReadFile = false;
    try {
      fs.readFileSync(originalMainPath, "utf8");
      canReadFile = true;
      console.log("[fix-sentry] File is readable: true");
    } catch (e) {
      console.log("[fix-sentry] File is readable: false -", e.message);
    }

    // Si el archivo existe pero no se puede leer, o no existe, necesitamos crear uno
    if (!canReadFile) {
      console.log("[fix-sentry] Creating fallback index.js file...");

      // Asegurar que el directorio dist/js existe
      const distJsDir = path.join(sentryPkgDir, "dist", "js");
      ensureDir(distJsDir);

      // Crear un archivo index.js que re-exporte desde el paquete base
      const sentryFallbackCode = `// Auto-generated by scripts/fix-memoize-one.js
// This file was created because the original dist/js/index.js was not readable
'use strict';

// Re-export everything from @sentry/browser and add React Native specific exports
const browser = require('@sentry/browser');
const react = require('@sentry/react');

// Export all browser SDK exports
Object.keys(browser).forEach(function(key) {
  if (key !== 'default' && key !== '__esModule') {
    exports[key] = browser[key];
  }
});

// Export all React SDK exports
Object.keys(react).forEach(function(key) {
  if (key !== 'default' && key !== '__esModule') {
    exports[key] = react[key];
  }
});

// Add React Native specific exports
exports.init = function(options) {
  console.log('[Sentry] Using fallback initialization');
  if (browser.init) {
    return browser.init(options);
  }
};

exports.wrap = function(fn) {
  return fn;
};

exports.nativeCrash = function() {
  console.warn('[Sentry] nativeCrash not available in fallback mode');
};

exports.flush = function() {
  if (browser.flush) {
    return browser.flush();
  }
  return Promise.resolve();
};

exports.close = function() {
  if (browser.close) {
    return browser.close();
  }
  return Promise.resolve();
};

exports.withScope = browser.withScope || function(callback) {
  callback({});
};

exports.crashedLastRun = function() {
  return Promise.resolve(false);
};

console.log('[Sentry] Loaded fallback React Native SDK');
`;

      fs.writeFileSync(originalMainPath, sentryFallbackCode, "utf8");
      console.log("[fix-sentry] Created fallback file at:", originalMainPath);

      // Verificar que ahora se puede leer
      try {
        fs.readFileSync(originalMainPath, "utf8");
        console.log("[fix-sentry] Fallback file is now readable: true");
      } catch (e) {
        console.error("[fix-sentry] ERROR: Fallback file still not readable:", e.message);
      }
    } else {
      console.log("[fix-sentry] Original main exists and is readable, no fix needed");
    }
  } catch (e) {
    console.error("[fix-sentry] Failed to fix Sentry:", e.message);
    console.error("[fix-sentry] Stack:", e.stack);
  }
} else {
  console.log("[fix-sentry] @sentry/react-native not found, skipping");
}
