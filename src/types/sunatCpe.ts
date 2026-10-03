// Tipos del modulo CPE recibidos (Comprobantes de Pago electronicos con detalle de lineas).

export interface SunatCpeItem {
  id: string;
  linea: number;
  codigo: string | null;
  descripcion: string | null;
  cantidad: string;
  unidad: string | null;
  valorUnitario: string;
  precioUnitario: string;
  descuento: string;
  valorVenta: string;
  igv: string;
  importe: string;
}

export interface SunatCpeInvoice {
  id: string;
  ruc: string;
  tipoCpe: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  moneda: string;
  tipoCambio: string | null;
  totalGravado: string;
  igv: string;
  exonerado: string;
  inafecto: string;
  isc: string;
  otros: string;
  importeTotal: string;
  estado: string;
  cdrEstado: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SunatCpeInvoiceDetail extends SunatCpeInvoice {
  items: SunatCpeItem[];
}

export interface SunatCpeListResponse {
  items: SunatCpeInvoice[];
  total: number;
}

export interface GetSunatCpeInvoicesParams {
  fechaDesde?: string;
  fechaHasta?: string;
  rucEmisor?: string;
  limit?: number;
  offset?: number;
}

export interface SunatCpeRun {
  id: string;
  trigger: string;
  status: 'running' | 'ok' | 'partial' | 'error';
  ruc: string | null;
  totalRows: number;
  newRows: number;
  dupRows: number;
  errorRows: number;
  fileName: string | null;
  errorMsg: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface SunatCpeRunsListResponse {
  items: SunatCpeRun[];
  total: number;
}

export interface SunatCpeSyncRangeRequest {
  perDesde: string; // AAAAMM
  perHasta: string; // AAAAMM
}

export interface SunatCpeSyncRangeResponse {
  runs: SunatCpeRun[];
}
