import { apiClient } from './client';

/**
 * Codigos alternos de producto (barcode / sku / name alias).
 * Un producto puede tener N codigos alternos ademas del sku/barcode principal.
 * Un codigo puede opcionalmente pertenecer a una variante (variantId) y/o a
 * una presentacion (presentationId).
 */
export type ProductCodeType = 'BARCODE' | 'SKU' | 'NAME';

export interface ProductCode {
  id: string;
  productId: string;
  codeType: ProductCodeType;
  value: string;
  variantId: string | null;
  presentationId: string | null;
  isPrimary: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateProductCodeDto {
  codeType: ProductCodeType;
  value: string;
  variantId?: string | null;
  presentationId?: string | null;
  isPrimary?: boolean;
  note?: string;
}

export type UpdateProductCodeDto = Partial<CreateProductCodeDto>;

export const productCodesApi = {
  /**
   * Lista los codigos alternos del producto
   * GET /admin/products/:productId/codes
   */
  getCodes: async (productId: string): Promise<ProductCode[]> => {
    return apiClient.get<ProductCode[]>(`/admin/products/${productId}/codes`);
  },

  /**
   * Crea un codigo alterno del producto
   * POST /admin/products/:productId/codes
   */
  createCode: async (productId: string, data: CreateProductCodeDto): Promise<ProductCode> => {
    return apiClient.post<ProductCode>(`/admin/products/${productId}/codes`, data);
  },

  /**
   * Edita un codigo alterno
   * PATCH /admin/products/:productId/codes/:codeId
   */
  updateCode: async (
    productId: string,
    codeId: string,
    data: UpdateProductCodeDto
  ): Promise<ProductCode> => {
    return apiClient.patch<ProductCode>(`/admin/products/${productId}/codes/${codeId}`, data);
  },

  /**
   * Borrado logico de un codigo alterno
   * DELETE /admin/products/:productId/codes/:codeId
   */
  deleteCode: async (productId: string, codeId: string): Promise<{ deleted: true }> => {
    return apiClient.delete<{ deleted: true }>(`/admin/products/${productId}/codes/${codeId}`);
  },
};

export default productCodesApi;
