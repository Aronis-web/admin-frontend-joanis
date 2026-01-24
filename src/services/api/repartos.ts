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
} from '@/types/repartos';

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
        include: 'campaign,participantes.campaignParticipant.company,participantes.campaignParticipant.site,participantes.productos.product.presentations.presentation,participantes.productos.warehouse,participantes.productos.area,participantes.productos.validacion',
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
    return apiClient.get<any>(
      `/admin/inventory/stock-items/${stockItemId}/available`
    );
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
   * Export totals report PDF for a reparto
   * Returns a blob that can be used to download/view the PDF
   * @param repartoId - ID of the reparto
   * @param participantId - Optional participant ID to filter by specific participant
   */
  async exportRepartoTotalsReport(repartoId: string, participantId?: string): Promise<Blob> {
    // Get fresh token and context
    const authStore = useAuthStore.getState();
    const tenantStore = useTenantStore.getState();

    // Check if token should be refreshed and refresh if needed
    if (authStore.shouldRefreshToken()) {
      console.log('🔄 Token needs refresh, refreshing...');
      await authStore.refreshAccessToken();
    }

    const token = authStore.token;
    const userId = authStore.user?.id;
    const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id;
    const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id;

    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers: Record<string, string> = {
      'X-App-Id': config.APP_ID,
      'Authorization': `Bearer ${token}`,
    };

    if (userId) headers['X-User-Id'] = userId;
    if (companyId) headers['X-Company-Id'] = companyId;
    if (siteId) headers['X-Site-Id'] = siteId;

    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();

    // Build URL with query parameters
    const urlParams = new URLSearchParams();
    urlParams.append('t', timestamp.toString());

    if (participantId) {
      urlParams.append('participantId', participantId);
    }

    const url = `${config.API_URL}${this.basePath}/${repartoId}/totals-report/export-pdf?${urlParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
    // Get fresh token and context
    const authStore = useAuthStore.getState();
    const tenantStore = useTenantStore.getState();

    // Check if token should be refreshed and refresh if needed
    if (authStore.shouldRefreshToken()) {
      console.log('🔄 Token needs refresh, refreshing...');
      await authStore.refreshAccessToken();
    }

    const token = authStore.token;
    const userId = authStore.user?.id;
    const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id;
    const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id;

    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers: Record<string, string> = {
      'X-App-Id': config.APP_ID,
      'Authorization': `Bearer ${token}`,
    };

    if (userId) headers['X-User-Id'] = userId;
    if (companyId) headers['X-Company-Id'] = companyId;
    if (siteId) headers['X-Site-Id'] = siteId;

    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    const response = await fetch(
      `${config.API_URL}${this.basePath}/${repartoId}/export-pdf?t=${timestamp}`,
      {
        method: 'GET',
        headers: {
          ...headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.blob();
  }

  /**
   * Export all distribution sheets for a campaign as a single PDF
   * Returns a blob that can be used to download/view the PDF
   */
  async exportCampaignDistributionSheets(
    campaignId: string,
    selectedProductIds?: string[]
  ): Promise<Blob> {
    // Get fresh token and context
    const authStore = useAuthStore.getState();
    const tenantStore = useTenantStore.getState();

    // Check if token should be refreshed and refresh if needed
    if (authStore.shouldRefreshToken()) {
      console.log('🔄 Token needs refresh, refreshing...');
      await authStore.refreshAccessToken();
    }

    const token = authStore.token;
    const userId = authStore.user?.id;
    const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id;
    const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id;

    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers: Record<string, string> = {
      'X-App-Id': config.APP_ID,
      'Authorization': `Bearer ${token}`,
    };

    if (userId) headers['X-User-Id'] = userId;
    if (companyId) headers['X-Company-Id'] = companyId;
    if (siteId) headers['X-Site-Id'] = siteId;

    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();

    // Build URL with query parameters
    const urlParams = new URLSearchParams();
    urlParams.append('t', timestamp.toString());

    // Add selected product IDs as query parameters if provided
    if (selectedProductIds && selectedProductIds.length > 0) {
      console.log('🔍 Productos seleccionados para exportar:', selectedProductIds.length);
      console.log('📋 IDs de productos:', selectedProductIds);
      selectedProductIds.forEach(productId => {
        urlParams.append('productIds[]', productId);
      });
    } else {
      console.log('⚠️ No se proporcionaron productIds - se exportarán TODOS los productos');
    }

    const url = `${config.API_URL}/admin/campaigns/${campaignId}/export-distribution-sheets?${urlParams.toString()}`;
    console.log('🌐 URL de exportación:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.blob();
  }
}

// Export service instance
export const repartosService = new RepartosService();
