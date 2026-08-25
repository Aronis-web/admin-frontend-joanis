import { apiClient } from './client';
import type {
  CreateSireVentasLinkDto,
  GetSireVentasInvoicesParams,
  GetSireVentasInvoicesSummaryByClientParams,
  GetSireVentasInvoicesSummaryParams,
  SireVentasActiveRunResponse,
  SireVentasImportResponse,
  SireVentasInvoiceAttachment,
  SireVentasInvoiceDetail,
  SireVentasInvoiceLink,
  SireVentasInvoicesListResponse,
  SireVentasInvoicesSummaryByClientResponse,
  SireVentasInvoicesSummaryResponse,
  SireVentasRun,
  SireVentasRunsListResponse,
  SireVentasSaleSuggestionsResponse,
  SireVentasSyncBody,
  SireVentasSyncRangeBody,
} from '@/types/sireVentas';

/**
 * SIRE Ventas (RVIE) API Service
 *
 * Base path: `/sire-ventas`.
 */
class SireVentasService {
  private readonly basePath = '/sire-ventas';

  // ============================================
  // Sync / Import
  // ============================================

  async syncPeriodo(body: SireVentasSyncBody = {}): Promise<SireVentasRun> {
    return apiClient.post<SireVentasRun>(`${this.basePath}/sync`, body);
  }

  async syncRange(body: SireVentasSyncRangeBody): Promise<SireVentasRun> {
    return apiClient.post<SireVentasRun>(`${this.basePath}/sync-range`, body);
  }

  async importFile(
    file: { uri: string; name: string; type: string },
    periodo?: string
  ): Promise<SireVentasImportResponse> {
    const formData = new FormData();
    // Compat RN + web
    formData.append('file', file as unknown as Blob);
    if (periodo) formData.append('periodo', periodo);

    return apiClient.post<SireVentasImportResponse>(`${this.basePath}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  // ============================================
  // Runs (auditoría)
  // ============================================

  async getActiveRun(): Promise<SireVentasActiveRunResponse> {
    return apiClient.get<SireVentasActiveRunResponse>(`${this.basePath}/runs/active`);
  }

  async getRun(id: string): Promise<SireVentasRun> {
    return apiClient.get<SireVentasRun>(`${this.basePath}/runs/${id}`);
  }

  async getRuns(params?: { limit?: number; offset?: number }): Promise<SireVentasRunsListResponse> {
    return apiClient.get<SireVentasRunsListResponse>(`${this.basePath}/runs`, { params });
  }

  // ============================================
  // Invoices (comprobantes)
  // ============================================

  async getInvoices(params?: GetSireVentasInvoicesParams): Promise<SireVentasInvoicesListResponse> {
    return apiClient.get<SireVentasInvoicesListResponse>(`${this.basePath}/invoices`, { params });
  }

  async getInvoice(id: string): Promise<SireVentasInvoiceDetail> {
    return apiClient.get<SireVentasInvoiceDetail>(`${this.basePath}/invoices/${id}`);
  }

  // ============================================
  // Summary / dashboard
  // ============================================

  async getInvoicesSummary(
    params?: GetSireVentasInvoicesSummaryParams
  ): Promise<SireVentasInvoicesSummaryResponse> {
    return apiClient.get<SireVentasInvoicesSummaryResponse>(`${this.basePath}/invoices/summary`, {
      params,
    });
  }

  async getInvoicesSummaryByClient(
    params?: GetSireVentasInvoicesSummaryByClientParams
  ): Promise<SireVentasInvoicesSummaryByClientResponse> {
    return apiClient.get<SireVentasInvoicesSummaryByClientResponse>(
      `${this.basePath}/invoices/summary/by-client`,
      { params }
    );
  }

  // ============================================
  // Conciliación N:M (ventas internas)
  // ============================================

  async getInvoiceLinks(invoiceId: string): Promise<SireVentasInvoiceLink[]> {
    return apiClient.get<SireVentasInvoiceLink[]>(`${this.basePath}/invoices/${invoiceId}/links`);
  }

  async getInvoiceSuggestions(
    invoiceId: string,
    params?: { search?: string; limit?: number; offset?: number }
  ): Promise<SireVentasSaleSuggestionsResponse> {
    return apiClient.get<SireVentasSaleSuggestionsResponse>(
      `${this.basePath}/invoices/${invoiceId}/suggestions`,
      { params }
    );
  }

  async searchSales(params?: {
    search?: string;
    excludeLinked?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<SireVentasSaleSuggestionsResponse> {
    return apiClient.get<SireVentasSaleSuggestionsResponse>(`${this.basePath}/sales/search`, {
      params,
    });
  }

  async createInvoiceLink(
    invoiceId: string,
    data: CreateSireVentasLinkDto
  ): Promise<SireVentasInvoiceLink> {
    return apiClient.post<SireVentasInvoiceLink>(
      `${this.basePath}/invoices/${invoiceId}/links`,
      data
    );
  }

  async deleteInvoiceLink(invoiceId: string, linkId: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/invoices/${invoiceId}/links/${linkId}`);
  }

  // ============================================
  // Adjuntos
  // ============================================

  async getInvoiceAttachments(invoiceId: string): Promise<SireVentasInvoiceAttachment[]> {
    return apiClient.get<SireVentasInvoiceAttachment[]>(
      `${this.basePath}/invoices/${invoiceId}/attachments`
    );
  }

  async uploadInvoiceAttachment(
    invoiceId: string,
    file: { uri: string; name: string; type: string },
    options?: { kind?: string; notes?: string }
  ): Promise<SireVentasInvoiceAttachment> {
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);
    if (options?.kind) formData.append('kind', options.kind);
    if (options?.notes) formData.append('notes', options.notes);

    return apiClient.post<SireVentasInvoiceAttachment>(
      `${this.basePath}/invoices/${invoiceId}/attachments`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  }

  async deleteInvoiceAttachment(invoiceId: string, attachmentId: string): Promise<void> {
    return apiClient.delete<void>(
      `${this.basePath}/invoices/${invoiceId}/attachments/${attachmentId}`
    );
  }
}

export const sireVentasApi = new SireVentasService();
export const sireVentasService = sireVentasApi;
