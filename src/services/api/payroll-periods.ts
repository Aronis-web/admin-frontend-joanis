import { apiClient } from './client';
import type {
  AggregateAttendanceResponse,
  ApiSuccess,
  CalculatePeriodDto,
  CalculateResponse,
  CreatePeriodDto,
  OverrideInputDto,
  PayrollPeriod,
  PeriodInput,
  PeriodListParams,
} from '@/types/payroll';
import type { SlipSummary } from '@/types/payroll';

/**
 * Periodos + inputs + calculo + cierre: /payroll/periods
 * Permiso base: payroll.periods.manage
 * Calculo: payroll.calculate
 * Boletas: payroll.slips.read
 */
class PayrollPeriodsService {
  private readonly base = '/payroll/periods';

  async list(params?: PeriodListParams, signal?: AbortSignal): Promise<PayrollPeriod[]> {
    const res = await apiClient.get<ApiSuccess<PayrollPeriod>>(this.base, { params, signal });
    return res.items ?? [];
  }

  async getById(id: string): Promise<PayrollPeriod | null> {
    const res = await apiClient.get<ApiSuccess<PayrollPeriod>>(`${this.base}/${id}`);
    return (res.item as PayrollPeriod) ?? null;
  }

  async create(data: CreatePeriodDto): Promise<PayrollPeriod | null> {
    const res = await apiClient.post<ApiSuccess<PayrollPeriod>>(this.base, data);
    return (res.item as PayrollPeriod) ?? null;
  }

  async aggregateAttendance(id: string): Promise<AggregateAttendanceResponse> {
    return apiClient.post(`${this.base}/${id}/aggregate-attendance`);
  }

  async getInputs(id: string, signal?: AbortSignal): Promise<PeriodInput[]> {
    const res = await apiClient.get<ApiSuccess<PeriodInput>>(`${this.base}/${id}/inputs`, {
      signal,
    });
    return res.items ?? [];
  }

  async overrideInput(
    id: string,
    userId: string,
    data: OverrideInputDto
  ): Promise<{ success: true; input: PeriodInput }> {
    return apiClient.put(`${this.base}/${id}/inputs/${userId}`, data);
  }

  async calculate(id: string, data?: CalculatePeriodDto): Promise<CalculateResponse> {
    return apiClient.post(`${this.base}/${id}/calculate`, data ?? {});
  }

  async getSlips(id: string, signal?: AbortSignal): Promise<SlipSummary[]> {
    const res = await apiClient.get<ApiSuccess<SlipSummary>>(`${this.base}/${id}/slips`, {
      signal,
    });
    return res.items ?? [];
  }

  async close(id: string): Promise<{ success: true; status: 'CERRADO' }> {
    return apiClient.post(`${this.base}/${id}/close`);
  }
}

export const payrollPeriodsApi = new PayrollPeriodsService();
export default payrollPeriodsApi;
