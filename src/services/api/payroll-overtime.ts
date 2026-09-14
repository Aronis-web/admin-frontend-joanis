import { apiClient } from './client';
import type {
  ApiSuccess,
  CreateOvertimeDto,
  OvertimeListParams,
  OvertimeRequest,
} from '@/types/payroll';

/**
 * Horas extra: /payroll/overtime
 */
class PayrollOvertimeService {
  private readonly base = '/payroll/overtime';

  async list(params?: OvertimeListParams, signal?: AbortSignal): Promise<OvertimeRequest[]> {
    const res = await apiClient.get<ApiSuccess<OvertimeRequest>>(this.base, { params, signal });
    return res.items ?? [];
  }

  async create(data: CreateOvertimeDto): Promise<OvertimeRequest | null> {
    const res = await apiClient.post<ApiSuccess<OvertimeRequest>>(this.base, data);
    return (res.item as OvertimeRequest) ?? null;
  }
}

export const payrollOvertimeApi = new PayrollOvertimeService();
export default payrollOvertimeApi;
