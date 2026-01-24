import { apiClient } from './client';
import {
  Transmision,
  TransmisionProduct,
  TransmisionWithProducts,
  CreateTransmisionRequest,
  UpdateTransmisionRequest,
  AddProductToTransmisionRequest,
  QuickEditPricesRequest,
  ValidationCheckResult,
  UpdateProductDataResult,
  QueryTransmisionesRequest,
  PaginatedTransmisionesResponse,
  PaginatedTransmisionProductsResponse,
} from '@/types/transmisiones';

export const transmisionesApi = {
  // ========== TRANSMISIONES ENDPOINTS ==========

  /**
   * Get all transmisiones with pagination and filters
   * GET /admin/transmisiones
   */
  getTransmisiones: async (
    params?: QueryTransmisionesRequest
  ): Promise<PaginatedTransmisionesResponse> => {
    return apiClient.get<PaginatedTransmisionesResponse>('/admin/transmisiones', { params });
  },

  /**
   * Get transmision by ID
   * GET /admin/transmisiones/:id
   */
  getTransmisionById: async (id: string): Promise<TransmisionWithProducts> => {
    return apiClient.get<TransmisionWithProducts>(`/admin/transmisiones/${id}`);
  },

  /**
   * Create new transmision
   * POST /admin/transmisiones
   */
  createTransmision: async (data: CreateTransmisionRequest): Promise<Transmision> => {
    return apiClient.post<Transmision>('/admin/transmisiones', data);
  },

  /**
   * Update transmision
   * PATCH /admin/transmisiones/:id
   */
  updateTransmision: async (id: string, data: UpdateTransmisionRequest): Promise<Transmision> => {
    return apiClient.patch<Transmision>(`/admin/transmisiones/${id}`, data);
  },

  /**
   * Delete transmision (soft delete)
   * DELETE /admin/transmisiones/:id
   */
  deleteTransmision: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/admin/transmisiones/${id}`);
  },

  // ========== TRANSMISION PRODUCTS ENDPOINTS ==========

  /**
   * Get products in a transmision
   * GET /admin/transmisiones/:id/products
   */
  getTransmisionProducts: async (
    transmisionId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedTransmisionProductsResponse> => {
    return apiClient.get<PaginatedTransmisionProductsResponse>(
      `/admin/transmisiones/${transmisionId}/products`,
      { params }
    );
  },

  /**
   * Add product to transmision
   * POST /admin/transmisiones/:id/products
   */
  addProductToTransmision: async (
    transmisionId: string,
    data: AddProductToTransmisionRequest
  ): Promise<TransmisionProduct> => {
    return apiClient.post<TransmisionProduct>(
      `/admin/transmisiones/${transmisionId}/products`,
      data
    );
  },

  /**
   * Remove product from transmision
   * DELETE /admin/transmisiones/:id/products/:productId
   */
  removeProductFromTransmision: async (transmisionId: string, productId: string): Promise<void> => {
    return apiClient.delete<void>(`/admin/transmisiones/${transmisionId}/products/${productId}`);
  },

  /**
   * Quick edit product prices (cost and sale price)
   * PATCH /admin/transmisiones/:id/products/:tpId/quick-edit
   */
  quickEditPrices: async (
    transmisionId: string,
    transmisionProductId: string,
    data: QuickEditPricesRequest
  ): Promise<TransmisionProduct> => {
    return apiClient.patch<TransmisionProduct>(
      `/admin/transmisiones/${transmisionId}/products/${transmisionProductId}/quick-edit`,
      data
    );
  },

  /**
   * Check if preliminary product was validated
   * POST /admin/transmisiones/:id/products/:tpId/check-validation
   */
  checkProductValidation: async (
    transmisionId: string,
    transmisionProductId: string
  ): Promise<ValidationCheckResult> => {
    return apiClient.post<ValidationCheckResult>(
      `/admin/transmisiones/${transmisionId}/products/${transmisionProductId}/check-validation`,
      {}
    );
  },

  /**
   * Update product data from catalog (for active products)
   * POST /admin/transmisiones/:id/products/:tpId/update-data
   */
  updateProductData: async (
    transmisionId: string,
    transmisionProductId: string
  ): Promise<UpdateProductDataResult> => {
    return apiClient.post<UpdateProductDataResult>(
      `/admin/transmisiones/${transmisionId}/products/${transmisionProductId}/update-data`,
      {}
    );
  },

  // ========== BULK OPERATIONS ==========

  /**
   * Add multiple products to transmision
   * POST /admin/transmisiones/:id/products/bulk
   */
  addProductsToTransmisionBulk: async (
    transmisionId: string,
    products: AddProductToTransmisionRequest[]
  ): Promise<{
    success: boolean;
    added: number;
    failed: number;
    errors: Array<{ productId: string; error: string }>;
  }> => {
    return apiClient.post(`/admin/transmisiones/${transmisionId}/products/bulk`, { products });
  },

  /**
   * Remove multiple products from transmision
   * DELETE /admin/transmisiones/:id/products/bulk
   */
  removeProductsFromTransmisionBulk: async (
    transmisionId: string,
    productIds: string[]
  ): Promise<{
    success: boolean;
    removed: number;
  }> => {
    return apiClient.delete(`/admin/transmisiones/${transmisionId}/products/bulk`, {
      data: { productIds },
    });
  },

  // ========== HELPER METHODS ==========

  /**
   * Search products to add to transmision
   * This uses the existing products API
   */
  searchProducts: async (query: string, status?: string): Promise<any> => {
    return apiClient.get('/admin/products', {
      params: {
        q: query,
        status: status || 'active,preliminary',
        limit: 20,
      },
    });
  },

  /**
   * Get product by SKU or barcode
   */
  getProductByCode: async (code: string): Promise<any> => {
    // Try by SKU first
    try {
      return await apiClient.get(`/admin/products/sku/${code}`);
    } catch (error) {
      // If not found by SKU, try by barcode
      return apiClient.get('/admin/products', {
        params: { barcode: code, limit: 1 },
      });
    }
  },
};

export default transmisionesApi;
