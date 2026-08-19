import { apiClient } from './client';

/**
 * Variante de producto (color / atributo libre).
 * Puede tener SKU/barcode propios (se reflejan automaticamente como codigos
 * alternos con variantId) y opcionalmente saldo de stock propio si
 * tracksStock=true.
 */
export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  isSellable: boolean;
  tracksStock: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateProductVariantDto {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  isSellable?: boolean;
  tracksStock?: boolean;
  note?: string;
}

export type UpdateProductVariantDto = Partial<CreateProductVariantDto>;

export const productVariantsApi = {
  /**
   * Lista las variantes del producto
   * GET /admin/products/:productId/variants
   */
  getVariants: async (productId: string): Promise<ProductVariant[]> => {
    return apiClient.get<ProductVariant[]>(`/admin/products/${productId}/variants`);
  },

  /**
   * Crea una variante
   * POST /admin/products/:productId/variants
   */
  createVariant: async (
    productId: string,
    data: CreateProductVariantDto
  ): Promise<ProductVariant> => {
    return apiClient.post<ProductVariant>(`/admin/products/${productId}/variants`, data);
  },

  /**
   * Edita una variante
   * PATCH /admin/products/:productId/variants/:variantId
   */
  updateVariant: async (
    productId: string,
    variantId: string,
    data: UpdateProductVariantDto
  ): Promise<ProductVariant> => {
    return apiClient.patch<ProductVariant>(
      `/admin/products/${productId}/variants/${variantId}`,
      data
    );
  },

  /**
   * Borrado logico de la variante (y de sus codigos alternos asociados)
   * DELETE /admin/products/:productId/variants/:variantId
   */
  deleteVariant: async (productId: string, variantId: string): Promise<{ deleted: true }> => {
    return apiClient.delete<{ deleted: true }>(
      `/admin/products/${productId}/variants/${variantId}`
    );
  },
};

export default productVariantsApi;
