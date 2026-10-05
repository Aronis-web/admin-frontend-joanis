/**
 * Impresión de stickers de pedido (post venta de redes sociales) en la Godex
 * (203 dpi): un sticker por página de 104 × 75 mm (ancho completo del rollo).
 *
 * Misma lógica de impresión que el "Sticker precio" de Stock
 * (`stickerLabelPrint.ts`): en Electron va directo y en silencio a la
 * impresora elegida (`deviceName`) con `pageSize` en micrones; en navegador
 * puro, iframe oculto; en Android/iOS, `expo-print`.
 *
 * Diseño (posiciones absolutas en mm, márgenes de 2 mm, solo negro):
 *
 *   ┌──────────────┬──────────────────────────────────────────┐
 *   │ QR ~29 mm    │ Nombre I.                                │
 *   │ (módulos     │ [ RECOJO EN TIENDA ]                     │
 *   │  alineados a │ Destino (máx. 2 líneas…)                 │
 *   │  dots)       │──────────────────────────────────────────│
 *   │              │ PRODUCTOS · N und.                       │
 *   │   #ABC123    │ 2× NOMBRE DEL PRODUCTO…                  │
 *   │   N und.     │ … +N más                                 │
 *   └──────────────┴──────────────────────────────────────────┘
 */

import { Platform } from 'react-native';
import QRCode from 'qrcode';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

/** Tamaño de la página (un sticker), en milímetros. */
const PAGE_WIDTH_MM = 104;
const PAGE_HEIGHT_MM = 75;
/** Margen de seguridad en mm. */
const MARGIN_MM = 2;
/** Lado máximo del QR en mm. */
const QR_MAX_MM = 30;
/** 1 dot de la Godex a 203 dpi, en mm (25.4 / 203). */
const DOT_MM = 25.4 / 203;
/** Columna izquierda (QR + número de pedido). */
const LEFT_W_MM = 32;
/** Columna derecha. */
const RIGHT_X_MM = MARGIN_MM + LEFT_W_MM + 3;
const RIGHT_W_MM = PAGE_WIDTH_MM - RIGHT_X_MM - MARGIN_MM;
/** Lista de productos: alto de línea y líneas que caben. */
const ITEM_LINE_MM = 3.9;
const ITEMS_TOP_MM = 27;
const ITEMS_HEAD_MM = 3.6;
const MAX_ITEM_LINES = Math.floor(
  (PAGE_HEIGHT_MM - MARGIN_MM - ITEMS_TOP_MM - ITEMS_HEAD_MM) / ITEM_LINE_MM
);
/** Máximo de caracteres por nombre de producto (una línea; CSS también recorta). */
const MAX_ITEM_NAME = 40;

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

const mm = (v: number) => `${Math.round(v * 1000) / 1000}mm`;

/**
 * QR con módulos de un número entero de dots (nítido a 203 dpi): se elige el
 * módulo más grande que entra en 30 mm. Si falla, SVG estándar escalado.
 */
const buildQrSvg = async (text: string): Promise<{ svg: string; sizeMm: number }> => {
  try {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const n = modules.size;
    const dotsPerModule = Math.max(1, Math.floor(QR_MAX_MM / n / DOT_MM));
    const sizeMm = n * dotsPerModule * DOT_MM;
    let path = '';
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (modules.get(r, c)) {
          const start = c;
          while (c < n && modules.get(r, c)) c++;
          path += `M${start} ${r}h${c - start}v1h${start - c}z`;
        } else {
          c++;
        }
      }
    }
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" ` +
      `width="${mm(sizeMm)}" height="${mm(sizeMm)}" shape-rendering="crispEdges">` +
      `<path d="${path}" fill="#000"/></svg>`;
    return { svg, sizeMm };
  } catch (err) {
    logger.warn('QR alineado a dots no disponible; se usa el SVG estándar', err);
  }
  try {
    const svg = await QRCode.toString(text, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
    });
    return { svg, sizeMm: QR_MAX_MM };
  } catch (err) {
    logger.error('No se pudo generar el QR del sticker de pedido', err);
    return { svg: '', sizeMm: QR_MAX_MM };
  }
};

/** Tamaño de letra (pt) del número de pedido para que entre en la columna. */
const orderNoFontPt = (text: string): number => {
  // Ancho medio de un carácter en negrita ≈ 0.62 em; 1 pt = 0.3528 mm.
  const fit = (LEFT_W_MM - 1) / (Math.max(1, text.length) * 0.62 * 0.3528);
  return Math.max(12, Math.min(24, Math.floor(fit)));
};

const buildItemsHtml = (items: OrderStickerData['items']): string => {
  const list = (items ?? []).filter((it) => clean(it?.name));
  if (!list.length) return '<div class="item">—</div>';
  const overflow = list.length > MAX_ITEM_LINES;
  const visible = overflow ? list.slice(0, MAX_ITEM_LINES - 1) : list;
  const rows = visible.map(
    (it) =>
      `<div class="item"><span class="qty">${escapeHtml(String(it.qty ?? 1))}×</span>` +
      `<span class="iname">${escapeHtml(truncate(clean(it.name).toUpperCase(), MAX_ITEM_NAME))}</span></div>`
  );
  if (overflow) {
    rows.push(`<div class="item more">+${list.length - visible.length} más</div>`);
  }
  return rows.join('');
};

const buildSticker = async (data: OrderStickerData): Promise<string> => {
  const orderNo = `#${clean(data.orderNo).replace(/^#/, '')}`;
  const { svg: qrSvg, sizeMm: qrMm } = await buildQrSvg(data.qr);
  const destination = clean(data.destination);
  const totalUnits = (data.items ?? []).reduce((acc, it) => acc + (Number(it?.qty) || 0), 0);
  // QR centrado en la columna izquierda; número de pedido debajo.
  const qrLeft = MARGIN_MM + (LEFT_W_MM - qrMm) / 2;
  const orderTop = MARGIN_MM + qrMm + 1.5;

  return `
  <div class="page">
    <div class="qr" style="left:${mm(qrLeft)};width:${mm(qrMm)};height:${mm(qrMm)}">${qrSvg}</div>
    <div class="order" style="top:${mm(orderTop)};font-size:${orderNoFontPt(orderNo)}pt">${escapeHtml(orderNo)}</div>
    <div class="units" style="top:${mm(orderTop + 10)}">${totalUnits} und.</div>
    <div class="customer">${escapeHtml(truncate(clean(data.customer) || '—', 34))}</div>
    <div class="route">${escapeHtml(truncate(clean(data.routeLabel).toUpperCase(), 26))}</div>
    ${destination ? `<div class="dest">${escapeHtml(truncate(destination, 110))}</div>` : ''}
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
  /* Columna izquierda */
  .qr { top: ${MARGIN_MM}mm; line-height: 0; }
  .qr svg { display: block; width: 100%; height: 100%; }
  .order {
    left: ${MARGIN_MM}mm;
    width: ${LEFT_W_MM}mm;
    height: 9mm;
    line-height: 9mm;
    text-align: center;
    font-weight: 900;
    white-space: nowrap;
    letter-spacing: 0.2mm;
  }
  .units {
    left: ${MARGIN_MM}mm;
    width: ${LEFT_W_MM}mm;
    height: 5mm;
    line-height: 5mm;
    text-align: center;
    font-size: 10pt;
    font-weight: 700;
  }
  /* Columna derecha */
  .customer, .dest, .items { left: ${mm(RIGHT_X_MM)}; width: ${mm(RIGHT_W_MM)}; }
  .customer {
    top: ${MARGIN_MM}mm;
    height: 7mm;
    line-height: 7mm;
    font-size: 15pt;
    font-weight: 900;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .route {
    left: ${mm(RIGHT_X_MM)};
    top: 9.6mm;
    height: 6.6mm;
    line-height: 5.6mm;
    max-width: ${mm(RIGHT_W_MM)};
    padding: 0 1.6mm;
    border: 0.5mm solid #000;
    font-size: 11pt;
    font-weight: 900;
    white-space: nowrap;
  }
  .dest {
    top: 17mm;
    height: 8.6mm;
    font-size: 9pt;
    font-weight: 700;
    line-height: 4.3mm;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .items {
    top: ${ITEMS_TOP_MM}mm;
    bottom: ${MARGIN_MM}mm;
    border-top: 0.5mm solid #000;
    padding-top: 0.4mm;
  }
  .items-head {
    height: ${ITEMS_HEAD_MM - 0.4}mm;
    line-height: ${ITEMS_HEAD_MM - 0.4}mm;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.3mm;
  }
  .item {
    height: ${ITEM_LINE_MM}mm;
    line-height: ${ITEM_LINE_MM}mm;
    font-size: 9pt;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .qty { display: inline-block; min-width: 7mm; font-weight: 900; }
  .iname { padding-left: 0.6mm; }
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
 * Imprime los stickers de pedido (uno por página, 104 × 75 mm). En Electron va
 * directo y en silencio a la impresora elegida con el tamaño de página exacto;
 * en navegador abre el diálogo de impresión; en nativo usa expo-print.
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
        // Micrones: 104 × 75 mm (1 mm = 1000 micrones).
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
