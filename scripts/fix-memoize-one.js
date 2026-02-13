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
const pkgDir = path.join(cwd, "node_modules", "memoize-one");
const distDir = path.join(pkgDir, "dist");
const targetFile = path.join(distDir, "memoize-one.cjs.js");

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
console.log("[fix-memoize-one] distDir list after:", listDir(distDir));

if (!fs.existsSync(targetFile)) {
  console.error("[fix-memoize-one] FAILED to create target file. FAIL.");
  process.exit(1);
}
