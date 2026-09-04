import { apiClient } from './client';

/**
 * SUNAT Reports API Service
 *
 * Genera reportes consolidados (Excel) de los registros SIRE:
 * compras/ventas mapeadas (propuesta RCE/RVIE) y compras/ventas declaradas.
 *
 * Endpoint: `GET /sunat-reports/export` (respuesta binaria .xlsx).
 */

/** Conjuntos de datos exportables. */
export type SunatReportDataset =
  | 'compras-mapeadas'
  | 'ventas-mapeadas'
  | 'compras-declaradas'
  | 'ventas-declaradas';

export interface SunatReportExportParams {
  /** Período inicial AAAAMM (inclusive). */
  perIni?: string;
  /** Período final AAAAMM (inclusive). */
  perFin?: string;
  /** Moneda a filtrar (ej. 'PEN' | 'USD'). Vacío = todas. */
  moneda?: string;
  /** Estado del comprobante (según tabla SUNAT). */
  estado?: string;
  /** Conjuntos de datos a incluir en el reporte. */
  datasets?: SunatReportDataset[];
  /** Si se incluye el detalle línea a línea. */
  incluirDetalle?: boolean;
}

class SunatReportsService {
  private readonly basePath = '/sunat-reports';

  /**
   * Descarga el reporte consolidado en formato Excel (.xlsx).
   * Los parámetros son todos opcionales; se envían solo los definidos.
   */
  async exportReport(params: SunatReportExportParams = {}): Promise<Blob> {
    const query: Record<string, string | boolean> = {};

    if (params.perIni) query.perIni = params.perIni;
    if (params.perFin) query.perFin = params.perFin;
    if (params.moneda) query.moneda = params.moneda;
    if (params.estado) query.estado = params.estado;
    if (params.datasets && params.datasets.length > 0) {
      query.datasets = params.datasets.join(',');
    }
    if (params.incluirDetalle !== undefined) {
      query.incluirDetalle = params.incluirDetalle;
    }

    return apiClient.get<Blob>(`${this.basePath}/export`, {
      params: query,
      responseType: 'blob',
      // La generación del Excel puede tardar varios segundos: sin límite de tiempo.
      timeout: 0,
    });
  }
}

export const sunatReportsService = new SunatReportsService();
export const sunatReportsApi = sunatReportsService;
