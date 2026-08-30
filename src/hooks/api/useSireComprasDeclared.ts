import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sireComprasDeclaredApi } from '@/services/api';
import type {
  GetSireComprasDeclaredInvoicesParams,
  GetSireComprasDeclaredInvoicesSummaryParams,
  SireComprasDeclaredInvoicesListResponse,
  SireComprasDeclaredInvoicesSummaryResponse,
  SireComprasDeclaredSyncBody,
  SireComprasDeclaredSyncRangeBody,
  SireComprasDeclaredSyncRangeResponse,
  SireComprasDeclaredSyncResponse,
} from '@/types/sireComprasDeclared';

// ============================================
// Query Keys Factory
// ============================================
export const sireComprasDeclaredKeys = {
  all: ['sire-compras-declared'] as const,

  // Invoices
  invoices: () => [...sireComprasDeclaredKeys.all, 'invoices'] as const,
  invoiceList: (params?: GetSireComprasDeclaredInvoicesParams) =>
    [...sireComprasDeclaredKeys.invoices(), 'list', params] as const,
  invoicesSummary: (params?: GetSireComprasDeclaredInvoicesSummaryParams) =>
    [...sireComprasDeclaredKeys.invoices(), 'summary', params] as const,

  // Runs
  runs: () => [...sireComprasDeclaredKeys.all, 'runs'] as const,
  runsList: (params?: { limit?: number; offset?: number }) =>
    [...sireComprasDeclaredKeys.runs(), 'list', params] as const,
  runActive: () => [...sireComprasDeclaredKeys.runs(), 'active'] as const,
  runDetail: (id: string) => [...sireComprasDeclaredKeys.runs(), 'detail', id] as const,
};

const DEFAULT_STALE_TIME = 3 * 60 * 1000; // 3 min

// ============================================
// Queries
// ============================================

export const useSireComprasDeclaredInvoices = (params?: GetSireComprasDeclaredInvoicesParams) => {
  return useQuery<SireComprasDeclaredInvoicesListResponse>({
    queryKey: sireComprasDeclaredKeys.invoiceList(params),
    queryFn: () => sireComprasDeclaredApi.getInvoices(params),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

export const useSireComprasDeclaredInvoicesSummary = (
  params?: GetSireComprasDeclaredInvoicesSummaryParams,
  options?: { enabled?: boolean }
) => {
  return useQuery<SireComprasDeclaredInvoicesSummaryResponse>({
    queryKey: sireComprasDeclaredKeys.invoicesSummary(params),
    queryFn: () => sireComprasDeclaredApi.getInvoicesSummary(params),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
};

export const useSireComprasDeclaredRuns = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: sireComprasDeclaredKeys.runsList(params),
    queryFn: () => sireComprasDeclaredApi.getRuns(params),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useSireComprasDeclaredActiveRun = (options?: { refetchIntervalMs?: number }) => {
  return useQuery({
    queryKey: sireComprasDeclaredKeys.runActive(),
    queryFn: () => sireComprasDeclaredApi.getActiveRun(),
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

export const useSireComprasDeclaredRun = (
  id: string | undefined,
  options?: { refetchIntervalMs?: number }
) => {
  return useQuery({
    queryKey: sireComprasDeclaredKeys.runDetail(id ?? ''),
    queryFn: () => sireComprasDeclaredApi.getRun(id as string),
    enabled: !!id,
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

// ============================================
// Mutations
// ============================================

export const useSyncSireComprasDeclared = () => {
  const queryClient = useQueryClient();
  return useMutation<
    SireComprasDeclaredSyncResponse,
    Error,
    SireComprasDeclaredSyncBody | undefined
  >({
    mutationFn: (body) => sireComprasDeclaredApi.syncPeriodo(body ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sireComprasDeclaredKeys.runs() });
      queryClient.invalidateQueries({ queryKey: sireComprasDeclaredKeys.invoices() });
    },
  });
};

export const useSyncRangeSireComprasDeclared = () => {
  const queryClient = useQueryClient();
  return useMutation<SireComprasDeclaredSyncRangeResponse, Error, SireComprasDeclaredSyncRangeBody>(
    {
      mutationFn: (body) => sireComprasDeclaredApi.syncRange(body),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sireComprasDeclaredKeys.runs() });
        queryClient.invalidateQueries({ queryKey: sireComprasDeclaredKeys.invoices() });
      },
    }
  );
};

export const useImportSireComprasDeclared = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      periodo,
    }: {
      file: { uri: string; name: string; type: string };
      periodo?: string;
    }) => sireComprasDeclaredApi.importFile(file, periodo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sireComprasDeclaredKeys.runs() });
      queryClient.invalidateQueries({ queryKey: sireComprasDeclaredKeys.invoices() });
    },
  });
};
