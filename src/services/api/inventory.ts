import { apiClient } from './client';

// ========== TYPES AND INTERFACES ==========

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  siteId: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  areas?: WarehouseArea[];
}

export interface WarehouseArea {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockItem {
  id?: string;
  productId: string;
  warehouseId: string;
  areaId?: string;
  quantityBase: number;
  reservedQuantityBase?: number;
  availableQuantityBase?: number;
  updatedAt: string;
  // Populated fields
  productTitle?: string;
  productSku?: string;
  warehouseName?: string;
  areaName?: string;
  minStockAlert?: number;
}

export type StockAdjustmentReason = 'PURCHASE' | 'SALE' | 'ADJUST' | 'TRANSFER';

export interface AdjustStockDto {
  productId: string;
  warehouseId: string;
  areaId?: string;
  deltaBase: number;
  reason: StockAdjustmentReason;
  clientOperationId?: string;
}

export interface TransferStockDto {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  fromAreaId?: string;
  toAreaId?: string;
  quantityBase: number;
  reason?: string;
  clientOperationId?: string;
}

export interface StockResponse {
  stockItems: StockItem[];
  total: number;
}

// Response from backend for stock queries (matches backend structure)
export interface StockItemResponse {
  id?: string;
  productId: string;
  warehouseId: string;
  areaId: string | null;
  quantityBase: number;
  reservedQuantityBase: number;
  availableQuantityBase: number;
  updatedAt: string;
  product?: {
    id: string;
    title: string;
    sku: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
    siteId: string;
  };
  area?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface StockByProductResponse {
  productId: string;
  productTitle: string;
  productSku: string;
  totalQuantityBase: number;
  stockByWarehouse: {
    warehouseId: string;
    warehouseName: string;
    quantityBase: number;
    areaId?: string;
    areaName?: string;
  }[];
}

export interface StockByWarehouseResponse {
  warehouseId: string;
  warehouseName: string;
  stockItems: {
    productId: string;
    productTitle: string;
    productSku: string;
    quantityBase: number;
    areaId?: string;
    areaName?: string;
  }[];
}

// ========== INVENTORY API ==========

export const inventoryApi = {
  // ========== ADMIN ENDPOINTS ==========

  // Adjust stock - POST /admin/inventory/adjust
  adjustStock: async (adjustmentData: AdjustStockDto): Promise<StockItem> => {
    return apiClient.post<StockItem>('/admin/inventory/adjust', adjustmentData);
  },

  // Get stock by product - GET /admin/inventory/stock/product/:productId
  getStockByProduct: async (productId: string): Promise<StockByProductResponse> => {
    return apiClient.get<StockByProductResponse>(`/admin/inventory/stock/product/${productId}`);
  },

  // Get stock by warehouse - GET /admin/inventory/stock/warehouse/:warehouseId
  getStockByWarehouse: async (warehouseId: string): Promise<StockByWarehouseResponse> => {
    return apiClient.get<StockByWarehouseResponse>(`/admin/inventory/stock/warehouse/${warehouseId}`);
  },

  // Get all stock items - GET /inventory/stock
  // Note: This endpoint requires stock.read permission and may require site/warehouse context
  // Returns an array of StockItemResponse directly from the backend
  getAllStock: async (params?: { siteId?: string; warehouseId?: string; productId?: string; areaId?: string }): Promise<StockItemResponse[]> => {
    return apiClient.get<StockItemResponse[]>('/inventory/stock', { params });
  },

  // ========== WAREHOUSES ENDPOINTS ==========

  // Get all warehouses - GET /admin/inventory/warehouses
  getWarehouses: async (): Promise<Warehouse[]> => {
    return apiClient.get<Warehouse[]>('/admin/inventory/warehouses');
  },

  // Get warehouse by ID - GET /admin/inventory/warehouses/:id
  getWarehouseById: async (warehouseId: string): Promise<Warehouse> => {
    return apiClient.get<Warehouse>(`/admin/inventory/warehouses/${warehouseId}`);
  },

  // Get areas of a specific warehouse - GET /admin/inventory/warehouses/:warehouseId/areas
  getWarehouseAreas: async (warehouseId: string): Promise<WarehouseArea[]> => {
    return apiClient.get<WarehouseArea[]>(`/admin/inventory/warehouses/${warehouseId}/areas`);
  },

  // Delete stock item - DELETE /admin/inventory/stock
  deleteStock: async (productId: string, warehouseId: string, areaId?: string): Promise<void> => {
    const params: any = { productId, warehouseId };
    if (areaId) {
      params.areaId = areaId;
    }
    return apiClient.delete('/admin/inventory/stock', { params });
  },

  // Get stock by product with areas - GET /inventory/stock/product/:productId
  getStockByProductWithAreas: async (productId: string): Promise<StockItemResponse[]> => {
    return apiClient.get<StockItemResponse[]>(`/inventory/stock/product/${productId}`);
  },
};

export default inventoryApi;
