import { apiClient } from './client';

// ============================================
// DOCUMENT TYPES (Tipos de Documentos SUNAT)
// ============================================

export interface DocumentType {
  id: string;
  code: string; // '01', '03', '07', '08', '09', '12'
  name: string; // 'Factura Electrónica', 'Boleta de Venta Electrónica', etc.
  description?: string;
  requiresRuc: boolean; // ¿Requiere RUC/DNI del cliente?
  allowsDeduction: boolean; // ¿Permite deducción de impuestos?
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentTypeDto {
  code: string;
  name: string;
  description?: string;
  requiresRuc?: boolean;
  allowsDeduction?: boolean;
  isActive?: boolean;
}

export interface UpdateDocumentTypeDto {
  code?: string;
  name?: string;
  description?: string;
  requiresRuc?: boolean;
  allowsDeduction?: boolean;
  isActive?: boolean;
}

export interface GetDocumentTypesParams {
  page?: number;
  limit?: number;
  isActive?: boolean;
  q?: string;
}

// ============================================
// DOCUMENT SERIES (Series de Documentos)
// ============================================

export interface DocumentSeries {
  id: string;
  siteId: string;
  documentTypeId: string;
  series: string; // 'F001', 'B001', 'NC01', etc. (4 caracteres)
  description?: string;
  currentNumber: number; // Último número generado
  startNumber: number; // Número inicial (default: 1)
  maxNumber: number; // Número máximo permitido (default: 99999999)
  isActive: boolean;
  isDefault: boolean; // ¿Es la serie por defecto para este tipo en esta sede?
  createdAt: string;
  updatedAt: string;
  // Relations
  documentType?: DocumentType;
  site?: {
    id: string;
    name: string;
  };
}

export interface CreateDocumentSeriesDto {
  siteId: string;
  documentTypeId: string;
  series: string;
  description?: string;
  startNumber?: number;
  maxNumber?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface UpdateDocumentSeriesDto {
  series?: string;
  description?: string;
  maxNumber?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface GetDocumentSeriesParams {
  page?: number;
  limit?: number;
  siteId?: string;
  documentTypeId?: string;
  isActive?: boolean;
  isDefault?: boolean;
  q?: string;
}

export interface DocumentSeriesStats {
  totalGenerated: number; // Total de correlativos generados
  totalVoided: number; // Total de correlativos anulados
  currentNumber: number; // Número actual
  availableNumbers: number; // Números disponibles (maxNumber - currentNumber)
}

// ============================================
// DOCUMENT CORRELATIVES (Correlativos)
// ============================================

export interface DocumentCorrelative {
  id: string;
  seriesId: string;
  correlativeNumber: number; // Número secuencial (1, 2, 3, ...)
  documentNumber: string; // Número completo: 'F001-00000001'
  userId: string; // Usuario que generó el correlativo
  referenceId?: string; // ID de la venta, gasto, etc.
  referenceType?: string; // 'SALE', 'EXPENSE', 'PURCHASE', 'CREDIT_NOTE', etc.
  isVoided: boolean; // ¿Está anulado?
  voidReason?: string; // Motivo de anulación
  voidedAt?: string; // Fecha de anulación
  voidedByUserId?: string; // Usuario que anuló
  createdAt: string;
  // Relations
  series?: DocumentSeries;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  voidedByUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface GenerateCorrelativeDto {
  seriesId: string;
  referenceId?: string;
  referenceType?: string;
}

export interface VoidCorrelativeDto {
  voidReason: string;
}

export interface GetCorrelativesParams {
  page?: number;
  limit?: number;
  seriesId?: string;
  documentNumber?: string;
  isVoided?: boolean;
  referenceType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================
// API ENDPOINTS
// ============================================

export const billingApi = {
  // ==================== DOCUMENT TYPES ====================

  // Get all document types - GET /billing/document-types
  getDocumentTypes: async (params?: GetDocumentTypesParams): Promise<DocumentType[]> => {
    return apiClient.get<DocumentType[]>('/billing/document-types', { params });
  },

  // Get document type by ID - GET /billing/document-types/:id
  getDocumentTypeById: async (id: string): Promise<DocumentType> => {
    return apiClient.get<DocumentType>(`/billing/document-types/${id}`);
  },

  // Get document type by code - GET /billing/document-types/code/:code
  getDocumentTypeByCode: async (code: string): Promise<DocumentType> => {
    return apiClient.get<DocumentType>(`/billing/document-types/code/${code}`);
  },

  // Create document type - POST /billing/document-types
  createDocumentType: async (data: CreateDocumentTypeDto): Promise<DocumentType> => {
    return apiClient.post<DocumentType>('/billing/document-types', data);
  },

  // Update document type - PATCH /billing/document-types/:id
  updateDocumentType: async (id: string, data: UpdateDocumentTypeDto): Promise<DocumentType> => {
    return apiClient.patch<DocumentType>(`/billing/document-types/${id}`, data);
  },

  // Delete document type - DELETE /billing/document-types/:id
  deleteDocumentType: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/billing/document-types/${id}`);
  },

  // ==================== DOCUMENT SERIES ====================

  // Get all series - GET /billing/series
  getDocumentSeries: async (params?: GetDocumentSeriesParams): Promise<DocumentSeries[]> => {
    return apiClient.get<DocumentSeries[]>('/billing/series', { params });
  },

  // Get series by ID - GET /billing/series/:id
  getDocumentSeriesById: async (id: string): Promise<DocumentSeries> => {
    return apiClient.get<DocumentSeries>(`/billing/series/${id}`);
  },

  // Get default series for a site and document type - GET /billing/series/default
  getDefaultSeries: async (siteId: string, documentTypeId: string): Promise<DocumentSeries> => {
    return apiClient.get<DocumentSeries>('/billing/series/default', {
      params: { siteId, documentTypeId },
    });
  },

  // Get series stats - GET /billing/series/:id/stats
  getSeriesStats: async (id: string): Promise<DocumentSeriesStats> => {
    return apiClient.get<DocumentSeriesStats>(`/billing/series/${id}/stats`);
  },

  // Create series - POST /billing/series
  createDocumentSeries: async (data: CreateDocumentSeriesDto): Promise<DocumentSeries> => {
    return apiClient.post<DocumentSeries>('/billing/series', data);
  },

  // Update series - PATCH /billing/series/:id
  updateDocumentSeries: async (id: string, data: UpdateDocumentSeriesDto): Promise<DocumentSeries> => {
    return apiClient.patch<DocumentSeries>(`/billing/series/${id}`, data);
  },

  // Delete series - DELETE /billing/series/:id
  deleteDocumentSeries: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/billing/series/${id}`);
  },

  // ==================== DOCUMENT CORRELATIVES ====================

  // Get all correlatives - GET /billing/correlatives
  getCorrelatives: async (params?: GetCorrelativesParams): Promise<DocumentCorrelative[]> => {
    return apiClient.get<DocumentCorrelative[]>('/billing/correlatives', { params });
  },

  // Get correlative by ID - GET /billing/correlatives/:id
  getCorrelativeById: async (id: string): Promise<DocumentCorrelative> => {
    return apiClient.get<DocumentCorrelative>(`/billing/correlatives/${id}`);
  },

  // Get correlative by document number - GET /billing/correlatives/document/:documentNumber
  getCorrelativeByDocumentNumber: async (documentNumber: string): Promise<DocumentCorrelative> => {
    return apiClient.get<DocumentCorrelative>(`/billing/correlatives/document/${documentNumber}`);
  },

  // Generate correlative - POST /billing/correlatives/generate
  generateCorrelative: async (data: GenerateCorrelativeDto): Promise<DocumentCorrelative> => {
    return apiClient.post<DocumentCorrelative>('/billing/correlatives/generate', data);
  },

  // Void correlative - POST /billing/correlatives/:id/void
  voidCorrelative: async (id: string, data: VoidCorrelativeDto): Promise<DocumentCorrelative> => {
    return apiClient.post<DocumentCorrelative>(`/billing/correlatives/${id}/void`, data);
  },
};
