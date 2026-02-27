import { apiClient } from './client';
import {
  Expense,
  ExpensesResponse,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  QueryExpensesParams,
  ExpenseCategory,
  ExpenseCategoriesResponse,
  CreateExpenseCategoryRequest,
  UpdateExpenseCategoryRequest,
  ExpenseTemplate,
  ExpenseTemplatesResponse,
  CreateExpenseTemplateRequest,
  UpdateExpenseTemplateRequest,
  ExpenseProjection,
  ExpenseProjectionsResponse,
  CreateExpenseProjectionRequest,
  UpdateExpenseProjectionRequest,
  GenerateProjectionsRequest,
  ChangeStatusRequest,
  AssociatePurchaseRequest,
  PeriodDto,
  CategorySummaryResponse,
  ComparisonResult,
  ExpenseProject,
  ExpenseProjectsResponse,
  CreateExpenseProjectRequest,
  UpdateExpenseProjectRequest,
  QueryExpenseProjectsParams,
  QueryExpenseTemplatesParams,
  QueryExpenseProjectionsParams,
  PartialPaymentRequest,
  ReconcileAmountRequest,
  PaymentStatusResponse,
  PaymentCompletionReportItem,
  PendingPaymentReportItem,
  CreateExpensePaymentRequest,
} from '@/types/expenses';

/**
 * Expenses API Service - New Backend Structure
 */
class ExpensesService {
  private readonly basePath = '/expenses';
  private readonly paymentsBasePath = '/admin/expenses'; // Payments endpoints use /admin prefix
  private readonly categoriesPath = '/admin/expense-categories';
  private readonly templatesPath = '/admin/expense-templates';
  private readonly projectionsPath = '/admin/expense-projections';
  private readonly projectsPath = '/admin/expense-projects';

  // ============================================
  // Expense Categories
  // ============================================

  // ============================================
  // V2 OPTIMIZED ENDPOINTS
  // ============================================

  /**
   * Búsqueda optimizada de gastos (v2)
   * Usa caché Redis y búsqueda multi-campo
   * GET /expenses (with search param)
   */
  async searchExpensesV2(params: {
    q: string;
    limit?: number;
    status?: string;
    projectId?: string;
    categoryId?: string;
    siteId?: string;
  }): Promise<{
    expenses?: Expense[];
    results?: Expense[];
    total: number;
    limit: number;
    hasMore: boolean;
    searchTime: number;
    cached: boolean;
  }> {
    // Clean undefined params
    const cleanParams: any = {
      search: params.q,
      limit: params.limit,
      includeAccountPayable: true,
    };
    if (params.status) cleanParams.status = params.status;
    if (params.projectId) cleanParams.projectId = params.projectId;
    if (params.categoryId) cleanParams.categoryId = params.categoryId;
    if (params.siteId) cleanParams.siteId = params.siteId;

    return apiClient.get('/expenses', { params: cleanParams });
  }

  /**
   * Listado paginado optimizado de gastos (v2)
   * GET /expenses
   */
  async getExpensesV2(params?: {
    page?: number;
    limit?: number;
    status?: string;
    projectId?: string;
    categoryId?: string;
    q?: string;
  }): Promise<{
    expenses?: Expense[];
    data?: Expense[];
    results?: Expense[];
    meta?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    hasMore?: boolean;
    searchTime?: number;
    cached?: boolean;
  }> {
    // Clean undefined params and add includeAccountPayable
    const cleanParams: any = {
      page: params?.page || 1,
      limit: params?.limit || 50,
      includeAccountPayable: true,
    };
    if (params?.status) cleanParams.status = params.status;
    if (params?.projectId) cleanParams.projectId = params.projectId;
    if (params?.categoryId) cleanParams.categoryId = params.categoryId;
    if (params?.q) cleanParams.search = params.q;

    const response = await apiClient.get('/expenses', { params: cleanParams });
    return response;
  }

  /**
   * Invalidar caché de gastos (v2)
   * DELETE /expenses/cache
   */
  async invalidateExpensesCacheV2(): Promise<void> {
    return apiClient.delete('/expenses/cache');
  }

  /**
   * Get all expense categories
   */
  async getCategories(): Promise<ExpenseCategoriesResponse> {
    const categories = await apiClient.get<ExpenseCategory[]>(this.categoriesPath);
    return {
      data: categories,
    };
  }

  /**
   * Get active categories
   */
  async getActiveCategories(): Promise<ExpenseCategory[]> {
    return apiClient.get<ExpenseCategory[]>(`${this.categoriesPath}/active`);
  }

  /**
   * Get a single category by ID
   */
  async getCategory(id: string): Promise<ExpenseCategory> {
    return apiClient.get<ExpenseCategory>(`${this.categoriesPath}/${id}`);
  }

  /**
   * Create a new expense category
   */
  async createCategory(data: CreateExpenseCategoryRequest): Promise<ExpenseCategory> {
    return apiClient.post<ExpenseCategory>(this.categoriesPath, data);
  }

  /**
   * Update an expense category
   */
  async updateCategory(id: string, data: UpdateExpenseCategoryRequest): Promise<ExpenseCategory> {
    return apiClient.patch<ExpenseCategory>(`${this.categoriesPath}/${id}`, data);
  }

  /**
   * Delete (deactivate) an expense category
   */
  async deleteCategory(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.categoriesPath}/${id}`);
  }

  // ============================================
  // Expenses CRUD
  // ============================================

  /**
   * Get all expenses with optional filters
   */
  async getExpenses(params?: QueryExpensesParams): Promise<ExpensesResponse> {
    // Add includeAccountPayable to always fetch account payable data
    const enhancedParams = {
      ...params,
      includeAccountPayable: true,
    };
    return apiClient.get<ExpensesResponse>(this.basePath, { params: enhancedParams });
  }

  /**
   * Get a single expense by ID
   */
  async getExpense(id: string): Promise<Expense> {
    return apiClient.get<Expense>(`${this.basePath}/${id}`, {
      params: { includeAccountPayable: true }
    });
  }

  /**
   * Create a new expense
   */
  async createExpense(data: CreateExpenseRequest): Promise<Expense> {
    return apiClient.post<Expense>(this.basePath, data);
  }

  /**
   * Update an expense
   */
  async updateExpense(id: string, data: UpdateExpenseRequest): Promise<Expense> {
    return apiClient.patch<Expense>(`${this.basePath}/${id}`, data);
  }

  /**
   * Delete an expense (soft delete)
   */
  async deleteExpense(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }

  /**
   * Change status of an expense
   */
  async changeStatus(id: string, data: ChangeStatusRequest): Promise<Expense> {
    return apiClient.patch<Expense>(`${this.basePath}/${id}/status`, data);
  }

  /**
   * Associate expense to a purchase
   */
  async associateToPurchase(id: string, data: AssociatePurchaseRequest): Promise<Expense> {
    return apiClient.post<Expense>(`${this.basePath}/${id}/associate-purchase`, data);
  }

  /**
   * Get expenses by period
   */
  async getByPeriod(startDate: string, endDate: string): Promise<Expense[]> {
    return apiClient.get<Expense[]>(`${this.basePath}/period`, {
      params: { startDate, endDate },
    });
  }

  /**
   * Get summary by category
   */
  async getSummaryByCategory(params: PeriodDto): Promise<CategorySummaryResponse> {
    return apiClient.get<CategorySummaryResponse>(`${this.basePath}/summary/by-category`, {
      params,
    });
  }

  // ============================================
  // Payment Reconciliation
  // ============================================

  /**
   * Create a payment for an expense
   */
  async createPayment(expenseId: string, data: CreateExpensePaymentRequest): Promise<any> {
    return apiClient.post(`${this.paymentsBasePath}/${expenseId}/payments`, data);
  }

  /**
   * Create a payment with file attachment
   */
  async createPaymentWithFile(
    expenseId: string,
    data: CreateExpensePaymentRequest,
    fileUri: string,
    filename: string,
    mimeType: string = 'image/jpeg'
  ): Promise<any> {
    const formData = new FormData();

    // Append file
    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: filename,
    } as any);

    // Append payment data
    formData.append('amountCents', data.amountCents.toString());
    formData.append('paymentMethod', data.paymentMethod);
    formData.append('paymentDate', data.paymentDate);

    if (data.currency) {
      formData.append('currency', data.currency);
    }
    if (data.bankName) {
      formData.append('bankName', data.bankName);
    }
    if (data.accountNumber) {
      formData.append('accountNumber', data.accountNumber);
    }
    if (data.transactionReference) {
      formData.append('transactionReference', data.transactionReference);
    }
    if (data.notes) {
      formData.append('notes', data.notes);
    }

    // Don't set Content-Type manually - let axios set it with the boundary
    return apiClient.post(`${this.paymentsBasePath}/${expenseId}/payments/with-file`, formData);
  }

  /**
   * Register a partial payment
   */
  async registerPartialPayment(expenseId: string, data: PartialPaymentRequest): Promise<any> {
    return apiClient.post(`${this.paymentsBasePath}/${expenseId}/payments/partial`, data);
  }

  /**
   * Register a partial payment with file attachment
   */
  async registerPartialPaymentWithFile(
    expenseId: string,
    data: PartialPaymentRequest,
    fileUri: string,
    filename: string,
    mimeType: string = 'image/jpeg'
  ): Promise<any> {
    const formData = new FormData();

    // Append file
    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: filename,
    } as any);

    // Append payment data
    formData.append('amountCents', data.amountCents.toString());
    formData.append('paymentMethod', data.paymentMethod);
    formData.append('paymentDate', data.paymentDate);

    if (data.transactionReference) {
      formData.append('transactionReference', data.transactionReference);
    }
    if (data.notes) {
      formData.append('notes', data.notes);
    }

    // Don't set Content-Type manually - let axios set it with the boundary
    return apiClient.post(`${this.paymentsBasePath}/${expenseId}/payments/partial/with-file`, formData);
  }

  /**
   * Reconcile actual amount
   */
  async reconcileAmount(expenseId: string, data: ReconcileAmountRequest): Promise<any> {
    return apiClient.post(`${this.paymentsBasePath}/${expenseId}/payments/reconcile`, data);
  }

  /**
   * Get all payments for an expense
   */
  async getPayments(expenseId: string): Promise<any[]> {
    return apiClient.get(`${this.paymentsBasePath}/${expenseId}/payments`);
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(expenseId: string): Promise<PaymentStatusResponse> {
    return apiClient.get(`${this.paymentsBasePath}/${expenseId}/payments/status`);
  }

  /**
   * Get payment completion report
   */
  async getPaymentCompletionReport(companyId?: string): Promise<PaymentCompletionReportItem[]> {
    return apiClient.get(`${this.basePath}/reports/payment-completion`, {
      params: companyId ? { companyId } : undefined,
    });
  }

  /**
   * Get pending payments report
   */
  async getPendingPaymentsReport(companyId?: string): Promise<PendingPaymentReportItem[]> {
    return apiClient.get(`${this.basePath}/reports/pending-payments`, {
      params: companyId ? { companyId } : undefined,
    });
  }

  // ============================================
  // Expense Templates
  // ============================================

  /**
   * Get all expense templates with optional filters
   * Note: Backend returns an array directly, not a paginated response
   */
  async getTemplates(params?: QueryExpenseTemplatesParams): Promise<ExpenseTemplate[]> {
    return apiClient.get<ExpenseTemplate[]>(this.templatesPath, { params });
  }

  /**
   * Get active templates
   */
  async getActiveTemplates(): Promise<ExpenseTemplate[]> {
    return apiClient.get<ExpenseTemplate[]>(`${this.templatesPath}/active`);
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(id: string): Promise<ExpenseTemplate> {
    return apiClient.get<ExpenseTemplate>(`${this.templatesPath}/${id}`);
  }

  /**
   * Create a new expense template
   */
  async createTemplate(data: CreateExpenseTemplateRequest): Promise<ExpenseTemplate> {
    return apiClient.post<ExpenseTemplate>(this.templatesPath, data);
  }

  /**
   * Update an expense template
   */
  async updateTemplate(id: string, data: UpdateExpenseTemplateRequest): Promise<ExpenseTemplate> {
    return apiClient.patch<ExpenseTemplate>(`${this.templatesPath}/${id}`, data);
  }

  /**
   * Delete an expense template
   */
  async deleteTemplate(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.templatesPath}/${id}`);
  }

  /**
   * Generate expense from template
   */
  async generateFromTemplate(id: string): Promise<Expense> {
    return apiClient.post<Expense>(`${this.templatesPath}/${id}/generate`);
  }

  /**
   * Generate all recurring expenses
   */
  async generateRecurringExpenses(): Promise<Expense[]> {
    return apiClient.post<Expense[]>(`${this.templatesPath}/generate-recurring`);
  }

  /**
   * Download bulk upload format for expense templates
   */
  async downloadBulkUploadFormat(): Promise<Blob> {
    return apiClient.get(`${this.templatesPath}/bulk-upload/format`, {
      responseType: 'blob',
    });
  }

  /**
   * Upload bulk expense templates file
   */
  async uploadBulkTemplates(file: any): Promise<{
    success: boolean;
    totalRows: number;
    createdRows: number;
    errors: Array<{
      row: number;
      name: string;
      error: string;
    }>;
  }> {
    const formData = new FormData();
    formData.append('file', file as any);

    return apiClient.post(`${this.templatesPath}/bulk-upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // ============================================
  // Expense Projections (Legacy - Old API)
  // ============================================

  /**
   * Get projections by period
   */
  async getProjectionsByPeriod(startDate: string, endDate: string): Promise<ExpenseProjection[]> {
    return apiClient.get<ExpenseProjection[]>(`${this.projectionsPath}/period`, {
      params: { startDate, endDate },
    });
  }

  /**
   * Get a single projection by ID
   */
  async getProjection(id: string): Promise<ExpenseProjection> {
    return apiClient.get<ExpenseProjection>(`${this.projectionsPath}/${id}`);
  }

  /**
   * Create a new expense projection
   */
  async createProjection(data: CreateExpenseProjectionRequest): Promise<ExpenseProjection> {
    return apiClient.post<ExpenseProjection>(this.projectionsPath, data);
  }

  /**
   * Update an expense projection
   */
  async updateProjection(
    id: string,
    data: UpdateExpenseProjectionRequest
  ): Promise<ExpenseProjection> {
    return apiClient.patch<ExpenseProjection>(`${this.projectionsPath}/${id}`, data);
  }

  /**
   * Delete an expense projection
   */
  async deleteProjection(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.projectionsPath}/${id}`);
  }

  /**
   * Generate projections based on historical data
   */
  async generateProjections(data: GenerateProjectionsRequest): Promise<ExpenseProjection[]> {
    return apiClient.post<ExpenseProjection[]>(`${this.projectionsPath}/generate`, data);
  }

  /**
   * Compare projections vs actual expenses
   */
  async compareProjections(params: PeriodDto): Promise<ComparisonResult[]> {
    return apiClient.get<ComparisonResult[]>(`${this.projectionsPath}/compare`, { params });
  }

  // ============================================
  // Expense Projects (Kept for compatibility)
  // ============================================

  /**
   * Get all expense projects with optional filters
   */
  async getProjects(params?: QueryExpenseProjectsParams): Promise<ExpenseProjectsResponse> {
    const projects = await apiClient.get<ExpenseProject[]>(this.projectsPath, { params });
    return {
      data: Array.isArray(projects) ? projects : [],
      meta: {
        total: Array.isArray(projects) ? projects.length : 0,
        page: 1,
        limit: Array.isArray(projects) ? projects.length : 0,
        totalPages: 1,
      },
    };
  }

  /**
   * Get a single project by ID
   */
  async getProject(id: string): Promise<ExpenseProject> {
    return apiClient.get<ExpenseProject>(`${this.projectsPath}/${id}`);
  }

  /**
   * Create a new expense project
   */
  async createProject(data: CreateExpenseProjectRequest): Promise<ExpenseProject> {
    return apiClient.post<ExpenseProject>(this.projectsPath, data);
  }

  /**
   * Update an expense project
   */
  async updateProject(id: string, data: UpdateExpenseProjectRequest): Promise<ExpenseProject> {
    return apiClient.patch<ExpenseProject>(`${this.projectsPath}/${id}`, data);
  }

  /**
   * Delete an expense project
   */
  async deleteProject(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.projectsPath}/${id}`);
  }

  // ============================================
  // New Summary Endpoints (8 Endpoints)
  // ============================================

  /**
   * 1. Get Total Expenses Summary
   * GET /expenses/summary/total
   */
  async getTotalExpensesSummary(
    params: import('@/types/expenses').SummaryQueryParams
  ): Promise<import('@/types/expenses').TotalExpensesSummaryResponse> {
    return apiClient.get<import('@/types/expenses').TotalExpensesSummaryResponse>(
      '/expenses/summary/total',
      { params }
    );
  }

  /**
   * 2. Get Recurring Expenses Summary
   * GET /expenses/summary/recurring
   */
  async getRecurringExpensesSummary(
    params: import('@/types/expenses').SummaryQueryParams
  ): Promise<import('@/types/expenses').RecurringExpensesSummaryResponse> {
    return apiClient.get<import('@/types/expenses').RecurringExpensesSummaryResponse>(
      '/expenses/summary/recurring',
      { params }
    );
  }

  /**
   * 3. Get Summary by Category and Currency
   * GET /expenses/summary/by-category-currency
   */
  async getSummaryByCategoryAndCurrency(
    params: Partial<import('@/types/expenses').SummaryQueryParams>
  ): Promise<import('@/types/expenses').SummaryByCategoryResponse> {
    return apiClient.get<import('@/types/expenses').SummaryByCategoryResponse>(
      '/expenses/summary/by-category-currency',
      { params }
    );
  }

  /**
   * 4. Get Summary by Site
   * GET /expenses/summary/by-site
   */
  async getSummaryBySite(
    params: Partial<import('@/types/expenses').SummaryQueryParams>
  ): Promise<import('@/types/expenses').SummaryBySiteResponse> {
    return apiClient.get<import('@/types/expenses').SummaryBySiteResponse>(
      '/expenses/summary/by-site',
      { params }
    );
  }

  /**
   * 5. Compare Periods
   * GET /expenses/summary/compare
   */
  async comparePeriods(
    params: import('@/types/expenses').ComparisonQueryParams
  ): Promise<import('@/types/expenses').PeriodComparisonResponse> {
    return apiClient.get<import('@/types/expenses').PeriodComparisonResponse>(
      '/expenses/summary/compare',
      { params }
    );
  }

  /**
   * 6. Get Trends
   * GET /expenses/summary/trends
   */
  async getTrends(
    params: import('@/types/expenses').TrendsQueryParams
  ): Promise<import('@/types/expenses').TrendsResponse> {
    return apiClient.get<import('@/types/expenses').TrendsResponse>(
      '/expenses/summary/trends',
      { params }
    );
  }

  /**
   * 7. Get Projections
   * GET /expenses/summary/projections
   */
  async getExpenseProjections(
    params?: import('@/types/expenses').ProjectionsQueryParams
  ): Promise<import('@/types/expenses').ProjectionsResponse> {
    return apiClient.get<import('@/types/expenses').ProjectionsResponse>(
      '/expenses/summary/projections',
      { params }
    );
  }

  /**
   * 8. Get Dashboard
   * GET /expenses/summary/dashboard
   */
  async getDashboard(params: {
    startDate: string;
    endDate: string;
  }): Promise<import('@/types/expenses').DashboardResponse> {
    return apiClient.get<import('@/types/expenses').DashboardResponse>(
      '/expenses/summary/dashboard',
      { params }
    );
  }

  // ============================================
  // Legacy Report Methods (for backward compatibility)
  // ============================================

  /**
   * @deprecated Use getDashboard instead
   */
  async getSummaryReport(params?: any): Promise<any> {
    // Legacy method - redirect to new dashboard
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31);

    return this.getDashboard({
      startDate: params?.startDate || startOfYear.toISOString().split('T')[0],
      endDate: params?.endDate || endOfYear.toISOString().split('T')[0],
    });
  }

  /**
   * @deprecated Use getSummaryByCategoryAndCurrency instead
   */
  async getByCategoryReport(params?: any): Promise<any> {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31);

    return this.getSummaryByCategoryAndCurrency({
      startDate: params?.startDate || startOfYear.toISOString().split('T')[0],
      endDate: params?.endDate || endOfYear.toISOString().split('T')[0],
      ...params,
    });
  }

  /**
   * @deprecated Use getDashboard instead
   */
  async getByProjectReport(params?: any): Promise<any> {
    return this.getSummaryReport(params);
  }

  /**
   * @deprecated Use getSummaryBySite instead
   */
  async getBySiteReport(params?: any): Promise<any> {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31);

    return this.getSummaryBySite({
      startDate: params?.startDate || startOfYear.toISOString().split('T')[0],
      endDate: params?.endDate || endOfYear.toISOString().split('T')[0],
      ...params,
    });
  }

  /**
   * @deprecated Use getDashboard instead
   */
  async getBySupplierReport(params?: any): Promise<any> {
    return this.getSummaryReport(params);
  }

  /**
   * @deprecated Use getDashboard instead
   */
  async getByTypeReport(params?: any): Promise<any> {
    return this.getSummaryReport(params);
  }

  /**
   * @deprecated Use getTrends instead
   */
  async getByMonthReport(params?: any): Promise<any> {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31);

    return this.getTrends({
      startDate: params?.startDate || startOfYear.toISOString().split('T')[0],
      endDate: params?.endDate || endOfYear.toISOString().split('T')[0],
      groupBy: 'month',
    });
  }

  /**
   * @deprecated Use getTrends instead
   */
  async getByYearReport(params?: any): Promise<any> {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear() - 5, 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31);

    return this.getTrends({
      startDate: params?.startDate || startOfYear.toISOString().split('T')[0],
      endDate: params?.endDate || endOfYear.toISOString().split('T')[0],
      groupBy: 'year',
    });
  }

  /**
   * @deprecated Use getExpenseProjections instead
   */
  async getProjections(params?: any): Promise<any> {
    return this.getExpenseProjections({
      months: params?.monthsToProject || 12,
    });
  }

  /**
   * @deprecated Use getExpenseProjections instead
   */
  async getProjectionsReport(params?: any): Promise<any> {
    return this.getExpenseProjections({
      months: params?.monthsToProject || 12,
    });
  }

  /**
   * @deprecated Use getDashboard instead
   */
  async getCashFlowReport(params?: any): Promise<any> {
    return this.getDashboard({
      startDate: params?.startDate,
      endDate: params?.endDate,
    });
  }
}

export const expensesService = new ExpensesService();
export default expensesService;
