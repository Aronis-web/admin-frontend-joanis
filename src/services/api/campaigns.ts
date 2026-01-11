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
  DistributionResultResponse,
} from '@/types/campaigns';

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
        meta: {
          total: response.length,
          page: 1,
          limit: response.length,
          totalPages: 1,
        },
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
        include: 'participants.company,participants.site,products.product',
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
    return apiClient.post<CampaignParticipant>(
      `${this.basePath}/${campaignId}/participants`,
      data
    );
  }

  /**
   * Update a participant (only in DRAFT status)
   */
  async updateParticipant(
    campaignId: string,
    participantId: string,
    data: UpdateParticipantRequest
  ): Promise<CampaignParticipant> {
    return apiClient.patch<CampaignParticipant>(
      `${this.basePath}/${campaignId}/participants/${participantId}`,
      data
    );
  }

  /**
   * Delete a participant (only in DRAFT status)
   */
  async deleteParticipant(campaignId: string, participantId: string): Promise<void> {
    return apiClient.delete<void>(
      `${this.basePath}/${campaignId}/participants/${participantId}`
    );
  }

  // ============================================
  // Campaign Products
  // ============================================

  /**
   * Get all products for a campaign
   */
  async getProducts(campaignId: string): Promise<CampaignProduct[]> {
    return apiClient.get<CampaignProduct[]>(`${this.basePath}/${campaignId}/products`);
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
  // Distribution Preview & Generation
  // ============================================

  /**
   * Get distribution preview for a product
   */
  async getDistributionPreview(
    campaignId: string,
    productId: string
  ): Promise<DistributionPreviewResponse> {
    return apiClient.get<DistributionPreviewResponse>(
      `${this.basePath}/${campaignId}/products/${productId}/preview`
    );
  }

  /**
   * Generate distribution for a product
   */
  async generateDistribution(
    campaignId: string,
    productId: string
  ): Promise<DistributionResultResponse> {
    return apiClient.post<DistributionResultResponse>(
      `${this.basePath}/${campaignId}/products/${productId}/generate`
    );
  }
}

// Export service instance
export const campaignsService = new CampaignsService();
