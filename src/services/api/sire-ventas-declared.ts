import { apiClient } from './client';
import type {
  GetSireVentasDeclaredInvoicesParams,
  GetSireVentasDeclaredInvoicesSummaryParams,
  SireVentasDeclaredActiveRunResponse,
  SireVentasDeclaredImportResponse,
  SireVentasDeclaredInvoicesListResponse,
  SireVentasDeclaredInvoicesSummaryResponse,
  SireVentasDeclaredRun,
  SireVentasDeclaredRunsListResponse,
  SireVentasDeclaredSyncBody,
  SireVentasDeclaredSyncRangeBody,
  SireVentasDeclaredSyncRangeResponse,
  SireVentasDeclaredSyncResponse,
} from '@/types/sireVentasDeclared';

/**
 * SIRE Ventas Declaradas (RVIE) API Service
 *
 * Base path: `/sire-ventas/declared`.
 */
class SireVentasDeclaredService {
  private readonly basePath = '/sire-ventas/declared';

  // ============================================
  // Sync / Import
  // ============================================

  async syncPeriodo(
    body: SireVentasDeclaredSyncBody = {}
  ): Promise<SireVentasDeclaredSyncResponse> {
    return apiClient.post<SireVentasDeclaredSyncResponse>(`${this.basePath}/sync`, body);
  }

  async syncRange(
    body: SireVentasDeclaredSyncRangeBody
  ): Promise<SireVentasDeclaredSyncRangeResponse> {
    return apiClient.post<SireVentasDeclaredSyncRangeResponse>(`${this.basePath}/sync-range`, body);
  }

  async importFile(
    file: { uri: string; name: string; type: string },
    periodo?: string
  ): Promise<SireVentasDeclaredImportResponse> {
    const formData = new FormData();
    // Compat RN + web
    formData.append('file', file as unknown as Blob);
    if (periodo) formData.append('periodo', periodo);

    return apiClient.post<SireVentasDeclaredImportResponse>(`${this.basePath}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  // ============================================
  // Runs (auditoría)
  // ============================================

  async getActiveRun(): Promise<SireVentasDeclaredActiveRunResponse> {
    return apiClient.get<SireVentasDeclaredActiveRunResponse>(`${this.basePath}/runs/active`);
  }

  async getRun(id: string): Promise<SireVentasDeclaredRun> {
    return apiClient.get<SireVentasDeclaredRun>(`${this.basePath}/runs/${id}`);
  }

  async getRuns(params?: {
    limit?: number;
    offset?: number;
  }): Promise<SireVentasDeclaredRunsListResponse> {
    return apiClient.get<SireVentasDeclaredRunsListResponse>(`${this.basePath}/runs`, { params });
  }

  // ============================================
  // Invoices (comprobantes)
  // ============================================

  async getInvoices(
    params?: GetSireVentasDeclaredInvoicesParams
  ): Promise<SireVentasDeclaredInvoicesListResponse> {
    return apiClient.get<SireVentasDeclaredInvoicesListResponse>(`${this.basePath}/invoices`, {
      params,
    });
  }

  // ============================================
  // Summary / dashboard
  // ============================================

  async getInvoicesSummary(
    params?: GetSireVentasDeclaredInvoicesSummaryParams
  ): Promise<SireVentasDeclaredInvoicesSummaryResponse> {
    return apiClient.get<SireVentasDeclaredInvoicesSummaryResponse>(
      `${this.basePath}/invoices/summary`,
      { params }
    );
  }
}

export const sireVentasDeclaredApi = new SireVentasDeclaredService();
export const sireVentasDeclaredService = sireVentasDeclaredApi;
