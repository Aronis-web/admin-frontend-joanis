import { parseDecimal } from '@/types/payroll';

/**
 * Formatea un valor numeric (string | number) como moneda PEN.
 */
export function formatPen(value: string | number | null | undefined): string {
  const n = parseDecimal(value);
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Formatea porcentaje a partir de tasa decimal (0.10 -> "10.00%"). */
export function formatRate(value: string | number | null | undefined): string {
  const n = parseDecimal(value);
  return `${(n * 100).toFixed(2)}%`;
}

/** Formatea numero decimal con 2 decimales. */
export function formatDecimal(value: string | number | null | undefined, digits = 2): string {
  const n = parseDecimal(value);
  return n.toLocaleString('es-PE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
