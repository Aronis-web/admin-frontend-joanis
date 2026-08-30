import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotOrdersApi } from '@/services/api';
import type {
  ChatbotOrder,
  GetChatbotOrdersParams,
  RejectChatbotOrderBody,
  ValidateChatbotOrderResponse,
} from '@/types/chatbot';

// ============================================
// Query Keys Factory
// ============================================
export const chatbotOrdersKeys = {
  all: ['chatbot-orders'] as const,
  lists: () => [...chatbotOrdersKeys.all, 'list'] as const,
  list: (params?: GetChatbotOrdersParams) => [...chatbotOrdersKeys.lists(), params] as const,
};

const ORDERS_STALE_TIME = 30 * 1000;

// ============================================
// Queries
// ============================================

export const useChatbotOrdersList = (
  params?: GetChatbotOrdersParams,
  options?: { refetchIntervalMs?: number }
) => {
  return useQuery<ChatbotOrder[]>({
    queryKey: chatbotOrdersKeys.list(params),
    queryFn: () => chatbotOrdersApi.list(params),
    staleTime: ORDERS_STALE_TIME,
    refetchOnWindowFocus: false,
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

// ============================================
// Mutations
// ============================================

export const useValidateChatbotOrder = () => {
  const queryClient = useQueryClient();
  return useMutation<ValidateChatbotOrderResponse, Error, string>({
    mutationFn: (id) => chatbotOrdersApi.validate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotOrdersKeys.lists() });
    },
  });
};

export const useRejectChatbotOrder = () => {
  const queryClient = useQueryClient();
  return useMutation<ChatbotOrder, Error, { id: string; body?: RejectChatbotOrderBody }>({
    mutationFn: ({ id, body }) => chatbotOrdersApi.reject(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotOrdersKeys.lists() });
    },
  });
};
