import { apiClient } from './client';
import type { ApiSuccess, Slip } from '@/types/payroll';

/**
 * Boletas individuales: /payroll/periods/slips/:slipId
 * (La lista de boletas de un periodo vive en payrollPeriodsApi.getSlips.)
 */
class PayrollSlipsService {
  async getById(slipId: string): Promise<Slip | null> {
    const res = await apiClient.get<ApiSuccess<Slip>>(`/payroll/periods/slips/${slipId}`);
    return (res.item as Slip) ?? null;
  }
}

export const payrollSlipsApi = new PayrollSlipsService();
export default payrollSlipsApi;
