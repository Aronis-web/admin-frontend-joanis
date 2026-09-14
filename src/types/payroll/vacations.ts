import type { ApprovalStatus, VacationRequestType } from './common';

export interface VacationRequest {
  id: string;
  user_id: string;
  request_type: VacationRequestType;
  start_date: string;
  end_date: string;
  days: string;
  notes?: string | null;
  status: ApprovalStatus;
  approval_id?: string | null;
  created_at?: string;
}

export interface VacationListParams {
  userId?: string;
  status?: ApprovalStatus;
}

export interface CreateVacationDto {
  userId: string;
  requestType: VacationRequestType;
  startDate: string;
  endDate: string;
  days: number;
  notes?: string;
}

export interface VacationBalance {
  period_label: string;
  earned_days: string;
  taken_days: string;
  as_of_date: string;
}

export interface UpsertVacationBalanceDto {
  userId: string;
  periodLabel: string;
  earnedDays: number;
  takenDays: number;
  asOfDate: string;
}
