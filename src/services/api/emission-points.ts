import { apiClient } from './client';

// ============================================
// EMISSION POINTS (Puntos de Emisión)
// ============================================

export type EmissionType = 'CAMPAIGN' | 'INDIVIDUAL_SALE' | 'POS';

export interface EmissionPoint {
  id: string;
  companyId: string;
  siteId: string;
  code: string;
  name: string;
  description?: string;
  emissionType: EmissionType;
  isActive: boolean;
  requiresApproval: boolean;
  metadata?: {
    // Para POS
    posNumber?: number;
    cashierName?: string;
    location?: string;
    terminalId?: string;
    // Para CAMPAIGN
    campaignId?: string;
    campaignCode?: string;
    startDate?: string;
    endDate?: string;
    targetParticipants?: number;
    // Para INDIVIDUAL_SALE
    channel?: string;
    platform?: string;
    paymentMethods?: string[];
  };
  seriesCount?: number;
  documentsCount?: number;
  createdAt: string;
  updatedAt: string;
  site?: {
    id: string;
    name: string;
    code?: string;
  };
  company?: {
    id: string;
    name: string;
  };
}

export interface CreateEmissionPointDto {
  companyId: string;
  siteId: string;
  code: string;
  name: string;
  description?: string;
  emissionType: EmissionType;
  isActive?: boolean;
  requiresApproval?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateEmissionPointDto {
  code?: string;
  name?: string;
  description?: string;
  emissionType?: EmissionType;
  isActive?: boolean;
  requiresApproval?: boolean;
  metadata?: Record<string, any>;
}

export interface GetEmissionPointsParams {
  companyId?: string;
  siteId?: string;
  emissionType?: EmissionType;
  isActive?: boolean;
  page?: number;
  limit?: number;
  q?: string;
}

// ============================================
// SERIES (Series por Punto de Emisión)
// ============================================

export interface DocumentSeries {
  id: string;
  companyId: string;
  siteId: string;
  documentTypeId: string;
  emissionPointId: string;
  series: string;
  description?: string;
  currentNumber: number;
  startNumber: number;
  maxNumber: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  documentType?: {
    id: string;
    code: string;
    name: string;
  };
  emissionPoint?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface CreateSeriesDto {
  companyId: string;
  siteId: string;
  documentTypeId: string;
  emissionPointId: string;
  series: string;
  description?: string;
  startNumber?: number;
  maxNumber?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateSeriesDto {
  series?: string;
  description?: string;
  maxNumber?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface GetSeriesParams {
  companyId?: string;
  siteId?: string;
  emissionPointId?: string;
  documentTypeId?: string;
  isActive?: boolean;
  isDefault?: boolean;
  page?: number;
  limit?: number;
  q?: string;
}

// ============================================
// DOCUMENT TYPES (Tipos de Documentos)
// ============================================

export interface DocumentType {
  id: string;
  code: string;
  name: string;
  description?: string;
  requiresRuc: boolean;
  allowsDeduction: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetDocumentTypesParams {
  isActive?: boolean;
  page?: number;
  limit?: number;
  q?: string;
}

// ============================================
// API METHODS
// ============================================

export const emissionPointsApi = {
  // ============================================
  // EMISSION POINTS
  // ============================================

  // Get all emission points - GET /billing/emission-points
  getEmissionPoints: async (params?: GetEmissionPointsParams): Promise<EmissionPoint[]> => {
    return apiClient.get<EmissionPoint[]>('/billing/emission-points', { params });
  },

  // Get emission point by ID - GET /billing/emission-points/:id
  getEmissionPointById: async (id: string): Promise<EmissionPoint> => {
    return apiClient.get<EmissionPoint>(`/billing/emission-points/${id}`);
  },

  // Create emission point - POST /billing/emission-points
  createEmissionPoint: async (data: CreateEmissionPointDto): Promise<EmissionPoint> => {
    return apiClient.post<EmissionPoint>('/billing/emission-points', data);
  },

  // Update emission point - PATCH /billing/emission-points/:id
  updateEmissionPoint: async (id: string, data: UpdateEmissionPointDto): Promise<EmissionPoint> => {
    return apiClient.patch<EmissionPoint>(`/billing/emission-points/${id}`, data);
  },

  // Delete emission point - DELETE /billing/emission-points/:id
  deleteEmissionPoint: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/billing/emission-points/${id}`);
  },

  // ============================================
  // SERIES
  // ============================================

  // Get all series - GET /billing/series
  getSeries: async (params?: GetSeriesParams): Promise<DocumentSeries[]> => {
    return apiClient.get<DocumentSeries[]>('/billing/series', { params });
  },

  // Get series by ID - GET /billing/series/:id
  getSeriesById: async (id: string): Promise<DocumentSeries> => {
    return apiClient.get<DocumentSeries>(`/billing/series/${id}`);
  },

  // Create series - POST /billing/series
  createSeries: async (data: CreateSeriesDto): Promise<DocumentSeries> => {
    return apiClient.post<DocumentSeries>('/billing/series', data);
  },

  // Update series - PATCH /billing/series/:id
  updateSeries: async (id: string, data: UpdateSeriesDto): Promise<DocumentSeries> => {
    return apiClient.patch<DocumentSeries>(`/billing/series/${id}`, data);
  },

  // Delete series - DELETE /billing/series/:id
  deleteSeries: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/billing/series/${id}`);
  },

  // ============================================
  // DOCUMENT TYPES
  // ============================================

  // Get all document types - GET /billing/document-types
  getDocumentTypes: async (params?: GetDocumentTypesParams): Promise<DocumentType[]> => {
    return apiClient.get<DocumentType[]>('/billing/document-types', { params });
  },

  // Get document type by ID - GET /billing/document-types/:id
  getDocumentTypeById: async (id: string): Promise<DocumentType> => {
    return apiClient.get<DocumentType>(`/billing/document-types/${id}`);
  },
};
