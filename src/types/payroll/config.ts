import type { AfpCode, AfpRegime, ConceptType, PayrollParamKey } from './common';

export interface AfpRate {
  afp_code: AfpCode;
  regime: AfpRegime;
  commission_rate: string;
  insurance_rate: string;
  fund_rate: string;
  insurable_cap: string;
  effective_from?: string;
  effective_to?: string | null;
}

export interface UpsertAfpRateDto {
  afpCode: AfpCode;
  regime: AfpRegime;
  commissionRate: number;
  insuranceRate: number;
  fundRate: number;
  insurableCap: number;
  effectiveFrom: string; // YYYY-MM-DD
}

export interface PayrollParameter {
  param_key: PayrollParamKey | string;
  numeric_value: string;
  text_value?: string | null;
  description?: string | null;
  effective_from?: string;
  effective_to?: string | null;
}

export interface UpsertParameterDto {
  paramKey: PayrollParamKey;
  numericValue: number;
  effectiveFrom: string;
  description?: string;
}

export interface TaxBracket {
  year: number;
  bracket_order: number;
  lower_uit: string;
  upper_uit: string;
  rate: string;
}

export interface UpsertTaxBracketDto {
  year: number;
  bracketOrder: number;
  lowerUit: number;
  upperUit: number;
  rate: number;
}

export interface PayrollConcept {
  code: string;
  name: string;
  concept_type: ConceptType;
  category?: string | null;
  affects_afp?: boolean;
  affects_essalud?: boolean;
  affects_income_tax?: boolean;
  display_order?: number;
  is_active?: boolean;
}

export interface UpsertConceptDto {
  code: string;
  name: string;
  conceptType: ConceptType;
  category?: string;
  affectsAfp?: boolean;
  affectsEssalud?: boolean;
  affectsIncomeTax?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}
