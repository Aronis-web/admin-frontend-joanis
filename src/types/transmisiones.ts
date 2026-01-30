/**
 * Transmisiones Types
 *
 * Type definitions for the Transmisiones module
 */

// Transmision Status
export enum TransmisionStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// Product Status (from products module)
export enum ProductStatus {
  PRELIMINARY = 'preliminary',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONTINUED = 'discontinued',
  DRAFT = 'draft',
  ARCHIVED = 'archived',
}

// Transmision Entity
export interface Transmision {
  id: string;
  name: string;
  description?: string;
  status: TransmisionStatus;
  priceProfileId?: string | null; // Perfil de precios para calcular precios automáticamente
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  priceProfile?: {
    id: string;
    code: string;
    name: string;
    factorToCost: number;
    isActive: boolean;
  };
}

// Transmision Product Entity
export interface TransmisionProduct {
  id: string;
  transmisionId: string;
  productId: string;
  productStatus: ProductStatus;
  costCents: number;
  salePriceCents: number;
  currency: string;
  notes?: string;
  lastValidationCheck?: string;
  wasValidated: boolean;
  createdAt: string;
  updatedAt: string;
  // Stock fields (direct from product)
  stock?: number;
  preliminaryStock?: number;
  // Populated product data
  product?: {
    id: string;
    correlativeNumber?: number;
    title: string;
    sku: string;
    barcode?: string;
    description?: string;
    imageUrl?: string;
    categoryId?: string;
    category?: {
      id: string;
      name: string;
    };
    preliminaryStock?: number;
    stock?: number;
    name?: string; // Alias for title
  };
}

// Transmision with products
export interface TransmisionWithProducts extends Transmision {
  products?: TransmisionProduct[];
  productCount?: number;
}

// Create Transmision DTO
export interface CreateTransmisionRequest {
  name: string;
  description?: string;
  status?: TransmisionStatus;
  priceProfileId?: string | null;
}

// Update Transmision DTO
export interface UpdateTransmisionRequest {
  name?: string;
  description?: string;
  status?: TransmisionStatus;
  priceProfileId?: string | null;
}

// Add Product to Transmision DTO
export interface AddProductToTransmisionRequest {
  productId: string;
  costCents?: number; // Opcional - si no se provee, se usa el costo del producto
  salePriceCents?: number; // Opcional - se calcula automáticamente con priceProfile si no se provee
  currency?: string;
  notes?: string;
}

// Quick Edit Prices DTO
export interface QuickEditPricesRequest {
  costCents?: number;
  salePriceCents?: number;
}

// Validation Check Result
export interface ValidationCheckResult {
  transmisionProductId: string;
  productId: string;
  previousStatus: ProductStatus;
  currentStatus: ProductStatus;
  wasValidated: boolean;
  statusChanged: boolean;
  lastValidationCheck: string;
  message: string;
}

// Update Product Data Result
export interface UpdateProductDataResult {
  transmisionProductId: string;
  productId: string;
  updated: boolean;
  changes: {
    costCents?: {
      old: number;
      new: number;
    };
    salePriceCents?: {
      old: number;
      new: number;
    };
    productStatus?: {
      old: ProductStatus;
      new: ProductStatus;
    };
  };
  message: string;
}

// Query Transmisiones DTO
export interface QueryTransmisionesRequest {
  page?: number;
  limit?: number;
  status?: TransmisionStatus;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// Paginated Response
export interface PaginatedTransmisionesResponse {
  data: Transmision[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Paginated Transmision Products Response
export interface PaginatedTransmisionProductsResponse {
  data: TransmisionProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Helper function to format cents to currency
export const formatCentsToCurrency = (cents: number, currency: string = 'PEN'): string => {
  const amount = cents / 100;
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

// Helper function to convert currency to cents
export const currencyToCents = (amount: number): number => {
  return Math.round(amount * 100);
};

// Helper function to get transmision status label
export const getTransmisionStatusLabel = (status: TransmisionStatus): string => {
  const labels: Record<TransmisionStatus, string> = {
    [TransmisionStatus.DRAFT]: 'Borrador',
    [TransmisionStatus.IN_PROGRESS]: 'En Progreso',
    [TransmisionStatus.COMPLETED]: 'Completada',
    [TransmisionStatus.CANCELLED]: 'Cancelada',
  };
  return labels[status];
};

// Helper function to get transmision status color
export const getTransmisionStatusColor = (status: TransmisionStatus): string => {
  const colors: Record<TransmisionStatus, string> = {
    [TransmisionStatus.DRAFT]: '#6B7280', // Gray
    [TransmisionStatus.IN_PROGRESS]: '#0EA5E9', // Blue
    [TransmisionStatus.COMPLETED]: '#10B981', // Green
    [TransmisionStatus.CANCELLED]: '#EF4444', // Red
  };
  return colors[status];
};

// Helper function to get product status label
export const getProductStatusLabel = (status: ProductStatus): string => {
  const labels: Record<ProductStatus, string> = {
    [ProductStatus.PRELIMINARY]: 'Preliminar',
    [ProductStatus.ACTIVE]: 'Activo',
    [ProductStatus.INACTIVE]: 'Inactivo',
    [ProductStatus.DISCONTINUED]: 'Descontinuado',
    [ProductStatus.DRAFT]: 'Borrador',
    [ProductStatus.ARCHIVED]: 'Archivado',
  };
  return labels[status];
};

// Helper function to get product status color
export const getProductStatusColor = (status: ProductStatus): string => {
  const colors: Record<ProductStatus, string> = {
    [ProductStatus.PRELIMINARY]: '#F59E0B', // Orange
    [ProductStatus.ACTIVE]: '#10B981', // Green
    [ProductStatus.INACTIVE]: '#6B7280', // Gray
    [ProductStatus.DISCONTINUED]: '#EF4444', // Red
    [ProductStatus.DRAFT]: '#6B7280', // Gray
    [ProductStatus.ARCHIVED]: '#9CA3AF', // Light Gray
  };
  return colors[status];
};

// Helper function to check if product is preliminary
export const isProductPreliminary = (status: ProductStatus): boolean => {
  return status === ProductStatus.PRELIMINARY;
};

// Helper function to check if product is active
export const isProductActive = (status: ProductStatus): boolean => {
  return status === ProductStatus.ACTIVE;
};

// Helper function to calculate profit margin
export const calculateProfitMargin = (costCents: number, salePriceCents: number): number => {
  if (costCents === 0) {
    return 0;
  }
  return ((salePriceCents - costCents) / costCents) * 100;
};

// Helper function to calculate profit amount
export const calculateProfitAmount = (costCents: number, salePriceCents: number): number => {
  return salePriceCents - costCents;
};

// Status labels for UI
export const TransmisionStatusLabels: Record<TransmisionStatus, string> = {
  [TransmisionStatus.DRAFT]: 'Borrador',
  [TransmisionStatus.IN_PROGRESS]: 'En Progreso',
  [TransmisionStatus.COMPLETED]: 'Completada',
  [TransmisionStatus.CANCELLED]: 'Cancelada',
};

// Status colors for UI
export const TransmisionStatusColors: Record<TransmisionStatus, string> = {
  [TransmisionStatus.DRAFT]: '#6B7280',
  [TransmisionStatus.IN_PROGRESS]: '#0EA5E9',
  [TransmisionStatus.COMPLETED]: '#10B981',
  [TransmisionStatus.CANCELLED]: '#EF4444',
};

// Product status labels for UI
export const ProductStatusLabels: Record<ProductStatus, string> = {
  [ProductStatus.PRELIMINARY]: 'Preliminar',
  [ProductStatus.ACTIVE]: 'Activo',
  [ProductStatus.INACTIVE]: 'Inactivo',
  [ProductStatus.DISCONTINUED]: 'Descontinuado',
  [ProductStatus.DRAFT]: 'Borrador',
  [ProductStatus.ARCHIVED]: 'Archivado',
};

// Product status colors for UI
export const ProductStatusColors: Record<ProductStatus, string> = {
  [ProductStatus.PRELIMINARY]: '#F59E0B',
  [ProductStatus.ACTIVE]: '#10B981',
  [ProductStatus.INACTIVE]: '#6B7280',
  [ProductStatus.DISCONTINUED]: '#EF4444',
  [ProductStatus.DRAFT]: '#6B7280',
  [ProductStatus.ARCHIVED]: '#9CA3AF',
};
