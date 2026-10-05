/**
 * "Hoja de armado" (picking) de pedidos de post venta en A4 vertical.
 *
 * Una hoja por pedido (salto de página entre pedidos), en blanco y negro:
 *   - Cabecera: número de pedido grande, QR `GRITPED:<uuid>`, estado, fecha de
 *     impresión, despacho (tipo + lugar/dirección/referencia), cliente y
 *     teléfono, notas del pedido y de entrega, total.
 *   - Tabla agrupada por almacén: casilla para marcar a mano, cantidad, producto,
 *     variante/presentación, SKU y Code128 (barcode o, en su defecto, SKU).
 *   - Pie: "Armado por" / "Fecha/hora" y totales de ítems y unidades.
 *
 * Salida:
 *   - Electron: `electronAPI.printHTML` sin modo silencioso → diálogo de impresión
 *     del sistema (se puede elegir "Microsoft Print to PDF"). La app de escritorio
 *     no expone un método para guardar PDF directamente.
 *   - Navegador: iframe oculto + diálogo de impresión ("Guardar como PDF").
 *   - Nativo: `expo-print.printToFileAsync` → PDF compartido con `expo-sharing`
 *     (si no se puede compartir, `Print.printAsync`).
 */

import { Platform } from 'react-native';
import QRCode from 'qrcode';
import { logger } from '@/utils/logger';
import type { PostsalePicking, PostsalePickingItem } from '@/services/api/chatbot-postsale';
import { code128SvgDetailed } from './code128Svg';
import { printHtmlOnWeb } from './orderStickerPrint';

/** A4 en milímetros. */
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 10;
const QR_SIZE_MM = 30;
const BARCODE_HEIGHT_MM = 9;
/** Ancho máximo del código de barras en la columna de la tabla. */
const BARCODE_MAX_WIDTH_MM = 56;

interface ElectronPrintApi {
  printHTML?: (options: {
    html: string;
    deviceName?: string;
    silent?: boolean;
    pageSize?: { width: number; height: number };
    landscape?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
}

const getElectronPrintApi = (): ElectronPrintApi | null => {
  if (typeof window === 'undefined') return null;
  const api = (window as unknown as { electronAPI?: ElectronPrintApi }).electronAPI;
  if (api && typeof api.printHTML === 'function') return api;
  return null;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const clean = (value: unknown): string =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const formatSoles = (cents: string | number | null | undefined): string => {
  if (cents === null || cents === undefined || cents === '') return '-';
  const num = Number(cents) / 100;
  if (Number.isNaN(num)) return '-';
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `S/ ${num.toFixed(2)}`;
  }
};

const formatNow = (): string => {
  const now = new Date();
  try {
    return now.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return now.toLocaleString();
  }
};

const formatPhone = (phone: string | null | undefined): string => {
  const p = clean(phone);
  return /^\d{9}$/.test(p) ? `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}` : p;
};

const buildQrSvg = async (text: string): Promise<string> => {
  if (!text) return '';
  try {
    return await QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  } catch (err) {
    logger.error('No se pudo generar el QR de la hoja de armado', err);
    return '';
  }
};

/** Code128 a 0.25 mm/módulo; si no entra en la columna, módulo más fino o estirado. */
const buildBarcodeHtml = (item: PostsalePickingItem): string => {
  const value = clean(item.barcode) || clean(item.sku);
  if (!value) return '<span class="muted">—</span>';
  for (const mw of [0.25, 0.19]) {
    const res = code128SvgDetailed(value, {
      height: 120,
      quietZone: 8,
      moduleWidthMm: mw,
      heightMm: BARCODE_HEIGHT_MM,
    });
    if (res?.widthMm && res.widthMm <= BARCODE_MAX_WIDTH_MM) {
      return `<div class="bc">${res.svg}</div><div class="bc-text">${escapeHtml(value)}</div>`;
    }
  }
  const stretched = code128SvgDetailed(value, { height: 120, quietZone: 8 });
  if (!stretched) return `<div class="bc-text">${escapeHtml(value)}</div>`;
  return `<div class="bc bc-stretched">${stretched.svg}</div><div class="bc-text">${escapeHtml(value)}</div>`;
};

const buildItemRow = (item: PostsalePickingItem): string => {
  const detail = [clean(item.variant), clean(item.presentation)].filter(Boolean).join(' · ');
  return `
      <tr>
        <td class="c-check"><div class="box"></div></td>
        <td class="c-qty">${escapeHtml(Number(item.qty) || 0)}</td>
        <td class="c-name">
          <div class="pname">${escapeHtml(clean(item.name) || '—')}</div>
          ${detail ? `<div class="pdetail">${escapeHtml(detail)}</div>` : ''}
        </td>
        <td class="c-sku">${escapeHtml(clean(item.sku) || '—')}</td>
        <td class="c-bc">${buildBarcodeHtml(item)}</td>
      </tr>`;
};

const buildItemsTable = (items: PostsalePickingItem[]): string => {
  const groups = new Map<string, PostsalePickingItem[]>();
  for (const it of items ?? []) {
    const wh = clean(it.warehouse) || 'Sin almacén';
    const list = groups.get(wh) ?? [];
    list.push(it);
    groups.set(wh, list);
  }
  const body = Array.from(groups.entries())
    .map(([wh, list]) => {
      const units = list.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
      return `
      <tbody>
        <tr class="wh"><td colspan="5">ALMACÉN: ${escapeHtml(wh.toUpperCase())}
          <span class="wh-count">${list.length} ítem${list.length === 1 ? '' : 's'} · ${units} und.</span></td></tr>
        ${list.map(buildItemRow).join('')}
      </tbody>`;
    })
    .join('');
  return `
    <table class="items">
      <thead>
        <tr>
          <th class="c-check">✓</th>
          <th class="c-qty">Cant.</th>
          <th class="c-name">Producto</th>
          <th class="c-sku">SKU</th>
          <th class="c-bc">Código</th>
        </tr>
      </thead>
      ${body || '<tbody><tr><td colspan="5" class="muted">Sin productos</td></tr></tbody>'}
    </table>`;
};

const buildSheet = async (p: PostsalePicking, printedAt: string): Promise<string> => {
  const orderNo = clean(p.orderNo).replace(/^#/, '');
  const qrSvg = await buildQrSvg(p.qr);
  const items = p.items ?? [];
  const totalUnits = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  const phone = formatPhone(p.customerPhone);
  const shipLines = [
    clean(p.place) && `<div><b>Lugar:</b> ${escapeHtml(clean(p.place))}</div>`,
    clean(p.address) && `<div><b>Dirección:</b> ${escapeHtml(clean(p.address))}</div>`,
    clean(p.reference) && `<div><b>Referencia:</b> ${escapeHtml(clean(p.reference))}</div>`,
  ]
    .filter(Boolean)
    .join('');
  const notes = [
    clean(p.orderNotes) &&
      `<div class="note"><b>Notas del pedido:</b> ${escapeHtml(clean(p.orderNotes))}</div>`,
    clean(p.deliveryNotes) &&
      `<div class="note"><b>Notas de entrega:</b> ${escapeHtml(clean(p.deliveryNotes))}</div>`,
  ]
    .filter(Boolean)
    .join('');

  return `
  <section class="sheet">
    <header class="head">
      <div class="head-main">
        <div class="title">HOJA DE ARMADO</div>
        <div class="order">#${escapeHtml(orderNo)}</div>
        <div class="meta">
          <span class="status">${escapeHtml(clean(p.statusLabel) || p.status)}</span>
          <span>Impreso: ${escapeHtml(printedAt)}</span>
        </div>
      </div>
      <div class="qr">${qrSvg}</div>
    </header>

    <div class="cols">
      <div class="col">
        <div class="label">CLIENTE</div>
        <div class="big">${escapeHtml(clean(p.customerName) || '—')}</div>
        ${phone ? `<div>Tel.: <b>${escapeHtml(phone)}</b></div>` : ''}
      </div>
      <div class="col">
        <div class="label">DESPACHO</div>
        <div class="big">${escapeHtml(clean(p.routeLabel) || p.route)}</div>
        ${shipLines}
      </div>
      <div class="col col-total">
        <div class="label">TOTAL</div>
        <div class="big">${escapeHtml(formatSoles(p.totalCents))}</div>
      </div>
    </div>
    ${notes ? `<div class="notes">${notes}</div>` : ''}

    ${buildItemsTable(items)}

    <footer class="foot">
      <div class="counts">${items.length} ítem${items.length === 1 ? '' : 's'} · ${totalUnits} unidades</div>
      <div class="sign">
        <span>Armado por: ______________________________</span>
        <span>Fecha/hora: ____________________</span>
      </div>
    </footer>
  </section>`;
};

/**
 * Documento HTML (A4) con una hoja por pedido.
 * `zeroMarginPrinter`: Electron imprime sin márgenes, así que el margen va como
 * padding de cada hoja en vez de `@page`.
 */
export const buildPickingSheetsHtml = async (
  sheets: PostsalePicking[],
  zeroMarginPrinter = false
): Promise<string> => {
  const printedAt = formatNow();
  const pages = await Promise.all(sheets.map((s) => buildSheet(s, printedAt)));
  const pageMargin = zeroMarginPrinter ? 0 : PAGE_MARGIN_MM;
  const sheetPadding = zeroMarginPrinter ? PAGE_MARGIN_MM : 0;
  const title =
    sheets.length === 1
      ? `Hoja de armado ${clean(sheets[0].orderNo).replace(/^#/, '')}`
      : 'Hojas de armado';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 portrait; margin: ${pageMargin}mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #000; font-size: 10pt; }
  .sheet { padding: ${sheetPadding}mm; page-break-after: always; break-after: page; }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 0.8mm solid #000; padding-bottom: 3mm; }
  .title { font-size: 10pt; font-weight: 700; letter-spacing: 0.6mm; }
  .order { font-size: 40pt; font-weight: 900; line-height: 1.05; letter-spacing: 0.5mm; }
  .meta { display: flex; gap: 5mm; align-items: center; font-size: 9.5pt; margin-top: 1mm; }
  .status { border: 0.4mm solid #000; padding: 0.5mm 2mm; font-weight: 700; }
  .qr { width: ${QR_SIZE_MM}mm; height: ${QR_SIZE_MM}mm; line-height: 0; flex-shrink: 0; }
  .qr svg { width: ${QR_SIZE_MM}mm; height: ${QR_SIZE_MM}mm; display: block; }
  .cols { display: flex; gap: 5mm; margin-top: 3mm; }
  .col { flex: 1; line-height: 1.35; }
  .col-total { flex: 0 0 32mm; text-align: right; }
  .label { font-size: 8pt; font-weight: 700; letter-spacing: 0.4mm; }
  .big { font-size: 13pt; font-weight: 900; margin-bottom: 0.5mm; }
  .notes { margin-top: 3mm; border: 0.4mm solid #000; padding: 2mm 3mm; line-height: 1.35; }
  .note + .note { margin-top: 1mm; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  table.items th { font-size: 8.5pt; text-align: left; border-bottom: 0.6mm solid #000; padding: 1.5mm 1.5mm; }
  table.items td { border-bottom: 0.2mm solid #000; padding: 1.8mm 1.5mm; vertical-align: middle; }
  table.items tbody { page-break-inside: auto; }
  table.items tr { page-break-inside: avoid; break-inside: avoid; }
  tr.wh td { font-weight: 900; font-size: 10pt; border-bottom: 0.5mm solid #000; padding-top: 3mm; letter-spacing: 0.3mm; }
  .wh-count { float: right; font-weight: 700; font-size: 9pt; letter-spacing: 0; }
  .c-check { width: 9mm; text-align: center; }
  .box { width: 5mm; height: 5mm; border: 0.5mm solid #000; margin: 0 auto; }
  .c-qty { width: 15mm; text-align: center; font-size: 18pt; font-weight: 900; }
  th.c-qty { font-size: 8.5pt; }
  .c-name { }
  .pname { font-size: 10.5pt; font-weight: 700; }
  .pdetail { font-size: 9pt; margin-top: 0.5mm; }
  .c-sku { width: 26mm; font-size: 9pt; font-weight: 700; word-break: break-all; }
  .c-bc { width: ${BARCODE_MAX_WIDTH_MM + 3}mm; text-align: center; }
  .bc { line-height: 0; display: flex; justify-content: center; }
  .bc svg { display: block; height: ${BARCODE_HEIGHT_MM}mm; }
  .bc-stretched svg { width: ${BARCODE_MAX_WIDTH_MM}mm; }
  .bc-text { font-size: 8pt; letter-spacing: 0.3mm; margin-top: 0.5mm; }
  .muted { color: #000; }
  .foot { margin-top: 6mm; page-break-inside: avoid; break-inside: avoid; }
  .counts { font-weight: 900; font-size: 11pt; margin-bottom: 6mm; }
  .sign { display: flex; justify-content: space-between; gap: 6mm; font-size: 10.5pt; }
</style>
</head>
<body>${pages.join('')}</body>
</html>`;
};

/**
 * Genera la hoja de armado de uno o varios pedidos (un solo documento) y la
 * manda a imprimir / guardar como PDF según la plataforma.
 */
export const printPickingSheets = async (
  sheets: PostsalePicking[],
  /** Electron: impresora preseleccionada en el diálogo (no imprime en silencio). */
  deviceName?: string
): Promise<void> => {
  if (!sheets.length) return;

  if (Platform.OS === 'web') {
    const api = getElectronPrintApi();
    if (api?.printHTML) {
      const html = await buildPickingSheetsHtml(sheets, true);
      const result = await api.printHTML({
        html,
        silent: false,
        ...(deviceName ? { deviceName } : {}),
        // Micrones: A4 (210 × 297 mm).
        pageSize: { width: PAGE_WIDTH_MM * 1000, height: PAGE_HEIGHT_MM * 1000 },
        landscape: false,
      });
      // Cancelar el diálogo no es un error.
      if (!result?.success && result?.error && !/cancel/i.test(result.error)) {
        throw new Error(result.error);
      }
      return;
    }
    printHtmlOnWeb(await buildPickingSheetsHtml(sheets));
    return;
  }

  const html = await buildPickingSheetsHtml(sheets);
  const Print = await import('expo-print');
  try {
    const { uri } = await Print.printToFileAsync({ html });
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Hoja de armado',
      });
      return;
    }
  } catch (err) {
    logger.warn('No se pudo generar/compartir el PDF de la hoja de armado; se imprime', err);
  }
  await Print.printAsync({ html });
};
