import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { payrollApprovalsApi } from '@/services/api/payroll-approvals';
import { logger } from '@/utils/logger';
import type { ApprovalDecisionDto, ApprovalListParams } from '@/types/payroll';
import { payrollVacationsKeys } from './usePayrollVacations';
import { payrollAbsencesKeys } from './usePayrollAbsences';
import { payrollOvertimeKeys } from './usePayrollOvertime';
import { payrollEmploymentKeys } from './usePayrollEmployment';
import { payrollPeriodsKeys } from './usePayrollPeriods';

export const payrollApprovalsKeys = {
  all: ['payroll', 'approvals'] as const,
  lists: () => [...payrollApprovalsKeys.all, 'list'] as const,
  list: (p?: ApprovalListParams) => [...payrollApprovalsKeys.lists(), p ?? {}] as const,
};

export const usePayrollApprovals = (params?: ApprovalListParams, enabled = true) =>
  useQuery({
    queryKey: payrollApprovalsKeys.list(params),
    queryFn: ({ signal }) => payrollApprovalsApi.list(params, signal),
    enabled,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

/** Invalida cualquier subdominio que pueda haber cambiado al decidir. */
function invalidateAfterDecision(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: payrollApprovalsKeys.all });
  qc.invalidateQueries({ queryKey: payrollVacationsKeys.all });
  qc.invalidateQueries({ queryKey: payrollAbsencesKeys.all });
  qc.invalidateQueries({ queryKey: payrollOvertimeKeys.all });
  qc.invalidateQueries({ queryKey: payrollEmploymentKeys.all });
  qc.invalidateQueries({ queryKey: payrollPeriodsKeys.all });
}

export const useApprovePayroll = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovalDecisionDto }) =>
      payrollApprovalsApi.approve(id, data),
    onSuccess: () => invalidateAfterDecision(qc),
    onError: (err) => logger.error('approvePayroll', err),
  });
};

export const useRejectPayroll = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovalDecisionDto }) =>
      payrollApprovalsApi.reject(id, data),
    onSuccess: () => invalidateAfterDecision(qc),
    onError: (err) => logger.error('rejectPayroll', err),
  });
};
