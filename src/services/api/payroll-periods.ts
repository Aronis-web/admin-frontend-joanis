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

  async list(params?: PeriodListParams, signal?: AbortSignal): Promise<ApiSuccess<PayrollPeriod>> {
    return apiClient.get(this.base, { params, signal });
  }

  async getById(id: string): Promise<ApiSuccess<PayrollPeriod>> {
    return apiClient.get(`${this.base}/${id}`);
  }

  async create(data: CreatePeriodDto): Promise<ApiSuccess<PayrollPeriod>> {
    return apiClient.post(this.base, data);
  }

  async aggregateAttendance(id: string): Promise<AggregateAttendanceResponse> {
    return apiClient.post(`${this.base}/${id}/aggregate-attendance`);
  }

  async getInputs(id: string, signal?: AbortSignal): Promise<ApiSuccess<PeriodInput>> {
    return apiClient.get(`${this.base}/${id}/inputs`, { signal });
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

  async getSlips(id: string, signal?: AbortSignal): Promise<ApiSuccess<SlipSummary>> {
    return apiClient.get(`${this.base}/${id}/slips`, { signal });
  }

  async close(id: string): Promise<{ success: true; status: 'CERRADO' }> {
    return apiClient.post(`${this.base}/${id}/close`);
  }
}

export const payrollPeriodsApi = new PayrollPeriodsService();
export default payrollPeriodsApi;
