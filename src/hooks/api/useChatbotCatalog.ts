import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotCatalogApi } from '@/services/api';
import { productsApi } from '@/services/api/products';
import type { Product } from '@/services/api/products';
import { warehousesApi } from '@/services/api/warehouses';
import type { Warehouse } from '@/types/warehouses';
import { inventoryApi } from '@/services/api/inventory';
import type { StockItemResponse } from '@/services/api/inventory';
import type {
  CreateSellableProductBody,
  SellableProduct,
  UpdateSellableProductBody,
} from '@/types/chatbot';

// ============================================
// Query Keys Factory
// ============================================
export const chatbotCatalogKeys = {
  all: ['chatbot-catalog'] as const,
  list: () => [...chatbotCatalogKeys.all, 'list'] as const,
  productsBatch: (ids: string[]) =>
    [...chatbotCatalogKeys.all, 'products-batch', [...ids].sort()] as const,
  siteWarehouses: (companyId: string | null, siteId: string | null) =>
    [...chatbotCatalogKeys.all, 'site-warehouses', companyId, siteId] as const,
  siteStock: (siteId: string | null) => [...chatbotCatalogKeys.all, 'site-stock', siteId] as const,
};

const CATALOG_STALE_TIME = 5 * 60 * 1000; // 5 min

// ============================================
// Queries
// ============================================

export const useSellableProductsList = () => {
  return useQuery<SellableProduct[]>({
    queryKey: chatbotCatalogKeys.list(),
    queryFn: () => chatbotCatalogApi.list(),
    staleTime: CATALOG_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

/**
 * Batch de productos por IDs (POST /admin/products/v2/batch).
 * Devuelve un Map<productId, Product> para hidratar con presentaciones,
 * fotos, stock por sede, precios, etc. Se usa para enriquecer el catálogo
 * del chatbot y el formulario de whitelist al seleccionar un producto.
 */
/**
 * Warehouses (con sus áreas) de la sede seleccionada del tenant.
 * Se usa para filtrar el stock del producto por la sede activa y para saber
 * exactamente de qué warehouse+area se toma el stock vendible del chatbot.
 */
export const useSiteWarehouses = (companyId: string | null, siteId: string | null) => {
  return useQuery<Warehouse[]>({
    queryKey: chatbotCatalogKeys.siteWarehouses(companyId, siteId),
    queryFn: () => warehousesApi.getWarehouses(companyId ?? undefined, siteId ?? undefined),
    enabled: !!companyId && !!siteId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Stock detallado (por warehouse + area) de la sede activa.
 * Sigue el patrón de Campañas → `AddProductScreen` que carga todo el stock
 * una vez y lo usa como fuente de verdad para computar disponibilidad por
 * producto, dado que `Product.stockItems` del endpoint de productos puede
 * venir vacío según el shape del backend.
 *
 * `GET /inventory/stock?siteId=...` devuelve StockItemResponse[].
 */
export const useSiteStock = (siteId: string | null) => {
  return useQuery<StockItemResponse[]>({
    queryKey: chatbotCatalogKeys.siteStock(siteId),
    queryFn: () => inventoryApi.getAllStock(siteId ? { siteId } : {}),
    enabled: !!siteId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useProductsByIdsBatch = (ids: string[], includePhotos = true) => {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  return useQuery<Map<string, Product>>({
    queryKey: chatbotCatalogKeys.productsBatch(uniqueIds),
    queryFn: async () => {
      if (uniqueIds.length === 0) return new Map();
      const res = await productsApi.getProductsByIds(uniqueIds, includePhotos);
      const map = new Map<string, Product>();
      res.products.forEach((p) => map.set(p.id, p));
      return map;
    },
    enabled: uniqueIds.length > 0,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

// ============================================
// Mutations
// ============================================

export const useCreateSellableProduct = () => {
  const queryClient = useQueryClient();
  return useMutation<SellableProduct, Error, CreateSellableProductBody>({
    mutationFn: (body) => chatbotCatalogApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotCatalogKeys.all });
    },
  });
};

export const useUpdateSellableProduct = () => {
  const queryClient = useQueryClient();
  return useMutation<SellableProduct, Error, { id: string; body: UpdateSellableProductBody }>({
    mutationFn: ({ id, body }) => chatbotCatalogApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotCatalogKeys.all });
    },
  });
};

export const useDeleteSellableProduct = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => chatbotCatalogApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotCatalogKeys.all });
    },
  });
};
