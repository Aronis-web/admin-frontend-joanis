import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/services/api/customers';
import type { QueryCustomersAutocompleteParams, QueryCustomersParams } from '@/types/customers';
import { logger } from '@/utils/logger';

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params?: QueryCustomersParams) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
  autocompletes: () => [...customerKeys.all, 'autocomplete'] as const,
  autocomplete: (params: QueryCustomersAutocompleteParams) =>
    [...customerKeys.autocompletes(), params] as const,
};

/**
 * Lista paginada y filtrada de clientes.
 */
export const useCustomers = (params?: QueryCustomersParams) =>
  useQuery({
    queryKey: customerKeys.list(params),
    queryFn: ({ signal }) => customersApi.getCustomers(params, signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

/**
 * Typeahead de clientes. El caller debe debouncear el término de búsqueda.
 */
export const useCustomersAutocomplete = (
  params: QueryCustomersAutocompleteParams,
  enabled = true
) => {
  const normalizedParams = {
    ...params,
    query: params.query.trim(),
    limit: Math.min(50, Math.max(1, params.limit ?? 10)),
  };

  return useQuery({
    queryKey: customerKeys.autocomplete(normalizedParams),
    queryFn: ({ signal }) => customersApi.getCustomersAutocomplete(normalizedParams, signal),
    enabled: enabled && normalizedParams.query.length >= 2,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
};

/**
 * Elimina un cliente y limpia su caché relacionada.
 */
export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => customersApi.deleteCustomer(id),
    onSuccess: async (_, customerId) => {
      queryClient.removeQueries({ queryKey: customerKeys.detail(customerId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: customerKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: customerKeys.autocompletes() }),
      ]);
      logger.info('Cliente eliminado exitosamente', { customerId });
    },
    onError: (error) => {
      logger.error('Error al eliminar cliente', error);
    },
  });
};
