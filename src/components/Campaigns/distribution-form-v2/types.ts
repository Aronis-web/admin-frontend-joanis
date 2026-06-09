/**
 * Tipos locales para el modal V2 de generación de repartos.
 *
 * Toda la lógica de cálculo trabaja en `cents` y `quantityBase` (unidades base).
 * Las cajas/medias/sueltas son SOLO una representación UX y se derivan/explotan
 * según el factor de la presentación seleccionada.
 */
import { ParticipantType } from '@/types/campaigns';

export type DistributionMode = 'units' | 'presentation';

export type SaleStatus = 'ok' | 'warn' | 'bad' | 'no-price' | 'no-expected';

export interface StockBucket {
  key: string;
  warehouseId: string;
  warehouseName: string;
  areaId: string | null;
  areaName: string | null;
  available: number;
  reserved: number;
  /** Cuánto el usuario marca tomar de este bucket. undefined = no seleccionado. */
  allocation?: number;
}

export interface ParticipantRowV2 {
  participantId: string;
  participantName: string;
  participantType: ParticipantType;
  /** companyId del site del participante. Sólo aplica a INTERNAL_SITE. */
  siteCompanyId: string | null;
  /** True si la fila pertenece a la empresa actual del tenant. */
  belongsToCurrentCompany: boolean;

  // ====== Cantidades editables (siempre sumamos a quantityBase) ======
  boxes: number;
  halfBoxes: number;
  loose: number;
  quantityBase: number;

  // ====== Precios y costo ======
  unitPriceCents: number;
  unitCostCents: number;
  /**
   * Esperado total del participante para TODA la campaña (assignedAmountCents).
   * Se usa como referencia de cumplimiento, no como meta del producto actual.
   */
  expectedTotalCents: number;
  /**
   * Lo que el participante ya tiene asignado (en monto) por OTROS productos
   * de la campaña con distribución generada. Calculado en cliente con
   * `assignedQuantityBase` × precio venta del perfil del participante para
   * la presentación base de cada producto previo.
   */
  previousSaleCents: number;
  /**
   * True si al calcular `previousSaleCents` faltó precio en algún producto
   * previo y el acumulado es solo una estimación parcial.
   */
  previousSaleIsPartial: boolean;

  // ====== Derivados monetarios ======
  /** Venta real solo de este producto = unitPrice × quantityBase. */
  realSaleCents: number;
  /** Venta acumulada (otros productos + actual). */
  totalSaleCents: number;
  totalCostCents: number;
  profitCents: number;
  /** % cumplido = totalSaleCents / expectedTotalCents * 100. */
  campaignCoveragePercent: number;

  // ====== UX ======
  locked: boolean;
  hasPriceWarning: boolean;
}

export interface DistributionTotals {
  totalQuantity: number;
  /** Suma de venta acumulada (previous + current) de todas las filas. */
  totalSaleCents: number;
  /** Solo lo que aporta el producto actual. */
  realSaleCents: number;
  totalCostCents: number;
  profitCents: number;
  marginPercent: number;
  /** Conteo de participantes por bucket de cumplimiento de campaña. */
  coverageBuckets: {
    complete: number; // >= 98%
    inRange: number; // 90-98%
    low: number; // < 90%
    over: number; // > 102%
    noExpected: number; // expectedTotalCents = 0
  };
}
