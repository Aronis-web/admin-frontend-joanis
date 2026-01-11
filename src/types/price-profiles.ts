// Price Profile Types and Interfaces

/**
 * Price Profile (Perfil de Precio)
 * Defines different pricing strategies (Mayorista, Franquicia, Público, etc.)
 */
export interface PriceProfile {
  id: string;
  code: string;
  name: string;
  factorToCost: number | string; // Multiplicador sobre el costo (ej: 1.5 = 50% margen) - API puede devolver string
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Product Sale Price
 * Precio de venta de un producto según perfil y presentación
 */
export interface ProductSalePrice {
  id: string;
  productId: string;
  presentationId: string | null;
  profileId: string;
  priceCents: number;
  currency: string;
  isOverridden: boolean; // Si fue modificado manualmente
  createdAt: string;
  updatedAt: string;
  profile?: PriceProfile;
  presentation?: {
    id: string;
    code: string;
    name: string;
  };
}

// ============================================
// Request/Response Types
// ============================================

/**
 * Create price profile request
 */
export interface CreatePriceProfileRequest {
  code: string;
  name: string;
  factorToCost: number;
  isActive?: boolean;
}

/**
 * Update price profile request
 */
export interface UpdatePriceProfileRequest {
  code?: string;
  name?: string;
  factorToCost?: number;
  isActive?: boolean;
}

/**
 * Get price profiles query parameters
 */
export interface GetPriceProfilesParams {
  q?: string; // Search in code and name
  isActive?: boolean;
  page?: number;
  limit?: number;
  orderBy?: 'code' | 'name' | 'factorToCost' | 'createdAt';
  orderDir?: 'ASC' | 'DESC';
}

/**
 * Price profiles response with pagination
 */
export interface PriceProfilesResponse {
  data: PriceProfile[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Update sale price request
 */
export interface UpdateSalePriceRequest {
  productId: string;
  presentationId?: string | null;
  profileId: string;
  priceCents: number;
}

/**
 * Product sale prices response
 */
export interface ProductSalePricesResponse {
  data: ProductSalePrice[];
  total?: number;
}

/**
 * Recalculate prices response
 */
export interface RecalculatePricesResponse {
  updated: number;
  message: string;
}
