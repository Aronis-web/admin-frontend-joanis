import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  productVariantsApi,
  ProductVariant,
  CreateProductVariantDto,
  UpdateProductVariantDto,
} from '@/services/api/product-variants';
import { productKeys } from './useProducts';
import { productCodeKeys } from './useProductCodes';
import { logger } from '@/utils/logger';

// Query keys para variantes
export const productVariantKeys = {
  all: ['product-variants'] as const,
  list: (productId: string) => [...productVariantKeys.all, 'list', productId] as const,
};

/**
 * Lista las variantes de un producto
 */
export const useProductVariants = (productId: string, enabled = true) => {
  return useQuery({
    queryKey: productVariantKeys.list(productId),
    queryFn: () => productVariantsApi.getVariants(productId),
    enabled: enabled && !!productId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Invalida las queries relacionadas cuando cambia una variante.
 * Al cambiar sku/barcode el backend sincroniza codigos alternos.
 */
const invalidateRelated = (queryClient: ReturnType<typeof useQueryClient>, productId: string) => {
  queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
  queryClient.invalidateQueries({ queryKey: productCodeKeys.list(productId) });
};

/**
 * Crea una variante
 */
export const useCreateProductVariant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: CreateProductVariantDto }) =>
      productVariantsApi.createVariant(productId, data),
    onSuccess: (created, { productId }) => {
      queryClient.setQueryData<ProductVariant[] | undefined>(
        productVariantKeys.list(productId),
        (prev) => (prev ? [...prev, created] : [created])
      );
      invalidateRelated(queryClient, productId);
      logger.info('Variante creada', { productId, variantId: created.id });
    },
    onError: (error) => {
      logger.error('Error al crear variante', error);
    },
  });
};

/**
 * Edita una variante
 */
export const useUpdateProductVariant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productId,
      variantId,
      data,
    }: {
      productId: string;
      variantId: string;
      data: UpdateProductVariantDto;
    }) => productVariantsApi.updateVariant(productId, variantId, data),
    onSuccess: (updated, { productId }) => {
      queryClient.setQueryData<ProductVariant[] | undefined>(
        productVariantKeys.list(productId),
        (prev) => prev?.map((v) => (v.id === updated.id ? updated : v))
      );
      invalidateRelated(queryClient, productId);
      logger.info('Variante actualizada', { productId, variantId: updated.id });
    },
    onError: (error) => {
      logger.error('Error al actualizar variante', error);
    },
  });
};

/**
 * Borra (soft delete) una variante y sus codigos alternos asociados
 */
export const useDeleteProductVariant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, variantId }: { productId: string; variantId: string }) =>
      productVariantsApi.deleteVariant(productId, variantId),
    onSuccess: (_res, { productId, variantId }) => {
      queryClient.setQueryData<ProductVariant[] | undefined>(
        productVariantKeys.list(productId),
        (prev) => prev?.filter((v) => v.id !== variantId)
      );
      invalidateRelated(queryClient, productId);
      logger.info('Variante eliminada', { productId, variantId });
    },
    onError: (error) => {
      logger.error('Error al eliminar variante', error);
    },
  });
};
