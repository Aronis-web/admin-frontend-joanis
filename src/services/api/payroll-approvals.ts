import { apiClient } from './client';
import type {
  Approval,
  ApprovalDecisionDto,
  ApprovalListParams,
  ApiSuccess,
} from '@/types/payroll';

/**
 * Bandeja de aprobaciones: /payroll/approvals
 * Permiso: payroll.approvals.decide
 *
 * Regla maker-checker: el aprobador NO puede ser el mismo `requested_by`.
 */
class PayrollApprovalsService {
  private readonly base = '/payroll/approvals';

  async list(params?: ApprovalListParams, signal?: AbortSignal): Promise<ApiSuccess<Approval>> {
    return apiClient.get(this.base, { params, signal });
  }

  async approve(
    id: string,
    data: ApprovalDecisionDto
  ): Promise<{ success: true; status: 'APROBADO' }> {
    return apiClient.post(`${this.base}/${id}/approve`, data);
  }

  async reject(
    id: string,
    data: ApprovalDecisionDto
  ): Promise<{ success: true; status: 'RECHAZADO' }> {
    return apiClient.post(`${this.base}/${id}/reject`, data);
  }
}

export const payrollApprovalsApi = new PayrollApprovalsService();
export default payrollApprovalsApi;
