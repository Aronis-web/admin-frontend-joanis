import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { payrollVacationsApi } from '@/services/api/payroll-vacations';
import { logger } from '@/utils/logger';
import type {
  CreateVacationDto,
  UpsertVacationBalanceDto,
  VacationListParams,
} from '@/types/payroll';

export const payrollVacationsKeys = {
  all: ['payroll', 'vacations'] as const,
  lists: () => [...payrollVacationsKeys.all, 'list'] as const,
  list: (p?: VacationListParams) => [...payrollVacationsKeys.lists(), p ?? {}] as const,
  balances: (userId: string) => [...payrollVacationsKeys.all, 'balances', userId] as const,
};

export const usePayrollVacations = (params?: VacationListParams, enabled = true) =>
  useQuery({
    queryKey: payrollVacationsKeys.list(params),
    queryFn: ({ signal }) => payrollVacationsApi.list(params, signal),
    enabled,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

export const usePayrollVacationBalances = (userId: string, enabled = true) =>
  useQuery({
    queryKey: payrollVacationsKeys.balances(userId),
    queryFn: () => payrollVacationsApi.getBalances(userId),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000,
  });

export const useCreatePayrollVacation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVacationDto) => payrollVacationsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollVacationsKeys.lists() }),
    onError: (err) => logger.error('createPayrollVacation', err),
  });
};

export const useUpsertPayrollVacationBalance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertVacationBalanceDto) => payrollVacationsApi.upsertBalance(data),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: payrollVacationsKeys.balances(vars.userId) }),
    onError: (err) => logger.error('upsertPayrollVacationBalance', err),
  });
};
