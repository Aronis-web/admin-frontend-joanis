import { apiClient } from './client';
import type {
  ChatbotInvoiceType,
  ChatbotOrder,
  ExtendChatbotOrderBody,
  ExtendChatbotOrderResponse,
  ChatbotOrdersPage,
  ChatbotOrdersPageParams,
  GetChatbotOrdersParams,
  RejectChatbotOrderBody,
  ValidateChatbotOrderResponse,
  VerifyChatbotVoucherResponse,
} from '@/types/chatbot';

/**
 * Chatbot · Pedidos API Service
 *
 * Base path: `/chatbot/orders`.
 */
class ChatbotOrdersService {
  private readonly basePath = '/chatbot/orders';

  async list(params?: GetChatbotOrdersParams): Promise<ChatbotOrder[]> {
    // El backend acepta `status` como lista separada por comas. Si llega un
    // array lo serializamos aquí; si es un solo estado o `undefined` se pasa
    // tal cual (sin `status` = todos los pedidos).
    const query =
      params?.status !== undefined
        ? {
            status: Array.isArray(params.status) ? params.status.join(',') : params.status,
          }
        : undefined;
    return apiClient.get<ChatbotOrder[]>(this.basePath, { params: query });
  }

  /** Listado paginado con búsqueda y filtros (`{ items, total, page, pageSize }`). */
  async listPage(params: ChatbotOrdersPageParams): Promise<ChatbotOrdersPage> {
    const { status, q, channel, payment, from, to, sort, page, pageSize } = params;
    const query: Record<string, string | number> = { page, pageSize };
    if (status) query.status = Array.isArray(status) ? status.join(',') : status;
    if (q?.trim()) query.q = q.trim();
    if (channel) query.channel = channel;
    if (payment) query.payment = payment;
    if (from) query.from = from;
    if (to) query.to = to;
    if (sort) query.sort = sort;
    return apiClient.get<ChatbotOrdersPage>(this.basePath, { params: query });
  }

  async validate(id: string): Promise<ValidateChatbotOrderResponse> {
    return apiClient.post<ValidateChatbotOrderResponse>(`${this.basePath}/${id}/validate`, {});
  }

  /** Valida UN voucher (el pago llegó). Cierra el pedido si era el último pendiente. */
  async verifyVoucher(id: string, voucherId: string): Promise<VerifyChatbotVoucherResponse> {
    return apiClient.post<VerifyChatbotVoucherResponse>(
      `${this.basePath}/${id}/vouchers/${voucherId}/verify`,
      {}
    );
  }

  /** Cambia el comprobante (boleta/factura) antes de emitir. */
  async setInvoiceType(
    id: string,
    invoiceType: ChatbotInvoiceType
  ): Promise<{ id: string; invoiceType: ChatbotInvoiceType }> {
    return apiClient.post<{ id: string; invoiceType: ChatbotInvoiceType }>(
      `${this.basePath}/${id}/invoice-type`,
      { invoiceType }
    );
  }

  /** Cancela el pedido (permiso `chatbot.orders.cancel`). */
  async cancel(id: string, body?: { reason?: string }): Promise<ChatbotOrder> {
    return apiClient.post<ChatbotOrder>(`${this.basePath}/${id}/cancel`, body ?? {});
  }

  async reject(id: string, body?: RejectChatbotOrderBody): Promise<ChatbotOrder> {
    return apiClient.post<ChatbotOrder>(`${this.basePath}/${id}/reject`, body ?? {});
  }

  async extendHold(id: string, body?: ExtendChatbotOrderBody): Promise<ExtendChatbotOrderResponse> {
    return apiClient.post<ExtendChatbotOrderResponse>(
      `${this.basePath}/${id}/extend-hold`,
      body ?? {}
    );
  }

  /** Enlace firmado temporal (15 min, público) a la imagen de un voucher. */
  async voucherLink(voucherId: string): Promise<{ url: string; expiresAt: string }> {
    return apiClient.get<{ url: string; expiresAt: string }>(
      `${this.basePath}/vouchers/${voucherId}/link`
    );
  }

  /** Enlace firmado temporal (15 min, público) al voucher guardado en el pedido. */
  async orderVoucherLink(id: string): Promise<{ url: string; expiresAt: string }> {
    return apiClient.get<{ url: string; expiresAt: string }>(`${this.basePath}/${id}/voucher-link`);
  }
}

export const chatbotOrdersApi = new ChatbotOrdersService();
