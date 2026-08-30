/**
 * Chatbot de Ventas por WhatsApp — Tipos compartidos.
 *
 * API base: `/chatbot/...`
 * Consulta la guía del backend para detalles de cada endpoint.
 */

// ============================================
// Enums
// ============================================
export type WaStatus = 'DISCONNECTED' | 'CONNECTING' | 'QR' | 'CONNECTED';
export type ConversationStatus = 'ACTIVE' | 'HUMAN' | 'CLOSED';
export type ChatbotMessageRole = 'user' | 'assistant' | 'tool' | 'system';
export type ChatbotOrderStatus =
  | 'PENDING_PAYMENT'
  | 'VALIDATED'
  | 'EMITTED'
  | 'REJECTED'
  | 'EXPIRED';

// ============================================
// Sesión WhatsApp
// ============================================
export interface WaSessionStatus {
  status: WaStatus;
  me: string | null;
}

export interface WaQrResponse {
  qr: string | null;
}

// ============================================
// Conversaciones
// ============================================
export interface ChatConversation {
  id: string;
  customerId: string | null;
  phone: string;
  waJid: string | null;
  status: ConversationStatus;
  botEnabled: boolean;
  summary: string | null;
  lastMessageAt: string | null;
  companyOwnerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatbotMessageRole;
  content: string | null;
  mediaUrl: string | null;
  tokens: number | null;
  createdAt: string;
}

export interface GetConversationsParams {
  limit?: number;
}

export interface GetChatMessagesParams {
  limit?: number;
}

export interface HandoffBody {
  botEnabled: boolean;
}

export interface SendReplyBody {
  text: string;
  waJid: string;
}

// ============================================
// Pedidos
// ============================================
export interface ChatbotOrder {
  id: string;
  cartId: string;
  conversationId: string;
  customerId: string | null;
  voucherUrl: string | null;
  status: ChatbotOrderStatus;
  stockReservationIds: string[] | null;
  saleIds: string[] | null;
  totalCents: string;
  rejectedReason: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  companyOwnerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetChatbotOrdersParams {
  status?: ChatbotOrderStatus;
}

export interface ValidateChatbotOrderResponse {
  status: 'EMITTED' | 'VALIDATED';
  saleIds?: string[];
  note?: string;
  error?: string;
}

export interface RejectChatbotOrderBody {
  reason?: string;
}

// ============================================
// Catálogo vendible (whitelist)
// ============================================
export interface SellableProduct {
  id: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  presentationId: string;
  maxSellableQty: string;
  priceProfileId: string | null;
  priceOverrideCents: string | null;
  label: string | null;
  sortOrder: number;
  isActive: boolean;
  companyOwnerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateSellableProductBody {
  productId: string;
  variantId?: string | null;
  warehouseId: string;
  presentationId: string;
  maxSellableQty: number;
  priceProfileId?: string | null;
  priceOverrideCents?: number | null;
  label?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateSellableProductBody = Partial<CreateSellableProductBody>;
