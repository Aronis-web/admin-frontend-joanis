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
};
