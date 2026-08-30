import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotConversationsApi } from '@/services/api';
import type {
  ChatConversation,
  GetChatMessagesParams,
  GetConversationsParams,
  HandoffBody,
  PagedMessages,
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

/**
 * Mensajes paginados por cursor (`before` = ISO del más antiguo).
 *
 * - La primera página trae los más recientes.
 * - `fetchNextPage()` carga mensajes MÁS ANTIGUOS (scroll hacia arriba).
 * - `refetch()` refresca la página más reciente para nuevos mensajes.
 */
export const useConversationMessages = (
  conversationId: string | undefined,
  params?: Omit<GetChatMessagesParams, 'before'>,
  options?: { refetchIntervalMs?: number }
) => {
  const limit = params?.limit ?? 50;
  return useInfiniteQuery<PagedMessages, Error>({
    queryKey: chatbotConversationsKeys.messages(conversationId ?? '', { limit }),
    queryFn: ({ pageParam }) =>
      chatbotConversationsApi.getMessages(conversationId as string, {
        limit,
        before: (pageParam as string) || undefined,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
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
