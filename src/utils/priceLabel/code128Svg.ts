/**
 * Genera un código de barras Code128 como string SVG, reutilizando el encoder
 * ya existente en `src/utils/esl/code128.ts`.
 *
 * El SVG se dibuja en "coordenadas de módulo" (viewBox = totalModules × height)
 * y se estira al 100% del ancho del contenedor mediante `preserveAspectRatio`,
 * lo que garantiza barras nítidas en impresoras térmicas.
 */

import { encodeCode128 } from '@/utils/esl/code128';
import { logger } from '@/utils/logger';

export interface Code128SvgOptions {
  /** Alto del código en unidades de módulo (relativo). Default 60. */
  height?: number;
  /** Zona de silencio a cada lado en módulos. Default 10. */
  quietZone?: number;
}

/**
 * Devuelve un `<svg>` con el Code128 de `text`, o `null` si el texto no es
 * codificable (p.ej. caracteres fuera de Code128B).
 */
export function code128Svg(text: string, options: Code128SvgOptions = {}): string | null {
  const clean = (text ?? '').trim();
  if (!clean) return null;

  const height = options.height ?? 60;
  const quietZone = options.quietZone ?? 10;

  try {
    const { bars, total } = encodeCode128(clean);
    const totalModules = total + quietZone * 2;

    let x = quietZone;
    let isBar = true;
    const rects: string[] = [];
    for (const w of bars) {
      if (isBar) {
        rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}"/>`);
      }
      x += w;
      isBar = !isBar;
    }

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${height}" ` +
      `width="100%" height="100%" preserveAspectRatio="none" ` +
      `shape-rendering="crispEdges" fill="#000000">${rects.join('')}</svg>`
    );
  } catch (err) {
    logger.warn('No se pudo generar Code128 para etiqueta', { text: clean, err });
    return null;
  }
}
