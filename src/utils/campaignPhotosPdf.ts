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

const buildCardHtml = (item: CampaignProductDetailItem): string => {
  const url = pickPhoto(item.photos);
  const available = item.tenantSiteStock
    ? formatQuantity(item.tenantSiteStock.availableQuantityBase)
    : '—';
  const distributed = formatQuantity(item.distributedQuantityBase);
  const unitCost = formatCurrency(item.costCents);
  // Costo total = costo unitario × cantidad en campaña.
  const quantity = parseFloat(item.campaignQuantityBase || '0');
  const totalCost =
    !Number.isNaN(quantity) && item.costCents != null
      ? formatCurrency(item.costCents * quantity)
      : '—';
  const socia = formatCurrency(findSociaPriceCents(item.salePrices));
  const supplier = item.supplier
    ? [item.supplier.name, item.supplier.purchaseCode].filter(Boolean).join(' · ')
    : '—';

  const imageHtml = url
    ? `<img class="photo" src="${escapeHtml(url)}" alt="${escapeHtml(item.title)}" />`
    : `<div class="photo no-photo">Sin foto</div>`;

  return `
    <div class="card">
      ${imageHtml}
      <div class="info">
        <div class="title">${escapeHtml(item.title || '—')}</div>
        <div class="sku">SKU: ${escapeHtml(item.sku || '—')}</div>
        <div class="rows">
          <div class="row"><span class="lbl">Stock disponible</span><span class="val">${available}</span></div>
          <div class="row"><span class="lbl">Stock repartido</span><span class="val">${distributed}</span></div>
          <div class="row"><span class="lbl">Costo unitario</span><span class="val">${unitCost}</span></div>
          <div class="row"><span class="lbl">Costo total</span><span class="val">${totalCost}</span></div>
          <div class="row socia"><span class="lbl">Precio socia (unit.)</span><span class="val">${socia}</span></div>
          <div class="row"><span class="lbl">Proveedor</span><span class="val">${escapeHtml(supplier)}</span></div>
        </div>
      </div>
    </div>`;
};

const buildHtml = (campaignName: string, items: CampaignProductDetailItem[]): string => {
  const generatedAt = new Date().toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const cards = items.map(buildCardHtml).join('');

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
  .photo { width: 100%; height: 160px; object-fit: cover; background: #f3f4f6; display: block; }
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

/** Imprime el HTML en web/Electron mediante un iframe oculto. */
const printHtmlOnWeb = (html: string): void => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {
        /* noop */
      }
    }, 1000);
  };

  iframe.onload = () => {
    try {
      const win = iframe.contentWindow;
      if (!win) return;
      // Esperamos a que las imágenes remotas terminen de cargar antes de imprimir.
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch (err) {
          logger.error('Error al invocar print en iframe:', err);
        }
        cleanup();
      }, 600);
    } catch (err) {
      logger.error('Error accediendo al iframe:', err);
      cleanup();
    }
  };

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  } else {
    Alert.alert('Error', 'No se pudo preparar el documento para imprimir.');
    cleanup();
  }
};

/**
 * Genera y comparte/imprime el PDF de fotos de los productos activos de la
 * campaña. Devuelve la cantidad de productos incluidos (0 si no había activos).
 */
export const generateCampaignPhotosPdf = async (params: {
  campaignName: string;
  items: CampaignProductDetailItem[];
}): Promise<number> => {
  const activeItems = (params.items ?? []).filter(isActive);

  if (activeItems.length === 0) {
    Alert.alert('Sin productos activos', 'No hay productos activos para exportar.');
    return 0;
  }

  const html = buildHtml(params.campaignName, activeItems);
  const fileName = `fotos-campana-${(params.campaignName || 'campana')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}.pdf`;

  if (Platform.OS === 'web') {
    printHtmlOnWeb(html);
    return activeItems.length;
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    const targetUri = `${FileSystem.cacheDirectory ?? ''}${fileName}`;
    try {
      await FileSystem.moveAsync({ from: uri, to: targetUri });
      await Sharing.shareAsync(targetUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Fotos de campaña',
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      logger.warn('Fallback share por rename fallido:', err);
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Fotos de campaña',
        UTI: 'com.adobe.pdf',
      });
    }
  } else {
    Alert.alert('PDF generado', `Archivo en: ${uri}`);
  }

  return activeItems.length;
};
