import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sunatGreApi } from '@/services/api/sunat-gre';
import type {
  GetSunatGreParams,
  SunatGreDetail,
  SunatGreListResponse,
  SunatGreRun,
  SunatGreRunsListResponse,
} from '@/types/sunatGre';

export const sunatGreKeys = {
  all: ['sunat-gre'] as const,
  invoices: () => [...sunatGreKeys.all, 'invoices'] as const,
  invoiceList: (params?: GetSunatGreParams) =>
    [...sunatGreKeys.invoices(), 'list', params] as const,
  invoiceDetail: (id: string) => [...sunatGreKeys.invoices(), 'detail', id] as const,
  runs: () => [...sunatGreKeys.all, 'runs'] as const,
  runsList: (params?: { limit?: number; offset?: number }) =>
    [...sunatGreKeys.runs(), 'list', params] as const,
};

const DEFAULT_STALE_TIME = 3 * 60 * 1000;

export const useSunatGre = (params?: GetSunatGreParams) =>
  useQuery<SunatGreListResponse>({
    queryKey: sunatGreKeys.invoiceList(params),
    queryFn: () => sunatGreApi.getInvoices(params),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
  });

export const useSunatGreInvoice = (id: string | undefined) =>
  useQuery<SunatGreDetail>({
    queryKey: sunatGreKeys.invoiceDetail(id ?? ''),
    queryFn: () => sunatGreApi.getInvoice(id as string),
    enabled: !!id,
    staleTime: DEFAULT_STALE_TIME,
  });

export const useSunatGreRuns = (params?: { limit?: number; offset?: number }) =>
  useQuery<SunatGreRunsListResponse>({
    queryKey: sunatGreKeys.runsList(params),
    queryFn: () => sunatGreApi.getRuns(params),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useImportSunatGre = () => {
  const queryClient = useQueryClient();
  return useMutation<SunatGreRun, Error, { file: { uri: string; name: string; type: string } }>({
    mutationFn: ({ file }) => sunatGreApi.importFile(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sunatGreKeys.invoices() });
      queryClient.invalidateQueries({ queryKey: sunatGreKeys.runs() });
    },
  });
};
