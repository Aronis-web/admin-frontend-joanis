/**
 * Smart Purchase (Compra Inteligente) - Types
 *
 * Módulo de reabastecimiento inteligente: analiza proveedores, agrupa por política,
 * consolida productos duplicados en familias y genera órdenes de compra sugeridas
 * por tienda basadas en venta real y stock.
 *
 * Backend: svc-admin · Schema app · Prefijo: /smart-purchase
 */

// ============================================
// Enums / literales
// ============================================

export type SmartPurchaseOrderStatus = 'DRAFT' | 'APPROVED' | 'SENT' | 'CANCELLED';

export type FamilyStatus = 'ACTIVE' | 'BLOCKED' | 'EXCLUDED';

export type FamilySource = 'AUTO' | 'MANUAL';

export type FamilyMemberSource = 'AUTO' | 'MANUAL';

export type SupplierViability = 'IDEAL' | 'VIABLE' | 'CONDICIONADO' | 'NO_RECOMENDADO';

export type OrderExportFormat = 'xlsx' | 'pdf';

// ============================================
// Paginación
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

// ============================================
// Análisis de proveedores
// ============================================

export interface SupplierAnalysisRow {
  supplierId: string;
  supplierName: string;
  ruc: string | null;
  purchases60d: number;
  purchases180d: number;
  avgDaysBetweenPurchases: number | null;
  distinctProducts: number;
  activeProductsPct: number;
  productsWithSalesPct: number;
  coveragePct: number;
  duplicateFamilyRate: number;
  adjustmentRatio: number;
  spendCents60d: string; // decimal como string
  salesUnits90d: number;
  viability: SupplierViability;
  recommendedCoverageDays: number;
  analyzedAt: string;
}

export interface SupplierAnalysisSnapshot extends SupplierAnalysisRow {
  id: string;
}

export interface SupplierAnalysisDetail {
  supplier: SupplierAnalysisRow;
  history: SupplierAnalysisSnapshot[];
}

export interface GetSupplierAnalysisParams {
  viability?: SupplierViability;
}

export interface RunAnalysisResponse {
  analyzed: number;
}

// ============================================
// Grupos de compra
// ============================================

export interface SmartPurchaseGroup {
  id: string;
  name: string;
  coverageDays: number;
  leadTimeDays: number;
  safetyDays: number;
  analysisWindowDays: number;
  notes: string | null;
  isEnabled: boolean;
  supplierCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SmartPurchaseGroupSupplier {
  supplierId: string;
  supplierName: string;
  ruc: string | null;
  addedAt: string;
}

export interface SmartPurchaseGroupWithSuppliers extends SmartPurchaseGroup {
  suppliers: SmartPurchaseGroupSupplier[];
}

export interface CreateGroupDto {
  name: string;
  coverageDays?: number;
  leadTimeDays?: number;
  safetyDays?: number;
  analysisWindowDays?: number;
  notes?: string;
  supplierIds?: string[];
}

export interface UpdateGroupDto {
  name?: string;
  isEnabled?: boolean;
  coverageDays?: number;
  leadTimeDays?: number;
  safetyDays?: number;
  analysisWindowDays?: number;
  notes?: string;
}

export interface AddSuppliersDto {
  supplierIds: string[];
}

// ============================================
// Familias de productos
// ============================================

export interface ProductFamily {
  id: string;
  groupId: string;
  normalizedSku: string;
  title: string;
  canonicalProductId: string | null;
  status: FamilyStatus;
  source: FamilySource;
  score: number;
  requiredDiscountPct: number | null;
  blockedReason: string | null;
  memberCount: number;
  updatedAt: string;
}

export interface FamilyMember {
  familyId: string;
  productId: string;
  sku: string | null;
  title: string;
  isCanonical: boolean;
  source: FamilyMemberSource;
  photoPath: string | null;
  createdAt: string;
}

export interface ProductFamilyWithMembers extends ProductFamily {
  members: FamilyMember[];
}

export interface QueryFamiliesDto {
  status?: FamilyStatus;
  minScore?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UpdateFamilyDto {
  canonicalProductId?: string;
  status?: FamilyStatus;
  title?: string;
}

export interface BlockFamilyDto {
  requiredDiscountPct: number;
  reason?: string;
}

export interface MoveMemberDto {
  productId: string;
  isCanonical?: boolean;
}

export interface ProductStatusRow {
  productId: string;
  familyId: string | null;
  status: FamilyStatus | null;
  requiredDiscountPct: number | null;
  blockedReason: string | null;
}

export interface ProductStatusQuery {
  productIds: string[];
}

// ============================================
// Órdenes sugeridas
// ============================================

export interface SmartPurchaseOrderItem {
  id: string;
  orderId: string;
  familyId: string;
  productId: string;
  sku: string | null;
  title: string;
  supplierId: string;
  avgDailySales: number;
  sales30d: number;
  sales90d: number;
  stockSiteUnits: number;
  stockCentralUnits: number;
  inTransitUnits: number;
  targetUnits: number;
  suggestedUnits: number;
  presentationId: string | null;
  factorToBase: number;
  approxPresentations: number;
  finalPresentations: number;
  finalUnits: number;
  unitCostCents: string; // decimal como string
  photoPath: string | null;
  score: number;
  isManualOverride: boolean;
  excluded: boolean;
  notes: string | null;
}

export interface SmartPurchaseOrder {
  id: string;
  code: string;
  groupId: string;
  siteId: string;
  status: SmartPurchaseOrderStatus;
  coverageDays: number;
  leadTimeDays: number;
  safetyDays: number;
  windowDays: number;
  generatedAt: string;
  generatedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  totalItems: number;
  totalUnits: number;
  totalCostCents: string;
  notes: string | null;
}

export interface SmartPurchaseOrderWithItems extends SmartPurchaseOrder {
  items: SmartPurchaseOrderItem[];
}

export interface GenerateOrdersDto {
  groupId: string;
  siteIds?: string[];
  coverageDays?: number;
  leadTimeDays?: number;
  safetyDays?: number;
}

export interface QueryOrdersDto {
  groupId?: string;
  siteId?: string;
  status?: SmartPurchaseOrderStatus;
  page?: number;
  limit?: number;
}

export interface UpdateOrderItemDto {
  presentationId?: string;
  finalPresentations?: number;
  excluded?: boolean;
  notes?: string;
}
