import { apiClient } from './client';
import type {
  ApiSuccess,
  CreateVacationDto,
  UpsertVacationBalanceDto,
  VacationBalance,
  VacationListParams,
  VacationRequest,
} from '@/types/payroll';

/**
 * Vacaciones: /payroll/vacations y /payroll/vacation-balances
 * Permiso: payroll.vacations.manage
 */
class PayrollVacationsService {
  async list(
    params?: VacationListParams,
    signal?: AbortSignal
  ): Promise<ApiSuccess<VacationRequest>> {
    return apiClient.get('/payroll/vacations', { params, signal });
  }

  async create(data: CreateVacationDto): Promise<ApiSuccess<VacationRequest>> {
    return apiClient.post('/payroll/vacations', data);
  }

  async getBalances(userId: string): Promise<ApiSuccess<VacationBalance>> {
    return apiClient.get(`/payroll/vacation-balances/${userId}`);
  }

  async upsertBalance(data: UpsertVacationBalanceDto): Promise<ApiSuccess<VacationBalance>> {
    return apiClient.post('/payroll/vacation-balances', data);
  }
}

export const payrollVacationsApi = new PayrollVacationsService();
export default payrollVacationsApi;
