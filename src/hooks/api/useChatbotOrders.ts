import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotOrdersApi } from '@/services/api';
import type {
  ChatbotInvoiceType,
  ChatbotOrder,
  ChatbotOrdersPage,
  ChatbotOrdersPageParams,
  ExtendChatbotOrderBody,
  ExtendChatbotOrderResponse,
  GetChatbotOrdersParams,
  RejectChatbotOrderBody,
  ValidateChatbotOrderResponse,
  VerifyChatbotVoucherResponse,
} from '@/types/chatbot';

// ============================================
// Query Keys Factory
// ============================================
export const chatbotOrdersKeys = {
  all: ['chatbot-orders'] as const,
  lists: () => [...chatbotOrdersKeys.all, 'list'] as const,
  list: (params?: GetChatbotOrdersParams) => [...chatbotOrdersKeys.lists(), params] as const,
  // Bajo `lists()` para que las mutaciones existentes también refresquen la página.
  page: (params: ChatbotOrdersPageParams) =>
    [...chatbotOrdersKeys.lists(), 'page', params] as const,
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

/** Página de pedidos con filtros; conserva la página anterior mientras carga. */
export const useChatbotOrdersPage = (
  params: ChatbotOrdersPageParams,
  options?: { refetchIntervalMs?: number }
) =>
  useQuery<ChatbotOrdersPage>({
    queryKey: chatbotOrdersKeys.page(params),
    queryFn: () => chatbotOrdersApi.listPage(params),
    staleTime: ORDERS_STALE_TIME,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    refetchInterval: options?.refetchIntervalMs ?? false,
  });

// ============================================
// Mutations
// ============================================

export const useValidateChatbotOrder = () => {
  const queryClient = useQueryClient();
  return useMutation<ValidateChatbotOrderResponse, Error, string>({
    mutationFn: (id) => chatbotOrdersApi.validate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotOrdersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['chatbot-conversations'] });
    },
  });
};

/** Valida un voucher del pedido; refresca pedidos y vouchers. */
export const useVerifyChatbotVoucher = () => {
  const queryClient = useQueryClient();
  return useMutation<VerifyChatbotVoucherResponse, Error, { orderId: string; voucherId: string }>({
    mutationFn: ({ orderId, voucherId }) => chatbotOrdersApi.verifyVoucher(orderId, voucherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotOrdersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['chatbot-conversations'] });
    },
  });
};

/** Cambia boleta/factura del pedido antes de emitir. */
export const useSetChatbotOrderInvoiceType = () => {
  const queryClient = useQueryClient();
  return useMutation<
    { id: string; invoiceType: ChatbotInvoiceType },
    Error,
    { id: string; invoiceType: ChatbotInvoiceType }
  >({
    mutationFn: ({ id, invoiceType }) => chatbotOrdersApi.setInvoiceType(id, invoiceType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotOrdersKeys.lists() });
    },
  });
};

export const useCancelChatbotOrder = () => {
  const queryClient = useQueryClient();
  return useMutation<ChatbotOrder, Error, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => chatbotOrdersApi.cancel(id, reason ? { reason } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotOrdersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['chatbot-conversations'] });
    },
  });
};

export const useRejectChatbotOrder = () => {
  const queryClient = useQueryClient();
  return useMutation<ChatbotOrder, Error, { id: string; body?: RejectChatbotOrderBody }>({
    mutationFn: ({ id, body }) => chatbotOrdersApi.reject(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotOrdersKeys.lists() });
      // Los vouchers del pedido vienen de la conversacion: refrescarlos tambien.
      queryClient.invalidateQueries({ queryKey: ['chatbot-conversations'] });
    },
  });
};

export const useExtendChatbotOrderHold = () => {
  const queryClient = useQueryClient();
  return useMutation<
    ExtendChatbotOrderResponse,
    Error,
    { id: string; body?: ExtendChatbotOrderBody }
  >({
    mutationFn: ({ id, body }) => chatbotOrdersApi.extendHold(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatbotOrdersKeys.lists() });
    },
  });
};
