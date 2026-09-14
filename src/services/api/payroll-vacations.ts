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
 * Vacaciones: /payroll/vacations y /payroll/vacation-balances.
 */
class PayrollVacationsService {
  async list(params?: VacationListParams, signal?: AbortSignal): Promise<VacationRequest[]> {
    const res = await apiClient.get<ApiSuccess<VacationRequest>>('/payroll/vacations', {
      params,
      signal,
    });
    return res.items ?? [];
  }

  async create(data: CreateVacationDto): Promise<VacationRequest | null> {
    const res = await apiClient.post<ApiSuccess<VacationRequest>>('/payroll/vacations', data);
    return (res.item as VacationRequest) ?? null;
  }

  async getBalances(userId: string): Promise<VacationBalance[]> {
    const res = await apiClient.get<ApiSuccess<VacationBalance>>(
      `/payroll/vacation-balances/${userId}`
    );
    return res.items ?? [];
  }

  async upsertBalance(data: UpsertVacationBalanceDto): Promise<VacationBalance | null> {
    const res = await apiClient.post<ApiSuccess<VacationBalance>>(
      '/payroll/vacation-balances',
      data
    );
    return (res.item as VacationBalance) ?? null;
  }
}

export const payrollVacationsApi = new PayrollVacationsService();
export default payrollVacationsApi;
