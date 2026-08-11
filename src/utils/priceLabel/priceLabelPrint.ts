/**
 * Impresión de etiquetas de precio para anaquel (impresora térmica 80mm).
 *
 * La etiqueta lleva, de arriba a abajo:
 *   - Marca "Joanis"
 *   - Nombre del producto
 *   - Código de barras (Code128) + su texto
 *   - Precio
 *
 * El ancho fijo es 80mm y el alto es muy inferior (auto, ~ contenido), tal como
 * requiere el rollo térmico. En web/Electron se imprime vía un iframe oculto
 * (misma técnica que `campaignPhotosPdf`), y en nativo se usa `expo-print`.
 */

import { Platform } from 'react-native';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { code128Svg } from './code128Svg';

export interface PriceLabelData {
  /** Nombre del producto (se muestra bajo la marca). */
  productName: string;
  /** Valor a codificar en el código de barras (barcode o, en su defecto, SKU). */
  barcodeValue?: string;
  /** Precio en centavos. */
  priceCents: number;
  /** Moneda ISO (default PEN → "S/"). */
  currency?: string;
  /** Nombre del perfil de precio usado (ej. "Socia"), opcional para referencia. */
  profileName?: string;
  /** Número de copias a imprimir. Default 1. */
  copies?: number;
  /**
   * Nombre exacto de la impresora (deviceName del SO). Si se indica en Electron,
   * se imprime de forma silenciosa directamente a esa impresora; si no, se abre
   * el diálogo del sistema.
   */
  deviceName?: string;
}

/** Información de una impresora detectada por el SO (Electron). */
export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

interface ElectronPrintApi {
  getPrinters?: () => Promise<PrinterInfo[]>;
  printHTML?: (options: {
    html: string;
    deviceName?: string;
    silent?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
}

/** Devuelve la API de Electron si está disponible (con soporte de impresión). */
const getElectronPrintApi = (): ElectronPrintApi | null => {
  if (typeof window === 'undefined') return null;
  const api = (window as unknown as { electronAPI?: ElectronPrintApi }).electronAPI;
  if (api && (typeof api.printHTML === 'function' || typeof api.getPrinters === 'function')) {
    return api;
  }
  return null;
};

/** True cuando corremos dentro de Electron con impresión nativa disponible. */
export const isElectronPrinting = (): boolean => !!getElectronPrintApi()?.printHTML;

/**
 * Lista las impresoras detectadas por el sistema operativo (solo Electron).
 * Devuelve [] si no estamos en Electron o si no se detecta ninguna. Útil para
 * verificar que la impresora térmica esté realmente conectada.
 */
export const listPrinters = async (): Promise<PrinterInfo[]> => {
  const api = getElectronPrintApi();
  if (!api?.getPrinters) return [];
  try {
    const printers = await api.getPrinters();
    return Array.isArray(printers) ? printers : [];
  } catch (err) {
    logger.error('Error obteniendo impresoras', err);
    return [];
  }
};

const BRAND = 'Joanis';

const escapeHtml = (value: string): string =>
  (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const currencySymbol = (currency?: string): string =>
  currency === 'USD' ? '$' : currency === 'PEN' || !currency ? 'S/' : `${currency} `;

/** Formatea centavos a texto de precio, ej. "S/ 12.90". */
export const formatLabelPrice = (priceCents: number, currency?: string): string => {
  const amount = Number(priceCents || 0) / 100;
  return `${currencySymbol(currency)} ${amount.toFixed(2)}`;
};

/** Construye el bloque HTML de una única etiqueta. */
const buildLabelBlock = (data: PriceLabelData): string => {
  const priceText = formatLabelPrice(data.priceCents, data.currency);
  const barcodeRaw = (data.barcodeValue ?? '').trim();
  const svg = barcodeRaw ? code128Svg(barcodeRaw, { height: 60 }) : null;

  const barcodeHtml = svg
    ? `<div class="barcode">${svg}</div><div class="code">${escapeHtml(barcodeRaw)}</div>`
    : '';

  return `
    <div class="label">
      <div class="frame">
        <div class="brand">${escapeHtml(BRAND)}</div>
        <div class="name">${escapeHtml(data.productName || '—')}</div>
        <div class="price">${escapeHtml(priceText)}</div>
        ${barcodeHtml}
      </div>
    </div>`;
};

/** Construye el documento HTML completo con N copias de la etiqueta. */
const buildLabelHtml = (data: PriceLabelData): string => {
  const copies = Math.max(1, Math.min(50, Math.floor(data.copies ?? 1)));
  const blocks = Array.from({ length: copies }, () => buildLabelBlock(data)).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Etiqueta de precio</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #000; }
  .label {
    width: 80mm;
    padding: 1.5mm;
    page-break-after: always;
    break-after: page;
  }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .frame {
    border: 1.5px solid #000;
    border-radius: 3mm;
    padding: 0.5mm 3mm 0.7mm;
    text-align: center;
  }
  .brand {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    line-height: 1;
    margin-bottom: 0.3mm;
  }
  .name {
    font-size: 15px;
    font-weight: 800;
    line-height: 1.05;
    margin: 0 0 0.4mm;
    max-height: 32px;
    overflow: hidden;
  }
  .price {
    font-size: 32px;
    font-weight: 800;
    line-height: 1.05;
    margin: 0.3mm 0 1.4mm;
  }
  .barcode {
    display: block;
    width: 70mm;
    height: 4mm;
    margin: 0 auto;
  }
  .barcode svg { display: block; width: 100%; height: 100%; }
  .code {
    font-size: 9px;
    letter-spacing: 2px;
    margin-top: 0.2mm;
  }
</style>
</head>
<body>${blocks}</body>
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
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch (err) {
          logger.error('Error al invocar print en iframe:', err);
        }
        cleanup();
      }, 300);
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
    Alert.alert('Error', 'No se pudo preparar la etiqueta para imprimir.');
    cleanup();
  }
};

/**
 * Imprime un documento HTML en impresora térmica de 80mm de forma
 * cross-platform:
 *  - Electron: canal nativo directo a la impresora instalada (silencioso si se
 *    indica `deviceName`).
 *  - Navegador puro: iframe oculto + diálogo de impresión.
 *  - Nativo (Android/iOS): `expo-print`.
 *
 * Reutilizable por cualquier documento térmico (etiquetas, tickets, etc.).
 */
export const printHtml = async (html: string, deviceName?: string): Promise<void> => {
  if (Platform.OS === 'web') {
    const api = getElectronPrintApi();
    if (api?.printHTML) {
      const result = await api.printHTML({
        html,
        deviceName,
        silent: !!deviceName,
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

/**
 * Imprime la etiqueta de precio. En web/Electron abre el diálogo de impresión
 * (donde se elige la impresora térmica de 80mm); en nativo usa `expo-print`.
 */
export const printPriceLabel = async (data: PriceLabelData): Promise<void> => {
  const html = buildLabelHtml(data);
  await printHtml(html, data.deviceName);
};
