// Registro del Service Worker (solo en producción y navegadores compatibles).
// Externo (no inline) para poder aplicar CSP script-src 'self' sin
// 'unsafe-inline' ni hashes por cada build.
(function () {
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service-worker.js').catch(function (err) {
        // eslint-disable-next-line no-console
        console.warn('[PWA] SW registration failed:', err);
      });
    });
  }
})();
