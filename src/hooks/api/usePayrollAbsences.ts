import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { payrollAbsencesApi } from '@/services/api/payroll-absences';
import { logger } from '@/utils/logger';
import type { AbsenceFileInput, AbsenceListParams, CreateAbsenceDto } from '@/types/payroll';

export const payrollAbsencesKeys = {
  all: ['payroll', 'absences'] as const,
  lists: () => [...payrollAbsencesKeys.all, 'list'] as const,
  list: (p?: AbsenceListParams) => [...payrollAbsencesKeys.lists(), p ?? {}] as const,
};

export const usePayrollAbsences = (params?: AbsenceListParams, enabled = true) =>
  useQuery({
    queryKey: payrollAbsencesKeys.list(params),
    queryFn: ({ signal }) => payrollAbsencesApi.list(params, signal),
    enabled,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

export const useCreatePayrollAbsence = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      file,
    }: {
      data: CreateAbsenceDto;
      file?: File | Blob | AbsenceFileInput;
    }) => payrollAbsencesApi.create(data, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollAbsencesKeys.lists() }),
    onError: (err) => logger.error('createPayrollAbsence', err),
  });
};
