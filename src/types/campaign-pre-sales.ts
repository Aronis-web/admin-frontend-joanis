// Tipos de Pre-venta de Campaña (consolidado externo)
//
// Una pre-venta se genera al cerrar el consolidado (cierre parcial v2) de un
// participante cuya empresa es distinta a la de la campaña. No descuenta stock
// ni emite comprobante SUNAT (documento interno de valorización).

/**
 * Estado de una pre-venta.
 */
export enum CampaignPreSaleStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

/**
 * Labels de estado para la UI.
 */
export const CampaignPreSaleStatusLabels: Record<CampaignPreSaleStatus, string> = {
  [CampaignPreSaleStatus.DRAFT]: 'Borrador',
  [CampaignPreSaleStatus.CONFIRMED]: 'Confirmada',
  [CampaignPreSaleStatus.CANCELLED]: 'Cancelada',
};

/**
 * Snapshot de empresa destino (companySnapshot).
 */
export interface CampaignPreSaleCompanySnapshot {
  id: string;
  name: string;
}

/**
 * Snapshot del perfil de precio (priceProfileSnapshot).
 */
export interface CampaignPreSalePriceProfileSnapshot {
  id: string;
  code: string;
  name: string;
  factorToCost: number;
}

/**
 * Relación ligera de campaña.
 */
export interface CampaignPreSaleCampaignRelation {
  id: string;
  code?: string;
  name?: string;
  status?: string;
}

/**
 * Relación ligera de participante.
 */
export interface CampaignPreSaleParticipantRelation {
  id: string;
  participantType?: string;
  companyId?: string;
  company?: {
    id: string;
    name: string;
    ruc?: string;
  };
  priceProfile?: {
    id: string;
    code?: string;
    name?: string;
  };
}

/**
 * Relación ligera de producto (dentro del detalle de items).
 */
export interface CampaignPreSaleProduct {
  id: string;
  name?: string;
  title?: string;
  sku?: string;
}

/**
 * Item de detalle de una pre-venta (por producto).
 */
export interface CampaignPreSaleItem {
  id: string;
  preSaleId: string;
  productId: string;
  presentationId: string | null;
  quantity: string | number;
  costCents: string | number;
  salePriceCents: string | number;
  costTotalCents: string | number;
  saleTotalCents: string | number;
  marginCents: string | number;
  createdAt: string;
  product?: CampaignPreSaleProduct;
}

/**
 * Cabecera de pre-venta (CampaignPreSale).
 *
 * Los montos `*_cents` viajan serializados como string (bigint en backend),
 * por lo que se tipan como `string | number` y se formatean con `formatCents`.
 */
export interface CampaignPreSale {
  id: string;
  closureBatchId: string;
  campaignId: string;
  campaignParticipantId: string;
  companyId: string;
  priceProfileId: string | null;
  currency: string;
  totalQuantity: string | number;
  totalCostCents: string | number;
  totalSaleCents: string | number;
  totalMarginCents: string | number;
  marginPercentage: string | number;
  status: CampaignPreSaleStatus;
  companySnapshot: CampaignPreSaleCompanySnapshot | null;
  priceProfileSnapshot: CampaignPreSalePriceProfileSnapshot | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  campaign?: CampaignPreSaleCampaignRelation;
  campaignParticipant?: CampaignPreSaleParticipantRelation;
  items?: CampaignPreSaleItem[];
}

/**
 * Parámetros de consulta del listado de pre-ventas.
 */
export interface QueryCampaignPreSalesParams {
  page?: number;
  limit?: number;
  campaignId?: string;
  companyId?: string;
  priceProfileId?: string;
  status?: CampaignPreSaleStatus;
  currency?: string;
  from?: string;
  to?: string;
  search?: string;
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'status'
    | 'totalQuantity'
    | 'totalCostCents'
    | 'totalSaleCents'
    | 'totalMarginCents';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Envoltura paginada del listado de pre-ventas.
 */
export interface CampaignPreSalesResponse {
  data: CampaignPreSale[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Body para cambiar el estado de una pre-venta.
 */
export interface UpdateCampaignPreSaleStatusRequest {
  status: Exclude<CampaignPreSaleStatus, CampaignPreSaleStatus.DRAFT>;
}

/**
 * Formatea un monto en centavos a texto de moneda, ej. `S/ 1,389.90`.
 * Tolera valores `bigint` serializados como string y valores nulos.
 */
export function formatCents(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return `S/ ${(num / 100).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formatea una cantidad (numeric(18,6)) de forma compacta, ej. `615.00`.
 */
export function formatQuantity(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}
