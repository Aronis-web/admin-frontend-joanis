import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotConversationsApi } from '@/services/api';
import type {
  ChatConversation,
  ChatMessage,
  GetChatMessagesParams,
  GetConversationsParams,
  HandoffBody,
  SendReplyBody,
} from '@/types/chatbot';

// ============================================
// Query Keys Factory
// ============================================
export const chatbotConversationsKeys = {
  all: ['chatbot-conversations'] as const,
  lists: () => [...chatbotConversationsKeys.all, 'list'] as const,
  list: (params?: GetConversationsParams) => [...chatbotConversationsKeys.lists(), params] as const,
  messages: (conversationId: string, params?: GetChatMessagesParams) =>
    [...chatbotConversationsKeys.all, 'messages', conversationId, params] as const,
};

const CONVERSATIONS_STALE_TIME = 15 * 1000; // 15s (chat activo)

// ============================================
// Queries
// ============================================

export const useConversationsList = (
  params?: GetConversationsParams,
  options?: { refetchIntervalMs?: number }
) => {
  return useQuery<ChatConversation[]>({
    queryKey: chatbotConversationsKeys.list(params),
    queryFn: () => chatbotConversationsApi.list(params),
    staleTime: CONVERSATIONS_STALE_TIME,
    refetchOnWindowFocus: false,
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

export const useConversationMessages = (
  conversationId: string | undefined,
  params?: GetChatMessagesParams,
  options?: { refetchIntervalMs?: number }
) => {
  return useQuery<ChatMessage[]>({
    queryKey: chatbotConversationsKeys.messages(conversationId ?? '', params),
    queryFn: () => chatbotConversationsApi.getMessages(conversationId as string, params),
    enabled: !!conversationId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

// ============================================
// Mutations
// ============================================

export const useHandoffConversation = () => {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { id: string; body: HandoffBody }>({
    mutationFn: ({ id, body }) => chatbotConversationsApi.handoff(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotConversationsKeys.lists() });
    },
  });
};

export const useReplyConversation = () => {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { id: string; body: SendReplyBody }>({
    mutationFn: ({ id, body }) => chatbotConversationsApi.reply(id, body),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: chatbotConversationsKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: [...chatbotConversationsKeys.all, 'messages', id],
      });
    },
  });
};
