import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerLevelsApi } from '@/services/api/customer-levels';
import { customersApi } from '@/services/api/customers';
import { customerKeys } from '@/hooks/api/useCustomers';
import type {
  CreateCustomerLevelRequest,
  GetCustomerLevelsParams,
  UpdateCustomerLevelRequest,
} from '@/types/customer-levels';
import { logger } from '@/utils/logger';

export const customerLevelKeys = {
  all: ['customerLevels'] as const,
  lists: () => [...customerLevelKeys.all, 'list'] as const,
  list: (params?: GetCustomerLevelsParams) => [...customerLevelKeys.lists(), params ?? {}] as const,
  details: () => [...customerLevelKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerLevelKeys.details(), id] as const,
};

/** Lista de niveles comerciales de cliente. */
export const useCustomerLevels = (params?: GetCustomerLevelsParams) =>
  useQuery({
    queryKey: customerLevelKeys.list(params),
    queryFn: ({ signal }) => customerLevelsApi.getLevels(params, signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useCustomerLevel = (id: string | undefined) =>
  useQuery({
    queryKey: customerLevelKeys.detail(id ?? ''),
    queryFn: ({ signal }) => customerLevelsApi.getLevel(id as string, signal),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

export const useCreateCustomerLevel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomerLevelRequest) => customerLevelsApi.createLevel(data),
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: customerLevelKeys.lists() });
      qc.setQueryData(customerLevelKeys.detail(created.id), created);
      logger.info('Nivel de cliente creado', { id: created.id, code: created.code });
    },
    onError: (error) => logger.error('Error al crear nivel de cliente', error),
  });
};

export const useUpdateCustomerLevel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerLevelRequest }) =>
      customerLevelsApi.updateLevel(id, data),
    onSuccess: async (updated) => {
      await qc.invalidateQueries({ queryKey: customerLevelKeys.lists() });
      qc.setQueryData(customerLevelKeys.detail(updated.id), updated);
      logger.info('Nivel de cliente actualizado', { id: updated.id });
    },
    onError: (error) => logger.error('Error al actualizar nivel de cliente', error),
  });
};

export const useDeleteCustomerLevel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerLevelsApi.deleteLevel(id),
    onSuccess: async (_, id) => {
      qc.removeQueries({ queryKey: customerLevelKeys.detail(id) });
      await qc.invalidateQueries({ queryKey: customerLevelKeys.lists() });
      logger.info('Nivel de cliente eliminado', { id });
    },
    onError: (error) => logger.error('Error al eliminar nivel de cliente', error),
  });
};

/**
 * Asigna el nivel a un cliente (o lo limpia con `customerLevelId=null`).
 * Invalida listas y detalles de clientes.
 */
export const useAssignCustomerLevel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerId,
      customerLevelId,
    }: {
      customerId: string;
      customerLevelId: string | null;
    }) => customersApi.assignLevel(customerId, { customerLevelId }),
    onSuccess: async (customer) => {
      qc.setQueryData(customerKeys.detail(customer.id), customer);
      await Promise.all([
        qc.invalidateQueries({ queryKey: customerKeys.lists() }),
        qc.invalidateQueries({ queryKey: customerKeys.autocompletes() }),
      ]);
      logger.info('Nivel asignado al cliente', {
        customerId: customer.id,
        customerLevelId: customer.customerLevelId,
      });
    },
    onError: (error) => logger.error('Error al asignar nivel al cliente', error),
  });
};
