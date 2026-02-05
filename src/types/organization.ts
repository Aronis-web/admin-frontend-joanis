/**
 * Organization Module Types
 * Based on the Organization Module API Documentation
 */

export type ScopeLevel = 'SITE' | 'COMPANY';
export type AssignmentType = 'PERMANENT' | 'TEMPORARY' | 'ACTING' | 'INTERIM';
export type FiscalPeriod = 'ANNUAL' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'MONTHLY';
export type Currency = 'PEN' | 'USD' | 'EUR';
export type SalaryType = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'ANNUAL';

/**
 * Organization Position
 */
export interface OrganizationPosition {
  id: string;
  scopeLevel: ScopeLevel;
  companyId: string;
  siteId: string | null;
  code: string;
  name: string;
  description: string | null;
  parentPositionId: string | null;
  level: number;
  maxOccupants: number | null;
  minOccupants: number;
  isActive: boolean;
  displayOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  company?: any;
  site?: any;
  parent?: OrganizationPosition;
  children?: OrganizationPosition[];
  siteScopes?: any[];
}

/**
 * Position Tree Node (for hierarchical display)
 */
export interface PositionTreeNode {
  id: string;
  code: string;
  name: string;
  level: number;
  scopeLevel: ScopeLevel;
  description?: string | null;
  parentPositionId?: string | null;
  maxOccupants?: number | null;
  minOccupants?: number;
  isActive?: boolean;
  displayOrder?: number;
  children?: PositionTreeNode[];
  // Additional fields for UI
  assignments?: PositionAssignment[];
  currentOccupants?: number;
}

/**
 * Position Assignment
 */
export interface PositionAssignment {
  id: string;
  positionId: string;
  userId: string;
  siteId: string;
  startDate: string;
  endDate: string | null;
  isPrimary: boolean;
  isTemporary: boolean;
  assignmentType: AssignmentType;
  workloadPercentage: number;
  assignedBy: string | null;
  assignedAt: string;
  endedBy: string | null;
  endedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  position?: OrganizationPosition;
  user?: any;
  site?: any;
}

/**
 * Position Budget
 */
export interface PositionBudget {
  id: string;
  positionId: string;
  fiscalYear: number;
  fiscalPeriod: FiscalPeriod;
  periodStartDate: string;
  periodEndDate: string;
  budgetedHeadcount: number;
  budgetedMinHeadcount: number;
  budgetedMaxHeadcount: number | null;
  budgetedSalaryMin: number | null;
  budgetedSalaryMax: number | null;
  budgetedSalaryAvg: number | null;
  budgetedTotalSalary: number;
  budgetedBenefits: number;
  budgetedTraining: number;
  budgetedOtherCosts: number;
  currency: Currency;
  isApproved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Position Assignment Salary
 */
export interface PositionAssignmentSalary {
  id: string;
  assignmentId: string;
  salaryAmount: number;
  currency: Currency;
  salaryType: SalaryType;
  effectiveDate: string;
  endDate: string | null;
  benefitsAmount: number;
  otherCosts: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Site Scope
 */
export interface PositionSiteScope {
  positionId: string;
  applicableSiteIds: string[];
}

/**
 * Create Position Request
 */
export interface CreatePositionRequest {
  scopeLevel: ScopeLevel;
  code: string;
  name: string;
  description?: string | null;
  parentPositionId?: string | null;
  level: number;
  maxOccupants?: number | null;
  minOccupants: number;
  displayOrder?: number;
  applicableSiteIds?: string[];
}

/**
 * Update Position Request
 */
export interface UpdatePositionRequest {
  name?: string;
  description?: string | null;
  maxOccupants?: number | null;
  minOccupants?: number;
  isActive?: boolean;
  displayOrder?: number;
}

/**
 * Create Assignment Request
 */
export interface CreateAssignmentRequest {
  userId: string;
  startDate: string;
  endDate?: string | null;
  isPrimary: boolean;
  isTemporary: boolean;
  assignmentType: AssignmentType;
  workloadPercentage: number;
  notes?: string | null;
}

/**
 * Update Assignment Request
 */
export interface UpdateAssignmentRequest {
  endDate?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

/**
 * Create Budget Request
 */
export interface CreateBudgetRequest {
  fiscalYear: number;
  fiscalPeriod: FiscalPeriod;
  periodStartDate: string;
  periodEndDate: string;
  budgetedHeadcount: number;
  budgetedMinHeadcount: number;
  budgetedMaxHeadcount?: number | null;
  budgetedSalaryMin?: number | null;
  budgetedSalaryMax?: number | null;
  budgetedSalaryAvg?: number | null;
  budgetedTotalSalary: number;
  budgetedBenefits: number;
  budgetedTraining: number;
  budgetedOtherCosts: number;
  currency: Currency;
  notes?: string | null;
}

/**
 * Create Salary Request
 */
export interface CreateSalaryRequest {
  salaryAmount: number;
  currency: Currency;
  salaryType: SalaryType;
  effectiveDate: string;
  endDate?: string | null;
  benefitsAmount: number;
  otherCosts: number;
  notes?: string | null;
}
