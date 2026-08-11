/* eslint-disable no-console */
/**
 * Post-processing del build web para Cloudflare Workers Static Assets.
 *
 * Hace 3 cosas críticas:
 *   1. Copia `_headers` desde `public/` (cache y seguridad).
 *   2. Transforma los tags <script src="..."> del index.html generado por Expo
 *      a `type="module"`, requerido porque el bundle usa `import.meta`
 *      (si no, el navegador lanza "Cannot use 'import.meta' outside a module").
 *   3. Inyecta polyfills de runtime de Metro necesarios para que los chunks
 *      lazy (React.lazy / dynamic import) no rompan con
 *      "__METRO_GLOBAL_PREFIX__ is not defined".
 *
 * NOTA: No se copia `_redirects`. El SPA fallback se maneja vía
 * `not_found_handling = "single-page-application"` en wrangler.toml. Tener
 * ambos causa "Infinite loop detected" al deploy.
 */
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const outDir = path.join(__dirname, '..', 'web-build');

if (!fs.existsSync(outDir)) {
  console.error('[cloudflare] web-build/ no existe. Ejecuta primero `expo export`.');
  process.exit(1);
}

// 1) Copiar solo _headers (no _redirects — ver nota arriba)
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

// Borrado defensivo por si Expo o algún build previo dejó un _redirects
const strayRedirects = path.join(outDir, '_redirects');
if (fs.existsSync(strayRedirects)) {
  fs.unlinkSync(strayRedirects);
  console.log('[cloudflare] Removido _redirects residual de web-build/.');
}

// 2 + 3) Parche del index.html
const htmlPath = path.join(outDir, 'index.html');
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const before = html;

  // Convertir CUALQUIER <script src="..."> que no sea ya type=module a module.
  // Cubre variantes de Expo Router / Metro: con defer, async, crossorigin, etc.
  html = html.replace(
    /<script((?:\s+[^>]*)?)\s+src="([^"]+)"((?:\s+[^>]*)?)><\/script>/g,
    (match, preAttrs = '', src, postAttrs = '') => {
      const allAttrs = `${preAttrs} ${postAttrs}`;
      if (/\btype\s*=\s*"module"/.test(allAttrs)) return match;
      // Quita defer/async porque type=module ya es defer por defecto y evita
      // atributos conflictivos en navegadores estrictos.
      const cleaned = allAttrs.replace(/\b(defer|async)\b/g, '').trim();
      const extra = cleaned ? ` ${cleaned}` : '';
      return `<script type="module" src="${src}"${extra}></script>`;
    }
  );

  // Inyectar polyfills Metro antes de </head> (idempotente por marker).
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
    console.log('[cloudflare] index.html: scripts convertidos a type="module" + polyfills Metro inyectados.');
  } else {
    console.warn('[cloudflare] index.html: sin cambios (¿ya estaba parcheado o el regex no coincidió?).');
  }
} else {
  console.warn('[cloudflare] index.html no existe en web-build/.');
}

console.log('[cloudflare] Assets de Cloudflare listos.');
