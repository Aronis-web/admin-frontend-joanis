/**
 * Izipay Report Sync — cliente HTTP.
 * Backend: svc-admin base path /izipay-report-sync (sin prefijo global).
 */
import { apiClient } from './client';

// ============================================================================
// Types
// ============================================================================

export type IzipayRunStatus = 'running' | 'ok' | 'partial' | 'error';

export interface IzipayRun {
  id: string;
  triggeredByUserId: string;
  commerceCode: string; // "ALL" o code específico
  syncDate: string; // "YYYY-MM"
  status: IzipayRunStatus;
  totalRows: number;
  newRows: number;
  dupRows: number;
  errorRows: number;
  fileName: string | null;
  startedAt: string;
  finishedAt: string | null;
  errorMsg: string | null;
}

export interface IzipaySyncBody {
  /** Bearer del panel Izipay, SIN prefijo "Bearer ". 20–4000 chars. */
  token: string;
  /** "01".."12". Requiere year. Default: mes actual (Lima). */
  month?: string;
  /** "YYYY". Requiere month. */
  year?: string;
  /** Un comercio específico; si se omite, todos los del token. */
  commerceCode?: string;
}

export interface IzipaySyncResponse {
  runId: string;
  status: IzipayRunStatus;
  month: string;
  year: string;
  commerceCode: string | null;
}

export interface IzipayActiveRunConflict {
  message: string;
  activeRunId: string;
  status: IzipayRunStatus;
  startedAt: string;
}

export interface IzipayActiveResponse {
  active: IzipayRun | null;
}

export interface IzipayRunsList {
  items: IzipayRun[];
  total: number;
}

// ============================================================================
// API
// ============================================================================

const BASE = '/izipay-report-sync';

export const izipayReportSyncApi = {
  /**
   * Dispara la sincronización mensual de Izipay (fire-and-forget → 202).
   * @throws AxiosError con status 409 (activeRunId disponible en response.data)
   */
  sync: async (body: IzipaySyncBody): Promise<IzipaySyncResponse> => {
    return apiClient.post<IzipaySyncResponse>(`${BASE}/sync`, body);
  },

  /** Estado detallado de un run (endpoint de polling). */
  getRun: async (id: string): Promise<IzipayRun> => {
    return apiClient.get<IzipayRun>(`${BASE}/runs/${id}`);
  },

  /** Devuelve el run activo (o null). */
  getActiveRun: async (): Promise<IzipayActiveResponse> => {
    return apiClient.get<IzipayActiveResponse>(`${BASE}/runs/active`);
  },

  /** Historial paginado (más reciente primero). */
  getRuns: async (params?: { limit?: number; offset?: number }): Promise<IzipayRunsList> => {
    return apiClient.get<IzipayRunsList>(`${BASE}/runs`, { params });
  },
};
