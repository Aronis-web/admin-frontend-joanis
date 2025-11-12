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

// Product entity for list endpoint
export interface Product {
  id: string;
  title: string;
  description: string;
  sku: string;
  barcode: string;
  categoryId: string;
  status: 'active' | 'inactive' | 'discontinued';
  taxType: 'GRAVADO' | 'EXONERADO' | 'INAFECTO';
  priceCents: number;
  currency: string;
  minStockAlert: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  category: Category;
  presentations: ProductPresentation[];
}

// Product entity for detail endpoint (simplified)
export interface ProductDetail {
  id: string;
  title: string;
  sku: string;
  priceCentsBase: number;
  currency: string;
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

export const productsApi = {
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

    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params?.q) queryParams.append('q', params.q);

    const response = await fetch(
      `${config.API_URL}/catalog/products?${queryParams}`
    );

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
        q: 'agua'
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
  }
};

export default productsApi;
