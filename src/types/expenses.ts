// Expense Types and Interfaces

/**
 * Expense Status - New Backend Structure
 */
export enum ExpenseStatus {
  ACTIVE = 'ACTIVE',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  OVERDUE = 'OVERDUE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
}

/**
 * Recurrence Type - Backend expects REGULAR or CUSTOM
 */
export enum RecurrenceType {
  REGULAR = 'REGULAR',
  CUSTOM = 'CUSTOM',
}

/**
 * Expense Type
 */
export enum ExpenseType {
  UNIQUE = 'UNIQUE',
  RECURRENT = 'RECURRENT',
  SEMI_RECURRENT = 'SEMI_RECURRENT',
}

/**
 * Template Expense Type - Distinguishes between recurring and semi-recurring templates
 */
export enum TemplateExpenseType {
  RECURRENT = 'RECURRENT', // Generates multiple times according to frequency
  SEMI_RECURRENT = 'SEMI_RECURRENT', // Generates once and then deactivates
}

/**
 * Template Frequency
 */
export enum TemplateFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

/**
 * Confidence Level for Projections
 */
export enum ConfidenceLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/**
 * Payment Method
 */
export enum PaymentMethod {
  BCP = 'BCP',
  BBVA = 'BBVA',
  INTERBANK = 'INTERBANK',
  CASH = 'CASH',
  OTHER = 'OTHER',
}

/**
 * Payment Status
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * Payment Completion Status
 */
export enum PaymentCompletionStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  FULLY_PAID = 'FULLY_PAID',
  OVERPAID = 'OVERPAID',
}

/**
 * Amount Reconciliation Status
 */
export enum AmountReconciliationStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  UNDERPAID = 'UNDERPAID',
  OVERPAID = 'OVERPAID',
  ADJUSTED = 'ADJUSTED',
}

/**
 * Project Status
 */
export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// ============================================
// Entity Interfaces - New Backend Structure
// ============================================

/**
 * Expense Category - New Backend Structure
 */
export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Expense - New Backend Structure
 */
export interface Expense {
  id: string;
  code: string;
  name: string;
  description?: string;
  companyId: string;
  siteId?: string;
  site?: {
    id: string;
    code: string;
    name: string;
  };
  categoryId?: string;
  projectId?: string;
  project?: {
    id: string;
    name: string;
    code: string;
  };
  templateId?: string;
  expenseType?: 'RECURRENT' | 'ONE_TIME';
  costType?: 'FIXED' | 'VARIABLE';
  amountCents?: number;
  currency?: string;
  dueDate?: string;
  status?: ExpenseStatus;
  paidAt?: string;
  paidAmountCents?: number;
  overdueDays?: number;
  expenseDate?: string;
  notes?: string;
  category?: ExpenseCategory;
  template?: ExpenseTemplate;
  purchase?: {
    id: string;
    code: string;
    supplier?: string;
  };
  // Payment reconciliation fields
  estimatedAmountCents?: number;
  actualAmountCents?: number;
  amountDifferenceCents?: number;
  amountReconciliationStatus?: AmountReconciliationStatus;
  reconciliationNotes?: string;
  reconciledAt?: string;
  reconciledBy?: string;
  totalPaidCents?: number;
  remainingAmountCents?: number;
  paymentPercentage?: number;
  paymentStatus?: PaymentCompletionStatus;
  paymentsCount?: number;
  lastPaymentAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Expense Template - New Backend Structure
 */
export interface ExpenseTemplate {
  id: string;
  code: string;
  name: string;
  description?: string;
  companyId: string;
  siteId?: string;
  site?: {
    id: string;
    code: string;
    name: string;
  };
  categoryId?: string;
  category?: ExpenseCategory;
  projectId?: string;
  project?: {
    id: string;
    name: string;
    [key: string]: any;
  };
  supplierId?: string;
  supplier?: {
    id: string;
    name: string;
    [key: string]: any;
  };
  company?: {
    id: string;
    name: string;
    [key: string]: any;
  };
  amountCents?: number;
  currency?: string;
  templateExpenseType: TemplateExpenseType; // REQUIRED: RECURRENT or SEMI_RECURRENT
  recurrenceType: RecurrenceType;
  frequency: TemplateFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  customPattern?: Record<string, any> | null;
  startDate: string;
  endDate?: string | null;
  occurrences?: number | null;
  isActive: boolean;
  lastGeneratedDate?: string | null; // Backend uses lastGeneratedDate
  nextGenerationDate?: string | null;
  totalGenerated?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/**
 * Expense Projection - New Backend Structure
 */
export interface ExpenseProjection {
  id: string;
  expenseId: string;
  expense?: Expense;
  projectedAmount: number;
  currency: string;
  projectionDate: string;
  confidenceLevel: ConfidenceLevel;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Expense Project - Kept for compatibility
 */
export interface ExpenseProject {
  id: string;
  companyId: string;
  siteId?: string;
  code: string;
  name: string;
  description?: string;
  budgetCents: number;
  spentCents: number;
  startDate: string;
  endDate?: string;
  status: ProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  site?: {
    id: string;
    code: string;
    name: string;
  };
  createdByUser?: {
    id: string;
    name?: string;
    email: string;
  };
  closedByUser?: {
    id: string;
    name?: string;
    email: string;
  };
  expenses?: Expense[];
}

/**
 * Expense Payment - Kept for compatibility
 */
export interface PaymentAttachment {
  id: string;
  fileId: string;
  fileName: string;
  fileType: 'RECEIPT' | 'INVOICE' | 'OTHER';
  description?: string;
  url?: string;
  mimeType?: string;
  createdAt: string;
}

export interface ExpensePayment {
  id: string;
  expenseId?: string;
  code: string;
  amountCents: number | string; // Backend puede enviar string o number
  paymentMethod: PaymentMethod;
  bankName?: string;
  accountNumber?: string;
  transactionReference?: string;
  paymentDate: string;
  status: PaymentStatus;
  notes?: string;
  receiptUrl?: string;
  attachmentFileId?: string; // ID del archivo adjunto (legacy)
  attachmentFile?: {
    id: string;
    fileName: string;
    fileType: string;
    url: string;
    mimeType?: string;
  };
  attachments?: PaymentAttachment[]; // Nuevo formato: array de archivos adjuntos
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  createdByUser?: {
    id: string;
    name?: string;
    email: string;
  };
  approvedByUser?: {
    id: string;
    name?: string;
    email: string;
  };
  rejectedByUser?: {
    id: string;
    name?: string;
    email: string;
  };
}

// ============================================
// Request/Response Types - New Backend Structure
// ============================================

/**
 * Create Expense Request - New Backend Structure
 * Note: paymentMethod is NO LONGER part of expense creation.
 * Payment methods are now registered when creating payments, not expenses.
 */
export interface CreateExpenseRequest {
  name: string;
  companyId: string;
  siteId: string; // Required field
  amountCents: number;
  currency?: string;
  dueDate: string;
  expenseType: 'UNIQUE' | 'RECURRENT' | 'SEMI_RECURRENT';
  costType: 'FIXED' | 'VARIABLE';
  // Note: status is set automatically by backend (ACTIVE by default)
  categoryId?: string;
  projectId?: string; // Associate with project
  templateId?: string;
  purchaseId?: string;
  supplierId?: string; // Supplier association
  notes?: string;
  description?: string;
  // Invoice fields
  isInvoiced?: boolean;
  invoiceNumber?: string;
  invoiceDate?: string;
  taxAmountCents?: number;
}

/**
 * Update Expense Request - New Backend Structure
 * Note: paymentMethod is NO LONGER part of expense updates.
 * Payment methods are registered when creating payments, not expenses.
 */
export interface UpdateExpenseRequest {
  name?: string;
  amountCents?: number;
  currency?: string;
  dueDate?: string;
  expenseType?: 'UNIQUE' | 'RECURRENT' | 'SEMI_RECURRENT';
  costType?: 'FIXED' | 'VARIABLE';
  categoryId?: string;
  templateId?: string;
  purchaseId?: string;
  notes?: string;
  description?: string;
}

/**
 * Change Status Request
 */
export interface ChangeStatusRequest {
  status: ExpenseStatus;
}

/**
 * Associate Purchase Request
 */
export interface AssociatePurchaseRequest {
  purchaseId: string;
}

/**
 * Create Expense Template Request - Backend Structure
 * Note: Backend expects Date instances but JSON can only send strings
 * The backend validation is incorrect - it should use @IsDateString() instead of @IsDate()
 * We send ISO date strings which the backend should parse
 */
export interface CreateExpenseTemplateRequest {
  code: string;
  companyId: string;
  siteId: string; // Required - sede must be selected manually
  categoryId: string; // Required - must be UUID
  projectId?: string;
  supplierId?: string;
  name: string;
  description?: string;
  templateExpenseType: TemplateExpenseType; // REQUIRED: RECURRENT or SEMI_RECURRENT
  amountCents?: number;
  currency?: string;
  recurrenceType: RecurrenceType; // REGULAR or CUSTOM
  frequency?: TemplateFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  customPattern?: Record<string, any>;
  startDate: string; // ISO date string - backend should parse this
  endDate?: string; // ISO date string - backend should parse this
  occurrences?: number;
  isActive?: boolean;
  createdBy: string;
}

/**
 * Update Expense Template Request - New Backend Structure
 */
export interface UpdateExpenseTemplateRequest {
  code?: string;
  categoryId?: string;
  projectId?: string;
  supplierId?: string;
  name?: string;
  description?: string;
  templateExpenseType?: TemplateExpenseType;
  baseAmount?: number;
  currency?: string;
  recurrenceType?: RecurrenceType;
  frequency?: TemplateFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  customPattern?: Record<string, any>;
  startDate?: string;
  endDate?: string;
  occurrences?: number;
  isActive?: boolean;
}

/**
 * Create Expense Projection Request - New Backend Structure
 */
export interface CreateExpenseProjectionRequest {
  expenseId: string;
  projectedAmount: number;
  currency?: string;
  projectionDate: string;
  confidenceLevel: ConfidenceLevel;
  notes?: string;
}

/**
 * Update Expense Projection Request - New Backend Structure
 */
export interface UpdateExpenseProjectionRequest {
  projectedAmount?: number;
  currency?: string;
  projectionDate?: string;
  confidenceLevel?: ConfidenceLevel;
  notes?: string;
}

/**
 * Generate Projections Request
 */
export interface GenerateProjectionsRequest {
  monthsAhead: number;
}

/**
 * Query Expenses Parameters - New Backend Structure
 */
export interface QueryExpensesParams {
  startDate?: string;
  endDate?: string;
  status?: ExpenseStatus;
  categoryId?: string;
  templateId?: string;
  purchaseId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  relations?: string[]; // Include relations like 'site', 'project', 'category', etc.
}

/**
 * Query Expense Templates Parameters
 */
export interface QueryExpenseTemplatesParams {
  categoryId?: string;
  includeInactive?: boolean; // true = show all, false/undefined = active only
  templateExpenseType?: TemplateExpenseType;
  frequency?: TemplateFrequency;
  page?: number;
  limit?: number;
}

/**
 * Query Expense Projections Parameters
 */
export interface QueryExpenseProjectionsParams {
  startDate?: string;
  endDate?: string;
  confidenceLevel?: ConfidenceLevel;
  page?: number;
  limit?: number;
}

/**
 * Period DTO for Summary
 */
export interface PeriodDto {
  startDate: string;
  endDate: string;
}

/**
 * Category Summary Item
 */
export interface CategorySummaryItem {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  count: number;
}

/**
 * Category Summary Response
 */
export interface CategorySummaryResponse {
  startDate: string;
  endDate: string;
  summaries: CategorySummaryItem[];
}

/**
 * Comparison Result for Projections vs Real
 */
export interface ComparisonResult {
  projectionDate: string;
  projectedAmount: number;
  actualAmount: number;
  difference: number;
  differencePercentage: number;
}

/**
 * Paginated Result - Generic
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Expenses Response with Pagination
 */
export type ExpensesResponse = PaginatedResult<Expense>;

/**
 * Expense Templates Response with Pagination
 */
export type ExpenseTemplatesResponse = PaginatedResult<ExpenseTemplate>;

/**
 * Expense Projections Response with Pagination
 */
export type ExpenseProjectionsResponse = PaginatedResult<ExpenseProjection>;

/**
 * Expense Categories Response
 */
export interface ExpenseCategoriesResponse {
  data: ExpenseCategory[];
  meta?: {
    total: number;
  };
}

/**
 * Expense Projects Response with Pagination
 */
export type ExpenseProjectsResponse = PaginatedResult<ExpenseProject>;

/**
 * Create Expense Category Request
 */
export interface CreateExpenseCategoryRequest {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

/**
 * Update Expense Category Request
 */
export interface UpdateExpenseCategoryRequest {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive?: boolean;
}

/**
 * Create Expense Project Request
 */
export interface CreateExpenseProjectRequest {
  companyId: string;
  siteId?: string;
  name: string;
  description?: string;
  budgetCents: number;
  currency?: string;
  startDate: string;
  endDate?: string;
  status?: ProjectStatus;
}

/**
 * Update Expense Project Request
 */
export interface UpdateExpenseProjectRequest {
  siteId?: string;
  name?: string;
  description?: string;
  budgetCents?: number;
  startDate?: string;
  endDate?: string;
  status?: ProjectStatus;
}

/**
 * Create Expense Payment Request
 */
export interface CreateExpensePaymentRequest {
  amountCents: number;
  currency?: string;
  paymentMethod: PaymentMethod;
  bankName?: string;
  accountNumber?: string;
  transactionReference?: string;
  paymentDate: string;
  notes?: string;
  receiptUrl?: string;
}

/**
 * Partial Payment Request
 */
export interface PartialPaymentRequest {
  amountCents: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  transactionReference?: string;
  notes?: string;
}

/**
 * Reconcile Amount Request
 */
export interface ReconcileAmountRequest {
  actualAmountCents: number;
  notes?: string;
}

/**
 * Payment Status Response
 */
export interface PaymentStatusResponse {
  expense_id: string;
  expense_code: string;
  expense_name: string;
  estimated_amount: number;
  actual_amount: number;
  target_amount: number;
  total_paid: number;
  remaining_amount: number;
  payment_percentage: number;
  payment_status: PaymentCompletionStatus;
  reconciliation_status: AmountReconciliationStatus;
  is_fully_paid: boolean;
  needs_more_payment: boolean;
  status_message: string;
  using_actual_amount: boolean;
}

/**
 * Payment Completion Report Item
 */
export interface PaymentCompletionReportItem {
  id: string;
  code: string;
  name: string;
  estimated_amount: number;
  actual_amount: number;
  target_amount: number;
  total_paid: number;
  remaining_amount: number;
  payment_percentage: number;
  payment_status: PaymentCompletionStatus;
  payment_status_emoji: string;
  payment_status_message: string;
  amount_source: string;
}

/**
 * Pending Payment Report Item
 */
export interface PendingPaymentReportItem {
  id: string;
  code: string;
  name: string;
  amount_to_pay: number;
  total_paid: number;
  remaining_amount: number;
  payment_percentage: number;
  payment_status: PaymentCompletionStatus;
  due_date: string;
  priority: 'URGENTE' | 'PRONTO' | 'NORMAL';
}

/**
 * Update Expense Payment Request
 */
export interface UpdateExpensePaymentRequest {
  amountCents?: number;
  paymentMethod?: PaymentMethod;
  bankName?: string;
  accountNumber?: string;
  transactionReference?: string;
  paymentDate?: string;
  notes?: string;
  receiptUrl?: string;
}

/**
 * Query Expense Projects Parameters
 */
export interface QueryExpenseProjectsParams {
  siteId?: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ============================================
// UI Labels and Colors - New Backend Structure
// ============================================

/**
 * Expense Status Labels for UI
 */
export const ExpenseStatusLabels: Record<ExpenseStatus, string> = {
  [ExpenseStatus.ACTIVE]: 'Activo',
  [ExpenseStatus.PAID]: 'Pagado',
  [ExpenseStatus.CANCELLED]: 'Cancelado',
  [ExpenseStatus.OVERDUE]: 'Vencido',
  [ExpenseStatus.PENDING]: 'Pendiente',
  [ExpenseStatus.APPROVED]: 'Aprobado',
};

/**
 * Recurrence Type Labels for UI
 */
export const RecurrenceTypeLabels: Record<RecurrenceType, string> = {
  [RecurrenceType.REGULAR]: 'Regular',
  [RecurrenceType.CUSTOM]: 'Personalizado',
};

/**
 * Template Expense Type Labels for UI
 */
export const TemplateExpenseTypeLabels: Record<TemplateExpenseType, string> = {
  [TemplateExpenseType.RECURRENT]: 'Recurrente',
  [TemplateExpenseType.SEMI_RECURRENT]: 'Semi-Recurrente',
};

/**
 * Template Frequency Labels for UI
 */
export const TemplateFrequencyLabels: Record<TemplateFrequency, string> = {
  [TemplateFrequency.DAILY]: 'Diario',
  [TemplateFrequency.WEEKLY]: 'Semanal',
  [TemplateFrequency.MONTHLY]: 'Mensual',
  [TemplateFrequency.QUARTERLY]: 'Trimestral',
  [TemplateFrequency.YEARLY]: 'Anual',
};

/**
 * Confidence Level Labels for UI
 */
export const ConfidenceLevelLabels: Record<ConfidenceLevel, string> = {
  [ConfidenceLevel.LOW]: 'Baja',
  [ConfidenceLevel.MEDIUM]: 'Media',
  [ConfidenceLevel.HIGH]: 'Alta',
};

/**
 * Payment Method Labels for UI
 */
export const PaymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.BCP]: 'BCP',
  [PaymentMethod.BBVA]: 'BBVA',
  [PaymentMethod.INTERBANK]: 'Interbank',
  [PaymentMethod.CASH]: 'Efectivo',
  [PaymentMethod.OTHER]: 'Otro',
};

/**
 * Project Status Labels for UI
 */
export const ProjectStatusLabels: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: 'Planificación',
  [ProjectStatus.ACTIVE]: 'Activo',
  [ProjectStatus.ON_HOLD]: 'En Espera',
  [ProjectStatus.COMPLETED]: 'Completado',
  [ProjectStatus.CANCELLED]: 'Cancelado',
};

/**
 * Payment Status Labels for UI
 */
export const PaymentStatusLabels: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'Pendiente',
  [PaymentStatus.APPROVED]: 'Aprobado',
  [PaymentStatus.REJECTED]: 'Rechazado',
  [PaymentStatus.CANCELLED]: 'Cancelado',
};

/**
 * Payment Completion Status Labels for UI
 */
export const PaymentCompletionStatusLabels: Record<PaymentCompletionStatus, string> = {
  [PaymentCompletionStatus.UNPAID]: 'Sin Pagar',
  [PaymentCompletionStatus.PARTIAL]: 'Parcial',
  [PaymentCompletionStatus.FULLY_PAID]: 'Pagado',
  [PaymentCompletionStatus.OVERPAID]: 'Sobrepagado',
};

/**
 * Amount Reconciliation Status Labels for UI
 */
export const AmountReconciliationStatusLabels: Record<AmountReconciliationStatus, string> = {
  [AmountReconciliationStatus.PENDING]: 'Pendiente',
  [AmountReconciliationStatus.MATCHED]: 'Coincide',
  [AmountReconciliationStatus.UNDERPAID]: 'Falta Pago',
  [AmountReconciliationStatus.OVERPAID]: 'Sobrepagado',
  [AmountReconciliationStatus.ADJUSTED]: 'Ajustado',
};

/**
 * Expense Status Colors for UI
 */
export const ExpenseStatusColors: Record<ExpenseStatus, string> = {
  [ExpenseStatus.ACTIVE]: '#3B82F6',
  [ExpenseStatus.PAID]: '#10B981',
  [ExpenseStatus.CANCELLED]: '#EF4444',
  [ExpenseStatus.OVERDUE]: '#F59E0B',
  [ExpenseStatus.PENDING]: '#F59E0B',
  [ExpenseStatus.APPROVED]: '#3B82F6',
};

/**
 * Confidence Level Colors for UI
 */
export const ConfidenceLevelColors: Record<ConfidenceLevel, string> = {
  [ConfidenceLevel.LOW]: '#EF4444',
  [ConfidenceLevel.MEDIUM]: '#F59E0B',
  [ConfidenceLevel.HIGH]: '#10B981',
};

/**
 * Project Status Colors for UI
 */
export const ProjectStatusColors: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: '#94A3B8',
  [ProjectStatus.ACTIVE]: '#3B82F6',
  [ProjectStatus.ON_HOLD]: '#F59E0B',
  [ProjectStatus.COMPLETED]: '#10B981',
  [ProjectStatus.CANCELLED]: '#EF4444',
};

/**
 * Payment Status Colors for UI
 */
export const PaymentStatusColors: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: '#F59E0B',
  [PaymentStatus.APPROVED]: '#10B981',
  [PaymentStatus.REJECTED]: '#EF4444',
  [PaymentStatus.CANCELLED]: '#94A3B8',
};

// ============================================
// Report Types
// ============================================

/**
 * Report Type
 */
export enum ReportType {
  SUMMARY = 'SUMMARY',
  DETAILED = 'DETAILED',
  BY_CATEGORY = 'BY_CATEGORY',
  BY_PROJECT = 'BY_PROJECT',
  BY_SITE = 'BY_SITE',
  BY_SUPPLIER = 'BY_SUPPLIER',
  BY_TYPE = 'BY_TYPE',
  BY_MONTH = 'BY_MONTH',
  BY_YEAR = 'BY_YEAR',
  PROJECTIONS = 'PROJECTIONS',
}

/**
 * Projection Period
 */
export enum ProjectionPeriod {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

/**
 * Expense Summary
 */
export interface ExpenseSummary {
  totalExpenses: number;
  totalAmount: number;
  currency: string;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  averageAmount: number;
  minAmount: number;
  maxAmount: number;
}

/**
 * Report by Category
 */
export interface ReportByCategory {
  categoryId: string;
  categoryName: string;
  totalExpenses: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  percentage: number;
}

/**
 * Report by Project
 */
export interface ReportByProject {
  projectId: string;
  projectName: string;
  totalExpenses: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  percentage: number;
}

/**
 * Report by Site
 */
export interface ReportBySite {
  siteId: string;
  siteName: string;
  totalExpenses: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  percentage: number;
}

/**
 * Report by Supplier
 */
export interface ReportBySupplier {
  supplierId: string;
  supplierName: string;
  totalExpenses: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  percentage: number;
}

/**
 * Report by Month
 */
export interface ReportByMonth {
  year: number;
  month: number;
  monthName: string;
  totalExpenses: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

/**
 * Report by Year
 */
export interface ReportByYear {
  year: number;
  totalExpenses: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

/**
 * Report by Type
 */
export interface ReportByType {
  expenseType: string;
  totalExpenses: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  percentage: number;
}

// ============================================
// New Summary API Types (8 Endpoints)
// ============================================

/**
 * Currency Summary Item - Used across all summary endpoints
 */
export interface CurrencySummary {
  currency: string;
  totalAmountCents: number;
  totalAmount: number;
  expenseCount: number;
}

/**
 * Summary Filters - Common filters for summary endpoints
 */
export interface SummaryFilters {
  startDate: string;
  endDate: string;
  siteId?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
  projectId?: string | null;
  status?: string | null;
  minAmountCents?: number | null;
  maxAmountCents?: number | null;
}

/**
 * 1. Total Expenses Summary Response
 * GET /admin/expenses/summary/total
 */
export interface TotalExpensesSummaryResponse {
  byCurrency: CurrencySummary[];
  totalExpenseCount: number;
  filters: SummaryFilters;
}

/**
 * 2. Recurring Expenses Summary Response
 * GET /admin/expenses/summary/recurring
 */
export interface RecurringExpensesSummaryResponse {
  byCurrency: CurrencySummary[];
  totalExpenseCount: number;
  filters: SummaryFilters;
}

/**
 * 3. Summary by Category and Currency
 * GET /admin/expenses/summary/by-category-currency
 */
export interface CategoryCurrencySummary {
  categoryId: string;
  categoryName: string;
  byCurrency: CurrencySummary[];
  totalExpenseCount: number;
}

export interface SummaryByCategoryResponse {
  categories: CategoryCurrencySummary[];
  totalExpenseCount: number;
  filters: Partial<SummaryFilters>;
}

/**
 * 4. Summary by Site
 * GET /admin/expenses/summary/by-site
 */
export interface SiteCurrencySummary {
  siteId: string;
  siteName: string;
  byCurrency: CurrencySummary[];
  totalExpenseCount: number;
}

export interface SummaryBySiteResponse {
  sites: SiteCurrencySummary[];
  totalExpenseCount: number;
  filters: Partial<SummaryFilters>;
}

/**
 * 5. Period Comparison
 * GET /admin/expenses/summary/compare
 */
export interface PeriodComparisonCurrency {
  currency: string;
  period1AmountCents: number;
  period1Amount: number;
  period1Count: number;
  period2AmountCents: number;
  period2Amount: number;
  period2Count: number;
  differenceAmountCents: number;
  differenceAmount: number;
  differenceCount: number;
  percentageChange: number;
}

export interface PeriodComparisonResponse {
  byCurrency: PeriodComparisonCurrency[];
  period1: TotalExpensesSummaryResponse;
  period2: TotalExpensesSummaryResponse;
}

/**
 * 6. Trends Response
 * GET /admin/expenses/summary/trends
 */
export interface TrendPeriod {
  period: string;
  startDate: string;
  endDate: string;
  totalAmountCents: number;
  totalAmount: number;
  expenseCount: number;
}

export interface TrendCurrency {
  currency: string;
  periods: TrendPeriod[];
}

export interface TrendsResponse {
  byCurrency: TrendCurrency[];
  filters: {
    startDate: string;
    endDate: string;
    groupBy: 'month' | 'quarter' | 'year';
  };
}

/**
 * 7. Projections Response
 * GET /admin/expenses/summary/projections
 */
export interface ProjectionMonthSummary {
  month: string;
  projectedAmountCents: number;
  projectedAmount: number;
  expectedCount: number;
  currency: string;
}

export interface ProjectionsResponse {
  projections: ProjectionMonthSummary[];
  totalProjectedAmountCents: number;
  totalProjectedAmount: number;
  currency: string;
  monthsProjected: number;
  basedOnExpenseCount: number;
}

/**
 * 8. Dashboard Response
 * GET /admin/expenses/summary/dashboard
 */
export interface DashboardStatusSummary {
  status: string;
  currency: string;
  totalAmountCents: number;
  totalAmount: number;
  expenseCount: number;
}

export interface DashboardTopExpense {
  id: string;
  code: string;
  name: string;
  amountCents: number;
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
  categoryName: string;
}

export interface DashboardResponse {
  totalExpenses: TotalExpensesSummaryResponse;
  recurringExpenses: RecurringExpensesSummaryResponse;
  byCategory: CategoryCurrencySummary[];
  bySite: SiteCurrencySummary[];
  byStatus: DashboardStatusSummary[];
  topExpenses: DashboardTopExpense[];
  overdueExpenses: TotalExpensesSummaryResponse;
  filters: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Query Parameters for Summary Endpoints
 */
export interface SummaryQueryParams {
  startDate: string;
  endDate: string;
  siteId?: string;
  categoryId?: string;
  supplierId?: string;
  projectId?: string;
  status?: string;
  minAmountCents?: number;
  maxAmountCents?: number;
}

/**
 * Query Parameters for Period Comparison
 */
export interface ComparisonQueryParams {
  period1Start: string;
  period1End: string;
  period2Start: string;
  period2End: string;
}

/**
 * Query Parameters for Trends
 */
export interface TrendsQueryParams {
  startDate: string;
  endDate: string;
  groupBy?: 'month' | 'quarter' | 'year';
}

/**
 * Query Parameters for Projections
 */
export interface ProjectionsQueryParams {
  months?: number;
}

/**
 * Detailed Expense Report Item
 */
export interface DetailedExpenseReport {
  id: string;
  code: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  status: ExpenseStatus;
  expenseDate: string;
  paidAt?: string;
  categoryName: string;
  projectName?: string;
  siteName?: string;
  supplierName?: string;
  companyId: string;
  companyName: string;
  createdAt: string;
  payments?: Array<{
    id: string;
    paymentNumber: string;
    amount: number;
    paymentDate: string;
    paymentMethod: PaymentMethod;
    transactionReference?: string;
    createdAt: string;
  }>;
}

/**
 * Projection Month Detail (Legacy - for detailed projections)
 */
export interface ProjectionMonthDetail {
  year: number;
  monthIndex: number;
  monthName: string;
  totalProjected: number;
  recurrentExpenses: number;
  semiRecurrentExpenses: number;
  paidAmount: number;
  pendingAmount: number;
  expenseCount: number;
  expenses: Array<{
    expenseId: string;
    expenseCode: string;
    expenseName: string;
    expenseType: ExpenseType;
    amount: number;
    currency: string;
    dueDate: string;
    status: ExpenseStatus;
    categoryName: string;
    projectName?: string;
    siteName?: string;
    isPaid: boolean;
    paidAmount: number;
    pendingAmount: number;
    instanceId: string;
    instanceNumber: number;
  }>;
}

/**
 * Expense Projections Report (Legacy)
 */
export interface ExpenseProjectionsReport {
  period: ProjectionPeriod;
  startDate: string;
  endDate: string;
  totalProjected: number;
  monthlyAverage: number;
  recurrentTotal: number;
  semiRecurrentTotal: number;
  paidTotal: number;
  pendingTotal: number;
  months: ProjectionMonthDetail[];
  byCategory?: ReportByCategory[];
  byProject?: ReportByProject[];
  bySite?: ReportBySite[];
  filters?: Record<string, any>;
  generatedAt: string;
}

/**
 * Cash Flow Daily Projection
 */
export interface CashFlowDailyProjection {
  date: string;
  projectedOutflow: number;
  actualOutflow: number;
  difference: number;
  expenseCount: number;
  expenses: Array<{
    expenseId: string;
    expenseCode: string;
    expenseName: string;
    expenseType: ExpenseType;
    amount: number;
    currency: string;
    dueDate: string;
    status: ExpenseStatus;
    categoryName: string;
    projectName?: string;
    siteName?: string;
    isPaid: boolean;
    paidAmount: number;
    pendingAmount: number;
    instanceId: string;
    instanceNumber: number;
  }>;
}

/**
 * Cash Flow Report
 */
export interface CashFlowReport {
  startDate: string;
  endDate: string;
  totalProjectedOutflow: number;
  totalActualOutflow: number;
  totalDifference: number;
  dailyProjections: CashFlowDailyProjection[];
  generatedAt: string;
}

/**
 * General Expense Report
 */
export interface GeneralExpenseReport {
  summary: ExpenseSummary;
  byCategory?: ReportByCategory[];
  byProject?: ReportByProject[];
  bySite?: ReportBySite[];
  bySupplier?: ReportBySupplier[];
  byMonth?: ReportByMonth[];
  byYear?: ReportByYear[];
  detailed?: DetailedExpenseReport[];
  filters?: Record<string, any>;
  generatedAt: string;
}

/**
 * Report Query Parameters
 */
export interface ReportQueryParams {
  reportType?: ReportType;
  startDate?: string;
  endDate?: string;
  companyId?: string;
  siteId?: string;
  categoryId?: string;
  projectId?: string;
  supplierId?: string;
  status?: ExpenseStatus;
  paidOnly?: boolean;
  pendingOnly?: boolean;
  overdueOnly?: boolean;
  groupByMonth?: boolean;
  groupByYear?: boolean;
  includePayments?: boolean;
}

/**
 * Projection Query Parameters
 */
export interface ProjectionQueryParams {
  period?: ProjectionPeriod;
  startMonth?: number;
  startYear?: number;
  monthsToProject?: number;
  companyId?: string;
  siteId?: string;
  categoryId?: string;
  projectId?: string;
  groupByCategory?: boolean;
  groupByProject?: boolean;
  groupBySite?: boolean;
}

/**
 * Cash Flow Query Parameters
 */
export interface CashFlowQueryParams {
  startDate: string;
  endDate: string;
  companyId?: string;
  siteId?: string;
}
