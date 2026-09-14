import { apiClient } from './client';
import type {
  ApiSuccess,
  CreateEmploymentDto,
  EmploymentHistoryEntry,
  EmploymentListParams,
  EmploymentRecord,
  SalaryHistoryEntry,
  UpdateEmploymentDto,
  UpdateScheduleDto,
  WorkSchedule,
  BenefitChange,
  CreateBenefitChangeDto,
} from '@/types/payroll';

/**
 * Maestro laboral: /payroll/employment
 * Permiso lectura: payroll.employment.read
 * Permiso escritura: payroll.employment.manage
 */
class PayrollEmploymentService {
  private readonly base = '/payroll/employment';

  async list(
    params?: EmploymentListParams,
    signal?: AbortSignal
  ): Promise<ApiSuccess<EmploymentRecord>> {
    return apiClient.get(this.base, { params, signal });
  }

  async getByUser(userId: string): Promise<ApiSuccess<EmploymentRecord>> {
    return apiClient.get(`${this.base}/${userId}`);
  }

  async create(data: CreateEmploymentDto): Promise<ApiSuccess<EmploymentRecord>> {
    return apiClient.post(this.base, data);
  }

  async update(userId: string, data: UpdateEmploymentDto): Promise<ApiSuccess<EmploymentRecord>> {
    return apiClient.put(`${this.base}/${userId}`, data);
  }

  async getHistory(userId: string): Promise<ApiSuccess<EmploymentHistoryEntry>> {
    return apiClient.get(`${this.base}/${userId}/history`);
  }

  async getSalaryHistory(userId: string): Promise<ApiSuccess<SalaryHistoryEntry>> {
    return apiClient.get(`${this.base}/${userId}/salary-history`);
  }

  async getSchedule(userId: string): Promise<ApiSuccess<WorkSchedule>> {
    return apiClient.get(`${this.base}/${userId}/schedule`);
  }

  async updateSchedule(userId: string, data: UpdateScheduleDto): Promise<ApiSuccess<WorkSchedule>> {
    return apiClient.put(`${this.base}/${userId}/schedule`, data);
  }

  // ---- Cambios de beneficio (viven bajo /employment/:userId/benefit-changes)
  async listBenefitChanges(userId: string): Promise<ApiSuccess<BenefitChange>> {
    return apiClient.get(`${this.base}/${userId}/benefit-changes`);
  }

  async createBenefitChange(
    userId: string,
    data: CreateBenefitChangeDto
  ): Promise<ApiSuccess<BenefitChange>> {
    return apiClient.post(`${this.base}/${userId}/benefit-changes`, data);
  }
}

export const payrollEmploymentApi = new PayrollEmploymentService();
export default payrollEmploymentApi;
