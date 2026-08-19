/**
 * Generación de un PDF con las fotos de los productos activos de una campaña.
 *
 * Cada producto se muestra como una tarjeta con su foto, nombre, SKU, stock
 * disponible, stock repartido, costo y precio socia. El flujo replica el patrón
 * de impresión usado en el Dashboard: en web/Electron se imprime vía un iframe
 * oculto (el usuario elige "Guardar como PDF"), y en nativo se genera el archivo
 * con `expo-print` y se comparte con `expo-sharing`.
 */

import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import Alert from '@/utils/alert';
import logger from '@/utils/logger';
import type { CampaignProductDetailItem } from '@/types/campaigns';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Convierte un valor "cents" a un texto de moneda `S/ 0.00`. */
const formatCurrency = (cents: number | null | undefined): string => {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return '—';
  return `S/ ${(cents / 100).toFixed(2)}`;
};

/** Formatea una cantidad base (string numérico) quitando ceros sobrantes. */
const formatQuantity = (value: string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0';
  const num = parseFloat(value);
  if (Number.isNaN(num)) return '0';
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
};

/** Devuelve la URL de una foto aceptando tanto strings como objetos `{url}`. */
const photoUrl = (photo: string | { url?: string } | null | undefined): string | null => {
  if (!photo) return null;
  if (typeof photo === 'string') return photo || null;
  return photo.url || null;
};

/**
 * Elige la mejor foto del producto priorizando price > design > reference >
 * catalog y cae a la primera disponible.
 */
const pickPhoto = (photos: CampaignProductDetailItem['photos']): string | null => {
  const list = (photos ?? [])
    .map((p) => ({
      type: typeof p === 'string' ? '' : (p.type || '').toLowerCase(),
      url: photoUrl(p),
    }))
    .filter((p): p is { type: string; url: string } => !!p.url);
  if (list.length === 0) return null;
  const byType = (t: string) => list.find((p) => p.type === t)?.url;
  return (
    byType('price') || byType('design') || byType('reference') || byType('catalog') || list[0].url
  );
};

/**
 * Precio socia unitario: perfil cuyo nombre contiene "socia" y sin presentación
 * (los precios por presentación corresponden a packs y son más altos).
 */
const findSociaPriceCents = (
  salePrices: CampaignProductDetailItem['salePrices']
): number | null => {
  const base = (salePrices ?? []).filter((p) => !p.presentationId);
  const socia = base.find((p) => (p.profileName || '').toLowerCase().includes('socia'));
  return socia ? socia.priceCents : null;
};

const isActive = (item: CampaignProductDetailItem): boolean =>
  String(item.productStatus || '').toUpperCase() === 'ACTIVE';

const buildCardHtml = (item: CampaignProductDetailItem, includeCost: boolean): string => {
  const url = pickPhoto(item.photos);
  const available = item.tenantSiteStock
    ? formatQuantity(item.tenantSiteStock.availableQuantityBase)
    : '—';
  const distributed = formatQuantity(item.distributedQuantityBase);
  const socia = formatCurrency(findSociaPriceCents(item.salePrices));
  const supplier = item.supplier
    ? [item.supplier.name, item.supplier.purchaseCode].filter(Boolean).join(' · ')
    : '—';

  let costRows = '';
  if (includeCost) {
    const unitCost = formatCurrency(item.costCents);
    // Costo total = costo unitario × cantidad en campaña.
    const quantity = parseFloat(item.campaignQuantityBase || '0');
    const totalCost =
      !Number.isNaN(quantity) && item.costCents != null
        ? formatCurrency(item.costCents * quantity)
        : '—';
    costRows = `
          <div class="row"><span class="lbl">Costo unitario</span><span class="val">${unitCost}</span></div>
          <div class="row"><span class="lbl">Costo total</span><span class="val">${totalCost}</span></div>`;
  }

  const imageHtml = url
    ? `<img class="photo" src="${escapeHtml(url)}" alt="${escapeHtml(item.title)}" />`
    : `<div class="photo no-photo">Sin foto</div>`;

  return `
    <div class="card">
      ${imageHtml}
      <div class="info">
        <div class="title">${escapeHtml(item.title || '—')}</div>
        <div class="sku">SKU: ${escapeHtml(item.sku || '—')}</div>
        <div class="sku">Código de barras: ${escapeHtml(item.barcode || '—')}</div>
        <div class="rows">
          <div class="row"><span class="lbl">Stock disponible</span><span class="val">${available}</span></div>
          <div class="row"><span class="lbl">Stock repartido</span><span class="val">${distributed}</span></div>${costRows}
          <div class="row socia"><span class="lbl">Precio socia (unit.)</span><span class="val">${socia}</span></div>
          <div class="row"><span class="lbl">Proveedor</span><span class="val">${escapeHtml(supplier)}</span></div>
        </div>
      </div>
    </div>`;
};

const buildHtml = (
  campaignName: string,
  items: CampaignProductDetailItem[],
  includeCost: boolean
): string => {
  const generatedAt = new Date().toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const cards = items.map((item) => buildCardHtml(item, includeCost)).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Fotos de campaña</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 20px; }
  h1 { margin: 0 0 4px 0; font-size: 20px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 2px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
  .card { width: calc(33.33% - 8px); border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; page-break-inside: avoid; display: flex; flex-direction: column; }
  .photo { width: 100%; height: 200px; object-fit: contain; background: #f3f4f6; display: block; }
  .no-photo { display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 12px; }
  .info { padding: 8px 10px; }
  .title { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 2px; }
  .sku { font-size: 11px; color: #6b7280; margin-bottom: 8px; }
  .rows { font-size: 11px; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; border-top: 1px solid #f3f4f6; }
  .row .lbl { color: #6b7280; }
  .row .val { font-weight: 600; color: #111; font-variant-numeric: tabular-nums; }
  .row.socia { border-top: 1px solid #c7d2fe; }
  .row.socia .lbl { color: #4338ca; font-weight: 700; }
  .row.socia .val { color: #4338ca; font-weight: 700; }
  .footer { margin-top: 20px; font-size: 10px; color: #6b7280; text-align: center; }
  @media print { .card { width: calc(33.33% - 8px); } }
</style>
</head>
<body>
  <h1>Fotos de campaña</h1>
  <div class="meta"><b>Campaña:</b> ${escapeHtml(campaignName || '—')}</div>
  <div class="meta"><b>Productos activos:</b> ${items.length}</div>
  <div class="meta"><b>Generado:</b> ${escapeHtml(generatedAt)}</div>
  <div class="grid">${cards}</div>
  <div class="footer">Reporte generado desde el panel admin — ${escapeHtml(generatedAt)}</div>
</body>
</html>`;
};

/**
 * Script que se inyecta DENTRO del iframe para dispararse a sí mismo el print.
 *
 * Es clave que `window.print()` se llame desde el contexto del propio iframe (y
 * no desde el padre vía `iframe.contentWindow.print()`), porque en Electron/web
 * llamarlo desde el padre a veces imprime la página principal (la pantalla de la
 * app) en vez del contenido del iframe. Además espera a que las imágenes remotas
 * terminen de cargar para que el PDF salga completo.
 */
const SELF_PRINT_SCRIPT =
  `
<script>
(function () {
  function doPrint() {
    try { window.focus(); window.print(); } catch (e) {}
  }
  function ready() {
    const imgs = Array.prototype.slice.call(document.images || []);
    const pending = imgs.filter(function (img) { return !img.complete; });
    if (pending.length === 0) { setTimeout(doPrint, 300); return; }
    let remaining = pending.length;
    let fired = false;
    function onDone() {
      if (fired) return;
      remaining -= 1;
      if (remaining <= 0) { fired = true; setTimeout(doPrint, 200); }
    }
    pending.forEach(function (img) {
      img.addEventListener('load', onDone);
      img.addEventListener('error', onDone);
    });
    // Fallback por si alguna imagen nunca resuelve.
    setTimeout(function () { if (!fired) { fired = true; doPrint(); } }, 5000);
  }
  if (document.readyState === 'complete') { ready(); }
  else { window.addEventListener('load', ready); }
})();
</` + `script>`;

/** Imprime el HTML en web/Electron mediante un iframe oculto que se auto-imprime. */
export const printHtmlOnWeb = (html: string): void => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {
        /* noop */
      }
    }, 1000);
  };

  // El HTML se auto-imprime desde su propio contexto (ver SELF_PRINT_SCRIPT).
  const finalHtml = html.includes('</body>')
    ? html.replace('</body>', `${SELF_PRINT_SCRIPT}</body>`)
    : html + SELF_PRINT_SCRIPT;

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(finalHtml);
    doc.close();
    // Limpiamos cuando el usuario cierra el diálogo de impresión.
    try {
      iframe.contentWindow?.addEventListener('afterprint', cleanup);
    } catch (err) {
      logger.warn('No se pudo escuchar afterprint:', err);
    }
    // Fallback de limpieza por si `afterprint` no dispara.
    setTimeout(cleanup, 60000);
  } else {
    Alert.alert('Error', 'No se pudo preparar el documento para imprimir.');
    cleanup();
  }
};

/**
 * Imprime (web/Electron) o genera+comparte (nativo) un HTML como PDF.
 *
 * Centraliza el flujo de salida para reutilizarlo entre distintos reportes
 * de campaña (fotos, reparto por tienda, etc.). En web usa el iframe oculto
 * auto-imprimible; en nativo genera el archivo con `expo-print` y lo comparte
 * con `expo-sharing`, cayendo a un aviso con la ruta si compartir no está
 * disponible.
 */
export const printOrShareHtmlPdf = async (
  html: string,
  fileName: string,
  dialogTitle: string
): Promise<void> => {
  if (Platform.OS === 'web') {
    printHtmlOnWeb(html);
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    const targetUri = `${FileSystem.cacheDirectory ?? ''}${fileName}`;
    try {
      await FileSystem.moveAsync({ from: uri, to: targetUri });
      await Sharing.shareAsync(targetUri, {
        mimeType: 'application/pdf',
        dialogTitle,
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      logger.warn('Fallback share por rename fallido:', err);
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle,
        UTI: 'com.adobe.pdf',
      });
    }
  } else {
    Alert.alert('PDF generado', `Archivo en: ${uri}`);
  }
};

/**
 * Genera y comparte/imprime el PDF de fotos de los productos activos de la
 * campaña. Devuelve la cantidad de productos incluidos (0 si no había activos).
 */
export const generateCampaignPhotosPdf = async (params: {
  campaignName: string;
  items: CampaignProductDetailItem[];
  /** Incluir costo unitario y costo total en el PDF. Por defecto `false`. */
  includeCost?: boolean;
}): Promise<number> => {
  const activeItems = (params.items ?? []).filter(isActive);

  if (activeItems.length === 0) {
    Alert.alert('Sin productos activos', 'No hay productos activos para exportar.');
    return 0;
  }

  const html = buildHtml(params.campaignName, activeItems, params.includeCost ?? false);
  const fileName = `fotos-campana-${(params.campaignName || 'campana')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}.pdf`;

  await printOrShareHtmlPdf(html, fileName, 'Fotos de campaña');

  return activeItems.length;
};
