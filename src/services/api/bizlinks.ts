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
  CreateRetencionDto,
  Retencion,
  GetRetencionesParams,
  RevertirRetencionDto,
} from '../../types/bizlinks';

// ============================================
// BIZLINKS API - Facturación Electrónica
// ============================================

export const bizlinksApi = {
  // ==================== CONFIGURATION ====================

  // Get all configurations - GET /bizlinks/config
  // NOTA: Este endpoint devuelve UN OBJETO (la config activa), no un array
  getConfigs: async (params?: GetBizlinksConfigsParams): Promise<BizlinksConfig> => {
    return apiClient.get<BizlinksConfig>('/bizlinks/config', { params });
  },

  // Get configuration by ID - GET /bizlinks/config/:id
  getConfigById: async (id: string): Promise<BizlinksConfig> => {
    return apiClient.get<BizlinksConfig>(`/bizlinks/config/${id}`);
  },

  // Get configurations by company - GET /bizlinks/config/company/:companyId
  getConfigsByCompany: async (companyId: string): Promise<BizlinksConfig[]> => {
    return apiClient.get<BizlinksConfig[]>(`/bizlinks/config/company/${companyId}`);
  },

  // Get active configuration for company/site - GET /bizlinks/config
  // NOTA: El backend no tiene endpoint /active, usa /bizlinks/config con params
  getActiveConfig: async (companyId: string, siteId?: string): Promise<BizlinksConfig> => {
    return apiClient.get<BizlinksConfig>('/bizlinks/config', {
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

  // Upload logo - POST /bizlinks/config/:id/logo
  uploadLogo: async (configId: string, logoFile: File | Blob): Promise<BizlinksConfig> => {
    const formData = new FormData();
    formData.append('logo', logoFile);

    // No establecer Content-Type manualmente - fetch lo establece automáticamente con el boundary
    return apiClient.post<BizlinksConfig>(`/bizlinks/config/${configId}/logo`, formData);
  },

  // Delete logo - DELETE /bizlinks/config/:id/logo
  deleteLogo: async (configId: string): Promise<BizlinksConfig> => {
    return apiClient.delete<BizlinksConfig>(`/bizlinks/config/${configId}/logo`);
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
    return apiClient.post<BizlinksDocument>('/bizlinks/documents/factura', data, {
      timeout: 60000, // 60 segundos para emisión de comprobantes
    });
  },

  // Emit boleta - POST /bizlinks/documents/boleta
  emitirBoleta: async (data: EmitirFacturaDto): Promise<BizlinksDocument> => {
    return apiClient.post<BizlinksDocument>('/bizlinks/documents/boleta', data, {
      timeout: 60000, // 60 segundos para emisión de comprobantes
    });
  },

  // Emit nota de crédito - POST /bizlinks/documents/nota-credito
  emitirNotaCredito: async (data: EmitirFacturaDto): Promise<BizlinksDocument> => {
    return apiClient.post<BizlinksDocument>('/bizlinks/documents/nota-credito', data, {
      timeout: 60000, // 60 segundos para emisión de comprobantes
    });
  },

  // Emit nota de débito - POST /bizlinks/documents/nota-debito
  emitirNotaDebito: async (data: EmitirFacturaDto): Promise<BizlinksDocument> => {
    return apiClient.post<BizlinksDocument>('/bizlinks/documents/nota-debito', data, {
      timeout: 60000, // 60 segundos para emisión de comprobantes
    });
  },

  // Emit guía de remisión - POST /bizlinks/documents/guia-remision
  emitirGuiaRemision: async (data: EmitirFacturaDto): Promise<BizlinksDocument> => {
    return apiClient.post<BizlinksDocument>('/bizlinks/documents/guia-remision', data, {
      timeout: 60000, // 60 segundos para emisión de comprobantes
    });
  },

  // Refresh document status - POST /bizlinks/documents/:id/refresh
  refreshDocumentStatus: async (id: string): Promise<BizlinksDocument> => {
    return apiClient.post<BizlinksDocument>(`/bizlinks/documents/${id}/refresh`);
  },

  // Download artifacts (PDF, XML, CDR) - POST /bizlinks/documents/:id/download-artifacts
  downloadArtifacts: async (id: string, data?: DownloadArtifactsDto): Promise<BizlinksDocument> => {
    return apiClient.post<BizlinksDocument>(`/bizlinks/documents/${id}/download-artifacts`, data);
  },

  // Download PDF directly - GET /bizlinks/documents/:id/pdf
  downloadPDF: async (id: string): Promise<Blob> => {
    return apiClient.get<Blob>(`/bizlinks/documents/${id}/pdf`, {
      responseType: 'blob',
    });
  },

  // Download XML directly - GET /bizlinks/documents/:id/xml
  downloadXML: async (id: string): Promise<Blob> => {
    return apiClient.get<Blob>(`/bizlinks/documents/${id}/xml`, {
      responseType: 'blob',
    });
  },

  // Download CDR directly - GET /bizlinks/documents/:id/cdr
  downloadCDR: async (id: string): Promise<Blob> => {
    return apiClient.get<Blob>(`/bizlinks/documents/${id}/cdr`, {
      responseType: 'blob',
    });
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

  // ==================== RETENCIONES ====================

  // Get all retenciones - GET /bizlinks/retenciones
  getRetenciones: async (params?: GetRetencionesParams): Promise<Retencion[]> => {
    return apiClient.get<Retencion[]>('/bizlinks/retenciones', { params });
  },

  // Get retencion by ID - GET /bizlinks/retenciones/:id
  getRetencionById: async (id: string): Promise<Retencion> => {
    return apiClient.get<Retencion>(`/bizlinks/retenciones/${id}`);
  },

  // Create retencion - POST /bizlinks/retenciones
  createRetencion: async (data: CreateRetencionDto): Promise<Retencion> => {
    return apiClient.post<Retencion>('/bizlinks/retenciones', data, {
      timeout: 60000, // 60 segundos para emisión de retenciones
    });
  },

  // Refresh retencion status - POST /bizlinks/retenciones/:id/refresh
  refreshRetencionStatus: async (id: string): Promise<Retencion> => {
    return apiClient.post<Retencion>(`/bizlinks/retenciones/${id}/refresh`);
  },

  // Download retencion PDF - GET /bizlinks/retenciones/:id/pdf
  downloadRetencionPDF: async (id: string): Promise<Blob> => {
    return apiClient.get<Blob>(`/bizlinks/retenciones/${id}/pdf`, {
      responseType: 'blob',
    });
  },

  // Download retencion XML - GET /bizlinks/retenciones/:id/xml
  downloadRetencionXML: async (id: string): Promise<Blob> => {
    return apiClient.get<Blob>(`/bizlinks/retenciones/${id}/xml`, {
      responseType: 'blob',
    });
  },

  // Download retencion CDR - GET /bizlinks/retenciones/:id/cdr
  downloadRetencionCDR: async (id: string): Promise<Blob> => {
    return apiClient.get<Blob>(`/bizlinks/retenciones/${id}/cdr`, {
      responseType: 'blob',
    });
  },

  // Revertir (anular) retención - PATCH /bizlinks/retenciones/:id/revertir
  revertirRetencion: async (id: string, data: RevertirRetencionDto): Promise<Retencion> => {
    return apiClient.patch<Retencion>(`/bizlinks/retenciones/${id}/revertir`, data, {
      timeout: 60000, // 60 segundos para reversión
    });
  },
};
