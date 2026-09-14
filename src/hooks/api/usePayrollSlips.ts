import { useQuery } from '@tanstack/react-query';
import { payrollSlipsApi } from '@/services/api/payroll-slips';

export const payrollSlipsKeys = {
  all: ['payroll', 'slips'] as const,
  detail: (slipId: string) => [...payrollSlipsKeys.all, 'detail', slipId] as const,
};

export const usePayrollSlip = (slipId: string, enabled = true) =>
  useQuery({
    queryKey: payrollSlipsKeys.detail(slipId),
    queryFn: () => payrollSlipsApi.getById(slipId),
    enabled: enabled && !!slipId,
    staleTime: 60 * 1000,
  });
