/**
 * Types for Consolidated Transfer Reports System
 * Sistema de Reportes de Traslados Consolidados
 */

// ============================================
// Enums
// ============================================

export enum ReportStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  CLOSED = 'CLOSED',
}

export enum DiscrepancyStatus {
  PENDING = 'PENDING',
  EXPLAINED = 'EXPLAINED',
  RESOLVED = 'RESOLVED',
}

export enum NoteType {
  DAMAGE = 'DAMAGE',
  SHORTAGE = 'SHORTAGE',
  QUALITY_ISSUE = 'QUALITY_ISSUE',
  EXPIRED = 'EXPIRED',
  THEFT = 'THEFT',
  LOSS = 'LOSS',
  OTHER = 'OTHER',
}

export enum NoteSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum NoteStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

// ============================================
// Labels
// ============================================

export const ReportStatusLabels: Record<ReportStatus, string> = {
  [ReportStatus.OPEN]: 'Abierto',
  [ReportStatus.IN_REVIEW]: 'En Revisión',
  [ReportStatus.CLOSED]: 'Cerrado',
};

export const DiscrepancyStatusLabels: Record<DiscrepancyStatus, string> = {
  [DiscrepancyStatus.PENDING]: 'Pendiente',
  [DiscrepancyStatus.EXPLAINED]: 'Explicado',
  [DiscrepancyStatus.RESOLVED]: 'Resuelto',
};

export const NoteTypeLabels: Record<NoteType, string> = {
  [NoteType.DAMAGE]: 'Daño físico',
  [NoteType.SHORTAGE]: 'Faltante',
  [NoteType.QUALITY_ISSUE]: 'Problema de calidad',
  [NoteType.EXPIRED]: 'Vencido',
  [NoteType.THEFT]: 'Robo',
  [NoteType.LOSS]: 'Pérdida',
  [NoteType.OTHER]: 'Otro',
};

export const NoteSeverityLabels: Record<NoteSeverity, string> = {
  [NoteSeverity.LOW]: 'Baja',
  [NoteSeverity.MEDIUM]: 'Media',
  [NoteSeverity.HIGH]: 'Alta',
  [NoteSeverity.CRITICAL]: 'Crítica',
};

// ============================================
// Colors
// ============================================

export const ReportStatusColors: Record<ReportStatus, string> = {
  [ReportStatus.OPEN]: '#F59E0B',
  [ReportStatus.IN_REVIEW]: '#3B82F6',
  [ReportStatus.CLOSED]: '#10B981',
};

export const DiscrepancyStatusColors: Record<DiscrepancyStatus, string> = {
  [DiscrepancyStatus.PENDING]: '#F59E0B',
  [DiscrepancyStatus.EXPLAINED]: '#3B82F6',
  [DiscrepancyStatus.RESOLVED]: '#10B981',
};

export const NoteSeverityColors: Record<NoteSeverity, string> = {
  [NoteSeverity.LOW]: '#10B981',
  [NoteSeverity.MEDIUM]: '#F59E0B',
  [NoteSeverity.HIGH]: '#EF4444',
  [NoteSeverity.CRITICAL]: '#DC2626',
};

// ============================================
// Interfaces
// ============================================

/**
 * Discrepancy Note
 */
export interface DiscrepancyNote {
  id: string;
  discrepancyId: string;
  noteType: NoteType;
  title: string;
  description: string;
  photoUrls?: string[];
  documentUrls?: string[];
  severity: NoteSeverity;
  requiresAction: boolean;
  actionTaken?: string;
  actionTakenAt?: string;
  status: NoteStatus;
  createdAt: string;
  createdBy?: string;
  createdByName: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  closedAt?: string;
  closedBy?: string;
  closedByName?: string;
}

/**
 * Transfer Report Discrepancy
 */
export interface TransferReportDiscrepancy {
  id: string;
  reportId: string;
  repartoProductoId: string;
  productId: string;
  repartoId: string;
  productName: string;
  productSku: string;
  repartoCode: string;
  repartoName: string;
  quantityAssigned: number;
  quantityValidated: number;
  quantityDifference: number;
  validatedByName?: string;
  validatedAt?: string;
  validationNotes?: string;
  validationPhotoUrl?: string;
  validationSignatureUrl?: string;
  status: DiscrepancyStatus;
  notes?: DiscrepancyNote[];
  notesCount?: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Consolidated Transfer Report
 */
export interface ConsolidatedTransferReport {
  id: string;
  consolidatedTransferId: string;
  campaignId: string;
  campaignParticipantId: string;
  totalProductsWithDiscrepancies: number;
  totalQuantityAssigned: number;
  totalQuantityValidated: number;
  totalQuantityDifference: number;
  status: ReportStatus;
  discrepancies?: TransferReportDiscrepancy[];
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  closedAt?: string;
  closedBy?: string;
}

/**
 * Consolidated Transfer Summary
 */
export interface ConsolidatedTransferSummary {
  totalProducts: number;
  totalRepartos: number;
  totalAssigned: number;
  totalValidated: number;
  totalTransferred: number;
  totalDifference: number;
  totalReservesReleased: number;
  productsWithDiscrepancies: number;
  discrepanciesCount: number;
}

/**
 * Consolidated Transfer Product Detail
 */
export interface ConsolidatedTransferProductDetail {
  productId: string;
  productName: string;
  productSku: string;
  repartosCount: number;
  totalAssigned: number;
  totalValidated: number;
  totalDifference: number;
  hasDifferences: boolean;
  repartos: Array<{
    repartoCode: string;
    repartoName: string;
    quantityAssigned: number;
    quantityValidated: number;
    difference: number;
    validatedBy?: string;
  }>;
}

/**
 * Transfer Info
 */
export interface TransferInfo {
  id: string;
  transferNumber: string;
  status: string;
  originWarehouse: string;
  destinationWarehouse: string;
}

/**
 * Generate Consolidated Transfer Response
 */
export interface GenerateConsolidatedTransferResponse {
  success: boolean;
  transfer: TransferInfo;
  summary: ConsolidatedTransferSummary;
  products: ConsolidatedTransferProductDetail[];
  report?: ConsolidatedTransferReport;
}

// ============================================
// Request DTOs
// ============================================

/**
 * Generate Consolidated Transfer Request
 */
export interface GenerateConsolidatedTransferRequest {
  notes?: string;
}

/**
 * Create Discrepancy Note Request
 */
export interface CreateDiscrepancyNoteRequest {
  noteType: NoteType;
  title: string;
  description: string;
  photoUrls?: string[];
  documentUrls?: string[];
  severity: NoteSeverity;
  requiresAction: boolean;
  createdByName: string;
}

/**
 * Update Discrepancy Note Request
 */
export interface UpdateDiscrepancyNoteRequest {
  description?: string;
  actionTaken?: string;
  requiresAction?: boolean;
  updatedByName: string;
}

/**
 * Close Discrepancy Note Request
 */
export interface CloseDiscrepancyNoteRequest {
  closedByName: string;
}

/**
 * Update Discrepancy Status Request
 */
export interface UpdateDiscrepancyStatusRequest {
  status: DiscrepancyStatus;
}

/**
 * Close Report Request
 */
export interface CloseReportRequest {
  closedByName: string;
}

// ============================================
// Response DTOs
// ============================================

/**
 * Report Stats Response
 */
export interface ReportStatsResponse {
  totalReports: number;
  openReports: number;
  inReviewReports: number;
  closedReports: number;
  totalDiscrepancies: number;
  pendingDiscrepancies: number;
  explainedDiscrepancies: number;
  resolvedDiscrepancies: number;
  totalQuantityDifference: number;
}
