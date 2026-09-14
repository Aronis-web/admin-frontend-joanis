/**
 * Payroll - Enums y helpers comunes.
 *
 * Basado en la guia de svc-admin `/payroll/*`.
 * Los montos `numeric` del backend llegan como string (ej. "1500.00");
 * usar {@link parseDecimal} antes de operar aritmeticamente.
 */

// ---------------------------------------------------------------------------
// Envelope estandar del backend
// ---------------------------------------------------------------------------

export interface ApiSuccess<T = unknown> {
  success: true;
  item?: T;
  items?: T[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type PensionSystem = 'AFP' | 'ONP' | 'SIN' | 'JUBILADO';
export type AfpCode = 'HABITAT' | 'INTEGRA' | 'PRIMA' | 'PROFUTURO';
export type AfpRegime = 'flujo' | 'mixta';

export type PeriodStatus = 'BORRADOR' | 'CALCULADO' | 'CERRADO' | 'PAGADO';
export type PayType = 'QUINCENAL' | 'MENSUAL';

export type ApprovalStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'APLICADO';
export type ApprovalEntityType = 'VACACION' | 'FALTA' | 'HH_EE' | 'BENEFICIO';

export type VacationRequestType = 'GOZO' | 'COMPRA' | 'ADELANTO';

export type AbsenceType =
  | 'INJUSTIFICADA'
  | 'JUSTIFICADA'
  | 'DESCANSO_MEDICO'
  | 'LICENCIA_CON_GOCE'
  | 'LICENCIA_SIN_GOCE'
  | 'SUBSIDIO';

export type OvertimeRateCode = 'HHEE_25' | 'HHEE_35' | 'HHEE_100' | 'HHEE_200' | 'HHEE_300';

export type BenefitChangeType =
  | 'SUELDO'
  | 'MOVILIDAD'
  | 'PENSION_SYSTEM'
  | 'AFP'
  | 'ASIGNACION_FAMILIAR'
  | 'HIJOS';

/** Codigo canonico de concepto de boleta. */
export type ConceptCode =
  // Ingresos
  | 'BASICO'
  | 'ASIG_FAMILIAR'
  | 'MOVILIDAD'
  | 'HHEE_25'
  | 'HHEE_35'
  | 'HHEE_100'
  | 'HHEE_200'
  | 'HHEE_300'
  | 'VACACIONES'
  | 'COMPRA_VAC'
  | 'DESC_MEDICO'
  | 'SUBSIDIO'
  | 'LIC_CON_GOCE'
  | 'REINT_MOV'
  | 'BONO_REGULAR'
  | 'BONO_EXTRAORDINARIO'
  | 'COMISION'
  // Descuentos
  | 'SNP_ONP'
  | 'AFP_FONDO'
  | 'AFP_COMISION'
  | 'AFP_SEGURO'
  | 'RENTA_5TA'
  | 'PRESTAMO'
  | 'ADELANTO'
  | 'DCTO_VARIOS'
  | 'VAC_ADELANTADAS'
  | 'LIC_SIN_GOCE'
  // Aportes empleador
  | 'ESSALUD'
  | 'EPS'
  | 'SEGVIDALEY';

export type ConceptType = 'INGRESO' | 'DESCUENTO' | 'APORTE';

/** Parametros globales editables (config). */
export type PayrollParamKey =
  | 'RMV'
  | 'ASIG_FAMILIAR_AMOUNT'
  | 'ONP_RATE'
  | 'ESSALUD_RATE'
  | 'SEGVIDALEY_RATE'
  | 'INSURABLE_CAP'
  | 'UIT';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parsea un valor `numeric` del backend (string | number | null) a number.
 * Devuelve 0 si es nulo o no parseable.
 */
export function parseDecimal(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Suma decimales llegados como string. */
export function sumDecimals(values: Array<string | number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + parseDecimal(v), 0);
}

/** True si el periodo admite edicion/agregacion/calculo/override. */
export function isPeriodEditable(status: PeriodStatus | undefined | null): boolean {
  return status === 'BORRADOR' || status === 'CALCULADO';
}
