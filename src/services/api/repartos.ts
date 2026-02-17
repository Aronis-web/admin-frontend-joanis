import { apiClient } from './client';
import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import {
  Reparto,
  RepartosResponse,
  CreateRepartoRequest,
  UpdateRepartoRequest,
  QueryRepartosParams,
  ValidarSalidaRequest,
  ValidacionSalida,
  RepartoStatus,
  RepartoProgressResponse,
  ParticipantCampaignProgressResponse,
  CampaignProgressResponse,
} from '@/types/repartos';
import {
  GenerateConsolidatedTransferRequest,
  GenerateConsolidatedTransferResponse,
  ConsolidatedTransferReport,
  TransferReportDiscrepancy,
  DiscrepancyNote,
  CreateDiscrepancyNoteRequest,
  UpdateDiscrepancyNoteRequest,
  CloseDiscrepancyNoteRequest,
  UpdateDiscrepancyStatusRequest,
  CloseReportRequest,
  ReportStatsResponse,
} from '@/types/consolidated-reports';

/**
 * Repartos API Service
 */
class RepartosService {
  private readonly basePath = '/admin/campaigns/repartos';

  // ============================================
  // Repartos CRUD
  // ============================================

  /**
   * Get all repartos with optional filters
   */
  async getRepartos(params?: QueryRepartosParams): Promise<RepartosResponse> {
    const response = await apiClient.get<Reparto[] | RepartosResponse>(this.basePath, { params });

    // Handle both array response and paginated response
    if (Array.isArray(response)) {
      return {
        data: response,
        total: response.length,
        page: 1,
        limit: response.length,
      };
    }

    return response;
  }

  /**
   * Get repartos by campaign ID
   */
  async getRepartosByCampaign(campaignId: string): Promise<Reparto[]> {
    return apiClient.get<Reparto[]>(`${this.basePath}/campaign/${campaignId}`);
  }

  /**
   * Get a single reparto by ID
   */
  async getReparto(id: string): Promise<Reparto> {
    return apiClient.get<Reparto>(`${this.basePath}/${id}`, {
      params: {
        include:
          'campaign,participantes.campaignParticipant.company,participantes.campaignParticipant.site,participantes.productos.product.presentations.presentation,participantes.productos.warehouse,participantes.productos.area,participantes.productos.validacion',
      },
    });
  }

  /**
   * Create a new reparto
   */
  async createReparto(data: CreateRepartoRequest): Promise<Reparto> {
    return apiClient.post<Reparto>(this.basePath, data);
  }

  /**
   * Update a reparto
   */
  async updateReparto(id: string, data: UpdateRepartoRequest): Promise<Reparto> {
    return apiClient.patch<Reparto>(`${this.basePath}/${id}`, data);
  }

  /**
   * Update reparto status
   */
  async updateRepartoStatus(id: string, status: RepartoStatus): Promise<Reparto> {
    return apiClient.patch<Reparto>(`${this.basePath}/${id}`, { status });
  }

  /**
   * Cancel a reparto (liberates stock automatically)
   */
  async cancelReparto(id: string, reason?: string): Promise<Reparto> {
    return apiClient.post<Reparto>(`${this.basePath}/${id}/cancel`, { reason });
  }

  /**
   * Delete a reparto (only PENDING or CANCELLED, liberates stock)
   */
  async deleteReparto(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }

  // ============================================
  // Validaciones de Salida
  // ============================================

  /**
   * Validate product exit (validar salida)
   * IMPORTANT: This reduces real stock and releases reservation
   */
  async validarSalida(
    repartoProductoId: string,
    data: ValidarSalidaRequest
  ): Promise<ValidacionSalida> {
    return apiClient.post<ValidacionSalida>(
      `${this.basePath}/productos/${repartoProductoId}/validar-salida`,
      data
    );
  }

  /**
   * Get validation details
   */
  async getValidacion(repartoProductoId: string): Promise<ValidacionSalida | null> {
    try {
      return await apiClient.get<ValidacionSalida>(
        `${this.basePath}/productos/${repartoProductoId}/validacion`
      );
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // ============================================
  // Stock Management
  // ============================================

  /**
   * Get available stock for a stock item
   */
  async getAvailableStock(stockItemId: string): Promise<{
    stockItemId: string;
    quantityBase: number;
    reservedQuantityBase: number;
    availableQuantity: number;
    product: {
      id: string;
      name: string;
      sku: string;
    };
  }> {
    return apiClient.get<any>(`/admin/inventory/stock-items/${stockItemId}/available`);
  }

  // ============================================
  // Progress and Reports
  // ============================================

  /**
   * Get reparto progress (assembly progress by participant)
   * Shows validation progress for products
   */
  async getRepartoProgress(repartoId: string): Promise<RepartoProgressResponse> {
    return apiClient.get<RepartoProgressResponse>(`${this.basePath}/${repartoId}/progress`);
  }

  /**
   * Get participant campaign progress
   * Shows validation progress for all repartos of a participant in a campaign
   */
  async getParticipantCampaignProgress(
    campaignParticipantId: string,
    campaignId: string
  ): Promise<ParticipantCampaignProgressResponse> {
    return apiClient.get<ParticipantCampaignProgressResponse>(
      `${this.basePath}/participants/${campaignParticipantId}/campaigns/${campaignId}/progress`
    );
  }

  /**
   * Get campaign progress
   * Shows validation progress for all repartos in a campaign, consolidated by participant
   */
  async getCampaignProgress(campaignId: string): Promise<CampaignProgressResponse> {
    return apiClient.get<CampaignProgressResponse>(
      `${this.basePath}/campaigns/${campaignId}/progress`
    );
  }

  /**
   * Export consolidated totals report PDF for all participants in a campaign
   * Returns a blob that can be used to download/view the PDF
   * @param campaignId - ID of the campaign
   */
  async exportAllParticipantsConsolidatedTotals(campaignId: string): Promise<Blob> {
    // Get fresh token and context
    const authStore = useAuthStore.getState();
    const tenantStore = useTenantStore.getState();

    const token = authStore.token;
    const userId = authStore.user?.id;
    const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id;
    const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id;

    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers: Record<string, string> = {
      'X-App-Id': config.APP_ID,
      Authorization: `Bearer ${token}`,
    };

    if (userId) {
      headers['X-User-Id'] = userId;
    }
    if (companyId) {
      headers['X-Company-Id'] = companyId;
    }
    if (siteId) {
      headers['X-Site-Id'] = siteId;
    }

    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();

    // Build URL with query parameters
    const urlParams = new URLSearchParams();
    urlParams.append('t', timestamp.toString());

    // Endpoint: GET /admin/campaigns/repartos/campaigns/:campaignId/all-participants/consolidated-totals/export-pdf
    const url = `${config.API_URL}${this.basePath}/campaigns/${campaignId}/all-participants/consolidated-totals/export-pdf?${urlParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.blob();
  }

  /**
   * Export consolidated totals report PDF for a participant across all repartos in a campaign
   * Returns a blob that can be used to download/view the PDF
   * @param campaignParticipantId - ID of the campaign participant
   * @param campaignId - ID of the campaign
   */
  async exportRepartoTotalsReport(campaignParticipantId: string, campaignId: string): Promise<Blob> {
    // Get fresh token and context
    const authStore = useAuthStore.getState();
    const tenantStore = useTenantStore.getState();

    // REMOVED: Proactive token refresh to prevent race conditions
    // Token refresh will happen automatically on 401 errors via apiClient interceptor

    const token = authStore.token;
    const userId = authStore.user?.id;
    const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id;
    const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id;

    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers: Record<string, string> = {
      'X-App-Id': config.APP_ID,
      Authorization: `Bearer ${token}`,
    };

    if (userId) {
      headers['X-User-Id'] = userId;
    }
    if (companyId) {
      headers['X-Company-Id'] = companyId;
    }
    if (siteId) {
      headers['X-Site-Id'] = siteId;
    }

    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();

    // Build URL with query parameters
    const urlParams = new URLSearchParams();
    urlParams.append('t', timestamp.toString());

    // New endpoint format: /admin/campaigns/repartos/participants/:campaignParticipantId/campaigns/:campaignId/consolidated-totals/export-pdf
    const url = `${config.API_URL}${this.basePath}/participants/${campaignParticipantId}/campaigns/${campaignId}/consolidated-totals/export-pdf?${urlParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.blob();
  }

  /**
   * Export validation report for a participant in a campaign
   * Returns a blob that can be used to download/view the PDF or Excel
   * @param campaignParticipantId - ID of the campaign participant
   * @param campaignId - ID of the campaign
   * @param format - Format of the report (pdf or excel)
   */
  async exportValidationReport(
    campaignParticipantId: string,
    campaignId: string,
    format: 'pdf' | 'excel' = 'pdf'
  ): Promise<Blob> {
    // Get fresh token and context
    const authStore = useAuthStore.getState();
    const tenantStore = useTenantStore.getState();

    const token = authStore.token;
    const userId = authStore.user?.id;
    const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id;
    const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id;

    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers: Record<string, string> = {
      'X-App-Id': config.APP_ID,
      Authorization: `Bearer ${token}`,
    };

    if (userId) {
      headers['X-User-Id'] = userId;
    }
    if (companyId) {
      headers['X-Company-Id'] = companyId;
    }
    if (siteId) {
      headers['X-Site-Id'] = siteId;
    }

    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();

    // Build URL with query parameters
    const urlParams = new URLSearchParams();
    urlParams.append('t', timestamp.toString());
    urlParams.append('format', format);

    // Endpoint: GET /admin/campaigns/repartos/participants/:campaignParticipantId/campaigns/:campaignId/validation-report
    const url = `${config.API_URL}${this.basePath}/participants/${campaignParticipantId}/campaigns/${campaignId}/validation-report?${urlParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.blob();
  }

  // ============================================
  // PDF Export
  // ============================================

  /**
   * Export PDF for a specific reparto
   * Returns a blob that can be used to download/view the PDF
   */
  async exportRepartoPdf(repartoId: string): Promise<Blob> {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    const url = `${config.API_URL}${this.basePath}/${repartoId}/export-pdf?t=${timestamp}`;

    // Use downloadWithAuth helper that handles token refresh automatically
    const { downloadWithAuth } = await import('@/utils/downloadWithAuth');
    return downloadWithAuth(url, { method: 'GET' });
  }

  /**
   * Export all distribution sheets for a campaign as a single PDF
   * Returns a blob that can be used to download/view the PDF
   */
  async exportCampaignDistributionSheets(
    campaignId: string,
    selectedProductIds?: string[]
  ): Promise<Blob> {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();

    // Build URL with query parameters
    const urlParams = new URLSearchParams();
    urlParams.append('t', timestamp.toString());

    // Add selected product IDs as query parameters if provided
    if (selectedProductIds && selectedProductIds.length > 0) {
      console.log('🔍 Productos seleccionados para exportar:', selectedProductIds.length);
      console.log('📋 IDs de productos:', selectedProductIds);
      selectedProductIds.forEach((productId) => {
        urlParams.append('productIds[]', productId);
      });
    } else {
      console.log('⚠️ No se proporcionaron productIds - se exportarán TODOS los productos');
    }

    const url = `${config.API_URL}/admin/campaigns/${campaignId}/export-distribution-sheets?${urlParams.toString()}`;
    console.log('🌐 URL de exportación:', url);

    // Use downloadWithAuth helper that handles token refresh automatically
    const { downloadWithAuth } = await import('@/utils/downloadWithAuth');
    return downloadWithAuth(url, { method: 'GET' });
  }

  /**
   * Export distribution summary for a campaign as Excel
   * Returns a blob that can be used to download the Excel file
   */
  async exportDistributionSummaryExcel(
    campaignId: string,
    selectedProductIds?: string[]
  ): Promise<Blob> {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();

    // Build URL with query parameters
    const urlParams = new URLSearchParams();
    urlParams.append('t', timestamp.toString());

    // Add selected product IDs as query parameters if provided
    if (selectedProductIds && selectedProductIds.length > 0) {
      console.log('🔍 Productos seleccionados para exportar en Excel:', selectedProductIds.length);
      console.log('📋 IDs de productos:', selectedProductIds);
      selectedProductIds.forEach((productId) => {
        urlParams.append('productIds[]', productId);
      });
    } else {
      console.log('⚠️ No se proporcionaron productIds - se exportarán TODOS los productos');
    }

    const url = `${config.API_URL}/admin/campaigns/${campaignId}/export-distribution-summary-excel?${urlParams.toString()}`;
    console.log('🌐 URL de exportación Excel:', url);

    // Use downloadWithAuth helper that handles token refresh automatically
    const { downloadWithAuth } = await import('@/utils/downloadWithAuth');
    return downloadWithAuth(url, { method: 'GET' });
  }

  // ============================================
  // Consolidated Transfer Reports
  // ============================================

  /**
   * Check if consolidated transfer already exists for a participant in a campaign
   * Returns transfer information if it exists
   */
  async checkConsolidatedTransferStatus(
    campaignParticipantId: string,
    campaignId: string
  ): Promise<{
    exists: boolean;
    transferId: string | null;
    transferNumber: string | null;
    generatedAt: string | null;
  }> {
    return apiClient.get<{
      exists: boolean;
      transferId: string | null;
      transferNumber: string | null;
      generatedAt: string | null;
    }>(
      `${this.basePath}/participants/${campaignParticipantId}/campaigns/${campaignId}/consolidated-transfer-status`
    );
  }

  /**
   * Get remission guide information for a participant in a campaign
   * Returns remission guide details if it exists
   */
  async getRemissionGuideInfo(
    campaignParticipantId: string,
    campaignId: string
  ): Promise<{
    exists: boolean;
    remissionGuideId: string | null;
    remissionGuideNumber: string | null;
    generatedAt: string | null;
    documentType: string | null;
    status: string | null;
    statusSunat: string | null;
    fechaEmision: string | null;
    observations: string | null;
    pdfUrl: string | null;
    xmlUrl: string | null;
    cdrUrl: string | null;
    createdAt: string | null;
  }> {
    return apiClient.get<{
      exists: boolean;
      remissionGuideId: string | null;
      remissionGuideNumber: string | null;
      generatedAt: string | null;
      documentType: string | null;
      status: string | null;
      statusSunat: string | null;
      fechaEmision: string | null;
      observations: string | null;
      pdfUrl: string | null;
      xmlUrl: string | null;
      cdrUrl: string | null;
      createdAt: string | null;
    }>(
      `${this.basePath}/participants/${campaignParticipantId}/campaigns/${campaignId}/remission-guide-info`
    );
  }

  /**
   * Generate remission guide for a participant's consolidated transfer
   * Requires that a consolidated transfer has been generated first
   */
  async generateRemissionGuide(
    campaignParticipantId: string,
    campaignId: string
  ): Promise<{
    success: boolean;
    remissionGuide: {
      id: string;
      serieNumero: string;
      status: string;
      pdfUrl: string;
      xmlUrl: string;
    };
    transfer: {
      id: string;
      transferNumber: string;
    };
    message: string;
  }> {
    return apiClient.post<{
      success: boolean;
      remissionGuide: {
        id: string;
        serieNumero: string;
        status: string;
        pdfUrl: string;
        xmlUrl: string;
      };
      transfer: {
        id: string;
        transferNumber: string;
      };
      message: string;
    }>(
      `${this.basePath}/participants/${campaignParticipantId}/campaigns/${campaignId}/generate-remission-guide`
    );
  }

  /**
   * Generate consolidated transfer for a participant in a campaign
   * This will:
   * - Release ALL reservations
   * - Deduct ONLY validated stock
   * - Create transfer with validated quantities
   * - Automatically create report if there are discrepancies
   */
  async generateConsolidatedTransfer(
    campaignParticipantId: string,
    campaignId: string,
    data: GenerateConsolidatedTransferRequest
  ): Promise<GenerateConsolidatedTransferResponse> {
    return apiClient.post<GenerateConsolidatedTransferResponse>(
      `${this.basePath}/participants/${campaignParticipantId}/campaigns/${campaignId}/generate-consolidated-transfer`,
      data
    );
  }

  /**
   * Get consolidated transfer report by ID
   */
  async getReport(reportId: string): Promise<ConsolidatedTransferReport> {
    return apiClient.get<ConsolidatedTransferReport>(`/admin/campaigns/reports/${reportId}`);
  }

  /**
   * Get report by transfer ID
   */
  async getReportByTransfer(transferId: string): Promise<ConsolidatedTransferReport> {
    return apiClient.get<ConsolidatedTransferReport>(
      `/admin/campaigns/reports/transfer/${transferId}`
    );
  }

  /**
   * Get all reports for a campaign
   */
  async getReportsByCampaign(campaignId: string): Promise<ConsolidatedTransferReport[]> {
    return apiClient.get<ConsolidatedTransferReport[]>(
      `/admin/campaigns/reports/campaign/${campaignId}`
    );
  }

  /**
   * Get report statistics for a campaign
   */
  async getReportStats(campaignId: string): Promise<ReportStatsResponse> {
    return apiClient.get<ReportStatsResponse>(
      `/admin/campaigns/reports/campaign/${campaignId}/stats`
    );
  }

  /**
   * Close a report
   */
  async closeReport(reportId: string, data: CloseReportRequest): Promise<ConsolidatedTransferReport> {
    return apiClient.post<ConsolidatedTransferReport>(
      `/admin/campaigns/reports/${reportId}/close`,
      data
    );
  }

  // ============================================
  // Discrepancies Management
  // ============================================

  /**
   * Get a specific discrepancy
   */
  async getDiscrepancy(reportId: string, discrepancyId: string): Promise<TransferReportDiscrepancy> {
    return apiClient.get<TransferReportDiscrepancy>(
      `/admin/campaigns/reports/${reportId}/discrepancies/${discrepancyId}`
    );
  }

  /**
   * Update discrepancy status
   */
  async updateDiscrepancyStatus(
    reportId: string,
    discrepancyId: string,
    data: UpdateDiscrepancyStatusRequest
  ): Promise<TransferReportDiscrepancy> {
    return apiClient.patch<TransferReportDiscrepancy>(
      `/admin/campaigns/reports/${reportId}/discrepancies/${discrepancyId}/status`,
      data
    );
  }

  // ============================================
  // Discrepancy Notes Management (CRUD)
  // ============================================

  /**
   * Create a note for a discrepancy
   */
  async createDiscrepancyNote(
    reportId: string,
    discrepancyId: string,
    data: CreateDiscrepancyNoteRequest
  ): Promise<DiscrepancyNote> {
    return apiClient.post<DiscrepancyNote>(
      `/admin/campaigns/reports/${reportId}/discrepancies/${discrepancyId}/notes`,
      data
    );
  }

  /**
   * Get all notes for a discrepancy
   */
  async getDiscrepancyNotes(reportId: string, discrepancyId: string): Promise<DiscrepancyNote[]> {
    return apiClient.get<DiscrepancyNote[]>(
      `/admin/campaigns/reports/${reportId}/discrepancies/${discrepancyId}/notes`
    );
  }

  /**
   * Update a discrepancy note
   */
  async updateDiscrepancyNote(
    reportId: string,
    discrepancyId: string,
    noteId: string,
    data: UpdateDiscrepancyNoteRequest
  ): Promise<DiscrepancyNote> {
    return apiClient.patch<DiscrepancyNote>(
      `/admin/campaigns/reports/${reportId}/discrepancies/${discrepancyId}/notes/${noteId}`,
      data
    );
  }

  /**
   * Close a discrepancy note
   */
  async closeDiscrepancyNote(
    reportId: string,
    discrepancyId: string,
    noteId: string,
    data: CloseDiscrepancyNoteRequest
  ): Promise<DiscrepancyNote> {
    return apiClient.post<DiscrepancyNote>(
      `/admin/campaigns/reports/${reportId}/discrepancies/${discrepancyId}/notes/${noteId}/close`,
      data
    );
  }

  /**
   * Delete a discrepancy note
   */
  async deleteDiscrepancyNote(
    reportId: string,
    discrepancyId: string,
    noteId: string
  ): Promise<void> {
    return apiClient.delete<void>(
      `/admin/campaigns/reports/${reportId}/discrepancies/${discrepancyId}/notes/${noteId}`
    );
  }
}

// Export service instance
export const repartosService = new RepartosService();
