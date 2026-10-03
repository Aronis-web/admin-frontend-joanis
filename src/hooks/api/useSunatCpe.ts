import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sunatCpeApi } from '@/services/api/sunat-cpe';
import type {
  GetSunatCpeInvoicesParams,
  SunatCpeInvoiceDetail,
  SunatCpeListResponse,
  SunatCpeRun,
  SunatCpeRunsListResponse,
  SunatCpeSyncRangeRequest,
  SunatCpeSyncRangeResponse,
} from '@/types/sunatCpe';

export const sunatCpeKeys = {
  all: ['sunat-cpe'] as const,
  invoices: () => [...sunatCpeKeys.all, 'invoices'] as const,
  invoiceList: (params?: GetSunatCpeInvoicesParams) =>
    [...sunatCpeKeys.invoices(), 'list', params] as const,
  invoiceDetail: (id: string) => [...sunatCpeKeys.invoices(), 'detail', id] as const,
  runs: () => [...sunatCpeKeys.all, 'runs'] as const,
  runsList: (params?: { limit?: number; offset?: number }) =>
    [...sunatCpeKeys.runs(), 'list', params] as const,
};

const DEFAULT_STALE_TIME = 3 * 60 * 1000;

export const useSunatCpeInvoices = (params?: GetSunatCpeInvoicesParams) =>
  useQuery<SunatCpeListResponse>({
    queryKey: sunatCpeKeys.invoiceList(params),
    queryFn: () => sunatCpeApi.getInvoices(params),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
  });

export const useSunatCpeInvoice = (id: string | undefined) =>
  useQuery<SunatCpeInvoiceDetail>({
    queryKey: sunatCpeKeys.invoiceDetail(id ?? ''),
    queryFn: () => sunatCpeApi.getInvoice(id as string),
    enabled: !!id,
    staleTime: DEFAULT_STALE_TIME,
  });

export const useSunatCpeRuns = (params?: { limit?: number; offset?: number }) =>
  useQuery<SunatCpeRunsListResponse>({
    queryKey: sunatCpeKeys.runsList(params),
    queryFn: () => sunatCpeApi.getRuns(params),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useImportSunatCpe = () => {
  const queryClient = useQueryClient();
  return useMutation<SunatCpeRun, Error, { file: { uri: string; name: string; type: string } }>({
    mutationFn: ({ file }) => sunatCpeApi.importFile(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sunatCpeKeys.invoices() });
      queryClient.invalidateQueries({ queryKey: sunatCpeKeys.runs() });
    },
  });
};

export const useSyncRangeSunatCpe = () => {
  const queryClient = useQueryClient();
  return useMutation<SunatCpeSyncRangeResponse, Error, SunatCpeSyncRangeRequest>({
    mutationFn: (body) => sunatCpeApi.syncRange(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sunatCpeKeys.invoices() });
      queryClient.invalidateQueries({ queryKey: sunatCpeKeys.runs() });
    },
  });
};
