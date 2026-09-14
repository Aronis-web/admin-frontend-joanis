import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payrollConfigApi } from '@/services/api/payroll-config';
import { logger } from '@/utils/logger';
import type {
  UpsertAfpRateDto,
  UpsertConceptDto,
  UpsertParameterDto,
  UpsertTaxBracketDto,
} from '@/types/payroll';

export const payrollConfigKeys = {
  all: ['payroll', 'config'] as const,
  afpRates: () => [...payrollConfigKeys.all, 'afp-rates'] as const,
  parameters: () => [...payrollConfigKeys.all, 'parameters'] as const,
  taxBrackets: (year: number) => [...payrollConfigKeys.all, 'tax-brackets', year] as const,
  concepts: () => [...payrollConfigKeys.all, 'concepts'] as const,
};

export const usePayrollAfpRates = () =>
  useQuery({
    queryKey: payrollConfigKeys.afpRates(),
    queryFn: () => payrollConfigApi.listAfpRates(),
    staleTime: 5 * 60 * 1000,
  });

export const usePayrollParameters = () =>
  useQuery({
    queryKey: payrollConfigKeys.parameters(),
    queryFn: () => payrollConfigApi.listParameters(),
    staleTime: 5 * 60 * 1000,
  });

export const usePayrollTaxBrackets = (year: number, enabled = true) =>
  useQuery({
    queryKey: payrollConfigKeys.taxBrackets(year),
    queryFn: () => payrollConfigApi.listTaxBrackets(year),
    enabled: enabled && !!year,
    staleTime: 5 * 60 * 1000,
  });

export const usePayrollConcepts = () =>
  useQuery({
    queryKey: payrollConfigKeys.concepts(),
    queryFn: () => payrollConfigApi.listConcepts(),
    staleTime: 5 * 60 * 1000,
  });

export const useUpsertAfpRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertAfpRateDto) => payrollConfigApi.upsertAfpRate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollConfigKeys.afpRates() }),
    onError: (err) => logger.error('upsertAfpRate', err),
  });
};

export const useUpsertPayrollParameter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertParameterDto) => payrollConfigApi.upsertParameter(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollConfigKeys.parameters() }),
    onError: (err) => logger.error('upsertPayrollParameter', err),
  });
};

export const useUpsertTaxBracket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertTaxBracketDto) => payrollConfigApi.upsertTaxBracket(data),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: payrollConfigKeys.taxBrackets(vars.year) }),
    onError: (err) => logger.error('upsertTaxBracket', err),
  });
};

export const useUpsertPayrollConcept = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertConceptDto) => payrollConfigApi.upsertConcept(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollConfigKeys.concepts() }),
    onError: (err) => logger.error('upsertPayrollConcept', err),
  });
};
