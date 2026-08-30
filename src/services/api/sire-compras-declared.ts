import { apiClient } from './client';
import type {
  GetSireComprasDeclaredInvoicesParams,
  GetSireComprasDeclaredInvoicesSummaryParams,
  SireComprasDeclaredActiveRunResponse,
  SireComprasDeclaredImportResponse,
  SireComprasDeclaredInvoicesListResponse,
  SireComprasDeclaredInvoicesSummaryResponse,
  SireComprasDeclaredRun,
  SireComprasDeclaredRunsListResponse,
  SireComprasDeclaredSyncBody,
  SireComprasDeclaredSyncRangeBody,
  SireComprasDeclaredSyncRangeResponse,
  SireComprasDeclaredSyncResponse,
} from '@/types/sireComprasDeclared';

/**
 * SIRE Compras Declaradas (RCE) API Service
 *
 * Base path: `/sire-compras/declared`.
 */
class SireComprasDeclaredService {
  private readonly basePath = '/sire-compras/declared';

  // ============================================
  // Sync / Import
  // ============================================

  async syncPeriodo(
    body: SireComprasDeclaredSyncBody = {}
  ): Promise<SireComprasDeclaredSyncResponse> {
    return apiClient.post<SireComprasDeclaredSyncResponse>(`${this.basePath}/sync`, body);
  }

  async syncRange(
    body: SireComprasDeclaredSyncRangeBody
  ): Promise<SireComprasDeclaredSyncRangeResponse> {
    return apiClient.post<SireComprasDeclaredSyncRangeResponse>(
      `${this.basePath}/sync-range`,
      body
    );
  }

  async importFile(
    file: { uri: string; name: string; type: string },
    periodo?: string
  ): Promise<SireComprasDeclaredImportResponse> {
    const formData = new FormData();
    // Compat RN + web
    formData.append('file', file as unknown as Blob);
    if (periodo) formData.append('periodo', periodo);

    return apiClient.post<SireComprasDeclaredImportResponse>(`${this.basePath}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  // ============================================
  // Runs (auditoría)
  // ============================================

  async getActiveRun(): Promise<SireComprasDeclaredActiveRunResponse> {
    return apiClient.get<SireComprasDeclaredActiveRunResponse>(`${this.basePath}/runs/active`);
  }

  async getRun(id: string): Promise<SireComprasDeclaredRun> {
    return apiClient.get<SireComprasDeclaredRun>(`${this.basePath}/runs/${id}`);
  }

  async getRuns(params?: {
    limit?: number;
    offset?: number;
  }): Promise<SireComprasDeclaredRunsListResponse> {
    return apiClient.get<SireComprasDeclaredRunsListResponse>(`${this.basePath}/runs`, { params });
  }

  // ============================================
  // Invoices (comprobantes)
  // ============================================

  async getInvoices(
    params?: GetSireComprasDeclaredInvoicesParams
  ): Promise<SireComprasDeclaredInvoicesListResponse> {
    return apiClient.get<SireComprasDeclaredInvoicesListResponse>(`${this.basePath}/invoices`, {
      params,
    });
  }

  // ============================================
  // Summary / dashboard
  // ============================================

  async getInvoicesSummary(
    params?: GetSireComprasDeclaredInvoicesSummaryParams
  ): Promise<SireComprasDeclaredInvoicesSummaryResponse> {
    return apiClient.get<SireComprasDeclaredInvoicesSummaryResponse>(
      `${this.basePath}/invoices/summary`,
      { params }
    );
  }
}

export const sireComprasDeclaredApi = new SireComprasDeclaredService();
export const sireComprasDeclaredService = sireComprasDeclaredApi;
