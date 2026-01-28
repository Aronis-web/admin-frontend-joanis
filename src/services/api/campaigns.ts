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
    const response = await apiClient.get<Campaign[] | CampaignsResponse>(this.basePath, { params });

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
   * Get a single campaign by ID
   */
  async getCampaign(id: string): Promise<Campaign> {
    return apiClient.get<Campaign>(`${this.basePath}/${id}`, {
      params: {
        include:
          'participants.company,participants.site,participants.priceProfile,products.product.category,products.product.presentations,products.product.salePrices,products.customDistributions.items',
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
        include:
          'product.category,product.presentations,product.salePrices,product.stockItems.warehouse,product.stockItems.area,purchase',
      },
    });
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
}

// Export service instance
export const campaignsService = new CampaignsService();
