// Accounts Payable Types and Interfaces

/**
 * Account Payable Status
 */
export enum AccountPayableStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}

/**
 * Source Types for Accounts Payable
 */
export enum AccountPayableSourceType {
  PURCHASE = 'PURCHASE',
  EXPENSE = 'EXPENSE',
  SERVICE_CONTRACT = 'SERVICE_CONTRACT',
  UTILITY_BILL = 'UTILITY_BILL',
  INVESTMENT = 'INVESTMENT',
  ASSET_PURCHASE = 'ASSET_PURCHASE',
  LOAN = 'LOAN',
  LEASE = 'LEASE',
  TAX_OBLIGATION = 'TAX_OBLIGATION',
  PAYROLL = 'PAYROLL',
  INSURANCE = 'INSURANCE',
  LICENSE = 'LICENSE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  MAINTENANCE = 'MAINTENANCE',
  MARKETING = 'MARKETING',
  PROFESSIONAL_FEES = 'PROFESSIONAL_FEES',
  OTHER = 'OTHER',
}

/**
 * Payment Method
 */
export enum PaymentMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  CHECK = 'CHECK',
  CARD = 'CARD',
  DEPOSIT = 'DEPOSIT',
  OTHER = 'OTHER',
}

/**
 * Payment Schedule Status
 */
export enum PaymentScheduleStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

/**
 * Supplier Type (from suppliers module)
 */
export enum SupplierType {
  MERCHANDISE = 'MERCHANDISE',
  SERVICES = 'SERVICES',
  UTILITIES = 'UTILITIES',
  TRANSPORT = 'TRANSPORT',
  MAINTENANCE = 'MAINTENANCE',
  PROFESSIONAL = 'PROFESSIONAL',
  SUPPLIES = 'SUPPLIES',
  TECHNOLOGY = 'TECHNOLOGY',
  MARKETING = 'MARKETING',
  OTHER = 'OTHER',
}

/**
 * Account Payable Payment
 */
export interface AccountPayablePayment {
  id: string;
  accountPayableId: string;
  amountCents: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Account Payable Status History
 */
export interface AccountPayableStatusHistory {
  id: string;
  accountPayableId: string;
  previousStatus: AccountPayableStatus | null;
  newStatus: AccountPayableStatus;
  reason?: string;
  changedBy: string;
  changedAt: string;
}

/**
 * Payment Schedule Item
 */
export interface PaymentScheduleItem {
  id: string;
  accountPayableId: string;
  installmentNumber: number;
  dueDate: string;
  amountCents: number;
  status: PaymentScheduleStatus;
  paidAmountCents?: number;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Supplier Contact (simplified)
 */
export interface SupplierContact {
  id: string;
  name: string;
  position?: string;
  email?: string;
  phone?: string;
}

/**
 * Supplier Type Info
 */
export interface SupplierTypeInfo {
  typeKey: SupplierType;
  typeName: string;
}

/**
 * Supplier (simplified for accounts payable)
 */
export interface AccountPayableSupplier {
  id: string;
  commercialName: string;
  primaryType?: SupplierType;
  contacts?: SupplierContact[];
  types?: SupplierTypeInfo[];
}

/**
 * Company (simplified)
 */
export interface AccountPayableCompany {
  id: string;
  name: string;
  code?: string;
}

/**
 * Site (simplified)
 */
export interface AccountPayableSite {
  id: string;
  name: string;
  code?: string;
}

/**
 * Supplier Legal Entity (simplified)
 */
export interface AccountPayableSupplierLegalEntity {
  id: string;
  legalName: string;
  ruc?: string;
  taxId?: string;
}

/**
 * Main Account Payable Interface
 */
export interface AccountPayable {
  id: string;
  code: string;
  sourceType: AccountPayableSourceType;
  sourceId?: string;
  sourceCode?: string;
  supplierId: string;
  supplierLegalEntityId?: string;
  supplierName: string;
  legalEntityName?: string;
  taxId?: string;
  currency: string;
  totalAmountCents: number;
  paidAmountCents: number;
  remainingAmountCents: number;
  taxAmountCents?: number;
  issueDate: string;
  dueDate: string;
  paymentDate?: string;
  status: AccountPayableStatus;
  paymentPercentage: number;
  overdueDays: number;
  documentType?: string;
  documentNumber?: string;
  documentDate?: string;
  documentUrl?: string;
  description?: string;
  notes?: string;
  metadata?: Record<string, any>;
  companyId: string;
  siteId?: string;
  requiresApproval: boolean;
  approvalStatus?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;

  // Relations (optional, included with includeDetails)
  supplier?: AccountPayableSupplier;
  supplierLegalEntity?: AccountPayableSupplierLegalEntity;
  company?: AccountPayableCompany;
  site?: AccountPayableSite;
  payments?: AccountPayablePayment[];
  statusHistory?: AccountPayableStatusHistory[];
  paymentSchedule?: PaymentScheduleItem[];
}

/**
 * Summary by Currency
 */
export interface SummaryByCurrency {
  totalAmount: number;
  remainingAmount: number;
  paidAmount: number;
  count: number;
}

/**
 * Summary by Status
 */
export interface SummaryByStatus {
  totalAmount: number;
  remainingAmount: number;
  count: number;
}

/**
 * Summary Totals
 */
export interface SummaryTotals {
  totalAmount: number;
  remainingAmount: number;
  paidAmount: number;
  count: number;
}

/**
 * Accounts Payable Summary
 */
export interface AccountsPayableSummary {
  byCurrency: Record<string, SummaryByCurrency>;
  byStatus: Record<string, SummaryByStatus>;
  totals: SummaryTotals;
}

/**
 * Metadata for intelligent search
 */
export interface AccountsPayableMetadata {
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  filters: {
    search?: string;
    status?: AccountPayableStatus[];
    currency?: string[];
    supplierPrimaryType?: SupplierType;
    supplierTypes?: SupplierType[];
    overdue?: boolean;
  };
}

/**
 * Accounts Payable Response
 */
export interface AccountsPayableResponse {
  data: AccountPayable[];
  total: number;
  summary?: AccountsPayableSummary;
  metadata?: AccountsPayableMetadata;
}

/**
 * Query Parameters for Accounts Payable
 */
export interface QueryAccountsPayableParams {
  // Pagination
  page?: number;
  limit?: number;

  // Search
  search?: string;

  // Filters
  statuses?: string; // Comma-separated: "PENDING,OVERDUE"
  currencies?: string; // Comma-separated: "PEN,USD"
  companyId?: string;
  siteId?: string;
  supplierId?: string;
  supplierLegalEntityId?: string;
  supplierPrimaryType?: SupplierType;
  supplierTypes?: string; // Comma-separated
  sourceTypes?: string; // Comma-separated
  overdue?: boolean;

  // Date filters
  dueDateFrom?: string; // YYYY-MM-DD
  dueDateTo?: string; // YYYY-MM-DD
  issueDateFrom?: string; // YYYY-MM-DD
  issueDateTo?: string; // YYYY-MM-DD

  // Amount filters (in cents)
  amountFrom?: number;
  amountTo?: number;

  // Sorting
  sortBy?: string; // dueDate, issueDate, totalAmountCents, remainingAmountCents, status, code, createdAt, overdueDays
  sortOrder?: 'ASC' | 'DESC';

  // Include details
  includeDetails?: boolean;
  includePayments?: boolean;
  includeStatusHistory?: boolean;
  includeSchedule?: boolean;
}

/**
 * Create Account Payable Request
 */
export interface CreateAccountPayableRequest {
  sourceType: AccountPayableSourceType;
  sourceId?: string;
  supplierId: string;
  supplierLegalEntityId?: string;
  currency: string;
  totalAmountCents: number;
  taxAmountCents?: number;
  issueDate: string;
  dueDate: string;
  documentType?: string;
  documentNumber?: string;
  documentDate?: string;
  documentUrl?: string;
  description?: string;
  notes?: string;
  metadata?: Record<string, any>;
  companyId: string;
  siteId?: string;
  requiresApproval?: boolean;
}

/**
 * Update Account Payable Request
 */
export interface UpdateAccountPayableRequest {
  supplierId?: string;
  supplierLegalEntityId?: string;
  currency?: string;
  totalAmountCents?: number;
  taxAmountCents?: number;
  issueDate?: string;
  dueDate?: string;
  documentType?: string;
  documentNumber?: string;
  documentDate?: string;
  documentUrl?: string;
  description?: string;
  notes?: string;
  metadata?: Record<string, any>;
  status?: AccountPayableStatus;
}
