// Campaign Types and Interfaces

/**
 * Campaign Status
 */
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

/**
 * Participant Type
 */
export enum ParticipantType {
  EXTERNAL_COMPANY = 'EXTERNAL_COMPANY',
  INTERNAL_SITE = 'INTERNAL_SITE',
}

/**
 * Distribution Type
 */
export enum DistributionType {
  ALL = 'ALL',
  INTERNAL_ONLY = 'INTERNAL_ONLY',
  INTERNAL_EQUAL = 'INTERNAL_EQUAL',
  EXTERNAL_ONLY = 'EXTERNAL_ONLY',
  CUSTOM = 'CUSTOM',
}

/**
 * Product Status in Campaign
 * - ACTIVE: Product ready to generate distribution
 * - PRELIMINARY: Product in planning, cannot be distributed yet
 */
export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  PRELIMINARY = 'PRELIMINARY',
}

/**
 * Product Source Type
 * - INVENTORY: Product selected from inventory/catalog
 * - PURCHASE: Product from a validated purchase
 */
export enum ProductSourceType {
  INVENTORY = 'INVENTORY',
  PURCHASE = 'PURCHASE',
}

// ============================================
// Main Entities
// ============================================

/**
 * Campaign Entity
 */
export interface Campaign {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  startDate?: string;
  endDate?: string;
  remainderSiteId?: string;
  budget?: number;
  targetAudience?: string;
  goals?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  notes?: string;
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
  remainderSite?: {
    id: string;
    code: string;
    name: string;
  };
  participants?: CampaignParticipant[];
  products?: CampaignProduct[];
  customDistributions?: CampaignCustomDistribution[];
  repartos?: any[]; // Repartos relacionados
}

/**
 * Campaign Participant Entity
 */
export interface CampaignParticipant {
  id: string;
  campaignId: string;
  participantType: ParticipantType;
  companyId?: string;
  siteId?: string;
  assignedAmountCents: number;
  currency: string;
  priceProfileId?: string;
  createdAt: string;
  updatedAt: string;
  company?: {
    id: string;
    name: string;
    alias?: string;
    ruc?: string;
  };
  site?: {
    id: string;
    code: string;
    name: string;
  };
  priceProfile?: {
    id: string;
    name: string;
    code: string;
    costFactor: number;
    isActive: boolean;
  };
}

/**
 * Campaign Product Entity
 */
export interface CampaignProduct {
  id: string;
  campaignId: string;
  productId: string;
  sourceType: ProductSourceType;
  purchaseId?: string;
  distributionType: DistributionType;
  totalQuantityBase: number;
  productStatus: ProductStatus;
  distributionGenerated: boolean;
  addedBy: string;
  addedAt: string;
  updatedAt: string;
  product?: {
    id: string;
    correlativeNumber?: number;
    title: string;
    sku: string;
    status: string;
    costCents?: number;
    presentations?: Array<{
      id: string;
      presentationId: string;
      factorToBase: number;
      isBase: boolean;
      presentation: {
        id: string;
        code: string;
        name: string;
        isBase: boolean;
      };
    }>;
    stockItems?: Array<{
      productId: string;
      warehouseId: string;
      areaId: string | null;
      quantityBase: number;
      reservedQuantityBase?: number;
      availableQuantityBase?: number;
      updatedAt: string;
      warehouse?: {
        id: string;
        name: string;
        code: string;
      };
      area?: {
        id: string;
        name: string;
      } | null;
    }>;
  };
  purchase?: {
    id: string;
    code: string;
    guideNumber: string;
  };
  purchaseProduct?: {
    id: string;
    validatedStock?: number;
    preliminaryStock?: number;
  };
  addedByUser?: {
    id: string;
    name?: string;
    email: string;
  };
  customDistributions?: CampaignCustomDistribution[];
}

/**
 * Campaign Custom Distribution Entity
 */
export interface CampaignCustomDistribution {
  id: string;
  campaignProductId: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  items?: CampaignCustomDistributionItem[];
}

/**
 * Campaign Custom Distribution Item Entity
 */
export interface CampaignCustomDistributionItem {
  id: string;
  customDistributionId: string;
  participantId: string;
  assignedQuantityBase: number;
  createdAt: string;
  updatedAt: string;
  participant?: CampaignParticipant;
}

// ============================================
// Request/Response Types
// ============================================

/**
 * Create Campaign Request
 */
export interface CreateCampaignRequest {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: CampaignStatus;
  budget?: number;
  targetAudience?: string;
  goals?: string;
  notes?: string;
  remainderSiteId?: string;
}

/**
 * Update Campaign Request
 */
export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  targetAudience?: string;
  goals?: string;
  notes?: string;
  remainderSiteId?: string;
}

/**
 * Add Participant Request
 */
export interface AddParticipantRequest {
  participantType: ParticipantType;
  companyId?: string;
  siteId?: string;
  assignedAmount?: number;
  currency?: string;
  priceProfileId?: string;
}

/**
 * Update Participant Request
 */
export interface UpdateParticipantRequest {
  assignedAmount?: number;
  currency?: string;
  priceProfileId?: string;
}

/**
 * Add Product Request
 */
export interface AddProductRequest {
  productId: string;
  sourceType: ProductSourceType;
  totalQuantity: number;
  productStatus: ProductStatus;
  distributionType: DistributionType;
  purchaseId?: string;
}

/**
 * Add Products from Purchase Request
 */
export interface AddProductsFromPurchaseRequest {
  purchaseId: string;
  products: Array<{
    productId: string;
    quantity: number;
    productStatus: ProductStatus;
    distributionType: DistributionType;
  }>;
}

/**
 * Update Product Request
 */
export interface UpdateProductRequest {
  totalQuantity?: number;
  productStatus?: ProductStatus;
  distributionType?: DistributionType;
}

/**
 * Set Custom Distribution Request
 */
export interface SetCustomDistributionRequest {
  name?: string;
  distributions: Array<{
    participantId: string;
    quantity: number;
  }>;
}

/**
 * Participant Preference for Preview
 */
export interface ParticipantPreference {
  participantId: string;
  roundingFactor: number; // 1=unidades, 12=cajas, etc.
}

/**
 * Distribution Preview Request
 */
export interface DistributionPreviewRequest {
  participantPreferences?: ParticipantPreference[];
}

/**
 * Distribution Item for Generate Request
 */
export interface DistributionGenerateItem {
  participantId: string;
  quantityBase: number;
  roundingFactor?: number;
  presentationId?: string;
  quantityPresentation?: number;
  notes?: string;
  // Campos para especificar de qué área se toma el stock
  sourceWarehouseId?: string;
  sourceAreaId?: string;
}

/**
 * Generate Distribution Request
 */
export interface GenerateDistributionRequest {
  distributions: DistributionGenerateItem[];
  notes?: string;
}

/**
 * Distribution Preview Item
 */
export interface DistributionPreviewItem {
  participantId: string;
  participantName: string;
  participantType: ParticipantType;
  assignedAmount: number;
  percentage: number;
  calculatedQuantity: number;
  roundingFactor: number; // Factor de redondeo (1=unidades, 12=cajas, etc.)
  // Presentation fields
  presentationId?: string;
  quantityPresentation?: number;
  factorToBase?: number;
}

/**
 * Stock Detail by Warehouse
 */
export interface StockDetailByWarehouse {
  warehouse: string;
  total: number;
  reserved: number;
  available: number;
}

/**
 * Distribution Preview Response
 */
export interface DistributionPreviewResponse {
  productId: string;
  productName: string;
  totalQuantity: number;
  distributionType: DistributionType;
  isPreliminary: boolean;
  distributionDescription?: string;
  currency: string;
  totalAssignedAmount?: number;
  totalDistributed: number;
  remainder: number;
  totalParticipants: number;
  remainderAssignedTo?: {
    participantId: string;
    participantName: string;
    remainderQuantity: number;
  };
  remainderSite?: {
    id: string;
    name: string;
  };
  presentationInfo?: {
    hasPresentations: boolean;
    largestFactor: number;
    largestPresentation?: {
      id: string;
      name: string;
      factorToBase: number;
      description?: string;
    };
    totalPresentations: number;
    roundingApplied: boolean;
    roundingMethod?: string;
  };
  stockDetails?: StockDetailByWarehouse[];
  preview: DistributionPreviewItem[];
}

/**
 * Distribution Result Detail
 */
export interface DistributionResultDetail {
  participantId: string;
  participantName: string;
  quantity: number;
  // Presentation fields
  presentationId?: string;
  quantityPresentation?: number;
  factorToBase?: number;
}

/**
 * Distribution Result Response
 */
export interface DistributionResultResponse {
  success: boolean;
  message: string;
  productId: string;
  productName: string;
  totalQuantity: number;
  distributionType: DistributionType;
  distributionsCreated: number;
  details: DistributionResultDetail[];
  repartoCode?: string;
  // Presentation fields
  presentationId?: string;
  quantityPresentation?: number;
  factorToBase?: number;
}

/**
 * Query Campaigns Parameters
 */
export interface QueryCampaignsParams {
  status?: CampaignStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: 'name' | 'code' | 'createdAt' | 'startDate';
  orderDir?: 'ASC' | 'DESC';
}

/**
 * Campaigns Response with Pagination
 */
export interface CampaignsResponse {
  data: Campaign[];
  total: number;
  page: number;
  limit: number;
}

// ============================================
// UI Labels and Colors
// ============================================

/**
 * Campaign Status Labels for UI
 */
export const CampaignStatusLabels: Record<CampaignStatus, string> = {
  [CampaignStatus.DRAFT]: 'Borrador',
  [CampaignStatus.ACTIVE]: 'Activa',
  [CampaignStatus.PAUSED]: 'Pausada',
  [CampaignStatus.COMPLETED]: 'Completada',
  [CampaignStatus.CLOSED]: 'Cerrada',
  [CampaignStatus.CANCELLED]: 'Cancelada',
};

/**
 * Participant Type Labels for UI
 */
export const ParticipantTypeLabels: Record<ParticipantType, string> = {
  [ParticipantType.EXTERNAL_COMPANY]: 'Empresa Externa',
  [ParticipantType.INTERNAL_SITE]: 'Sede Interna',
};

/**
 * Distribution Type Labels for UI
 */
export const DistributionTypeLabels: Record<DistributionType, string> = {
  [DistributionType.ALL]: 'Todos los Participantes',
  [DistributionType.INTERNAL_ONLY]: 'Solo Sedes Internas (Porcentual)',
  [DistributionType.INTERNAL_EQUAL]: 'Solo Sedes Internas (Iguales)',
  [DistributionType.EXTERNAL_ONLY]: 'Solo Empresas Externas',
  [DistributionType.CUSTOM]: 'Distribución Personalizada',
};

/**
 * Product Status Labels for UI
 */
export const ProductStatusLabels: Record<ProductStatus, string> = {
  [ProductStatus.ACTIVE]: 'Activo',
  [ProductStatus.PRELIMINARY]: 'Preliminar',
};

/**
 * Product Source Type Labels for UI
 */
export const ProductSourceTypeLabels: Record<ProductSourceType, string> = {
  [ProductSourceType.INVENTORY]: 'Desde Inventario',
  [ProductSourceType.PURCHASE]: 'Desde Compra',
};

/**
 * Campaign Status Colors for UI
 */
export const CampaignStatusColors: Record<CampaignStatus, string> = {
  [CampaignStatus.DRAFT]: '#94A3B8',
  [CampaignStatus.ACTIVE]: '#10B981',
  [CampaignStatus.PAUSED]: '#F59E0B',
  [CampaignStatus.COMPLETED]: '#6366F1',
  [CampaignStatus.CLOSED]: '#6366F1',
  [CampaignStatus.CANCELLED]: '#EF4444',
};

/**
 * Product Status Colors for UI
 */
export const ProductStatusColors: Record<ProductStatus, string> = {
  [ProductStatus.ACTIVE]: '#10B981', // Green - ready to distribute
  [ProductStatus.PRELIMINARY]: '#F59E0B', // Orange - in planning
};

/**
 * Distribution Type Descriptions for UI
 */
export const DistributionTypeDescriptions: Record<DistributionType, string> = {
  [DistributionType.ALL]:
    'El producto se distribuirá proporcionalmente entre todos los participantes (empresas y sedes) según sus montos asignados.',
  [DistributionType.INTERNAL_ONLY]:
    'El producto se distribuirá solo entre sedes internas de forma porcentual según sus montos asignados.',
  [DistributionType.INTERNAL_EQUAL]:
    'El producto se distribuirá solo entre sedes internas con la misma cantidad para todas.',
  [DistributionType.EXTERNAL_ONLY]:
    'El producto se distribuirá solo entre empresas externas, ignorando sedes internas.',
  [DistributionType.CUSTOM]:
    'Permite definir cantidades específicas manualmente para cada participante.',
};
