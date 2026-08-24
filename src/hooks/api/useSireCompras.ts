import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sireComprasApi } from '@/services/api';
import type {
  CreateSireLinkDto,
  GetSireInvoicesParams,
  SireInvoiceAttachment,
  SireInvoiceDetail,
  SireInvoiceLink,
  SireInvoicesListResponse,
  SireRun,
  SireSyncBody,
} from '@/types/sireCompras';

// ============================================
// Query Keys Factory
// ============================================
export const sireComprasKeys = {
  all: ['sire-compras'] as const,

  // Invoices
  invoices: () => [...sireComprasKeys.all, 'invoices'] as const,
  invoiceList: (params?: GetSireInvoicesParams) =>
    [...sireComprasKeys.invoices(), 'list', params] as const,
  invoiceDetail: (id: string) => [...sireComprasKeys.invoices(), 'detail', id] as const,
  invoiceLinks: (id: string) => [...sireComprasKeys.invoices(), 'links', id] as const,
  invoiceAttachments: (id: string) => [...sireComprasKeys.invoices(), 'attachments', id] as const,
  invoiceSuggestions: (id: string, search?: string) =>
    [...sireComprasKeys.invoices(), 'suggestions', id, search ?? ''] as const,

  // Runs
  runs: () => [...sireComprasKeys.all, 'runs'] as const,
  runsList: (params?: { limit?: number; offset?: number }) =>
    [...sireComprasKeys.runs(), 'list', params] as const,
  runActive: () => [...sireComprasKeys.runs(), 'active'] as const,
  runDetail: (id: string) => [...sireComprasKeys.runs(), 'detail', id] as const,
};

const DEFAULT_STALE_TIME = 3 * 60 * 1000; // 3 min

// ============================================
// Queries
// ============================================

export const useSireInvoices = (params?: GetSireInvoicesParams) => {
  return useQuery<SireInvoicesListResponse>({
    queryKey: sireComprasKeys.invoiceList(params),
    queryFn: () => sireComprasApi.getInvoices(params),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

export const useSireInvoice = (id: string | undefined) => {
  return useQuery<SireInvoiceDetail>({
    queryKey: sireComprasKeys.invoiceDetail(id ?? ''),
    queryFn: () => sireComprasApi.getInvoice(id as string),
    enabled: !!id,
    staleTime: DEFAULT_STALE_TIME,
  });
};

export const useSireInvoiceLinks = (id: string | undefined) => {
  return useQuery<SireInvoiceLink[]>({
    queryKey: sireComprasKeys.invoiceLinks(id ?? ''),
    queryFn: () => sireComprasApi.getInvoiceLinks(id as string),
    enabled: !!id,
  });
};

export const useSireInvoiceAttachments = (id: string | undefined) => {
  return useQuery<SireInvoiceAttachment[]>({
    queryKey: sireComprasKeys.invoiceAttachments(id ?? ''),
    queryFn: () => sireComprasApi.getInvoiceAttachments(id as string),
    enabled: !!id,
  });
};

export const useSireInvoiceSuggestions = (id: string | undefined, search?: string) => {
  return useQuery({
    queryKey: sireComprasKeys.invoiceSuggestions(id ?? '', search),
    queryFn: () => sireComprasApi.getInvoiceSuggestions(id as string, { search }),
    enabled: !!id,
  });
};

export const useSireRuns = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: sireComprasKeys.runsList(params),
    queryFn: () => sireComprasApi.getRuns(params),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useSireActiveRun = (options?: { refetchIntervalMs?: number }) => {
  return useQuery({
    queryKey: sireComprasKeys.runActive(),
    queryFn: () => sireComprasApi.getActiveRun(),
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

export const useSireRun = (id: string | undefined, options?: { refetchIntervalMs?: number }) => {
  return useQuery({
    queryKey: sireComprasKeys.runDetail(id ?? ''),
    queryFn: () => sireComprasApi.getRun(id as string),
    enabled: !!id,
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

// ============================================
// Mutations
// ============================================

export const useSyncSireCompras = () => {
  const queryClient = useQueryClient();
  return useMutation<SireRun, Error, SireSyncBody | undefined>({
    mutationFn: (body) => sireComprasApi.syncPeriodo(body ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sireComprasKeys.runs() });
      queryClient.invalidateQueries({ queryKey: sireComprasKeys.invoices() });
    },
  });
};

export const useImportSireCompras = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      periodo,
    }: {
      file: { uri: string; name: string; type: string };
      periodo?: string;
    }) => sireComprasApi.importFile(file, periodo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sireComprasKeys.runs() });
      queryClient.invalidateQueries({ queryKey: sireComprasKeys.invoices() });
    },
  });
};

export const useCreateSireInvoiceLink = () => {
  const queryClient = useQueryClient();
  return useMutation<SireInvoiceLink, Error, { invoiceId: string; data: CreateSireLinkDto }>({
    mutationFn: ({ invoiceId, data }) => sireComprasApi.createInvoiceLink(invoiceId, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: sireComprasKeys.invoiceDetail(vars.invoiceId) });
      queryClient.invalidateQueries({ queryKey: sireComprasKeys.invoiceLinks(vars.invoiceId) });
      queryClient.invalidateQueries({ queryKey: sireComprasKeys.invoices() });
    },
  });
};

export const useDeleteSireInvoiceLink = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { invoiceId: string; linkId: string }>({
    mutationFn: ({ invoiceId, linkId }) => sireComprasApi.deleteInvoiceLink(invoiceId, linkId),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: sireComprasKeys.invoiceDetail(vars.invoiceId) });
      queryClient.invalidateQueries({ queryKey: sireComprasKeys.invoiceLinks(vars.invoiceId) });
      queryClient.invalidateQueries({ queryKey: sireComprasKeys.invoices() });
    },
  });
};

export const useUploadSireInvoiceAttachment = () => {
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
    }) => sireComprasApi.uploadInvoiceAttachment(invoiceId, file, { kind, notes }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({
        queryKey: sireComprasKeys.invoiceAttachments(vars.invoiceId),
      });
      queryClient.invalidateQueries({ queryKey: sireComprasKeys.invoiceDetail(vars.invoiceId) });
    },
  });
};

export const useDeleteSireInvoiceAttachment = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { invoiceId: string; attachmentId: string }>({
    mutationFn: ({ invoiceId, attachmentId }) =>
      sireComprasApi.deleteInvoiceAttachment(invoiceId, attachmentId),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({
        queryKey: sireComprasKeys.invoiceAttachments(vars.invoiceId),
      });
      queryClient.invalidateQueries({ queryKey: sireComprasKeys.invoiceDetail(vars.invoiceId) });
    },
  });
};
