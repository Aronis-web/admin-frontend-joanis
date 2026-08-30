/**
 * SIRE Ventas Declaradas (RVIE) - Types
 *
 * Registro DECLARADO / PRESENTADO de ventas (lo que el contribuyente ya
 * generó y declaró en un periodo), en paralelo a la Propuesta.
 * Base path svc-admin: `/sire-ventas/declared`.
 */

// ============================================
// Enums / literales
// ============================================

export type SireVentasDeclaredRunStatus = 'running' | 'ok' | 'partial' | 'error';

export type SireVentasDeclaredRunTrigger = 'manual' | 'cron' | 'web-fallback';

// ============================================
// Invoices (RVIE declarado - cabecera)
// ============================================

export interface SireVentasDeclaredInvoiceListItem {
  id: string;
  ruc: string;
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
  valorExportacion?: string | null;
  exonerado?: string | null;
  inafecto?: string | null;
  igv: string;
  importeTotal: string;
  moneda: string; // 'PEN' | 'USD' | ...
  estado: string; // 1 anotado, 2 anulado...
}

export interface SireVentasDeclaredInvoicesListResponse {
  items: SireVentasDeclaredInvoiceListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetSireVentasDeclaredInvoicesParams {
  search?: string;
  periodo?: string; // AAAAMM
  periodoFrom?: string;
  periodoTo?: string;
  numDocCliente?: string;
  tipoCpe?: string;
  estado?: string;
  fechaFrom?: string; // YYYY-MM-DD
  fechaTo?: string;
  moneda?: string;
  limit?: number; // 1-200 (default 50)
  offset?: number; // >= 0 (default 0)
}

// ============================================
// Runs (auditoría)
// ============================================

export interface SireVentasDeclaredRun {
  id: string;
  triggeredByUserId?: string | null;
  trigger?: SireVentasDeclaredRunTrigger;
  ruc?: string;
  perTributario: string;
  codLibro?: string | null; // 140000 = ventas (RVIE)
  status: SireVentasDeclaredRunStatus;
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

export interface SireVentasDeclaredActiveRunResponse {
  active: SireVentasDeclaredRun | null;
}

export interface SireVentasDeclaredRunsListResponse {
  items: SireVentasDeclaredRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface SireVentasDeclaredSyncBody {
  periodo?: string; // AAAAMM (opcional)
}

export interface SireVentasDeclaredSyncRangeBody {
  perIni: string; // AAAAMM
  perFin: string; // AAAAMM
}

export interface SireVentasDeclaredSyncRangeResponse {
  status: SireVentasDeclaredRunStatus;
  periodos: string[];
}

export interface SireVentasDeclaredSyncResponse {
  runId: string;
  status: SireVentasDeclaredRunStatus;
  periodo: string;
}

export interface SireVentasDeclaredImportResponse extends SireVentasDeclaredRun {
  fileName: string;
}

// ============================================
// Summary (dashboard) endpoints
// ============================================

export interface GetSireVentasDeclaredInvoicesSummaryParams {
  search?: string;
  periodo?: string;
  periodoFrom?: string; // AAAAMM
  periodoTo?: string;
  numDocCliente?: string;
  tipoCpe?: string;
  estado?: string;
  fechaFrom?: string; // YYYY-MM-DD
  fechaTo?: string;
  moneda?: string;
}

export interface SireVentasDeclaredSummaryByCurrency {
  moneda: string;
  count: string;
  baseImponible: string;
  igv: string;
  importeTotal: string;
}

export interface SireVentasDeclaredSummaryByPeriodo {
  perTributario: string;
  moneda: string;
  count: string;
  baseImponible: string;
  igv: string;
  importeTotal: string;
}

export interface SireVentasDeclaredSummaryByTipoCpe {
  tipoCpe: string;
  count: string;
  importeTotal: string;
}

export interface SireVentasDeclaredInvoicesSummaryResponse {
  filters: Record<string, string | number | boolean | undefined>;
  byCurrency: SireVentasDeclaredSummaryByCurrency[];
  byPeriodo: SireVentasDeclaredSummaryByPeriodo[];
  byTipoCpe: SireVentasDeclaredSummaryByTipoCpe[];
}
