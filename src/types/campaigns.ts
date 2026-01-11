// Campaign Types and Interfaces

/**
 * Campaign Status
 */
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
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
  EXTERNAL_ONLY = 'EXTERNAL_ONLY',
  CUSTOM = 'CUSTOM',
}

/**
 * Product Status in Campaign
 * - PENDING: Product added to campaign but not yet distributed
 * - PARTIALLY_DISTRIBUTED: Some quantities distributed, some pending
 * - DISTRIBUTED: All quantities fully distributed to participants
 */
export enum ProductStatus {
  PENDING = 'PENDING',
  PARTIALLY_DISTRIBUTED = 'PARTIALLY_DISTRIBUTED',
  DISTRIBUTED = 'DISTRIBUTED',
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
  participants?: CampaignParticipant[];
  products?: CampaignProduct[];
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
  createdAt: string;
  updatedAt: string;
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
    title: string;
    sku: string;
    status: string;
  };
  purchase?: {
    id: string;
    code: string;
    guideNumber: string;
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
  notes?: string;
}

/**
 * Update Campaign Request
 */
export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

/**
 * Add Participant Request
 */
export interface AddParticipantRequest {
  participantType: ParticipantType;
  companyId?: string;
  siteId?: string;
  assignedAmount: number;
  currency?: string;
}

/**
 * Update Participant Request
 */
export interface UpdateParticipantRequest {
  assignedAmount?: number;
  currency?: string;
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
 * Distribution Preview Item
 */
export interface DistributionPreviewItem {
  participantId: string;
  participantName: string;
  participantType: ParticipantType;
  assignedAmount: number;
  percentage: number;
  calculatedQuantity: number;
}

/**
 * Distribution Preview Response
 */
export interface DistributionPreviewResponse {
  productId: string;
  productName: string;
  totalQuantity: number;
  distributionType: DistributionType;
  preview: DistributionPreviewItem[];
}

/**
 * Distribution Result Detail
 */
export interface DistributionResultDetail {
  participantId: string;
  participantName: string;
  quantity: number;
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
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
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
  [DistributionType.INTERNAL_ONLY]: 'Solo Sedes Internas',
  [DistributionType.EXTERNAL_ONLY]: 'Solo Empresas Externas',
  [DistributionType.CUSTOM]: 'Distribución Personalizada',
};

/**
 * Product Status Labels for UI
 */
export const ProductStatusLabels: Record<ProductStatus, string> = {
  [ProductStatus.PENDING]: 'Pendiente',
  [ProductStatus.PARTIALLY_DISTRIBUTED]: 'Parcialmente Distribuido',
  [ProductStatus.DISTRIBUTED]: 'Distribuido',
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
  [CampaignStatus.CLOSED]: '#6366F1',
  [CampaignStatus.CANCELLED]: '#EF4444',
};

/**
 * Product Status Colors for UI
 */
export const ProductStatusColors: Record<ProductStatus, string> = {
  [ProductStatus.PENDING]: '#F59E0B', // Orange - waiting for distribution
  [ProductStatus.PARTIALLY_DISTRIBUTED]: '#3B82F6', // Blue - in progress
  [ProductStatus.DISTRIBUTED]: '#10B981', // Green - completed
};

/**
 * Distribution Type Descriptions for UI
 */
export const DistributionTypeDescriptions: Record<DistributionType, string> = {
  [DistributionType.ALL]: 'El producto se distribuirá proporcionalmente entre todos los participantes (empresas y sedes) según sus montos asignados.',
  [DistributionType.INTERNAL_ONLY]: 'El producto se distribuirá solo entre sedes internas, ignorando empresas externas.',
  [DistributionType.EXTERNAL_ONLY]: 'El producto se distribuirá solo entre empresas externas, ignorando sedes internas.',
  [DistributionType.CUSTOM]: 'Permite definir cantidades específicas manualmente para cada participante.',
};
