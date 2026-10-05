/**
 * Impresión de stickers de pedido (post venta de redes sociales) en la Godex
 * (203 dpi): un sticker por página de 104 × 75 mm (ancho completo del rollo).
 *
 * Misma lógica de impresión que el "Sticker precio" de Stock
 * (`stickerLabelPrint.ts`): en Electron va directo y en silencio a la
 * impresora elegida (`deviceName`) con `pageSize` en micrones; en navegador
 * puro, iframe oculto; en Android/iOS, `expo-print`. Electron (`print-html` en
 * electron/main.js) imprime con `printBackground`, `margins: none` y el
 * `pageSize` indicado; el HTML usa `@page { size: 104mm 75mm; margin: 0 }`,
 * html/body sin margen ni padding, cada etiqueta mide exactamente 104 × 75 mm
 * con `overflow: hidden` y el salto de página va solo ENTRE etiquetas (la
 * última no lo lleva), para que el sensor de gap no se desfase.
 *
 * Diseño aprobado (posiciones absolutas en mm, solo negro: la etiqueta ya es
 * amarilla). Cada bloque de texto tiene alto fijo + overflow hidden + "…":
 *
 *   ┌───────────────────────────────────────┬────────────────┐
 *   │ GRIT LABS (grande)                    │ TIPO DE ENVÍO  │
 *   │ RUC 20607381047                       │ RECOJO EN TIENDA│
 *   │ Dirección de la empresa…              └────────────────┤
 *   ├──────────────┬──────────────────────────────────────────┤
 *   │ QR ~25 mm    │ DESTINATARIO                             │
 *   │ (3 mm blanco)│ NOMBRE COMPLETO (2 líneas)               │
 *   │              │ Cel. 986 715 089                         │
 *   │   #ABC123    │ Tienda Comas / Agencia / dirección…      │
 *   │ Inicio:      │ ┌──────────────────────────────────────┐ │
 *   │ 05/10 14:32  │ │ CANTIDAD DE ARTÍCULOS             3  │ │
 *   │ [ BULTO n ]  │ (siempre; BULTO 1 por defecto, sin total)  │
 *   └──────────────┴─┴──────────────────────────────────────┴─┘
 */

import { Platform } from 'react-native';
import QRCode from 'qrcode';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

/** Tamaño de la página (un sticker), en milímetros. */
const PAGE_WIDTH_MM = 104;
const PAGE_HEIGHT_MM = 75;
/** Recuadro del QR (lado máximo) y su posición: ≥ 3 mm de blanco alrededor. */
const QR_BOX_MM = 27;
const QR_BOX_LEFT_MM = 3;
const QR_TOP_MM = 19;
/** 1 dot de la Godex a 203 dpi, en mm (25.4 / 203). */
const DOT_MM = 25.4 / 203;
/** Columna izquierda (QR, número de pedido y fecha). */
const LEFT_COL_X_MM = 2;
const LEFT_COL_W_MM = 30;
/** Recuadro "Tipo de envío" (arriba a la derecha). */
const SHIP_W_MM = 42;
/** Ancho del nombre de la empresa (hasta el recuadro de envío). */
const BRAND_W_MM = PAGE_WIDTH_MM - 3 - 3 - SHIP_W_MM - 2;

export interface OrderStickerData {
  orderNo: string;
  /** Texto a codificar en el QR (`GRITPED:<uuid>`). */
  qr: string;
  /** Cliente abreviado ("Nombre I."): respaldo si falta `customerFullName`. */
  customer: string;
  route?: 'PICKUP' | 'DELIVERY_LIMA' | 'AGENCY' | string;
  routeLabel: string;
  /** Destino en texto (respaldo si falta `destinationDetail`). */
  destination?: string | null;
  /** Respaldo para `units` si el backend no lo envía. */
  items?: { name: string; qty: number }[];
  customerFullName?: string | null;
  /** 9 dígitos o null. */
  customerPhone?: string | null;
  /** Cantidad total de artículos. */
  units?: number | null;
  /** Fecha de impresión (ISO). */
  printedAt?: string | null;
  destinationDetail?: {
    place?: string | null;
    address?: string | null;
    reference?: string | null;
    agency?: string | null;
    city?: string | null;
  } | null;
  company?: { name?: string | null; ruc?: string | null; address?: string | null } | null;
  /**
   * Bulto de este sticker (1..N; sin dato = 1). Se imprime solo "BULTO n", sin
   * el total, porque el total cambia si luego se agregan bultos.
   */
  packageNo?: number | null;
  packages?: number | null;
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

/** Tamaño de letra (pt) para que un texto en negrita quepa en `widthMm`. */
const fitFontPt = (text: string, widthMm: number, maxPt: number, minPt: number): number => {
  // Ancho medio de un carácter en negrita ≈ 0.62 em; 1 pt = 0.3528 mm.
  const fit = widthMm / (Math.max(1, text.length) * 0.62 * 0.3528);
  return Math.max(minPt, Math.min(maxPt, Math.floor(fit * 2) / 2));
};

/** "986715089" → "986 715 089". */
const formatPhone = (phone: string | null | undefined): string => {
  const p = clean(phone).replace(/\D/g, '');
  if (!p) return '';
  return p.length === 9 ? `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}` : p;
};

/** Fecha/hora de Lima (UTC-5, sin horario de verano): "DD/MM/YYYY" y "HH:mm". */
const limaDateParts = (iso: string | null | undefined): { date: string; time: string } => {
  const base = iso ? new Date(iso) : new Date();
  const t = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
  const d = new Date(t - 5 * 3600 * 1000);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
    time: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`,
  };
};

/**
 * QR con módulos de un número entero de dots (nítido a 203 dpi): se elige el
 * módulo más grande que entra en el recuadro. Si falla, SVG estándar escalado.
 */
const buildQrSvg = async (text: string): Promise<{ svg: string; sizeMm: number }> => {
  try {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const n = modules.size;
    const dotsPerModule = Math.max(1, Math.floor(QR_BOX_MM / n / DOT_MM));
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
    return { svg, sizeMm: QR_BOX_MM - 2 };
  } catch (err) {
    logger.error('No se pudo generar el QR del sticker de pedido', err);
    return { svg: '', sizeMm: QR_BOX_MM - 2 };
  }
};

/** Líneas del destino según el tipo de despacho (con respaldo a `destination`). */
const destinationHtml = (data: OrderStickerData): string => {
  const d = data.destinationDetail ?? {};
  const line = (cls: string, text: string) =>
    text ? `<div class="${cls}">${escapeHtml(text)}</div>` : '';
  const place = clean(d.place);
  const address = clean(d.address);
  const reference = clean(d.reference);
  const agency = clean(d.agency);
  const city = clean(d.city);
  const fallback = clean(data.destination);

  if (data.route === 'PICKUP') {
    if (!place && !address) return line('addr', truncate(fallback, 120));
    return line('place', truncate(place, 50)) + line('addr', truncate(address, 120));
  }
  if (data.route === 'DELIVERY_LIMA') {
    if (!address && !reference) return line('addr', truncate(fallback, 120));
    return (
      line('addr', truncate(address, 120)) +
      (reference ? line('ref', truncate(`Ref.: ${reference}`, 80)) : '')
    );
  }
  if (data.route === 'AGENCY') {
    if (!agency && !city) return line('addr', truncate(fallback, 120));
    return line('place', truncate(agency, 50)) + line('addr', truncate(city, 80));
  }
  // Ruta desconocida: lo que haya.
  return (
    line('place', truncate(place || agency, 50)) +
    line('addr', truncate(address || city || fallback, 120))
  );
};

const buildSticker = async (data: OrderStickerData): Promise<string> => {
  const orderNo = `#${clean(data.orderNo).replace(/^#/, '')}`;
  const { svg: qrSvg, sizeMm: qrMm } = await buildQrSvg(data.qr);
  const qrLeft = QR_BOX_LEFT_MM + (QR_BOX_MM - qrMm) / 2;
  const units =
    typeof data.units === 'number' && Number.isFinite(data.units)
      ? data.units
      : (data.items ?? []).reduce((acc, it) => acc + (Number(it?.qty) || 0), 0);
  const company = data.company ?? {};
  const companyName = clean(company.name);
  const ruc = clean(company.ruc);
  const companyAddress = clean(company.address);
  const shipLabel = clean(data.routeLabel).toUpperCase() || '—';
  const name = clean(data.customerFullName) || clean(data.customer) || '—';
  const phone = formatPhone(data.customerPhone);
  const when = limaDateParts(data.printedAt);
  const bulto = `BULTO ${Math.max(1, Math.floor(Number(data.packageNo) || 1))}`;

  return `<div class="label">
    <div class="a brand" style="font-size:${fitFontPt(
      companyName,
      BRAND_W_MM,
      18,
      10
    )}pt">${escapeHtml(truncate(companyName, 40))}</div>
    <div class="a co">${ruc ? `<div class="co-l">RUC ${escapeHtml(ruc)}</div>` : ''}${
      companyAddress ? `<div class="co-l">${escapeHtml(truncate(companyAddress, 90))}</div>` : ''
    }</div>
    <div class="a ship"><div class="ship-t">TIPO DE ENVÍO</div><div class="ship-v" style="font-size:${fitFontPt(
      shipLabel,
      SHIP_W_MM - 3,
      9,
      5.5
    )}pt">${escapeHtml(truncate(shipLabel, 30))}</div></div>
    <div class="a hr"></div>
    <div class="a qr" style="left:${mm(qrLeft)};width:${mm(qrMm)};height:${mm(qrMm)}">${qrSvg}</div>
    <div class="a code" style="font-size:${fitFontPt(orderNo, LEFT_COL_W_MM - 1, 15, 9)}pt">${escapeHtml(orderNo)}</div>
    <div class="a date"><div>Inicio: ${escapeHtml(when.date)}</div><div>${escapeHtml(when.time)}</div></div>
    ${
      bulto
        ? `<div class="a bulto" style="font-size:${fitFontPt(bulto, LEFT_COL_W_MM - 2, 13, 8)}pt">${escapeHtml(bulto)}</div>`
        : ''
    }
    <div class="a vr"></div>
    <div class="a dest">
      <div class="lbl">DESTINATARIO</div>
      <div class="name">${escapeHtml(truncate(name, 70))}</div>
      ${phone ? `<div class="cel">Cel. ${escapeHtml(phone)}</div>` : ''}
      ${destinationHtml(data)}
    </div>
    <div class="a qty"><div class="qty-t">CANTIDAD DE ARTÍCULOS</div><div class="qty-n">${escapeHtml(
      String(units)
    )}</div></div>
  </div>`.trim();
};

/** Documento HTML completo: una etiqueta por página. */
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
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #000; }
  .label {
    position: relative;
    width: ${PAGE_WIDTH_MM}mm;
    height: ${PAGE_HEIGHT_MM}mm;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .a { position: absolute; overflow: hidden; }
  .nw { white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
  /* Cabecera: empresa */
  .brand {
    left: 3mm; top: 1.8mm; width: ${mm(BRAND_W_MM)}; height: 6.6mm;
    line-height: 6.6mm; font-weight: 900; letter-spacing: 0.2mm;
    white-space: nowrap; text-overflow: ellipsis;
  }
  .co {
    left: 3mm; top: 8.4mm; width: ${mm(BRAND_W_MM)}; height: 6.6mm;
    font-size: 6.5pt; font-weight: 700;
  }
  .co-l { height: 3.3mm; line-height: 3.3mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Tipo de envío */
  .ship {
    right: 3mm; top: 2.5mm; width: ${SHIP_W_MM}mm; height: 11mm;
    border: 0.6mm solid #000; border-radius: 1.2mm; text-align: center;
  }
  .ship-t { margin-top: 0.9mm; height: 2.6mm; line-height: 2.6mm; font-size: 5.5pt; font-weight: 700; }
  .ship-v {
    height: 5mm; line-height: 5mm; padding: 0 1mm; font-weight: 900;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .hr { left: 3mm; right: 3mm; top: 15.5mm; height: 0; border-top: 0.5mm solid #000; overflow: visible; }
  /* Columna izquierda */
  .qr { top: ${QR_TOP_MM}mm; line-height: 0; }
  .qr svg { display: block; width: 100%; height: 100%; }
  .code {
    left: ${LEFT_COL_X_MM}mm; top: ${QR_TOP_MM + QR_BOX_MM + 1.5}mm; width: ${LEFT_COL_W_MM}mm; height: 6.5mm;
    line-height: 6.5mm; text-align: center; font-weight: 900; letter-spacing: -0.2mm;
    white-space: nowrap;
  }
  .date {
    left: ${LEFT_COL_X_MM}mm; top: ${QR_TOP_MM + QR_BOX_MM + 8.5}mm; width: ${LEFT_COL_W_MM}mm; height: 6.8mm;
    text-align: center; font-size: 7pt; font-weight: 700;
  }
  .date > div { height: 3.4mm; line-height: 3.4mm; white-space: nowrap; overflow: hidden; }
  .bulto {
    left: ${LEFT_COL_X_MM + 1}mm; top: ${QR_TOP_MM + QR_BOX_MM + 16}mm; width: ${LEFT_COL_W_MM - 2}mm; height: 8mm;
    line-height: 7mm; text-align: center; font-weight: 900; white-space: nowrap;
    border: 0.6mm solid #000; border-radius: 1.2mm;
  }
  .vr { left: 33.5mm; top: 18mm; width: 0; height: 54mm; border-left: 0.4mm solid #000; overflow: visible; }
  /* Destinatario */
  .dest { left: 36mm; top: 17.5mm; right: 3mm; height: 39.5mm; }
  .dest > div { overflow: hidden; }
  .lbl { height: 3mm; line-height: 3mm; font-size: 6pt; font-weight: 700; letter-spacing: 0.2mm; }
  .name {
    margin-top: 0.5mm; max-height: 9mm; line-height: 4.5mm; font-size: 12pt; font-weight: 900;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .cel {
    margin-top: 1mm; height: 5mm; line-height: 5mm; font-size: 11pt; font-weight: 900;
    white-space: nowrap; text-overflow: ellipsis;
  }
  .place {
    margin-top: 1.6mm; height: 4.4mm; line-height: 4.4mm; font-size: 9.5pt; font-weight: 900;
    white-space: nowrap; text-overflow: ellipsis;
  }
  .addr {
    margin-top: 0.4mm; max-height: 6.4mm; line-height: 3.2mm; font-size: 7.5pt; font-weight: 700;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .ref {
    margin-top: 0.4mm; height: 3.2mm; line-height: 3.2mm; font-size: 7.5pt; font-weight: 700;
    white-space: nowrap; text-overflow: ellipsis;
  }
  /* Cantidad de artículos */
  .qty {
    left: 36mm; right: 3mm; bottom: 3mm; height: 14mm;
    border: 0.6mm solid #000; border-radius: 1.2mm;
  }
  .qty-t {
    position: absolute; left: 3mm; top: 4.6mm; height: 3.4mm; line-height: 3.4mm;
    font-size: 7pt; font-weight: 700; white-space: nowrap;
  }
  .qty-n {
    position: absolute; right: 3mm; top: 0; height: 12.8mm; line-height: 12.8mm;
    font-size: 30pt; font-weight: 900; white-space: nowrap;
  }
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
