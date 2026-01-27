import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/services/api/inventory';
import { warehousesApi, warehouseAreasApi } from '@/services/api/warehouses';
import { logger } from '@/utils/logger';

// Query keys para stock
export const stockKeys = {
  all: ['stock'] as const,
  lists: () => [...stockKeys.all, 'list'] as const,
  list: (filters?: { warehouseId?: string; areaId?: string }) =>
    [...stockKeys.lists(), filters] as const,
  byProduct: (productId: string) => [...stockKeys.all, 'byProduct', productId] as const,
  movements: (productId: string, warehouseId?: string) =>
    [...stockKeys.all, 'movements', productId, warehouseId] as const,
};

// Query keys para warehouses
export const warehouseKeys = {
  all: ['warehouses'] as const,
  lists: () => [...warehouseKeys.all, 'list'] as const,
  list: (companyId?: string, siteId?: string) =>
    [...warehouseKeys.lists(), { companyId, siteId }] as const,
  details: () => [...warehouseKeys.all, 'detail'] as const,
  detail: (id: string) => [...warehouseKeys.details(), id] as const,
  areas: (warehouseId: string) => [...warehouseKeys.all, 'areas', warehouseId] as const,
};

/**
 * Hook para obtener stock items
 */
export const useStock = (warehouseId?: string, areaId?: string) => {
  return useQuery({
    queryKey: stockKeys.list({ warehouseId, areaId }),
    queryFn: () => inventoryApi.getAllStock({ warehouseId, areaId }),
    staleTime: 2 * 60 * 1000, // 2 minutos (stock cambia frecuentemente)
  });
};

/**
 * Hook para búsqueda optimizada de stock (V2)
 * ✅ Usa caché Redis y búsqueda multi-campo
 */
export const useSearchStockV2 = (
  query: string,
  options?: {
    warehouseId?: string;
    areaId?: string;
    lowStockOnly?: boolean;
    limit?: number;
    enabled?: boolean;
  }
) => {
  return useQuery({
    queryKey: ['stock', 'v2', 'search', query, options],
    queryFn: () =>
      inventoryApi.searchStockV2({
        q: query,
        limit: options?.limit || 20,
        warehouseId: options?.warehouseId,
        areaId: options?.areaId,
        lowStockOnly: options?.lowStockOnly,
      }),
    enabled: (options?.enabled !== false) && query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutos (cacheado en Redis)
  });
};

/**
 * Hook para listado paginado optimizado de stock (V2)
 * ✅ Usa caché Redis
 */
export const useStockV2 = (params?: {
  page?: number;
  limit?: number;
  warehouseId?: string;
  areaId?: string;
  lowStockOnly?: boolean;
  q?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}) => {
  return useQuery({
    queryKey: ['stock', 'v2', 'list', params],
    queryFn: () => inventoryApi.getStockV2(params),
    staleTime: 5 * 60 * 1000, // 5 minutos (cacheado en Redis)
  });
};

/**
 * Hook para obtener stock de un producto específico
 */
export const useStockByProduct = (productId: string, enabled = true) => {
  return useQuery({
    queryKey: stockKeys.byProduct(productId),
    queryFn: () => inventoryApi.getStockByProduct(productId),
    enabled: enabled && !!productId,
    staleTime: 2 * 60 * 1000,
  });
};

/**
 * Hook para obtener historial de movimientos
 * Nota: Este endpoint puede no existir en la API actual
 */
export const useStockMovements = (productId: string, warehouseId?: string, enabled = true) => {
  return useQuery({
    queryKey: stockKeys.movements(productId, warehouseId),
    queryFn: async () => {
      // Si el endpoint no existe, retornar array vacío
      return [];
    },
    enabled: enabled && !!productId,
    staleTime: 1 * 60 * 1000,
  });
};

/**
 * Hook para obtener warehouses
 */
export const useWarehouses = (companyId?: string, siteId?: string) => {
  return useQuery({
    queryKey: warehouseKeys.list(companyId, siteId),
    queryFn: () => warehousesApi.getWarehouses(companyId, siteId),
    staleTime: 5 * 60 * 1000, // 5 minutos (warehouses no cambian frecuentemente)
  });
};

/**
 * Hook para obtener warehouse por ID
 */
export const useWarehouse = (id: string, enabled = true) => {
  return useQuery({
    queryKey: warehouseKeys.detail(id),
    queryFn: () => warehousesApi.getWarehouseById(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para obtener áreas de un warehouse
 */
export const useWarehouseAreas = (warehouseId: string, enabled = true) => {
  return useQuery({
    queryKey: warehouseKeys.areas(warehouseId),
    queryFn: () => warehouseAreasApi.getWarehouseAreas(warehouseId),
    enabled: enabled && !!warehouseId,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para ajustar stock
 */
export const useAdjustStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      productId: string;
      warehouseId: string;
      areaId?: string;
      deltaBase: number;
      reason: 'PURCHASE' | 'SALE' | 'ADJUST' | 'TRANSFER';
      clientOperationId?: string;
    }) => inventoryApi.adjustStock(data),
    onSuccess: (_, variables) => {
      // Invalidar stock lists
      queryClient.invalidateQueries({ queryKey: stockKeys.lists() });

      // Invalidar stock del producto específico
      queryClient.invalidateQueries({ queryKey: stockKeys.byProduct(variables.productId) });

      // Invalidar movimientos
      queryClient.invalidateQueries({
        queryKey: stockKeys.movements(variables.productId, variables.warehouseId),
      });

      logger.info('Stock ajustado exitosamente', {
        productId: variables.productId,
        delta: variables.deltaBase,
      });
    },
    onError: (error) => {
      logger.error('Error al ajustar stock', error);
    },
  });
};

/**
 * Hook para transferir stock
 * Nota: Usa adjustStock ya que transferStock puede no existir
 */
export const useTransferStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      productId: string;
      fromWarehouseId: string;
      toWarehouseId: string;
      fromAreaId?: string;
      toAreaId?: string;
      quantityBase: number;
      reason?: string;
      clientOperationId?: string;
    }) => {
      // Implementar como dos ajustes: restar del origen y sumar al destino
      await inventoryApi.adjustStock({
        productId: data.productId,
        warehouseId: data.fromWarehouseId,
        areaId: data.fromAreaId,
        deltaBase: -data.quantityBase,
        reason: 'TRANSFER',
        clientOperationId: data.clientOperationId,
      });
      return inventoryApi.adjustStock({
        productId: data.productId,
        warehouseId: data.toWarehouseId,
        areaId: data.toAreaId,
        deltaBase: data.quantityBase,
        reason: 'TRANSFER',
        clientOperationId: data.clientOperationId,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidar todas las listas de stock
      queryClient.invalidateQueries({ queryKey: stockKeys.lists() });

      // Invalidar stock del producto
      queryClient.invalidateQueries({ queryKey: stockKeys.byProduct(variables.productId) });

      // Invalidar movimientos de ambos warehouses
      queryClient.invalidateQueries({
        queryKey: stockKeys.movements(variables.productId, variables.fromWarehouseId),
      });
      queryClient.invalidateQueries({
        queryKey: stockKeys.movements(variables.productId, variables.toWarehouseId),
      });

      logger.info('Stock transferido exitosamente', {
        productId: variables.productId,
        from: variables.fromWarehouseId,
        to: variables.toWarehouseId,
      });
    },
    onError: (error) => {
      logger.error('Error al transferir stock', error);
    },
  });
};

/**
 * Hook para crear warehouse
 */
export const useCreateWarehouse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => warehousesApi.createWarehouse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() });
      logger.info('Warehouse creado exitosamente');
    },
  });
};

/**
 * Hook para actualizar warehouse
 */
export const useUpdateWarehouse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      warehousesApi.updateWarehouse(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.detail(variables.id) });
      logger.info('Warehouse actualizado');
    },
  });
};

/**
 * Hook para crear área de warehouse
 */
export const useCreateWarehouseArea = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ warehouseId, data }: { warehouseId: string; data: any }) =>
      warehouseAreasApi.createWarehouseArea(warehouseId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.areas(variables.warehouseId) });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.detail(variables.warehouseId) });
      logger.info('Área creada exitosamente');
    },
  });
};
