import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  chatbotPostsaleApi,
  type PostsaleDeliverPayload,
  type PostsaleDetail,
  type PostsaleListParams,
  type PostsaleOrder,
  type PostsaleOverview,
  type PostsaleStalledPage,
  type PostsalePage,
  type PostsaleScanStage,
  type PostsaleStatus,
} from '@/services/api/chatbot-postsale';

export const chatbotPostsaleKeys = {
  all: ['chatbot-postsale'] as const,
  list: (statuses?: PostsaleStatus[]) =>
    [...chatbotPostsaleKeys.all, 'list', statuses?.join(',') ?? 'all'] as const,
  page: (p: PostsaleListParams) =>
    [
      ...chatbotPostsaleKeys.all,
      'page',
      p.statuses?.join(',') ?? 'all',
      p.q?.trim() ?? '',
      p.page,
      p.pageSize,
    ] as const,
  detail: (id: string) => [...chatbotPostsaleKeys.all, 'detail', id] as const,
  overview: () => [...chatbotPostsaleKeys.all, 'overview'] as const,
  stalled: (page: number, pageSize: number) =>
    [...chatbotPostsaleKeys.all, 'stalled', page, pageSize] as const,
};

/** Resumen de estados de pago y post venta (dashboard). */
export const usePostsaleOverview = () =>
  useQuery<PostsaleOverview>({
    queryKey: chatbotPostsaleKeys.overview(),
    queryFn: () => chatbotPostsaleApi.overview(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

/** Pedidos estancados paginados. */
export const usePostsaleStalled = (page: number, pageSize: number, enabled = true) =>
  useQuery<PostsaleStalledPage>({
    queryKey: chatbotPostsaleKeys.stalled(page, pageSize),
    queryFn: () => chatbotPostsaleApi.stalled(page, pageSize),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

/** Pedidos de post venta. Sin `statuses`: activos + entregados últimos 7 días. */
export const usePostsaleOrders = (statuses?: PostsaleStatus[], enabled = true) =>
  useQuery<PostsaleOrder[]>({
    queryKey: chatbotPostsaleKeys.list(statuses),
    queryFn: () => chatbotPostsaleApi.list(statuses),
    enabled,
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });

/** Página de pedidos con búsqueda; conserva la página anterior mientras carga. */
export const usePostsalePage = (params: PostsaleListParams, enabled = true) =>
  useQuery<PostsalePage>({
    queryKey: chatbotPostsaleKeys.page(params),
    queryFn: () => chatbotPostsaleApi.listPage(params),
    enabled,
    placeholderData: keepPreviousData,
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
    mutationFn: ({ orderIds, packageNo }: { orderIds: string[]; packageNo?: number }) =>
      chatbotPostsaleApi.print(orderIds, packageNo),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatbotPostsaleKeys.all }),
  });
};

export const useAddPostsalePackage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => chatbotPostsaleApi.addPackage(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatbotPostsaleKeys.all }),
  });
};

export const useScanPostsale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, stage }: { code: string; stage: PostsaleScanStage }) =>
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
