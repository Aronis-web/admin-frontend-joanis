import { apiClient } from './client';

// ============================================================================
// Types
// ============================================================================

export type ExternalSalesInvoiceType = '01' | '03' | '07' | 'nv';

export type ExternalSalesRunStatus = 'queued' | 'running' | 'ok' | 'partial' | 'error';

export interface ExternalSalesPerSiteResult {
  sourceId: string;
  siteId: string;
  siteName: string;
  ok: boolean;
  totalRows: number;
  newRows: number;
  dupRows: number;
  errorRows: number;
  message?: string;
  finishedAt?: string | null;
}

export interface ExternalSalesRun {
  id: string;
  triggeredByUserId: string;
  syncDate: string;
  status: ExternalSalesRunStatus;
  totalSites: number;
  processedSites: number;
  totalRows: number;
  newRows: number;
  dupRows: number;
  errorRows: number;
  startedAt: string;
  finishedAt: string | null;
  errorMsg: string | null;
  perSiteResult: ExternalSalesPerSiteResult[];
}

export interface ExternalSalesSource {
  id: string;
  siteId: string;
  siteName: string;
  siteCode?: string | null;
  provider: string;
  tenantSubdomain: string;
  warehouseId: number;
  active: boolean;
  apiEmail: string;
  credentialsConfigured: boolean;
  lastSyncAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalSalesSyncBody {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  invoiceTypes?: ExternalSalesInvoiceType[];
  siteIds?: string[];
}

export interface ExternalSalesSyncResponse {
  runId: string;
  status: ExternalSalesRunStatus;
  totalSites: number;
  dateFrom?: string;
  dateTo?: string;
  invoiceTypes?: ExternalSalesInvoiceType[];
}

export interface ExternalSalesActiveRunConflict {
  statusCode: 409;
  message: string;
  activeRunId: string;
  startedAt: string;
  processedSites: number;
  totalSites: number;
  syncDate: string;
}

export interface ExternalSalesActiveResponse {
  active: ExternalSalesRun | null;
}

export interface ExternalSalesRunsList {
  items: ExternalSalesRun[];
  total: number;
}

export interface UpsertExternalSalesSourceDto {
  siteId: string;
  provider: string;
  tenantSubdomain: string;
  warehouseId: number;
  apiEmail: string;
  apiPassword?: string;
  active?: boolean;
  notes?: string | null;
}

// ============================================================================
// API
// ============================================================================

const BASE = '/external-sales';

export const externalSalesApi = {
  /**
   * Dispara la sincronización de ventas externas.
   * @throws AxiosError con status 409 (activeRunId disponible en response.data)
   */
  sync: async (body: ExternalSalesSyncBody): Promise<ExternalSalesSyncResponse> => {
    return apiClient.post<ExternalSalesSyncResponse>(`${BASE}/sync`, body);
  },

  /** Devuelve el run en curso (o null). */
  getActiveRun: async (): Promise<ExternalSalesActiveResponse> => {
    return apiClient.get<ExternalSalesActiveResponse>(`${BASE}/runs/active`);
  },

  /** Estado detallado de un run (endpoint de polling). */
  getRun: async (id: string): Promise<ExternalSalesRun> => {
    return apiClient.get<ExternalSalesRun>(`${BASE}/runs/${id}`);
  },

  /** Historial paginado de runs (más reciente primero). */
  getRuns: async (params?: { limit?: number; offset?: number }): Promise<ExternalSalesRunsList> => {
    return apiClient.get<ExternalSalesRunsList>(`${BASE}/runs`, { params });
  },

  /** Lista de sedes configuradas. */
  getSources: async (): Promise<ExternalSalesSource[]> => {
    return apiClient.get<ExternalSalesSource[]>(`${BASE}/sources`);
  },

  /** Alta o edición (upsert por siteId+provider). */
  upsertSource: async (data: UpsertExternalSalesSourceDto): Promise<ExternalSalesSource> => {
    return apiClient.post<ExternalSalesSource>(`${BASE}/sources`, data);
  },

  /** Soft-delete (active=false). */
  deleteSource: async (id: string): Promise<{ id: string; active: boolean }> => {
    return apiClient.delete<{ id: string; active: boolean }>(`${BASE}/sources/${id}`);
  },
};
