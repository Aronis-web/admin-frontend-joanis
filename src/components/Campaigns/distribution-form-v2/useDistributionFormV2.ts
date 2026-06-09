/**
 * Hook con toda la lógica del modal V2 de generación de reparto.
 *
 * Responsabilidades:
 *  - Cargar campaign + participantes + sale prices del producto.
 *  - Filtrar stock estrictamente por la sede actual.
 *  - Mantener filas editables (cajas / medias cajas / unidades sueltas).
 *  - Recalcular automáticamente el remanente entre las sedes internas
 *    de la empresa actual, proporcional al monto esperado.
 *  - Construir el payload para `campaignsService.generateDistribution`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { campaignsService, priceProfilesApi } from '@/services/api';
import { warehousesApi } from '@/services/api/warehouses';
import { inventoryApi } from '@/services/api/inventory';
import {
  CampaignParticipant,
  CampaignProduct,
  DistributionGenerateItem,
  DistributionSource,
  DistributionType,
  ParticipantType,
  StockDetailByWarehouse,
} from '@/types/campaigns';
import { ProductSalePrice } from '@/types/price-profiles';
import { useTenantStore } from '@/store/tenant';
import logger from '@/utils/logger';
import {
  DistributionMode,
  DistributionTotals,
  ParticipantRowV2,
  SaleStatus,
  StockBucket,
} from './types';

const stockKeyOf = (warehouseId?: string, areaId?: string | null) =>
  `${warehouseId ?? 'unknown'}::${areaId ?? 'null'}`;

interface UseDistributionFormV2Params {
  visible: boolean;
  campaignId: string;
  product: CampaignProduct | null;
  localStockData?: StockDetailByWarehouse[];
  onSuccess: () => void;
  onClose: () => void;
}

interface UseDistributionFormV2Return {
  // estado del flujo
  loading: boolean;
  submitting: boolean;
  error: string | null;

  // contexto del tenant
  currentSite: ReturnType<typeof useTenantStore.getState>['selectedSite'];
  currentCompany: ReturnType<typeof useTenantStore.getState>['selectedCompany'];

  // stock
  stockBuckets: StockBucket[];
  stockAllocations: Record<string, number>;
  setStockAllocation: (key: string, qty: number) => void;
  toggleStockBucket: (key: string) => void;
  totalFromAllocations: number;

  // modo / presentación
  mode: DistributionMode;
  setMode: (mode: DistributionMode) => void;
  allowHalfBox: boolean;
  setAllowHalfBox: (v: boolean) => void;
  allowLoose: boolean;
  setAllowLoose: (v: boolean) => void;
  remainderRecipientId: string | null;
  setRemainderRecipientId: (id: string | null) => void;
  presentationId: string | null;
  presentationFactor: number;
  presentations: NonNullable<NonNullable<CampaignProduct['product']>['presentations']>;
  setPresentationId: (id: string) => void;
  isEvenFactor: boolean;

  // tipo de reparto + participantes seleccionados (custom)
  distributionType: DistributionType;
  setDistributionType: (t: DistributionType) => void;
  selectedParticipants: Set<string>;
  toggleParticipant: (id: string) => void;

  // filas
  rows: ParticipantRowV2[];
  internalRows: ParticipantRowV2[];
  externalRows: ParticipantRowV2[];
  updateRowQuantities: (
    id: string,
    next: { boxes?: number; halfBoxes?: number; loose?: number }
  ) => void;
  toggleRowLock: (id: string) => void;
  recalculateRest: () => void;
  resetRows: () => void;

  // totales
  totals: DistributionTotals;

  // submit
  submit: () => Promise<void>;
}

// ============================================================
// Helpers exportables (puros)
// ============================================================

/** Calcula la cantidad base a partir de cajas + medias + sueltas. */
export const computeQuantityBase = (
  boxes: number,
  halfBoxes: number,
  loose: number,
  factor: number,
  allowHalfBox: boolean
): number => {
  const f = factor > 0 ? factor : 1;
  const half = allowHalfBox && f % 2 === 0 ? f / 2 : 0;
  return Math.max(0, Math.floor(boxes) * f + Math.floor(halfBoxes) * half + Math.floor(loose));
};

/** Explota una cantidad base a cajas / medias / sueltas según factor y modo. */
export const explodeQuantity = (
  qtyBase: number,
  factor: number,
  mode: DistributionMode,
  allowHalfBox: boolean,
  allowLoose: boolean = true
): { boxes: number; halfBoxes: number; loose: number } => {
  if (mode === 'units' || factor <= 1) {
    return { boxes: 0, halfBoxes: 0, loose: Math.max(0, Math.floor(qtyBase)) };
  }
  let remaining = Math.max(0, Math.floor(qtyBase));
  const boxes = Math.floor(remaining / factor);
  remaining -= boxes * factor;
  let halfBoxes = 0;
  if (allowHalfBox && factor % 2 === 0) {
    const half = factor / 2;
    halfBoxes = Math.floor(remaining / half);
    remaining -= halfBoxes * half;
  }
  // Si no se permiten sueltas, descartamos el resto fraccional.
  if (!allowLoose) {
    return { boxes, halfBoxes, loose: 0 };
  }
  return { boxes, halfBoxes, loose: remaining };
};

/** Clasifica la salud de la venta real vs esperada. */
export const computeSaleStatus = (
  realCents: number,
  expectedCents: number,
  hasPrice: boolean
): { status: SaleStatus; deltaCents: number; deltaPercent: number } => {
  if (!hasPrice) {
    return { status: 'no-price', deltaCents: 0, deltaPercent: 0 };
  }
  if (expectedCents <= 0) {
    return { status: 'no-expected', deltaCents: realCents, deltaPercent: 0 };
  }
  const deltaCents = realCents - expectedCents;
  const deltaPercent = (deltaCents / expectedCents) * 100;
  const abs = Math.abs(deltaPercent);
  let status: SaleStatus = 'ok';
  if (abs > 10) status = 'bad';
  else if (abs > 2) status = 'warn';
  return { status, deltaCents, deltaPercent };
};

/** Reparto largest-remainder proporcional a pesos. */
const allocateByWeights = (
  total: number,
  weights: { id: string; weight: number }[]
): Record<string, number> => {
  const out: Record<string, number> = {};
  const safe = weights.filter((w) => w.weight > 0);
  const totalWeight = safe.reduce((s, w) => s + w.weight, 0);

  if (total <= 0 || safe.length === 0 || totalWeight <= 0) {
    weights.forEach((w) => {
      out[w.id] = 0;
    });
    return out;
  }

  const exact = safe.map((w) => ({
    id: w.id,
    exact: (w.weight / totalWeight) * total,
  }));
  let assigned = 0;
  exact.forEach((e) => {
    const f = Math.floor(e.exact);
    out[e.id] = f;
    assigned += f;
  });
  let remainder = total - assigned;
  const sortedByFrac = [...exact].sort(
    (a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact))
  );
  for (let i = 0; remainder > 0 && i < sortedByFrac.length; i++) {
    out[sortedByFrac[i].id] += 1;
    remainder -= 1;
  }
  // Faltantes (peso 0) quedan en cero
  weights.forEach((w) => {
    if (out[w.id] === undefined) out[w.id] = 0;
  });
  return out;
};

// ============================================================
// Hook principal
// ============================================================

export function useDistributionFormV2(
  params: UseDistributionFormV2Params
): UseDistributionFormV2Return {
  const { visible, campaignId, product, localStockData, onSuccess, onClose } = params;

  const currentSite = useTenantStore((s) => s.selectedSite);
  const currentCompany = useTenantStore((s) => s.selectedCompany);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [participants, setParticipants] = useState<CampaignParticipant[]>([]);
  const [salePrices, setSalePrices] = useState<ProductSalePrice[]>([]);
  /**
   * Monto acumulado por participante calculado en cliente a partir de las
   * customDistributions ya generadas en OTROS productos de la campaña.
   * Clave: participantId.
   */
  const [previousSaleByParticipant, setPreviousSaleByParticipant] = useState<
    Record<string, { cents: number; isPartial: boolean }>
  >({});

  const [stockAllocations, setStockAllocations] = useState<Record<string, number>>({});

  /**
   * IDs de los almacenes que realmente pertenecen a la sede actual,
   * cargados desde `warehousesApi.getWarehouses({ siteId })` al abrir el
   * modal. Se usan como filtro EXTRA en `stockBuckets` para evitar mezclar
   * stock de almacenes de otras sedes incluso si el backend de inventario
   * marcó el item con un `siteId` incorrecto.
   *
   * `null` = aún cargando; `Set` vacío = la sede no tiene almacenes (se
   * descarta TODO el stock y se muestra warning).
   */
  const [siteWarehouseIds, setSiteWarehouseIds] = useState<Set<string> | null>(null);

  /**
   * Stock fresco del producto en la sede actual, consultado directamente al
   * módulo de inventario al abrir el modal (no depende del padre).
   *
   * Esto resuelve dos problemas:
   *  1) El padre estaba mapeando `available = availableQuantityBase || quantityBase`,
   *     que degradaba a "total" cuando el disponible legítimo era 0.
   *  2) Garantiza que veamos disponibilidad real al momento de generar el
   *     reparto, no la que estaba cacheada cuando se abrió el banner.
   *
   * `null` = aún cargando / no se intentó; si la llamada falla, queda en
   * `null` y se usa `localStockData` como fallback.
   */
  const [freshStock, setFreshStock] = useState<StockDetailByWarehouse[] | null>(null);

  const [mode, setMode] = useState<DistributionMode>('units');
  const [allowHalfBox, setAllowHalfBox] = useState(false);
  // Por defecto desactivado: queremos repartos limpios en cajas/medias y que
  // el usuario habilite sueltas explícitamente solo si lo necesita.
  const [allowLoose, setAllowLoose] = useState(false);
  /**
   * Cuando allowLoose=false y el reparto deja un resto (qty que no
   * completa una caja/media), ese resto se asigna íntegramente a UNA sola
   * sede (la "receptora") como unidades sueltas. Si es null, se elige
   * automáticamente la fila elegible con mayor gap de cumplimiento.
   */
  const [remainderRecipientId, setRemainderRecipientId] = useState<string | null>(null);
  const [presentationId, setPresentationIdState] = useState<string | null>(null);

  const [distributionType, setDistributionType] = useState<DistributionType>(
    product?.distributionType ?? DistributionType.ALL
  );
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());

  const [rows, setRows] = useState<ParticipantRowV2[]>([]);

  // Para no disparar el primer reparto antes de tener datos cargados.
  const loadedRef = useRef(false);

  const presentations = useMemo(
    () => product?.product?.presentations ?? [],
    [product?.product?.presentations]
  );

  const presentationFactor = useMemo(() => {
    if (!presentationId) return 1;
    const p = presentations.find((x) => x.presentationId === presentationId);
    return p?.factorToBase ?? 1;
  }, [presentationId, presentations]);

  const isEvenFactor = presentationFactor > 1 && presentationFactor % 2 === 0;

  // Auto-selección por defecto: cuando el modal abre y el producto tiene
  // presentaciones, dejamos preseleccionada la de MENOR factorToBase (la más
  // chica, p. ej. "unidad" o "pack" antes que "caja"). El usuario puede
  // cambiarla luego desde el selector.
  useEffect(() => {
    if (!visible) return;
    if (presentationId) return;
    if (presentations.length === 0) return;
    const smallest = [...presentations].sort(
      (a, b) => (a.factorToBase ?? 1) - (b.factorToBase ?? 1)
    )[0];
    if (smallest?.presentationId) {
      setPresentationIdState(smallest.presentationId);
    }
  }, [visible, presentations, presentationId]);

  // ====== Carga de almacenes de la sede actual ======
  //
  // Al abrir el modal, traemos los almacenes que pertenecen a la sede actual
  // para usarlos como filtro estricto sobre el stock. Esto blinda contra el
  // caso de que `localStockData` traiga items con `siteId=currentSiteId`
  // asignado por defecto en el padre, pero con un warehouse que en realidad
  // pertenece a otra sede.
  useEffect(() => {
    if (!visible) {
      return;
    }
    if (!currentSite?.id) {
      setSiteWarehouseIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const warehouses = await warehousesApi.getWarehouses(currentCompany?.id, currentSite.id);
        if (cancelled) return;
        const ids = new Set(warehouses.map((w) => w.id).filter(Boolean));
        logger.debug('🏬 [V2-STOCK] Almacenes de la sede actual', {
          siteId: currentSite.id,
          companyId: currentCompany?.id,
          count: ids.size,
          ids: Array.from(ids),
        });
        setSiteWarehouseIds(ids);
      } catch (e) {
        if (cancelled) return;
        logger.error('❌ [V2-STOCK] Error cargando almacenes de la sede', e);
        // Fallback seguro: si la API falla, dejamos null (= no aplicar el
        // filtro extra) para no bloquear el modal. El filtro por siteId
        // sigue siendo el primer escudo.
        setSiteWarehouseIds(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, currentSite?.id, currentCompany?.id]);

  // ====== Carga fresca de stock del producto en la sede actual ======
  //
  // Llamada directa al endpoint de inventario para no depender del padre y
  // garantizar que `available` venga real (no degradado al total cuando 0).
  useEffect(() => {
    if (!visible || !product?.productId || !currentSite?.id) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stockResponse: any = await inventoryApi.getAllStock({
          siteId: currentSite.id,
          productId: product.productId,
        });
        if (cancelled) return;
        // El API puede devolver un array o un objeto paginado
        // { data: [...], total, page, limit }. Normalizamos para evitar
        // `items.map is not a function`.
        const items: any[] = Array.isArray(stockResponse)
          ? stockResponse
          : (stockResponse?.data ?? []);
        const mapped: StockDetailByWarehouse[] = items.map((it: any) => {
          const total = Number(it.quantityBase ?? 0);
          const reserved = Number(it.reservedQuantityBase ?? 0);
          // Usar ?? para preservar disponible legítimo de 0 (todo reservado).
          // Si el backend no expone availableQuantityBase, calcular como
          // max(total - reserved, 0).
          const available =
            it.availableQuantityBase !== undefined && it.availableQuantityBase !== null
              ? Number(it.availableQuantityBase)
              : Math.max(total - reserved, 0);
          return {
            warehouse: it.warehouse?.name ?? 'Almacén',
            warehouseId: it.warehouseId || it.warehouse?.id,
            // siteId del warehouse, fallback al filtrado (que es el actual).
            siteId: it.warehouse?.siteId ?? currentSite.id,
            area: it.area?.name ?? null,
            areaId: it.areaId ?? it.area?.id ?? null,
            total,
            reserved,
            available,
          };
        });
        logger.debug('📦 [V2-STOCK] Stock fresco del producto', {
          productId: product.productId,
          siteId: currentSite.id,
          count: mapped.length,
          totalAvailable: mapped.reduce((s, x) => s + x.available, 0),
          totalReserved: mapped.reduce((s, x) => s + x.reserved, 0),
        });
        setFreshStock(mapped);
      } catch (e) {
        if (cancelled) return;
        logger.error('❌ [V2-STOCK] Error cargando stock fresco del producto', e);
        // Fallback a localStockData del padre.
        setFreshStock(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, product?.productId, currentSite?.id]);

  // ====== Stock buckets (filtrados estrictamente por la sede actual) ======
  //
  // Invariante: NUNCA se debe mostrar (ni enviar) stock que pertenezca a otra
  // sede distinta a la sede actual del tenant. Por eso:
  //   - Sólo se usa `localStockData` (lo trae el padre filtrado por
  //     `siteId=currentSiteId` desde inventoryApi). Esta es la única fuente
  //     que garantiza pertenencia a sede.
  //   - NO se usa `product.product.stockItems` como fallback porque ese array
  //     no expone `siteId` por warehouse, así que no podemos verificar la
  //     pertenencia y podríamos mezclar sedes.
  //   - Si un item de `localStockData` no trae `siteId`, se descarta también:
  //     el padre debe garantizar que venga marcado (lo asigna a `currentSiteId`
  //     por defecto si la API no lo expone, ver `CampaignProductBannerModal`).
  const stockBuckets = useMemo<StockBucket[]>(() => {
    // Preferimos siempre el stock fresco consultado al módulo de inventario
    // por el hook (tiene `available` correcto). Si aún no cargó, falló o
    // vino vacío (caso típico: producto cuyo master todavía es PRELIMINARY
    // y no tiene registro en inventario; el padre puebla `localStockData`
    // con el preliminaryStock de la compra), caemos al `localStockData`.
    const all = freshStock && freshStock.length > 0 ? freshStock : (localStockData ?? []);
    if (!currentSite?.id) {
      if (all.length > 0) {
        logger.warn('⚠️ [V2-STOCK] Sin sede actual, se descarta todo el stock recibido', {
          received: all.length,
        });
      }
      return [];
    }

    const sameSite: StockDetailByWarehouse[] = [];
    const rejected: Array<{ warehouseId?: string; siteId?: string; reason: string }> = [];
    for (const s of all) {
      // 1) Filtro por siteId expuesto por el endpoint de inventario.
      if (!s.siteId || s.siteId !== currentSite.id) {
        rejected.push({
          warehouseId: s.warehouseId,
          siteId: s.siteId,
          reason: 'siteId mismatch',
        });
        continue;
      }
      // 2) Filtro por warehouse: si ya tenemos la lista de almacenes de la
      //    sede (cargada arriba), descartamos cualquier item cuyo
      //    warehouseId no esté en esa lista. Si todavía está en `null` (en
      //    carga) o falló, no aplicamos este escudo extra.
      if (siteWarehouseIds && s.warehouseId && !siteWarehouseIds.has(s.warehouseId)) {
        rejected.push({
          warehouseId: s.warehouseId,
          siteId: s.siteId,
          reason: 'warehouse not in current site',
        });
        continue;
      }
      sameSite.push(s);
    }
    if (rejected.length > 0) {
      logger.warn('⚠️ [V2-STOCK] Items descartados', {
        currentSiteId: currentSite.id,
        siteWarehouseCount: siteWarehouseIds?.size ?? 'unloaded',
        rejectedCount: rejected.length,
        rejectedSample: rejected.slice(0, 5),
      });
    }
    logger.debug('📦 [V2-STOCK] Stock buckets resultantes', {
      currentSiteId: currentSite.id,
      siteWarehouseCount: siteWarehouseIds?.size ?? 'unloaded',
      received: all.length,
      accepted: sameSite.length,
      rejected: rejected.length,
    });

    return sameSite.map((s) => ({
      key: stockKeyOf(s.warehouseId, s.areaId),
      warehouseId: s.warehouseId || 'unknown',
      warehouseName: s.warehouse,
      areaId: s.areaId ?? null,
      areaName: s.area ?? null,
      // El backend puede devolver decimales (54.000001) por acumulación de
      // lotes. Redondeamos a entero porque el reparto trabaja en unidades
      // base enteras y el backend rechaza decimales en queries SQL.
      available: Math.round(Number(s.available) || 0),
      reserved: Math.round(Number(s.reserved) || 0),
      allocation: undefined,
    }));
  }, [freshStock, localStockData, currentSite?.id, siteWarehouseIds]);

  const totalFromAllocations = useMemo(
    () =>
      Object.values(stockAllocations).reduce(
        (sum, qty) => sum + (Number.isFinite(qty) ? qty : 0),
        0
      ),
    [stockAllocations]
  );

  // ====== Carga inicial ======
  useEffect(() => {
    if (!visible || !product) {
      return;
    }
    if (loadedRef.current) return;
    loadedRef.current = true;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [campaign, pricesResp] = await Promise.all([
          campaignsService.getCampaign(campaignId),
          priceProfilesApi.getProductSalePrices(product.productId).catch((e) => {
            logger.warn('No se pudieron cargar precios de venta del producto', e);
            return null;
          }),
        ]);
        if (cancelled) return;
        setParticipants(campaign.participants ?? []);
        // El backend puede devolver `{ data: [...] }`, `{ salePrices: [...] }`
        // o directamente un array. Normalizamos.
        const pricesArray: ProductSalePrice[] =
          (pricesResp as any)?.salePrices ??
          (pricesResp as any)?.data ??
          (Array.isArray(pricesResp) ? (pricesResp as ProductSalePrice[]) : []);
        logger.debug('💲 ProductSalePrices cargados', {
          productId: product.productId,
          count: pricesArray.length,
        });
        setSalePrices(pricesArray);
        setDistributionType(product.distributionType ?? DistributionType.ALL);
        setSelectedParticipants(new Set((campaign.participants ?? []).map((p) => p.id)));

        // ============================================================
        // Cálculo de venta acumulada por participante en OTROS productos.
        // ============================================================
        // Tomamos todos los CampaignProduct de la campaña con
        // distributionGenerated=true y customDistributions.items, excepto el
        // producto actual, y pedimos en paralelo sus salePrices para resolver
        // el monto = sum(items.assignedQuantityBase * priceBase(perfil)).
        const previousProducts = (campaign.products ?? []).filter(
          (cp) =>
            cp.id !== product.id &&
            cp.distributionGenerated &&
            (cp.customDistributions?.length ?? 0) > 0
        );
        const participantsList = campaign.participants ?? [];
        const participantById = new Map(participantsList.map((p) => [p.id, p]));
        const accum: Record<string, { cents: number; isPartial: boolean }> = {};
        participantsList.forEach((p) => {
          accum[p.id] = { cents: 0, isPartial: false };
        });

        if (previousProducts.length > 0) {
          const priceResponses = await Promise.all(
            previousProducts.map((cp) =>
              priceProfilesApi.getProductSalePrices(cp.productId).catch((e) => {
                logger.warn('No se pudieron cargar precios previos', {
                  productId: cp.productId,
                  err: e,
                });
                return null;
              })
            )
          );
          previousProducts.forEach((cp, idx) => {
            const resp = priceResponses[idx];
            const prices: ProductSalePrice[] =
              (resp as any)?.salePrices ??
              (resp as any)?.data ??
              (Array.isArray(resp) ? (resp as ProductSalePrice[]) : []);
            const presentationsPrev = cp.product?.presentations ?? [];
            const priceBaseFor = (profileId?: string): number | null => {
              if (!profileId) return null;
              const base = prices.find(
                (sp) => sp.profileId === profileId && sp.presentationId === null
              );
              if (base) return base.priceCents;
              const any = prices.find((sp) => sp.profileId === profileId);
              if (!any) return null;
              const pres = presentationsPrev.find((pp) => pp.presentationId === any.presentationId);
              const factor = pres?.factorToBase ?? 1;
              return Math.round(any.priceCents / Math.max(factor, 1));
            };
            (cp.customDistributions ?? []).forEach((cd) => {
              (cd.items ?? []).forEach((it) => {
                const part = participantById.get(it.participantId);
                if (!part) return;
                const qty = Number(it.assignedQuantityBase) || 0;
                if (qty <= 0) return;
                const priceBase = priceBaseFor(part.priceProfileId);
                const slot = accum[it.participantId] ?? { cents: 0, isPartial: false };
                if (priceBase == null) {
                  slot.isPartial = true;
                } else {
                  slot.cents += qty * priceBase;
                }
                accum[it.participantId] = slot;
              });
            });
          });
        }
        setPreviousSaleByParticipant(accum);

        // Allocations iniciales: todo el stock disponible de la sede actual.
        const initialAllocs: Record<string, number> = {};
        stockBuckets.forEach((b) => {
          if (b.available > 0) initialAllocs[b.key] = b.available;
        });
        setStockAllocations(initialAllocs);
      } catch (e: any) {
        logger.error('Error cargando datos V2', e);
        if (!cancelled) setError(e?.message ?? 'Error cargando datos');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // stockBuckets se calcula sobre props estables; lo dejamos fuera para no relanzar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, product, campaignId]);

  // Reset al cerrar
  useEffect(() => {
    if (!visible) {
      loadedRef.current = false;
      setParticipants([]);
      setSalePrices([]);
      setPreviousSaleByParticipant({});
      setStockAllocations({});
      setSiteWarehouseIds(null);
      setFreshStock(null);
      setRows([]);
      setMode('units');
      setAllowHalfBox(false);
      setAllowLoose(false);
      setRemainderRecipientId(null);
      setPresentationIdState(null);
      setSelectedParticipants(new Set());
      setError(null);
    }
  }, [visible]);

  // ====== Precio por participante ======
  const unitPriceFor = useCallback(
    (participant: CampaignParticipant): { priceCents: number; hasPrice: boolean } => {
      const profileId = participant.priceProfileId;
      if (!profileId) return { priceCents: 0, hasPrice: false };
      // Buscar precio para la presentación base (presentationId === null) primero.
      const basePrice = salePrices.find(
        (sp) => sp.profileId === profileId && sp.presentationId === null
      );
      if (basePrice) {
        return { priceCents: basePrice.priceCents, hasPrice: true };
      }
      // Fallback: cualquier precio del perfil dividido por factor de su presentación.
      const anyPrice = salePrices.find((sp) => sp.profileId === profileId);
      if (anyPrice) {
        const pres = presentations.find((p) => p.presentationId === anyPrice.presentationId);
        const factor = pres?.factorToBase ?? 1;
        return {
          priceCents: Math.round(anyPrice.priceCents / Math.max(factor, 1)),
          hasPrice: true,
        };
      }
      return { priceCents: 0, hasPrice: false };
    },
    [salePrices, presentations]
  );

  // ====== Inicialización de filas cuando llegan participantes ======
  // Las filas arrancan en 0 y se llenan con `recalculateRest` automáticamente.
  useEffect(() => {
    if (participants.length === 0) {
      setRows([]);
      return;
    }
    const unitCostCents = product?.product?.costCents ?? 0;
    const newRows: ParticipantRowV2[] = participants.map((p) => {
      const { priceCents, hasPrice } = unitPriceFor(p);
      const siteCompanyId = (p.site as any)?.companyId ?? null;
      const belongsToCurrentCompany =
        p.participantType === ParticipantType.INTERNAL_SITE &&
        (!siteCompanyId || !currentCompany?.id || siteCompanyId === currentCompany.id);
      const prev = previousSaleByParticipant[p.id] ?? { cents: 0, isPartial: false };
      const expectedTotalCents = Number(p.assignedAmountCents) || 0;
      return {
        participantId: p.id,
        participantName: p.company?.name ?? p.site?.name ?? 'Sin nombre',
        participantType: p.participantType,
        siteCompanyId,
        belongsToCurrentCompany,
        boxes: 0,
        halfBoxes: 0,
        loose: 0,
        quantityBase: 0,
        unitPriceCents: priceCents,
        unitCostCents,
        expectedTotalCents,
        previousSaleCents: prev.cents,
        previousSaleIsPartial: prev.isPartial,
        realSaleCents: 0,
        totalSaleCents: prev.cents,
        totalCostCents: 0,
        profitCents: 0,
        campaignCoveragePercent:
          expectedTotalCents > 0 ? (prev.cents / expectedTotalCents) * 100 : 0,
        locked: false,
        hasPriceWarning: !hasPrice,
      };
    });
    setRows(newRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    participants,
    salePrices,
    product?.product?.costCents,
    currentCompany?.id,
    previousSaleByParticipant,
  ]);

  // ====== Recalculo derivados (real sale / cost / profit / coverage) ======
  const recomputeDerived = useCallback((row: ParticipantRowV2): ParticipantRowV2 => {
    const realSaleCents = row.unitPriceCents * row.quantityBase;
    const totalCostCents = row.unitCostCents * row.quantityBase;
    const totalSaleCents = row.previousSaleCents + realSaleCents;
    const campaignCoveragePercent =
      row.expectedTotalCents > 0 ? (totalSaleCents / row.expectedTotalCents) * 100 : 0;
    return {
      ...row,
      realSaleCents,
      totalSaleCents,
      totalCostCents,
      profitCents: realSaleCents - totalCostCents,
      campaignCoveragePercent,
    };
  }, []);

  // ====== Filas elegibles para auto-distribuir el resto ======
  const eligibleRowIds = useCallback(
    (allRows: ParticipantRowV2[]): string[] => {
      // Excluir bloqueadas + filtrar por distributionType.
      return allRows
        .filter((r) => !r.locked)
        .filter((r) => {
          if (distributionType === DistributionType.CUSTOM) {
            return selectedParticipants.has(r.participantId);
          }
          if (
            distributionType === DistributionType.INTERNAL_ONLY ||
            distributionType === DistributionType.INTERNAL_EQUAL
          ) {
            return r.participantType === ParticipantType.INTERNAL_SITE;
          }
          if (distributionType === DistributionType.EXTERNAL_ONLY) {
            return r.participantType === ParticipantType.EXTERNAL_COMPANY;
          }
          // ALL → todos los participantes (sedes internas + empresas externas)
          // absorben el "resto" proporcionalmente.
          return true;
        })
        .map((r) => r.participantId);
    },
    [distributionType, selectedParticipants]
  );

  // ====== Auto-reparto del remanente ======
  const recalculateRest = useCallback(() => {
    setRows((prev) => {
      if (prev.length === 0) return prev;
      const lockedSum = prev.filter((r) => r.locked).reduce((s, r) => s + r.quantityBase, 0);
      const restante = Math.max(0, totalFromAllocations - lockedSum);
      const eligibleIds = new Set(eligibleRowIds(prev));

      // Pesos = "gap pendiente" del participante en la campaña =
      //   max(0, expectedTotalCents - previousSaleCents).
      // Así el resto se prioriza hacia quienes están más lejos de cubrir su
      // monto esperado total (acumulando otros productos ya generados).
      // Fallback a expectedTotal plano, y si tampoco, peso uniforme.
      const eligibleRows = prev.filter((r) => eligibleIds.has(r.participantId));
      const gapWeights = eligibleRows.map((r) => ({
        id: r.participantId,
        weight: Math.max(0, r.expectedTotalCents - r.previousSaleCents),
      }));
      const totalGap = gapWeights.reduce((s, w) => s + w.weight, 0);
      let finalWeights: { id: string; weight: number }[];
      if (totalGap > 0) {
        finalWeights = gapWeights;
      } else {
        const expectedFlat = eligibleRows.map((r) => ({
          id: r.participantId,
          weight: r.expectedTotalCents,
        }));
        const totalExpected = expectedFlat.reduce((s, w) => s + w.weight, 0);
        finalWeights =
          totalExpected > 0
            ? expectedFlat
            : eligibleRows.map((r) => ({ id: r.participantId, weight: 1 }));
      }

      // Cuando NO se permiten sueltas, la unidad mínima del reparto pasa a
      // ser la caja (factor) o la media caja (factor/2). Allocamos en unidades
      // de esa "moneda" y luego multiplicamos para obtener quantityBase.
      const unit =
        !allowLoose && mode === 'presentation' && presentationFactor > 1
          ? allowHalfBox && presentationFactor % 2 === 0
            ? presentationFactor / 2
            : presentationFactor
          : 1;
      const unitsToAllocate = Math.floor(restante / unit);
      const allocatedUnits = allocateByWeights(unitsToAllocate, finalWeights);

      // Resto que no completa una unidad (caja o media). Solo aplica cuando
      // unit > 1 (es decir, presentación con allowLoose=OFF). Se asigna en
      // bloque a UNA sola sede receptora.
      const leftover = unit > 1 ? restante - unitsToAllocate * unit : 0;
      let recipientId: string | null = null;
      if (leftover > 0 && eligibleRows.length > 0) {
        // Preferimos el seleccionado por el usuario si sigue siendo elegible
        // y no está bloqueado.
        const preferred = eligibleRows.find(
          (r) => r.participantId === remainderRecipientId && !r.locked
        );
        if (preferred) {
          recipientId = preferred.participantId;
        } else {
          // Auto: el de mayor gap pendiente entre los elegibles.
          const sortedByGap = [...eligibleRows].sort(
            (a, b) =>
              Math.max(0, b.expectedTotalCents - b.previousSaleCents) -
              Math.max(0, a.expectedTotalCents - a.previousSaleCents)
          );
          recipientId = sortedByGap[0]?.participantId ?? null;
        }
      }

      return prev.map((r) => {
        // Bloqueadas: mantenemos sus cantidades tal cual.
        if (r.locked) return recomputeDerived(r);
        // Elegibles: sobreescribimos.
        if (eligibleIds.has(r.participantId)) {
          let qty = (allocatedUnits[r.participantId] ?? 0) * unit;
          const extraLoose = recipientId === r.participantId ? leftover : 0;
          qty += extraLoose;
          const exploded = explodeQuantity(qty, presentationFactor, mode, allowHalfBox, allowLoose);
          // Si esta fila absorbe el resto, le pegamos las sueltas encima de
          // lo que devolvió explodeQuantity (que respeta allowLoose=OFF y
          // habría puesto loose=0).
          if (extraLoose > 0) {
            exploded.loose = (exploded.loose ?? 0) + extraLoose;
          }
          return recomputeDerived({
            ...r,
            quantityBase: qty,
            ...exploded,
          });
        }
        // No elegibles: en 0.
        return recomputeDerived({
          ...r,
          boxes: 0,
          halfBoxes: 0,
          loose: 0,
          quantityBase: 0,
        });
      });
    });
  }, [
    totalFromAllocations,
    eligibleRowIds,
    presentationFactor,
    mode,
    allowHalfBox,
    allowLoose,
    remainderRecipientId,
    recomputeDerived,
  ]);

  // Auto-disparo (debounced) ante cambios de stock, modo, tipo, etc.
  useEffect(() => {
    if (!visible || loading || rows.length === 0) return;
    const handle = setTimeout(() => recalculateRest(), 150);
    return () => clearTimeout(handle);
  }, [
    visible,
    loading,
    totalFromAllocations,
    distributionType,
    selectedParticipants,
    presentationFactor,
    mode,
    allowHalfBox,
    allowLoose,
    remainderRecipientId,
    rows.length, // solo cuando arrancan
    recalculateRest,
  ]);

  // ====== Acciones sobre stock ======
  const setStockAllocation = useCallback((key: string, qty: number) => {
    setStockAllocations((prev) => ({ ...prev, [key]: Math.max(0, Math.round(qty)) }));
  }, []);

  const toggleStockBucket = useCallback(
    (key: string) => {
      setStockAllocations((prev) => {
        const next = { ...prev };
        if (next[key] !== undefined) {
          delete next[key];
        } else {
          const b = stockBuckets.find((x) => x.key === key);
          next[key] = b?.available ?? 0;
        }
        return next;
      });
    },
    [stockBuckets]
  );

  // ====== Acciones sobre filas ======
  const updateRowQuantities = useCallback<UseDistributionFormV2Return['updateRowQuantities']>(
    (id, next) => {
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.participantId === id);
        if (idx < 0) return prev;
        const row = prev[idx];
        const boxes = next.boxes ?? row.boxes;
        const halfBoxes = next.halfBoxes ?? row.halfBoxes;
        // Si el switch "permitir sueltas" está apagado, forzamos loose=0.
        const loose = allowLoose ? (next.loose ?? row.loose) : 0;
        const quantityBase = computeQuantityBase(
          boxes,
          halfBoxes,
          loose,
          presentationFactor,
          allowHalfBox
        );
        const updated = recomputeDerived({
          ...row,
          boxes,
          halfBoxes,
          loose,
          quantityBase,
          // Edición manual = lock implícito para no ser pisado por auto.
          locked: true,
        });
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      });
      // Disparar el rebalance del resto.
      setTimeout(() => recalculateRest(), 50);
    },
    [presentationFactor, allowHalfBox, allowLoose, recomputeDerived, recalculateRest]
  );

  const toggleRowLock = useCallback((id: string) => {
    setRows((prev) => prev.map((r) => (r.participantId === id ? { ...r, locked: !r.locked } : r)));
  }, []);

  const resetRows = useCallback(() => {
    setRows((prev) => prev.map((r) => ({ ...r, locked: false })));
    setTimeout(() => recalculateRest(), 50);
  }, [recalculateRest]);

  const toggleParticipant = useCallback((id: string) => {
    setSelectedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setPresentationId = useCallback((id: string) => {
    setPresentationIdState(id);
  }, []);

  // ====== Totales ======
  const internalRows = useMemo(
    () =>
      rows
        .filter((r) => r.participantType === ParticipantType.INTERNAL_SITE)
        .sort((a, b) => a.participantName.localeCompare(b.participantName)),
    [rows]
  );
  const externalRows = useMemo(
    () =>
      rows
        .filter((r) => r.participantType === ParticipantType.EXTERNAL_COMPANY)
        .sort((a, b) => a.participantName.localeCompare(b.participantName)),
    [rows]
  );

  const totals = useMemo<DistributionTotals>(() => {
    const totalQuantity = rows.reduce((s, r) => s + r.quantityBase, 0);
    const realSaleCents = rows.reduce((s, r) => s + r.realSaleCents, 0);
    const totalSaleCents = rows.reduce((s, r) => s + r.totalSaleCents, 0);
    const totalCostCents = rows.reduce((s, r) => s + r.totalCostCents, 0);
    const profitCents = realSaleCents - totalCostCents;
    const marginPercent = realSaleCents > 0 ? (profitCents / realSaleCents) * 100 : 0;

    const coverageBuckets = rows.reduce(
      (acc, r) => {
        if (r.expectedTotalCents <= 0) {
          acc.noExpected += 1;
          return acc;
        }
        const pct = r.campaignCoveragePercent;
        if (pct > 102) acc.over += 1;
        else if (pct >= 98) acc.complete += 1;
        else if (pct >= 90) acc.inRange += 1;
        else acc.low += 1;
        return acc;
      },
      { complete: 0, inRange: 0, low: 0, over: 0, noExpected: 0 }
    );

    return {
      totalQuantity,
      totalSaleCents,
      realSaleCents,
      totalCostCents,
      profitCents,
      marginPercent,
      coverageBuckets,
    };
  }, [rows]);

  // ====== Submit ======
  const submit = useCallback(async () => {
    if (!product) return;
    if (totalFromAllocations <= 0) {
      setError('Debes seleccionar al menos un stock antes de generar el reparto.');
      return;
    }
    // ⚠️ Saneamos a enteros estrictos. La aritmética flotante puede
    // arrastrar valores tipo `53.999999` que el backend interpola en queries
    // SQL y genera errores de tipo `numeric` (vistos en producción).
    const safeRows = rows.map((r) => ({ ...r, quantityBase: Math.round(r.quantityBase) }));
    const totalDistributed = safeRows.reduce((s, r) => s + r.quantityBase, 0);
    const totalSelected = Math.round(totalFromAllocations);

    if (totalDistributed !== totalSelected) {
      setError(
        `La suma distribuida (${totalDistributed}) no coincide con el stock seleccionado (${totalSelected}). Pulsa "Recalcular resto".`
      );
      return;
    }
    if (totalDistributed <= 0) {
      setError('Debes distribuir al menos 1 unidad.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Pool greedy de stock seleccionado, también saneado a enteros.
      const pool: { warehouseId: string; areaId: string | null; remaining: number }[] = [];
      stockBuckets.forEach((b) => {
        const qty = stockAllocations[b.key];
        const safeQty = Math.round(Number(qty) || 0);
        if (safeQty > 0) {
          pool.push({ warehouseId: b.warehouseId, areaId: b.areaId, remaining: safeQty });
        }
      });

      const buildSources = (qty: number): DistributionSource[] => {
        const out: DistributionSource[] = [];
        let rem = Math.round(qty);
        for (const bucket of pool) {
          if (rem <= 0) break;
          if (bucket.remaining <= 0) continue;
          const take = Math.round(Math.min(bucket.remaining, rem));
          if (take <= 0) continue;
          bucket.remaining -= take;
          rem -= take;
          out.push({
            warehouseId: bucket.warehouseId,
            areaId: bucket.areaId,
            quantityBase: take,
          });
        }
        return out;
      };

      const distributions: DistributionGenerateItem[] = safeRows
        .filter((r) => r.quantityBase > 0)
        .map((r) => {
          const sources = buildSources(r.quantityBase);
          // Verificación de invariante: la suma de sources debe ser exactamente
          // r.quantityBase (enteros). Si no, hay un bug arriba.
          const sourcesSum = sources.reduce((s, x) => s + x.quantityBase, 0);
          if (sourcesSum !== r.quantityBase) {
            logger.error('❌ [V2] sources no cuadra con quantityBase', {
              participantId: r.participantId,
              quantityBase: r.quantityBase,
              sourcesSum,
              sources,
            });
          }
          const base: DistributionGenerateItem = {
            participantId: r.participantId,
            quantityBase: r.quantityBase,
            roundingFactor: mode === 'presentation' ? presentationFactor : 1,
            sources,
            notes: r.participantName,
          };
          if (mode === 'presentation' && presentationId && presentationFactor > 1) {
            // En modo presentación enviamos cajas como cantidad entera.
            // Las "medias cajas" suman a quantityBase pero no se reportan como
            // unidades de presentación (el backend recibiría decimales).
            const qPres = Math.floor(r.quantityBase / presentationFactor);
            if (qPres > 0) {
              base.presentationId = presentationId;
              base.quantityPresentation = qPres;
              base.factorToBase = presentationFactor;
            }
          }
          return base;
        });

      const payload = {
        distributions,
        notes: `Reparto V2 - ${new Date().toLocaleString()}`,
      };
      logger.debug('📤 [V2] generateDistribution payload', {
        campaignId,
        productId: product.id,
        mode,
        presentationFactor,
        presentationId,
        totalFromAllocations,
        distributionsCount: distributions.length,
        payload,
      });
      await campaignsService.generateDistribution(campaignId, product.id, payload);
      onSuccess();
      onClose();
    } catch (e: any) {
      logger.error('❌ [V2] Error generando reparto', {
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message,
      });
      const backendMsg =
        e?.response?.data?.message ??
        e?.response?.data?.error ??
        (typeof e?.response?.data === 'string' ? e.response.data : null);
      setError(backendMsg ?? e?.message ?? 'No se pudo generar el reparto.');
    } finally {
      setSubmitting(false);
    }
  }, [
    product,
    rows,
    stockBuckets,
    stockAllocations,
    totalFromAllocations,
    mode,
    presentationFactor,
    presentationId,
    campaignId,
    onSuccess,
    onClose,
  ]);

  return {
    loading,
    submitting,
    error,
    currentSite,
    currentCompany,
    stockBuckets,
    stockAllocations,
    setStockAllocation,
    toggleStockBucket,
    totalFromAllocations,
    mode,
    setMode,
    allowHalfBox,
    setAllowHalfBox,
    allowLoose,
    setAllowLoose,
    remainderRecipientId,
    setRemainderRecipientId,
    presentationId,
    presentationFactor,
    presentations,
    setPresentationId,
    isEvenFactor,
    distributionType,
    setDistributionType,
    selectedParticipants,
    toggleParticipant,
    rows,
    internalRows,
    externalRows,
    updateRowQuantities,
    toggleRowLock,
    recalculateRest,
    resetRows,
    totals,
    submit,
  };
}
