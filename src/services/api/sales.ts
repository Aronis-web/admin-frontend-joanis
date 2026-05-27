import { apiClient } from './client';
import {
  Sale,
  SalesResponse,
  CreateSaleRequest,
  UpdateSaleRequest,
  CreateSalePaymentRequest,
  SalePayment,
  QuerySalesParams,
  ProcessingStatusResponse,
  CreateCreditNoteRequest,
  CreateDebitNoteRequest,
} from '@/types/sales';

/**
 * Sales API Service
 */
export const salesApi = {
  /**
   * Create a new sale
   * POST /sales
   */
  createSale: async (data: CreateSaleRequest): Promise<Sale> => {
    return apiClient.post<Sale>('/sales', data);
  },

  /**
   * Get all sales with filters
   * GET /admin/sales
   */
  getSales: async (params?: QuerySalesParams): Promise<SalesResponse> => {
    return apiClient.get<SalesResponse>('/admin/sales', { params });
  },

  /**
   * Get sale by ID
   * GET /admin/sales/:id
   */
  getSaleById: async (
    id: string,
    params?: { includeItems?: boolean; includeDocuments?: boolean; includePayments?: boolean }
  ): Promise<Sale> => {
    return apiClient.get<Sale>(`/admin/sales/${id}`, { params });
  },

  /**
   * Update sale
   * PATCH /sales/:id
   */
  updateSale: async (id: string, data: UpdateSaleRequest): Promise<Sale> => {
    return apiClient.patch<Sale>(`/sales/${id}`, data);
  },

  /**
   * Cancel sale
   * POST /sales/:id/cancel
   */
  cancelSale: async (id: string): Promise<Sale> => {
    return apiClient.post<Sale>(`/sales/${id}/cancel`);
  },

  /**
   * Get processing status
   * GET /sales/:id/processing-status
   */
  getProcessingStatus: async (id: string): Promise<ProcessingStatusResponse> => {
    return apiClient.get<ProcessingStatusResponse>(`/sales/${id}/processing-status`);
  },

  /**
   * Register payment
   * POST /sales/:id/payments
   */
  registerPayment: async (saleId: string, data: CreateSalePaymentRequest): Promise<SalePayment> => {
    return apiClient.post<SalePayment>(`/sales/${saleId}/payments`, data);
  },

  /**
   * Get sale payments
   * GET /sales/:id/payments
   */
  getSalePayments: async (saleId: string): Promise<SalePayment[]> => {
    return apiClient.get<SalePayment[]>(`/sales/${saleId}/payments`);
  },

  /**
   * Delete sale (soft delete)
   * DELETE /sales/:id
   */
  deleteSale: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/sales/${id}`);
  },

  /**
   * Get sale documents
   * GET /admin/sales/:id/documents
   */
  getSaleDocuments: async (id: string): Promise<any> => {
    return apiClient.get<any>(`/admin/sales/${id}/documents`);
  },

  /**
   * Download sale document PDF
   * GET /admin/sales/:saleId/documents/:documentId/pdf
   */
  downloadDocumentPDF: async (saleId: string, documentId: string): Promise<Blob> => {
    return apiClient.get<Blob>(`/admin/sales/${saleId}/documents/${documentId}/pdf`, {
      responseType: 'blob',
    });
  },

  /**
   * List sale credit notes from Admin
   * GET /admin/sales/:saleId/credit-notes
   */
  getSaleCreditNotes: async (saleId: string): Promise<any> => {
    return apiClient.get<any>(`/admin/sales/${saleId}/credit-notes`);
  },

  /**
   * Create credit note from Admin
   * POST /admin/sales/:saleId/credit-note
   */
  createCreditNote: async (saleId: string, data: CreateCreditNoteRequest): Promise<any> => {
    return apiClient.post<any>(`/admin/sales/${saleId}/credit-note`, data);
  },

  /**
   * Create debit note
   * POST /sales/:id/debit-note
   */
  createDebitNote: async (saleId: string, data: CreateDebitNoteRequest): Promise<any> => {
    return apiClient.post<any>(`/sales/${saleId}/debit-note`, data);
  },
};
