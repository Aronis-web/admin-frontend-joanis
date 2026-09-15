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
 * Normaliza la respuesta a un array garantizado.
 * Tolera envelopes `{ items }`, `{ data }`, `{ results }`, o array plano.
 * Devuelve `[]` si nada calza (evita `.map is not a function` aguas abajo).
 */
const toArray = <T>(res: unknown): T[] => {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.results)) return obj.results as T[];
  }
  return [];
};

/**
 * Maestro laboral: /payroll/employment
 * Todas las respuestas viajan en envelope `{ success, item(s) }` y se
 * desempaquetan aqui para que los hooks / pantallas consuman datos "planos".
 */
class PayrollEmploymentService {
  private readonly base = '/payroll/employment';

  async list(params?: EmploymentListParams, signal?: AbortSignal): Promise<EmploymentRecord[]> {
    const res = await apiClient.get<ApiSuccess<EmploymentRecord>>(this.base, { params, signal });
    return toArray<EmploymentRecord>(res);
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
    return toArray<PayrollPosition>(res);
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
    return toArray<EmploymentHistoryEntry>(res);
  }

  async getSalaryHistory(userId: string): Promise<SalaryHistoryEntry[]> {
    const res = await apiClient.get<ApiSuccess<SalaryHistoryEntry>>(
      `${this.base}/${userId}/salary-history`
    );
    return toArray<SalaryHistoryEntry>(res);
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
    return toArray<BenefitChange>(res);
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
