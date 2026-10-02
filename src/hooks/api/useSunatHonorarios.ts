import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sunatHonorariosApi } from '@/services/api/sunat-honorarios';
import type {
  GetSunatHonorariosParams,
  SunatHonorariosListResponse,
  SunatHonorariosRun,
  SunatHonorariosSummary,
} from '@/types/sunatHonorarios';

export const sunatHonorariosKeys = {
  all: ['sunat-honorarios'] as const,
  invoices: () => [...sunatHonorariosKeys.all, 'invoices'] as const,
  invoiceList: (params?: GetSunatHonorariosParams) =>
    [...sunatHonorariosKeys.invoices(), 'list', params] as const,
  summary: (periodo?: string) => [...sunatHonorariosKeys.invoices(), 'summary', periodo ?? ''] as const,
  runs: () => [...sunatHonorariosKeys.all, 'runs'] as const,
};

const DEFAULT_STALE_TIME = 3 * 60 * 1000;

export const useSunatHonorarios = (params?: GetSunatHonorariosParams) =>
  useQuery<SunatHonorariosListResponse>({
    queryKey: sunatHonorariosKeys.invoiceList(params),
    queryFn: () => sunatHonorariosApi.getInvoices(params),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
  });

export const useSunatHonorariosSummary = (periodo?: string) =>
  useQuery<SunatHonorariosSummary>({
    queryKey: sunatHonorariosKeys.summary(periodo),
    queryFn: () => sunatHonorariosApi.getSummary(periodo),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
  });

export const useImportSunatHonorarios = () => {
  const queryClient = useQueryClient();
  return useMutation<
    SunatHonorariosRun,
    Error,
    { file: { uri: string; name: string; type: string }; periodo?: string }
  >({
    mutationFn: ({ file, periodo }) => sunatHonorariosApi.importFile(file, periodo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sunatHonorariosKeys.invoices() });
      queryClient.invalidateQueries({ queryKey: sunatHonorariosKeys.runs() });
    },
  });
};
