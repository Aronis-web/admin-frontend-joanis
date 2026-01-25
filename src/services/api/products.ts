import { apiClient } from './client';
import { config } from '@/utils/config';

// Presentation entity
export interface Presentation {
  id: string;
  code: string;
  name: string;
  isBase: boolean;
  createdAt: string;
  updatedAt: string;
}

// Product presentation relationship
export interface ProductPresentation {
  productId: string;
  presentationId: string;
  isBase: boolean;
  factorToBase: number;
  minOrderQty: number;
  orderStep: number;
  presentation: Presentation;
}

// Category entity
export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Product Sale Price (for product responses)
export interface ProductSalePrice {
  productId: string;
  presentationId: string;
  profileId: string;
  priceCents: number;
  currency: string;
  isOverridden: boolean;
  profile?: {
    id: string;
    code: string;
    name: string;
    factorToCost: number;
  };
  presentation?: {
    id: string;
    code: string;
    name: string;
  };
}

// Stock Item (for product responses)
export interface StockItem {
  productId: string;
  warehouseId: string;
  areaId: string | null;
  quantityBase: number;
  reservedQuantityBase?: number;
  availableQuantityBase?: number;
  updatedAt: string;
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  area?: {
    id: string;
    name: string;
  } | null;
}

// Product entity for list endpoint
export interface Product {
  id: string;
  correlativeNumber: number; // ✅ NUEVO - Número único auto-generado
  title: string;
  description: string;
  sku: string; // Ahora permite duplicados
  barcode: string;
  categoryId: string;
  status: 'active' | 'inactive' | 'discontinued' | 'draft' | 'archived';
  taxType: 'GRAVADO' | 'EXONERADO' | 'INAFECTO' | 'GRATUITO';
  costCents: number; // Changed from priceCents to costCents (cost of product)
  priceCents?: number; // Deprecated - kept for backward compatibility
  currency: string;
  minStockAlert: number;
  imageUrl?: string; // Main product image URL
  imageUrls?: string[]; // Multiple product images
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  category?: Category;
  presentations?: ProductPresentation[];
  salePrices?: ProductSalePrice[];
  stockItems?: StockItem[];
}

// Product entity for detail endpoint (simplified)
export interface ProductDetail {
  id: string;
  correlativeNumber: number; // ✅ NUEVO - Número único auto-generado
  title: string;
  sku: string; // Ahora permite duplicados
  priceCentsBase: number;
  currency: string;
  imageUrl?: string;
  imageUrls?: string[];
  category: {
    id: string;
    name: string;
  };
  presentations: ProductPresentationDetail[];
}

// Presentation for product detail
export interface ProductPresentationDetail {
  code: string;
  name: string;
  factor: number;
  priceCents: number;
  available: number;
}

// Response interfaces
export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  categoryId?: string;
  q?: string;
  include?: string;
  status?: string;
}

// Legacy interfaces for backward compatibility
export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  image?: string;
  productCount: number;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  images?: string[];
  createdAt: string;
}

export interface ReviewsResponse {
  reviews: Review[];
  total: number;
  averageRating: number;
}

// Create/Update product DTOs
export interface CreateProductDto {
  title: string;
  description?: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  status: 'draft' | 'active' | 'archived';
  taxType: 'GRAVADO' | 'EXONERADO' | 'INAFECTO' | 'GRATUITO';
  costCents: number; // Cost of the product (base for price calculations)
  currency?: string;
  minStockAlert?: number;
  presentations: {
    presentationIdOrCode: string;
    isBase: boolean;
    factorToBase: number;
    minOrderQty: number;
    orderStep: number;
  }[];
  salePrices?: {
    presentationIdOrCode: string;
    profileIdOrCode: string;
    priceCents: number;
  }[];
}

export interface UpdateProductDto {
  title?: string;
  description?: string;
  sku?: string;
  barcode?: string;
  categoryId?: string;
  status?: 'draft' | 'active' | 'archived';
  taxType?: 'GRAVADO' | 'EXONERADO' | 'INAFECTO' | 'GRATUITO';
  costCents?: number; // Cost of the product
  currency?: string;
  minStockAlert?: number;
  presentations?: {
    presentationIdOrCode: string;
    isBase: boolean;
    factorToBase: number;
    minOrderQty: number;
    orderStep: number;
  }[];
  salePrices?: {
    presentationIdOrCode: string;
    profileIdOrCode: string;
    priceCents: number;
  }[];
}

export const productsApi = {
  // ========== ADMIN ENDPOINTS (Require authentication and permissions) ==========

  // Get all products (admin) - GET /admin/products
  getAllProducts: async (filters?: ProductFilters): Promise<ProductListResponse> => {
    const params = {
      ...filters,
      limit: filters?.limit || config.PAGINATION.DEFAULT_PAGE_SIZE,
    };
    return apiClient.get<ProductListResponse>('/admin/products', { params });
  },

  // Get product by ID (admin) - GET /admin/products/:id
  getProductById: async (id: string): Promise<Product> => {
    return apiClient.get<Product>(`/admin/products/${id}`);
  },

  // Get product by SKU (admin) - GET /admin/products/sku/:sku
  getProductBySku: async (sku: string): Promise<Product> => {
    return apiClient.get<Product>(`/admin/products/sku/${sku}`);
  },

  // Create product - POST /admin/products
  createProduct: async (productData: CreateProductDto): Promise<Product> => {
    return apiClient.post<Product>('/admin/products', productData);
  },

  // Update product - PATCH /admin/products/:id
  updateProduct: async (id: string, productData: UpdateProductDto): Promise<Product> => {
    return apiClient.patch<Product>(`/admin/products/${id}`, productData);
  },

  // Delete product (soft delete) - DELETE /admin/products/:id
  deleteProduct: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/admin/products/${id}`);
  },

  // ========== PRICE MANAGEMENT ENDPOINTS ==========

  // Get all sale prices for a product - GET /admin/products/:id/sale-prices
  getProductSalePrices: async (productId: string): Promise<any> => {
    return apiClient.get<any>(`/admin/products/${productId}/sale-prices`);
  },

  // Update a specific sale price - PUT /admin/products/:id/sale-price
  updateProductSalePrice: async (
    productId: string,
    priceData: {
      productId: string;
      presentationId?: string | null;
      profileId: string;
      priceCents: number;
    }
  ): Promise<any> => {
    return apiClient.put<any>(`/admin/products/${productId}/sale-price`, priceData);
  },

  // Recalculate all non-overridden sale prices - POST /admin/products/:id/recalculate-prices
  recalculateProductPrices: async (productId: string): Promise<any> => {
    return apiClient.post<any>(`/admin/products/${productId}/recalculate-prices`, {});
  },

  // ========== PUBLIC ENDPOINTS (No authentication required) ==========

  // Get products list (GET /catalog/products)
  getProducts: async (filters?: ProductFilters): Promise<ProductListResponse> => {
    const params = {
      ...filters,
      limit: filters?.limit || config.PAGINATION.DEFAULT_PAGE_SIZE,
    };
    return apiClient.get<ProductListResponse>('/catalog/products', { params });
  },

  // Get product detail with stock (GET /catalog/products/:id)
  getProduct: async (id: string): Promise<ProductDetail> => {
    return apiClient.get<ProductDetail>(`/catalog/products/${id}`);
  },

  // Legacy methods for backward compatibility
  getCategories: async (): Promise<ProductCategory[]> => {
    return apiClient.get<ProductCategory[]>('/products/categories');
  },

  getReviews: async (productId: string, page = 1): Promise<ReviewsResponse> => {
    return apiClient.get<ReviewsResponse>(`/products/${productId}/reviews`, {
      params: { page },
    });
  },

  addReview: async (
    productId: string,
    rating: number,
    comment: string,
    images?: string[]
  ): Promise<Review> => {
    return apiClient.post<Review>(`/products/${productId}/reviews`, {
      rating,
      comment,
      images,
    });
  },

  searchProducts: async (query: string, page = 1): Promise<ProductListResponse> => {
    return apiClient.get<ProductListResponse>('/catalog/products', {
      params: { q: query, page },
    });
  },

  getFeaturedProducts: async (): Promise<Product[]> => {
    return apiClient.get<Product[]>('/products/featured');
  },

  getRelatedProducts: async (productId: string): Promise<Product[]> => {
    return apiClient.get<Product[]>(`/products/${productId}/related`);
  },

  // ========== PRODUCT IMAGES ENDPOINTS ==========

  // Get product images - GET /files/products/:productId/images
  getProductImages: async (
    productId: string
  ): Promise<{
    success: boolean;
    productId: string;
    count: number;
    images: Array<{
      filename: string;
      url: string;
      path: string;
    }>;
  }> => {
    return apiClient.get(`/files/products/${productId}/images`);
  },

  // ========== BULK UPLOAD ENDPOINTS ==========

  // Download bulk upload template - GET /admin/products/bulk/template
  downloadBulkTemplate: async (): Promise<Blob> => {
    return apiClient.get('/admin/products/bulk/template', {
      responseType: 'blob',
    });
  },

  // Upload bulk products file - POST /admin/products/bulk/upload
  uploadBulkProducts: async (
    file: File | Blob | any
  ): Promise<{
    successCount: number;
    errorCount: number;
    totalRows: number;
    errors: Array<{
      row: number;
      error: string;
      sku?: string;
    }>;
    createdProductIds: string[];
  }> => {
    const formData = new FormData();

    // In React Native, file can be an object with { uri, type, name }
    // In web, it's a File or Blob object
    formData.append('file', file);

    // Don't set Content-Type manually - let the interceptor handle it
    return apiClient.post('/admin/products/bulk/upload', formData);
  },

  // Get bulk upload history - GET /admin/products/bulk/history
  getBulkUploadHistory: async (params?: {
    page?: number;
    limit?: number;
    userId?: string;
  }): Promise<{
    history: Array<{
      id: string;
      filename: string;
      uploadedBy: string;
      uploadedByName: string;
      uploadedByEmail: string;
      status: 'in_progress' | 'completed' | 'completed_with_errors' | 'failed';
      totalRows: number;
      successCount: number;
      errorCount: number;
      createdProductIds: string[];
      errors: Array<{
        row: number;
        error: string;
        sku?: string;
      }>;
      processingDurationMs: number;
      createdAt: string;
      completedAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> => {
    return apiClient.get('/admin/products/bulk/history', { params });
  },

  // Get bulk upload history detail - GET /admin/products/bulk/history/:id
  getBulkUploadHistoryDetail: async (
    id: string
  ): Promise<{
    id: string;
    filename: string;
    uploadedBy: string;
    uploadedByName: string;
    uploadedByEmail: string;
    status: 'in_progress' | 'completed' | 'completed_with_errors' | 'failed';
    totalRows: number;
    successCount: number;
    errorCount: number;
    createdProductIds: string[];
    errors: Array<{
      row: number;
      error: string;
      sku?: string;
    }>;
    processingDurationMs: number;
    createdAt: string;
    completedAt: string;
  }> => {
    return apiClient.get(`/admin/products/bulk/history/${id}`);
  },

  // ========== BULK UPDATE ENDPOINTS ==========

  // Download bulk update format - POST /admin/products/bulk/download-update-format
  downloadBulkUpdateFormat: async (filters?: {
    fromCorrelative?: number;
    toCorrelative?: number;
    correlatives?: number[];
    fromDate?: string;
    toDate?: string;
    campaignId?: string;
  }): Promise<Blob> => {
    return apiClient.post('/admin/products/bulk/download-update-format', filters, {
      responseType: 'blob',
    });
  },

  // Upload bulk update file - POST /admin/products/bulk/update
  uploadBulkUpdate: async (
    file: File | Blob | any
  ): Promise<{
    successCount: number;
    errorCount: number;
    totalRows: number;
    errors: Array<{
      row: number;
      error: string;
      correlative?: number;
      sku?: string;
    }>;
    updatedProductIds: string[];
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/admin/products/bulk/update', formData);
  },
};

// Example usage functions as specified in the documentation
export const exampleUsage = {
  // Function to get products with parameters
  async getProducts(params?: {
    page?: number;
    limit?: number;
    categoryId?: string;
    q?: string;
  }): Promise<ProductListResponse> {
    const queryParams = new URLSearchParams();

    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.limit) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params?.categoryId) {
      queryParams.append('categoryId', params.categoryId);
    }
    if (params?.q) {
      queryParams.append('q', params.q);
    }

    const response = await fetch(`${config.API_URL}/catalog/products?${queryParams}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Function to get product detail
  async getProduct(id: string): Promise<ProductDetail> {
    const response = await fetch(`${config.API_URL}/catalog/products/${id}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Example main function demonstrating usage
  async main() {
    try {
      // Get products list
      const productList = await this.getProducts({
        page: 1,
        limit: 10,
        q: 'agua',
      });

      console.log('Productos encontrados:', productList.total);
      console.log('Primer producto:', productList.products[0]);

      // Get product detail
      if (productList.products.length > 0) {
        const productDetail = await this.getProduct(productList.products[0].id);
        console.log('Presentaciones disponibles:', productDetail.presentations);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  },
};

export default productsApi;
