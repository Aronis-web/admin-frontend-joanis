/**
 * SIRE Compras Declaradas (RCE) - Types
 *
 * Registro DECLARADO / PRESENTADO de compras (lo que el contribuyente ya
 * generó y declaró en un periodo), en paralelo a la Propuesta.
 * Base path svc-admin: `/sire-compras/declared`.
 */

// ============================================
// Enums / literales
// ============================================

export type SireComprasDeclaredRunStatus = 'running' | 'ok' | 'partial' | 'error';

export type SireComprasDeclaredRunTrigger = 'manual' | 'cron' | 'web-fallback';

// ============================================
// Invoices (RCE declarado - cabecera)
// ============================================

export interface SireComprasDeclaredInvoiceListItem {
  id: string;
  ruc: string;
  perTributario: string;
  fechaEmision: string; // YYYY-MM-DD
  tipoCpe: string; // Tabla 10 SUNAT: 01, 07, 08, ...
  serie: string;
  numero: string;
  rucProveedor: string;
  razonSocialProveedor: string;
  baseImponible: string; // Decimal como string
  valorNoGravado?: string | null;
  igv: string;
  importeTotal: string;
  moneda: string; // 'PEN' | 'USD' | ...
  estado: string; // 1 anotado, 2 anulado...
  marcaCreditoFiscal?: string | null;
}

export interface SireComprasDeclaredInvoicesListResponse {
  items: SireComprasDeclaredInvoiceListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetSireComprasDeclaredInvoicesParams {
  search?: string;
  periodo?: string; // AAAAMM
  periodoFrom?: string;
  periodoTo?: string;
  rucProveedor?: string;
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

export interface SireComprasDeclaredRun {
  id: string;
  triggeredByUserId?: string | null;
  trigger?: SireComprasDeclaredRunTrigger;
  ruc?: string;
  perTributario: string;
  codLibro?: string | null; // 080000 = compras (RCE)
  status: SireComprasDeclaredRunStatus;
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

export interface SireComprasDeclaredActiveRunResponse {
  active: SireComprasDeclaredRun | null;
}

export interface SireComprasDeclaredRunsListResponse {
  items: SireComprasDeclaredRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface SireComprasDeclaredSyncBody {
  periodo?: string; // AAAAMM (opcional)
}

export interface SireComprasDeclaredSyncRangeBody {
  perIni: string; // AAAAMM
  perFin: string; // AAAAMM
}

export interface SireComprasDeclaredSyncRangeResponse {
  status: SireComprasDeclaredRunStatus;
  periodos: string[];
}

export interface SireComprasDeclaredSyncResponse {
  runId: string;
  status: SireComprasDeclaredRunStatus;
  periodo: string;
}

export interface SireComprasDeclaredImportResponse extends SireComprasDeclaredRun {
  fileName: string;
}

// ============================================
// Summary (dashboard) endpoints
// ============================================

export interface GetSireComprasDeclaredInvoicesSummaryParams {
  search?: string;
  periodo?: string;
  periodoFrom?: string; // AAAAMM
  periodoTo?: string;
  rucProveedor?: string;
  tipoCpe?: string;
  estado?: string;
  fechaFrom?: string; // YYYY-MM-DD
  fechaTo?: string;
  moneda?: string;
}

export interface SireComprasDeclaredSummaryByCurrency {
  moneda: string;
  count: string;
  baseImponible: string;
  igv: string;
  importeTotal: string;
}

export interface SireComprasDeclaredSummaryByPeriodo {
  perTributario: string;
  moneda: string;
  count: string;
  baseImponible: string;
  igv: string;
  importeTotal: string;
}

export interface SireComprasDeclaredSummaryByTipoCpe {
  tipoCpe: string;
  count: string;
  importeTotal: string;
}

export interface SireComprasDeclaredInvoicesSummaryResponse {
  filters: Record<string, string | number | boolean | undefined>;
  byCurrency: SireComprasDeclaredSummaryByCurrency[];
  byPeriodo: SireComprasDeclaredSummaryByPeriodo[];
  byTipoCpe: SireComprasDeclaredSummaryByTipoCpe[];
}
