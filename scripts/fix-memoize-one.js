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
const sentryDistDir = path.join(sentryPkgDir, "dist", "js");
const sentryPkgJsonFile = path.join(sentryPkgDir, "package.json");

console.log("[fix-sentry] sentryPkgDir:", sentryPkgDir);
console.log("[fix-sentry] sentryDistDir exists?", fs.existsSync(sentryDistDir));
console.log("[fix-sentry] sentryDistDir list:", listDir(sentryDistDir));

if (fs.existsSync(sentryPkgDir)) {
  // Copiar el archivo a la raíz del paquete
  const sentryRootFile = path.join(sentryPkgDir, "index.js");
  try {
    const sentrySourceFile = path.join(sentryDistDir, "index.js");
    if (fs.existsSync(sentrySourceFile)) {
      fs.copyFileSync(sentrySourceFile, sentryRootFile);
      console.log("[fix-sentry] Copied to root:", sentryRootFile);
    } else {
      console.log("[fix-sentry] Source file not found, will update package.json anyway");
    }
  } catch (e) {
    console.error("[fix-sentry] Failed to copy to root:", e.message);
  }

  // Cambiar el package.json
  try {
    const sentryPkgJson = JSON.parse(fs.readFileSync(sentryPkgJsonFile, "utf8"));
    console.log("[fix-sentry] Original main:", sentryPkgJson.main);
    sentryPkgJson.main = "index.js";
    fs.writeFileSync(sentryPkgJsonFile, JSON.stringify(sentryPkgJson, null, 2), "utf8");
    console.log("[fix-sentry] Updated package.json main to:", sentryPkgJson.main);
  } catch (e) {
    console.error("[fix-sentry] Failed to update package.json:", e.message);
  }
} else {
  console.log("[fix-sentry] @sentry/react-native not found, skipping");
}
