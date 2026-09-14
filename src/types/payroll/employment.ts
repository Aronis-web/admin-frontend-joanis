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

export interface UpdateScheduleDto {
  daysPerWeek: number;
  dailyHours: number;
  entryTime: string; // HH:mm
  exitTime: string;
  effectiveFrom: string; // YYYY-MM-DD
}
