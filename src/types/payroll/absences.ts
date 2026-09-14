import type { AbsenceType, ApprovalStatus } from './common';

export interface AbsenceRequest {
  id: string;
  user_id: string;
  absence_type: AbsenceType;
  start_date: string;
  end_date: string;
  days: string;
  reason?: string | null;
  is_paid: boolean;
  evidence_ref?: string | null;
  status: ApprovalStatus;
  approval_id?: string | null;
  created_at?: string;
}

export interface AbsenceListParams {
  userId?: string;
  status?: ApprovalStatus;
}

export interface CreateAbsenceDto {
  userId: string;
  absenceType: AbsenceType;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
}

/**
 * Info del archivo local a subir junto al alta de la falta.
 * En web pasar directamente un {@link File}. En RN nativo pasar `uri`+`name`+`mimeType`.
 */
export interface AbsenceFileInput {
  uri: string;
  name: string;
  mimeType: string;
}

/** True si el tipo de ausencia genera descuento (afecta `d_faltos`). */
export function isAbsenceDeductible(type: AbsenceType): boolean {
  return type === 'INJUSTIFICADA' || type === 'LICENCIA_SIN_GOCE';
}
