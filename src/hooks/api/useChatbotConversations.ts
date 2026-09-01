import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotConversationsApi } from '@/services/api';
import type {
  ConversationSearchItem,
  GetChatMessagesParams,
  GetConversationsParams,
  HandoffBody,
  PagedConversations,
  PagedMessages,
  SearchConversationsParams,
  SendReplyBody,
} from '@/types/chatbot';

// ============================================
// Query Keys Factory
// ============================================
export const chatbotConversationsKeys = {
  all: ['chatbot-conversations'] as const,
  lists: () => [...chatbotConversationsKeys.all, 'list'] as const,
  list: (params?: Omit<GetConversationsParams, 'before'>) =>
    [...chatbotConversationsKeys.lists(), params] as const,
  search: (params: SearchConversationsParams) =>
    [...chatbotConversationsKeys.all, 'search', params] as const,
  messages: (conversationId: string, params?: GetChatMessagesParams) =>
    [...chatbotConversationsKeys.all, 'messages', conversationId, params] as const,
};

const CONVERSATIONS_STALE_TIME = 15 * 1000; // 15s (chat activo)
const SEARCH_STALE_TIME = 30 * 1000; // 30s (autocompletado)

// ============================================
// Queries
// ============================================

/**
 * Bandeja paginada (scroll infinito) por cursor `before` = ISO del último
 * `lastMessageAt`. Soporta filtros por estado de compra y estado de chat.
 *
 * - Primera página: los chats con último mensaje más reciente.
 * - `fetchNextPage()` carga chats más antiguos.
 * - `refetchIntervalMs`: refresca la primera página para nuevos mensajes.
 */
export const useConversationsList = (
  params?: Omit<GetConversationsParams, 'before'>,
  options?: { refetchIntervalMs?: number }
) => {
  const limit = params?.limit ?? 30;
  return useInfiniteQuery<PagedConversations, Error>({
    queryKey: chatbotConversationsKeys.list({ ...params, limit }),
    queryFn: ({ pageParam }) =>
      chatbotConversationsApi.list({
        ...params,
        limit,
        before: (pageParam as string) || undefined,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: CONVERSATIONS_STALE_TIME,
    refetchOnWindowFocus: false,
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
};

/**
 * Buscador con autocompletado (por nombre o teléfono). Deshabilitado si `q`
 * está vacío. Pensado para debouncing en el input del caller.
 */
export const useConversationsSearch = (
  params: SearchConversationsParams,
  options?: { enabled?: boolean }
) => {
  const trimmed = params.q?.trim() ?? '';
  return useQuery<ConversationSearchItem[]>({
    queryKey: chatbotConversationsKeys.search({ ...params, q: trimmed }),
    queryFn: () => chatbotConversationsApi.search({ ...params, q: trimmed }),
    enabled: (options?.enabled ?? true) && trimmed.length > 0,
    staleTime: SEARCH_STALE_TIME,
    refetchOnWindowFocus: false,
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
