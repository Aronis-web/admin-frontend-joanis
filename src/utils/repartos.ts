/**
 * Utilidades para el módulo de Repartos
 * Incluye funciones para distinguir validaciones con y sin presentaciones
 */

import { ValidacionSalida, RepartoProducto } from '@/types/repartos';

/**
 * Determina si una validación fue realizada por presentación o por unidad
 *
 * @param validacion - La validación a verificar
 * @returns true si fue validada por presentación, false si fue por unidad
 *
 * @example
 * ```typescript
 * const validacion = await repartosService.getValidacion(productoId);
 * if (wasValidatedByPresentation(validacion)) {
 *   console.log('Validación por presentación');
 * } else {
 *   console.log('Validación por unidad');
 * }
 * ```
 */
export function wasValidatedByPresentation(
  validacion: ValidacionSalida | null | undefined
): boolean {
  if (!validacion) {
    return false;
  }

  // Método 1: Verificar el campo changes.presentations
  if (validacion.changes?.presentations && validacion.changes.presentations.length > 0) {
    return true;
  }

  // Método 2: Verificar campos de cantidad de presentación
  if (validacion.validatedPresentationQuantity && validacion.validatedPresentationQuantity > 0) {
    return true;
  }

  // Método 3: Verificar si tiene presentationId
  if (validacion.presentationId) {
    return true;
  }

  return false;
}

/**
 * Obtiene el tipo de validación como string legible
 *
 * @param validacion - La validación a verificar
 * @returns 'Por Presentación' o 'Por Unidad'
 */
export function getValidationType(validacion: ValidacionSalida | null | undefined): string {
  return wasValidatedByPresentation(validacion) ? 'Por Presentación' : 'Por Unidad';
}

/**
 * Obtiene información detallada sobre cómo se validó un producto
 *
 * @param validacion - La validación a analizar
 * @returns Objeto con información detallada de la validación
 */
export function getValidationDetails(validacion: ValidacionSalida | null | undefined): {
  type: 'presentation' | 'unit';
  typeLabel: string;
  hasFullPresentations: boolean;
  hasLooseUnits: boolean;
  fullPresentations: number;
  looseUnits: number;
  totalUnits: number;
  presentations: Array<{
    presentationId: string;
    factorToBase: number;
    notes?: string;
  }>;
} {
  const defaultResult = {
    type: 'unit' as const,
    typeLabel: 'Por Unidad',
    hasFullPresentations: false,
    hasLooseUnits: false,
    fullPresentations: 0,
    looseUnits: 0,
    totalUnits: validacion?.validatedQuantity || 0,
    presentations: [],
  };

  if (!validacion) {
    return defaultResult;
  }

  const byPresentation = wasValidatedByPresentation(validacion);

  if (!byPresentation) {
    return defaultResult;
  }

  // Validación por presentación
  const fullPresentations = validacion.validatedPresentationQuantity || 0;
  const looseUnits = validacion.validatedLooseUnits || 0;
  const presentations = validacion.changes?.presentations || [];

  return {
    type: 'presentation',
    typeLabel: 'Por Presentación',
    hasFullPresentations: fullPresentations > 0,
    hasLooseUnits: looseUnits > 0,
    fullPresentations,
    looseUnits,
    totalUnits: validacion.validatedQuantity,
    presentations,
  };
}

/**
 * Formatea la información de validación para mostrar en UI
 *
 * @param validacion - La validación a formatear
 * @param producto - El producto relacionado (opcional, para obtener nombres de presentaciones)
 * @returns String formateado para mostrar
 *
 * @example
 * ```typescript
 * const text = formatValidationInfo(validacion, producto);
 * // Resultado: "10 cajas + 5 unidades (245 unidades totales)"
 * // o: "50 unidades"
 * ```
 */
export function formatValidationInfo(
  validacion: ValidacionSalida | null | undefined,
  producto?: RepartoProducto
): string {
  if (!validacion) {
    return 'No validado';
  }

  const details = getValidationDetails(validacion);

  if (details.type === 'unit') {
    return `${details.totalUnits} unidades`;
  }

  // Validación por presentación
  const parts: string[] = [];

  if (details.hasFullPresentations) {
    // Intentar obtener el nombre de la presentación
    let presentationName = 'presentaciones';
    if (details.presentations.length > 0 && producto?.product?.presentations) {
      const presentationId = details.presentations[0].presentationId;
      const presentation = producto.product.presentations.find(
        (p) => p.presentationId === presentationId
      );
      if (presentation) {
        presentationName = presentation.presentation.name.toLowerCase();
      }
    }
    parts.push(`${details.fullPresentations} ${presentationName}`);
  }

  if (details.hasLooseUnits) {
    parts.push(`${details.looseUnits} unidades`);
  }

  const summary = parts.join(' + ');
  return `${summary} (${details.totalUnits} unidades totales)`;
}

/**
 * Verifica si un producto fue distribuido por presentación
 * (útil para determinar el modo inicial del modal de validación)
 *
 * @param producto - El producto a verificar
 * @returns true si fue distribuido por presentación
 */
export function wasDistributedByPresentation(
  producto: RepartoProducto | null | undefined
): boolean {
  if (!producto) {
    return false;
  }

  // Verificar si tiene presentationId y factorToBase
  if (producto.presentationId && producto.factorToBase) {
    return true;
  }

  return false;
}

/**
 * Obtiene un resumen de las validaciones de un reparto
 *
 * @param productos - Lista de productos del reparto
 * @returns Estadísticas de validación
 */
export function getValidationSummary(productos: RepartoProducto[]): {
  total: number;
  validatedByPresentation: number;
  validatedByUnit: number;
  pending: number;
  percentageByPresentation: number;
  percentageByUnit: number;
} {
  const total = productos.length;
  let validatedByPresentation = 0;
  let validatedByUnit = 0;
  let pending = 0;

  productos.forEach((producto) => {
    if (!producto.validacion) {
      pending++;
    } else if (wasValidatedByPresentation(producto.validacion)) {
      validatedByPresentation++;
    } else {
      validatedByUnit++;
    }
  });

  const validated = validatedByPresentation + validatedByUnit;

  return {
    total,
    validatedByPresentation,
    validatedByUnit,
    pending,
    percentageByPresentation: validated > 0 ? (validatedByPresentation / validated) * 100 : 0,
    percentageByUnit: validated > 0 ? (validatedByUnit / validated) * 100 : 0,
  };
}
