/* eslint-disable no-console */
/**
 * Post-processing del build web para Cloudflare Workers Static Assets + PWA.
 *
 * Hace:
 *   1. Copia `_headers` desde `public/` (cache y seguridad).
 *   2. Copia manifest.webmanifest y service-worker.js a la raíz de web-build.
 *   3. Copia el logo a `web-build/icons/` con nombres estándar (icon-192,
 *      icon-512, icon-maskable-512, apple-touch-icon).
 *   4. Transforma los tags <script src="..."> del index.html generado por Expo
 *      a `type="module"`, requerido porque el bundle usa `import.meta`
 *      (si no, el navegador lanza "Cannot use 'import.meta' outside a module").
 *   5. Inyecta polyfills de runtime de Metro necesarios para que los chunks
 *      lazy (React.lazy / dynamic import) no rompan con
 *      "__METRO_GLOBAL_PREFIX__ is not defined".
 *   6. Inyecta meta tags PWA (manifest, theme-color, apple-touch-icon,
 *      apple-mobile-web-app-*) + registro del service worker.
 *
 * NOTA: No se copia `_redirects`. El SPA fallback se maneja vía
 * `not_found_handling = "single-page-application"` en wrangler.toml. Tener
 * ambos causa "Infinite loop detected" al deploy.
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const assetsDir = path.join(rootDir, 'assets');
const outDir = path.join(rootDir, 'web-build');

if (!fs.existsSync(outDir)) {
  console.error('[cloudflare] web-build/ no existe. Ejecuta primero `expo export`.');
  process.exit(1);
}

// 1) Copiar _headers, manifest y service worker desde public/
// También los mini scripts externos que reemplazan los inline (necesario para
// poder aplicar una CSP estricta script-src 'self' sin 'unsafe-inline').
const publicFiles = [
  '_headers',
  'manifest.webmanifest',
  'service-worker.js',
  'metro-polyfill.js',
  'sw-register.js',
];
for (const file of publicFiles) {
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

// 2) Copiar íconos PWA desde assets/logo.png (mismo archivo con distintos
// nombres estándar; el navegador escala. Idealmente pre-generar tamaños con
// sharp o png-to-ico, pero para MVP alcanza con un solo PNG cuadrado).
const iconSrc = path.join(assetsDir, 'logo.png');
if (fs.existsSync(iconSrc)) {
  const iconsDir = path.join(outDir, 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });

  const iconNames = [
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
    'apple-touch-icon.png',
  ];
  for (const name of iconNames) {
    fs.copyFileSync(iconSrc, path.join(iconsDir, name));
  }
  // favicon en la raíz
  fs.copyFileSync(iconSrc, path.join(outDir, 'favicon.png'));
  console.log('[cloudflare] Iconos PWA copiados a web-build/icons/.');
} else {
  console.warn('[cloudflare] assets/logo.png no encontrado. Íconos PWA no generados.');
}

// 3) Parche del index.html: scripts a type=module + polyfills Metro + PWA tags
const htmlPath = path.join(outDir, 'index.html');
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const before = html;

  // Convertir CUALQUIER <script src="..."> que no sea ya type=module a module.
  html = html.replace(
    /<script((?:\s+[^>]*)?)\s+src="([^"]+)"((?:\s+[^>]*)?)><\/script>/g,
    (match, preAttrs = '', src, postAttrs = '') => {
      const allAttrs = `${preAttrs} ${postAttrs}`;
      if (/\btype\s*=\s*"module"/.test(allAttrs)) return match;
      const cleaned = allAttrs.replace(/\b(defer|async)\b/g, '').trim();
      const extra = cleaned ? ` ${cleaned}` : '';
      return `<script type="module" src="${src}"${extra}></script>`;
    },
  );

  // Inyectar polyfills Metro antes de </head> como script EXTERNO
  // (idempotente por marker). Usamos archivo externo en vez de inline para
  // permitir CSP script-src 'self' sin 'unsafe-inline'.
  const METRO_POLYFILL_MARKER = 'src="/metro-polyfill.js"';
  if (!html.includes(METRO_POLYFILL_MARKER)) {
    const polyfill = `
    <script src="/metro-polyfill.js"></script>
  </head>`;
    html = html.replace('</head>', polyfill);
  }

  // Inyectar meta tags PWA + registro de SW EXTERNO (idempotente por marker).
  const PWA_MARKER = 'data-pwa-injected';
  if (!html.includes(PWA_MARKER)) {
    const pwaTags = `
    <meta ${PWA_MARKER}="true" name="theme-color" content="#3B82F6" />
    <meta name="application-name" content="ERP-aio" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="ERP-aio" />
    <meta name="mobile-web-app-capable" content="yes" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <script src="/sw-register.js" defer></script>
  </head>`;
    html = html.replace('</head>', pwaTags);
  }

  if (html !== before) {
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(
      '[cloudflare] index.html parcheado: scripts a type="module", polyfills Metro y meta tags PWA inyectados.',
    );
  } else {
    console.warn('[cloudflare] index.html: sin cambios (¿ya estaba parcheado?).');
  }
} else {
  console.warn('[cloudflare] index.html no existe en web-build/.');
}

console.log('[cloudflare] Assets de Cloudflare + PWA listos.');
