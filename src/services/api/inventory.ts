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

export type ProductStockStatus =
  | 'with_stock'
  | 'without_stock'
  | 'available'
  | 'reserved'
  | 'negative'
  | 'low_stock';

export type ProductStockSortBy =
  | 'name'
  | 'sku'
  | 'totalStock'
  | 'reservedStock'
  | 'availableStock'
  | 'updatedAt';

export type StockBatchStatus = 'ACTIVE' | 'DEPLETED' | 'BLOCKED' | 'available' | 'exhausted';
export type StockBatchSortBy = 'receivedAt' | 'expirationDate' | 'availableStock' | 'unitCost';

export interface ProductsStockParams {
  page?: number;
  limit?: number;
  q?: string;
  productId?: string;
  warehouseId?: string;
  areaId?: string;
  categoryId?: string;
  productStatus?: string;
  includeZeroStock?: boolean;
  minAvailableStock?: number;
  stockStatus?: ProductStockStatus;
  sortBy?: ProductStockSortBy;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ProductStockAreaSummary {
  areaId: string;
  areaCode: string;
  areaName: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
}

export interface ProductStockWarehouseSummary {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  siteCode?: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  areas: ProductStockAreaSummary[];
}

export interface ProductStockSummaryItem {
  productId: string;
  correlativeNumber?: number;
  sku?: string;
  barcode?: string;
  name: string;
  status: string;
  categoryId?: string;
  categoryName?: string;
  minStockAlert?: number;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  warehouses: ProductStockWarehouseSummary[];
}

export interface ProductsStockResponse {
  data: ProductStockSummaryItem[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ProductStockDetailParams {
  warehouseId?: string;
  areaId?: string;
  includeZeroStock?: boolean;
  includeBatches?: boolean;
  includeMovements?: boolean;
  movementsLimit?: number;
  batchStatus?: StockBatchStatus;
  sortBatchesBy?: StockBatchSortBy;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ProductStockDetailProduct {
  productId: string;
  correlativeNumber?: number;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  status: string;
  categoryId?: string;
  categoryName?: string;
  taxType?: string;
  currency?: string;
  baseCostCents?: number;
  minStockAlert?: number;
}

export interface ProductStockDetailSummary {
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  warehousesCount: number;
  areasCount: number;
  batchesCount: number;
  availableValueCents: number;
  lowStock: boolean;
}

export interface ProductStockBatchSupplier {
  supplierId: string;
  code?: string;
  commercialName?: string;
  taxIdType?: string;
  taxIdNumber?: string;
}

export interface ProductStockBatchPurchase {
  purchaseId: string;
  code?: string;
  guideType?: string;
  guideNumber?: string;
  guideDate?: string;
  status?: string;
  purchaseProductId?: string;
  purchaseProductCostCents?: number;
  validatedStock?: number;
}

export interface ProductStockBatch {
  batchId: string;
  batchNumber?: string;
  status: string;
  receivedAt?: string;
  expirationDate?: string;
  initialStock: number;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  unitCostCents?: number;
  currentValueCents?: number;
  currency?: string;
  notes?: string;
  supplier?: ProductStockBatchSupplier | null;
  purchase?: ProductStockBatchPurchase | null;
}

export interface ProductStockDetailArea {
  areaId: string;
  areaCode?: string;
  areaName?: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  availableValueCents?: number;
  batches?: ProductStockBatch[];
}

export interface ProductStockDetailWarehouse {
  warehouseId: string;
  warehouseCode?: string;
  warehouseName: string;
  siteId?: string;
  siteCode?: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  availableValueCents?: number;
  areas: ProductStockDetailArea[];
}

export interface ProductStockMovement {
  movementId: string;
  movementType: string;
  quantity: number;
  stockBefore?: number;
  stockAfter?: number;
  warehouseId?: string;
  warehouseName?: string;
  areaId?: string | null;
  areaName?: string | null;
  referenceType?: string;
  referenceId?: string | null;
  performedBy?: string;
  performedByName?: string;
  performedByEmail?: string;
  notes?: string;
  createdAt: string;
}

export interface ProductStockDetailResponse {
  product: ProductStockDetailProduct;
  stockSummary: ProductStockDetailSummary;
  warehouses: ProductStockDetailWarehouse[];
  lastMovements: ProductStockMovement[];
}

// ========== EXPORT STOCK TYPES ==========

export type ExportFormat = 'excel' | 'pdf';

/**
 * Destinatario WhatsApp (compartido por formato y reporte de stock).
 * Se envía UNO de los dos: siteContactId (prioritario) o phoneNumber.
 */
export interface StockWhatsAppRecipient {
  /** UUID de un contacto de sede activo con WhatsApp habilitado (prioritario). */
  siteContactId?: string;
  /** Celular libre con código de país (solo dígitos, 10-15). */
  phoneNumber?: string;
  /** Nombre informativo cuando se usa phoneNumber. */
  contactName?: string;
  /** Texto opcional que acompaña al WhatsApp. */
  caption?: string;
}

export interface SendStockFormatDto extends StockWhatsAppRecipient {
  siteId: string;
  /** Opcional. Si se omite, incluye todos los almacenes de la sede. */
  warehouseId?: string;
}

export interface ExportStockDto extends StockWhatsAppRecipient {
  format: ExportFormat;
  siteId: string;
  startDate?: string; // ISO 8601 format
  endDate?: string; // ISO 8601 format
  includePrices?: boolean;
}

/**
 * Respuesta 202 Accepted común para envío async por WhatsApp.
 */
export interface SendStockJobResponse {
  jobId: string;
  contactName: string;
  message: string;
}

// ========== INVENTORY ENTRIES ==========

export type InventoryEntrySourceType =
  | 'PURCHASE'
  | 'MANUAL_ADJUSTMENT'
  | 'BULK_STOCK_UPDATE'
  | 'TRANSFER'
  | 'RETURN'
  | string;

export interface ProductInventoryEntryLocation {
  warehouseId: string;
  areaId: string;
  quantity: number;
}

export interface ProductInventoryEntry {
  entryId: string;
  entryNumber: string;
  sourceType: InventoryEntrySourceType;
  /** BigInt en el server, viene serializado como string (centavos). Ej: "1690" = S/ 16.90 */
  unitCostCents: string;
  initialQuantity: number;
  remainingQuantity: number;
  receivedAt: string;
  purchaseId: string | null;
  locations: ProductInventoryEntryLocation[];
}

export interface ProductInventoryEntriesParams {
  warehouseId?: string;
}

export interface ExportInventoryEntriesParams {
  /** ISO date (YYYY-MM-DD o full ISO). Default server: primer día del mes en curso. */
  from?: string;
  /** ISO date (YYYY-MM-DD o full ISO). Default server: hoy. */
  to?: string;
  /** Uno o varios warehouseIds (se serializan como `warehouseId=a&warehouseId=b`). */
  warehouseId?: string | string[];
  productId?: string;
  sourceType?: InventoryEntrySourceType;
  supplierId?: string;
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
    return apiClient.get<StockByWarehouseResponse>(
      `/admin/inventory/stock/warehouse/${warehouseId}`
    );
  },

  // Get all stock items - GET /inventory/stock
  // Note: This endpoint requires stock.read permission and may require site/warehouse context
  // Returns an array of StockItemResponse directly from the backend
  getAllStock: async (params?: {
    siteId?: string;
    warehouseId?: string;
    productId?: string;
    areaId?: string;
  }): Promise<StockItemResponse[]> => {
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

  // ========== CONSOLIDATED PRODUCT STOCK ENDPOINTS ==========

  /**
   * Listado paginado de productos con stock consolidado por almacén y área.
   * GET /admin/inventory/products/stock
   */
  getProductsStock: async (params?: ProductsStockParams): Promise<ProductsStockResponse> => {
    return apiClient.get<ProductsStockResponse>('/admin/inventory/products/stock', { params });
  },

  /**
   * Detalle completo de stock de un producto: ubicaciones, lotes y movimientos.
   * GET /admin/inventory/products/:productId/stock-detail
   */
  getProductStockDetail: async (
    productId: string,
    params?: ProductStockDetailParams
  ): Promise<ProductStockDetailResponse> => {
    return apiClient.get<ProductStockDetailResponse>(
      `/admin/inventory/products/${productId}/stock-detail`,
      { params }
    );
  },

  /**
   * Entries FIFO con remaining_quantity > 0 de un producto.
   * GET /admin/inventory/entries/by-product/:productId
   */
  getProductInventoryEntries: async (
    productId: string,
    params?: ProductInventoryEntriesParams
  ): Promise<ProductInventoryEntry[]> => {
    return apiClient.get<ProductInventoryEntry[]>(
      `/admin/inventory/entries/by-product/${productId}`,
      { params }
    );
  },

  /**
   * Reporte Excel de entries (4 hojas) en streaming.
   * GET /admin/inventory/entries/export
   * Filtros opcionales: from, to (ISO date), warehouseId, productId, sourceType, supplierId.
   * Default server: mes en curso.
   */
  exportInventoryEntries: async (params?: ExportInventoryEntriesParams): Promise<Blob> => {
    const { config } = await import('@/utils/config');
    const { downloadWithAuth } = await import('@/utils/downloadWithAuth');

    const query = new URLSearchParams();
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.warehouseId) {
      if (Array.isArray(params.warehouseId)) {
        params.warehouseId.forEach((id) => query.append('warehouseId', id));
      } else {
        query.append('warehouseId', params.warehouseId);
      }
    }
    if (params?.productId) query.append('productId', params.productId);
    if (params?.sourceType) query.append('sourceType', params.sourceType);
    if (params?.supplierId) query.append('supplierId', params.supplierId);

    const qs = query.toString();
    const url = `${config.API_URL}/admin/inventory/entries/export${qs ? `?${qs}` : ''}`;

    return downloadWithAuth(url, { method: 'GET' });
  },

  // ========== V2 OPTIMIZED ENDPOINTS ==========

  /**
   * Búsqueda optimizada de stock (v2)
   * Usa caché Redis y búsqueda multi-campo
   * GET /admin/inventory/v2/search
   */
  searchStockV2: async (params: {
    q: string;
    limit?: number;
    warehouseId?: string;
    areaId?: string;
    lowStockOnly?: boolean;
  }): Promise<{
    results: StockItemResponse[];
    total: number;
    limit: number;
    hasMore: boolean;
    searchTime: number;
    cached: boolean;
  }> => {
    return apiClient.get('/admin/inventory/v2/search', { params });
  },

  /**
   * Listado paginado optimizado de stock (v2)
   * Usa caché Redis
   * GET /admin/inventory/v2/list
   */
  getStockV2: async (params?: {
    page?: number;
    limit?: number;
    warehouseId?: string;
    areaId?: string;
    lowStockOnly?: boolean;
    q?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{
    data: StockItemResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    searchTime?: number;
    cached?: boolean;
  }> => {
    const response = await apiClient.get('/admin/inventory/v2/list', { params });
    // Backend retorna "data" en lugar de "results", mapear a "results" para consistencia
    return {
      ...response,
      results: response.data,
    };
  },

  /**
   * Invalidar caché de inventario (v2)
   * DELETE /admin/inventory/v2/cache
   */
  invalidateStockCacheV2: async (): Promise<void> => {
    return apiClient.delete('/admin/inventory/v2/cache');
  },

  // ========== EXPORT / SEND ENDPOINTS (async por WhatsApp) ==========

  /**
   * Generar y enviar el REPORTE de stock por WhatsApp.
   * POST /admin/inventory/export
   *
   * Ya NO devuelve un blob: el backend responde 202 con un jobId y el reporte
   * se procesa en background (por lotes) y se envía por WhatsApp al contacto
   * indicado. Requiere siteContactId o phoneNumber en el body.
   */
  sendStockReport: async (data: ExportStockDto): Promise<SendStockJobResponse> => {
    return apiClient.post<SendStockJobResponse>('/admin/inventory/export', data);
  },

  // ========== BULK STOCK UPDATE ENDPOINTS ==========

  /**
   * Generar y enviar el FORMATO de actualización masiva de stock por WhatsApp.
   * POST /admin/inventory/stock/download-format
   *
   * Antes descargaba un Excel; ahora responde 202 con jobId y el archivo llega
   * por WhatsApp. El Excel incluye dos columnas de estado del producto
   * (ESTADO ACTUAL solo lectura y NUEVO ESTADO editable con dropdown
   * ACTIVO/ARCHIVADO). Los productos archivados no se incluyen.
   */
  sendStockFormat: async (data: SendStockFormatDto): Promise<SendStockJobResponse> => {
    return apiClient.post<SendStockJobResponse>('/admin/inventory/stock/download-format', data);
  },

  /**
   * Upload bulk stock update
   * POST /admin/inventory/stock/upload-update
   * Processes Excel file and updates stock with automatic movement history
   */
  uploadStockUpdate: async (
    file: File | Blob | any,
    userId: string
  ): Promise<{
    success: boolean;
    totalRows: number;
    updatedRows: number;
    errors: Array<{
      row: number;
      sku: string;
      error: string;
    }>;
  }> => {
    console.log('🔍 [API] uploadStockUpdate called');
    console.log('🔍 [API] File received:', {
      type: typeof file,
      isBlob: file instanceof Blob,
      isFile: file instanceof File,
      hasUri: 'uri' in file,
      uri: file.uri,
      name: file.name,
      mimeType: file.type,
    });
    console.log('🔍 [API] User ID:', userId);

    const formData = new FormData();

    console.log('📦 [API] Creating FormData...');
    formData.append('file', file);
    formData.append('userId', userId);

    console.log('✅ [API] FormData created, appending file and userId');
    console.log('🚀 [API] Calling apiClient.post to /admin/inventory/stock/upload-update');

    try {
      const result = await apiClient.post('/admin/inventory/stock/upload-update', formData);
      console.log('✅ [API] Upload successful, result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error: any) {
      console.error('❌ [API] Upload failed:', error);
      console.error('❌ [API] Error details:', {
        message: error.message,
        response: error.response,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        stack: error.stack,
      });
      throw error;
    }
  },
};

export default inventoryApi;
