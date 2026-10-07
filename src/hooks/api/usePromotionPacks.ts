import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { promotionPacksApi } from '@/services/api';
import type {
  AdminPackView,
  CreatePackBody,
  PackPreview,
  UpdatePackBody,
} from '@/types/promotions';

// ============================================
// Query Keys Factory
// ============================================
export const promotionPacksKeys = {
  all: ['promotion-packs'] as const,
  list: () => [...promotionPacksKeys.all, 'list'] as const,
  detail: (id: string) => [...promotionPacksKeys.all, 'detail', id] as const,
  preview: (id: string) => [...promotionPacksKeys.all, 'preview', id] as const,
};

const PACKS_STALE_TIME = 60 * 1000; // 1 min

// ============================================
// Queries
// ============================================
export const usePromotionPacksList = () => {
  return useQuery<AdminPackView[]>({
    queryKey: promotionPacksKeys.list(),
    queryFn: () => promotionPacksApi.list(),
    staleTime: PACKS_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

export const usePromotionPack = (id: string | null) => {
  return useQuery<AdminPackView>({
    queryKey: promotionPacksKeys.detail(id ?? ''),
    queryFn: () => promotionPacksApi.get(id as string),
    enabled: !!id,
    staleTime: PACKS_STALE_TIME,
  });
};

/** Cómo saldrá el pack en la boleta (precio repartido por componente). */
export const usePromotionPackPreview = (id: string | null) => {
  return useQuery<PackPreview>({
    queryKey: promotionPacksKeys.preview(id ?? ''),
    queryFn: () => promotionPacksApi.preview(id as string),
    enabled: !!id,
    staleTime: 0,
  });
};

// ============================================
// Mutations
// ============================================
export const useCreatePromotionPack = () => {
  const queryClient = useQueryClient();
  return useMutation<AdminPackView, Error, CreatePackBody>({
    mutationFn: (body) => promotionPacksApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: promotionPacksKeys.all });
    },
  });
};

export const useUpdatePromotionPack = () => {
  const queryClient = useQueryClient();
  return useMutation<AdminPackView, Error, { id: string; body: UpdatePackBody }>({
    mutationFn: ({ id, body }) => promotionPacksApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: promotionPacksKeys.all });
    },
  });
};

export const useSetPromotionPackActive = () => {
  const queryClient = useQueryClient();
  return useMutation<AdminPackView, Error, { id: string; isActive: boolean }>({
    mutationFn: ({ id, isActive }) => promotionPacksApi.setActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: promotionPacksKeys.all });
    },
  });
};

export const useDeletePromotionPack = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => promotionPacksApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: promotionPacksKeys.all });
    },
  });
};
