import { apiClient } from './client';
import {
  Campaign,
  CampaignsResponse,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  QueryCampaignsParams,
  CampaignParticipant,
  AddParticipantRequest,
  UpdateParticipantRequest,
  CampaignProduct,
  AddProductRequest,
  AddProductsFromPurchaseRequest,
  UpdateProductRequest,
  SetCustomDistributionRequest,
  CampaignCustomDistribution,
  DistributionPreviewResponse,
  DistributionPreviewRequest,
  DistributionResultResponse,
  GenerateDistributionRequest,
  CampaignProductsDetailResponse,
  CampaignProductFullResponse,
} from '@/types/campaigns';
import { ParticipantTotalsResponse } from '@/types/participant-totals';

/**
 * Campaigns API Service
 */
class CampaignsService {
  private readonly basePath = '/admin/campaigns';

  // ============================================
  // Campaigns CRUD
  // ============================================

  /**
   * Get all campaigns with optional filters
   */
  async getCampaigns(params?: QueryCampaignsParams): Promise<CampaignsResponse> {
    // ✅ Agregar paginación por defecto: 10 items por página
    const paginatedParams = {
      page: 1,
      limit: 10,
      ...params,
    };

    const response = await apiClient.get<any>(this.basePath, {
      params: paginatedParams,
    });

    // Handle different response formats
    if (Array.isArray(response)) {
      // Old format: direct array
      return {
        data: response,
        total: response.length,
        page: paginatedParams.page,
        limit: paginatedParams.limit,
      };
    } else if (response.items) {
      // New backend format: { items, total, page, limit, totalPages }
      return {
        data: response.items,
        total: response.total,
        page: response.page,
        limit: response.limit,
      };
    } else if (response.data) {
      // Current format: { data, total, page, limit }
      return response;
    }

    // Fallback
    return {
      data: [],
      total: 0,
      page: paginatedParams.page,
      limit: paginatedParams.limit,
    };
  }

  /**
   * Get a lightweight campaign summary (optional fast endpoint).
   *
   * Tries `GET /admin/campaigns/:id/summary` first, falls back to the full
   * `getCampaign` if the endpoint is not available on the backend. Useful for
   * the campaign detail header / overview tab, where the full nested payload
   * (participants, products, distributions, etc.) is not required.
   */
  async getCampaignSummary(id: string): Promise<Campaign> {
    try {
      return await apiClient.get<Campaign>(`${this.basePath}/${id}/summary`);
    } catch (error: any) {
      // 404 / 501 → backend does not expose the summary endpoint yet
      if (error?.response?.status === 404 || error?.response?.status === 501) {
        return this.getCampaign(id);
      }
      throw error;
    }
  }

  /**
   * Get paginated/filtered campaign products (optional fast endpoint).
   *
   * Falls back to the unpaginated `getProducts` when the backend does not
   * expose the paginated route yet, applying client-side filtering as a
   * graceful degradation.
   */
  async getProductsPaginated(
    campaignId: string,
    params?: {
      page?: number;
      limit?: number;
      q?: string;
      distributionStatus?: 'generated' | 'not-generated';
    }
  ): Promise<{ data: CampaignProduct[]; total: number; page: number; limit: number }> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    try {
      const response = await apiClient.get<any>(`${this.basePath}/${campaignId}/products`, {
        params: { page, limit, q: params?.q, distributionStatus: params?.distributionStatus },
      });
      // If backend already paginates, normalize the response
      if (response && (response.items || response.data)) {
        const items: CampaignProduct[] = response.items || response.data || [];
        return {
          data: items,
          total: response.total ?? items.length,
          page: response.page ?? page,
          limit: response.limit ?? limit,
        };
      }
      // Otherwise, treat as full array and paginate on the client
      const all: CampaignProduct[] = Array.isArray(response) ? response : [];
      const filtered = this.filterCampaignProducts(all, params);
      const start = (page - 1) * limit;
      return {
        data: filtered.slice(start, start + limit),
        total: filtered.length,
        page,
        limit,
      };
    } catch (error) {
      // Final fallback: use the existing helper and paginate locally
      const all = await this.getProducts(campaignId);
      const filtered = this.filterCampaignProducts(all, params);
      const start = (page - 1) * limit;
      return {
        data: filtered.slice(start, start + limit),
        total: filtered.length,
        page,
        limit,
      };
    }
  }

  private filterCampaignProducts(
    items: CampaignProduct[],
    params?: { q?: string; distributionStatus?: 'generated' | 'not-generated' }
  ): CampaignProduct[] {
    let result = items;
    if (params?.distributionStatus === 'generated') {
      result = result.filter((p) => p.distributionGenerated);
    } else if (params?.distributionStatus === 'not-generated') {
      result = result.filter((p) => !p.distributionGenerated);
    }
    if (params?.q && params.q.trim()) {
      const q = params.q.trim().toLowerCase();
      result = result.filter((p) => {
        const title = (p.product as any)?.title?.toLowerCase?.() || '';
        const sku = (p.product as any)?.sku?.toLowerCase?.() || '';
        return title.includes(q) || sku.includes(q);
      });
    }
    return result;
  }

  /**
   * Get a single campaign by ID
   */
  async getCampaign(id: string): Promise<Campaign> {
    return apiClient.get<Campaign>(`${this.basePath}/${id}`, {
      params: {
        include:
          'participants.company,participants.site,participants.priceProfile,products.product.category,products.product.presentations,products.product.salePrices,products.customDistributions.items,products.purchaseProduct,products.purchase',
      },
    });
  }

  /**
   * Create a new campaign
   */
  async createCampaign(data: CreateCampaignRequest): Promise<Campaign> {
    return apiClient.post<Campaign>(this.basePath, data);
  }

  /**
   * Update a campaign (only in DRAFT status)
   */
  async updateCampaign(id: string, data: UpdateCampaignRequest): Promise<Campaign> {
    return apiClient.patch<Campaign>(`${this.basePath}/${id}`, data);
  }

  /**
   * Activate a campaign (DRAFT → ACTIVE)
   */
  async activateCampaign(id: string): Promise<Campaign> {
    return apiClient.post<Campaign>(`${this.basePath}/${id}/activate`);
  }

  /**
   * Close a campaign (ACTIVE → CLOSED)
   */
  async closeCampaign(id: string): Promise<Campaign> {
    return apiClient.post<Campaign>(`${this.basePath}/${id}/close`);
  }

  /**
   * Cancel a campaign
   */
  async cancelCampaign(id: string): Promise<Campaign> {
    return apiClient.post<Campaign>(`${this.basePath}/${id}/cancel`);
  }

  /**
   * Delete a campaign (only in DRAFT status)
   */
  async deleteCampaign(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }

  // ============================================
  // Campaign Participants
  // ============================================

  /**
   * Get all participants for a campaign
   */
  async getParticipants(campaignId: string): Promise<CampaignParticipant[]> {
    return apiClient.get<CampaignParticipant[]>(`${this.basePath}/${campaignId}/participants`);
  }

  /**
   * Add a participant to a campaign
   */
  async addParticipant(
    campaignId: string,
    data: AddParticipantRequest
  ): Promise<CampaignParticipant> {
    return apiClient.post<CampaignParticipant>(`${this.basePath}/${campaignId}/participants`, data);
  }

  /**
   * Update a participant (only in DRAFT status)
   */
  async updateParticipant(
    campaignId: string,
    participantId: string,
    data: UpdateParticipantRequest
  ): Promise<CampaignParticipant> {
    console.log('📤 CampaignsService.updateParticipant - Request:', {
      campaignId,
      participantId,
      data,
      endpoint: `${this.basePath}/${campaignId}/participants/${participantId}`,
    });

    const result = await apiClient.patch<CampaignParticipant>(
      `${this.basePath}/${campaignId}/participants/${participantId}`,
      data
    );

    console.log('📥 CampaignsService.updateParticipant - Response:', result);

    return result;
  }

  /**
   * Delete a participant (only in DRAFT status)
   */
  async deleteParticipant(campaignId: string, participantId: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${campaignId}/participants/${participantId}`);
  }

  // ============================================
  // Campaign Products
  // ============================================

  /**
   * Get all products for a campaign
   */
  async getProducts(campaignId: string): Promise<CampaignProduct[]> {
    return apiClient.get<CampaignProduct[]>(`${this.basePath}/${campaignId}/products`, {
      params: {
        include: 'product.category,product.presentations,product.salePrices,purchase',
      },
    });
  }

  /**
   * Get compact products detail for a campaign (new fast endpoint).
   *
   * Trae todos los datos necesarios para la pestaña de productos en un
   * solo request: stock del site, costo, precios por perfil, proveedor
   * y fotos. Reemplaza el flujo previo que combinaba `getCampaign` +
   * `getProductsByIds` + `getProductSalePrices`.
   */
  async getProductsDetail(campaignId: string): Promise<CampaignProductsDetailResponse> {
    return apiClient.get<CampaignProductsDetailResponse>(
      `${this.basePath}/${campaignId}/products/detail`
    );
  }

  /**
   * Get the full detail of a single campaign product (new rich endpoint).
   *
   * `GET /admin/campaigns/:campaignId/products/:productId/full`
   *
   * Trae en un solo request todo lo necesario para el banner de detalle:
   * datos maestros, precios por perfil, proveedor, fotos, stock por sede,
   * ingresos/lotes y reparto por participante. `productId` es el `product_id`
   * del catálogo, NO el `campaignProduct.id`. Permiso requerido:
   * `campaigns.read`.
   */
  async getProductFull(
    campaignId: string,
    productId: string
  ): Promise<CampaignProductFullResponse> {
    return apiClient.get<CampaignProductFullResponse>(
      `${this.basePath}/${campaignId}/products/${productId}/full`
    );
  }

  /**
   * Get a single product from a campaign
   */
  async getProduct(campaignId: string, productId: string): Promise<CampaignProduct> {
    return apiClient.get<CampaignProduct>(`${this.basePath}/${campaignId}/products/${productId}`, {
      params: {
        include:
          'product.category,product.presentations,product.salePrices,purchase,customDistributions.items',
      },
    });
  }

  /**
   * Add a product to a campaign
   */
  async addProduct(campaignId: string, data: AddProductRequest): Promise<CampaignProduct> {
    return apiClient.post<CampaignProduct>(`${this.basePath}/${campaignId}/products`, data);
  }

  /**
   * Add products from a purchase
   */
  async addProductsFromPurchase(
    campaignId: string,
    data: AddProductsFromPurchaseRequest
  ): Promise<CampaignProduct[]> {
    return apiClient.post<CampaignProduct[]>(
      `${this.basePath}/${campaignId}/products/from-purchase`,
      data
    );
  }

  /**
   * Update a campaign product (only in DRAFT status)
   */
  async updateProduct(
    campaignId: string,
    productId: string,
    data: UpdateProductRequest
  ): Promise<CampaignProduct> {
    return apiClient.patch<CampaignProduct>(
      `${this.basePath}/${campaignId}/products/${productId}`,
      data
    );
  }

  /**
   * Delete a campaign product (only in DRAFT status)
   */
  async deleteProduct(campaignId: string, productId: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${campaignId}/products/${productId}`);
  }

  // ============================================
  // Custom Distributions
  // ============================================

  /**
   * Get custom distributions for a product
   */
  async getCustomDistributions(
    campaignId: string,
    productId: string
  ): Promise<CampaignCustomDistribution[]> {
    return apiClient.get<CampaignCustomDistribution[]>(
      `${this.basePath}/${campaignId}/products/${productId}/custom-distributions`
    );
  }

  /**
   * Set custom distribution for a product
   */
  async setCustomDistribution(
    campaignId: string,
    productId: string,
    data: SetCustomDistributionRequest
  ): Promise<CampaignCustomDistribution> {
    return apiClient.post<CampaignCustomDistribution>(
      `${this.basePath}/${campaignId}/products/${productId}/custom-distribution`,
      data
    );
  }

  /**
   * Delete a custom distribution
   */
  async deleteCustomDistribution(
    campaignId: string,
    productId: string,
    distributionId: string
  ): Promise<void> {
    return apiClient.delete<void>(
      `${this.basePath}/${campaignId}/products/${productId}/custom-distributions/${distributionId}`
    );
  }

  // ============================================
  // Participant Products
  // ============================================

  /**
   * Get products assigned to a participant (from generated repartos)
   */
  async getParticipantProducts(campaignId: string, participantId: string): Promise<any[]> {
    return apiClient.get<any[]>(
      `${this.basePath}/${campaignId}/participants/${participantId}/products`
    );
  }

  /**
   * Get preview of products a participant would receive (before generating)
   */
  async getParticipantProductsPreview(campaignId: string, participantId: string): Promise<any[]> {
    return apiClient.get<any[]>(
      `${this.basePath}/${campaignId}/participants/${participantId}/products/preview`
    );
  }

  /**
   * Get participant totals (purchase, sale, margin) for all participants in a campaign
   */
  async getParticipantTotals(campaignId: string): Promise<ParticipantTotalsResponse> {
    return apiClient.get<ParticipantTotalsResponse>(
      `${this.basePath}/${campaignId}/participant-totals`
    );
  }

  /**
   * Export participant totals as PDF
   */
  async exportParticipantTotalsPdf(campaignId: string): Promise<Blob> {
    return apiClient.get<Blob>(`${this.basePath}/${campaignId}/participant-totals/export-pdf`, {
      responseType: 'blob',
    });
  }

  // ============================================
  // Distribution Preview & Generation
  // ============================================

  /**
   * Get distribution preview for a product
   * @param campaignId - Campaign ID
   * @param productId - Product ID
   * @param data - Optional participant preferences for rounding factors
   */
  async getDistributionPreview(
    campaignId: string,
    productId: string,
    data?: DistributionPreviewRequest
  ): Promise<DistributionPreviewResponse> {
    return apiClient.post<DistributionPreviewResponse>(
      `${this.basePath}/${campaignId}/products/${productId}/preview`,
      data || {}
    );
  }

  /**
   * Generate distribution for a product
   * @param campaignId - Campaign ID
   * @param productId - Product ID
   * @param data - Distribution data with exact quantities per participant
   */
  async generateDistribution(
    campaignId: string,
    productId: string,
    data: GenerateDistributionRequest
  ): Promise<DistributionResultResponse> {
    return apiClient.post<DistributionResultResponse>(
      `${this.basePath}/${campaignId}/products/${productId}/generate`,
      data
    );
  }

  // ============================================
  // Campaign Participants (for Repartos)
  // ============================================

  /**
   * Add participant to campaign (for repartos)
   * This is used when creating repartos to add users as participants
   */
  async addCampaignParticipant(
    campaignId: string,
    data: {
      userId: string;
      role: 'COORDINATOR' | 'DISTRIBUTOR' | 'SUPERVISOR' | 'VOLUNTEER';
      assignedZone?: string;
      notes?: string;
    }
  ): Promise<any> {
    return apiClient.post<any>(`${this.basePath}/${campaignId}/participants`, data);
  }

  // ============================================
  // Custom Distributions (for Repartos planning)
  // ============================================

  /**
   * Create custom distribution for planning (does not reserve stock)
   */
  async createCustomDistribution(
    campaignId: string,
    data: {
      name: string;
      description?: string;
      products: Array<{
        productId: string;
        quantity: number;
        notes?: string;
      }>;
    }
  ): Promise<any> {
    return apiClient.post<any>(`${this.basePath}/${campaignId}/custom-distributions`, data);
  }

  // ============================================
  // Bulk Distribution
  // ============================================

  /**
   * Download bulk distribution template Excel
   */
  async downloadBulkDistributionTemplate(campaignId: string): Promise<Blob> {
    return apiClient.get<Blob>(`${this.basePath}/${campaignId}/bulk-distribution-template`, {
      responseType: 'blob',
    });
  }

  /**
   * Upload bulk distribution Excel and generate repartos
   */
  async uploadBulkDistribution(
    campaignId: string,
    file: File | Blob
  ): Promise<{
    success: boolean;
    repartosCreated: number;
    totalProducts: number;
    totalQuantity: number;
    errors: Array<{
      row: number;
      participantName: string;
      productSku: string;
      error: string;
    }>;
    repartos: Array<{
      id: string;
      code: string;
      name: string;
      status: string;
      participantName: string;
      productsCount: number;
    }>;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    // Don't set Content-Type header manually - let the browser/runtime set it with the correct boundary
    return apiClient.post<any>(`${this.basePath}/${campaignId}/bulk-distribution-upload`, formData);
  }
}

// Export service instance
export const campaignsService = new CampaignsService();
