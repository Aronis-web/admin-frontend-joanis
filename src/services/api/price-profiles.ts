import { apiClient } from './client';
import {
  PriceProfile,
  PriceProfilesResponse,
  CreatePriceProfileRequest,
  UpdatePriceProfileRequest,
  GetPriceProfilesParams,
  ProductSalePrice,
  ProductSalePricesResponse,
  UpdateSalePriceRequest,
  RecalculatePricesResponse,
} from '@/types/price-profiles';

/**
 * Price Profiles API Service
 * Handles all price profile and product sale price operations
 */
export const priceProfilesApi = {
  /**
   * Get price profiles with pagination and filtering
   * GET /admin/price-profiles
   */
  async getPriceProfiles(params: GetPriceProfilesParams = {}): Promise<PriceProfilesResponse> {
    const {
      q,
      isActive,
      page = 1,
      limit = 20,
      orderBy = 'name',
      orderDir = 'ASC',
    } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      orderBy,
      orderDir,
    });

    if (q) {
      queryParams.append('q', q);
    }

    if (isActive !== undefined) {
      queryParams.append('isActive', isActive.toString());
    }

    const queryString = queryParams.toString();
    const url = `/admin/price-profiles${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient.get<any>(url);

    console.log('🔍 Raw API response:', response);
    console.log('🔍 Response type:', typeof response);
    console.log('🔍 Is response an array?:', Array.isArray(response));

    // apiClient.get() already extracts the 'data' property from the API response
    // So 'response' is directly the array or the pagination object
    if (Array.isArray(response)) {
      // API returned {data: [...]} and apiClient extracted it, so we get the array directly
      console.log('✅ Response is array, wrapping in pagination format');
      return {
        data: response,
        total: response.length,
        page: page,
        limit: limit,
      };
    }

    // API returned full pagination response {data: [...], total: ..., page: ..., limit: ...}
    console.log('✅ Response is pagination object');
    return response as PriceProfilesResponse;
  },

  /**
   * Get a single price profile by ID
   * GET /admin/price-profiles/:id
   */
  async getPriceProfileById(id: string): Promise<PriceProfile> {
    return apiClient.get<PriceProfile>(`/admin/price-profiles/${id}`);
  },

  /**
   * Get a price profile by code
   * GET /admin/price-profiles/code/:code
   */
  async getPriceProfileByCode(code: string): Promise<PriceProfile> {
    return apiClient.get<PriceProfile>(`/admin/price-profiles/code/${code}`);
  },

  /**
   * Create a new price profile
   * POST /admin/price-profiles
   */
  async createPriceProfile(profileData: CreatePriceProfileRequest): Promise<PriceProfile> {
    return apiClient.post<PriceProfile>('/admin/price-profiles', profileData);
  },

  /**
   * Update an existing price profile
   * PATCH /admin/price-profiles/:id
   */
  async updatePriceProfile(
    id: string,
    profileData: UpdatePriceProfileRequest
  ): Promise<PriceProfile> {
    return apiClient.patch<PriceProfile>(`/admin/price-profiles/${id}`, profileData);
  },

  /**
   * Delete a price profile
   * DELETE /admin/price-profiles/:id
   */
  async deletePriceProfile(id: string): Promise<void> {
    return apiClient.delete<void>(`/admin/price-profiles/${id}`);
  },

  /**
   * Get all active price profiles (helper method)
   */
  async getActivePriceProfiles(): Promise<PriceProfile[]> {
    const response = await this.getPriceProfiles({ isActive: true, limit: 100 });
    return response.data;
  },

  /**
   * Search price profiles by code or name
   */
  async searchPriceProfiles(query: string): Promise<PriceProfile[]> {
    const response = await this.getPriceProfiles({ q: query, limit: 50 });
    return response.data;
  },

  // ============================================
  // Product Sale Prices Management
  // ============================================

  /**
   * Get all sale prices for a product
   * GET /admin/products/:id/sale-prices
   */
  async getProductSalePrices(productId: string): Promise<ProductSalePricesResponse> {
    return apiClient.get<ProductSalePricesResponse>(
      `/admin/products/${productId}/sale-prices`
    );
  },

  /**
   * Update a specific sale price for a product
   * PUT /admin/products/:id/sale-price
   */
  async updateSalePrice(
    productId: string,
    priceData: UpdateSalePriceRequest
  ): Promise<ProductSalePrice> {
    return apiClient.put<ProductSalePrice>(
      `/admin/products/${productId}/sale-price`,
      priceData
    );
  },

  /**
   * Recalculate all non-overridden sale prices for a product
   * POST /admin/products/:id/recalculate-prices
   */
  async recalculateProductPrices(productId: string): Promise<RecalculatePricesResponse> {
    return apiClient.post<RecalculatePricesResponse>(
      `/admin/products/${productId}/recalculate-prices`,
      {}
    );
  },

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Calculate expected price based on cost and profile factor
   */
  calculatePrice(costCents: number, factorToCost: number): number {
    return Math.round(costCents * factorToCost);
  },

  /**
   * Format price from cents to currency string
   */
  formatPrice(priceCents: number, currency: string = 'PEN'): string {
    const amount = priceCents / 100;
    const currencySymbol = currency === 'PEN' ? 'S/' : currency === 'USD' ? '$' : currency;
    return `${currencySymbol} ${amount.toFixed(2)}`;
  },

  /**
   * Calculate margin percentage
   */
  calculateMargin(costCents: number, priceCents: number): number {
    if (costCents === 0) return 0;
    return ((priceCents - costCents) / costCents) * 100;
  },

  /**
   * Get factor from margin percentage
   */
  getFactorFromMargin(marginPercentage: number): number {
    return 1 + marginPercentage / 100;
  },

  /**
   * Get margin from factor
   */
  getMarginFromFactor(factor: number): number {
    return (factor - 1) * 100;
  },
};

export default priceProfilesApi;
