import { apiClient } from './client';

export type SupportCaseType = 'DEVOLUCION' | 'PEDIDO_VENCIDO' | 'RECLAMO' | 'ASESOR' | 'CONSULTA';
export type SupportLight = 'VERDE' | 'AMARILLO' | 'ROJO';
export type PiiField = 'document' | 'phone' | 'address' | 'email';

/** Un renglon de la cola: un chat con casos abiertos (o cerrados en 7 dias). */
export interface SupportCase {
  id: string;
  conversationId: string;
  customerId: string | null;
  customerName: string | null;
  channel: 'WhatsApp' | 'Messenger' | 'Instagram';
  phone: string | null;
  type: SupportCaseType;
  category: string;
  summary: string | null;
  customerText: string | null;
  status: string;
  casesInChat: number;
  createdAt: string;
  waitMinutes: number;
  light: SupportLight | null;
  assignedTo: string | null;
  assignedName: string | null;
  assignedAt: string | null;
  tags: string[];
  botEnabled: boolean;
  lastMessageAt: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
}

export interface SupportSearchResult {
  conversationId: string;
  customerId: string | null;
  name: string | null;
  channel: string;
  phone: string | null;
  document: string | null;
  lastMessageAt: string | null;
}

export interface SupportCard {
  conversationId: string;
  customer: {
    id: string | null;
    name: string | null;
    documentType: string | null;
    document: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    since: string | null;
    identified: boolean;
  };
  tags: string[];
  credit: { availableCents: number; refundedCents: number };
  chats: Array<{
    id: string;
    channel: string;
    phone: string | null;
    name: string | null;
    botEnabled: boolean;
    status: string;
    stage: string;
    lastMessageAt: string | null;
    tags: string[];
    current: boolean;
  }>;
  orders: Array<{
    id: string;
    no: string;
    conversationId: string;
    status: string;
    postsaleStatus: string | null;
    totalCents: number;
    paidCents: number;
    creditCents: number;
    fulfillment: string | null;
    place: string | null;
    priority: boolean;
    /** Anulado dejando lo pagado como saldo a favor. */
    cancelled?: boolean;
    /** Reposicion sin cobro de este pedido (N.°). */
    replacementOf?: string | null;
    hasReceipt?: boolean;
    printed?: boolean;
    invoiceType: string | null;
    createdAt: string;
    validatedAt: string | null;
  }>;
  vouchers: Array<{
    id: string;
    conversationId: string;
    orderId: string | null;
    orderNo: string | null;
    bank: string | null;
    operationNumber: string | null;
    operationDate: string | null;
    amountCents: number | null;
    status: string;
    duplicateReason: string | null;
    createdAt: string;
  }>;
  cases: Array<{
    id: string;
    conversationId: string;
    type: SupportCaseType;
    summary: string | null;
    status: string;
    createdAt: string;
    resolutionNote: string | null;
    resolvedAt: string | null;
  }>;
  notes: Array<{
    id: string;
    conversationId: string | null;
    body: string;
    author: string | null;
    createdAt: string;
  }>;
  money: Array<{
    id: string;
    kind:
      | 'REFUND'
      | 'CREDIT_APPLY'
      | 'PRIORITY_DELIVERY'
      | 'REPLACEMENT'
      | 'ORDER_EDIT'
      | 'ORDER_CANCEL'
      | 'VOUCHER_LINK'
      | 'RECEIPT_RESENT'
      | 'CODE_RESENT';
    orderNo: string | null;
    amountCents: number | null;
    fromCredit: boolean;
    bank: string | null;
    operationNumber: string | null;
    note: string | null;
    author: string | null;
    createdAt: string;
    voided: boolean;
  }>;
  piiAccess: Array<{ field: string; reason: string; viewer: string | null; at: string }>;
}

export interface SupportProduct {
  sellableProductId: string;
  name: string;
  presentationName: string | null;
  unitPriceCents: number;
  availableQty: number;
  closedByCampaign: boolean;
}

export interface PurchaseOptions {
  pickupSites: Array<{ id: string; name: string; district: string | null }>;
  lima: { enabled: boolean; feeCents: number | null };
  agencies: Array<{ code: string; name: string; feeCents: number }>;
}

export interface SupportOrderItem {
  id: string;
  sellableProductId: string | null;
  name: string | null;
  qty: number;
  unitPriceCents: number;
  editable: boolean;
}

export interface EditOrderResult {
  ok: boolean;
  beforeCents: number;
  totalCents: number;
  paidCents: number;
  differenceCents: number;
  lines: Array<{ sellableProductId: string; name: string; qty: number; unitPriceCents: number }>;
}

export interface ProductStock {
  sellableProductId: string;
  name: string;
  sku: string | null;
  variant: string | null;
  description: string | null;
  presentation: string | null;
  unitPriceCents: number | null;
  availableToSell: number;
  imageUrl: string | null;
  stores: Array<{ site: string | null; warehouse: string; units: number }>;
}

export interface ChangeSiteResult {
  orderId: string;
  orderNo: string;
  from: string;
  to: string;
  status: string | null;
  statusLabel: string | null;
  /** Sticker de cambio por bulto (vacío si el pedido aún no tenía sticker). */
  stickers: any[];
}

export interface DirectPurchaseInput {
  items: Array<{ sellableProductId: string; qty: number }>;
  fulfillment: {
    type: 'PICKUP' | 'DELIVERY_LIMA' | 'AGENCY';
    siteId?: string | null;
    address?: string | null;
    reference?: string | null;
    agency?: string | null;
    destination?: string | null;
    feeCents?: number | null;
  };
  voucherId?: string | null;
  orderNotes?: string | null;
  invoiceType?: 'BOLETA' | 'FACTURA' | null;
}

export interface DirectPurchaseResult {
  ok: boolean;
  reason?: string;
  cartId?: string;
  orderId?: string;
  totalCents?: number;
  paidCents?: number;
  summary?: string;
}

export interface RefundInput {
  amountCents: number;
  bank?: string;
  operationNumber: string;
  orderId?: string | null;
  fromCredit?: boolean;
  note?: string;
  caseId?: string | null;
}

/**
 * Atencion al cliente API Service
 *
 * Base path: `/chatbot/support`.
 */
class ChatbotSupportService {
  private readonly basePath = '/chatbot/support';

  cases(params: { status?: 'open' | 'closed'; type?: string; assignee?: string }) {
    return apiClient.get<SupportCase[]>(`${this.basePath}/cases`, { params });
  }

  assign(caseId: string, userId?: string | null) {
    return apiClient.post<{ updated: number }>(
      `${this.basePath}/cases/${caseId}/assign`,
      userId === undefined ? {} : { userId }
    );
  }

  close(caseId: string, note: string) {
    return apiClient.post<{ closed: number }>(`${this.basePath}/cases/${caseId}/close`, { note });
  }

  search(q: string) {
    return apiClient.get<SupportSearchResult[]>(`${this.basePath}/search`, { params: { q } });
  }

  card(conversationId: string) {
    return apiClient.get<SupportCard>(`${this.basePath}/conversations/${conversationId}/card`);
  }

  reveal(conversationId: string, field: PiiField, reason: string) {
    return apiClient.post<{ value: string | null }>(
      `${this.basePath}/conversations/${conversationId}/reveal`,
      { field, reason }
    );
  }

  tags() {
    return apiClient.get<Array<{ tag: string; chats: number }>>(`${this.basePath}/tags`);
  }

  setTags(conversationId: string, tags: string[]) {
    return apiClient.put<{ tags: string[] }>(
      `${this.basePath}/conversations/${conversationId}/tags`,
      {
        tags,
      }
    );
  }

  addNote(conversationId: string, body: string) {
    return apiClient.post<{ id: string }>(
      `${this.basePath}/conversations/${conversationId}/notes`,
      {
        body,
      }
    );
  }

  products(q: string) {
    return apiClient.get<SupportProduct[]>(`${this.basePath}/products`, { params: { q } });
  }

  purchaseOptions() {
    return apiClient.get<PurchaseOptions>(`${this.basePath}/purchase-options`);
  }

  purchase(conversationId: string, input: DirectPurchaseInput) {
    return apiClient.post<DirectPurchaseResult>(
      `${this.basePath}/conversations/${conversationId}/purchase`,
      input
    );
  }

  refund(conversationId: string, input: RefundInput) {
    return apiClient.post<{ id: string }>(
      `${this.basePath}/conversations/${conversationId}/refunds`,
      input
    );
  }

  applyCredit(orderId: string) {
    return apiClient.post<{ appliedCents: number }>(
      `${this.basePath}/orders/${orderId}/apply-credit`,
      {}
    );
  }

  priority(orderId: string, note?: string) {
    return apiClient.post<{ ok: boolean }>(`${this.basePath}/orders/${orderId}/priority`, { note });
  }

  changeSite(orderId: string, input: { siteId: string; reason?: string; notify?: boolean }) {
    return apiClient.post<ChangeSiteResult>(`${this.basePath}/orders/${orderId}/change-site`, input);
  }

  orderItems(orderId: string) {
    return apiClient.get<SupportOrderItem[]>(`${this.basePath}/orders/${orderId}/items`);
  }

  replacement(
    orderId: string,
    input: {
      items: Array<{ itemId: string; qty: number }>;
      reason: 'FALTANTE' | 'EQUIVOCADO' | 'DANADO';
      note?: string;
      notify?: boolean;
    }
  ) {
    return apiClient.post<{ orderId: string; orderNo: string; originalNo: string }>(
      `${this.basePath}/orders/${orderId}/replacement`,
      input
    );
  }

  editOrder(
    orderId: string,
    input: {
      items: Array<{ sellableProductId: string; qty: number; unitPriceCents?: number | null }>;
      reason?: string;
      dryRun?: boolean;
    }
  ) {
    return apiClient.post<EditOrderResult>(`${this.basePath}/orders/${orderId}/edit`, input);
  }

  cancelToCredit(orderId: string, reason: string) {
    return apiClient.post<{ ok: boolean; creditCents: number }>(
      `${this.basePath}/orders/${orderId}/cancel-to-credit`,
      { reason }
    );
  }

  linkVoucher(voucherId: string, orderId: string) {
    return apiClient.post<{ ok: boolean; paidCents: number; status: string }>(
      `${this.basePath}/vouchers/${voucherId}/link`,
      { orderId }
    );
  }

  resendReceipt(orderId: string) {
    return apiClient.post<{ ok: boolean; channel: string; documents: string[] }>(
      `${this.basePath}/orders/${orderId}/resend-receipt`,
      {}
    );
  }

  /** El código va solo a la clienta: la respuesta no lo trae. */
  resendCode(orderId: string) {
    return apiClient.post<{ ok: boolean; channels: string[] }>(
      `${this.basePath}/orders/${orderId}/resend-code`,
      {}
    );
  }

  updateCustomer(
    conversationId: string,
    input: {
      phone?: string;
      email?: string;
      documentType?: 'DNI' | 'RUC' | 'CE';
      documentNumber?: string;
      fullName?: string;
      reason: string;
    }
  ) {
    return apiClient.post<{ ok: boolean; changes: string[] }>(
      `${this.basePath}/conversations/${conversationId}/customer`,
      input
    );
  }

  /** Busca en todo el catálogo (no solo lo que se vende por chat). */
  catalogSearch(q: string) {
    return apiClient.get<
      Array<{
        productId: string;
        sellableProductId: string | null;
        name: string;
        sku: string | null;
        stock: number;
      }>
    >(`${this.basePath}/catalog-search`, { params: { q } });
  }

  productStock(sellableProductId: string) {
    return apiClient.get<ProductStock>(`${this.basePath}/products/${sellableProductId}/stock`);
  }

  voidMoney(id: string) {
    return apiClient.post<{ ok: boolean }>(`${this.basePath}/money/${id}/void`, {});
  }
}

export const chatbotSupportApi = new ChatbotSupportService();
