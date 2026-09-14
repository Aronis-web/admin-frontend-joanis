import { apiClient } from './client';
import type { ApiSuccess, Slip } from '@/types/payroll';

/**
 * Boletas individuales: /payroll/periods/slips/:slipId
 * Permiso: payroll.slips.read
 *
 * (La lista de boletas de un periodo vive en payrollPeriodsApi.getSlips.)
 */
class PayrollSlipsService {
  async getById(slipId: string): Promise<ApiSuccess<Slip>> {
    return apiClient.get(`/payroll/periods/slips/${slipId}`);
  }
}

export const payrollSlipsApi = new PayrollSlipsService();
export default payrollSlipsApi;
