import { apiClient } from './client';
import type {
  AddSuppliersDto,
  BlockFamilyDto,
  CreateGroupDto,
  GenerateOrdersDto,
  GetSupplierAnalysisParams,
  MoveMemberDto,
  OrderExportFormat,
  PaginatedResponse,
  ProductFamily,
  ProductFamilyWithMembers,
  ProductStatusRow,
  QueryFamiliesDto,
  QueryOrdersDto,
  RunAnalysisResponse,
  SmartPurchaseGroup,
  SmartPurchaseGroupWithSuppliers,
  SmartPurchaseOrder,
  SmartPurchaseOrderWithItems,
  SmartPurchaseOrderItem,
  SupplierAnalysisDetail,
  SupplierAnalysisRow,
  UpdateFamilyDto,
  UpdateGroupDto,
  UpdateOrderItemDto,
} from '@/types/smartPurchase';

/**
 * Smart Purchase (Compra Inteligente) API Service.
 *
 * Base path: `/smart-purchase`.
 * Todos los endpoints requieren JWT + permisos del módulo `smart_purchase.*`.
 */
class SmartPurchaseService {
  private readonly basePath = '/smart-purchase';

  // ============================================
  // Análisis de proveedores
  // ============================================

  async runAnalysis(): Promise<RunAnalysisResponse> {
    return apiClient.post<RunAnalysisResponse>(`${this.basePath}/analysis/run`, {});
  }

  async getSupplierAnalysis(params?: GetSupplierAnalysisParams): Promise<SupplierAnalysisRow[]> {
    return apiClient.get<SupplierAnalysisRow[]>(`${this.basePath}/analysis/suppliers`, { params });
  }

  async getSupplierAnalysisDetail(supplierId: string): Promise<SupplierAnalysisDetail> {
    return apiClient.get<SupplierAnalysisDetail>(
      `${this.basePath}/analysis/suppliers/${supplierId}`
    );
  }

  // ============================================
  // Grupos de compra
  // ============================================

  async listGroups(): Promise<SmartPurchaseGroup[]> {
    return apiClient.get<SmartPurchaseGroup[]>(`${this.basePath}/groups`);
  }

  async getGroup(id: string): Promise<SmartPurchaseGroupWithSuppliers> {
    return apiClient.get<SmartPurchaseGroupWithSuppliers>(`${this.basePath}/groups/${id}`);
  }

  async createGroup(data: CreateGroupDto): Promise<SmartPurchaseGroupWithSuppliers> {
    return apiClient.post<SmartPurchaseGroupWithSuppliers>(`${this.basePath}/groups`, data);
  }

  async updateGroup(id: string, data: UpdateGroupDto): Promise<SmartPurchaseGroupWithSuppliers> {
    return apiClient.patch<SmartPurchaseGroupWithSuppliers>(`${this.basePath}/groups/${id}`, data);
  }

  async deleteGroup(id: string): Promise<{ deleted: true }> {
    return apiClient.delete<{ deleted: true }>(`${this.basePath}/groups/${id}`);
  }

  async addSuppliers(id: string, data: AddSuppliersDto): Promise<SmartPurchaseGroupWithSuppliers> {
    return apiClient.post<SmartPurchaseGroupWithSuppliers>(
      `${this.basePath}/groups/${id}/suppliers`,
      data
    );
  }

  async removeSupplier(id: string, supplierId: string): Promise<{ removed: true }> {
    return apiClient.delete<{ removed: true }>(
      `${this.basePath}/groups/${id}/suppliers/${supplierId}`
    );
  }

  async rebuildFamilies(id: string): Promise<{ rebuilt: number }> {
    return apiClient.post<{ rebuilt: number }>(
      `${this.basePath}/groups/${id}/rebuild-families`,
      {}
    );
  }

  async rescoreFamilies(id: string): Promise<{ rescored: number }> {
    return apiClient.post<{ rescored: number }>(`${this.basePath}/groups/${id}/rescore`, {});
  }

  // ============================================
  // Familias / productos
  // ============================================

  async listFamilies(
    groupId: string,
    query?: QueryFamiliesDto
  ): Promise<PaginatedResponse<ProductFamily>> {
    return apiClient.get<PaginatedResponse<ProductFamily>>(
      `${this.basePath}/groups/${groupId}/families`,
      { params: query }
    );
  }

  async getFamily(id: string): Promise<ProductFamilyWithMembers> {
    return apiClient.get<ProductFamilyWithMembers>(`${this.basePath}/families/${id}`);
  }

  async updateFamily(id: string, data: UpdateFamilyDto): Promise<ProductFamilyWithMembers> {
    return apiClient.patch<ProductFamilyWithMembers>(`${this.basePath}/families/${id}`, data);
  }

  async blockFamily(id: string, data: BlockFamilyDto): Promise<ProductFamilyWithMembers> {
    return apiClient.post<ProductFamilyWithMembers>(`${this.basePath}/families/${id}/block`, data);
  }

  async unblockFamily(id: string): Promise<ProductFamilyWithMembers> {
    return apiClient.post<ProductFamilyWithMembers>(`${this.basePath}/families/${id}/unblock`, {});
  }

  async addFamilyMember(id: string, data: MoveMemberDto): Promise<ProductFamilyWithMembers> {
    return apiClient.post<ProductFamilyWithMembers>(
      `${this.basePath}/families/${id}/members`,
      data
    );
  }

  async removeFamilyMember(id: string, productId: string): Promise<{ removed: true }> {
    return apiClient.delete<{ removed: true }>(
      `${this.basePath}/families/${id}/members/${productId}`
    );
  }

  async getProductStatus(productIds: string[]): Promise<ProductStatusRow[]> {
    return apiClient.get<ProductStatusRow[]>(`${this.basePath}/products/status`, {
      params: { productIds: productIds.join(',') },
    });
  }

  // ============================================
  // Órdenes sugeridas
  // ============================================

  async generateOrders(data: GenerateOrdersDto): Promise<SmartPurchaseOrderWithItems[]> {
    return apiClient.post<SmartPurchaseOrderWithItems[]>(`${this.basePath}/orders/generate`, data);
  }

  async listOrders(query?: QueryOrdersDto): Promise<PaginatedResponse<SmartPurchaseOrder>> {
    return apiClient.get<PaginatedResponse<SmartPurchaseOrder>>(`${this.basePath}/orders`, {
      params: query,
    });
  }

  async getOrder(id: string): Promise<SmartPurchaseOrderWithItems> {
    return apiClient.get<SmartPurchaseOrderWithItems>(`${this.basePath}/orders/${id}`);
  }

  async updateOrderItem(
    orderId: string,
    itemId: string,
    data: UpdateOrderItemDto
  ): Promise<SmartPurchaseOrderItem> {
    return apiClient.patch<SmartPurchaseOrderItem>(
      `${this.basePath}/orders/${orderId}/items/${itemId}`,
      data
    );
  }

  async approveOrder(id: string): Promise<SmartPurchaseOrderWithItems> {
    return apiClient.post<SmartPurchaseOrderWithItems>(`${this.basePath}/orders/${id}/approve`, {});
  }

  async cancelOrder(id: string): Promise<SmartPurchaseOrderWithItems> {
    return apiClient.post<SmartPurchaseOrderWithItems>(`${this.basePath}/orders/${id}/cancel`, {});
  }

  async exportOrder(id: string, format: OrderExportFormat = 'xlsx'): Promise<Blob> {
    return apiClient.get<Blob>(`${this.basePath}/orders/${id}/export`, {
      params: { format },
      responseType: 'blob',
      timeout: 0,
    });
  }
}

export const smartPurchaseApi = new SmartPurchaseService();
export const smartPurchaseService = smartPurchaseApi;
