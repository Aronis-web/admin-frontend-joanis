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

console.error("\n========================================");
console.error("GENERIC PACKAGE FIXER FOR EAS BUILD");
console.error("========================================\n");
console.error("[fix-all] Working directory:", cwd);
console.error("[fix-all] Node modules directory:", nodeModulesDir);

// Lista de paquetes que sabemos que tienen problemas
const knownProblematicPackages = [
  "memoize-one",
  "axios",
  "stacktrace-parser",
  "framer-motion",
  // "@sentry/react-native", // EXCLUDED: Sentry works correctly with dist/js/index.js
  "abort-controller"
];

// Mapeo de imports específicos que necesitan archivos creados
const specificImports = {
  "abort-controller": [
    "dist/abort-controller",
    "dist/abort-controller.js"
  ]
};

// Función genérica para arreglar un paquete
function fixPackage(packageName, packageDir) {
  console.error(`\n[fix-package] Processing: ${packageName}`);
  console.error(`[fix-package] Directory: ${packageDir}`);

  // Skip Sentry - it works correctly with its original configuration
  if (packageName === "react-native" && packageDir.includes("@sentry")) {
    console.error(`[fix-package] Skipping @sentry/react-native - works correctly as-is`);
    return false;
  }

  // Skip walker - Metro bundler needs it with original configuration
  if (packageName === "walker") {
    console.error(`[fix-package] Skipping walker - Metro bundler dependency`);
    return false;
  }

  // NOTE: makeerror and tmpl are dependencies of walker, but they CAN be fixed
  // They are not direct Metro dependencies, so we allow the fixer to process them

  const pkgJsonPath = path.join(packageDir, "package.json");

  if (!fs.existsSync(pkgJsonPath)) {
    console.error(`[fix-package] No package.json found, skipping`);
    return false;
  }

  try {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    const originalMain = pkgJson.main;

    if (!originalMain) {
      console.error(`[fix-package] No main field in package.json, skipping`);
      return false;
    }

    console.error(`[fix-package] Original main: ${originalMain}`);

    // Si el main ya apunta a index.js en la raíz, probablemente ya está arreglado
    if (originalMain === "index.js" || originalMain === "./index.js") {
      console.error(`[fix-package] Already points to index.js, skipping`);
      return false;
    }

    // Si el main apunta a un archivo en dist/, lib/, o build/
    const mainPointsToSubdir = originalMain.includes("dist/") ||
                               originalMain.includes("lib/") ||
                               originalMain.includes("build/");

    if (!mainPointsToSubdir) {
      console.error(`[fix-package] Main doesn't point to dist/lib/build, skipping`);
      return false;
    }

    const originalMainPath = path.join(packageDir, originalMain);
    const mainExists = fs.existsSync(originalMainPath);

    console.error(`[fix-package] Original main path: ${originalMainPath}`);
    console.error(`[fix-package] Original main exists: ${mainExists}`);

    // Crear un index.js genérico que intente cargar desde diferentes ubicaciones
    const indexJsPath = path.join(packageDir, "index.js");

    // Detectar posibles ubicaciones alternativas
    const distDir = path.join(packageDir, "dist");
    const libDir = path.join(packageDir, "lib");
    const buildDir = path.join(packageDir, "build");

    const distExists = fs.existsSync(distDir);
    const libExists = fs.existsSync(libDir);
    const buildExists = fs.existsSync(buildDir);

    console.error(`[fix-package] dist/ exists: ${distExists}`);
    console.error(`[fix-package] lib/ exists: ${libExists}`);
    console.error(`[fix-package] build/ exists: ${buildExists}`);

    // Listar archivos en dist/ si existe
    if (distExists) {
      const distFiles = listDir(distDir);
      console.error(`[fix-package] dist/ files:`, distFiles ? distFiles.slice(0, 10) : []);
    }

    // IMPORTANTE: Crear archivos faltantes en rutas específicas
    createMissingFiles(packageName, packageDir, originalMain);

    // IMPORTANTE: Crear archivos para imports específicos (como abort-controller/dist/abort-controller)
    createSpecificImportFiles(packageName, packageDir);

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
    console.error(`[fix-package] Created index.js at: ${indexJsPath}`);
    console.error(`[fix-package] File size: ${fs.statSync(indexJsPath).size} bytes`);

    // Actualizar package.json
    pkgJson.main = "index.js";
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2), "utf8");
    console.error(`[fix-package] Updated package.json main to: index.js`);

    // Verificar que el archivo es legible
    try {
      const content = fs.readFileSync(indexJsPath, "utf8");
      console.error(`[fix-package] ✅ index.js is readable (${content.length} bytes)`);
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

  // Si el originalMain no tiene extensión, intentar primero con .js
  if (!originalMain.match(/\.(js|mjs|cjs)$/)) {
    attempts.push(originalMain + '.js');
  }

  // Intentar cargar desde el main original
  attempts.push(originalMain);

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
      if (variant !== originalMain && !attempts.includes(variant)) {
        attempts.push(variant);
      }
    });
  }

  // Si hay lib/, intentar desde ahí
  if (info.libExists) {
    attempts.push('lib/index.js');
  }

  // Si hay build/, intentar desde ahí
  if (info.buildExists) {
    attempts.push('build/index.js');
  }

  // Generar el código con estructura simple
  let code = `// Auto-generated by scripts/fix-all-packages.js
// This file was created to fix module resolution issues in EAS Build
'use strict';

// Package: ${packageName}
// Original main: ${originalMain}

`;

  // Generar función que intenta cargar desde diferentes ubicaciones
  code += `function tryLoad() {
  const attempts = ${JSON.stringify(attempts, null, 2)};

  for (let i = 0; i < attempts.length; i++) {
    try {
      // Si el path ya empieza con ./ no agregarlo de nuevo
      const path = attempts[i].startsWith('./') ? attempts[i] : './' + attempts[i];
      const loaded = require(path);
      console.error('[${packageName}] Loaded from:', attempts[i]);
      return loaded;
    } catch (e) {
      // Continue to next attempt
      if (i === attempts.length - 1) {
        console.error('[${packageName}] All attempts failed, using empty stub');
        return {};
      }
    }
  }

  return {};
}

module.exports = tryLoad();
`;

  return code;
}

// Crear archivos específicos para imports directos
function createSpecificImportFiles(packageName, packageDir) {
  if (!specificImports[packageName]) {
    return;
  }

  console.error(`[fix-package] Creating specific import files for ${packageName}`);

  specificImports[packageName].forEach(importPath => {
    const fullPath = path.join(packageDir, importPath);

    if (fs.existsSync(fullPath)) {
      console.error(`[fix-package] File already exists: ${importPath}`);
      return;
    }

    // Buscar archivos similares en el directorio
    const dir = path.dirname(fullPath);
    const basename = path.basename(importPath);

    if (!fs.existsSync(dir)) {
      console.error(`[fix-package] Directory doesn't exist: ${dir}`);
      return;
    }

    const filesInDir = listDir(dir);
    console.error(`[fix-package] Files in ${path.basename(dir)}/:`, filesInDir);

    // Buscar archivos con el mismo nombre base
    const nameWithoutExt = basename.replace(/\.(js|mjs|cjs)$/, '');
    const possibleFiles = filesInDir.filter(f => {
      return f.startsWith(nameWithoutExt);
    });

    console.error(`[fix-package] Possible files for ${basename}:`, possibleFiles);

    if (possibleFiles.length > 0) {
      // Crear wrapper que intente cargar los archivos encontrados
      const relativeAttempts = possibleFiles.map(f => {
        const relativePath = path.relative(packageDir, path.join(dir, f));
        return './' + relativePath.replace(/\\/g, '/');
      });

      const wrapperCode = `// Auto-generated wrapper for ${packageName}/${importPath}
'use strict';

function tryLoad() {
  const attempts = ${JSON.stringify(relativeAttempts, null, 2)};

  for (let i = 0; i < attempts.length; i++) {
    try {
      const loaded = require(attempts[i]);
      console.error('[${packageName}] Loaded from:', attempts[i]);
      return loaded;
    } catch (e) {
      if (i === attempts.length - 1) {
        console.error('[${packageName}] All attempts failed');
        return {};
      }
    }
  }
  return {};
}

module.exports = tryLoad();
`;

      fs.writeFileSync(fullPath, wrapperCode, 'utf8');
      console.error(`[fix-package] ✅ Created specific import file: ${fullPath}`);
    }
  });
}

// Crear archivos faltantes en rutas específicas dentro de dist/lib/build
function createMissingFiles(packageName, packageDir, originalMain) {
  const filesToCreate = [];

  // Si el originalMain no existe, crear el archivo en esa ubicación exacta
  const originalMainPath = path.join(packageDir, originalMain);

  if (!fs.existsSync(originalMainPath)) {
    // Intentar encontrar archivos similares en el mismo directorio
    const dir = path.dirname(originalMainPath);
    const basename = path.basename(originalMain);

    if (fs.existsSync(dir)) {
      const filesInDir = listDir(dir);
      console.error(`[fix-package] Files in ${path.basename(dir)}/:`, filesInDir);

      // Buscar archivos con extensiones similares
      const possibleFiles = filesInDir.filter(f => {
        const nameWithoutExt = basename.replace(/\.(js|mjs|cjs)$/, '');
        return f.startsWith(nameWithoutExt) || f.includes(nameWithoutExt);
      });

      console.error(`[fix-package] Possible alternative files:`, possibleFiles);

      if (possibleFiles.length > 0) {
        // Crear un wrapper que intente cargar los archivos encontrados
        const relativeAttempts = possibleFiles.map(f => {
          const relativePath = path.relative(packageDir, path.join(dir, f));
          return './' + relativePath.replace(/\\/g, '/');
        });

        const wrapperCode = `// Auto-generated wrapper for ${packageName}
'use strict';

function tryLoad() {
  const attempts = ${JSON.stringify(relativeAttempts, null, 2)};

  for (let i = 0; i < attempts.length; i++) {
    try {
      const loaded = require(attempts[i]);
      console.error('[${packageName}] Loaded from:', attempts[i]);
      return loaded;
    } catch (e) {
      if (i === attempts.length - 1) {
        console.error('[${packageName}] All attempts failed');
        return {};
      }
    }
  }
  return {};
}

module.exports = tryLoad();
`;

        // Crear el archivo en la ubicación exacta que se busca
        ensureDir(dir);
        fs.writeFileSync(originalMainPath, wrapperCode, 'utf8');
        console.error(`[fix-package] ✅ Created missing file: ${originalMainPath}`);

        // También crear versiones con extensiones .js, .mjs, .cjs si no existen
        ['.js', '.mjs', '.cjs'].forEach(ext => {
          const pathWithExt = originalMainPath + ext;
          if (!fs.existsSync(pathWithExt)) {
            fs.writeFileSync(pathWithExt, wrapperCode, 'utf8');
            console.error(`[fix-package] ✅ Created: ${pathWithExt}`);
          }
        });
      }
    }
  }
}

// Escanear todos los paquetes conocidos problemáticos
let fixedCount = 0;
let skippedCount = 0;

console.error("\n[fix-all] Scanning known problematic packages...\n");

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
    // Primero crear archivos específicos si existen en el mapeo
    if (specificImports[pkgName]) {
      console.error(`\n[fix-package] Processing specific imports for: ${pkgName}`);
      createSpecificImportFiles(pkgName, pkgDir);
    }

    const fixed = fixPackage(pkgName, pkgDir);
    if (fixed) {
      fixedCount++;
    } else {
      skippedCount++;
    }
  } else {
    console.error(`\n[fix-package] Package not found: ${pkgName}`);
    skippedCount++;
  }
});

// BONUS: Escanear TODOS los paquetes en node_modules para encontrar más problemas
console.error("\n[fix-all] Scanning ALL packages in node_modules for potential issues...\n");

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
          // Skip Sentry packages - they work correctly with their original configuration
          if (fullName === '@sentry/react-native' || item === '@sentry') {
            skippedCount++;
            return;
          }
          if (!knownProblematicPackages.includes(fullName)) {
            const fixed = fixPackage(fullName, scopePkgPath);
            if (fixed) {
              fixedCount++;
              console.error(`[fix-all] ✅ Found and fixed new package: ${fullName}`);
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
          console.error(`[fix-all] ✅ Found and fixed new package: ${item}`);
        } else {
          skippedCount++;
        }
      }
    }
  });
} catch (e) {
  console.error("[fix-all] Error scanning all packages:", e.message);
}

console.error("\n========================================");
console.error("SUMMARY");
console.error("========================================");
console.error(`✅ Fixed packages: ${fixedCount}`);
console.error(`⏭️  Skipped packages: ${skippedCount}`);
console.error("========================================\n");

if (fixedCount > 0) {
  console.error("✅ Package fixes completed successfully!");
} else {
  console.error("⚠️  No packages were fixed. This might be okay if they're already fixed.");
}
