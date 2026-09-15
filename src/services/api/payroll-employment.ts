import { apiClient } from './client';
import type {
  ApiSuccess,
  CreateEmploymentDto,
  EmploymentHistoryEntry,
  EmploymentListParams,
  EmploymentRecord,
  PayrollPosition,
  PayrollPositionListParams,
  SalaryHistoryEntry,
  UpdateEmploymentDto,
  UpdateScheduleDto,
  WorkSchedule,
  BenefitChange,
  CreateBenefitChangeDto,
} from '@/types/payroll';

/**
 * Maestro laboral: /payroll/employment
 * Todas las respuestas viajan en envelope `{ success, item(s) }` y se
 * desempaquetan aqui para que los hooks / pantallas consuman datos "planos".
 */
class PayrollEmploymentService {
  private readonly base = '/payroll/employment';

  async list(params?: EmploymentListParams, signal?: AbortSignal): Promise<EmploymentRecord[]> {
    const res = await apiClient.get<ApiSuccess<EmploymentRecord>>(this.base, { params, signal });
    return res.items ?? [];
  }

  /**
   * Lista los puestos del organigrama disponibles para asignar en planilla.
   * `GET /payroll/employment/positions`
   */
  async listPositions(
    params?: PayrollPositionListParams,
    signal?: AbortSignal
  ): Promise<PayrollPosition[]> {
    const res = await apiClient.get<ApiSuccess<PayrollPosition>>(`${this.base}/positions`, {
      params,
      signal,
    });
    return res.items ?? [];
  }

  async getByUser(userId: string): Promise<EmploymentRecord | null> {
    const res = await apiClient.get<ApiSuccess<EmploymentRecord>>(`${this.base}/${userId}`);
    return (res.item as EmploymentRecord) ?? null;
  }

  async create(data: CreateEmploymentDto): Promise<EmploymentRecord | null> {
    const res = await apiClient.post<ApiSuccess<EmploymentRecord>>(this.base, data);
    return (res.item as EmploymentRecord) ?? null;
  }

  async update(userId: string, data: UpdateEmploymentDto): Promise<EmploymentRecord | null> {
    const res = await apiClient.put<ApiSuccess<EmploymentRecord>>(`${this.base}/${userId}`, data);
    return (res.item as EmploymentRecord) ?? null;
  }

  async getHistory(userId: string): Promise<EmploymentHistoryEntry[]> {
    const res = await apiClient.get<ApiSuccess<EmploymentHistoryEntry>>(
      `${this.base}/${userId}/history`
    );
    return res.items ?? [];
  }

  async getSalaryHistory(userId: string): Promise<SalaryHistoryEntry[]> {
    const res = await apiClient.get<ApiSuccess<SalaryHistoryEntry>>(
      `${this.base}/${userId}/salary-history`
    );
    return res.items ?? [];
  }

  async getSchedule(userId: string): Promise<WorkSchedule | null> {
    const res = await apiClient.get<ApiSuccess<WorkSchedule>>(`${this.base}/${userId}/schedule`);
    return (res.item as WorkSchedule) ?? null;
  }

  async updateSchedule(userId: string, data: UpdateScheduleDto): Promise<WorkSchedule | null> {
    const res = await apiClient.put<ApiSuccess<WorkSchedule>>(
      `${this.base}/${userId}/schedule`,
      data
    );
    return (res.item as WorkSchedule) ?? null;
  }

  async listBenefitChanges(userId: string): Promise<BenefitChange[]> {
    const res = await apiClient.get<ApiSuccess<BenefitChange>>(
      `${this.base}/${userId}/benefit-changes`
    );
    return res.items ?? [];
  }

  async createBenefitChange(
    userId: string,
    data: CreateBenefitChangeDto
  ): Promise<BenefitChange | null> {
    const res = await apiClient.post<ApiSuccess<BenefitChange>>(
      `${this.base}/${userId}/benefit-changes`,
      data
    );
    return (res.item as BenefitChange) ?? null;
  }
}

export const payrollEmploymentApi = new PayrollEmploymentService();
export default payrollEmploymentApi;
