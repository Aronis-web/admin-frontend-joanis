import { apiClient } from './client';

export type SalesProfitGroupBy = 'site' | 'day' | 'site_day';

export interface SalesProfitTotals {
  unitsSold: number;
  revenueNetCents: number;
  costCents: number;
  profitCents: number;
  marginPct: number | null;
  unitsCostZero: number;
  linesCostZero: number;
  revenueCostZeroCents: number;
}

export interface SalesProfitRow extends SalesProfitTotals {
  siteId?: string;
  siteName?: string;
  day?: string;
}

export interface SalesProfitReport {
  range: { from: string; to: string };
  groupBy: SalesProfitGroupBy;
  totals: SalesProfitTotals;
  rows: SalesProfitRow[];
}

export interface GetSalesProfitParams {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  siteId?: string | string[]; // uno o varios
  groupBy?: SalesProfitGroupBy;
}

// -----------------------------------------------------------------------------
// Reportes PLE SUNAT (envío async por WhatsApp)
// -----------------------------------------------------------------------------

/**
 * Destinatario del reporte generado async. Se envía uno de los dos modos:
 *  - `siteContactId`: contacto de sede (debe estar activo y con WhatsApp habilitado)
 *  - `phoneNumber`: celular libre con código de país (ej. 51999888777)
 */
export type PleReportRecipient =
  | { siteContactId: string; phoneNumber?: never; contactName?: never }
  | { siteContactId?: never; phoneNumber: string; contactName?: string };

export interface SendPleReportBase {
  companyId: string;
  siteId: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  caption?: string;
}

export type SendRegistroVentasPayload = SendPleReportBase & PleReportRecipient;
export type SendKardexSalidasPayload = SendPleReportBase & PleReportRecipient;

export interface SendPleReportResponse {
  jobId: string;
  contactName: string;
  message: string;
}

export const reportsApi = {
  /**
   * GET /admin/reports/sales-profit
   * Utilidad de ventas por sede/día (montos en céntimos, netos sin IGV).
   */
  getSalesProfit: async (params: GetSalesProfitParams): Promise<SalesProfitReport> => {
    const query = new URLSearchParams();
    query.append('from', params.from);
    query.append('to', params.to);
    if (params.groupBy) query.append('groupBy', params.groupBy);

    const siteIds = Array.isArray(params.siteId)
      ? params.siteId
      : params.siteId
        ? params.siteId
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    siteIds.forEach((id) => query.append('siteId', id));

    return apiClient.get<SalesProfitReport>(`/admin/reports/sales-profit?${query.toString()}`);
  },

  /**
   * POST /admin/reports/registro-ventas/export
   * Encola generación async del Registro de Ventas SUNAT 14.1 y lo envía por WhatsApp.
   * Respuesta 202 con { jobId, contactName, message }. No hay polling: el archivo llega por WhatsApp.
   */
  sendRegistroVentas: async (
    payload: SendRegistroVentasPayload
  ): Promise<SendPleReportResponse> => {
    return apiClient.post<SendPleReportResponse>('/admin/reports/registro-ventas/export', payload);
  },

  /**
   * POST /admin/reports/kardex/salidas/export
   * Encola generación async del Kardex SUNAT 12.1 (Salidas) y lo envía por WhatsApp.
   */
  sendKardexSalidas: async (payload: SendKardexSalidasPayload): Promise<SendPleReportResponse> => {
    return apiClient.post<SendPleReportResponse>('/admin/reports/kardex/salidas/export', payload);
  },

  /**
   * POST /admin/reports/kardex/salidas/export-detallado
   * Encola generación async del Movimiento de almacén detallado (egresos) y lo envía por WhatsApp.
   */
  sendKardexSalidasDetalle: async (
    payload: SendKardexSalidasPayload
  ): Promise<SendPleReportResponse> => {
    return apiClient.post<SendPleReportResponse>(
      '/admin/reports/kardex/salidas/export-detallado',
      payload
    );
  },
};
