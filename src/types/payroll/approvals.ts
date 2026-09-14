import type { ApprovalEntityType, ApprovalStatus } from './common';

export interface Approval {
  id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  status: ApprovalStatus;
  requested_by: string;
  target_role: string;
  comments?: string | null;
  approver_role?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
}

export interface ApprovalListParams {
  status?: ApprovalStatus;
  entityType?: ApprovalEntityType;
}

export interface ApprovalDecisionDto {
  comments?: string;
  approverRole: string;
}
