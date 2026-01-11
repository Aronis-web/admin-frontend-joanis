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
  private readonly basePath = '/admin/expenses';
  private readonly categoriesPath = '/admin/expense-categories';
  private readonly templatesPath = '/admin/expense-templates';
  private readonly projectionsPath = '/admin/expense-projections';
  private readonly projectsPath = '/admin/expense-projects';

  // ============================================
  // Expense Categories
  // ============================================

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
    return apiClient.get<ExpensesResponse>(this.basePath, { params });
  }

  /**
   * Get a single expense by ID
   */
  async getExpense(id: string): Promise<Expense> {
    return apiClient.get<Expense>(`${this.basePath}/${id}`);
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
    return apiClient.post(`${this.basePath}/${expenseId}/payments`, data);
  }

  /**
   * Register a partial payment
   */
  async registerPartialPayment(expenseId: string, data: PartialPaymentRequest): Promise<any> {
    return apiClient.post(`${this.basePath}/${expenseId}/payments/partial`, data);
  }

  /**
   * Reconcile actual amount
   */
  async reconcileAmount(expenseId: string, data: ReconcileAmountRequest): Promise<any> {
    return apiClient.post(`${this.basePath}/${expenseId}/payments/reconcile`, data);
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(expenseId: string): Promise<PaymentStatusResponse> {
    return apiClient.get(`${this.basePath}/${expenseId}/payments/status`);
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

  // ============================================
  // Expense Projections
  // ============================================

  /**
   * Get all expense projections with optional filters
   */
  async getProjections(params?: QueryExpenseProjectionsParams): Promise<ExpenseProjectionsResponse> {
    return apiClient.get<ExpenseProjectionsResponse>(this.projectionsPath, { params });
  }

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
  async updateProjection(id: string, data: UpdateExpenseProjectionRequest): Promise<ExpenseProjection> {
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
}

export const expensesService = new ExpensesService();
export default expensesService;
