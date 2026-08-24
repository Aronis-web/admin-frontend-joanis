import { apiClient } from './client';
import type {
  CreateSireLinkDto,
  GetSireInvoicesParams,
  SireActiveRunResponse,
  SireImportResponse,
  SireInvoiceAttachment,
  SireInvoiceDetail,
  SireInvoiceLink,
  SireInvoicesListResponse,
  SirePurchaseSuggestionsResponse,
  SireRun,
  SireRunsListResponse,
  SireSyncBody,
} from '@/types/sireCompras';

/**
 * SIRE Compras (RCE) API Service
 *
 * Base path: `/sire-compras`.
 */
class SireComprasService {
  private readonly basePath = '/sire-compras';

  // ============================================
  // Sync / Import
  // ============================================

  async syncPeriodo(body: SireSyncBody = {}): Promise<SireRun> {
    return apiClient.post<SireRun>(`${this.basePath}/sync`, body);
  }

  async importFile(
    file: { uri: string; name: string; type: string },
    periodo?: string
  ): Promise<SireImportResponse> {
    const formData = new FormData();
    // Compat RN + web
    formData.append('file', file as unknown as Blob);
    if (periodo) formData.append('periodo', periodo);

    return apiClient.post<SireImportResponse>(`${this.basePath}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  // ============================================
  // Runs (auditoría)
  // ============================================

  async getActiveRun(): Promise<SireActiveRunResponse> {
    return apiClient.get<SireActiveRunResponse>(`${this.basePath}/runs/active`);
  }

  async getRun(id: string): Promise<SireRun> {
    return apiClient.get<SireRun>(`${this.basePath}/runs/${id}`);
  }

  async getRuns(params?: { limit?: number; offset?: number }): Promise<SireRunsListResponse> {
    return apiClient.get<SireRunsListResponse>(`${this.basePath}/runs`, { params });
  }

  // ============================================
  // Invoices (comprobantes)
  // ============================================

  async getInvoices(params?: GetSireInvoicesParams): Promise<SireInvoicesListResponse> {
    return apiClient.get<SireInvoicesListResponse>(`${this.basePath}/invoices`, { params });
  }

  async getInvoice(id: string): Promise<SireInvoiceDetail> {
    return apiClient.get<SireInvoiceDetail>(`${this.basePath}/invoices/${id}`);
  }

  // ============================================
  // Conciliación N:M
  // ============================================

  async getInvoiceLinks(invoiceId: string): Promise<SireInvoiceLink[]> {
    return apiClient.get<SireInvoiceLink[]>(`${this.basePath}/invoices/${invoiceId}/links`);
  }

  async getInvoiceSuggestions(
    invoiceId: string,
    params?: { search?: string; limit?: number; offset?: number }
  ): Promise<SirePurchaseSuggestionsResponse> {
    return apiClient.get<SirePurchaseSuggestionsResponse>(
      `${this.basePath}/invoices/${invoiceId}/suggestions`,
      { params }
    );
  }

  async searchPurchases(params?: {
    search?: string;
    excludeLinked?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<SirePurchaseSuggestionsResponse> {
    return apiClient.get<SirePurchaseSuggestionsResponse>(`${this.basePath}/purchases/search`, {
      params,
    });
  }

  async createInvoiceLink(invoiceId: string, data: CreateSireLinkDto): Promise<SireInvoiceLink> {
    return apiClient.post<SireInvoiceLink>(`${this.basePath}/invoices/${invoiceId}/links`, data);
  }

  async deleteInvoiceLink(invoiceId: string, linkId: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/invoices/${invoiceId}/links/${linkId}`);
  }

  // ============================================
  // Adjuntos
  // ============================================

  async getInvoiceAttachments(invoiceId: string): Promise<SireInvoiceAttachment[]> {
    return apiClient.get<SireInvoiceAttachment[]>(
      `${this.basePath}/invoices/${invoiceId}/attachments`
    );
  }

  async uploadInvoiceAttachment(
    invoiceId: string,
    file: { uri: string; name: string; type: string },
    options?: { kind?: string; notes?: string }
  ): Promise<SireInvoiceAttachment> {
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);
    if (options?.kind) formData.append('kind', options.kind);
    if (options?.notes) formData.append('notes', options.notes);

    return apiClient.post<SireInvoiceAttachment>(
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

export const sireComprasApi = new SireComprasService();
export const sireComprasService = sireComprasApi;
