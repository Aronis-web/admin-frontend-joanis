/**
 * Generación de un PDF de reparto por tienda de una campaña.
 *
 * Por cada producto muestra su foto, nombre y SKU, y una tabla con las tiendas
 * (sedes internas / empresas externas) a las que se repartió, indicando el
 * stock repartido a cada una y su stock actual disponible. Los datos provienen
 * del endpoint `GET /admin/campaigns/:campaignId/products/:productId/full`
 * (`distributionByParticipant` + `stockBySite`).
 *
 * Reutiliza la salida (impresión en web / share en nativo) de
 * `campaignPhotosPdf` vía `printOrShareHtmlPdf`.
 */

import { printOrShareHtmlPdf } from './campaignPhotosPdf';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Formatea una cantidad numérica quitando decimales sobrantes. */
const formatQuantity = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
};

/** Tienda (sede o empresa) a la que se repartió un producto. */
export interface CampaignDistributionStore {
  storeName: string;
  /** `INTERNAL_SITE` | `EXTERNAL_COMPANY` | otro. */
  storeType?: string;
  /** Stock repartido a esta tienda (cantidad base). */
  distributedQuantity: number;
  /** Stock actual disponible de la tienda. `null` si no aplica/no se conoce. */
  currentStock: number | null;
}

/** Producto de la campaña con su reparto por tienda. */
export interface CampaignDistributionItem {
  title: string;
  sku: string;
  barcode?: string | null;
  photoUrl: string | null;
  stores: CampaignDistributionStore[];
}

const isInternal = (type?: string): boolean => (type || '').toUpperCase() === 'INTERNAL_SITE';

const buildStoreRows = (stores: CampaignDistributionStore[]): string => {
  if (stores.length === 0) {
    return `<tr><td class="empty" colspan="3">Sin reparto registrado</td></tr>`;
  }
  return stores
    .map((store) => {
      const icon = isInternal(store.storeType) ? '🏠' : '🏢';
      return `
        <tr>
          <td class="store"><span class="ico">${icon}</span>${escapeHtml(store.storeName || '—')}</td>
          <td class="num repartido">${formatQuantity(store.distributedQuantity)}</td>
          <td class="num actual">${formatQuantity(store.currentStock)}</td>
        </tr>`;
    })
    .join('');
};

const buildCardHtml = (item: CampaignDistributionItem): string => {
  const imageHtml = item.photoUrl
    ? `<img class="photo" src="${escapeHtml(item.photoUrl)}" alt="${escapeHtml(item.title)}" />`
    : `<div class="photo no-photo">Sin foto</div>`;

  const totalDistributed = item.stores.reduce((sum, s) => sum + (s.distributedQuantity || 0), 0);

  return `
    <div class="card">
      <div class="head">
        ${imageHtml}
        <div class="head-info">
          <div class="title">${escapeHtml(item.title || '—')}</div>
          <div class="sku">SKU: ${escapeHtml(item.sku || '—')}</div>
          ${item.barcode ? `<div class="sku">Código: ${escapeHtml(item.barcode)}</div>` : ''}
          <div class="tag">${item.stores.length} tienda${item.stores.length !== 1 ? 's' : ''} · ${formatQuantity(totalDistributed)} repartido</div>
        </div>
      </div>
      <table class="stores">
        <thead>
          <tr>
            <th class="store-h">Tienda</th>
            <th class="num-h">Stock repartido</th>
            <th class="num-h">Stock actual</th>
          </tr>
        </thead>
        <tbody>
          ${buildStoreRows(item.stores)}
        </tbody>
      </table>
    </div>`;
};

const buildHtml = (campaignName: string, items: CampaignDistributionItem[]): string => {
  const generatedAt = new Date().toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const cards = items.map((item) => buildCardHtml(item)).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Reparto por tienda</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 20px; }
  h1 { margin: 0 0 4px 0; font-size: 20px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 2px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
  .card { width: calc(50% - 6px); border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
  .head { display: flex; gap: 10px; padding: 10px; border-bottom: 1px solid #f3f4f6; }
  .photo { width: 90px; height: 90px; object-fit: contain; background: #f3f4f6; border-radius: 6px; flex: 0 0 auto; }
  .no-photo { display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 11px; }
  .head-info { min-width: 0; }
  .title { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 2px; }
  .sku { font-size: 11px; color: #6b7280; }
  .tag { display: inline-block; margin-top: 6px; font-size: 10px; font-weight: 700; color: #4338ca; background: #eef2ff; padding: 2px 6px; border-radius: 10px; }
  table.stores { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.stores th { text-align: left; padding: 5px 10px; background: #f9fafb; color: #6b7280; font-weight: 700; border-bottom: 1px solid #e5e7eb; }
  table.stores th.num-h { text-align: right; }
  table.stores td { padding: 5px 10px; border-bottom: 1px solid #f3f4f6; }
  table.stores td.store { color: #111; font-weight: 600; }
  table.stores td.store .ico { margin-right: 5px; }
  table.stores td.num { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  table.stores td.repartido { color: #047857; }
  table.stores td.actual { color: #1d4ed8; }
  table.stores td.empty { color: #9ca3af; text-align: center; font-style: italic; }
  .footer { margin-top: 20px; font-size: 10px; color: #6b7280; text-align: center; }
  @media print { .card { width: calc(50% - 6px); } }
</style>
</head>
<body>
  <h1>Reparto por tienda</h1>
  <div class="meta"><b>Campaña:</b> ${escapeHtml(campaignName || '—')}</div>
  <div class="meta"><b>Productos:</b> ${items.length}</div>
  <div class="meta"><b>Generado:</b> ${escapeHtml(generatedAt)}</div>
  <div class="grid">${cards}</div>
  <div class="footer">Reporte generado desde el panel admin — ${escapeHtml(generatedAt)}</div>
</body>
</html>`;
};

/**
 * Genera y comparte/imprime el PDF de reparto por tienda. Devuelve la cantidad
 * de productos incluidos.
 */
export const generateCampaignDistributionPdf = async (params: {
  campaignName: string;
  items: CampaignDistributionItem[];
}): Promise<number> => {
  const items = params.items ?? [];
  if (items.length === 0) return 0;

  const html = buildHtml(params.campaignName, items);
  const fileName = `reparto-campana-${(params.campaignName || 'campana')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}.pdf`;

  await printOrShareHtmlPdf(html, fileName, 'Reparto por tienda');

  return items.length;
};
