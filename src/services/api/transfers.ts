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

/**
 * ============================================
 * TRANSFERS API - MÓDULO UNIFICADO
 * ============================================
 *
 * Este módulo maneja tanto SALIDAS como ENTRADAS de mercancía:
 *
 * 📤 SALIDAS (Outbound):
 *    - Traslados Internos (entre almacenes de la misma empresa)
 *    - Traslados Externos (hacia otras empresas/sedes)
 *
 * 📥 ENTRADAS (Inbound):
 *    - Recepciones de Traslados Externos
 *    - Validación de mercancía recibida
 *
 * ✅ Todos los endpoints usan apiClient y envían automáticamente:
 *    - X-Company-Id (ID de empresa)
 *    - X-Site-Id (ID de sede)
 *    - X-Warehouse-Id (ID de almacén)
 *    - X-User-Id (ID de usuario)
 *    - X-App-Id (ID de aplicación)
 */

export const transfersApi = {
  // ============================================
  // GENERAL - Consultas y Operaciones Comunes
  // ============================================

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

  // ============================================
  // 📤 SALIDAS - Traslados Internos (Outbound)
  // ============================================
  // Traslados entre almacenes de la misma empresa/sede
  // Flujo: DRAFT → EXECUTED (inmediato)

  /**
   * 📤 Create internal transfer (SALIDA)
   * POST /api/transfers/internal
   * Crea un traslado interno entre almacenes de la misma empresa
   */
  createInternalTransfer: async (data: CreateInternalTransferDto): Promise<Transfer> => {
    return apiClient.post<Transfer>('/transfers/internal', data);
  },

  /**
   * 📤 Execute internal transfer (SALIDA - immediate)
   * POST /api/transfers/:id/execute
   * Ejecuta el traslado interno inmediatamente (mueve el stock)
   */
  executeInternalTransfer: async (id: string, performedBy?: string): Promise<Transfer> => {
    // Try multiple field names in case backend expects different naming
    const payload = performedBy
      ? {
          performedBy,
          performed_by: performedBy,
          userId: performedBy,
          user_id: performedBy,
        }
      : {};

    console.log('🔧 Execute transfer payload:', payload);
    return apiClient.post<Transfer>(`/transfers/${id}/execute`, payload);
  },

  // ============================================
  // 📤 SALIDAS - Traslados Externos (Outbound)
  // ============================================
  // Traslados hacia otras empresas/sedes
  // Flujo: DRAFT → APPROVED → SHIPPED → IN_TRANSIT

  /**
   * 📤 Create external transfer (SALIDA)
   * POST /api/transfers/external
   * Crea un traslado externo hacia otra empresa/sede
   */
  createExternalTransfer: async (data: CreateExternalTransferDto): Promise<Transfer> => {
    return apiClient.post<Transfer>('/transfers/external', data);
  },

  /**
   * 📤 Approve transfer (SALIDA)
   * POST /api/transfers/:id/approve
   * Aprueba el traslado externo para que pueda ser enviado
   */
  approveTransfer: async (id: string, approvedBy?: string): Promise<Transfer> => {
    const payload = approvedBy
      ? {
          approvedBy,
          approved_by: approvedBy,
          changedBy: approvedBy,
          changed_by: approvedBy,
          userId: approvedBy,
          user_id: approvedBy,
        }
      : {};

    console.log('🔧 Approve transfer payload:', payload);
    return apiClient.post<Transfer>(`/transfers/${id}/approve`, payload);
  },

  /**
   * 📤 Ship transfer (SALIDA)
   * POST /api/transfers/:id/ship
   * Marca el traslado como enviado (en tránsito)
   */
  shipTransfer: async (id: string, data: ShipTransferDto): Promise<Transfer> => {
    console.log('🔧 Ship transfer payload:', JSON.stringify(data, null, 2));
    return apiClient.post<Transfer>(`/transfers/${id}/ship`, data);
  },

  // ============================================
  // 📥 ENTRADAS - Recepciones (Inbound)
  // ============================================
  // Recepción de traslados externos
  // Flujo: IN_TRANSIT → RECEIVING → RECEIVED → COMPLETED

  /**
   * 📥 Receive transfer (ENTRADA - initiate reception)
   * POST /api/transfers/:id/receive
   * Inicia la recepción de un traslado externo
   */
  receiveTransfer: async (id: string, receivedBy?: string, notes?: string): Promise<Transfer> => {
    const payload = receivedBy
      ? {
          receivedBy,
          received_by: receivedBy,
          changedBy: receivedBy,
          changed_by: receivedBy,
          userId: receivedBy,
          user_id: receivedBy,
          notes,
        }
      : { notes };

    console.log('🔧 Receive transfer payload:', payload);
    return apiClient.post<Transfer>(`/transfers/${id}/receive`, payload);
  },

  /**
   * 📥 Validate items received (ENTRADA)
   * POST /api/transfers/:id/validate-items
   * Valida los items recibidos (cantidades, condición, etc.)
   */
  validateItems: async (id: string, data: ValidateItemsDto): Promise<Transfer> => {
    return apiClient.post<Transfer>(`/transfers/${id}/validate-items`, data);
  },

  /**
   * 📥 Complete reception (ENTRADA)
   * POST /api/transfers/:id/complete-reception
   * Completa la recepción del traslado (actualiza stock)
   */
  completeReception: async (id: string, data: CompleteReceptionDto): Promise<Transfer> => {
    return apiClient.post<Transfer>(`/transfers/${id}/complete-reception`, data);
  },

  // ============================================
  // 📥 ENTRADAS - Consulta de Recepciones
  // ============================================

  /**
   * 📥 Get pending receptions (ENTRADAS pendientes)
   * GET /api/receptions/pending
   * Obtiene todas las recepciones pendientes de validar
   */
  getPendingReceptions: async (filters?: ReceptionFilters): Promise<ReceptionListResponse> => {
    return apiClient.get<ReceptionListResponse>('/receptions/pending', { params: filters });
  },

  /**
   * 📥 Get reception by ID (ENTRADA)
   * GET /api/receptions/:id
   * Obtiene los detalles de una recepción específica
   */
  getReceptionById: async (id: string): Promise<TransferReception> => {
    return apiClient.get<TransferReception>(`/receptions/${id}`);
  },

  // ============================================
  // ⚠️ DISCREPANCIAS - Gestión de Diferencias
  // ============================================
  // Manejo de diferencias entre lo enviado y lo recibido

  /**
   * ⚠️ Get discrepancies
   * GET /api/discrepancies
   * Obtiene todas las discrepancias registradas
   */
  getDiscrepancies: async (filters?: DiscrepancyFilters): Promise<DiscrepancyListResponse> => {
    return apiClient.get<DiscrepancyListResponse>('/discrepancies', { params: filters });
  },

  /**
   * ⚠️ Resolve discrepancy
   * POST /api/discrepancies/:id/resolve
   * Resuelve una discrepancia (ajuste de stock, devolución, etc.)
   */
  resolveDiscrepancy: async (
    id: string,
    data: ResolveDiscrepancyDto
  ): Promise<TransferDiscrepancy> => {
    return apiClient.post<TransferDiscrepancy>(`/discrepancies/${id}/resolve`, data);
  },

  // ============================================
  // 📊 REPORTES Y DASHBOARD
  // ============================================

  /**
   * 📊 Get transfers dashboard
   * GET /api/transfers/dashboard
   * Obtiene estadísticas generales de traslados (salidas y entradas)
   */
  getDashboard: async (): Promise<TransferDashboard> => {
    return apiClient.get<TransferDashboard>('/transfers/dashboard');
  },

  /**
   * 📊 Get discrepancies report
   * GET /api/reports/discrepancies
   * Obtiene reporte de discrepancias
   */
  getDiscrepanciesReport: async (): Promise<DiscrepanciesReport> => {
    return apiClient.get<DiscrepanciesReport>('/reports/discrepancies');
  },

  // ============================================
  // 📦 MOVIMIENTOS DE STOCK
  // ============================================
  // Historial de movimientos generados por traslados

  /**
   * 📦 Get stock movements
   * GET /api/stock-movements
   * Obtiene todos los movimientos de stock
   */
  getStockMovements: async (filters?: StockMovementFilters): Promise<StockMovementListResponse> => {
    return apiClient.get<StockMovementListResponse>('/stock-movements', { params: filters });
  },

  /**
   * 📦 Get stock movements for a specific product
   * GET /api/stock-movements/product/:productId
   * Obtiene movimientos de stock de un producto específico
   */
  getProductStockMovements: async (
    productId: string,
    filters?: Omit<StockMovementFilters, 'productId'>
  ): Promise<StockMovement[]> => {
    return apiClient.get<StockMovement[]>(`/stock-movements/product/${productId}`, {
      params: filters,
    });
  },

  /**
   * 📦 Get stock movements history for a product
   * GET /api/transfers/stock-movements/product/:productId
   * Obtiene historial de movimientos de stock de un producto
   */
  getProductStockMovementsHistory: async (
    productId: string,
    params?: { warehouseId?: string; limit?: number }
  ): Promise<StockMovement[]> => {
    return apiClient.get<StockMovement[]>(`/transfers/stock-movements/product/${productId}`, {
      params,
    });
  },

  // ============================================
  // 🔍 AUDITORÍA
  // ============================================

  /**
   * 🔍 Get user audit for transfers
   * GET /api/audit/user/:userId/transfers
   * Obtiene auditoría de traslados por usuario
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
