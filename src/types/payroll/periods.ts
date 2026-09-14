import type { ConceptCode, OvertimeRateCode, PayType, PeriodStatus } from './common';

export interface PayrollPeriod {
  id: string;
  year: number;
  month: number;
  fortnight?: 1 | 2 | null;
  pay_type: PayType;
  period_start: string;
  period_end: string;
  site_id?: string | null;
  status: PeriodStatus;
  created_at?: string;
  closed_at?: string | null;
}

export interface PeriodListParams {
  year?: number;
  month?: number;
  status?: PeriodStatus;
}

export interface CreatePeriodDto {
  year: number;
  month: number;
  /** Requerido si payType === 'QUINCENAL'. */
  fortnight?: 1 | 2;
  payType?: PayType;
  siteId?: string;
}

export type HHEEMap = Partial<Record<OvertimeRateCode, number>>;

export interface PeriodInput {
  user_id: string;
  d_trab_proposed: string;
  d_trab_final: string;
  d_faltos_proposed: string;
  d_faltos_final: string;
  d_desc_med_proposed: string;
  d_desc_med_final: string;
  d_vac_proposed: string;
  d_vac_final: string;
  hhee_proposed: HHEEMap;
  hhee_final: HHEEMap;
  is_overridden: boolean;
  override_reason?: string | null;
}

export interface OverrideInputDto {
  dTrab?: number;
  dFaltos?: number;
  dDescMed?: number;
  dVac?: number;
  hhee?: HHEEMap;
  overrideReason: string;
}

export interface AggregateAttendanceResponse {
  success: true;
  processed: number;
}

/** Map de conceptos manuales por usuario. */
export type ManualConcepts = Record<string, Partial<Record<ConceptCode, number>>>;

export interface CalculatePeriodDto {
  manualConcepts?: ManualConcepts;
}

export interface CalculateResponse {
  success: true;
  calculated: number;
  totals: {
    ingresos: number;
    descuentos: number;
    neto: number;
    aportes: number;
  };
}
