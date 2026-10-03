import { apiClient } from './client';
import type {
  GetSunatCpeInvoicesParams,
  SunatCpeInvoiceDetail,
  SunatCpeListResponse,
  SunatCpeRun,
  SunatCpeRunsListResponse,
  SunatCpeSyncRangeRequest,
  SunatCpeSyncRangeResponse,
} from '@/types/sunatCpe';

/** El sync-range headless puede tardar varios minutos (1 request por comprobante). */
const SYNC_RANGE_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * CPE recibidos (Comprobantes de Pago electronicos con detalle de lineas).
 * Base path: `/sunat-cpe`.
 */
class SunatCpeService {
  private readonly basePath = '/sunat-cpe';

  async getInvoices(params?: GetSunatCpeInvoicesParams): Promise<SunatCpeListResponse> {
    return apiClient.get<SunatCpeListResponse>(`${this.basePath}/invoices`, { params });
  }

  async getInvoice(id: string): Promise<SunatCpeInvoiceDetail> {
    return apiClient.get<SunatCpeInvoiceDetail>(`${this.basePath}/invoices/${id}`);
  }

  async importFile(file: { uri: string; name: string; type: string }): Promise<SunatCpeRun> {
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);
    return apiClient.post<SunatCpeRun>(`${this.basePath}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async getRuns(params?: { limit?: number; offset?: number }): Promise<SunatCpeRunsListResponse> {
    return apiClient.get<SunatCpeRunsListResponse>(`${this.basePath}/runs`, { params });
  }

  /** Sincroniza CPE recibidos por rango de periodos (AAAAMM) desde SEE-SOL. */
  async syncRange(body: SunatCpeSyncRangeRequest): Promise<SunatCpeSyncRangeResponse> {
    return apiClient.post<SunatCpeSyncRangeResponse>(`${this.basePath}/sync-range`, body, {
      timeout: SYNC_RANGE_TIMEOUT_MS,
    });
  }

  async getActiveRun(): Promise<{ active: SunatCpeRun | null }> {
    return apiClient.get<{ active: SunatCpeRun | null }>(`${this.basePath}/runs/active`);
  }

  async getRun(id: string): Promise<SunatCpeRun> {
    return apiClient.get<SunatCpeRun>(`${this.basePath}/runs/${id}`);
  }
}

export const sunatCpeApi = new SunatCpeService();
export const sunatCpeService = sunatCpeApi;
