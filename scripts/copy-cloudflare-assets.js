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

// Fix del index.html: Expo emite <script src="..." defer> pero el bundle usa
// `import.meta`, que exige `type="module"`. Si no se transforma, el navegador
// lanza "Uncaught SyntaxError: Cannot use 'import.meta' outside a module" y la
// SPA no arranca.
const htmlPath = path.join(outDir, 'index.html');
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const before = html;
  html = html.replace(
    /<script src="([^"]+)" defer><\/script>/g,
    '<script type="module" src="$1"></script>'
  );

  // Metro runtime polyfills requeridos para chunks lazy (React.lazy + dynamic import)
  // en web. Sin __METRO_GLOBAL_PREFIX__ definido, cargar cualquier chunk lanza
  // "ReferenceError: __METRO_GLOBAL_PREFIX__ is not defined".
  const METRO_POLYFILL_MARKER = '__METRO_GLOBAL_PREFIX__';
  if (!html.includes(METRO_POLYFILL_MARKER)) {
    const polyfill = `
    <script>
      // Metro/Web runtime polyfills (React.lazy dynamic import compatibility)
      window.__METRO_GLOBAL_PREFIX__ = '';
      window.__importMetaUrl = window.location.href;
      if (typeof window.global === 'undefined') { window.global = window; }
      if (typeof window.process === 'undefined') {
        window.process = { env: { NODE_ENV: 'production' }, platform: 'browser' };
      }
    </script>
  </head>`;
    html = html.replace('</head>', polyfill);
  }

  if (html !== before) {
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log('[cloudflare] index.html: scripts type="module" + polyfills Metro inyectados.');
  } else {
    console.warn('[cloudflare] index.html: sin cambios (ya estaba parcheado).');
  }
} else {
  console.warn('[cloudflare] index.html no existe en web-build/.');
}

console.log('[cloudflare] Assets de Cloudflare Pages listos.');
