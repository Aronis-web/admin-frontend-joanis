// Accounts Receivable Types and Interfaces

/**
 * Account Receivable Status
 */
export enum AccountReceivableStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}

/**
 * Source Types for Accounts Receivable
 */
export enum AccountReceivableSourceType {
  SALE = 'SALE',
  FRANCHISE_DELIVERY = 'FRANCHISE_DELIVERY',
  CAMPAIGN_DELIVERY = 'CAMPAIGN_DELIVERY',
  SERVICE = 'SERVICE',
  RENTAL = 'RENTAL',
  COMMISSION = 'COMMISSION',
  LOAN = 'LOAN',
  INTEREST = 'INTEREST',
  OTHER = 'OTHER',
}

/**
 * Debtor Type
 */
export enum DebtorType {
  CUSTOMER = 'CUSTOMER',
  COMPANY = 'COMPANY',
  FRANCHISE = 'FRANCHISE',
  EMPLOYEE = 'EMPLOYEE',
  OTHER = 'OTHER',
}

/**
 * Collection Method
 */
export enum CollectionMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  CHECK = 'CHECK',
  CARD = 'CARD',
  DEPOSIT = 'DEPOSIT',
  OTHER = 'OTHER',
}

/**
 * Collection Schedule Status
 */
export enum CollectionScheduleStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

/**
 * Account Receivable Collection
 */
export interface AccountReceivableCollection {
  id: string;
  collectionNumber: string;
  accountReceivableId: string;
  collectionDate: string;
  amountCents: number;
  currency: string;
  exchangeRate?: number;
  paymentMethodId?: string;
  paymentMethodName: string;
  bankName?: string;
  accountNumber?: string;
  transactionReference?: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdBy?: string;
  createdAt: string;
  deletedAt?: string;
}

/**
 * Account Receivable Status History
 */
export interface AccountReceivableStatusHistory {
  id: string;
  accountReceivableId: string;
  previousStatus: AccountReceivableStatus | null;
  newStatus: AccountReceivableStatus;
  reason?: string;
  notes?: string;
  changedBy?: string;
  changedAt: string;
}

/**
 * Collection Schedule Item
 */
export interface AccountReceivableSchedule {
  id: string;
  accountReceivableId: string;
  installmentNumber: number;
  dueDate: string;
  amountCents: number;
  currency: string;
  status: CollectionScheduleStatus;
  paidAmountCents: number;
  paidDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Debtor (simplified)
 */
export interface AccountReceivableDebtor {
  id: string;
  name: string;
  type: DebtorType;
  taxId?: string;
  email?: string;
  phone?: string;
}

/**
 * Company (simplified)
 */
export interface AccountReceivableCompany {
  id: string;
  name: string;
  code?: string;
}

/**
 * Site (simplified)
 */
export interface AccountReceivableSite {
  id: string;
  name: string;
  code?: string;
}

/**
 * Main Account Receivable Interface
 */
export interface AccountReceivable {
  id: string;
  code: string;
  sourceType: AccountReceivableSourceType;
  sourceId: string;
  sourceCode?: string;
  debtorType: DebtorType;
  debtorId: string;
  debtorName: string;
  debtorTaxId?: string;
  debtorEmail?: string;
  debtorPhone?: string;
  currency: string;
  totalAmountCents: number;
  collectedAmountCents: number;
  balanceCents: number;
  issueDate: string;
  dueDate: string;
  collectionDate?: string;
  status: AccountReceivableStatus;
  collectionPercentage: number;
  overdueDays: number;
  creditDays: number;
  documentType?: string;
  documentSeries?: string;
  documentNumber?: string;
  description?: string;
  notes?: string;
  metadata?: Record<string, any>;
  companyOwnerId: string;
  siteId?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;

  // Relations (optional, included with includeDetails)
  debtor?: AccountReceivableDebtor;
  company?: AccountReceivableCompany;
  site?: AccountReceivableSite;
  collections?: AccountReceivableCollection[];
  statusHistory?: AccountReceivableStatusHistory[];
  schedule?: AccountReceivableSchedule[];
}

/**
 * Summary by Currency
 */
export interface SummaryByCurrency {
  totalAmount: number;
  balanceAmount: number;
  collectedAmount: number;
  count: number;
}

/**
 * Summary by Status
 */
export interface SummaryByStatus {
  totalAmount: number;
  balanceAmount: number;
  count: number;
}

/**
 * Summary Totals
 */
export interface SummaryTotals {
  totalAmount: number;
  balanceAmount: number;
  collectedAmount: number;
  count: number;
}

/**
 * Accounts Receivable Summary
 */
export interface AccountsReceivableSummary {
  byCurrency: Record<string, SummaryByCurrency>;
  byStatus: Record<string, SummaryByStatus>;
  totals: SummaryTotals;
}

/**
 * Metadata for intelligent search
 */
export interface AccountsReceivableMetadata {
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  filters: {
    search?: string;
    status?: AccountReceivableStatus[];
    currency?: string[];
    debtorType?: DebtorType;
    overdue?: boolean;
  };
}

/**
 * Accounts Receivable Response
 */
export interface AccountsReceivableResponse {
  data: AccountReceivable[];
  total: number;
  summary?: AccountsReceivableSummary;
  metadata?: AccountsReceivableMetadata;
}

/**
 * Query Parameters for Accounts Receivable
 */
export interface QueryAccountsReceivableParams {
  // Pagination
  page?: number;
  limit?: number;

  // Search
  search?: string;

  // Filters
  statuses?: string; // Comma-separated: "PENDING,OVERDUE"
  currencies?: string; // Comma-separated: "PEN,USD"
  companyOwnerId?: string;
  siteId?: string;
  debtorId?: string;
  debtorType?: DebtorType;
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
  sortBy?: string; // dueDate, issueDate, totalAmountCents, balanceCents, status, code, createdAt, overdueDays
  sortOrder?: 'ASC' | 'DESC';

  // Include details
  includeDetails?: boolean;
  includeCollections?: boolean;
  includeStatusHistory?: boolean;
  includeSchedule?: boolean;
}

/**
 * Create Account Receivable Request
 */
export interface CreateAccountReceivableRequest {
  sourceType: AccountReceivableSourceType;
  sourceId: string;
  sourceCode?: string;
  debtorType: DebtorType;
  debtorId: string;
  debtorName: string;
  debtorTaxId?: string;
  debtorEmail?: string;
  debtorPhone?: string;
  currency: string;
  totalAmountCents: number;
  issueDate: string;
  dueDate: string;
  creditDays?: number;
  documentType?: string;
  documentSeries?: string;
  documentNumber?: string;
  description?: string;
  notes?: string;
  metadata?: Record<string, any>;
  companyOwnerId: string;
  siteId?: string;
}

/**
 * Update Account Receivable Request
 */
export interface UpdateAccountReceivableRequest {
  debtorName?: string;
  debtorTaxId?: string;
  debtorEmail?: string;
  debtorPhone?: string;
  dueDate?: string;
  creditDays?: number;
  documentType?: string;
  documentSeries?: string;
  documentNumber?: string;
  description?: string;
  notes?: string;
  metadata?: Record<string, any>;
  status?: AccountReceivableStatus;
}
