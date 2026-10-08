/**
 * Pagina HTML que dibuja un PDF (base64) con pdf.js: sirve igual en el WebView
 * de Android y en un iframe en web/Electron (el visor nativo de PDF no existe
 * en el WebView de Android ni en navegadores moviles).
 */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

const STYLE = [
  'html,body{margin:0;background:#525659}',
  'canvas{display:block;margin:10px auto;width:calc(100% - 20px);max-width:900px;height:auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}',
  '#m{color:#fff;font:15px system-ui,sans-serif;text-align:center;padding:32px 16px}',
  '@media print{html,body{background:#fff}canvas{margin:0;width:100%;max-width:none;box-shadow:none;page-break-after:always}#m{display:none}}',
].join('\n');

/** Script del visor: lee el PDF de window.PDF_B64 y dibuja cada pagina. */
const RENDER = `
(function () {
  var m = document.getElementById('m');
  function fail(e) {
    m.textContent = 'No se pudo mostrar la vista previa (' + (e && e.message ? e.message : e) + '). Puedes descargarlo igual.';
  }
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.js';
    var raw = atob(window.PDF_B64);
    var data = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
    pdfjsLib.getDocument({ data: data }).promise.then(function (pdf) {
      var chain = Promise.resolve();
      for (var p = 1; p <= pdf.numPages; p++) {
        (function (n) {
          chain = chain.then(function () {
            return pdf.getPage(n).then(function (page) {
              var vp = page.getViewport({ scale: 2 });
              var c = document.createElement('canvas');
              c.width = vp.width;
              c.height = vp.height;
              document.body.appendChild(c);
              return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            });
          });
        })(p);
      }
      return chain.then(function () { m.remove(); });
    }).catch(fail);
  } catch (e) { fail(e); }
})();`;

export function pdfPreviewPage(base64: string): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5">' +
    `<style>${STYLE}</style>` +
    `<script src="${PDFJS}/pdf.min.js"></script></head>` +
    '<body><div id="m">Cargando vista previa…</div>' +
    `<script>window.PDF_B64 = ${JSON.stringify(base64)};</script>` +
    `<script>${RENDER}</script></body></html>`
  );
}
