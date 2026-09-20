import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotCrateApi } from '@/services/api';
import type {
  ChatbotCrateProduct,
  UpdateCrateProductBody,
  UpsertCrateProductBody,
} from '@/types/chatbot';

// ============================================
// Query Keys Factory
// ============================================
export const chatbotCrateKeys = {
  all: ['chatbot-crate'] as const,
  list: () => [...chatbotCrateKeys.all, 'list'] as const,
};

const CRATE_STALE_TIME = 5 * 60 * 1000; // 5 min

// ============================================
// Queries
// ============================================
export const useCrateProductsList = () => {
  return useQuery<ChatbotCrateProduct[]>({
    queryKey: chatbotCrateKeys.list(),
    queryFn: () => chatbotCrateApi.list(),
    staleTime: CRATE_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

// ============================================
// Mutations
// ============================================
export const useCreateCrateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation<ChatbotCrateProduct, Error, UpsertCrateProductBody>({
    mutationFn: (body) => chatbotCrateApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotCrateKeys.all });
    },
  });
};

export const useUpdateCrateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation<ChatbotCrateProduct, Error, { id: string; body: UpdateCrateProductBody }>({
    mutationFn: ({ id, body }) => chatbotCrateApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotCrateKeys.all });
    },
  });
};

export const useDeleteCrateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => chatbotCrateApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotCrateKeys.all });
    },
  });
};
