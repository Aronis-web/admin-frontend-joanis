import { apiClient } from './client';
import { organizationApi } from './organization';
import type { OrganizationPosition } from '@/types/organization';
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
   *
   * Nota: El backend NO expone `/payroll/employment/positions` (colisiona con la ruta
   * `/payroll/employment/:userId`). Se consume directo el organigrama:
   *  - `GET /organization/companies/:companyId/positions`
   *  - `GET /organization/sites/:siteId/positions` (opcional si hay siteId)
   *
   * El filtrado por `search` y `activeOnly` se aplica en cliente (los endpoints del
   * organigrama devuelven la lista completa por scope). La respuesta se normaliza al
   * shape snake_case `PayrollPosition` que consumen los pickers.
   */
  async listPositions(params?: PayrollPositionListParams): Promise<PayrollPosition[]> {
    const { companyId, siteId, search, activeOnly = true } = params ?? {};
    if (!companyId) return [];

    const [companyPositions, sitePositions] = await Promise.all([
      organizationApi.getCompanyPositions(companyId).catch(() => [] as OrganizationPosition[]),
      siteId
        ? organizationApi.getSitePositions(siteId).catch(() => [] as OrganizationPosition[])
        : Promise.resolve([] as OrganizationPosition[]),
    ]);

    const raw = [
      ...(Array.isArray(companyPositions) ? companyPositions : []),
      ...(Array.isArray(sitePositions) ? sitePositions : []),
    ];

    const seen = new Set<string>();
    const q = (search ?? '').trim().toLowerCase();

    return raw
      .filter((p) => {
        if (!p || seen.has(p.id)) return false;
        seen.add(p.id);
        if (activeOnly && p.isActive === false) return false;
        if (q) {
          const hay = `${p.name ?? ''} ${p.code ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map<PayrollPosition>((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        scope_level: p.scopeLevel,
        site_id: p.siteId,
        is_active: p.isActive,
      }));
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
