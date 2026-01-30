import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, ProductFilters, CreateProductDto, UpdateProductDto } from '@/services/api/products';
import { logger } from '@/utils/logger';

// Query keys para productos
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters?: ProductFilters) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
  bySku: (sku: string) => [...productKeys.all, 'sku', sku] as const,
  salePrices: (productId: string) => [...productKeys.all, 'salePrices', productId] as const,
  images: (productId: string) => [...productKeys.all, 'images', productId] as const,
};

/**
 * Hook para obtener lista de productos con filtros
 * Incluye caché automático y refetch inteligente
 * ✅ Usa endpoint v2 optimizado con includePhotos
 */
export const useProducts = (filters?: ProductFilters) => {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => {
      // ✅ Convertir sortOrder a mayúsculas si existe
      const sortOrder = filters?.sortOrder
        ? (filters.sortOrder.toUpperCase() as 'ASC' | 'DESC')
        : undefined;

      // ✅ Usar endpoint v2 optimizado con fotos
      return productsApi.getProductsV2({
        page: filters?.page,
        limit: filters?.limit,
        categoryId: filters?.categoryId,
        status: filters?.status,
        q: filters?.q,
        includePhotos: true, // ✅ Incluir fotos para miniaturas
        sortBy: filters?.sortBy, // ✅ Pasar sortBy al API
        sortOrder, // ✅ Pasar sortOrder en mayúsculas
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
};

/**
 * Hook para obtener detalle de un producto por ID
 */
export const useProduct = (id: string, enabled = true) => {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productsApi.getProductById(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para obtener producto por SKU
 */
export const useProductBySku = (sku: string, enabled = true) => {
  return useQuery({
    queryKey: productKeys.bySku(sku),
    queryFn: () => productsApi.getProductBySku(sku),
    enabled: enabled && !!sku,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook para obtener precios de venta de un producto
 */
export const useProductSalePrices = (productId: string, enabled = true) => {
  return useQuery({
    queryKey: productKeys.salePrices(productId),
    queryFn: () => productsApi.getProductSalePrices(productId),
    enabled: enabled && !!productId,
    staleTime: 3 * 60 * 1000, // 3 minutos (precios cambian más frecuentemente)
  });
};

/**
 * Hook para obtener imágenes de un producto
 */
export const useProductImages = (productId: string, enabled = true) => {
  return useQuery({
    queryKey: productKeys.images(productId),
    queryFn: () => productsApi.getProductImages(productId),
    enabled: enabled && !!productId,
    staleTime: 10 * 60 * 1000, // 10 minutos (imágenes no cambian frecuentemente)
  });
};

/**
 * Hook para crear un producto
 * Invalida automáticamente la lista de productos
 */
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productData: CreateProductDto) => productsApi.createProduct(productData),
    onSuccess: (newProduct) => {
      // Invalidar lista de productos para refetch
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });

      // Agregar el nuevo producto al caché de detalle
      queryClient.setQueryData(productKeys.detail(newProduct.id), newProduct);

      logger.info('Producto creado exitosamente', { productId: newProduct.id });
    },
    onError: (error) => {
      logger.error('Error al crear producto', error);
    },
  });
};

/**
 * Hook para actualizar un producto
 * Invalida automáticamente el caché relacionado
 */
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductDto }) =>
      productsApi.updateProduct(id, data),
    onSuccess: (updatedProduct, variables) => {
      // Actualizar el caché de detalle
      queryClient.setQueryData(productKeys.detail(variables.id), updatedProduct);

      // Invalidar listas para refetch
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });

      // Invalidar precios si se actualizaron
      if (variables.data.salePrices) {
        queryClient.invalidateQueries({ queryKey: productKeys.salePrices(variables.id) });
      }

      logger.info('Producto actualizado exitosamente', { productId: variables.id });
    },
    onError: (error) => {
      logger.error('Error al actualizar producto', error);
    },
  });
};

/**
 * Hook para eliminar un producto (soft delete)
 * Invalida automáticamente el caché
 */
export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productsApi.deleteProduct(id),
    onSuccess: (_, productId) => {
      // Remover del caché de detalle
      queryClient.removeQueries({ queryKey: productKeys.detail(productId) });

      // Invalidar listas
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });

      logger.info('Producto eliminado exitosamente', { productId });
    },
    onError: (error) => {
      logger.error('Error al eliminar producto', error);
    },
  });
};

/**
 * Hook para actualizar precio de venta de un producto
 */
export const useUpdateProductSalePrice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productId,
      priceData,
    }: {
      productId: string;
      priceData: {
        productId: string;
        presentationId?: string | null;
        profileId: string;
        priceCents: number;
      };
    }) => productsApi.updateProductSalePrice(productId, priceData),
    onSuccess: (_, variables) => {
      // Invalidar precios del producto
      queryClient.invalidateQueries({ queryKey: productKeys.salePrices(variables.productId) });

      // Invalidar detalle del producto
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.productId) });

      logger.info('Precio de venta actualizado', { productId: variables.productId });
    },
    onError: (error) => {
      logger.error('Error al actualizar precio de venta', error);
    },
  });
};

/**
 * Hook para recalcular precios de un producto
 */
export const useRecalculateProductPrices = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => productsApi.recalculateProductPrices(productId),
    onSuccess: (_, productId) => {
      // Invalidar precios del producto
      queryClient.invalidateQueries({ queryKey: productKeys.salePrices(productId) });

      // Invalidar detalle del producto
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });

      logger.info('Precios recalculados exitosamente', { productId });
    },
    onError: (error) => {
      logger.error('Error al recalcular precios', error);
    },
  });
};

/**
 * Hook para subir productos en bulk
 */
export const useUploadBulkProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File | Blob | any) => productsApi.uploadBulkProducts(file),
    onSuccess: (result) => {
      // Invalidar todas las listas de productos
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });

      logger.info('Carga masiva completada', {
        successCount: result.successCount,
        errorCount: result.errorCount,
      });
    },
    onError: (error) => {
      logger.error('Error en carga masiva de productos', error);
    },
  });
};
