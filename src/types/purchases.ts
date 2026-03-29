// Purchase Types and Interfaces

/**
 * Purchase Status
 */
export enum PurchaseStatus {
  DRAFT = 'DRAFT',
  IN_CAPTURE = 'IN_CAPTURE',
  IN_VALIDATION = 'IN_VALIDATION',
  VALIDATED = 'VALIDATED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

/**
 * Purchase Product Status
 */
export enum PurchaseProductStatus {
  PRELIMINARY = 'PRELIMINARY',
  IN_VALIDATION = 'IN_VALIDATION',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}

/**
 * Presentation History Type
 */
export enum PresentationHistoryType {
  PRELIMINARY = 'PRELIMINARY',
  VALIDATED = 'VALIDATED',
}

/**
 * Guide Type
 */
export enum GuideType {
  FACTURA = 'FACTURA',
  BOLETA = 'BOLETA',
  GUIA_REMISION = 'GUIA_REMISION',
  NOTA_CREDITO = 'NOTA_CREDITO',
  NOTA_DEBITO = 'NOTA_DEBITO',
  OTROS = 'OTROS',
}

/**
 * Guide File
 */
export interface GuideFile {
  type: string;
  url: string;
  filename: string;
  uploadedAt: string;
}

/**
 * Purchase Entity
 */
export interface Purchase {
  id: string;
  code: string;
  supplierId: string;
  guideNumber: string;
  guideType: GuideType;
  guideDate: string;
  status: PurchaseStatus;
  guideFiles: GuideFile[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  notes?: string;
  supplier?: {
    id: string;
    code: string;
    commercialName: string;
    legalEntities?: Array<{
      id: string;
      legalName: string;
      ruc: string;
      isPrimary: boolean;
    }>;
  };
  createdByUser?: {
    id: string;
    name?: string;
    email: string;
  };
  closedByUser?: {
    id: string;
    name?: string;
    email: string;
  };
  products?: PurchaseProduct[];
}

/**
 * Purchase Product Presentation History
 */
export interface PurchaseProductPresentationHistory {
  id: string;
  purchaseProductId: string;
  presentationId: string;
  factorToBase: number;
  type: PresentationHistoryType;
  createdBy: string;
  createdAt: string;
  notes?: string;
  presentation?: {
    id: string;
    code: string;
    name: string;
  };
  createdByUser?: {
    id: string;
    name?: string;
    email: string;
  };
}

/**
 * Purchase Product Entity
 */
export interface PurchaseProduct {
  id: string;
  purchaseId: string;
  productId?: string;
  status: PurchaseProductStatus;

  // Datos preliminares
  sku: string;
  name: string;
  correlativeNumber?: number; // Número correlativo del producto
  costCents: number;
  preliminaryStock: number;
  preliminaryPresentationQuantity?: number; // Cantidad de presentaciones (preliminar)
  preliminaryLooseUnits?: number; // Unidades sueltas (preliminar)

  // Presentación actual
  currentPresentationId?: string;
  currentFactorToBase?: number;

  // Datos de validación
  validatedStock?: number;
  validatedPresentationQuantity?: number; // Cantidad de presentaciones (validado)
  validatedLooseUnits?: number; // Unidades sueltas (validado)
  warehouseId?: string;
  areaId?: string;
  productPhotos?: string[];
  barcode?: string;
  weightKg?: number; // Peso del producto en kilogramos (3 decimales)

  // Asignación de deuda
  supplierLegalEntityId?: string;
  assignedDebtCents?: number;

  // Auditoría
  createdAt: string;
  validatedAt?: string;
  validatedBy?: string;
  closedAt?: string;

  // Notas
  validationNotes?: string;
  rejectionReason?: string;

  // Relaciones
  product?: {
    id: string;
    title: string;
    sku: string;
    status: string;
    photos?: string[]; // Fotos del producto del catálogo
    salePrices?: Array<{
      productId: string;
      presentationId: string;
      profileId: string;
      priceCents: number;
      currency: string;
      isOverridden: boolean;
      profile?: {
        id: string;
        code: string;
        name: string;
        factorToCost: number;
      };
      presentation?: {
        id: string;
        code: string;
        name: string;
      };
    }>;
  };
  warehouse?: {
    id: string;
    code: string;
    name: string;
  };
  area?: {
    id: string;
    code: string;
    name?: string;
  };
  currentPresentation?: {
    id: string;
    code: string;
    name: string;
  };
  supplierLegalEntity?: {
    id: string;
    legalName: string;
    ruc: string;
  };
  validatedByUser?: {
    id: string;
    name?: string;
    email: string;
  };
  presentationHistory?: PurchaseProductPresentationHistory[];
  validations?: PurchaseProductValidation[]; // Historial de validaciones con fotos y firmas
}

/**
 * Purchase Status History
 */
export interface PurchaseStatusHistory {
  id: string;
  purchaseId: string;
  fromStatus?: PurchaseStatus;
  toStatus: PurchaseStatus;
  changedBy: string;
  changedAt: string;
  notes?: string;
  changedByUser?: {
    id: string;
    name?: string;
    email: string;
  };
}

/**
 * Purchase Product Validation History
 */
export interface PurchaseProductValidation {
  id: string;
  purchaseProductId: string;
  validatedBy: string;
  validatedAt: string;
  changes: Record<string, any>;
  validatedStock: number;
  warehouseId: string;
  areaId?: string;
  presentationId?: string;
  previousPresentationId?: string; // Presentación previa (historial)
  photosAdded: string[];
  barcodeAdded?: string;
  photoUrl?: string; // URL de la foto de validación
  signatureUrl?: string; // URL de la firma de validación
  notes?: string;
  validatedByUser?: {
    id: string;
    name?: string;
    email: string;
  };
}

// ============================================
// Request/Response Types
// ============================================

/**
 * Create Purchase Request
 */
export interface CreatePurchaseRequest {
  supplierId: string;
  guideNumber: string;
  guideType: GuideType;
  guideDate: string;
  guideFiles?: GuideFile[];
  notes?: string;
}

/**
 * Update Purchase Request
 */
export interface UpdatePurchaseRequest {
  supplierId?: string;
  guideNumber?: string;
  guideType?: GuideType;
  guideDate?: string;
  guideFiles?: GuideFile[];
  notes?: string;
}

/**
 * Presentation Configuration for Product
 */
export interface ProductPresentationConfig {
  presentationId: string; // OBLIGATORIO: ID de la presentación
  factorToBase: number; // OBLIGATORIO: Factor de conversión a unidad base (ej: 1 caja = 24 unidades)
  notes?: string; // OPCIONAL: Notas sobre esta presentación
}

/**
 * Add Product to Purchase Request
 */
export interface AddProductRequest {
  sku: string;
  name: string;
  costCents: number;
  preliminaryStock: number;
  preliminaryPresentationQuantity?: number; // OPCIONAL: Cantidad de presentaciones
  preliminaryLooseUnits?: number; // OPCIONAL: Unidades sueltas
  presentations?: ProductPresentationConfig[]; // OPCIONAL: Array de presentaciones con sus factores base
  notes?: string; // OPCIONAL: Notas generales del producto
}

/**
 * Update Purchase Product Request
 */
export interface UpdateProductRequest {
  sku?: string;
  name?: string;
  costCents?: number;
  preliminaryStock?: number;
  preliminaryPresentationQuantity?: number; // OPCIONAL: Cantidad de presentaciones
  preliminaryLooseUnits?: number; // OPCIONAL: Unidades sueltas
  presentations?: ProductPresentationConfig[]; // OPCIONAL: Array de presentaciones con sus factores base
  notes?: string; // OPCIONAL: Notas generales del producto
  presentationId?: string; // OPCIONAL: Presentación en la que llegó el producto (legacy)
  factorToBase?: number; // OPCIONAL: Factor de conversión a unidad base (legacy)
  presentationNotes?: string; // OPCIONAL: Notas sobre la presentación (legacy)
  previousPresentationId?: string; // OPCIONAL: Presentación previa (para auditoría)
  quantityPerPresentation?: number; // OPCIONAL: Cantidad por presentación
}

/**
 * Validated Presentation Config
 */
export interface ValidatedPresentationConfig {
  presentationId: string; // OBLIGATORIO: ID de la presentación
  factorToBase: number; // OBLIGATORIO: Factor de conversión a unidad base
  notes?: string; // OPCIONAL: Notas sobre esta presentación validada
}

/**
 * Validate Product Request
 */
export interface ValidateProductRequest {
  sku?: string; // OPCIONAL: SKU actualizado
  name?: string; // OPCIONAL: Nombre actualizado
  costCents?: number; // OPCIONAL: Costo actualizado en centavos
  preliminaryStock?: number; // OPCIONAL: Stock preliminar
  validatedStock: number;
  validatedPresentationQuantity?: number; // OPCIONAL: Cantidad de presentaciones validadas
  validatedLooseUnits?: number; // OPCIONAL: Unidades sueltas validadas
  warehouseId: string;
  areaId?: string;
  presentations?: ValidatedPresentationConfig[]; // OPCIONAL: Array de presentaciones validadas
  barcode?: string;
  productPhotos?: string[];
  weightKg?: number; // OBLIGATORIO para validación: Peso del producto en kilogramos (3 decimales)
  photoUrl?: string; // OPCIONAL: URL de la foto de validación
  signatureUrl?: string; // OPCIONAL: URL de la firma de validación
  validationNotes?: string;
  // ========== Campos nuevos para recurrencia ==========
  recurrenceAction?: 'MERGE' | 'CREATE_NEW'; // Acción de recurrencia
  existingProductId?: string; // ID del producto existente (solo si recurrenceAction = 'MERGE')
  recurrenceMetadata?: {
    candidatesReviewed?: number;
    userDecision?: string;
    matchConfidence?: number;
  };
}

/**
 * Check Recurrence Request
 */
export interface CheckRecurrenceRequest {
  sku: string;
  barcode?: string;
}

/**
 * Recurrent Product Candidate
 */
export interface RecurrentProductCandidate {
  productId: string;
  correlativeNumber: number;
  title: string;
  sku: string;
  barcode?: string;
  photos: string[];
  currentStock: number;
  stockByWarehouse: Array<{
    warehouseId: string;
    warehouseName: string;
    areaId?: string;
    areaName?: string;
    quantity: number;
  }>;
  lastPurchaseDate?: string;
  purchaseCount: number;
  supplierId: string;
  supplierName: string;
  costCents: number;
}

/**
 * Check Recurrence Response
 */
export interface CheckRecurrenceResponse {
  hasRecurrentProducts: boolean;
  candidates: RecurrentProductCandidate[];
  message?: string;
  metadata?: {
    totalCandidates: number;
    searchCriteria: {
      supplierId: string;
      sku: string;
      barcode?: string;
    };
    criteriaUsed: string;
  };
}

/**
 * Validate Product V2 Response
 */
export interface ValidateProductV2Response {
  success: boolean;
  purchaseProduct: PurchaseProduct;
  product: any; // Product entity
  action: 'MERGED' | 'CREATED_NEW';
  stockMovement?: {
    productId: string;
    warehouseId: string;
    areaId?: string;
    quantityAdded: number;
    previousStock: number;
    newStock: number;
  };
  message: string;
  metadata?: {
    isRecurrentProduct: boolean;
    photosAdded?: number;
    presentationsCreated?: number;
    validationId?: string;
  };
}

/**
 * Reject Product Request
 */
export interface RejectProductRequest {
  rejectionReason: string;
}

/**
 * Assign Debt Request
 */
export interface AssignDebtRequest {
  supplierLegalEntityId: string;
}

/**
 * Date Field Type for filtering
 */
export type DateFieldType = 'guideDate' | 'createdAt' | 'closedAt';

/**
 * Query Purchases Parameters
 */
export interface QueryPurchasesParams {
  supplierId?: string;
  status?: PurchaseStatus;
  startDate?: string;
  endDate?: string;
  dateField?: DateFieldType;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Purchases Response with Pagination
 */
export interface PurchasesResponse {
  data: Purchase[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Purchase Summary Response
 */
export interface PurchaseSummaryResponse {
  id: string;
  code: string;
  status: PurchaseStatus;
  totalProducts: number;
  validatedProducts: number;
  rejectedProducts: number;
  pendingProducts: number;
  totalDebtCents: number;
  debtsByLegalEntity: Array<{
    legalEntityId: string;
    legalName: string;
    ruc: string;
    debtCents: number;
    products: number;
  }>;
}

/**
 * Validation Status Response
 */
export interface ValidationStatusResponse {
  purchaseId: string;
  totalProducts: number;
  validated: number;
  rejected: number;
  pending: number;
  canClose: boolean;
}

/**
 * Purchase Total Sum Response
 */
export interface PurchaseTotalSumResponse {
  purchaseId: string;
  purchaseCode: string;
  totalUnvalidatedCents: number;
  totalValidatedCents: number;
  differenceCents: number;
  totalProducts: number;
  validatedProducts: number;
}

/**
 * Purchase Validation Progress Response
 */
export interface PurchaseValidationProgressResponse {
  purchaseId: string;
  purchaseCode: string;
  purchaseStatus: PurchaseStatus;
  supplierName: string;
  totalProducts: number;
  productsValidated: number;
  productsInValidation: number;
  productsPreliminary: number;
  productsRejected: number;
  productsClosed: number;
  validationProgressPercentage: number;
  totalPreliminaryCents: number;
  totalValidatedCents: number;
  totalDifferenceCents: number;
  totalPreliminaryStock: number;
  totalValidatedStock: number;
  totalStockDifference: number;
  productsWithPhotos: number;
  products?: PurchaseProduct[];
}

/**
 * Status Labels for UI
 */
export const PurchaseStatusLabels: Record<PurchaseStatus, string> = {
  [PurchaseStatus.DRAFT]: 'Borrador',
  [PurchaseStatus.IN_CAPTURE]: 'En Captura',
  [PurchaseStatus.IN_VALIDATION]: 'En Validación',
  [PurchaseStatus.VALIDATED]: 'Validado',
  [PurchaseStatus.CLOSED]: 'Cerrado',
  [PurchaseStatus.CANCELLED]: 'Cancelado',
};

/**
 * Product Status Labels for UI
 */
export const PurchaseProductStatusLabels: Record<PurchaseProductStatus, string> = {
  [PurchaseProductStatus.PRELIMINARY]: 'Preliminar',
  [PurchaseProductStatus.IN_VALIDATION]: 'En Validación',
  [PurchaseProductStatus.VALIDATED]: 'Validado',
  [PurchaseProductStatus.REJECTED]: 'Rechazado',
  [PurchaseProductStatus.CLOSED]: 'Cerrado',
};

/**
 * Guide Type Labels for UI
 */
export const GuideTypeLabels: Record<GuideType, string> = {
  [GuideType.FACTURA]: 'Factura',
  [GuideType.BOLETA]: 'Boleta',
  [GuideType.GUIA_REMISION]: 'Guía de Remisión',
  [GuideType.NOTA_CREDITO]: 'Nota de Crédito',
  [GuideType.NOTA_DEBITO]: 'Nota de Débito',
  [GuideType.OTROS]: 'Otros',
};

/**
 * Status Colors for UI
 */
export const PurchaseStatusColors: Record<PurchaseStatus, string> = {
  [PurchaseStatus.DRAFT]: '#94A3B8',
  [PurchaseStatus.IN_CAPTURE]: '#3B82F6',
  [PurchaseStatus.IN_VALIDATION]: '#F59E0B',
  [PurchaseStatus.VALIDATED]: '#10B981',
  [PurchaseStatus.CLOSED]: '#6366F1',
  [PurchaseStatus.CANCELLED]: '#EF4444',
};

/**
 * Product Status Colors for UI
 */
export const PurchaseProductStatusColors: Record<PurchaseProductStatus, string> = {
  [PurchaseProductStatus.PRELIMINARY]: '#94A3B8',
  [PurchaseProductStatus.IN_VALIDATION]: '#F59E0B',
  [PurchaseProductStatus.VALIDATED]: '#10B981',
  [PurchaseProductStatus.REJECTED]: '#EF4444',
  [PurchaseProductStatus.CLOSED]: '#6366F1',
};

// ============================================
// Autocomplete Types
// ============================================

/**
 * Match Type for Autocomplete
 */
export type AutocompleteMatchType = 'purchase' | 'supplier' | 'product';

/**
 * Autocomplete Suggestion
 */
export interface PurchaseAutocompleteSuggestion {
  id: string;
  code: string;
  supplierName: string;
  guideNumber: string;
  guideDate: string;
  status: PurchaseStatus;
  matchedProduct?: string;
  matchType: AutocompleteMatchType;
}

/**
 * Autocomplete Response
 */
export interface PurchaseAutocompleteResponse {
  suggestions: PurchaseAutocompleteSuggestion[];
  total: number;
}

// ============================================
// OCR Scanner Types
// ============================================

/**
 * OCR Scanned Item (Updated for new batch OCR)
 */
export interface OcrScannedItem {
  sku: string | null; // Can be null if not found
  nombre: string;
  cajas: number; // Cantidad de presentaciones
  unidades_por_caja: number; // Factor de conversión
  cantidad_total: number; // Total unidades base
  precio_unitario: number | null; // Precio por unidad base (can be null)
  subtotal_fila: number | null; // Total de la línea (can be null)
}

/**
 * OCR Scan Response (Updated for new batch OCR)
 */
export interface OcrScanResponse {
  items: OcrScannedItem[];
  total_estimado: number; // Suma de todos los subtotales
  archivos_procesados: number; // Cantidad de archivos procesados
  observaciones?: string; // Observaciones si se enviaron

  // Legacy fields (deprecated but kept for backward compatibility)
  incluye_igv_en_precios?: boolean;
  subtotal_documento_impreso?: number | null;
  igv_impreso?: number | null;
  total_documento_impreso?: number | null;
  subtotal_documento_calculado?: number;
  diferencia_subtotal?: number | null;
}
