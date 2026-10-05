import type { StockItemResponse } from '@/services/api/inventory';

/**
 * Fila de stock por (warehouse, area) dentro de la sede activa.
 * areaId puede ser null (stock a nivel de warehouse sin área específica).
 */
export interface StockRow {
  warehouseId: string;
  warehouseName: string;
  areaId: string | null;
  areaName: string;
  available: number;
}

/** Fila de stock con su dimension de variante (null = saldo del producto). */
type StockItemWithVariant = StockItemResponse & { variantId?: string | null };

/**
 * Deriva las filas de stock disponible para un producto dentro de la sede
 * activa, agrupadas por (warehouse, area). La fuente de verdad es la lista
 * global de stock items de la sede (`inventoryApi.getAllStock`), el mismo
 * patrón que usa Campañas → `AddProductScreen`.
 *
 * `stockVariantId` elige la dimension de stock (misma regla que hold/checkout
 * del bot): `null` = saldo del producto (filas sin variante), un id = saldo de
 * esa variante con stock propio. `undefined` suma todas las filas (total).
 */
export const computeStockRowsForProduct = (
  productId: string | null | undefined,
  siteStock: StockItemResponse[] | undefined,
  siteWarehouseIds?: Set<string> | null,
  stockVariantId?: string | null
): StockRow[] => {
  if (!productId) return [];
  const list = Array.isArray(siteStock) ? siteStock : [];
  if (list.length === 0) return [];
  const rows = new Map<string, StockRow>();
  list.forEach((si: StockItemWithVariant) => {
    if (si.productId !== productId) return;
    if (stockVariantId !== undefined && (si.variantId ?? null) !== stockVariantId) return;
    if (siteWarehouseIds && siteWarehouseIds.size > 0 && !siteWarehouseIds.has(si.warehouseId)) {
      return;
    }
    const key = `${si.warehouseId}::${si.areaId ?? 'none'}`;
    const available = Number(si.availableQuantityBase ?? si.quantityBase ?? 0);
    const warehouseName = si.warehouse?.name ?? si.warehouseId.slice(0, 6);
    const areaName = si.area?.name ?? (si.areaId ? si.areaId.slice(0, 6) : 'Sin área');
    const prev = rows.get(key);
    if (prev) {
      prev.available += available;
    } else {
      rows.set(key, {
        warehouseId: si.warehouseId,
        warehouseName,
        areaId: si.areaId,
        areaName,
        available,
      });
    }
  });
  return Array.from(rows.values()).sort((a, b) => b.available - a.available);
};
