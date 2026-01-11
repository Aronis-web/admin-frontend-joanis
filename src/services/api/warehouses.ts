import { apiClient } from './client';
import {
  Warehouse,
  WarehouseArea,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  CreateWarehouseAreaRequest,
  UpdateWarehouseAreaRequest,
} from '@/types/warehouses';

export const warehousesApi = {
  /**
   * Get all warehouses with their areas
   * GET /admin/inventory/warehouses
   * Supports multi-tenancy via X-Company-Id and X-Site-Id headers
   */
  async getWarehouses(companyId?: string, siteId?: string): Promise<Warehouse[]> {
    console.log('🔧 warehousesApi.getWarehouses called');
    console.log('🔧 Parameters - companyId:', companyId, 'siteId:', siteId);

    const queryParams = new URLSearchParams();

    if (companyId) {
      queryParams.append('companyId', companyId);
    }

    if (siteId) {
      queryParams.append('siteId', siteId);
    }

    const queryString = queryParams.toString();
    const url = `/inventory/warehouses${queryString ? `?${queryString}` : ''}`;

    console.log('🔧 Request URL:', url);

    const result = await apiClient.get<Warehouse[]>(url);
    console.log('🔧 API Response:', result);
    return result;
  },

  /**
   * Get a single warehouse by ID
   * GET /admin/inventory/warehouses/:id
   */
  async getWarehouseById(id: string): Promise<Warehouse> {
    return apiClient.get<Warehouse>(`/inventory/warehouses/${id}`);
  },

  /**
   * Create a new warehouse
   * Requires companyId and siteId in the request body
   */
  async createWarehouse(warehouseData: CreateWarehouseRequest): Promise<Warehouse> {
    return apiClient.post<Warehouse>('/inventory/warehouses', warehouseData);
  },

  /**
   * Update an existing warehouse
   */
  async updateWarehouse(id: string, warehouseData: UpdateWarehouseRequest): Promise<Warehouse> {
    return apiClient.patch<Warehouse>(`/inventory/warehouses/${id}`, warehouseData);
  },

  /**
   * Delete a warehouse
   */
  async deleteWarehouse(id: string): Promise<void> {
    return apiClient.delete<void>(`/inventory/warehouses/${id}`);
  },

  /**
   * Get warehouses by site (helper method)
   */
  async getWarehousesBySite(companyId: string, siteId: string): Promise<Warehouse[]> {
    return this.getWarehouses(companyId, siteId);
  },

  /**
   * Get warehouses by site code (legacy helper method)
   */
  async getWarehousesBySiteCode(siteCode: string): Promise<Warehouse[]> {
    const warehouses = await this.getWarehouses();
    return warehouses.filter(w => w.siteCode === siteCode);
  },
};

export const warehouseAreasApi = {
  /**
   * Get all areas for a specific warehouse
   * GET /admin/inventory/warehouses/:warehouseId/areas
   */
  async getWarehouseAreas(warehouseId: string): Promise<WarehouseArea[]> {
    console.log('🔧 warehouseAreasApi.getWarehouseAreas called');
    console.log('🔧 Warehouse ID:', warehouseId);

    const url = `/inventory/warehouses/${warehouseId}/areas`;
    console.log('🔧 Request URL:', url);

    const result = await apiClient.get<WarehouseArea[]>(url);
    console.log('🔧 API Response:', result);
    return result;
  },

  /**
   * Get a single area by ID
   * GET /admin/inventory/areas/:id
   */
  async getAreaById(areaId: string): Promise<WarehouseArea> {
    return apiClient.get<WarehouseArea>(`/inventory/areas/${areaId}`);
  },

  /**
   * Create a new warehouse area
   * Requires companyId, siteId, and warehouseId in the request body
   */
  async createWarehouseArea(
    warehouseId: string,
    areaData: CreateWarehouseAreaRequest
  ): Promise<WarehouseArea> {
    return apiClient.post<WarehouseArea>(
      `/inventory/warehouses/${warehouseId}/areas`,
      areaData
    );
  },

  /**
   * Update an existing warehouse area
   * PATCH /admin/inventory/areas/:id
   */
  async updateWarehouseArea(
    areaId: string,
    areaData: UpdateWarehouseAreaRequest
  ): Promise<WarehouseArea> {
    return apiClient.patch<WarehouseArea>(`/inventory/areas/${areaId}`, areaData);
  },

  /**
   * Delete a warehouse area
   * DELETE /admin/inventory/areas/:id
   */
  async deleteWarehouseArea(areaId: string): Promise<void> {
    return apiClient.delete<void>(`/inventory/areas/${areaId}`);
  },
};

export default { warehousesApi, warehouseAreasApi };
