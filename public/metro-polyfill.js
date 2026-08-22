// Metro/Web runtime polyfills (React.lazy dynamic import compatibility).
// Se sirve como script externo (no inline) para permitir una CSP estricta
// (script-src 'self') sin necesidad de 'unsafe-inline' ni hashes.
// Debe cargarse ANTES que el bundle principal generado por expo export.
(function () {
  window.__METRO_GLOBAL_PREFIX__ = '';
  window.__importMetaUrl = window.location.href;
  if (typeof window.global === 'undefined') {
    window.global = window;
  }
  if (typeof window.process === 'undefined') {
    window.process = { env: { NODE_ENV: 'production' }, platform: 'browser' };
  }
})();
