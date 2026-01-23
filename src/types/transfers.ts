// Transfer Types and Interfaces

// ============================================
// ENUMS
// ============================================

export enum TransferType {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
}

export enum TransferStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  IN_TRANSIT = 'IN_TRANSIT',
  RECEIVED = 'RECEIVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum DiscrepancyType {
  SHORTAGE = 'SHORTAGE',
  EXCESS = 'EXCESS',
  DAMAGE = 'DAMAGE',
  WRONG_PRODUCT = 'WRONG_PRODUCT',
}

export enum ResolutionStatus {
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  WRITTEN_OFF = 'WRITTEN_OFF',
}

export enum MovementType {
  TRANSFER_OUT = 'TRANSFER_OUT',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_INTERNAL = 'TRANSFER_INTERNAL',
  ADJUSTMENT = 'ADJUSTMENT',
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  RETURN = 'RETURN',
  TRANSFER_DISCREPANCY = 'TRANSFER_DISCREPANCY',
  INITIAL_STOCK = 'INITIAL_STOCK',
}

export enum ReceptionStatus {
  PENDING = 'PENDING',
  COMPLETE = 'COMPLETE',
  WITH_DIFFERENCES = 'WITH_DIFFERENCES',
}

export enum WarehousePurpose {
  GENERAL = 'GENERAL',
  SHORTAGES = 'SHORTAGES',
  QUARANTINE = 'QUARANTINE',
  RETURNS = 'RETURNS',
  TRANSIT = 'TRANSIT',
}

// ============================================
// TRANSFER ENTITIES
// ============================================

export interface Transfer {
  id: string;
  transferNumber: string;
  transferType: TransferType;
  status: TransferStatus;

  // Origin
  originCompanyId: string;
  originSiteId: string;
  originWarehouseId: string;
  originAreaId?: string | null;

  // Destination
  destinationCompanyId: string;
  destinationSiteId: string;
  destinationWarehouseId: string;
  destinationAreaId?: string | null;

  // Users
  requestedBy: string;
  approvedBy?: string | null;
  shippedBy?: string | null;
  receivedBy?: string | null;

  // Dates
  requestedAt: string;
  approvedAt?: string | null;
  shippedAt?: string | null;
  expectedArrivalDate?: string | null;
  receivedAt?: string | null;
  completedAt?: string | null;

  // Notes
  notes?: string | null;
  shippingNotes?: string | null;
  receptionNotes?: string | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  // Relations (populated)
  originCompany?: {
    id: string;
    name: string;
  };
  originSite?: {
    id: string;
    name: string;
    code: string;
  };
  originWarehouse?: {
    id: string;
    name: string;
    code: string;
  };
  originArea?: {
    id: string;
    name: string;
    code: string;
  } | null;
  destinationCompany?: {
    id: string;
    name: string;
  };
  destinationSite?: {
    id: string;
    name: string;
    code: string;
  };
  destinationWarehouse?: {
    id: string;
    name: string;
    code: string;
  };
  destinationArea?: {
    id: string;
    name: string;
    code: string;
  } | null;
  requestedByUser?: {
    id: string;
    name: string;
    email: string;
  };
  approvedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  shippedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  receivedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  items?: TransferItem[];
  reception?: TransferReception | null;
}

export interface TransferItem {
  id: string;
  transferId: string;
  productId: string;

  // Quantities in base units
  quantityRequested: number;
  quantityShipped?: number | null;
  quantityReceived?: number | null;
  quantityDifference?: number | null;

  // Notes
  notes?: string | null;
  damageNotes?: string | null;

  createdAt: string;
  updatedAt: string;

  // Relations (populated)
  product?: {
    id: string;
    correlativeNumber?: number;
    title: string;
    sku: string;
    barcode?: string;
  };
}

export interface TransferReception {
  id: string;
  transferId?: string;
  receptionNumber: string | null;

  receivedBy?: string;
  receivedAt?: string;

  status: ReceptionStatus;
  hasDifferences?: boolean;

  totalItemsExpected: number;
  totalItemsReceived: number;

  notes?: string | null;
  qualityCheckNotes?: string | null;

  createdAt?: string;
  updatedAt?: string;

  // Relations (populated)
  receivedByUser?: {
    id: string;
    name: string;
    email: string;
  };
  transfer?: Transfer;
  discrepancies?: TransferDiscrepancy[];
}

export interface TransferDiscrepancy {
  id: string;
  transferId: string;
  receptionId: string;
  transferItemId: string;
  productId: string;

  discrepancyType: DiscrepancyType;

  quantityExpected: number;
  quantityReceived: number;
  quantityDifference: number;

  resolutionStatus: ResolutionStatus;
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;

  shortageWarehouseId?: string | null;

  createdAt: string;
  updatedAt: string;

  // Relations (populated)
  product?: {
    id: string;
    correlativeNumber?: number;
    title: string;
    sku: string;
  };
  transferItem?: TransferItem;
  resolvedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  shortageWarehouse?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface StockMovement {
  id: string;

  // Product and location
  productId: string;
  warehouseId: string;
  areaId?: string | null;

  // Movement type
  movementType: MovementType;

  // Quantity (positive = in, negative = out)
  quantity: number;

  // Stock before and after
  stockBefore: number;
  stockAfter: number;

  // Reference to origin document
  referenceType?: string | null;
  referenceId?: string | null;

  // Related warehouse (for transfers)
  relatedWarehouseId?: string | null;
  relatedAreaId?: string | null;

  // User who performed the action
  performedBy: string;

  // Notes
  notes?: string | null;

  // Metadata
  createdAt: string;

  // Relations (populated)
  product?: {
    id: string;
    correlativeNumber?: number;
    title: string;
    sku: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  area?: {
    id: string;
    name: string;
    code: string;
  } | null;
  relatedWarehouse?: {
    id: string;
    name: string;
    code: string;
  } | null;
  performedByUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TransferStatusHistory {
  id: string;
  transferId: string;

  fromStatus?: TransferStatus | null;
  toStatus: TransferStatus;

  changedBy: string;

  reason?: string | null;
  notes?: string | null;

  createdAt: string;

  // Relations (populated)
  changedByUser?: {
    id: string;
    name: string;
    email: string;
  };
}

// ============================================
// REQUEST/RESPONSE DTOs
// ============================================

// Create Internal Transfer
export interface CreateInternalTransferDto {
  originWarehouseId: string;
  originAreaId?: string | null;
  destinationWarehouseId: string;
  destinationAreaId?: string | null;
  requestedBy: string; // User ID who requested the transfer (required)
  items: {
    productId: string;
    quantity: number;
    notes?: string;
  }[];
  notes?: string;
}

// Create External Transfer
export interface CreateExternalTransferDto {
  originWarehouseId: string;
  originAreaId?: string | null;
  destinationWarehouseId: string;
  destinationAreaId?: string | null;
  requestedBy: string; // User ID who requested the transfer (required)
  expectedArrivalDate?: string;
  items: {
    productId: string;
    quantity: number;
    notes?: string;
  }[];
  notes?: string;
}

// Ship Transfer
export interface ShipTransferDto {
  items: {
    transferItemId: string;
    quantityShipped: number;
  }[];
  shippingNotes?: string;
}

// Validate Items
export interface ValidateItemsDto {
  receptionId: string;
  items: {
    transferItemId: string;
    quantityReceived: number;
    notes?: string;
    damageNotes?: string;
  }[];
}

// Complete Reception
export interface CompleteReceptionDto {
  receptionId: string;
  qualityCheckNotes?: string;
}

// Cancel Transfer
export interface CancelTransferDto {
  reason: string;
}

// Resolve Discrepancy
export interface ResolveDiscrepancyDto {
  resolutionStatus: ResolutionStatus;
  resolutionNotes: string;
}

// List Transfers Filters
export interface TransferFilters {
  type?: TransferType;
  status?: TransferStatus;
  originSiteId?: string;
  destinationSiteId?: string;
  currentSiteId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// List Receptions Filters
export interface ReceptionFilters {
  siteId?: string;
  warehouseId?: string;
  currentSiteId?: string;
  status?: ReceptionStatus;
  page?: number;
  limit?: number;
}

// List Discrepancies Filters
export interface DiscrepancyFilters {
  transferId?: string;
  type?: DiscrepancyType;
  status?: ResolutionStatus;
  page?: number;
  limit?: number;
}

// Stock Movements Filters
export interface StockMovementFilters {
  productId?: string;
  warehouseId?: string;
  movementType?: MovementType;
  dateFrom?: string;
  dateTo?: string;
  performedBy?: string;
  page?: number;
  limit?: number;
}

// Response interfaces
export interface TransferListResponse {
  data: Transfer[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ReceptionListResponse {
  data: TransferReception[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DiscrepancyListResponse {
  data: TransferDiscrepancy[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface StockMovementListResponse {
  data: StockMovement[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Dashboard Response
export interface TransferDashboard {
  totalTransfers: number;
  byType: {
    internal: number;
    external: number;
  };
  byStatus: {
    draft: number;
    approved: number;
    inTransit: number;
    received: number;
    completed: number;
    cancelled: number;
  };
  pendingReceptions: number;
  activeDiscrepancies: number;
}

// Discrepancies Report
export interface DiscrepanciesReport {
  totalDiscrepancies: number;
  byType: {
    shortage: number;
    excess: number;
    damage: number;
    wrongProduct: number;
  };
  totalValueLost: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export const getTransferStatusLabel = (status: TransferStatus): string => {
  const labels: Record<TransferStatus, string> = {
    [TransferStatus.DRAFT]: 'Borrador',
    [TransferStatus.APPROVED]: 'Aprobado',
    [TransferStatus.IN_TRANSIT]: 'En Tránsito',
    [TransferStatus.RECEIVED]: 'Recibido',
    [TransferStatus.COMPLETED]: 'Completado',
    [TransferStatus.CANCELLED]: 'Cancelado',
  };
  return labels[status] || status;
};

export const getTransferStatusColor = (status: TransferStatus): string => {
  const colors: Record<TransferStatus, string> = {
    [TransferStatus.DRAFT]: '#94A3B8',
    [TransferStatus.APPROVED]: '#3B82F6',
    [TransferStatus.IN_TRANSIT]: '#F59E0B',
    [TransferStatus.RECEIVED]: '#8B5CF6',
    [TransferStatus.COMPLETED]: '#10B981',
    [TransferStatus.CANCELLED]: '#EF4444',
  };
  return colors[status] || '#94A3B8';
};

export const getTransferTypeLabel = (type: TransferType): string => {
  const labels: Record<TransferType, string> = {
    [TransferType.INTERNAL]: 'Interno',
    [TransferType.EXTERNAL]: 'Externo',
  };
  return labels[type] || type;
};

export const getDiscrepancyTypeLabel = (type: DiscrepancyType): string => {
  const labels: Record<DiscrepancyType, string> = {
    [DiscrepancyType.SHORTAGE]: 'Faltante',
    [DiscrepancyType.EXCESS]: 'Exceso',
    [DiscrepancyType.DAMAGE]: 'Daño',
    [DiscrepancyType.WRONG_PRODUCT]: 'Producto Incorrecto',
  };
  return labels[type] || type;
};

export const getResolutionStatusLabel = (status: ResolutionStatus): string => {
  const labels: Record<ResolutionStatus, string> = {
    [ResolutionStatus.PENDING]: 'Pendiente',
    [ResolutionStatus.RESOLVED]: 'Resuelto',
    [ResolutionStatus.WRITTEN_OFF]: 'Dado de Baja',
  };
  return labels[status] || status;
};

export const getReceptionStatusLabel = (status: ReceptionStatus): string => {
  const labels: Record<ReceptionStatus, string> = {
    [ReceptionStatus.PENDING]: 'Pendiente',
    [ReceptionStatus.COMPLETE]: 'Completo',
    [ReceptionStatus.WITH_DIFFERENCES]: 'Con Diferencias',
  };
  return labels[status] || status;
};
