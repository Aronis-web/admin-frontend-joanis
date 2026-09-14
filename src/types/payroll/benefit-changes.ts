import type {
  AfpCode,
  AfpRegime,
  ApprovalStatus,
  BenefitChangeType,
  PensionSystem,
} from './common';

export interface BenefitChangeSueldoValue {
  basic_salary: number;
}
export interface BenefitChangeMovilidadValue {
  movilidad_amount: number;
}
export interface BenefitChangePensionSystemValue {
  pension_system: PensionSystem;
  afp_code?: AfpCode;
  afp_regime?: AfpRegime;
  cuspp?: string;
}
export interface BenefitChangeAfpValue {
  afp_code: AfpCode;
  afp_regime: AfpRegime;
  cuspp?: string;
}
export interface BenefitChangeFamilyValue {
  has_family_allowance: boolean;
}
export interface BenefitChangeHijosValue {
  children_count: number;
}

export type BenefitChangeValue =
  | BenefitChangeSueldoValue
  | BenefitChangeMovilidadValue
  | BenefitChangePensionSystemValue
  | BenefitChangeAfpValue
  | BenefitChangeFamilyValue
  | BenefitChangeHijosValue
  | Record<string, unknown>;

export interface BenefitChange {
  id: string;
  user_id: string;
  change_type: BenefitChangeType;
  old_value: BenefitChangeValue | null;
  new_value: BenefitChangeValue;
  effective_date: string;
  notes?: string | null;
  status: ApprovalStatus;
  approval_id?: string | null;
  created_at?: string;
}

export interface CreateBenefitChangeDto {
  changeType: BenefitChangeType;
  newValue: BenefitChangeValue;
  effectiveDate: string;
  notes?: string;
}
