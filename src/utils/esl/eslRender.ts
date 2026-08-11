/**
 * Renderiza el ticket Leeka 1.54_BWRY en un canvas y empaqueta el bitmap
 * en el formato nativo del panel (2 bits per pixel, MSB-first, row-major,
 * rotado 90° CW antes de empaquetar).
 *
 * Solo funciona en Platform.OS === 'web' (Electron / dev web). En nativo
 * se debe portear usando Skia/expo-gl + react-native-ble-plx.
 */

import { drawCode128 as drawCode128Bars } from './code128';
import { cleanProductTitle } from './cleanProductTitle';
import {
  EslTicketData,
  LEEKA_154_FRAME_BYTES,
  LEEKA_154_HEIGHT,
  LEEKA_154_WIDTH,
} from '@/types/esl';

/** Paleta del panel BWRY (4 colores reales que muestra el e-paper). */
const COLORS = {
  K: '#000000', // Negro
  W: '#ffffff', // Blanco
  Y: '#d9b300', // Amarillo (oscuro hacia verde-mostaza como el panel real)
  R: '#c40000', // Rojo
} as const;

type Color = keyof typeof COLORS; // 'K' | 'W' | 'Y' | 'R'

/** RGB de cada color para cuantizar. */
const PALETTE: Array<{ color: Color; rgb: [number, number, number] }> = [
  { color: 'K', rgb: [0, 0, 0] },
  { color: 'W', rgb: [255, 255, 255] },
  { color: 'Y', rgb: [220, 180, 0] },
  { color: 'R', rgb: [200, 0, 0] },
];

/** Mapeo color -> valor 2bpp del firmware. */
const COLOR_TO_2BPP: Record<Color, number> = {
  K: 0b00,
  W: 0b01,
  Y: 0b10,
  R: 0b11,
};

/** Encuentra el color más cercano (euclidiana en RGB). */
function nearestColor(r: number, g: number, b: number): Color {
  let best: Color = 'W';
  let bestDist = Infinity;
  for (const { color, rgb } of PALETTE) {
    const dr = r - rgb[0];
    const dg = g - rgb[1];
    const db = b - rgb[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      best = color;
    }
  }
  return best;
}

/**
 * Calcula un precio "original" tachado con variación aleatoria razonable
 * en el rango +18%..+36% sobre el precio actual.
 */
export function randomOriginalPrice(price: number): number {
  const factor = 1.18 + Math.random() * 0.18;
  const raw = price * factor;
  // Redondeo "psicológico" a .90/.50 para verse natural.
  const cents = Math.round(raw * 100) / 100;
  const floored = Math.floor(cents);
  const choice = Math.random() < 0.6 ? 0.9 : 0.5;
  return floored + choice;
}

interface RenderOptions {
  /**
   * Canvas opcional para dibujar. Si no se pasa, se crea uno offscreen.
   * Útil para mostrar preview en la UI.
   */
  canvas?: HTMLCanvasElement;
}

/**
 * Dibuja el ticket en un canvas 200x200 (resolución nativa del panel).
 * Devuelve el canvas + el porcentaje de descuento calculado para mostrar
 * arriba en la pantalla.
 */
export function drawTicket(
  data: EslTicketData,
  opts: RenderOptions = {}
): { canvas: HTMLCanvasElement; discount: number; originalPrice: number } {
  const W = LEEKA_154_WIDTH;
  const H = LEEKA_154_HEIGHT;

  const canvas = opts.canvas ?? document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener contexto 2D del canvas');

  // Fondo blanco.
  ctx.fillStyle = COLORS.W;
  ctx.fillRect(0, 0, W, H);

  // Datos derivados.
  const cleanTitle = cleanProductTitle(data.title) || data.title || '—';
  const originalPrice =
    data.originalPrice != null && data.originalPrice > data.price
      ? data.originalPrice
      : randomOriginalPrice(data.price);
  const discount = Math.max(0, Math.round((1 - data.price / originalPrice) * 100));
  const bannerText = data.bannerText ?? `OFERTA -${discount}%`;

  // ---- Banner rojo superior (alto 26 px, texto 14 bold) ----
  const bannerH = 26;
  ctx.fillStyle = COLORS.R;
  ctx.fillRect(0, 0, W, bannerH);
  ctx.fillStyle = COLORS.W;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bannerText.toUpperCase(), W / 2, bannerH / 2);

  // ---- Nombre del producto (22 bold, autoshrink a 18, 2 líneas max) ----
  const titleTop = bannerH + 6;
  const titleH = 50;
  ctx.fillStyle = COLORS.K;
  drawAutoWrappedTitle(ctx, cleanTitle, 4, titleTop, W - 8, titleH, 22, 18);

  // ---- SKU debajo (12 regular) ----
  let sectionY = titleTop + titleH;
  if (data.sku) {
    ctx.fillStyle = COLORS.K;
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(`SKU: ${data.sku.toUpperCase()}`, W / 2, sectionY + 8);
    sectionY += 18;
  }

  // ---- Precio original con fondo amarillo + tachado rojo (14 bold) ----
  const origY = sectionY + 12;
  const origText = `S/ ${originalPrice.toFixed(2)}`;
  ctx.font = 'bold 14px sans-serif';
  const origWidth = ctx.measureText(origText).width + 12;
  const origX = (W - origWidth) / 2;
  ctx.fillStyle = COLORS.Y;
  ctx.fillRect(origX, origY - 10, origWidth, 20);
  ctx.fillStyle = COLORS.K;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(origText, W / 2, origY);
  ctx.strokeStyle = COLORS.R;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(origX + 4, origY);
  ctx.lineTo(origX + origWidth - 4, origY);
  ctx.stroke();

  // ---- Precio destacado (42 bold rojo + S/ 18 bold) ----
  const priceY = origY + 30;
  ctx.fillStyle = COLORS.R;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const priceText = data.price.toFixed(2);
  ctx.font = 'bold 18px sans-serif';
  const currencyW = ctx.measureText('S/').width;
  ctx.font = 'bold 42px sans-serif';
  const priceW = ctx.measureText(priceText).width;
  const totalW = currencyW + 6 + priceW;
  const startX = (W - totalW) / 2;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('S/', startX, priceY);
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText(priceText, startX + currencyW + 6, priceY);

  // ---- Zona reservada del barcode (siempre legible) ----
  // El barcode NO se puede perder porque es el "DNI" físico de la etiqueta.
  const barcodeAreaTop = H - 30;
  const barcodeAreaH = 26;
  // Fondo blanco garantizado para máximo contraste.
  ctx.fillStyle = COLORS.W;
  ctx.fillRect(0, barcodeAreaTop, W, barcodeAreaH);

  drawCode128(ctx, data.tagCode, 0, barcodeAreaTop, W, barcodeAreaH);

  return { canvas, discount, originalPrice };
}

/**
 * Dibuja un texto con wrap automático y autoshrink hasta minFontSize.
 */
function drawAutoWrappedTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  startFontSize: number,
  minFontSize: number
) {
  let fontSize = startFontSize;
  let lines: string[] = [];
  while (fontSize >= minFontSize) {
    ctx.font = `bold ${fontSize}px sans-serif`;
    lines = wrapText(ctx, text, maxWidth, 2);
    const lineH = fontSize + 2;
    if (lines.length * lineH <= maxHeight) break;
    fontSize -= 1;
  }
  const lineH = fontSize + 2;
  const totalH = lines.length * lineH;
  let cy = y + (maxHeight - totalH) / 2 + lineH / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const ln of lines) {
    ctx.fillText(ln, x + maxWidth / 2, cy);
    cy += lineH;
  }
}

/** Word-wrap simple; trunca a `maxLines` con elipsis. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;
  // Elipsis si quedó cortado.
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxWidth && last.length > 0) {
      last = last.slice(0, -1);
    }
    const fullText = lines.join(' ');
    if (fullText.length < text.length) lines[maxLines - 1] = last + '…';
  }
  return lines;
}

/** Dibuja un Code128 usando el codificador propio. Sin texto debajo. */
function drawCode128(
  ctx: CanvasRenderingContext2D,
  code: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  try {
    drawCode128Bars(ctx, code, x, y, width, height, 6);
  } catch {
    // Fallback: dibujar texto.
    ctx.fillStyle = COLORS.K;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code, x + width / 2, y + height / 2);
  }
}

/**
 * Cuantiza un ImageData a la paleta BWRY y empaqueta el bitmap nativo del
 * panel: 200x200 a 2bpp, MSB-first, row-major, rotado 90° CW.
 *
 * Convención confirmada empíricamente:
 *   - 00 = Negro
 *   - 01 = Blanco
 *   - 10 = Amarillo
 *   - 11 = Rojo
 *   - El panel está montado portrait; el firmware lo direcciona "landscape",
 *     por lo que la rasterización lógica (lo que ve el usuario en preview)
 *     se debe rotar 90° CW antes de empaquetar.
 */
/**
 * Render → bitmap nativo, en una sola llamada. Es la API unificada que
 * usan tanto la versión Web (esta) como la Native (que delega a un WebView
 * oculto, definida en `eslRender.native.ts`).
 */
export async function renderTicketBitmap(data: EslTicketData): Promise<Uint8Array> {
  const { canvas } = drawTicket(data);
  return canvasToLeekaBitmap(canvas);
}

export function canvasToLeekaBitmap(canvas: HTMLCanvasElement): Uint8Array {
  const W = LEEKA_154_WIDTH;
  const H = LEEKA_154_HEIGHT;
  if (canvas.width !== W || canvas.height !== H) {
    throw new Error(`Canvas debe ser ${W}x${H}, recibí ${canvas.width}x${canvas.height}`);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener contexto 2D del canvas');
  const img = ctx.getImageData(0, 0, W, H);
  const px = img.data;

  const out = new Uint8Array(LEEKA_154_FRAME_BYTES);

  // Recorrido en el orden del firmware (sobre la imagen rotada 90° CW):
  //   display_x = y_logico
  //   display_y = (W - 1) - x_logico
  // => para cada (yDisp, xDisp) del frame, leemos (xLog, yLog) = (W-1-yDisp, xDisp).
  let bitIdx = 0;
  for (let yDisp = 0; yDisp < H; yDisp++) {
    for (let xDisp = 0; xDisp < W; xDisp++) {
      const xLog = W - 1 - yDisp;
      const yLog = xDisp;
      const srcIdx = (yLog * W + xLog) * 4;
      const r = px[srcIdx];
      const g = px[srcIdx + 1];
      const b = px[srcIdx + 2];
      const color = nearestColor(r, g, b);
      const val = COLOR_TO_2BPP[color] & 0b11;

      // MSB-first: pixel 0 ocupa bits 7..6, pixel 1 bits 5..4, etc.
      const byteIdx = bitIdx >> 2; // 4 pixeles por byte
      const pixelInByte = bitIdx & 0b11;
      const shift = 6 - pixelInByte * 2;
      out[byteIdx] |= val << shift;
      bitIdx++;
    }
  }
  return out;
}
