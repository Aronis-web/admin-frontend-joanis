/**
 * Generador mínimo de Code128 (subset B/C automático para dígitos puros).
 * Devuelve un array de anchos de barras alternantes (negro, blanco, negro, ...).
 *
 * Suficiente para los códigos numéricos de las etiquetas Leeka (8 dígitos:
 * "16637999"). Soporta Code128C automático cuando todo es dígitos en par,
 * caso contrario cae a Code128B.
 */

// Tabla de patrones (107 símbolos, cada uno 11 módulos).
// Cada string son los 6 anchos (3 barras + 3 espacios) en módulos.
// Datos de la especificación Code128.
const PATTERNS: string[] = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  // 106 = STOP (7 elementos)
  '2331112',
];

const START_B = 104;
const START_C = 105;
const STOP = 106;

interface EncodeResult {
  /** Anchos de módulos: primer elemento siempre es BARRA (negro). */
  bars: number[];
  /** Suma total de módulos. */
  total: number;
}

/** Codifica `text` a Code128 (auto B/C). */
export function encodeCode128(text: string): EncodeResult {
  const allDigits = /^\d+$/.test(text);
  const useC = allDigits && text.length >= 4 && text.length % 2 === 0;

  const codes: number[] = [];
  if (useC) {
    codes.push(START_C);
    for (let i = 0; i < text.length; i += 2) {
      codes.push(parseInt(text.substr(i, 2), 10));
    }
  } else {
    codes.push(START_B);
    for (const ch of text) {
      const c = ch.charCodeAt(0);
      if (c < 32 || c > 126) {
        throw new Error(`Code128B no soporta el carácter "${ch}"`);
      }
      codes.push(c - 32);
    }
  }

  // Checksum: (start + sum(code_i * (i+1))) % 103
  let sum = codes[0];
  for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
  const checksum = sum % 103;
  codes.push(checksum);
  codes.push(STOP);

  const bars: number[] = [];
  let total = 0;
  for (const code of codes) {
    const pattern = PATTERNS[code];
    if (!pattern) throw new Error(`Patrón Code128 no encontrado para code=${code}`);
    for (const ch of pattern) {
      const w = parseInt(ch, 10);
      bars.push(w);
      total += w;
    }
  }
  // El estándar agrega una barra final (módulo extra) sólo si el STOP tiene
  // 7 elementos (sí los tiene en el patrón "2331112").
  return { bars, total };
}

/**
 * Dibuja el Code128 en el canvas. El primer elemento es BARRA.
 * `quietZone` en módulos a cada lado.
 */
export function drawCode128(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  quietZone = 10
) {
  const { bars, total } = encodeCode128(text);
  const totalModules = total + quietZone * 2;
  const moduleWidth = width / totalModules;
  let cx = x + quietZone * moduleWidth;
  let isBar = true;
  ctx.fillStyle = '#000000';
  for (const w of bars) {
    const px = w * moduleWidth;
    if (isBar) {
      ctx.fillRect(Math.round(cx), y, Math.ceil(px), height);
    }
    cx += px;
    isBar = !isBar;
  }
}
