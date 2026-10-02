// Tipos del modulo Honorarios (RxH, rentas de 4ta categoria recibidas).

export interface SunatHonorario {
  id: string;
  ruc: string;
  rucEmisor: string;
  tipoDocEmisor: string | null;
  nombreEmisor: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  perTributario: string;
  descripcion: string | null;
  moneda: string;
  montoBruto: string;
  retencionRenta: string;
  montoNeto: string;
  estado: string;
  createdAt: string;
  updatedAt: string;
}

export interface SunatHonorariosListResponse {
  items: SunatHonorario[];
  total: number;
}

export interface SunatHonorariosSummary {
  count: number;
  totalBruto: string;
  totalRetencion: string;
  totalNeto: string;
}

export interface GetSunatHonorariosParams {
  periodo?: string;
  rucEmisor?: string;
  limit?: number;
  offset?: number;
}

export interface SunatHonorariosRun {
  id: string;
  trigger: string;
  status: 'running' | 'ok' | 'partial' | 'error';
  ruc: string | null;
  perTributario: string | null;
  totalRows: number;
  newRows: number;
  dupRows: number;
  errorRows: number;
  fileName: string | null;
  errorMsg: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface SunatHonorariosRunsListResponse {
  items: SunatHonorariosRun[];
  total: number;
}
