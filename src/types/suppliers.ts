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
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
  CREDIT_NOTE = 'CREDIT_NOTE',
  DEBIT_NOTE = 'DEBIT_NOTE',
}

/**
 * Source types for Accounts Payable
 */
export enum SourceType {
  PURCHASE = 'PURCHASE',
  EXPENSE = 'EXPENSE',
  SERVICE = 'SERVICE',
  INVESTMENT = 'INVESTMENT',
  ASSET = 'ASSET',
  LOAN = 'LOAN',
  TAX = 'TAX',
  PAYROLL = 'PAYROLL',
  OTHER = 'OTHER',
}

/**
 * Payable status
 */
export enum PayableStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
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
 * ⚠️ IMPORTANTE: Las cuentas por pagar se vinculan a este nivel (razón social)
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
  accountsPayable?: AccountPayable[]; // Cuentas por pagar vinculadas a esta razón social
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
  transactionNumber: string;
  supplierId: string;
  companyId?: string;
  supplierLegalEntityId?: string;
  transactionType: TransactionType;
  amountCents: number;
  balanceAfterCents?: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  transactionDate: string;
  dueDate?: string;
  notes?: string;
  attachmentFileId?: string;
  bankName?: string;
  bankAccountNumber?: string;
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

// ============================================
// ACCOUNTS PAYABLE (CUENTAS POR PAGAR)
// ============================================

/**
 * Account Payable (Cuenta por Pagar)
 * ⚠️ IMPORTANTE: Las cuentas por pagar SIEMPRE se vinculan a SupplierLegalEntity (razón social)
 */
export interface AccountPayable {
  id: string;
  code: string; // AP-YYYY-NNNNN (auto-generado)

  // Origen
  sourceType: SourceType;
  sourceId: string;
  sourceCode?: string;

  // Proveedor (SIEMPRE a través de razón social)
  supplierId: string;
  supplierLegalEntityId: string;

  // Montos (en centavos)
  totalAmountCents: number;
  paidAmountCents: number;
  balanceCents: number;
  currency: string; // PEN, USD

  // Fechas
  issueDate: string;
  dueDate: string;
  paymentDate?: string;

  // Documento
  documentType?: string; // FACTURA, BOLETA, etc.
  documentNumber?: string;
  description?: string;

  // Estado
  status: PayableStatus;
  overdueDay: number;

  // Organización
  companyId: string;
  siteId?: string;

  // Adicional
  notes?: string;
  metadata?: Record<string, any>;

  // Auditoría
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;

  // Relaciones
  supplier?: Supplier;
  supplierLegalEntity?: SupplierLegalEntity;
  company?: {
    id: string;
    name: string;
  };
  site?: {
    id: string;
    name: string;
  };
  payments?: AccountPayablePayment[];
  schedules?: AccountPayableSchedule[];
  statusHistory?: AccountPayableStatusHistory[];
}

/**
 * Account Payable Payment (Pago de Cuenta por Pagar)
 */
export interface AccountPayablePayment {
  id: string;
  paymentNumber: string; // PAY-YYYY-NNNNN (auto-generado)
  accountPayableId: string;

  paymentDate: string;
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

  accountPayable?: AccountPayable;
}

/**
 * Account Payable Schedule (Cronograma de Pagos)
 */
export interface AccountPayableSchedule {
  id: string;
  accountPayableId: string;

  installmentNumber: number;
  dueDate: string;
  amountCents: number;
  paidAmountCents: number;
  balanceCents: number;

  isPaid: boolean;
  paymentDate?: string;

  notes?: string;

  createdAt: string;
  updatedAt: string;

  accountPayable?: AccountPayable;
}

/**
 * Account Payable Status History (Historial de Estados)
 */
export interface AccountPayableStatusHistory {
  id: string;
  accountPayableId: string;

  previousStatus?: PayableStatus;
  newStatus: PayableStatus;

  reason?: string;
  notes?: string;

  changedBy?: string;
  changedAt: string;

  accountPayable?: AccountPayable;
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
  accountsPayable?: AccountPayable[]; // Cuentas por pagar
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
  total: number;
  page: number;
  limit: number;
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
  supplierLegalEntityId?: string;
  transactionType: TransactionType;
  amountCents: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  transactionDate?: string;
  dueDate?: string;
  notes?: string;
  attachmentFilePath?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

/**
 * Update Debt Transaction Request
 */
export interface UpdateDebtTransactionRequest {
  companyId?: string;
  supplierLegalEntityId?: string;
  transactionType?: TransactionType;
  amountCents?: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  transactionDate?: string;
  dueDate?: string;
  notes?: string;
  attachmentFilePath?: string;
  bankName?: string;
  bankAccountNumber?: string;
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

// ============================================
// ACCOUNTS PAYABLE REQUEST/RESPONSE TYPES
// ============================================

/**
 * Create Account Payable Request
 */
export interface CreateAccountPayableRequest {
  sourceType: SourceType;
  sourceId: string;
  sourceCode?: string;
  supplierId: string;
  supplierLegalEntityId: string;
  totalAmountCents: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  documentType?: string;
  documentNumber?: string;
  description?: string;
  companyId: string;
  siteId?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Update Account Payable Request
 */
export interface UpdateAccountPayableRequest {
  dueDate?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Cancel Account Payable Request
 */
export interface CancelAccountPayableRequest {
  reason: string;
  notes?: string;
}

/**
 * Query Accounts Payable Parameters
 */
export interface QueryAccountsPayableParams {
  page?: number;
  limit?: number;
  companyId?: string;
  supplierId?: string;
  supplierLegalEntityId?: string;
  status?: PayableStatus | PayableStatus[];
  currency?: string;
  sourceType?: SourceType;
  dueDateFrom?: string;
  dueDateTo?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  isOverdue?: boolean;
  search?: string;
  sortBy?: 'dueDate' | 'issueDate' | 'totalAmountCents' | 'code';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Accounts Payable Response with Pagination
 */
export interface AccountsPayableResponse {
  data: AccountPayable[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Create Account Payable Payment Request
 */
export interface CreateAccountPayablePaymentRequest {
  paymentDate: string;
  amountCents: number;
  currency: string;
  paymentMethodId?: string;
  paymentMethodName: string;
  bankName?: string;
  accountNumber?: string;
  transactionReference?: string;
  exchangeRate?: number;
  notes?: string;
}

/**
 * Account Payable Payments Response
 */
export interface AccountPayablePaymentsResponse {
  data: AccountPayablePayment[];
  meta: {
    total: number;
    totalAmountCents: number;
  };
}

/**
 * Create Account Payable Schedule Request
 */
export interface CreateAccountPayableScheduleRequest {
  installmentNumber: number;
  dueDate: string;
  amountCents: number;
  notes?: string;
}

// ============================================
// ACCOUNTS PAYABLE REPORTS
// ============================================

/**
 * Report by Supplier
 */
export interface AccountPayableReportBySupplier {
  supplierId: string;
  supplierName: string;
  supplierLegalEntityId: string;
  supplierLegalName: string;
  supplierRuc: string;
  currency: string;
  status: PayableStatus;
  totalAccounts: number;
  totalAmountCents: number;
  paidAmountCents: number;
  balanceCents: number;
  pendingCount: number;
  partialCount: number;
  paidCount: number;
  overdueCount: number;
  overdueBalanceCents: number;
  avgOverdueDays: number;
  firstIssueDate: string;
  lastIssueDate: string;
  earliestDueDate: string;
  latestDueDate: string;
}

/**
 * Report by Supplier Response
 */
export interface AccountPayableReportBySupplierResponse {
  data: AccountPayableReportBySupplier[];
  meta: {
    total: number;
    totalAmountCents: number;
    totalBalanceCents: number;
  };
}

/**
 * Aging Report
 */
export interface AccountPayableAgingReport {
  asOfDate: string;
  currency: string;
  summary: {
    totalBalanceCents: number;
    totalAccounts: number;
  };
  aging: {
    current: {
      balanceCents: number;
      accounts: number;
      percentage: number;
    };
    days1to30: {
      balanceCents: number;
      accounts: number;
      percentage: number;
    };
    days31to60: {
      balanceCents: number;
      accounts: number;
      percentage: number;
    };
    days61to90: {
      balanceCents: number;
      accounts: number;
      percentage: number;
    };
    over90: {
      balanceCents: number;
      accounts: number;
      percentage: number;
    };
  };
  bySupplier: Array<{
    supplierId: string;
    supplierName: string;
    supplierLegalName: string;
    supplierRuc: string;
    totalBalanceCents: number;
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  }>;
}

/**
 * Summary Report
 */
export interface AccountPayableSummaryReport {
  period: {
    from: string;
    to: string;
  };
  currency: string;
  totals: {
    totalAccounts: number;
    totalAmountCents: number;
    paidAmountCents: number;
    balanceCents: number;
  };
  byStatus: {
    [key in PayableStatus]?: {
      count: number;
      balanceCents: number;
    };
  };
  bySourceType: {
    [key in SourceType]?: {
      count: number;
      totalAmountCents: number;
    };
  };
  topSuppliers: Array<{
    supplierId: string;
    supplierName: string;
    totalAmountCents: number;
    balanceCents: number;
    accountsCount: number;
  }>;
}

/**
 * Overdue Accounts Report
 */
export interface AccountPayableOverdueReport {
  data: Array<{
    id: string;
    code: string;
    supplier: {
      id: string;
      commercialName: string;
    };
    supplierLegalEntity: {
      legalName: string;
      ruc: string;
    };
    documentNumber: string;
    issueDate: string;
    dueDate: string;
    balanceCents: number;
    currency: string;
    overdueDay: number;
    status: PayableStatus;
  }>;
  summary: {
    totalOverdueAccounts: number;
    totalOverdueBalanceCents: number;
    avgOverdueDays: number;
  };
}

/**
 * Payment Projection Report
 */
export interface AccountPayablePaymentProjectionReport {
  period: {
    from: string;
    to: string;
  };
  currency: string;
  groupBy: 'day' | 'week' | 'month';
  projection: Array<{
    period: string;
    dueAmountCents: number;
    accountsCount: number;
    suppliers: number;
  }>;
  totals: {
    totalDueAmountCents: number;
    totalAccounts: number;
    uniqueSuppliers: number;
  };
}

/**
 * Query Reports Parameters
 */
export interface QueryAccountPayableReportsParams {
  companyId?: string;
  currency?: string;
  status?: PayableStatus | PayableStatus[];
  asOfDate?: string;
  dateFrom?: string;
  dateTo?: string;
  minOverdueDays?: number;
  groupBy?: 'day' | 'week' | 'month';
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}
