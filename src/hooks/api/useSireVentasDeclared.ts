import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sireVentasDeclaredApi } from '@/services/api';
import type {
  GetSireVentasDeclaredInvoicesParams,
  GetSireVentasDeclaredInvoicesSummaryParams,
  SireVentasDeclaredInvoicesListResponse,
  SireVentasDeclaredInvoicesSummaryResponse,
  SireVentasDeclaredSyncBody,
  SireVentasDeclaredSyncRangeBody,
  SireVentasDeclaredSyncRangeResponse,
  SireVentasDeclaredSyncResponse,
} from '@/types/sireVentasDeclared';

// ============================================
// Query Keys Factory
// ============================================
export const sireVentasDeclaredKeys = {
  all: ['sire-ventas-declared'] as const,

  // Invoices
  invoices: () => [...sireVentasDeclaredKeys.all, 'invoices'] as const,
  invoiceList: (params?: GetSireVentasDeclaredInvoicesParams) =>
    [...sireVentasDeclaredKeys.invoices(), 'list', params] as const,
  invoicesSummary: (params?: GetSireVentasDeclaredInvoicesSummaryParams) =>
    [...sireVentasDeclaredKeys.invoices(), 'summary', params] as const,

  // Runs
  runs: () => [...sireVentasDeclaredKeys.all, 'runs'] as const,
  runsList: (params?: { limit?: number; offset?: number }) =>
    [...sireVentasDeclaredKeys.runs(), 'list', params] as const,
  runActive: () => [...sireVentasDeclaredKeys.runs(), 'active'] as const,
  runDetail: (id: string) => [...sireVentasDeclaredKeys.runs(), 'detail', id] as const,
};

const DEFAULT_STALE_TIME = 3 * 60 * 1000; // 3 min

// ============================================
// Queries
// ============================================

export const useSireVentasDeclaredInvoices = (params?: GetSireVentasDeclaredInvoicesParams) => {
  return useQuery<SireVentasDeclaredInvoicesListResponse>({
    queryKey: sireVentasDeclaredKeys.invoiceList(params),
    queryFn: () => sireVentasDeclaredApi.getInvoices(params),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

export const useSireVentasDeclaredInvoicesSummary = (
  params?: GetSireVentasDeclaredInvoicesSummaryParams,
  options?: { enabled?: boolean }
) => {
  return useQuery<SireVentasDeclaredInvoicesSummaryResponse>({
    queryKey: sireVentasDeclaredKeys.invoicesSummary(params),
    queryFn: () => sireVentasDeclaredApi.getInvoicesSummary(params),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
};

export const useSireVentasDeclaredRuns = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: sireVentasDeclaredKeys.runsList(params),
    queryFn: () => sireVentasDeclaredApi.getRuns(params),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useSireVentasDeclaredActiveRun = (options?: { refetchIntervalMs?: number }) => {
  return useQuery({
    queryKey: sireVentasDeclaredKeys.runActive(),
    queryFn: () => sireVentasDeclaredApi.getActiveRun(),
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

export const useSireVentasDeclaredRun = (
  id: string | undefined,
  options?: { refetchIntervalMs?: number }
) => {
  return useQuery({
    queryKey: sireVentasDeclaredKeys.runDetail(id ?? ''),
    queryFn: () => sireVentasDeclaredApi.getRun(id as string),
    enabled: !!id,
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

// ============================================
// Mutations
// ============================================

export const useSyncSireVentasDeclared = () => {
  const queryClient = useQueryClient();
  return useMutation<SireVentasDeclaredSyncResponse, Error, SireVentasDeclaredSyncBody | undefined>(
    {
      mutationFn: (body) => sireVentasDeclaredApi.syncPeriodo(body ?? {}),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sireVentasDeclaredKeys.runs() });
        queryClient.invalidateQueries({ queryKey: sireVentasDeclaredKeys.invoices() });
      },
    }
  );
};

export const useSyncRangeSireVentasDeclared = () => {
  const queryClient = useQueryClient();
  return useMutation<SireVentasDeclaredSyncRangeResponse, Error, SireVentasDeclaredSyncRangeBody>({
    mutationFn: (body) => sireVentasDeclaredApi.syncRange(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sireVentasDeclaredKeys.runs() });
      queryClient.invalidateQueries({ queryKey: sireVentasDeclaredKeys.invoices() });
    },
  });
};

export const useImportSireVentasDeclared = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      periodo,
    }: {
      file: { uri: string; name: string; type: string };
      periodo?: string;
    }) => sireVentasDeclaredApi.importFile(file, periodo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sireVentasDeclaredKeys.runs() });
      queryClient.invalidateQueries({ queryKey: sireVentasDeclaredKeys.invoices() });
    },
  });
};
