/**
 * Impresión de stickers de pedido (post venta de redes sociales) en la Godex
 * (203 dpi), un sticker por página de 104 × 100 mm (ancho completo del rollo).
 *
 * Cada sticker lleva, en blanco y negro y con letra gruesa:
 *   - Número de pedido grande (`#ABC123`)
 *   - QR (~35 mm) con el texto `GRITPED:<uuid>` que se escanea en cada etapa
 *   - Cliente ("Nombre I."), tipo de despacho y destino
 *   - Lista de productos con cantidades (si no entran, "+N más")
 *
 * En Electron se imprime con `pageSize` personalizado directo a la impresora; en
 * navegador puro se usa un iframe oculto y en nativo `expo-print`.
 */

import { Platform } from 'react-native';
import QRCode from 'qrcode';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

/** Tamaño de la página (un sticker), en milímetros. */
const PAGE_WIDTH_MM = 104;
const PAGE_HEIGHT_MM = 100;
/** Lado del QR en milímetros. */
const QR_SIZE_MM = 35;
/** Máximo de líneas de productos que caben en el sticker. */
const MAX_ITEM_LINES = 9;
/** Máximo de caracteres por nombre de producto (una sola línea). */
const MAX_ITEM_NAME = 44;

export interface OrderStickerData {
  orderNo: string;
  /** Texto a codificar en el QR (`GRITPED:<uuid>`). */
  qr: string;
  /** Cliente ya abreviado ("Nombre I."). */
  customer: string;
  routeLabel: string;
  destination?: string | null;
  items: { name: string; qty: number }[];
}

export interface OrderStickerPrintOptions {
  /**
   * Nombre exacto de la impresora (deviceName del SO). Si se indica en Electron,
   * imprime de forma silenciosa directo a esa impresora.
   */
  deviceName?: string;
}

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

const escapeHtml = (value: string | null | undefined): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const clean = (value: string | null | undefined): string =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

/** SVG del QR (sin margen; el sticker ya deja espacio alrededor). */
const buildQrSvg = async (text: string): Promise<string> => {
  try {
    return await QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  } catch (err) {
    logger.error('No se pudo generar el QR del sticker de pedido', err);
    return '';
  }
};

const buildItemsHtml = (items: OrderStickerData['items']): string => {
  const list = (items ?? []).filter((it) => clean(it?.name));
  if (!list.length) return '<div class="item">—</div>';
  const overflow = list.length > MAX_ITEM_LINES;
  const visible = overflow ? list.slice(0, MAX_ITEM_LINES - 1) : list;
  const rows = visible.map(
    (it) =>
      `<div class="item"><span class="qty">${escapeHtml(String(it.qty ?? 1))}</span>` +
      `<span class="iname">${escapeHtml(truncate(clean(it.name).toUpperCase(), MAX_ITEM_NAME))}</span></div>`
  );
  if (overflow) {
    rows.push(`<div class="item more">+${list.length - visible.length} más</div>`);
  }
  return rows.join('');
};

const buildSticker = async (data: OrderStickerData): Promise<string> => {
  const orderNo = clean(data.orderNo).replace(/^#/, '');
  const qrSvg = await buildQrSvg(data.qr);
  const destination = clean(data.destination);
  const totalUnits = (data.items ?? []).reduce((acc, it) => acc + (Number(it?.qty) || 0), 0);

  return `
  <div class="page">
    <div class="order">#${escapeHtml(orderNo)}</div>
    <div class="qr">${qrSvg}</div>
    <div class="info">
      <div class="label">CLIENTE</div>
      <div class="customer">${escapeHtml(truncate(clean(data.customer) || '—', 40))}</div>
      <div class="route">${escapeHtml(truncate(clean(data.routeLabel).toUpperCase(), 28))}</div>
      ${destination ? `<div class="dest">${escapeHtml(truncate(destination, 120))}</div>` : ''}
    </div>
    <div class="items">
      <div class="items-head">PRODUCTOS · ${totalUnits} und.</div>
      ${buildItemsHtml(data.items)}
    </div>
  </div>`;
};

/** Documento HTML completo: un sticker por página. */
const buildOrderStickersHtml = async (stickers: OrderStickerData[]): Promise<string> => {
  const pages = await Promise.all(stickers.map((s) => buildSticker(s)));
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Stickers de pedido</title>
<style>
  @page { size: ${PAGE_WIDTH_MM}mm ${PAGE_HEIGHT_MM}mm; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #000; }
  .page {
    position: relative;
    width: ${PAGE_WIDTH_MM}mm;
    height: ${PAGE_HEIGHT_MM}mm;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .page > div { position: absolute; overflow: hidden; }
  .order {
    top: 2mm;
    left: 4mm;
    right: 4mm;
    height: 14mm;
    line-height: 14mm;
    font-size: 34pt;
    font-weight: 900;
    letter-spacing: 0.5mm;
    white-space: nowrap;
    border-bottom: 0.6mm solid #000;
  }
  .qr {
    top: 19mm;
    left: 4mm;
    width: ${QR_SIZE_MM}mm;
    height: ${QR_SIZE_MM}mm;
    line-height: 0;
  }
  .qr svg { display: block; width: ${QR_SIZE_MM}mm; height: ${QR_SIZE_MM}mm; }
  .info {
    top: 19mm;
    left: ${4 + QR_SIZE_MM + 3}mm;
    right: 4mm;
    height: ${QR_SIZE_MM}mm;
  }
  .label { font-size: 8pt; font-weight: 700; letter-spacing: 0.3mm; }
  .customer {
    font-size: 15pt;
    font-weight: 900;
    line-height: 1.15;
    max-height: 12mm;
    overflow: hidden;
    margin-bottom: 1.5mm;
  }
  .route {
    display: inline-block;
    font-size: 12pt;
    font-weight: 900;
    border: 0.6mm solid #000;
    padding: 0.6mm 1.5mm;
    margin-bottom: 1.2mm;
    white-space: nowrap;
  }
  .dest {
    font-size: 9.5pt;
    font-weight: 700;
    line-height: 1.2;
    max-height: 11.5mm;
    overflow: hidden;
  }
  .items {
    top: ${19 + QR_SIZE_MM + 2}mm;
    left: 4mm;
    right: 4mm;
    bottom: 2mm;
    border-top: 0.6mm solid #000;
    padding-top: 1mm;
  }
  .items-head { font-size: 8pt; font-weight: 700; letter-spacing: 0.3mm; margin-bottom: 0.6mm; }
  .item {
    font-size: 10pt;
    font-weight: 700;
    height: 4.1mm;
    line-height: 4.1mm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .qty { display: inline-block; min-width: 8mm; font-weight: 900; }
  .qty::after { content: ' ×'; }
  .iname { padding-left: 1mm; }
  .more { font-weight: 900; }
</style>
</head>
<body>${pages.join('')}</body>
</html>`;
};

/** Imprime el HTML en navegador puro mediante un iframe oculto. */
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
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch (err) {
          logger.error('Error al invocar print de stickers de pedido en iframe:', err);
        }
        cleanup();
      }, 300);
    } catch (err) {
      logger.error('Error accediendo al iframe de stickers de pedido:', err);
      cleanup();
    }
  };

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  } else {
    Alert.alert('Error', 'No se pudieron preparar los stickers para imprimir.');
    cleanup();
  }
};

/**
 * Imprime los stickers de pedido (uno por página, 104 × 100 mm). En Electron
 * llega directo a la impresora con el tamaño de página correcto; en navegador
 * abre el diálogo de impresión; en nativo usa expo-print.
 */
export const printOrderStickers = async (
  stickers: OrderStickerData[],
  options: OrderStickerPrintOptions = {}
): Promise<void> => {
  if (!stickers.length) return;
  const html = await buildOrderStickersHtml(stickers);

  if (Platform.OS === 'web') {
    const api = getElectronPrintApi();
    if (api?.printHTML) {
      const result = await api.printHTML({
        html,
        deviceName: options.deviceName,
        silent: !!options.deviceName,
        // Micrones: 104 × 100 mm (1 mm = 1000 micrones).
        pageSize: { width: PAGE_WIDTH_MM * 1000, height: PAGE_HEIGHT_MM * 1000 },
        landscape: false,
      });
      if (!result?.success) {
        throw new Error(result?.error || 'No se pudo imprimir en la impresora seleccionada.');
      }
      return;
    }

    printHtmlOnWeb(html);
    return;
  }

  const Print = await import('expo-print');
  await Print.printAsync({ html });
};
