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
  type ChatbotDispatchListStatus,
} from '@/services/api/chatbot-postsale';
import type {
  ChatbotDispatch,
  ChatbotDispatchClosePayload,
  ChatbotDispatchSite,
} from '@/types/chatbot';

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
  dispatches: (status: ChatbotDispatchListStatus) =>
    [...chatbotPostsaleKeys.all, 'dispatches', status] as const,
  dispatch: (id: string) => [...chatbotPostsaleKeys.all, 'dispatch', id] as const,
  dispatchSites: () => [...chatbotPostsaleKeys.all, 'dispatch-sites'] as const,
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

// ── Despacho consolidado a tiendas ─────────────────────────────────────────

/** Despachos a tiendas (por defecto los abiertos). */
export const useChatbotDispatches = (status: ChatbotDispatchListStatus = 'OPEN', enabled = true) =>
  useQuery<ChatbotDispatch[]>({
    queryKey: chatbotPostsaleKeys.dispatches(status),
    queryFn: () => chatbotPostsaleApi.listDispatches(status),
    enabled,
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });

export const useChatbotDispatch = (id: string | null) =>
  useQuery<ChatbotDispatch>({
    queryKey: chatbotPostsaleKeys.dispatch(id ?? ''),
    queryFn: () => chatbotPostsaleApi.getDispatch(id as string),
    enabled: !!id,
    staleTime: 5 * 1000,
  });

/** Tiendas con pedidos de recojo esperando despacho. */
export const useChatbotDispatchSites = (enabled = true) =>
  useQuery<ChatbotDispatchSite[]>({
    queryKey: chatbotPostsaleKeys.dispatchSites(),
    queryFn: () => chatbotPostsaleApi.dispatchSites(),
    enabled,
    staleTime: 10 * 1000,
  });

/** Tras cada cambio: deja el despacho en caché y refresca listas y pedidos. */
const useDispatchMutation = <V>(fn: (v: V) => Promise<ChatbotDispatch>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (d) => {
      qc.setQueryData(chatbotPostsaleKeys.dispatch(d.id), d);
      qc.invalidateQueries({ queryKey: chatbotPostsaleKeys.all });
    },
  });
};

export const useOpenChatbotDispatch = () =>
  useDispatchMutation((siteId: string) => chatbotPostsaleApi.openDispatch(siteId));

export const useRemoveChatbotDispatchOrder = () =>
  useDispatchMutation(({ id, orderId }: { id: string; orderId: string }) =>
    chatbotPostsaleApi.removeDispatchOrder(id, orderId)
  );

export const useCancelChatbotDispatch = () =>
  useDispatchMutation((id: string) => chatbotPostsaleApi.cancelDispatch(id));

export const useCloseChatbotDispatch = () =>
  useDispatchMutation(({ id, payload }: { id: string; payload: ChatbotDispatchClosePayload }) =>
    chatbotPostsaleApi.closeDispatch(id, payload)
  );

export const useScanChatbotDispatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      chatbotPostsaleApi.scanDispatch(id, code),
    onSuccess: (r) => {
      qc.setQueryData(chatbotPostsaleKeys.dispatch(r.dispatch.id), r.dispatch);
      qc.invalidateQueries({ queryKey: chatbotPostsaleKeys.all });
    },
  });
};
