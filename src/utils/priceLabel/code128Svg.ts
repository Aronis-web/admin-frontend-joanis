/**
 * Genera un código de barras Code128 como string SVG, reutilizando el encoder
 * ya existente en `src/utils/esl/code128.ts`.
 *
 * IMPORTANTE — legibilidad en impresoras térmicas (Godex 203dpi):
 *
 * Para que los lectores acepten el código, el ancho de cada módulo tiene que
 * ser un múltiplo entero de dots de la impresora (idealmente 2 dots = 0.25mm
 * a 203dpi). Si el navegador rasteriza a un ancho fraccionario por módulo,
 * unas barras salen de 1 dot y otras de 2 → el scanner rechaza el código.
 *
 * Por eso este helper acepta `moduleWidthMm`: cuando se indica, el SVG se
 * genera con tamaño intrínseco en mm (`totalModules × moduleWidthMm`) en lugar
 * de estirarse al 100% del contenedor, y así cada módulo se imprime siempre al
 * mismo número exacto de dots.
 */

import { encodeCode128, estimateCode128Modules } from '@/utils/esl/code128';
import { logger } from '@/utils/logger';

export interface Code128SvgOptions {
  /** Alto del código en unidades de módulo (relativo). Default 60. */
  height?: number;
  /** Zona de silencio a cada lado en módulos. Default 10. */
  quietZone?: number;
  /**
   * Ancho de cada módulo en mm. Si se indica, el SVG se genera con tamaño
   * intrínseco (`width="{totalModules × moduleWidthMm}mm"`) en vez de 100%.
   * Recomendado: 0.25 (2 dots a 203dpi) para asegurar lectura en scanners.
   */
  moduleWidthMm?: number;
  /**
   * Alto del SVG en mm (sólo se usa cuando `moduleWidthMm` está definido).
   * Default 6mm.
   */
  heightMm?: number;
}

export interface Code128SvgResult {
  /** Markup `<svg>` listo para embed en HTML. */
  svg: string;
  /** Ancho intrínseco en mm si se usó `moduleWidthMm`, null si es "100%". */
  widthMm: number | null;
  /** Total de módulos (incluyendo zonas de silencio). Útil para calcular ancho. */
  totalModules: number;
}

/**
 * Estima cuántos módulos ocuparía un Code128 sin encodearlo. Útil para saber
 * si el barcode "va a entrar" en un ancho dado antes de generarlo.
 */
export function code128WidthMm(text: string, moduleWidthMm: number, quietZone = 8): number | null {
  const clean = (text ?? '').trim();
  if (!clean) return null;
  try {
    const totalModules = estimateCode128Modules(clean) + quietZone * 2;
    return totalModules * moduleWidthMm;
  } catch {
    return null;
  }
}

/**
 * Devuelve un `<svg>` con el Code128 de `text`, o `null` si el texto no es
 * codificable.
 *
 * Wrapper legacy (retro-compatible): devuelve directamente el string SVG.
 */
export function code128Svg(text: string, options: Code128SvgOptions = {}): string | null {
  return code128SvgDetailed(text, options)?.svg ?? null;
}

/** Versión que además devuelve el ancho intrínseco calculado. */
export function code128SvgDetailed(
  text: string,
  options: Code128SvgOptions = {}
): Code128SvgResult | null {
  const clean = (text ?? '').trim();
  if (!clean) return null;

  const heightUnits = options.height ?? 60;
  const quietZone = options.quietZone ?? 10;
  const moduleWidthMm = options.moduleWidthMm;
  const heightMm = options.heightMm ?? 6;

  try {
    const { bars, total } = encodeCode128(clean);
    const totalModules = total + quietZone * 2;

    let x = quietZone;
    let isBar = true;
    const rects: string[] = [];
    for (const w of bars) {
      if (isBar) {
        rects.push(`<rect x="${x}" y="0" width="${w}" height="${heightUnits}"/>`);
      }
      x += w;
      isBar = !isBar;
    }

    if (moduleWidthMm && moduleWidthMm > 0) {
      // Tamaño intrínseco en mm: cada módulo ocupa exactamente `moduleWidthMm`
      // milímetros. Con `preserveAspectRatio="none"` + `crispEdges` la
      // impresora rasteriza cada módulo al mismo número entero de dots
      // (garantizado si `moduleWidthMm` es múltiplo del paso de dot).
      const widthMm = totalModules * moduleWidthMm;
      return {
        widthMm,
        totalModules,
        svg:
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${heightUnits}" ` +
          `width="${widthMm}mm" height="${heightMm}mm" preserveAspectRatio="none" ` +
          `shape-rendering="crispEdges" fill="#000000">${rects.join('')}</svg>`,
      };
    }

    // Modo legacy: estirar al 100% del contenedor. Se conserva para
    // `priceLabelPrint` (etiqueta grande 80mm donde el módulo es holgado).
    return {
      widthMm: null,
      totalModules,
      svg:
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${heightUnits}" ` +
        `width="100%" height="100%" preserveAspectRatio="none" ` +
        `shape-rendering="crispEdges" fill="#000000">${rects.join('')}</svg>`,
    };
  } catch (err) {
    logger.warn('No se pudo generar Code128 para etiqueta', { text: clean, err });
    return null;
  }
}
