/* eslint-disable no-console */
/**
 * Copia los archivos de configuración de Cloudflare Pages (_redirects, _headers)
 * a la carpeta web-build tras el `expo export`.
 *
 * Expo SDK 54 debería copiar `public/` automáticamente, pero este script lo
 * garantiza para todos los entornos de CI.
 */
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const outDir = path.join(__dirname, '..', 'web-build');

if (!fs.existsSync(outDir)) {
  console.error('[cloudflare] web-build/ no existe. Ejecuta primero `expo export`.');
  process.exit(1);
}

// _redirects se omite: Workers Static Assets ya maneja SPA fallback via
// `not_found_handling = "single-page-application"` en wrangler.toml. Tener
// ambos causa "Infinite loop detected" en el deploy.
const files = ['_headers'];

for (const file of files) {
  const src = path.join(publicDir, file);
  const dest = path.join(outDir, file);

  if (!fs.existsSync(src)) {
    console.warn(`[cloudflare] Saltando ${file} (no existe en public/).`);
    continue;
  }

  fs.copyFileSync(src, dest);
  console.log(`[cloudflare] Copiado ${file} -> web-build/${file}`);
}

console.log('[cloudflare] Assets de Cloudflare Pages listos.');
