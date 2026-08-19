import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  productCodesApi,
  ProductCode,
  CreateProductCodeDto,
  UpdateProductCodeDto,
} from '@/services/api/product-codes';
import { productKeys } from './useProducts';
import { logger } from '@/utils/logger';

// Query keys para codigos alternos
export const productCodeKeys = {
  all: ['product-codes'] as const,
  list: (productId: string) => [...productCodeKeys.all, 'list', productId] as const,
};

/**
 * Lista los codigos alternos de un producto
 */
export const useProductCodes = (productId: string, enabled = true) => {
  return useQuery({
    queryKey: productCodeKeys.list(productId),
    queryFn: () => productCodesApi.getCodes(productId),
    enabled: enabled && !!productId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Crea un codigo alterno del producto
 */
export const useCreateProductCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: CreateProductCodeDto }) =>
      productCodesApi.createCode(productId, data),
    onSuccess: (created, { productId }) => {
      queryClient.setQueryData<ProductCode[] | undefined>(
        productCodeKeys.list(productId),
        (prev) => (prev ? [...prev, created] : [created])
      );
      // El detalle del producto trae altCodes; invalidar para refrescar
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
      logger.info('Codigo alterno creado', { productId, codeId: created.id });
    },
    onError: (error) => {
      logger.error('Error al crear codigo alterno', error);
    },
  });
};

/**
 * Edita un codigo alterno
 */
export const useUpdateProductCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productId,
      codeId,
      data,
    }: {
      productId: string;
      codeId: string;
      data: UpdateProductCodeDto;
    }) => productCodesApi.updateCode(productId, codeId, data),
    onSuccess: (updated, { productId }) => {
      queryClient.setQueryData<ProductCode[] | undefined>(productCodeKeys.list(productId), (prev) =>
        prev?.map((c) => (c.id === updated.id ? updated : c))
      );
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
      logger.info('Codigo alterno actualizado', { productId, codeId: updated.id });
    },
    onError: (error) => {
      logger.error('Error al actualizar codigo alterno', error);
    },
  });
};

/**
 * Borra (soft delete) un codigo alterno
 */
export const useDeleteProductCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, codeId }: { productId: string; codeId: string }) =>
      productCodesApi.deleteCode(productId, codeId),
    onSuccess: (_res, { productId, codeId }) => {
      queryClient.setQueryData<ProductCode[] | undefined>(productCodeKeys.list(productId), (prev) =>
        prev?.filter((c) => c.id !== codeId)
      );
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
      logger.info('Codigo alterno eliminado', { productId, codeId });
    },
    onError: (error) => {
      logger.error('Error al eliminar codigo alterno', error);
    },
  });
};
