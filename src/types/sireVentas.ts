/**
 * SIRE Ventas (RVIE) - Types
 *
 * Registro de Ventas e Ingresos Electrónico de SUNAT.
 * Base path svc-admin: `/sire-ventas`.
 */

// ============================================
// Enums / literales
// ============================================

export type SireVentasRunStatus = 'running' | 'ok' | 'partial' | 'error';

export type SireVentasRunTrigger = 'manual' | 'cron' | 'web-fallback';

export type SireVentasConciliation = 'all' | 'linked' | 'unlinked';

export type SireVentasInvoiceSortBy =
  | 'fechaEmision'
  | 'importeTotal'
  | 'razonSocialCliente'
  | 'perTributario';

export type SireVentasSortDir = 'ASC' | 'DESC';

export type SireVentasAttachmentKind = 'photo' | 'pdf' | 'xml' | 'cdr' | 'excel' | 'other';

// ============================================
// Invoices (RVIE cabecera)
// ============================================

export interface SireVentasInvoiceListItem {
  id: string;
  perTributario: string;
  fechaEmision: string; // YYYY-MM-DD
  tipoCpe: string; // Tabla 10 SUNAT: 01 factura, 03 boleta, 07 NC, 08 ND...
  serie: string;
  numero: string;
  /** Para resúmenes de boletas: rango final. */
  numeroFinal?: string | null;
  tipoDocCliente?: string | null;
  numDocCliente: string;
  razonSocialCliente: string;
  baseImponible: string; // Decimal como string
  igv: string;
  importeTotal: string;
  moneda: string; // 'PEN' | 'USD' | ...
  estado: string; // 1 anotado, 2 anulado...
  linksCount: number;
  allocatedTotal: string;
  attachmentsCount: number;
  conciliation: 'linked' | 'partial' | 'unlinked';
}

export interface SireVentasInvoiceSaleRef {
  id: string;
  documentNumber: string;
  customerName?: string | null;
}

export interface SireVentasInvoiceLink {
  id: string;
  saleDocumentId: string;
  allocatedAmount: string;
  notes: string | null;
  saleDocument?: SireVentasInvoiceSaleRef;
}

export interface SireVentasInvoiceAttachment {
  id: string;
  kind: SireVentasAttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: string;
  url: string;
  createdAt: string;
  notes?: string | null;
}

export interface SireVentasInvoiceDetail extends SireVentasInvoiceListItem {
  links: SireVentasInvoiceLink[];
  attachments: SireVentasInvoiceAttachment[];
}

export interface SireVentasInvoicesListResponse {
  items: SireVentasInvoiceListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetSireVentasInvoicesParams {
  search?: string;
  periodo?: string; // AAAAMM
  periodoFrom?: string;
  periodoTo?: string;
  numDocCliente?: string;
  tipoCpe?: string;
  estado?: string;
  fechaFrom?: string; // YYYY-MM-DD
  fechaTo?: string;
  montoMin?: number;
  montoMax?: number;
  conciliation?: SireVentasConciliation;
  hasAttachments?: boolean;
  sortBy?: SireVentasInvoiceSortBy;
  sortDir?: SireVentasSortDir;
  limit?: number;
  offset?: number;
}

// ============================================
// Runs (auditoría)
// ============================================

export interface SireVentasRun {
  id: string;
  status: SireVentasRunStatus;
  perTributario: string;
  trigger?: SireVentasRunTrigger;
  codLibro?: string | null;
  numTicket?: string | null;
  totalRows?: number;
  newRows?: number;
  dupRows?: number;
  errorRows?: number;
  fileName?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  errorMsg?: string | null;
}

export interface SireVentasActiveRunResponse {
  active: SireVentasRun | null;
}

export interface SireVentasRunsListResponse {
  items: SireVentasRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface SireVentasSyncBody {
  periodo?: string; // AAAAMM (opcional)
}

export interface SireVentasSyncRangeBody {
  perIni: string; // AAAAMM
  perFin: string; // AAAAMM
}

export interface SireVentasImportResponse extends SireVentasRun {
  fileName: string;
}

// ============================================
// Conciliación (links) + adjuntos
// ============================================

export interface CreateSireVentasLinkDto {
  saleDocumentId: string;
  allocatedAmount?: string;
  notes?: string;
}

export interface SireVentasSaleSuggestion {
  id: string;
  documentNumber: string;
  customerName?: string | null;
}

export interface SireVentasSaleSuggestionsResponse {
  items: SireVentasSaleSuggestion[];
  total: number;
}

// ============================================
// Summary (dashboard) endpoints
// ============================================

/**
 * Filtros comunes de /sire-ventas/invoices/summary y /summary/by-client.
 * Todos son opcionales.
 */
export interface GetSireVentasInvoicesSummaryParams {
  fechaFrom?: string; // YYYY-MM-DD
  fechaTo?: string;
  periodoFrom?: string; // AAAAMM
  periodoTo?: string;
  numDocCliente?: string;
  tipoCpe?: string;
  estado?: string;
  moneda?: string;
  conciliation?: SireVentasConciliation;
}

/**
 * Bloque de totales de una moneda (PEN o USD).
 * Los importes vienen como string con 2 decimales.
 */
export interface SireVentasSummaryTotalsAmount {
  count: number;
  valorExportacion: string;
  baseImponible: string;
  igv: string;
  exonerado: string;
  inafecto: string;
  isc: string;
  otros: string;
  importeTotal: string;
}

/**
 * Totales del período, separados por moneda.
 * Siempre presentes ambas monedas (PEN, USD).
 */
export interface SireVentasSummaryTotals {
  PEN: SireVentasSummaryTotalsAmount;
  USD: SireVentasSummaryTotalsAmount;
}

export interface SireVentasSummaryByCurrency {
  moneda: string;
  count: number;
  valorExportacion?: string;
  baseImponible: string;
  igv: string;
  exonerado?: string;
  inafecto?: string;
  isc?: string;
  otros?: string;
  importeTotal: string;
}

/**
 * Fila de desglose por período tributario y moneda.
 */
export interface SireVentasSummaryByPeriodo {
  perTributario: string;
  moneda: string;
  count: number;
  baseImponible: string;
  igv: string;
  importeTotal: string;
}

export interface SireVentasSummaryByTipoCpe {
  tipoCpe: string;
  count: number;
  importeTotal: string;
}

export interface SireVentasInvoicesSummaryResponse {
  filters: Record<string, string | number | boolean | undefined>;
  totals: SireVentasSummaryTotals;
  notasCredito: SireVentasSummaryTotals;
  byCurrency: SireVentasSummaryByCurrency[];
  byPeriodo: SireVentasSummaryByPeriodo[];
  byTipoCpe: SireVentasSummaryByTipoCpe[];
}

export type SireVentasClientSortBy = 'importeTotal' | 'count' | 'razonSocialCliente';

export interface GetSireVentasInvoicesSummaryByClientParams extends GetSireVentasInvoicesSummaryParams {
  sortBy?: SireVentasClientSortBy;
  sortDir?: SireVentasSortDir;
  limit?: number;
  offset?: number;
}

/**
 * Item de resumen por cliente (num. doc).
 * `count` a nivel raíz es el total de comprobantes del cliente sumando ambas monedas.
 * Los totales por moneda vienen en los bloques `PEN` y `USD`.
 */
export interface SireVentasClientSummaryItem {
  numDocCliente: string;
  razonSocialCliente: string;
  count: number;
  PEN: SireVentasSummaryTotalsAmount;
  USD: SireVentasSummaryTotalsAmount;
}

export interface SireVentasInvoicesSummaryByClientResponse {
  items: SireVentasClientSummaryItem[];
  total: number;
  limit: number;
  offset: number;
}
