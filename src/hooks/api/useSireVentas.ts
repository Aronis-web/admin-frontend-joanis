import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sireVentasApi } from '@/services/api';
import type {
  CreateSireVentasLinkDto,
  GetSireVentasInvoicesParams,
  GetSireVentasInvoicesSummaryByClientParams,
  GetSireVentasInvoicesSummaryParams,
  SireVentasInvoiceAttachment,
  SireVentasInvoiceDetail,
  SireVentasInvoiceLink,
  SireVentasInvoicesListResponse,
  SireVentasInvoicesSummaryByClientResponse,
  SireVentasInvoicesSummaryResponse,
  SireVentasRun,
  SireVentasSyncBody,
  SireVentasSyncRangeBody,
} from '@/types/sireVentas';

// ============================================
// Query Keys Factory
// ============================================
export const sireVentasKeys = {
  all: ['sire-ventas'] as const,

  // Invoices
  invoices: () => [...sireVentasKeys.all, 'invoices'] as const,
  invoiceList: (params?: GetSireVentasInvoicesParams) =>
    [...sireVentasKeys.invoices(), 'list', params] as const,
  invoiceDetail: (id: string) => [...sireVentasKeys.invoices(), 'detail', id] as const,
  invoiceLinks: (id: string) => [...sireVentasKeys.invoices(), 'links', id] as const,
  invoiceAttachments: (id: string) => [...sireVentasKeys.invoices(), 'attachments', id] as const,
  invoiceSuggestions: (id: string, search?: string) =>
    [...sireVentasKeys.invoices(), 'suggestions', id, search ?? ''] as const,
  invoicesSummary: (params?: GetSireVentasInvoicesSummaryParams) =>
    [...sireVentasKeys.invoices(), 'summary', params] as const,
  invoicesSummaryByClient: (params?: GetSireVentasInvoicesSummaryByClientParams) =>
    [...sireVentasKeys.invoices(), 'summary', 'by-client', params] as const,

  // Runs
  runs: () => [...sireVentasKeys.all, 'runs'] as const,
  runsList: (params?: { limit?: number; offset?: number }) =>
    [...sireVentasKeys.runs(), 'list', params] as const,
  runActive: () => [...sireVentasKeys.runs(), 'active'] as const,
  runDetail: (id: string) => [...sireVentasKeys.runs(), 'detail', id] as const,
};

const DEFAULT_STALE_TIME = 3 * 60 * 1000; // 3 min

// ============================================
// Queries
// ============================================

export const useSireVentasInvoices = (params?: GetSireVentasInvoicesParams) => {
  return useQuery<SireVentasInvoicesListResponse>({
    queryKey: sireVentasKeys.invoiceList(params),
    queryFn: () => sireVentasApi.getInvoices(params),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

export const useSireVentasInvoice = (id: string | undefined) => {
  return useQuery<SireVentasInvoiceDetail>({
    queryKey: sireVentasKeys.invoiceDetail(id ?? ''),
    queryFn: () => sireVentasApi.getInvoice(id as string),
    enabled: !!id,
    staleTime: DEFAULT_STALE_TIME,
  });
};

export const useSireVentasInvoiceLinks = (id: string | undefined) => {
  return useQuery<SireVentasInvoiceLink[]>({
    queryKey: sireVentasKeys.invoiceLinks(id ?? ''),
    queryFn: () => sireVentasApi.getInvoiceLinks(id as string),
    enabled: !!id,
  });
};

export const useSireVentasInvoiceAttachments = (id: string | undefined) => {
  return useQuery<SireVentasInvoiceAttachment[]>({
    queryKey: sireVentasKeys.invoiceAttachments(id ?? ''),
    queryFn: () => sireVentasApi.getInvoiceAttachments(id as string),
    enabled: !!id,
  });
};

export const useSireVentasInvoiceSuggestions = (id: string | undefined, search?: string) => {
  return useQuery({
    queryKey: sireVentasKeys.invoiceSuggestions(id ?? '', search),
    queryFn: () => sireVentasApi.getInvoiceSuggestions(id as string, { search }),
    enabled: !!id,
  });
};

export const useSireVentasInvoicesSummary = (
  params?: GetSireVentasInvoicesSummaryParams,
  options?: { enabled?: boolean }
) => {
  return useQuery<SireVentasInvoicesSummaryResponse>({
    queryKey: sireVentasKeys.invoicesSummary(params),
    queryFn: () => sireVentasApi.getInvoicesSummary(params),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
};

export const useSireVentasInvoicesSummaryByClient = (
  params?: GetSireVentasInvoicesSummaryByClientParams,
  options?: { enabled?: boolean }
) => {
  return useQuery<SireVentasInvoicesSummaryByClientResponse>({
    queryKey: sireVentasKeys.invoicesSummaryByClient(params),
    queryFn: () => sireVentasApi.getInvoicesSummaryByClient(params),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
};

export const useSireVentasRuns = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: sireVentasKeys.runsList(params),
    queryFn: () => sireVentasApi.getRuns(params),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useSireVentasActiveRun = (options?: { refetchIntervalMs?: number }) => {
  return useQuery({
    queryKey: sireVentasKeys.runActive(),
    queryFn: () => sireVentasApi.getActiveRun(),
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

export const useSireVentasRun = (
  id: string | undefined,
  options?: { refetchIntervalMs?: number }
) => {
  return useQuery({
    queryKey: sireVentasKeys.runDetail(id ?? ''),
    queryFn: () => sireVentasApi.getRun(id as string),
    enabled: !!id,
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

// ============================================
// Mutations
// ============================================

export const useSyncSireVentas = () => {
  const queryClient = useQueryClient();
  return useMutation<SireVentasRun, Error, SireVentasSyncBody | undefined>({
    mutationFn: (body) => sireVentasApi.syncPeriodo(body ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sireVentasKeys.runs() });
      queryClient.invalidateQueries({ queryKey: sireVentasKeys.invoices() });
    },
  });
};

export const useSyncRangeSireVentas = () => {
  const queryClient = useQueryClient();
  return useMutation<SireVentasRun, Error, SireVentasSyncRangeBody>({
    mutationFn: (body) => sireVentasApi.syncRange(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sireVentasKeys.runs() });
      queryClient.invalidateQueries({ queryKey: sireVentasKeys.invoices() });
    },
  });
};

export const useImportSireVentas = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      periodo,
    }: {
      file: { uri: string; name: string; type: string };
      periodo?: string;
    }) => sireVentasApi.importFile(file, periodo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sireVentasKeys.runs() });
      queryClient.invalidateQueries({ queryKey: sireVentasKeys.invoices() });
    },
  });
};

export const useCreateSireVentasInvoiceLink = () => {
  const queryClient = useQueryClient();
  return useMutation<
    SireVentasInvoiceLink,
    Error,
    { invoiceId: string; data: CreateSireVentasLinkDto }
  >({
    mutationFn: ({ invoiceId, data }) => sireVentasApi.createInvoiceLink(invoiceId, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({
        queryKey: sireVentasKeys.invoiceDetail(vars.invoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: sireVentasKeys.invoiceLinks(vars.invoiceId),
      });
      queryClient.invalidateQueries({ queryKey: sireVentasKeys.invoices() });
    },
  });
};

export const useDeleteSireVentasInvoiceLink = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { invoiceId: string; linkId: string }>({
    mutationFn: ({ invoiceId, linkId }) => sireVentasApi.deleteInvoiceLink(invoiceId, linkId),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({
        queryKey: sireVentasKeys.invoiceDetail(vars.invoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: sireVentasKeys.invoiceLinks(vars.invoiceId),
      });
      queryClient.invalidateQueries({ queryKey: sireVentasKeys.invoices() });
    },
  });
};

export const useUploadSireVentasInvoiceAttachment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      invoiceId,
      file,
      kind,
      notes,
    }: {
      invoiceId: string;
      file: { uri: string; name: string; type: string };
      kind?: string;
      notes?: string;
    }) => sireVentasApi.uploadInvoiceAttachment(invoiceId, file, { kind, notes }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({
        queryKey: sireVentasKeys.invoiceAttachments(vars.invoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: sireVentasKeys.invoiceDetail(vars.invoiceId),
      });
    },
  });
};

export const useDeleteSireVentasInvoiceAttachment = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { invoiceId: string; attachmentId: string }>({
    mutationFn: ({ invoiceId, attachmentId }) =>
      sireVentasApi.deleteInvoiceAttachment(invoiceId, attachmentId),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({
        queryKey: sireVentasKeys.invoiceAttachments(vars.invoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: sireVentasKeys.invoiceDetail(vars.invoiceId),
      });
    },
  });
};
