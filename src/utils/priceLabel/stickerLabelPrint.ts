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
import { code128SvgDetailed } from './code128Svg';
import { formatLabelPrice } from './priceLabelPrint';

/** Ancho de la fila (3 stickers) y alto del sticker, en milímetros. */
const ROW_WIDTH_MM = 104;
const ROW_HEIGHT_MM = 20;
/** Centros horizontales de cada columna (mm), simétricos respecto al centro. */
const COLUMN_CENTERS_MM = [19, 52, 85];
const STICKER_WIDTH_MM = 33;
const STICKERS_PER_ROW = COLUMN_CENTERS_MM.length;
/** Alto del código de barras en mm. */
const BARCODE_HEIGHT_MM = 6.8;
/**
 * Ancho de módulo del Code128 en mm. 0.25mm = 2 dots a 203dpi (resolución de
 * las Godex). Cualquier valor menor produce barras con anchos irregulares al
 * rasterizar y los scanners rechazan el código.
 */
const MODULE_WIDTH_MM = 0.25;
/**
 * Ancho de módulo mínimo (mm) al que reduciremos si el código no entra en el
 * sticker. 1 dot a 203dpi. En esa resolución el código sigue siendo legible
 * por scanners de gama media/alta pero puede fallar en gama baja.
 */
const MODULE_WIDTH_MM_MIN = 0.125;
/** Máximo ancho útil del barcode dentro del sticker (deja 1.5mm de margen). */
const BARCODE_MAX_WIDTH_MM = STICKER_WIDTH_MM - 3;

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

/**
 * Normaliza el nombre para que ocupe siempre una sola línea de ancho estable:
 * quita espacios extra, pasa a mayúsculas y trunca a un máximo de caracteres
 * (con ellipsis) para que no descuadre el resto de elementos del sticker.
 */
const normalizeProductName = (raw: string | undefined): string => {
  const cleaned = (raw ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (!cleaned) return '—';
  const MAX = 28;
  return cleaned.length > MAX ? `${cleaned.slice(0, MAX - 1)}…` : cleaned;
};

/**
 * Genera el SVG del barcode con ancho intrínseco en mm (dot-aligned) para que
 * los scanners lo lean. Intenta primero con 0.25mm/módulo (2 dots @203dpi);
 * si no cabe en el sticker, prueba con 0.125mm (1 dot); si sigue sin caber,
 * cae al modo estirado (menos confiable, mejor que nada).
 */
const buildBarcodeHtml = (barcodeRaw: string): string => {
  if (!barcodeRaw) return '';

  // Sólo probamos anchos que sean múltiplo entero de dots @203dpi (0.125mm).
  // Otros valores generan ratios no consistentes entre módulos → ilegible.
  const candidates = [MODULE_WIDTH_MM, MODULE_WIDTH_MM_MIN];
  for (const mw of candidates) {
    const result = code128SvgDetailed(barcodeRaw, {
      height: 120,
      quietZone: 8,
      moduleWidthMm: mw,
      heightMm: BARCODE_HEIGHT_MM,
    });
    if (result?.widthMm && result.widthMm <= BARCODE_MAX_WIDTH_MM) {
      // Centramos el SVG intrínseco dentro del contenedor absoluto.
      return `<div class="barcode"><div class="barcode-inner">${result.svg}</div></div>`;
    }
  }

  // Fallback: no entra ni con módulo mínimo. Estiramos al ancho máximo (se
  // pierde precisión, avisamos por log para que el usuario acorte el código).
  const stretched = code128SvgDetailed(barcodeRaw, { height: 120, quietZone: 8 });
  if (!stretched) return '';
  logger.warn('Barcode demasiado largo para el sticker; se estira al máximo (puede no leerse)', {
    text: barcodeRaw,
  });
  return `<div class="barcode barcode-stretched">${stretched.svg}</div>`;
};

/** HTML de un sticker individual, posicionado en la columna `centerMm`. */
const buildSticker = (data: StickerLabelData, centerMm: number): string => {
  const priceText = formatLabelPrice(data.priceCents, data.currency);
  const barcodeRaw = (data.barcodeValue ?? '').trim();
  const skuText = (data.sku ?? '').trim();
  const nameText = normalizeProductName(data.productName);

  const left = centerMm - STICKER_WIDTH_MM / 2;
  const barcodeHtml = buildBarcodeHtml(barcodeRaw);
  const skuHtml = skuText ? `<div class="sku">${escapeHtml(skuText)}</div>` : '';

  return `
    <div class="sticker" style="left:${left}mm">
      <div class="brand">${escapeHtml(BRAND)}</div>
      <div class="name">${escapeHtml(nameText)}</div>
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
    top: 0.3mm;
    height: 2.8mm;
    line-height: 2.8mm;
    font-size: 6.5pt;
    font-weight: 700;
    letter-spacing: 0.3mm;
  }
  .name {
    top: 3mm;
    height: 2.8mm;
    line-height: 2.8mm;
    font-size: 6.5pt;
    font-weight: 400;
    white-space: nowrap;
    text-overflow: ellipsis;
    padding: 0 0.5mm;
  }
  .price {
    top: 5.7mm;
    height: 4.5mm;
    line-height: 4.5mm;
    font-size: 12pt;
    font-weight: 700;
  }
  .barcode {
    top: 10.2mm;
    height: ${BARCODE_HEIGHT_MM}mm;
    left: 0;
    width: ${STICKER_WIDTH_MM}mm;
    /* Contenedor a ancho de sticker; centramos el SVG intrínseco adentro. */
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .barcode-inner { display: block; line-height: 0; }
  .barcode svg { display: block; height: ${BARCODE_HEIGHT_MM}mm; }
  .barcode-stretched svg { width: ${BARCODE_MAX_WIDTH_MM}mm; }
  .sku {
    top: 17.2mm;
    height: 2.6mm;
    line-height: 2.6mm;
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
