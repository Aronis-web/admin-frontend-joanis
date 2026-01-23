// Company Types and Interfaces for Multi-Tenancy

/**
 * Company Type Enum
 */
export enum CompanyType {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
}

/**
 * Company (Empresa) - Main tenant entity
 */
export interface Company {
  id: string;
  ruc?: string; // RUC único (opcional)
  name: string;
  alias?: string; // Alias de la empresa (opcional)
  companyType: CompanyType; // Tipo de empresa (INTERNAL/EXTERNAL)
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sites?: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

/**
 * User-Company relationship status
 */
export enum UserCompanyStatus {
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  SUSPENDED = 'SUSPENDED',
}

/**
 * User-Company relationship
 */
export interface UserCompany {
  userId: string;
  companyId: string;
  isOwner: boolean;
  status: UserCompanyStatus;
  createdAt: string;
  user?: {
    id: string;
    name?: string;
    email: string;
    username?: string;
  };
  company?: Company;
}

/**
 * User-Company-Site relationship
 */
export interface UserCompanySite {
  userId: string;
  companyId: string;
  siteId: string;
  canSelect: boolean;
  createdAt: string;
  site?: {
    id: string;
    code: string;
    name: string;
  };
}

/**
 * App scope levels for permissions
 */
export enum AppScopeLevel {
  COMPANY = 'COMPANY',
  SITE = 'SITE',
  WAREHOUSE = 'WAREHOUSE',
  AREA = 'AREA',
}

/**
 * App scope with permissions
 */
export interface AppScope {
  id: string;
  appId: string;
  level: AppScopeLevel;
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  areaId?: string;
  canRead: boolean;
  canWrite: boolean;
}

/**
 * User app role with scope
 */
export interface UserAppRole {
  userId: string;
  appId: string;
  roleId: string;
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  createdAt: string;
}

// ============================================
// Request/Response Types
// ============================================

/**
 * Create company request
 */
export interface CreateCompanyRequest {
  ruc?: string;
  name: string;
  alias?: string;
  companyType?: CompanyType;
  isActive?: boolean;
}

/**
 * Update company request
 */
export interface UpdateCompanyRequest {
  ruc?: string;
  name?: string;
  alias?: string;
  companyType?: CompanyType;
  isActive?: boolean;
}

/**
 * Get companies query parameters
 */
export interface GetCompaniesParams {
  search?: string; // Search in name and RUC
  q?: string; // Alias for search (backward compatibility)
  isActive?: boolean;
  companyType?: CompanyType; // Filter by company type
  userId?: string; // Filter companies of a specific user
  page?: number;
  limit?: number;
  orderBy?: 'name' | 'ruc' | 'createdAt';
  orderDir?: 'ASC' | 'DESC';
}

/**
 * Companies response with pagination
 */
export interface CompaniesResponse {
  data: Company[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Assign user to company request
 */
export interface AssignUserToCompanyRequest {
  userId: string;
  isOwner?: boolean;
  status?: UserCompanyStatus;
}

/**
 * Assign user to sites request
 */
export interface AssignUserToSitesRequest {
  userId: string;
  siteIds: string[];
  canSelect?: boolean;
}

/**
 * User companies response
 */
export interface UserCompaniesResponse {
  data: UserCompany[];
  total?: number;
}

/**
 * User sites response
 */
export interface UserSitesResponse {
  data: UserCompanySite[];
  total?: number;
}

/**
 * Multi-tenant context for API requests
 */
export interface TenantContext {
  userId?: string;
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
}

/**
 * Multi-tenant headers for API requests
 */
export interface TenantHeaders {
  'X-User-Id'?: string;
  'X-Company-Id'?: string;
  'X-Site-Id'?: string;
  'X-Warehouse-Id'?: string;
}

// ============================================
// Payment Methods Types
// ============================================

/**
 * Account Type Enum
 */
export enum AccountType {
  SAVINGS = 'SAVINGS',
  CHECKING = 'CHECKING',
}

/**
 * Currency Enum
 */
export enum Currency {
  PEN = 'PEN',
  USD = 'USD',
}

/**
 * Bank Account
 */
export interface BankAccount {
  id: string;
  paymentMethodId: string;
  accountNumber: string;
  accountType: AccountType;
  currency: Currency;
  holderName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payment Method
 */
export interface PaymentMethod {
  id: string;
  companyId: string;
  name: string;
  alias?: string;
  methodType?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  accounts?: BankAccount[];
}

/**
 * Create Payment Method Request
 */
export interface CreatePaymentMethodRequest {
  name: string;
  alias?: string;
  methodType?: string;
  isActive?: boolean;
  accounts?: Array<{
    accountNumber: string;
    accountType: AccountType;
    currency: Currency;
    holderName: string;
    isActive?: boolean;
  }>;
}

/**
 * Update Payment Method Request
 */
export interface UpdatePaymentMethodRequest {
  name?: string;
  alias?: string;
  methodType?: string;
  isActive?: boolean;
}

/**
 * Create Bank Account Request
 */
export interface CreateBankAccountRequest {
  accountNumber: string;
  accountType: AccountType;
  currency: Currency;
  holderName: string;
  isActive?: boolean;
}

/**
 * Update Bank Account Request
 */
export interface UpdateBankAccountRequest {
  accountNumber?: string;
  accountType?: AccountType;
  currency?: Currency;
  holderName?: string;
  isActive?: boolean;
}
