/**
 * Sales Types
 * Types for the Sales module (B2C and B2B)
 */

import { Customer } from './customers';
import { Product } from '@/services/api/products';

/**
 * Sale Type Enum
 */
export enum SaleType {
  B2C = 'B2C', // Venta a cliente (persona natural)
  B2B = 'B2B', // Venta a empresa
}

/**
 * Sale Status Enum
 */
export enum SaleStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

/**
 * Processing Status Enum
 */
export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Document Type Enum
 */
export enum DocumentType {
  FACTURA = 'FACTURA',
  BOLETA = 'BOLETA',
  NOTA_CREDITO = 'NOTA_CREDITO',
  NOTA_DEBITO = 'NOTA_DEBITO',
  GUIA_REMISION = 'GUIA_REMISION',
}

/**
 * Payment Status Enum
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

/**
 * Sale Item Interface
 */
export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;

  // Product snapshot
  productSnapshot: {
    id: string;
    sku: string;
    title: string;
    description: string;
    barcode: string;
    imageUrl?: string;
  };

  createdAt: string;
  updatedAt: string;
}

/**
 * Sale Document Interface
 */
export interface SaleDocument {
  id: string;
  saleId: string;
  documentType: DocumentType;
  seriesNumber: string;
  correlativeNumber: number;
  fullNumber: string;
  issueDate: string;
  xmlUrl?: string;
  pdfUrl?: string;
  cdrUrl?: string;
  sunatStatus?: string;
  sunatMessage?: string;
  sentToSunatAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sale Payment Interface
 */
export interface SalePayment {
  id: string;
  saleId: string;
  paymentMethodId: string;
  amountCents: number;
  referenceNumber?: string;
  notes?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;

  // Payment method info
  paymentMethod?: {
    id: string;
    name: string;
    code: string;
  };
}

/**
 * Stock Reservation Interface
 */
export interface StockReservation {
  id: string;
  saleId?: string;
  productId: string;
  warehouseId: string;
  areaId?: string;
  quantityBase: number;
  expiresAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sale Interface
 */
export interface Sale {
  id: string;
  code: string;
  saleType: SaleType;
  status: SaleStatus;
  processingStatus: ProcessingStatus;

  // Customer/Company info
  customerId?: string;
  companyId?: string;

  // Customer snapshot (for B2C)
  customerSnapshot?: {
    id: string;
    fullName: string;
    documentType: string;
    documentNumber: string;
    email?: string;
    phone?: string;
    mobile?: string;
  };

  // Company snapshot (for B2B)
  companySnapshot?: {
    id: string;
    razonSocial: string;
    ruc: string;
    email?: string;
    phone?: string;
  };

  // Location info
  siteId: string;
  warehouseId: string;

  // Sale details
  saleDate: string;
  itemCount: number;
  totalQuantity: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;

  // Payment info
  paymentStatus: PaymentStatus;
  paidAmountCents: number;
  balanceCents: number;

  // Processing flags
  isStockValidated: boolean;
  isStockUpdated: boolean;
  isDocumentGenerated: boolean;
  isSentToSunat: boolean;
  isMetricsUpdated: boolean;

  stockValidatedAt?: string;
  stockUpdatedAt?: string;

  retryCount: number;
  lastError?: string;

  notes?: string;

  createdAt: string;
  updatedAt: string;
  deletedAt?: string;

  // Relations
  items?: SaleItem[];
  documents?: SaleDocument[];
  payments?: SalePayment[];
  reservations?: StockReservation[];
}

/**
 * Create Sale Item Request
 */
export interface CreateSaleItemRequest {
  productId: string;
  quantity: number;
  unitPriceCents: number;
  discountCents?: number;
}

/**
 * Create Sale Request
 */
export interface CreateSaleRequest {
  saleType: SaleType;
  customerId?: string;
  companyId?: string;
  siteId: string;
  warehouseId: string;
  items: CreateSaleItemRequest[];
  paymentMethodId?: string;
  notes?: string;
}

/**
 * Update Sale Request
 */
export interface UpdateSaleRequest {
  status?: SaleStatus;
  notes?: string;
}

/**
 * Create Sale Payment Request
 */
export interface CreateSalePaymentRequest {
  paymentMethodId: string;
  amountCents: number;
  referenceNumber?: string;
  notes?: string;
}

/**
 * Query Sales Parameters
 */
export interface QuerySalesParams {
  page?: number;
  limit?: number;
  search?: string;
  saleType?: SaleType;
  status?: SaleStatus;
  processingStatus?: ProcessingStatus;
  paymentStatus?: PaymentStatus;
  customerId?: string;
  companyId?: string;
  siteId?: string;
  warehouseId?: string;
  startDate?: string;
  endDate?: string;
  includeItems?: boolean;
  includeDocuments?: boolean;
  includePayments?: boolean;
}

/**
 * Sales Response
 */
export interface SalesResponse {
  data: Sale[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Processing Status Response
 */
export interface ProcessingStatusResponse {
  saleId: string;
  code: string;
  status: SaleStatus;
  processingStatus: ProcessingStatus;
  isStockValidated: boolean;
  isStockUpdated: boolean;
  isDocumentGenerated: boolean;
  isSentToSunat: boolean;
  isMetricsUpdated: boolean;
  stockValidatedAt?: string;
  stockUpdatedAt?: string;
  retryCount: number;
  lastError?: string;
}

/**
 * Sale Type Labels
 */
export const SaleTypeLabels: Record<SaleType, string> = {
  [SaleType.B2C]: 'Cliente',
  [SaleType.B2B]: 'Empresa',
};

/**
 * Sale Status Labels
 */
export const SaleStatusLabels: Record<SaleStatus, string> = {
  [SaleStatus.DRAFT]: 'Borrador',
  [SaleStatus.CONFIRMED]: 'Confirmada',
  [SaleStatus.CANCELLED]: 'Cancelada',
  [SaleStatus.COMPLETED]: 'Completada',
};

/**
 * Processing Status Labels
 */
export const ProcessingStatusLabels: Record<ProcessingStatus, string> = {
  [ProcessingStatus.PENDING]: 'Pendiente',
  [ProcessingStatus.PROCESSING]: 'Procesando',
  [ProcessingStatus.COMPLETED]: 'Completado',
  [ProcessingStatus.FAILED]: 'Fallido',
};

/**
 * Payment Status Labels
 */
export const PaymentStatusLabels: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'Pendiente',
  [PaymentStatus.PARTIAL]: 'Parcial',
  [PaymentStatus.PAID]: 'Pagado',
  [PaymentStatus.OVERDUE]: 'Vencido',
};

/**
 * Document Type Labels
 */
export const DocumentTypeLabels: Record<DocumentType, string> = {
  [DocumentType.FACTURA]: 'Factura',
  [DocumentType.BOLETA]: 'Boleta',
  [DocumentType.NOTA_CREDITO]: 'Nota de Crédito',
  [DocumentType.NOTA_DEBITO]: 'Nota de Débito',
  [DocumentType.GUIA_REMISION]: 'Guía de Remisión',
};
