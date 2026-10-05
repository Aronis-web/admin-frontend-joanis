import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  chatbotPostsaleApi,
  type PostsaleDeliverPayload,
  type PostsaleDetail,
  type PostsaleOrder,
  type PostsaleScanStage,
  type PostsaleStatus,
} from '@/services/api/chatbot-postsale';

export const chatbotPostsaleKeys = {
  all: ['chatbot-postsale'] as const,
  list: (statuses?: PostsaleStatus[]) =>
    [...chatbotPostsaleKeys.all, 'list', statuses?.join(',') ?? 'all'] as const,
  detail: (id: string) => [...chatbotPostsaleKeys.all, 'detail', id] as const,
};

/** Pedidos de post venta. Sin `statuses`: activos + entregados últimos 7 días. */
export const usePostsaleOrders = (statuses?: PostsaleStatus[], enabled = true) =>
  useQuery<PostsaleOrder[]>({
    queryKey: chatbotPostsaleKeys.list(statuses),
    queryFn: () => chatbotPostsaleApi.list(statuses),
    enabled,
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });

export const usePostsaleDetail = (id: string | null) =>
  useQuery<PostsaleDetail>({
    queryKey: chatbotPostsaleKeys.detail(id ?? ''),
    queryFn: () => chatbotPostsaleApi.get(id as string),
    enabled: !!id,
    staleTime: 10 * 1000,
  });

export const usePrintPostsale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderIds: string[]) => chatbotPostsaleApi.print(orderIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatbotPostsaleKeys.all }),
  });
};

export const useScanPostsale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, stage }: { code: string; stage?: PostsaleScanStage }) =>
      chatbotPostsaleApi.scan(code, stage),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatbotPostsaleKeys.all }),
  });
};

export const useDeliverPostsale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PostsaleDeliverPayload }) =>
      chatbotPostsaleApi.deliver(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatbotPostsaleKeys.all }),
  });
};

export const useResendPostsaleCode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => chatbotPostsaleApi.resendCode(id),
    onSuccess: (_d, id) => qc.invalidateQueries({ queryKey: chatbotPostsaleKeys.detail(id) }),
  });
};
