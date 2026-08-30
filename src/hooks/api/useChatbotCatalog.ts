import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotCatalogApi } from '@/services/api';
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
