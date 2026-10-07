import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  chatbotBroadcastsApi,
  type BroadcastAudience,
  type BroadcastPreview,
  type BroadcastProduct,
  type ChatbotBroadcast,
  type CreateBroadcastPayload,
} from '@/services/api/chatbot-broadcasts';

export const chatbotBroadcastsKeys = {
  all: ['chatbot-broadcasts'] as const,
  list: () => [...chatbotBroadcastsKeys.all, 'list'] as const,
  preview: (a: BroadcastAudience) => [...chatbotBroadcastsKeys.all, 'preview', a] as const,
  products: (q: string) => [...chatbotBroadcastsKeys.all, 'products', q] as const,
};

export const useBroadcasts = () =>
  useQuery<ChatbotBroadcast[]>({
    queryKey: chatbotBroadcastsKeys.list(),
    queryFn: () => chatbotBroadcastsApi.list(),
    staleTime: 10 * 1000,
    // Mientras una promocion se envia, refresca el avance.
    refetchInterval: (q) =>
      (q.state.data ?? []).some((b) => b.status === 'SENDING') ? 5000 : false,
  });

export const useBroadcastPreview = (audience: BroadcastAudience) =>
  useQuery<BroadcastPreview>({
    queryKey: chatbotBroadcastsKeys.preview(audience),
    queryFn: () => chatbotBroadcastsApi.preview(audience),
    enabled: (audience.promos || audience.live) && audience.channels.length > 0,
    staleTime: 30 * 1000,
  });

export const useBroadcastProducts = (q: string) =>
  useQuery<BroadcastProduct[]>({
    queryKey: chatbotBroadcastsKeys.products(q),
    queryFn: () => chatbotBroadcastsApi.products(q),
    staleTime: 60 * 1000,
  });

export const useCreateBroadcast = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBroadcastPayload) => chatbotBroadcastsApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatbotBroadcastsKeys.all }),
  });
};
