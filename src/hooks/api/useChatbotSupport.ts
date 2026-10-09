import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  chatbotSupportApi,
  type DirectPurchaseInput,
  type PiiField,
  type RefundInput,
} from '@/services/api/chatbot-support';

export const chatbotSupportKeys = {
  all: ['chatbot-support'] as const,
  cases: (status: string, type?: string, assignee?: string) =>
    [...chatbotSupportKeys.all, 'cases', status, type, assignee] as const,
  card: (conversationId: string) => [...chatbotSupportKeys.all, 'card', conversationId] as const,
  search: (q: string) => [...chatbotSupportKeys.all, 'search', q] as const,
  tags: () => [...chatbotSupportKeys.all, 'tags'] as const,
  products: (q: string) => [...chatbotSupportKeys.all, 'products', q] as const,
  options: () => [...chatbotSupportKeys.all, 'purchase-options'] as const,
};

export const useSupportCases = (status: 'open' | 'closed', type?: string, assignee?: string) =>
  useQuery({
    queryKey: chatbotSupportKeys.cases(status, type, assignee),
    queryFn: () => chatbotSupportApi.cases({ status, type, assignee }),
    staleTime: 20 * 1000,
    refetchInterval: 60 * 1000,
  });

export const useSupportSearch = (q: string) =>
  useQuery({
    queryKey: chatbotSupportKeys.search(q),
    queryFn: () => chatbotSupportApi.search(q),
    enabled: q.trim().length >= 3,
    staleTime: 30 * 1000,
  });

export const useSupportCard = (conversationId: string) =>
  useQuery({
    queryKey: chatbotSupportKeys.card(conversationId),
    queryFn: () => chatbotSupportApi.card(conversationId),
    enabled: !!conversationId,
    staleTime: 15 * 1000,
  });

export const useSupportTags = () =>
  useQuery({
    queryKey: chatbotSupportKeys.tags(),
    queryFn: () => chatbotSupportApi.tags(),
    staleTime: 5 * 60 * 1000,
  });

export const useSupportProducts = (q: string) =>
  useQuery({
    queryKey: chatbotSupportKeys.products(q),
    queryFn: () => chatbotSupportApi.products(q),
    enabled: q.trim().length >= 2,
    staleTime: 15 * 1000,
  });

export const usePurchaseOptions = () =>
  useQuery({
    queryKey: chatbotSupportKeys.options(),
    queryFn: () => chatbotSupportApi.purchaseOptions(),
    staleTime: 10 * 60 * 1000,
  });

/** Toda mutacion del modulo refresca la cola y las fichas. */
const useSupportMutation = <V, R>(fn: (v: V) => Promise<R>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: chatbotSupportKeys.all }),
  });
};

export const useAssignCase = () =>
  useSupportMutation(({ caseId, userId }: { caseId: string; userId?: string | null }) =>
    chatbotSupportApi.assign(caseId, userId)
  );

export const useCloseCase = () =>
  useSupportMutation(({ caseId, note }: { caseId: string; note: string }) =>
    chatbotSupportApi.close(caseId, note)
  );

export const useRevealPii = () =>
  useSupportMutation(
    ({
      conversationId,
      field,
      reason,
    }: {
      conversationId: string;
      field: PiiField;
      reason: string;
    }) => chatbotSupportApi.reveal(conversationId, field, reason)
  );

export const useSetTags = () =>
  useSupportMutation(({ conversationId, tags }: { conversationId: string; tags: string[] }) =>
    chatbotSupportApi.setTags(conversationId, tags)
  );

export const useAddNote = () =>
  useSupportMutation(({ conversationId, body }: { conversationId: string; body: string }) =>
    chatbotSupportApi.addNote(conversationId, body)
  );

export const useDirectPurchase = () =>
  useSupportMutation(
    ({ conversationId, input }: { conversationId: string; input: DirectPurchaseInput }) =>
      chatbotSupportApi.purchase(conversationId, input)
  );

export const useRefund = () =>
  useSupportMutation(({ conversationId, input }: { conversationId: string; input: RefundInput }) =>
    chatbotSupportApi.refund(conversationId, input)
  );

export const useApplyCredit = () =>
  useSupportMutation((orderId: string) => chatbotSupportApi.applyCredit(orderId));

export const usePriorityDelivery = () =>
  useSupportMutation(({ orderId, note }: { orderId: string; note?: string }) =>
    chatbotSupportApi.priority(orderId, note)
  );

export const useChangeSite = () =>
  useSupportMutation(
    ({
      orderId,
      input,
    }: {
      orderId: string;
      input: { siteId: string; reason?: string; notify?: boolean };
    }) => chatbotSupportApi.changeSite(orderId, input)
  );

export const useSupportOrderItems = (orderId: string | null) =>
  useQuery({
    queryKey: [...chatbotSupportKeys.all, 'order-items', orderId],
    queryFn: () => chatbotSupportApi.orderItems(orderId as string),
    enabled: !!orderId,
    staleTime: 15 * 1000,
  });

export const useProductStock = (sellableProductId: string | null) =>
  useQuery({
    queryKey: [...chatbotSupportKeys.all, 'product-stock', sellableProductId],
    queryFn: () => chatbotSupportApi.productStock(sellableProductId as string),
    enabled: !!sellableProductId,
    staleTime: 30 * 1000,
  });

export const useReplacement = () =>
  useSupportMutation(
    ({ orderId, input }: { orderId: string; input: Parameters<typeof chatbotSupportApi.replacement>[1] }) =>
      chatbotSupportApi.replacement(orderId, input)
  );

export const useEditOrder = () =>
  useSupportMutation(
    ({ orderId, input }: { orderId: string; input: Parameters<typeof chatbotSupportApi.editOrder>[1] }) =>
      chatbotSupportApi.editOrder(orderId, input)
  );

export const useCancelToCredit = () =>
  useSupportMutation(({ orderId, reason }: { orderId: string; reason: string }) =>
    chatbotSupportApi.cancelToCredit(orderId, reason)
  );

export const useLinkVoucher = () =>
  useSupportMutation(({ voucherId, orderId }: { voucherId: string; orderId: string }) =>
    chatbotSupportApi.linkVoucher(voucherId, orderId)
  );

export const useResendReceipt = () =>
  useSupportMutation((orderId: string) => chatbotSupportApi.resendReceipt(orderId));

export const useResendCode = () =>
  useSupportMutation((orderId: string) => chatbotSupportApi.resendCode(orderId));

export const useUpdateCustomer = () =>
  useSupportMutation(
    ({
      conversationId,
      input,
    }: {
      conversationId: string;
      input: Parameters<typeof chatbotSupportApi.updateCustomer>[1];
    }) => chatbotSupportApi.updateCustomer(conversationId, input)
  );

export const useVoidMoney = () =>
  useSupportMutation((id: string) => chatbotSupportApi.voidMoney(id));
