import { apiClient } from './client';
import {
  CampaignPreSale,
  CampaignPreSalesResponse,
  QueryCampaignPreSalesParams,
  CampaignPreSaleStatus,
} from '@/types/campaign-pre-sales';

/**
 * Pre-venta de Campaña API Service
 *
 * Endpoints de pre-venta de campaña (consolidado externo). Base URL
 * `/admin/campaigns/repartos`.
 *
 * - `repartos.read` para consultas (listar, detalle, por cierre).
 * - `repartos.pre_sale` para crear y cambiar estado.
 */
class CampaignPreSalesService {
  private readonly basePath = '/admin/campaigns/repartos';

  /**
   * Crear pre-venta desde un cierre parcial v2 (idempotente por closureBatchId).
   * POST /closure-batches-v2/:closureBatchId/pre-sale
   */
  async createPreSale(closureBatchId: string, notes?: string): Promise<CampaignPreSale> {
    return apiClient.post<CampaignPreSale>(
      `${this.basePath}/closure-batches-v2/${closureBatchId}/pre-sale`,
      notes ? { notes } : {}
    );
  }

  /**
   * Consultar pre-venta de un cierre parcial v2.
   * GET /closure-batches-v2/:closureBatchId/pre-sale
   */
  async getPreSaleByClosureBatch(closureBatchId: string): Promise<CampaignPreSale> {
    return apiClient.get<CampaignPreSale>(
      `${this.basePath}/closure-batches-v2/${closureBatchId}/pre-sale`
    );
  }

  /**
   * Listar pre-ventas con paginación, filtros y buscador.
   * GET /pre-sales
   */
  async getPreSales(params?: QueryCampaignPreSalesParams): Promise<CampaignPreSalesResponse> {
    return apiClient.get<CampaignPreSalesResponse>(`${this.basePath}/pre-sales`, {
      params,
    });
  }

  /**
   * Detalle de una pre-venta (con items y producto).
   * GET /pre-sales/:id
   */
  async getPreSale(id: string): Promise<CampaignPreSale> {
    return apiClient.get<CampaignPreSale>(`${this.basePath}/pre-sales/${id}`);
  }

  /**
   * Cambiar estado de una pre-venta (DRAFT → CONFIRMED / CANCELLED).
   * PATCH /pre-sales/:id/status
   */
  async updatePreSaleStatus(
    id: string,
    status: Exclude<CampaignPreSaleStatus, CampaignPreSaleStatus.DRAFT>
  ): Promise<CampaignPreSale> {
    return apiClient.patch<CampaignPreSale>(`${this.basePath}/pre-sales/${id}/status`, {
      status,
    });
  }
}

// Export service instance
export const campaignPreSalesService = new CampaignPreSalesService();
