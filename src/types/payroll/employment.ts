import type { AfpCode, AfpRegime, PensionSystem } from './common';

/**
 * Fila de maestro laboral tal cual la devuelve el backend.
 * Los montos numeric llegan como string.
 */
export interface EmploymentRecord {
  id: string;
  user_id: string;
  employee_code: string | null;
  full_name?: string | null;
  hire_date?: string | null;
  /** Id del puesto del organigrama vinculado (nullable si es legacy). */
  position_id?: string | null;
  /** Code del puesto del organigrama (snapshot devuelto por el backend). */
  position_code?: string | null;
  /** Nombre del puesto (snapshot / fallback). Sincronizado con `position_id`. */
  position_name?: string | null;
  cost_center?: string | null;
  area?: string | null;
  site_id?: string | null;
  contract_type?: string | null;
  basic_salary: string;
  has_family_allowance?: boolean;
  children_count?: number;
  movilidad_amount: string;
  pension_system: PensionSystem;
  afp_code?: AfpCode | null;
  afp_regime?: AfpRegime | null;
  cuspp?: string | null;
  has_eps?: boolean;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_cci?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmploymentListParams {
  siteId?: string;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateEmploymentDto {
  userId: string;
  employeeCode?: string;
  hireDate?: string; // YYYY-MM-DD
  /** Puesto del organigrama (preferido). */
  positionId?: string;
  /** Nombre libre (snapshot/fallback). Se sincroniza con `positionId` si viene. */
  positionName?: string;
  costCenter?: string;
  area?: string;
  siteId?: string;
  contractType?: string;
  basicSalary: number;
  hasFamilyAllowance?: boolean;
  childrenCount?: number;
  movilidadAmount?: number;
  pensionSystem: PensionSystem;
  afpCode?: AfpCode;
  afpRegime?: AfpRegime;
  cuspp?: string;
  hasEps?: boolean;
  bankName?: string;
  bankAccount?: string;
  bankCci?: string;
}

export interface UpdateEmploymentDto {
  employeeCode?: string;
  hireDate?: string;
  /** Puesto del organigrama (preferido). */
  positionId?: string;
  /** Nombre libre (snapshot/fallback). */
  positionName?: string;
  costCenter?: string;
  area?: string;
  siteId?: string;
  contractType?: string;
  hasFamilyAllowance?: boolean;
  childrenCount?: number;
  pensionSystem?: PensionSystem;
  afpCode?: AfpCode;
  afpRegime?: AfpRegime;
  cuspp?: string;
  hasEps?: boolean;
  bankName?: string;
  bankAccount?: string;
  bankCci?: string;
  isActive?: boolean;
}

export interface EmploymentHistoryEntry {
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_type: 'CREATE' | 'UPDATE' | 'DELETE';
  changed_by: string;
  created_at: string;
}

export interface SalaryHistoryEntry {
  basic_salary: string;
  movilidad_amount: string;
  effective_from: string;
  effective_to: string | null;
  reason?: string | null;
}

export interface WorkSchedule {
  days_per_week: number;
  daily_hours: string;
  entry_time: string;
  exit_time: string;
  effective_from: string;
}

/**
 * Puesto del organigrama disponible para asignar en planilla.
 * Viene de `GET /payroll/employment/positions`.
 */
export interface PayrollPosition {
  id: string;
  code: string;
  name: string;
  scope_level?: 'COMPANY' | 'SITE' | 'GLOBAL' | string;
  site_id?: string | null;
  is_active: boolean;
}

export interface PayrollPositionListParams {
  /** Requerido: id de la empresa activa (viene del `useTenantStore`). */
  companyId?: string;
  /** Opcional: si viene, se agregan tambien los puestos scope SITE de esa sede. */
  siteId?: string;
  activeOnly?: boolean;
  search?: string;
}

export interface UpdateScheduleDto {
  daysPerWeek: number;
  dailyHours: number;
  entryTime: string; // HH:mm
  exitTime: string;
  effectiveFrom: string; // YYYY-MM-DD
}
