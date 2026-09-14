import type { ConceptCode, ConceptType, PensionSystem, PeriodStatus } from './common';

export interface SlipSummary {
  id: string;
  user_id: string;
  period_id: string;
  total_ingresos: string;
  total_descuentos: string;
  total_aportes: string;
  neto: string;
  status: PeriodStatus;
  full_name?: string | null;
}

export interface SlipDetailRow {
  concept_code: ConceptCode | string;
  concept_type: ConceptType;
  quantity: number | null;
  amount: string;
  display_order: number;
}

export interface SlipEmployeeSnapshot {
  full_name: string;
  position_name?: string | null;
  cost_center?: string | null;
  pension_system: PensionSystem;
  afp_code?: string | null;
  [key: string]: unknown;
}

export interface Slip {
  id: string;
  user_id: string;
  period_id: string;
  rem_computable: string;
  total_ingresos: string;
  total_descuentos: string;
  total_aportes: string;
  neto: string;
  status: PeriodStatus;
  employee_snapshot: SlipEmployeeSnapshot;
  details: SlipDetailRow[];
}
