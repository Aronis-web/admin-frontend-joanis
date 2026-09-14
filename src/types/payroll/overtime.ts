import type { ApprovalStatus, OvertimeRateCode } from './common';

export interface OvertimeRequest {
  id: string;
  user_id: string;
  work_date: string;
  fortnight: 1 | 2;
  rate_code: OvertimeRateCode;
  hours: string;
  notes?: string | null;
  status: ApprovalStatus;
  approval_id?: string | null;
  created_at?: string;
}

export interface OvertimeListParams {
  userId?: string;
  status?: ApprovalStatus;
}

export interface CreateOvertimeDto {
  userId: string;
  workDate: string; // YYYY-MM-DD (backend deriva la quincena)
  rateCode: OvertimeRateCode;
  hours: number;
  notes?: string;
}

/** Factor multiplicador sobre el valor-hora segun el rateCode. */
export const OVERTIME_FACTORS: Record<OvertimeRateCode, number> = {
  HHEE_25: 1.25,
  HHEE_35: 1.35,
  HHEE_100: 2,
  HHEE_200: 3,
  HHEE_300: 4,
};

/** Deriva la quincena en UI (backend la recalcula). */
export function fortnightOf(workDate: string): 1 | 2 {
  const day = Number(workDate.slice(8, 10));
  return day <= 15 ? 1 : 2;
}
