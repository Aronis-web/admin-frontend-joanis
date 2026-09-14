import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { payrollPeriodsApi } from '@/services/api/payroll-periods';
import { logger } from '@/utils/logger';
import type {
  CalculatePeriodDto,
  CreatePeriodDto,
  OverrideInputDto,
  PeriodListParams,
} from '@/types/payroll';

export const payrollPeriodsKeys = {
  all: ['payroll', 'periods'] as const,
  lists: () => [...payrollPeriodsKeys.all, 'list'] as const,
  list: (p?: PeriodListParams) => [...payrollPeriodsKeys.lists(), p ?? {}] as const,
  details: () => [...payrollPeriodsKeys.all, 'detail'] as const,
  detail: (id: string) => [...payrollPeriodsKeys.details(), id] as const,
  inputs: (id: string) => [...payrollPeriodsKeys.all, 'inputs', id] as const,
  slips: (id: string) => [...payrollPeriodsKeys.all, 'slips', id] as const,
};

export const usePayrollPeriods = (params?: PeriodListParams, enabled = true) =>
  useQuery({
    queryKey: payrollPeriodsKeys.list(params),
    queryFn: ({ signal }) => payrollPeriodsApi.list(params, signal),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

export const usePayrollPeriod = (id: string, enabled = true) =>
  useQuery({
    queryKey: payrollPeriodsKeys.detail(id),
    queryFn: () => payrollPeriodsApi.getById(id),
    enabled: enabled && !!id,
    staleTime: 30 * 1000,
  });

export const usePayrollPeriodInputs = (id: string, enabled = true) =>
  useQuery({
    queryKey: payrollPeriodsKeys.inputs(id),
    queryFn: ({ signal }) => payrollPeriodsApi.getInputs(id, signal),
    enabled: enabled && !!id,
    staleTime: 15 * 1000,
  });

export const usePayrollPeriodSlips = (id: string, enabled = true) =>
  useQuery({
    queryKey: payrollPeriodsKeys.slips(id),
    queryFn: ({ signal }) => payrollPeriodsApi.getSlips(id, signal),
    enabled: enabled && !!id,
    staleTime: 30 * 1000,
  });

// ---- Mutations ----------------------------------------------------------

export const useCreatePayrollPeriod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePeriodDto) => payrollPeriodsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollPeriodsKeys.lists() }),
    onError: (err) => logger.error('createPayrollPeriod', err),
  });
};

export const useAggregateAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payrollPeriodsApi.aggregateAttendance(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: payrollPeriodsKeys.inputs(id) });
      qc.invalidateQueries({ queryKey: payrollPeriodsKeys.detail(id) });
    },
    onError: (err) => logger.error('aggregateAttendance', err),
  });
};

export const useOverridePayrollInput = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId, data }: { id: string; userId: string; data: OverrideInputDto }) =>
      payrollPeriodsApi.overrideInput(id, userId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: payrollPeriodsKeys.inputs(vars.id) });
    },
    onError: (err) => logger.error('overridePayrollInput', err),
  });
};

export const useCalculatePayrollPeriod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CalculatePeriodDto }) =>
      payrollPeriodsApi.calculate(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: payrollPeriodsKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: payrollPeriodsKeys.inputs(vars.id) });
      qc.invalidateQueries({ queryKey: payrollPeriodsKeys.slips(vars.id) });
      qc.invalidateQueries({ queryKey: payrollPeriodsKeys.lists() });
    },
    onError: (err) => logger.error('calculatePayrollPeriod', err),
  });
};

export const useClosePayrollPeriod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payrollPeriodsApi.close(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: payrollPeriodsKeys.detail(id) });
      qc.invalidateQueries({ queryKey: payrollPeriodsKeys.lists() });
      qc.invalidateQueries({ queryKey: payrollPeriodsKeys.slips(id) });
    },
    onError: (err) => logger.error('closePayrollPeriod', err),
  });
};
