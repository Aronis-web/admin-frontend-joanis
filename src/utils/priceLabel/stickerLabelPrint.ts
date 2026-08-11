/**
 * Impresión de "stickers de precio" en rollo de etiquetas Godex (3 stickers por
 * fila, cada uno ~33 × 20 mm, fila total ~104 mm de ancho).
 *
 * A diferencia de la "etiqueta de precio" (80 mm de anaquel), aquí se imprimen N
 * stickers idénticos del mismo producto, distribuidos 3 por fila. Cada sticker
 * lleva, de arriba a abajo:
 *   - Marca "Joanis" (pequeña)
 *   - Nombre del producto
 *   - Precio (grande, al centro)
 *   - Código de barras Code128 real (escaneable)
 *   - SKU
 *
 * En Electron se imprime con `pageSize` personalizado (104 × 20 mm) directo a la
 * impresora; en navegador puro se usa un iframe oculto.
 */

import { Platform } from 'react-native';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { code128Svg } from './code128Svg';
import { formatLabelPrice } from './priceLabelPrint';

/** Ancho de la fila (3 stickers) y alto del sticker, en milímetros. */
const ROW_WIDTH_MM = 104;
const ROW_HEIGHT_MM = 20;
/** Centros horizontales de cada columna (mm), simétricos respecto al centro. */
const COLUMN_CENTERS_MM = [19, 52, 85];
const STICKER_WIDTH_MM = 33;
const STICKERS_PER_ROW = COLUMN_CENTERS_MM.length;
/** Ancho del código de barras (mm) y su margen izquierdo para centrarlo. */
const BARCODE_WIDTH_MM = 22;
const BARCODE_LEFT_MM = (STICKER_WIDTH_MM - BARCODE_WIDTH_MM) / 2;

const BRAND = 'Joanis';

export interface StickerLabelData {
  /** Nombre del producto. */
  productName: string;
  /** Valor a codificar en el código de barras (barcode o, en su defecto, SKU). */
  barcodeValue?: string;
  /** SKU mostrado como texto bajo el código de barras. */
  sku?: string;
  /** Precio en centavos. */
  priceCents: number;
  /** Moneda ISO (default PEN → "S/"). */
  currency?: string;
  /** Cantidad total de stickers a imprimir. Default 1. */
  quantity?: number;
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

const escapeHtml = (value: string): string =>
  (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** HTML de un sticker individual, posicionado en la columna `centerMm`. */
const buildSticker = (data: StickerLabelData, centerMm: number): string => {
  const priceText = formatLabelPrice(data.priceCents, data.currency);
  const barcodeRaw = (data.barcodeValue ?? '').trim();
  const skuText = (data.sku ?? '').trim();
  // quietZone 8 módulos por lado: replica exactamente la plantilla calibrada
  // en la Godex (ancho total del barcode = 22 mm incluyendo zonas de silencio).
  const svg = barcodeRaw ? code128Svg(barcodeRaw, { height: 60, quietZone: 8 }) : null;

  const left = centerMm - STICKER_WIDTH_MM / 2;
  const barcodeHtml = svg ? `<div class="barcode">${svg}</div>` : '';
  const skuHtml = skuText ? `<div class="sku">${escapeHtml(skuText)}</div>` : '';

  return `
    <div class="sticker" style="left:${left}mm">
      <div class="brand">${escapeHtml(BRAND)}</div>
      <div class="name">${escapeHtml(data.productName || '—')}</div>
      <div class="price">${escapeHtml(priceText)}</div>
      ${barcodeHtml}
      ${skuHtml}
    </div>`;
};

/** Documento HTML completo con N stickers distribuidos 3 por fila. */
const buildStickersHtml = (data: StickerLabelData): string => {
  const quantity = Math.max(1, Math.min(200, Math.floor(data.quantity ?? 1)));
  const rowsCount = Math.ceil(quantity / STICKERS_PER_ROW);

  let remaining = quantity;
  const rows: string[] = [];
  for (let r = 0; r < rowsCount; r++) {
    const inThisRow = Math.min(STICKERS_PER_ROW, remaining);
    const stickers = COLUMN_CENTERS_MM.slice(0, inThisRow)
      .map((center) => buildSticker(data, center))
      .join('');
    rows.push(`<div class="row">${stickers}</div>`);
    remaining -= inThisRow;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Stickers de precio</title>
<style>
  @page { size: ${ROW_WIDTH_MM}mm ${ROW_HEIGHT_MM}mm; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #000; }
  .row {
    position: relative;
    width: ${ROW_WIDTH_MM}mm;
    height: ${ROW_HEIGHT_MM}mm;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
  }
  .row:last-child { page-break-after: auto; break-after: auto; }
  /* Layout con posiciones absolutas (mm), calibrado físicamente en la Godex. */
  .sticker {
    position: absolute;
    top: 0;
    width: ${STICKER_WIDTH_MM}mm;
    height: ${ROW_HEIGHT_MM}mm;
    overflow: hidden;
  }
  .sticker > div {
    position: absolute;
    text-align: center;
    overflow: hidden;
  }
  .brand, .name, .price, .sku { left: 0; width: 100%; }
  .brand {
    top: 3.3mm;
    height: 3mm;
    line-height: 3mm;
    font-size: 6.5pt;
    font-weight: 700;
    letter-spacing: 0.3mm;
  }
  .name {
    top: 6.2mm;
    height: 3mm;
    line-height: 3mm;
    font-size: 6.5pt;
    font-weight: 400;
    white-space: nowrap;
  }
  .price {
    top: 9mm;
    height: 5mm;
    line-height: 5mm;
    font-size: 12pt;
    font-weight: 700;
  }
  .barcode {
    top: 13.6mm;
    height: 3.4mm;
    width: ${BARCODE_WIDTH_MM}mm;
    left: ${BARCODE_LEFT_MM}mm;
  }
  .barcode svg { display: block; width: 100%; height: 100%; }
  .sku {
    top: 17.4mm;
    height: 2.2mm;
    line-height: 2.2mm;
    font-size: 5.5pt;
    letter-spacing: 0.2mm;
  }
</style>
</head>
<body>${rows.join('')}</body>
</html>`;
};

/** True cuando corremos dentro de Electron con impresión nativa disponible. */
export const isElectronStickerPrinting = (): boolean => !!getElectronPrintApi()?.printHTML;

/** Imprime el HTML en navegador puro mediante un iframe oculto. */
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
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch (err) {
          logger.error('Error al invocar print de stickers en iframe:', err);
        }
        cleanup();
      }, 300);
    } catch (err) {
      logger.error('Error accediendo al iframe de stickers:', err);
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
 * Imprime N stickers de precio (3 por fila) en la impresora de rollo. En
 * Electron llega directo a la impresora con el tamaño de página correcto
 * (104 × 20 mm); en navegador puro abre el diálogo de impresión.
 */
export const printPriceStickers = async (data: StickerLabelData): Promise<void> => {
  const html = buildStickersHtml(data);

  if (Platform.OS === 'web') {
    const api = getElectronPrintApi();
    if (api?.printHTML) {
      const result = await api.printHTML({
        html,
        deviceName: data.deviceName,
        silent: !!data.deviceName,
        // Micrones: 104 × 20 mm (1 mm = 1000 micrones).
        pageSize: { width: ROW_WIDTH_MM * 1000, height: ROW_HEIGHT_MM * 1000 },
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
