import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { payrollOvertimeApi } from '@/services/api/payroll-overtime';
import { logger } from '@/utils/logger';
import type { CreateOvertimeDto, OvertimeListParams } from '@/types/payroll';

export const payrollOvertimeKeys = {
  all: ['payroll', 'overtime'] as const,
  lists: () => [...payrollOvertimeKeys.all, 'list'] as const,
  list: (p?: OvertimeListParams) => [...payrollOvertimeKeys.lists(), p ?? {}] as const,
};

export const usePayrollOvertime = (params?: OvertimeListParams, enabled = true) =>
  useQuery({
    queryKey: payrollOvertimeKeys.list(params),
    queryFn: ({ signal }) => payrollOvertimeApi.list(params, signal),
    enabled,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

export const useCreatePayrollOvertime = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOvertimeDto) => payrollOvertimeApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollOvertimeKeys.lists() }),
    onError: (err) => logger.error('createPayrollOvertime', err),
  });
};
