import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesService } from '@/services/api';
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
  CreateExpenseTemplateRequest,
  UpdateExpenseTemplateRequest,
  ExpenseProjection,
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

// ============================================
// Query Keys
// ============================================

export const expenseKeys = {
  all: ['expenses'] as const,
  lists: () => [...expenseKeys.all, 'list'] as const,
  list: (params?: QueryExpensesParams) => [...expenseKeys.lists(), params] as const,
  details: () => [...expenseKeys.all, 'detail'] as const,
  detail: (id: string) => [...expenseKeys.details(), id] as const,
  byPeriod: (startDate: string, endDate: string) =>
    [...expenseKeys.all, 'period', startDate, endDate] as const,
  summaryByCategory: (params: PeriodDto) =>
    [...expenseKeys.all, 'summary', 'category', params] as const,
  payments: (expenseId: string) => [...expenseKeys.all, 'payments', expenseId] as const,
  paymentStatus: (expenseId: string) =>
    [...expenseKeys.all, 'payment-status', expenseId] as const,
  paymentCompletionReport: (companyId?: string) =>
    [...expenseKeys.all, 'reports', 'payment-completion', companyId] as const,
  pendingPaymentsReport: (companyId?: string) =>
    [...expenseKeys.all, 'reports', 'pending-payments', companyId] as const,
};

export const categoryKeys = {
  all: ['expense-categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  active: () => [...categoryKeys.all, 'active'] as const,
  details: () => [...categoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
};

export const templateKeys = {
  all: ['expense-templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (params?: QueryExpenseTemplatesParams) => [...templateKeys.lists(), params] as const,
  active: () => [...templateKeys.all, 'active'] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
};

export const projectionKeys = {
  all: ['expense-projections'] as const,
  byPeriod: (startDate: string, endDate: string) =>
    [...projectionKeys.all, 'period', startDate, endDate] as const,
  details: () => [...projectionKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectionKeys.details(), id] as const,
  compare: (params: PeriodDto) => [...projectionKeys.all, 'compare', params] as const,
};

export const projectKeys = {
  all: ['expense-projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params?: QueryExpenseProjectsParams) => [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

// ============================================
// Expense Categories Hooks
// ============================================

export const useCategories = () => {
  return useQuery({
    queryKey: categoryKeys.lists(),
    queryFn: () => expensesService.getCategories(),
  });
};

export const useActiveCategories = () => {
  return useQuery({
    queryKey: categoryKeys.active(),
    queryFn: () => expensesService.getActiveCategories(),
  });
};

export const useCategory = (id: string) => {
  return useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: () => expensesService.getCategory(id),
    enabled: !!id,
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExpenseCategoryRequest) => expensesService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseCategoryRequest }) =>
      expensesService.updateCategory(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(variables.id) });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
};

// ============================================
// Expenses CRUD Hooks
// ============================================

export const useExpenses = (params?: QueryExpensesParams) => {
  return useQuery({
    queryKey: expenseKeys.list(params),
    queryFn: () => expensesService.getExpenses(params),
  });
};

export const useExpense = (id: string) => {
  return useQuery({
    queryKey: expenseKeys.detail(id),
    queryFn: () => expensesService.getExpense(id),
    enabled: !!id,
  });
};

export const useExpensesByPeriod = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: expenseKeys.byPeriod(startDate, endDate),
    queryFn: () => expensesService.getByPeriod(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
};

export const useSummaryByCategory = (params: PeriodDto) => {
  return useQuery({
    queryKey: expenseKeys.summaryByCategory(params),
    queryFn: () => expensesService.getSummaryByCategory(params),
    enabled: !!params.startDate && !!params.endDate,
  });
};

export const useCreateExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExpenseRequest) => expensesService.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
  });
};

export const useUpdateExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseRequest }) =>
      expensesService.updateExpense(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.id) });
    },
  });
};

export const useDeleteExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
  });
};

export const useChangeExpenseStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChangeStatusRequest }) =>
      expensesService.changeStatus(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.id) });
    },
  });
};

export const useAssociateToPurchase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssociatePurchaseRequest }) =>
      expensesService.associateToPurchase(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.id) });
    },
  });
};

// ============================================
// Payment Reconciliation Hooks
// ============================================

export const usePayments = (expenseId: string) => {
  return useQuery({
    queryKey: expenseKeys.payments(expenseId),
    queryFn: () => expensesService.getPayments(expenseId),
    enabled: !!expenseId,
  });
};

export const usePaymentStatus = (expenseId: string) => {
  return useQuery({
    queryKey: expenseKeys.paymentStatus(expenseId),
    queryFn: () => expensesService.getPaymentStatus(expenseId),
    enabled: !!expenseId,
  });
};

export const usePaymentCompletionReport = (companyId?: string) => {
  return useQuery({
    queryKey: expenseKeys.paymentCompletionReport(companyId),
    queryFn: () => expensesService.getPaymentCompletionReport(companyId),
  });
};

export const usePendingPaymentsReport = (companyId?: string) => {
  return useQuery({
    queryKey: expenseKeys.pendingPaymentsReport(companyId),
    queryFn: () => expensesService.getPendingPaymentsReport(companyId),
  });
};

export const useCreatePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ expenseId, data }: { expenseId: string; data: CreateExpensePaymentRequest }) =>
      expensesService.createPayment(expenseId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.payments(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.paymentStatus(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
  });
};

export const useCreatePaymentWithFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      expenseId,
      data,
      fileUri,
      filename,
      mimeType,
    }: {
      expenseId: string;
      data: CreateExpensePaymentRequest;
      fileUri: string;
      filename: string;
      mimeType?: string;
    }) => expensesService.createPaymentWithFile(expenseId, data, fileUri, filename, mimeType),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.payments(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.paymentStatus(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
  });
};

export const useRegisterPartialPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ expenseId, data }: { expenseId: string; data: PartialPaymentRequest }) =>
      expensesService.registerPartialPayment(expenseId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.payments(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.paymentStatus(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
  });
};

export const useRegisterPartialPaymentWithFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      expenseId,
      data,
      fileUri,
      filename,
      mimeType,
    }: {
      expenseId: string;
      data: PartialPaymentRequest;
      fileUri: string;
      filename: string;
      mimeType?: string;
    }) =>
      expensesService.registerPartialPaymentWithFile(expenseId, data, fileUri, filename, mimeType),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.payments(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.paymentStatus(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
  });
};

export const useReconcileAmount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ expenseId, data }: { expenseId: string; data: ReconcileAmountRequest }) =>
      expensesService.reconcileAmount(expenseId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.payments(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.paymentStatus(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
  });
};

// ============================================
// Expense Templates Hooks
// ============================================

export const useTemplates = (params?: QueryExpenseTemplatesParams) => {
  return useQuery({
    queryKey: templateKeys.list(params),
    queryFn: () => expensesService.getTemplates(params),
  });
};

export const useActiveTemplates = () => {
  return useQuery({
    queryKey: templateKeys.active(),
    queryFn: () => expensesService.getActiveTemplates(),
  });
};

export const useTemplate = (id: string) => {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: () => expensesService.getTemplate(id),
    enabled: !!id,
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExpenseTemplateRequest) => expensesService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
};

export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseTemplateRequest }) =>
      expensesService.updateTemplate(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(variables.id) });
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
};

export const useGenerateFromTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.generateFromTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
  });
};

export const useGenerateRecurringExpenses = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => expensesService.generateRecurringExpenses(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
    },
  });
};

// ============================================
// Expense Projections Hooks (Legacy)
// ============================================

export const useProjectionsByPeriod = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: projectionKeys.byPeriod(startDate, endDate),
    queryFn: () => expensesService.getProjectionsByPeriod(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
};

export const useProjection = (id: string) => {
  return useQuery({
    queryKey: projectionKeys.detail(id),
    queryFn: () => expensesService.getProjection(id),
    enabled: !!id,
  });
};

export const useCreateProjection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExpenseProjectionRequest) => expensesService.createProjection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectionKeys.all });
    },
  });
};

export const useUpdateProjection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseProjectionRequest }) =>
      expensesService.updateProjection(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectionKeys.all });
      queryClient.invalidateQueries({ queryKey: projectionKeys.detail(variables.id) });
    },
  });
};

export const useDeleteProjection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.deleteProjection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectionKeys.all });
    },
  });
};

export const useGenerateProjections = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GenerateProjectionsRequest) => expensesService.generateProjections(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectionKeys.all });
    },
  });
};

export const useCompareProjections = (params: PeriodDto) => {
  return useQuery({
    queryKey: projectionKeys.compare(params),
    queryFn: () => expensesService.compareProjections(params),
    enabled: !!params.startDate && !!params.endDate,
  });
};

// ============================================
// Expense Projects Hooks
// ============================================

export const useProjects = (params?: QueryExpenseProjectsParams) => {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => expensesService.getProjects(params),
  });
};

export const useProject = (id: string) => {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => expensesService.getProject(id),
    enabled: !!id,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExpenseProjectRequest) => expensesService.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseProjectRequest }) =>
      expensesService.updateProject(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.id) });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
};
