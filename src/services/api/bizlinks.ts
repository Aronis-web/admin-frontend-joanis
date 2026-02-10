import { apiClient } from './client';
import {
  BizlinksConfig,
  BizlinksDocument,
  BizlinksLog,
  CreateBizlinksConfigDto,
  UpdateBizlinksConfigDto,
  GetBizlinksConfigsParams,
  EmitirFacturaDto,
  GetBizlinksDocumentsParams,
  DownloadArtifactsDto,
  BizlinksTestConnectionResponse,
} from '../../types/bizlinks';

// ============================================
// BIZLINKS API - Facturación Electrónica
// ============================================

export const bizlinksApi = {
  // ==================== CONFIGURATION ====================

  // Get all configurations - GET /bizlinks/config
  getConfigs: async (params?: GetBizlinksConfigsParams): Promise<BizlinksConfig[]> => {
    return apiClient.get<BizlinksConfig[]>('/bizlinks/config', { params });
  },

  // Get configuration by ID - GET /bizlinks/config/:id
  getConfigById: async (id: string): Promise<BizlinksConfig> => {
    return apiClient.get<BizlinksConfig>(`/bizlinks/config/${id}`);
  },

  // Get configurations by company - GET /bizlinks/config/company/:companyId
  getConfigsByCompany: async (companyId: string): Promise<BizlinksConfig[]> => {
    return apiClient.get<BizlinksConfig[]>(`/bizlinks/config/company/${companyId}`);
  },

  // Get active configuration for company/site - GET /bizlinks/config/active
  getActiveConfig: async (companyId: string, siteId?: string): Promise<BizlinksConfig> => {
    return apiClient.get<BizlinksConfig>('/bizlinks/config/active', {
      params: { companyId, siteId },
    });
  },

  // Create configuration - POST /bizlinks/config
  createConfig: async (data: CreateBizlinksConfigDto): Promise<BizlinksConfig> => {
    return apiClient.post<BizlinksConfig>('/bizlinks/config', data);
  },

  // Update configuration - PATCH /bizlinks/config/:id
  updateConfig: async (id: string, data: UpdateBizlinksConfigDto): Promise<BizlinksConfig> => {
    return apiClient.patch<BizlinksConfig>(`/bizlinks/config/${id}`, data);
  },

  // Delete configuration - DELETE /bizlinks/config/:id
  deleteConfig: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/bizlinks/config/${id}`);
  },

  // Test connection - GET /bizlinks/config/:id/test
  testConnection: async (id: string): Promise<BizlinksTestConnectionResponse> => {
    return apiClient.get<BizlinksTestConnectionResponse>(`/bizlinks/config/${id}/test`);
  },

  // ==================== DOCUMENTS ====================

  // Get all documents - GET /bizlinks/documents
  getDocuments: async (params?: GetBizlinksDocumentsParams): Promise<BizlinksDocument[]> => {
    return apiClient.get<BizlinksDocument[]>('/bizlinks/documents', { params });
  },

  // Get document by ID - GET /bizlinks/documents/:id
  getDocumentById: async (id: string): Promise<BizlinksDocument> => {
    return apiClient.get<BizlinksDocument>(`/bizlinks/documents/${id}`);
  },

  // Get document by serie-numero - GET /bizlinks/documents/serie/:serieNumero
  getDocumentBySerieNumero: async (serieNumero: string): Promise<BizlinksDocument> => {
    return apiClient.get<BizlinksDocument>(`/bizlinks/documents/serie/${serieNumero}`);
  },

  // Emit factura - POST /bizlinks/documents/factura
  emitirFactura: async (data: EmitirFacturaDto): Promise<BizlinksDocument> => {
    return apiClient.post<BizlinksDocument>('/bizlinks/documents/factura', data);
  },

  // Refresh document status - POST /bizlinks/documents/:id/refresh
  refreshDocumentStatus: async (id: string): Promise<BizlinksDocument> => {
    return apiClient.post<BizlinksDocument>(`/bizlinks/documents/${id}/refresh`);
  },

  // Download artifacts (PDF, XML, CDR) - POST /bizlinks/documents/:id/download-artifacts
  downloadArtifacts: async (id: string, data?: DownloadArtifactsDto): Promise<BizlinksDocument> => {
    return apiClient.post<BizlinksDocument>(`/bizlinks/documents/${id}/download-artifacts`, data);
  },

  // Send to SUNAT - POST /bizlinks/documents/:id/send
  sendToSunat: async (id: string): Promise<BizlinksDocument> => {
    return apiClient.post<BizlinksDocument>(`/bizlinks/documents/${id}/send`);
  },

  // Void document - POST /bizlinks/documents/:id/void
  voidDocument: async (id: string, reason: string): Promise<BizlinksDocument> => {
    return apiClient.post<BizlinksDocument>(`/bizlinks/documents/${id}/void`, { reason });
  },

  // ==================== LOGS ====================

  // Get logs for document - GET /bizlinks/documents/:id/logs
  getDocumentLogs: async (documentId: string): Promise<BizlinksLog[]> => {
    return apiClient.get<BizlinksLog[]>(`/bizlinks/documents/${documentId}/logs`);
  },

  // Get logs for config - GET /bizlinks/config/:id/logs
  getConfigLogs: async (configId: string, params?: { limit?: number }): Promise<BizlinksLog[]> => {
    return apiClient.get<BizlinksLog[]>(`/bizlinks/config/${configId}/logs`, { params });
  },

  // ==================== UTILITIES ====================

  // Validate RUC - GET /bizlinks/utils/validate-ruc/:ruc
  validateRuc: async (ruc: string): Promise<{ valid: boolean; message?: string }> => {
    return apiClient.get<{ valid: boolean; message?: string }>(`/bizlinks/utils/validate-ruc/${ruc}`);
  },

  // Get ubigeo info - GET /bizlinks/utils/ubigeo/:code
  getUbigeoInfo: async (code: string): Promise<{
    code: string;
    departamento: string;
    provincia: string;
    distrito: string;
  }> => {
    return apiClient.get(`/bizlinks/utils/ubigeo/${code}`);
  },
};
