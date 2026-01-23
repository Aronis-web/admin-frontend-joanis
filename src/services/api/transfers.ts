import { apiClient } from './client';
import {
  Transfer,
  TransferReception,
  TransferDiscrepancy,
  StockMovement,
  TransferStatusHistory,
  CreateInternalTransferDto,
  CreateExternalTransferDto,
  ShipTransferDto,
  ValidateItemsDto,
  CompleteReceptionDto,
  CancelTransferDto,
  ResolveDiscrepancyDto,
  TransferFilters,
  ReceptionFilters,
  DiscrepancyFilters,
  StockMovementFilters,
  TransferListResponse,
  ReceptionListResponse,
  DiscrepancyListResponse,
  StockMovementListResponse,
  TransferDashboard,
  DiscrepanciesReport,
} from '@/types/transfers';

export const transfersApi = {
  // ========== TRANSFERS - GENERAL ==========

  /**
   * Get all transfers with filters
   * GET /api/transfers
   */
  getTransfers: async (filters?: TransferFilters): Promise<TransferListResponse> => {
    return apiClient.get<TransferListResponse>('/transfers', { params: filters });
  },

  /**
   * Get transfer by ID
   * GET /api/transfers/:id
   */
  getTransferById: async (id: string): Promise<Transfer> => {
    return apiClient.get<Transfer>(`/transfers/${id}`);
  },

  /**
   * Cancel transfer
   * POST /api/transfers/:id/cancel
   */
  cancelTransfer: async (id: string, data: CancelTransferDto): Promise<Transfer> => {
    return apiClient.post<Transfer>(`/transfers/${id}/cancel`, data);
  },

  /**
   * Get transfer status history
   * GET /api/transfers/:id/history
   */
  getTransferHistory: async (id: string): Promise<TransferStatusHistory[]> => {
    return apiClient.get<TransferStatusHistory[]>(`/transfers/${id}/history`);
  },

  // ========== INTERNAL TRANSFERS ==========

  /**
   * Create internal transfer
   * POST /api/transfers/internal
   */
  createInternalTransfer: async (data: CreateInternalTransferDto): Promise<Transfer> => {
    return apiClient.post<Transfer>('/transfers/internal', data);
  },

  /**
   * Execute internal transfer (immediate)
   * POST /api/transfers/:id/execute
   */
  executeInternalTransfer: async (id: string, performedBy?: string): Promise<Transfer> => {
    // Try multiple field names in case backend expects different naming
    const payload = performedBy ? {
      performedBy,
      performed_by: performedBy,
      userId: performedBy,
      user_id: performedBy,
    } : {};

    console.log('🔧 Execute transfer payload:', payload);
    return apiClient.post<Transfer>(`/transfers/${id}/execute`, payload);
  },

  // ========== EXTERNAL TRANSFERS ==========

  /**
   * Create external transfer
   * POST /api/transfers/external
   */
  createExternalTransfer: async (data: CreateExternalTransferDto): Promise<Transfer> => {
    return apiClient.post<Transfer>('/transfers/external', data);
  },

  /**
   * Approve transfer
   * POST /api/transfers/:id/approve
   */
  approveTransfer: async (id: string, approvedBy?: string): Promise<Transfer> => {
    const payload = approvedBy ? {
      approvedBy,
      approved_by: approvedBy,
      changedBy: approvedBy,
      changed_by: approvedBy,
      userId: approvedBy,
      user_id: approvedBy,
    } : {};

    console.log('🔧 Approve transfer payload:', payload);
    return apiClient.post<Transfer>(`/transfers/${id}/approve`, payload);
  },

  /**
   * Ship transfer
   * POST /api/transfers/:id/ship
   */
  shipTransfer: async (id: string, data: ShipTransferDto): Promise<Transfer> => {
    console.log('🔧 Ship transfer payload:', JSON.stringify(data, null, 2));
    return apiClient.post<Transfer>(`/transfers/${id}/ship`, data);
  },

  /**
   * Receive transfer (initiate reception)
   * POST /api/transfers/:id/receive
   */
  receiveTransfer: async (id: string, receivedBy?: string, notes?: string): Promise<Transfer> => {
    const payload = receivedBy ? {
      receivedBy,
      received_by: receivedBy,
      changedBy: receivedBy,
      changed_by: receivedBy,
      userId: receivedBy,
      user_id: receivedBy,
      notes,
    } : { notes };

    console.log('🔧 Receive transfer payload:', payload);
    return apiClient.post<Transfer>(`/transfers/${id}/receive`, payload);
  },

  /**
   * Validate items received
   * POST /api/transfers/:id/validate-items
   */
  validateItems: async (id: string, data: ValidateItemsDto): Promise<Transfer> => {
    return apiClient.post<Transfer>(`/transfers/${id}/validate-items`, data);
  },

  /**
   * Complete reception
   * POST /api/transfers/:id/complete-reception
   */
  completeReception: async (id: string, data: CompleteReceptionDto): Promise<Transfer> => {
    return apiClient.post<Transfer>(`/transfers/${id}/complete-reception`, data);
  },

  // ========== RECEPTIONS ==========

  /**
   * Get pending receptions
   * GET /api/receptions/pending
   */
  getPendingReceptions: async (filters?: ReceptionFilters): Promise<ReceptionListResponse> => {
    return apiClient.get<ReceptionListResponse>('/receptions/pending', { params: filters });
  },

  /**
   * Get reception by ID
   * GET /api/receptions/:id
   */
  getReceptionById: async (id: string): Promise<TransferReception> => {
    return apiClient.get<TransferReception>(`/receptions/${id}`);
  },

  // ========== DISCREPANCIES ==========

  /**
   * Get discrepancies
   * GET /api/discrepancies
   */
  getDiscrepancies: async (filters?: DiscrepancyFilters): Promise<DiscrepancyListResponse> => {
    return apiClient.get<DiscrepancyListResponse>('/discrepancies', { params: filters });
  },

  /**
   * Resolve discrepancy
   * POST /api/discrepancies/:id/resolve
   */
  resolveDiscrepancy: async (id: string, data: ResolveDiscrepancyDto): Promise<TransferDiscrepancy> => {
    return apiClient.post<TransferDiscrepancy>(`/discrepancies/${id}/resolve`, data);
  },

  // ========== REPORTS & DASHBOARD ==========

  /**
   * Get transfers dashboard
   * GET /api/transfers/dashboard
   */
  getDashboard: async (): Promise<TransferDashboard> => {
    return apiClient.get<TransferDashboard>('/transfers/dashboard');
  },

  /**
   * Get discrepancies report
   * GET /api/reports/discrepancies
   */
  getDiscrepanciesReport: async (): Promise<DiscrepanciesReport> => {
    return apiClient.get<DiscrepanciesReport>('/reports/discrepancies');
  },

  /**
   * Get stock movements
   * GET /api/stock-movements
   */
  getStockMovements: async (filters?: StockMovementFilters): Promise<StockMovementListResponse> => {
    return apiClient.get<StockMovementListResponse>('/stock-movements', { params: filters });
  },

  /**
   * Get stock movements for a specific product
   * GET /api/stock-movements/product/:productId
   */
  getProductStockMovements: async (
    productId: string,
    filters?: Omit<StockMovementFilters, 'productId'>
  ): Promise<StockMovement[]> => {
    return apiClient.get<StockMovement[]>(`/stock-movements/product/${productId}`, { params: filters });
  },

  /**
   * Get stock movements for a specific product (new endpoint)
   * GET /api/transfers/stock-movements/product/:productId
   */
  getProductStockMovementsHistory: async (
    productId: string,
    params?: { warehouseId?: string; limit?: number }
  ): Promise<StockMovement[]> => {
    return apiClient.get<StockMovement[]>(`/transfers/stock-movements/product/${productId}`, { params });
  },

  /**
   * Get user audit for transfers
   * GET /api/audit/user/:userId/transfers
   */
  getUserAudit: async (
    userId: string,
    filters?: { dateFrom?: string; dateTo?: string; actionType?: string }
  ): Promise<{
    transfersCreated: Transfer[];
    transfersApproved: Transfer[];
    transfersShipped: Transfer[];
    transfersReceived: Transfer[];
    stockMovements: StockMovement[];
  }> => {
    return apiClient.get(`/audit/user/${userId}/transfers`, { params: filters });
  },
};

export default transfersApi;
