import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { payrollEmploymentApi } from '@/services/api/payroll-employment';
import { useTenantStore } from '@/store/tenant';
import { logger } from '@/utils/logger';
import type {
  CreateBenefitChangeDto,
  CreateEmploymentDto,
  EmploymentListParams,
  PayrollPositionListParams,
  UpdateEmploymentDto,
  UpdateScheduleDto,
} from '@/types/payroll';

export const payrollEmploymentKeys = {
  all: ['payroll', 'employment'] as const,
  lists: () => [...payrollEmploymentKeys.all, 'list'] as const,
  list: (p?: EmploymentListParams) => [...payrollEmploymentKeys.lists(), p ?? {}] as const,
  details: () => [...payrollEmploymentKeys.all, 'detail'] as const,
  detail: (userId: string) => [...payrollEmploymentKeys.details(), userId] as const,
  history: (userId: string) => [...payrollEmploymentKeys.all, 'history', userId] as const,
  salaryHistory: (userId: string) =>
    [...payrollEmploymentKeys.all, 'salary-history', userId] as const,
  schedule: (userId: string) => [...payrollEmploymentKeys.all, 'schedule', userId] as const,
  benefitChanges: (userId: string) =>
    [...payrollEmploymentKeys.all, 'benefit-changes', userId] as const,
  positions: (p?: PayrollPositionListParams) =>
    [...payrollEmploymentKeys.all, 'positions', p ?? {}] as const,
};

/**
 * Lista los puestos del organigrama para asignar en planilla.
 *
 * Consume `organizationApi.getCompanyPositions(companyId)` (+ opcional
 * `getSitePositions(siteId)`) desde el service, ya que el backend no expone un
 * endpoint dedicado `/payroll/employment/positions`. El `companyId` se toma del
 * `useTenantStore` si no se pasa explicitamente.
 */
export const usePayrollPositions = (params?: PayrollPositionListParams, enabled = true) => {
  const activeCompanyId = useTenantStore((s) => s.selectedCompany?.id);
  const merged: PayrollPositionListParams = {
    activeOnly: true,
    ...params,
    companyId: params?.companyId ?? activeCompanyId,
  };
  return useQuery({
    queryKey: payrollEmploymentKeys.positions(merged),
    queryFn: () => payrollEmploymentApi.listPositions(merged),
    enabled: enabled && !!merged.companyId,
    staleTime: 5 * 60 * 1000, // catalogo estable, cache 5min
    placeholderData: keepPreviousData,
  });
};

export const usePayrollEmployees = (params?: EmploymentListParams, enabled = true) =>
  useQuery({
    queryKey: payrollEmploymentKeys.list(params),
    queryFn: ({ signal }) => payrollEmploymentApi.list(params, signal),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

export const usePayrollEmployee = (userId: string, enabled = true) =>
  useQuery({
    queryKey: payrollEmploymentKeys.detail(userId),
    queryFn: () => payrollEmploymentApi.getByUser(userId),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000,
  });

export const usePayrollEmployeeHistory = (userId: string, enabled = true) =>
  useQuery({
    queryKey: payrollEmploymentKeys.history(userId),
    queryFn: () => payrollEmploymentApi.getHistory(userId),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000,
  });

export const usePayrollSalaryHistory = (userId: string, enabled = true) =>
  useQuery({
    queryKey: payrollEmploymentKeys.salaryHistory(userId),
    queryFn: () => payrollEmploymentApi.getSalaryHistory(userId),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000,
  });

export const usePayrollSchedule = (userId: string, enabled = true) =>
  useQuery({
    queryKey: payrollEmploymentKeys.schedule(userId),
    queryFn: () => payrollEmploymentApi.getSchedule(userId),
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000,
  });

export const usePayrollBenefitChanges = (userId: string, enabled = true) =>
  useQuery({
    queryKey: payrollEmploymentKeys.benefitChanges(userId),
    queryFn: () => payrollEmploymentApi.listBenefitChanges(userId),
    enabled: enabled && !!userId,
    staleTime: 30 * 1000,
  });

// ---- Mutations ----------------------------------------------------------

export const useCreatePayrollEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmploymentDto) => payrollEmploymentApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payrollEmploymentKeys.lists() });
    },
    onError: (err) => logger.error('createPayrollEmployee', err),
  });
};

export const useUpdatePayrollEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateEmploymentDto }) =>
      payrollEmploymentApi.update(userId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: payrollEmploymentKeys.detail(vars.userId) });
      qc.invalidateQueries({ queryKey: payrollEmploymentKeys.lists() });
      qc.invalidateQueries({ queryKey: payrollEmploymentKeys.history(vars.userId) });
    },
    onError: (err) => logger.error('updatePayrollEmployee', err),
  });
};

export const useUpdatePayrollSchedule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateScheduleDto }) =>
      payrollEmploymentApi.updateSchedule(userId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: payrollEmploymentKeys.schedule(vars.userId) });
    },
    onError: (err) => logger.error('updatePayrollSchedule', err),
  });
};

export const useCreatePayrollBenefitChange = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: CreateBenefitChangeDto }) =>
      payrollEmploymentApi.createBenefitChange(userId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: payrollEmploymentKeys.benefitChanges(vars.userId) });
      // Al aprobarse impactara al maestro; invalidamos aprobaciones para refrescar bandeja
      qc.invalidateQueries({ queryKey: ['payroll', 'approvals'] });
    },
    onError: (err) => logger.error('createPayrollBenefitChange', err),
  });
};
