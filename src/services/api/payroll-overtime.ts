import { apiClient } from './client';
import type {
  ApiSuccess,
  CreateOvertimeDto,
  OvertimeListParams,
  OvertimeRequest,
} from '@/types/payroll';

/**
 * Horas extra: /payroll/overtime
 * Permiso: payroll.overtime.manage
 */
class PayrollOvertimeService {
  private readonly base = '/payroll/overtime';

  async list(
    params?: OvertimeListParams,
    signal?: AbortSignal
  ): Promise<ApiSuccess<OvertimeRequest>> {
    return apiClient.get(this.base, { params, signal });
  }

  async create(data: CreateOvertimeDto): Promise<ApiSuccess<OvertimeRequest>> {
    return apiClient.post(this.base, data);
  }
}

export const payrollOvertimeApi = new PayrollOvertimeService();
export default payrollOvertimeApi;
