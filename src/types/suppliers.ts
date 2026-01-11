// Supplier Types and Interfaces

/**
 * Location accuracy levels
 */
export enum LocationAccuracy {
  EXACT = 'EXACT',
  APPROXIMATE = 'APPROXIMATE',
  CITY = 'CITY',
  REGION = 'REGION',
}

/**
 * Location source types
 */
export enum LocationSource {
  GPS = 'GPS',
  MANUAL = 'MANUAL',
  GEOCODING = 'GEOCODING',
  ADDRESS = 'ADDRESS',
}

/**
 * Bank account types
 */
export enum BankAccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  INTERBANK = 'INTERBANK',
}

/**
 * Transaction types for debts
 */
export enum TransactionType {
  PURCHASE = 'PURCHASE',
  ADJUSTMENT = 'ADJUSTMENT',
  CREDIT_NOTE = 'CREDIT_NOTE',
  DEBIT_NOTE = 'DEBIT_NOTE',
}

/**
 * Payment status
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
}

/**
 * Supplier Legal Entity (Razón Social)
 */
export interface SupplierLegalEntity {
  id: string;
  supplierId: string;
  legalName: string;
  ruc: string;
  taxAddress: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Supplier Contact
 */
export interface SupplierContact {
  id: string;
  supplierId: string;
  fullName: string;
  position?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Supplier Bank Account
 */
export interface SupplierBankAccount {
  id: string;
  supplierId: string;
  supplierLegalEntityId: string;
  bankName: string;
  accountNumber: string;
  accountType: BankAccountType;
  cci?: string;
  accountHolderName: string;
  accountHolderRuc: string;
  isPreferred: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  legalEntity?: SupplierLegalEntity;
}

/**
 * Payment Method
 */
export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  requiresBankAccount: boolean;
  requiresReference: boolean;
  requiresApproval: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Supplier Company Debt
 */
export interface SupplierCompanyDebt {
  supplierId: string;
  companyId: string;
  supplierLegalEntityId: string;
  totalDebtCents: number;
  lastPurchaseDate?: string;
  lastPaymentDate?: string;
  createdAt: string;
  updatedAt: string;
  company?: {
    id: string;
    name: string;
    ruc?: string;
  };
  legalEntity?: SupplierLegalEntity;
}

/**
 * Supplier Unassigned Balance
 */
export interface SupplierUnassignedBalance {
  supplierId: string;
  unassignedBalanceCents: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Supplier Debt Transaction
 */
export interface SupplierDebtTransaction {
  id: string;
  supplierId: string;
  companyId?: string;
  supplierLegalEntityId: string;
  transactionType: TransactionType;
  amountCents: number;
  referenceNumber?: string;
  transactionDate: string;
  dueDate?: string;
  notes?: string;
  createdById: string;
  assignedById?: string;
  assignedAt?: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
  company?: {
    id: string;
    name: string;
    ruc?: string;
  };
  legalEntity?: SupplierLegalEntity;
  createdBy?: {
    id: string;
    name?: string;
    email: string;
  };
}

/**
 * Supplier Payment
 */
export interface SupplierPayment {
  id: string;
  supplierId: string;
  companyId?: string;
  supplierLegalEntityId: string;
  amountCents: number;
  paymentMethodId: string;
  supplierBankAccountId?: string;
  transactionReference?: string;
  paymentDate: string;
  status: PaymentStatus;
  notes?: string;
  createdById: string;
  approvedById?: string;
  approvedAt?: string;
  assignedById?: string;
  assignedAt?: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
  company?: {
    id: string;
    name: string;
    ruc?: string;
  };
  legalEntity?: SupplierLegalEntity;
  paymentMethod?: PaymentMethod;
  bankAccount?: SupplierBankAccount;
  createdBy?: {
    id: string;
    name?: string;
    email: string;
  };
}

/**
 * Main Supplier Entity
 */
export interface Supplier {
  id: string;
  code: string;
  commercialName: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  district?: string;
  province?: string;
  department?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: LocationAccuracy;
  locationSource?: LocationSource;
  paymentTermsDays?: number;
  creditLimitCents?: number;
  notes?: string;
  isActive: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  legalEntities?: SupplierLegalEntity[];
  contacts?: SupplierContact[];
  bankAccounts?: SupplierBankAccount[];
  companyDebts?: SupplierCompanyDebt[];
  unassignedBalance?: SupplierUnassignedBalance;
}

// ============================================
// Request/Response Types
// ============================================

/**
 * Create Supplier Legal Entity DTO
 */
export interface CreateSupplierLegalEntityDto {
  legalName: string;
  ruc: string;
  taxAddress: string;
  isPrimary: boolean;
}

/**
 * Create Supplier Contact DTO
 */
export interface CreateSupplierContactDto {
  fullName: string;
  position?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

/**
 * Create Supplier Request
 */
export interface CreateSupplierRequest {
  code: string;
  commercialName: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  district?: string;
  province?: string;
  department?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: LocationAccuracy;
  locationSource?: LocationSource;
  paymentTermsDays?: number;
  creditLimitCents?: number;
  notes?: string;
  isActive?: boolean;
  legalEntities?: CreateSupplierLegalEntityDto[];
  contacts?: CreateSupplierContactDto[];
}

/**
 * Update Supplier Request
 */
export interface UpdateSupplierRequest {
  code?: string;
  commercialName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  district?: string;
  province?: string;
  department?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: LocationAccuracy;
  locationSource?: LocationSource;
  paymentTermsDays?: number;
  creditLimitCents?: number;
  notes?: string;
  isActive?: boolean;
}

/**
 * Query Suppliers Parameters
 */
export interface QuerySuppliersParams {
  q?: string; // Search in code, commercial name, RUC
  isActive?: boolean;
  department?: string;
  province?: string;
  district?: string;
  page?: number;
  limit?: number;
  orderBy?: 'code' | 'commercialName' | 'createdAt';
  orderDir?: 'ASC' | 'DESC';
}

/**
 * Suppliers Response with Pagination
 */
export interface SuppliersResponse {
  data: Supplier[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Create Bank Account Request
 */
export interface CreateBankAccountRequest {
  supplierLegalEntityId: string;
  bankName: string;
  accountNumber: string;
  accountType: BankAccountType;
  cci?: string;
  accountHolderName: string;
  accountHolderRuc: string;
  isPreferred?: boolean;
}

/**
 * Update Bank Account Request
 */
export interface UpdateBankAccountRequest {
  bankName?: string;
  accountNumber?: string;
  accountType?: BankAccountType;
  cci?: string;
  accountHolderName?: string;
  accountHolderRuc?: string;
  isPreferred?: boolean;
  isActive?: boolean;
}

/**
 * Update Legal Entity Request
 */
export interface UpdateLegalEntityRequest {
  legalName?: string;
  ruc?: string;
  taxAddress?: string;
  isPrimary?: boolean;
}

/**
 * Update Contact Request
 */
export interface UpdateContactRequest {
  fullName?: string;
  position?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

/**
 * Create Debt Transaction Request
 */
export interface CreateDebtTransactionRequest {
  companyId?: string;
  supplierLegalEntityId: string;
  transactionType: TransactionType;
  amountCents: number;
  referenceNumber?: string;
  transactionDate: string;
  dueDate?: string;
  notes?: string;
}

/**
 * Assign Company Request
 */
export interface AssignCompanyRequest {
  companyId: string;
}

/**
 * Create Payment Request
 */
export interface CreatePaymentRequest {
  companyId?: string;
  supplierLegalEntityId: string;
  amountCents: number;
  paymentMethodId: string;
  supplierBankAccountId?: string;
  transactionReference?: string;
  paymentDate: string;
  notes?: string;
}

/**
 * Debt Summary by Company
 */
export interface DebtByCompany {
  companyId: string;
  companyName: string;
  legalEntity: {
    id: string;
    legalName: string;
    ruc: string;
  };
  totalDebtCents: number;
  lastPurchaseDate?: string;
  lastPaymentDate?: string;
}

/**
 * Supplier Debt Summary Response
 */
export interface SupplierDebtSummaryResponse {
  supplierId: string;
  commercialName: string;
  totalDebtAllCompaniesCents: number;
  unassignedBalanceCents: number;
  totalBalanceCents: number;
  debtByCompany: DebtByCompany[];
}

/**
 * Create Payment Method Request
 */
export interface CreatePaymentMethodRequest {
  code: string;
  name: string;
  requiresBankAccount?: boolean;
  requiresReference?: boolean;
  requiresApproval?: boolean;
  isActive?: boolean;
}

/**
 * Update Payment Method Request
 */
export interface UpdatePaymentMethodRequest {
  code?: string;
  name?: string;
  requiresBankAccount?: boolean;
  requiresReference?: boolean;
  requiresApproval?: boolean;
  isActive?: boolean;
}

/**
 * Query Transactions Parameters
 */
export interface QueryTransactionsParams {
  companyId?: string;
  supplierLegalEntityId?: string;
  transactionType?: TransactionType;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * Query Payments Parameters
 */
export interface QueryPaymentsParams {
  companyId?: string;
  supplierLegalEntityId?: string;
  paymentMethodId?: string;
  status?: PaymentStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * Transactions Response with Pagination
 */
export interface TransactionsResponse {
  data: SupplierDebtTransaction[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Payments Response with Pagination
 */
export interface PaymentsResponse {
  data: SupplierPayment[];
  total: number;
  page: number;
  limit: number;
}
