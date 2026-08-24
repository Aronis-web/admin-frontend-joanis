/**
 * SIRE Compras (RCE) - Types
 *
 * Registro de Compras Electrónico de SUNAT.
 * Ver docs: /sire-compras endpoints en svc-admin.
 */

// ============================================
// Enums / literales
// ============================================

export type SireRunStatus = 'running' | 'ok' | 'partial' | 'error';

export type SireRunTrigger = 'manual' | 'cron' | 'web-fallback';

export type SireConciliation = 'all' | 'linked' | 'unlinked';

export type SireInvoiceSortBy =
  | 'fechaEmision'
  | 'importeTotal'
  | 'razonSocialProveedor'
  | 'perTributario';

export type SireSortDir = 'ASC' | 'DESC';

export type SireAttachmentKind = 'photo' | 'pdf' | 'xml' | 'cdr' | 'excel' | 'other';

// ============================================
// Invoices (RCE cabecera)
// ============================================

export interface SireInvoiceListItem {
  id: string;
  perTributario: string;
  fechaEmision: string; // YYYY-MM-DD
  tipoCpe: string; // Tabla 10 SUNAT: 01, 07, 08, ...
  serie: string;
  numero: string;
  rucProveedor: string;
  razonSocialProveedor: string;
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

export interface SireInvoicePurchaseRef {
  id: string;
  code: string;
  guideNumber?: string | null;
}

export interface SireInvoiceLink {
  id: string;
  purchaseId: string;
  allocatedAmount: string;
  notes: string | null;
  purchase?: SireInvoicePurchaseRef;
}

export interface SireInvoiceAttachment {
  id: string;
  kind: SireAttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: string;
  url: string;
  createdAt: string;
  notes?: string | null;
}

export interface SireInvoiceDetail extends SireInvoiceListItem {
  links: SireInvoiceLink[];
  attachments: SireInvoiceAttachment[];
}

export interface SireInvoicesListResponse {
  items: SireInvoiceListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetSireInvoicesParams {
  search?: string;
  periodo?: string; // AAAAMM
  periodoFrom?: string;
  periodoTo?: string;
  rucProveedor?: string;
  tipoCpe?: string;
  estado?: string;
  fechaFrom?: string; // YYYY-MM-DD
  fechaTo?: string;
  montoMin?: number;
  montoMax?: number;
  conciliation?: SireConciliation;
  hasAttachments?: boolean;
  sortBy?: SireInvoiceSortBy;
  sortDir?: SireSortDir;
  limit?: number;
  offset?: number;
}

// ============================================
// Runs (auditoría)
// ============================================

export interface SireRun {
  id: string;
  status: SireRunStatus;
  perTributario: string;
  trigger?: SireRunTrigger;
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

export interface SireActiveRunResponse {
  active: SireRun | null;
}

export interface SireRunsListResponse {
  items: SireRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface SireSyncBody {
  periodo?: string; // AAAAMM (opcional)
}

export interface SireImportResponse extends SireRun {
  fileName: string;
}

// ============================================
// Conciliación (links) + adjuntos
// ============================================

export interface CreateSireLinkDto {
  purchaseId: string;
  allocatedAmount: string;
  notes?: string;
}

export interface SirePurchaseSuggestion {
  id: string;
  code: string;
  supplier?: {
    commercialName?: string | null;
  } | null;
}

export interface SirePurchaseSuggestionsResponse {
  items: SirePurchaseSuggestion[];
  total: number;
}
