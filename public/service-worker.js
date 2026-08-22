/* eslint-disable no-restricted-globals */
/**
 * Service Worker para ERP-aio PWA.
 *
 * Estrategia:
 *   - HTML / navigation requests → network-first con fallback a cache (para
 *     que updates de la SPA aparezcan sin borrar caches manualmente).
 *   - Assets estáticos hasheados de Expo (_expo/static/, assets/) → cache-first
 *     con expiración implícita por hash (los archivos son immutable, cambian
 *     de nombre en cada build).
 *   - Peticiones a API (cualquier host distinto al propio) → NO se cachean;
 *     dejamos que pasen directo a la red para no servir datos viejos del ERP.
 *
 * IMPORTANTE: bumpear CACHE_VERSION cuando cambie la estrategia o queramos
 * forzar limpieza. El nombre incluye la versión, así SW nuevo invalida el
 * anterior en `activate`.
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `erp-aio-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `erp-aio-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Escucha mensajes desde la app (p.ej. para forzar update inmediato tras
 * detectar nueva versión).
 */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function isStaticAsset(url) {
  const path = new URL(url).pathname;
  return (
    path.startsWith('/_expo/static/') ||
    path.startsWith('/assets/') ||
    path.startsWith('/icons/') ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(path)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET
  if (request.method !== 'GET') return;

  // No interceptamos peticiones cross-origin (API, mapas, fonts externas, etc.)
  if (!isSameOrigin(request.url)) return;

  // Navegación / documentos → network-first
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/index.html')),
        ),
    );
    return;
  }

  // Assets estáticos → cache-first
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            // Guard: si Cloudflare devolvió el SPA fallback (index.html con
            // MIME text/html) para un chunk que ya no existe en el deploy,
            // NO lo cacheamos y devolvemos un 404 sintético. Si cacheáramos
            // esto, el browser vería un .js con MIME text/html y romperia
            // la ejecución (Refused to execute script).
            if (response.ok && !isValidStaticResponse(request.url, response)) {
              return new Response('', {
                status: 404,
                statusText: 'Not Found (stale asset)',
              });
            }
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
      }),
    );
  }
});

/**
 * Valida que el content-type de la respuesta coincida con la extensión
 * pedida. Evita cachear index.html como si fuera JS/CSS cuando Cloudflare
 * responde con SPA fallback para un asset que ya no existe.
 */
function isValidStaticResponse(url, response) {
  const path = new URL(url).pathname.toLowerCase();
  const ct = (response.headers.get('content-type') || '').toLowerCase();
  if (path.endsWith('.js') || path.endsWith('.mjs')) {
    return ct.includes('javascript') || ct.includes('ecmascript');
  }
  if (path.endsWith('.css')) return ct.includes('css');
  if (path.endsWith('.json') || path.endsWith('.webmanifest')) {
    return ct.includes('json') || ct.includes('manifest');
  }
  // Para fuentes/imágenes rechazamos explícitamente text/html.
  return !ct.includes('text/html');
}
