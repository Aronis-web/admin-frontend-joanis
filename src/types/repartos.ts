// Repartos Types and Interfaces

/**
 * Reparto Status
 */
export enum RepartoStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Reparto Producto Validation Status
 */
export enum RepartoProductoValidationStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  PARTIAL = 'PARTIAL',
  DISCREPANCY = 'DISCREPANCY',
}

/**
 * Reparto Producto Status (Legacy)
 */
export enum RepartoProductoStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  CANCELLED = 'CANCELLED',
}

// ============================================
// Main Entities
// ============================================

/**
 * Reparto Entity
 */
export interface Reparto {
  id: string;
  campaignId: string;
  code?: string;
  name: string;
  description?: string;
  status: RepartoStatus;
  scheduledDate?: string;
  warehouseId?: string;
  supervisorId?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  campaign?: {
    id: string;
    code?: string;
    name: string;
    status?: string;
  };
  warehouse?: {
    id: string;
    name: string;
    location?: string;
  };
  supervisor?: {
    id: string;
    name?: string;
    email: string;
    phone?: string;
  };
  createdByUser?: {
    id: string;
    name?: string;
    email: string;
  };
  completedByUser?: {
    id: string;
    name?: string;
    email: string;
  };
  participantes?: RepartoParticipante[];
}

/**
 * Reparto Participante Entity
 */
export interface RepartoParticipante {
  id: string;
  repartoId: string;
  userId: string;
  vehicleInfo?: string;
  route?: string;
  notes?: string;
  status: RepartoStatus;
  createdAt: string;
  updatedAt: string;
  reparto?: Reparto;
  user?: {
    id: string;
    name?: string;
    email: string;
    phone?: string;
  };
  // Legacy support for campaign participant
  campaignParticipantId?: string;
  campaignParticipant?: {
    id: string;
    participantType: string;
    companyId?: string;
    siteId?: string;
    company?: {
      id: string;
      name: string;
      ruc?: string;
    };
    site?: {
      id: string;
      code: string;
      name: string;
    };
  };
  productos?: RepartoProducto[];
}

/**
 * Reparto Producto Entity
 */
export interface RepartoProducto {
  id: string;
  repartoParticipanteId: string;
  productId: string;
  stockItemId: string;
  quantityAssigned: number;
  quantityValidated: number;
  validationStatus: RepartoProductoValidationStatus;
  notes?: string;
  includeInSheet?: boolean; // Controls if product appears in PDF
  createdAt: string;
  updatedAt: string;
  // Presentation info (if distributed by presentation)
  presentationId?: string;
  factorToBase?: number;
  repartoParticipante?: RepartoParticipante;
  product?: {
    id: string;
    title?: string;
    name?: string;
    sku: string;
    status?: string;
    description?: string;
    correlativeNumber?: number;
    presentations?: Array<{
      id: string;
      presentationId: string;
      factorToBase: number;
      isBase: boolean;
      presentation: {
        id: string;
        code: string;
        name: string;
      };
    }>;
  };
  stockItem?: {
    id: string;
    batchNumber?: string;
    expirationDate?: string;
    quantityBase: number;
    reservedQuantityBase: number;
    availableQuantityBase: number;
  };
  validaciones?: ValidacionSalida[];
  // Legacy support
  quantityBase?: string;
  status?: RepartoProductoStatus;
  warehouseId?: string;
  areaId?: string;
  warehouse?: {
    id: string;
    name: string;
  };
  area?: {
    id: string;
    name: string;
  };
  validacion?: ValidacionSalida;
}

/**
 * Validacion Salida Entity
 */
export interface ValidacionSalida {
  id: string;
  repartoProductoId: string;
  validatedQuantity: number;
  photoUrl: string;
  signatureUrl: string;
  validatedBy: string;
  validatedAt: string;
  notes?: string;
  createdAt: string;
  repartoProducto?: RepartoProducto;
  validator?: {
    id: string;
    name?: string;
    email: string;
  };
  // ✅ NUEVO: Información de presentaciones en la validación
  presentationId?: string; // Presentación base usada en la validación
  validatedPresentationQuantity?: number; // Cantidad de presentaciones completas
  validatedLooseUnits?: number; // Unidades sueltas adicionales
  presentationInfo?: {
    roundingApplied?: boolean;
    largestPresentation?: {
      factorToBase: number;
      name: string;
    };
  };
  changes?: {
    validatedStock: number;
    presentations?: Array<{
      presentationId: string;
      factorToBase: number;
      notes?: string;
    }>;
  };
  // Legacy support
  validatedQuantityBase?: string;
  validatedByName?: string;
}

// ============================================
// Request/Response Types
// ============================================

/**
 * Create Reparto Request
 */
export interface CreateRepartoRequest {
  campaignId: string;
  code: string;
  name: string;
  description?: string;
  scheduledDate?: string;
  participantes: Array<{
    campaignParticipantId: string;
    notes?: string;
    productos: Array<{
      productId: string;
      warehouseId: string;
      areaId: string;
      quantityBase: string;
      includeInSheet?: boolean; // Controls if product appears in PDF
    }>;
  }>;
}

/**
 * Update Reparto Request
 */
export interface UpdateRepartoRequest {
  status?: RepartoStatus;
  name?: string;
  description?: string;
  scheduledDate?: string;
  notes?: string;
}

/**
 * Product Presentation Input for Validations
 */
export interface ProductPresentationInputDto {
  presentationId: string;
  factorToBase: number;
  notes?: string;
}

/**
 * Validar Salida Request
 */
export interface ValidarSalidaRequest {
  validatedQuantityBase: string; // ✅ Backend espera string
  photoUrl: string;
  signatureUrl: string;
  validatedByName?: string;
  notes?: string;
  // ✅ NUEVO: Presentaciones opcionales (similar a compras)
  presentations?: ProductPresentationInputDto[];
  validatedPresentationQuantity?: number; // Cantidad de presentaciones completas
  validatedLooseUnits?: number; // Unidades sueltas adicionales
}

/**
 * Query Repartos Parameters
 */
export interface QueryRepartosParams {
  campaignId?: string;
  status?: RepartoStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: 'name' | 'code' | 'createdAt' | 'scheduledDate';
  orderDir?: 'ASC' | 'DESC';
}

/**
 * Repartos Response with Pagination
 */
export interface RepartosResponse {
  data: Reparto[];
  total: number;
  page: number;
  limit: number;
}

// ============================================
// UI Labels and Colors
// ============================================

/**
 * Reparto Status Labels for UI
 */
export const RepartoStatusLabels: Record<RepartoStatus, string> = {
  [RepartoStatus.PENDING]: 'Pendiente',
  [RepartoStatus.IN_PROGRESS]: 'En Progreso',
  [RepartoStatus.COMPLETED]: 'Completado',
  [RepartoStatus.CANCELLED]: 'Cancelado',
};

/**
 * Reparto Producto Validation Status Labels for UI
 */
export const RepartoProductoValidationStatusLabels: Record<
  RepartoProductoValidationStatus,
  string
> = {
  [RepartoProductoValidationStatus.PENDING]: 'Pendiente',
  [RepartoProductoValidationStatus.VALIDATED]: 'Validado',
  [RepartoProductoValidationStatus.PARTIAL]: 'Parcial',
  [RepartoProductoValidationStatus.DISCREPANCY]: 'Discrepancia',
};

/**
 * Reparto Producto Status Labels for UI (Legacy)
 */
export const RepartoProductoStatusLabels: Record<RepartoProductoStatus, string> = {
  [RepartoProductoStatus.PENDING]: 'Pendiente',
  [RepartoProductoStatus.VALIDATED]: 'Validado',
  [RepartoProductoStatus.CANCELLED]: 'Cancelado',
};

/**
 * Reparto Status Colors for UI
 */
export const RepartoStatusColors: Record<RepartoStatus, string> = {
  [RepartoStatus.PENDING]: '#F59E0B',
  [RepartoStatus.IN_PROGRESS]: '#3B82F6',
  [RepartoStatus.COMPLETED]: '#10B981',
  [RepartoStatus.CANCELLED]: '#EF4444',
};

/**
 * Reparto Producto Validation Status Colors for UI
 */
export const RepartoProductoValidationStatusColors: Record<
  RepartoProductoValidationStatus,
  string
> = {
  [RepartoProductoValidationStatus.PENDING]: '#F59E0B',
  [RepartoProductoValidationStatus.VALIDATED]: '#10B981',
  [RepartoProductoValidationStatus.PARTIAL]: '#3B82F6',
  [RepartoProductoValidationStatus.DISCREPANCY]: '#EF4444',
};

/**
 * Reparto Producto Status Colors for UI (Legacy)
 */
export const RepartoProductoStatusColors: Record<RepartoProductoStatus, string> = {
  [RepartoProductoStatus.PENDING]: '#F59E0B',
  [RepartoProductoStatus.VALIDATED]: '#10B981',
  [RepartoProductoStatus.CANCELLED]: '#EF4444',
};

// ============================================
// Progress and Reports Types
// ============================================

/**
 * Progress Information
 */
export interface ProgressInfo {
  productsAssigned: number;
  productsValidated: number;
  productsPercentage: number;
  quantityAssigned: number;
  quantityValidated: number;
  quantityPercentage: number;
}

/**
 * Product Progress
 */
export interface ProductProgress {
  productId: string;
  productName: string;
  productSku: string;
  quantityAssigned: number;
  quantityValidated: number;
  isValidated: boolean;
  validatedAt?: string;
  validatedBy?: string;
}

/**
 * Participant Progress
 */
export interface ParticipantProgress {
  participantId: string;
  participantName: string;
  participantType: string;
  progress: ProgressInfo;
  products: ProductProgress[];
}

/**
 * Reparto Progress Response
 */
export interface RepartoProgressResponse {
  repartoId: string;
  repartoCode: string;
  repartoName: string;
  repartoStatus: string;
  campaignId: string;
  campaignName: string;
  campaignCode: string;
  scheduledDate?: string;
  overallProgress: ProgressInfo;
  participants: ParticipantProgress[];
}
