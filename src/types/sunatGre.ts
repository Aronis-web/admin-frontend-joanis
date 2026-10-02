// Tipos del modulo GRE (Guias de Remision Electronicas).

export interface SunatGreItem {
  id: string;
  linea: number;
  codigo: string | null;
  descripcion: string | null;
  cantidad: string;
  unidad: string | null;
}

export interface SunatGre {
  id: string;
  ruc: string;
  rol: 'emitida' | 'recibida';
  tipoGre: string;
  serie: string;
  numero: string;
  rucEmisor: string;
  razonSocial: string;
  fechaEmision: string | null;
  fechaCdr: string | null;
  estado: string | null;
  modalidadTraslado: string | null;
  puntoPartida: string | null;
  puntoLlegada: string | null;
  motivo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SunatGreDetail extends SunatGre {
  items: SunatGreItem[];
}

export interface SunatGreListResponse {
  items: SunatGre[];
  total: number;
}

export interface GetSunatGreParams {
  rol?: 'emitida' | 'recibida';
  fechaDesde?: string;
  fechaHasta?: string;
  rucEmisor?: string;
  limit?: number;
  offset?: number;
}

export interface SunatGreRun {
  id: string;
  trigger: string;
  status: 'running' | 'ok' | 'partial' | 'error';
  ruc: string | null;
  rol: string | null;
  totalRows: number;
  newRows: number;
  dupRows: number;
  errorRows: number;
  fileName: string | null;
  errorMsg: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface SunatGreRunsListResponse {
  items: SunatGreRun[];
  total: number;
}
