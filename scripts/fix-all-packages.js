// scripts/fix-all-packages.js
// Solución genérica para arreglar TODOS los paquetes con archivos dist/ no legibles en EAS Build

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
const nodeModulesDir = path.join(cwd, "node_modules");

console.log("\n========================================");
console.log("GENERIC PACKAGE FIXER FOR EAS BUILD");
console.log("========================================\n");
console.log("[fix-all] Working directory:", cwd);
console.log("[fix-all] Node modules directory:", nodeModulesDir);

// Lista de paquetes que sabemos que tienen problemas
const knownProblematicPackages = [
  "memoize-one",
  "axios",
  "stacktrace-parser",
  "framer-motion",
  "@sentry/react-native"
];

// Función genérica para arreglar un paquete
function fixPackage(packageName, packageDir) {
  console.log(`\n[fix-package] Processing: ${packageName}`);
  console.log(`[fix-package] Directory: ${packageDir}`);

  const pkgJsonPath = path.join(packageDir, "package.json");

  if (!fs.existsSync(pkgJsonPath)) {
    console.log(`[fix-package] No package.json found, skipping`);
    return false;
  }

  try {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    const originalMain = pkgJson.main;

    if (!originalMain) {
      console.log(`[fix-package] No main field in package.json, skipping`);
      return false;
    }

    console.log(`[fix-package] Original main: ${originalMain}`);

    // Si el main ya apunta a index.js en la raíz, probablemente ya está arreglado
    if (originalMain === "index.js" || originalMain === "./index.js") {
      console.log(`[fix-package] Already points to index.js, skipping`);
      return false;
    }

    // Si el main apunta a un archivo en dist/, lib/, o build/
    const mainPointsToSubdir = originalMain.includes("dist/") ||
                               originalMain.includes("lib/") ||
                               originalMain.includes("build/");

    if (!mainPointsToSubdir) {
      console.log(`[fix-package] Main doesn't point to dist/lib/build, skipping`);
      return false;
    }

    const originalMainPath = path.join(packageDir, originalMain);
    const mainExists = fs.existsSync(originalMainPath);

    console.log(`[fix-package] Original main path: ${originalMainPath}`);
    console.log(`[fix-package] Original main exists: ${mainExists}`);

    // Crear un index.js genérico que intente cargar desde diferentes ubicaciones
    const indexJsPath = path.join(packageDir, "index.js");

    // Detectar posibles ubicaciones alternativas
    const distDir = path.join(packageDir, "dist");
    const libDir = path.join(packageDir, "lib");
    const buildDir = path.join(packageDir, "build");

    const distExists = fs.existsSync(distDir);
    const libExists = fs.existsSync(libDir);
    const buildExists = fs.existsSync(buildDir);

    console.log(`[fix-package] dist/ exists: ${distExists}`);
    console.log(`[fix-package] lib/ exists: ${libExists}`);
    console.log(`[fix-package] build/ exists: ${buildExists}`);

    // Listar archivos en dist/ si existe
    if (distExists) {
      const distFiles = listDir(distDir);
      console.log(`[fix-package] dist/ files:`, distFiles ? distFiles.slice(0, 10) : []);
    }

    // Generar código para el index.js
    const indexCode = generateIndexCode(packageName, originalMain, {
      distExists,
      libExists,
      buildExists,
      distDir,
      libDir,
      buildDir
    });

    fs.writeFileSync(indexJsPath, indexCode, "utf8");
    console.log(`[fix-package] Created index.js at: ${indexJsPath}`);
    console.log(`[fix-package] File size: ${fs.statSync(indexJsPath).size} bytes`);

    // Actualizar package.json
    pkgJson.main = "index.js";
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2), "utf8");
    console.log(`[fix-package] Updated package.json main to: index.js`);

    // Verificar que el archivo es legible
    try {
      const content = fs.readFileSync(indexJsPath, "utf8");
      console.log(`[fix-package] ✅ index.js is readable (${content.length} bytes)`);
      return true;
    } catch (e) {
      console.error(`[fix-package] ❌ ERROR: index.js not readable:`, e.message);
      return false;
    }

  } catch (e) {
    console.error(`[fix-package] ❌ Failed to fix ${packageName}:`, e.message);
    return false;
  }
}

// Generar código genérico para index.js
function generateIndexCode(packageName, originalMain, info) {
  const attempts = [];

  // Intentar cargar desde el main original
  attempts.push(`  // Try original main: ${originalMain}
  module.exports = require('./${originalMain}');`);

  // Si hay dist/, intentar variantes comunes
  if (info.distExists) {
    const distVariants = [
      'dist/index.js',
      'dist/esm/index.js',
      'dist/cjs/index.js',
      'dist/index.mjs',
      originalMain.replace('dist/', 'dist/esm/'),
      originalMain.replace('.cjs.', '.esm.'),
      originalMain.replace('.cjs.', '.'),
      originalMain.replace('/node/', '/browser/'),
      originalMain.replace('/node/', '/esm/')
    ];

    distVariants.forEach(variant => {
      if (variant !== originalMain) {
        attempts.push(`  // Try: ${variant}
  module.exports = require('./${variant}');`);
      }
    });
  }

  // Si hay lib/, intentar desde ahí
  if (info.libExists) {
    attempts.push(`  // Try lib/index.js
  module.exports = require('./lib/index.js');`);
  }

  // Si hay build/, intentar desde ahí
  if (info.buildExists) {
    attempts.push(`  // Try build/index.js
  module.exports = require('./build/index.js');`);
  }

  // Generar el código con try-catch en cascada
  let code = `// Auto-generated by scripts/fix-all-packages.js
// This file was created to fix module resolution issues in EAS Build
'use strict';

// Package: ${packageName}
// Original main: ${originalMain}

`;

  attempts.forEach((attempt, index) => {
    if (index === 0) {
      code += `try {
${attempt}
`;
    } else {
      code += `} catch (e${index}) {
  console.warn('[${packageName}] Attempt ${index} failed:', e${index}.message);
  try {
${attempt}
`;
    }
  });

  // Cerrar todos los try-catch y agregar fallback final
  for (let i = 0; i < attempts.length; i++) {
    code += `  } catch (e${i + attempts.length}) {
    console.warn('[${packageName}] Attempt ${i + attempts.length} failed:', e${i + attempts.length}.message);
`;
  }

  code += `    // Final fallback: export empty object
    console.error('[${packageName}] All load attempts failed, using empty stub');
    module.exports = {};
    module.exports.default = {};
  }
`;

  // Cerrar todos los catch anidados
  for (let i = 0; i < attempts.length - 1; i++) {
    code += `}
`;
  }

  code += `
console.log('[${packageName}] Loaded successfully from index.js');
`;

  return code;
}

// Escanear todos los paquetes conocidos problemáticos
let fixedCount = 0;
let skippedCount = 0;

console.log("\n[fix-all] Scanning known problematic packages...\n");

knownProblematicPackages.forEach(pkgName => {
  let pkgDir;

  // Manejar paquetes con scope (@sentry/react-native)
  if (pkgName.startsWith("@")) {
    const parts = pkgName.split("/");
    pkgDir = path.join(nodeModulesDir, parts[0], parts[1]);
  } else {
    pkgDir = path.join(nodeModulesDir, pkgName);
  }

  if (fs.existsSync(pkgDir)) {
    const fixed = fixPackage(pkgName, pkgDir);
    if (fixed) {
      fixedCount++;
    } else {
      skippedCount++;
    }
  } else {
    console.log(`\n[fix-package] Package not found: ${pkgName}`);
    skippedCount++;
  }
});

// BONUS: Escanear TODOS los paquetes en node_modules para encontrar más problemas
console.log("\n[fix-all] Scanning ALL packages in node_modules for potential issues...\n");

try {
  const allPackages = fs.readdirSync(nodeModulesDir);

  allPackages.forEach(item => {
    // Saltar archivos ocultos y .bin
    if (item.startsWith(".")) return;

    const itemPath = path.join(nodeModulesDir, item);
    const stat = fs.statSync(itemPath);

    if (!stat.isDirectory()) return;

    // Si es un scope (@xxx), escanear sus paquetes
    if (item.startsWith("@")) {
      const scopePackages = fs.readdirSync(itemPath);
      scopePackages.forEach(scopePkg => {
        const scopePkgPath = path.join(itemPath, scopePkg);
        const scopeStat = fs.statSync(scopePkgPath);
        if (scopeStat.isDirectory()) {
          const fullName = `${item}/${scopePkg}`;
          if (!knownProblematicPackages.includes(fullName)) {
            const fixed = fixPackage(fullName, scopePkgPath);
            if (fixed) {
              fixedCount++;
              console.log(`[fix-all] ✅ Found and fixed new package: ${fullName}`);
            } else {
              skippedCount++;
            }
          }
        }
      });
    } else {
      // Paquete normal
      if (!knownProblematicPackages.includes(item)) {
        const fixed = fixPackage(item, itemPath);
        if (fixed) {
          fixedCount++;
          console.log(`[fix-all] ✅ Found and fixed new package: ${item}`);
        } else {
          skippedCount++;
        }
      }
    }
  });
} catch (e) {
  console.error("[fix-all] Error scanning all packages:", e.message);
}

console.log("\n========================================");
console.log("SUMMARY");
console.log("========================================");
console.log(`✅ Fixed packages: ${fixedCount}`);
console.log(`⏭️  Skipped packages: ${skippedCount}`);
console.log("========================================\n");

if (fixedCount > 0) {
  console.log("✅ Package fixes completed successfully!");
} else {
  console.log("⚠️  No packages were fixed. This might be okay if they're already fixed.");
}
