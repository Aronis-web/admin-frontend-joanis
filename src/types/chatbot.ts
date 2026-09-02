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
/**
 * Estado del embudo de compra que el bot asigna turno a turno.
 * Sirve para triage de la bandeja y recuperación de carritos.
 */
export type PurchaseStage =
  | 'NUEVO'
  | 'EXPLORANDO'
  | 'NEGOCIANDO'
  | 'POR_PAGAR'
  | 'EN_VALIDACION'
  | 'COMPRADO'
  | 'POSTVENTA'
  | 'SOPORTE'
  | 'PERDIDO';
export type ChatbotMessageRole = 'user' | 'assistant' | 'tool' | 'system';
export type ChatbotMessageDirection = 'in' | 'out';
export type ChatbotMessageMediaType = 'image' | null;
export type BotEmojiLevel = 'none' | 'low' | 'high';
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
// Bot on/off (respuesta automática)
// ============================================
export interface BotStatus {
  active: boolean;
  scanning: boolean;
  whatsapp: {
    status: WaStatus;
    me: string | null;
  };
}

export interface BotToggleBody {
  active: boolean;
}

// ============================================
// Conversaciones
// ============================================
export interface ChatConversation {
  id: string;
  customerId: string | null;
  /** Nombre del cliente (confirmado o resuelto por documento). */
  customerName?: string | null;
  phone: string;
  waJid: string | null;
  status: ConversationStatus;
  botEnabled: boolean;
  /** Ya no viene en la lista paginada, solo en detalle/mensajes. */
  summary?: string | null;
  lastMessageAt: string | null;
  /** Estado del embudo de compra asignado por el bot. */
  purchaseStage?: PurchaseStage;
  companyOwnerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Item devuelto por el buscador con autocompletado
 * (`GET /chatbot/conversations/search`).
 */
export interface ConversationSearchItem {
  id: string;
  customerName: string | null;
  phone: string;
  purchaseStage: PurchaseStage;
  lastMessageAt: string | null;
}

/**
 * Bandeja paginada por keyset (`GET /chatbot/conversations`).
 * `nextCursor` es el `lastMessageAt` del último item; reenviarlo en `before`
 * para pedir la página siguiente.
 */
export interface PagedConversations {
  items: ChatConversation[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ChatMessage {
  id: string;
  /** No siempre viene del API paginado. Se propaga al hidratar. */
  conversationId?: string;
  role: ChatbotMessageRole;
  direction: ChatbotMessageDirection;
  /** El API paginado usa `text`; se conserva `content` por compatibilidad legacy. */
  text: string | null;
  content?: string | null;
  mediaUrl: string | null;
  mediaType: ChatbotMessageMediaType;
  tokens?: number | null;
  createdAt: string;
}

export interface PagedMessages {
  items: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface GetConversationsParams {
  /** Máximo de chats por página (tope 100). Default 30. */
  limit?: number;
  /** Cursor ISO: devuelve chats con `lastMessageAt` anterior a esa fecha. */
  before?: string;
  /** Filtra por estado de compra (`NUEVO`, `NEGOCIANDO`, ...). */
  stage?: PurchaseStage;
  /** Filtra por estado de chat. */
  status?: ConversationStatus;
}

export interface SearchConversationsParams {
  /** Texto a buscar (nombre o teléfono). Si es vacío, backend devuelve `[]`. */
  q: string;
  /** Máximo de resultados (tope 25). Default 10. */
  limit?: number;
}

export interface GetChatMessagesParams {
  limit?: number;
  /** ISO date; devuelve mensajes anteriores a esa fecha (cursor). */
  before?: string;
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
/**
 * Origen de una fila del catálogo vendible.
 * - `MANUAL` — curada a mano; la sync no la toca.
 * - `RULE` — generada/mantenida por una regla de sincronización.
 */
export type SellableSource = 'MANUAL' | 'RULE';

/**
 * Snapshot de la última evaluación de la regla sobre esta fila.
 * Útil para tooltips/badges (stock, días, precio base).
 */
export interface SellableRuleSnapshot {
  availableBase: number;
  maxSellableQty: number;
  daysSinceEntry: number | null;
  daysWithoutMovement: number | null;
  basePriceCents: number;
  syncedAt: string;
}

export interface SellableProduct {
  id: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  /** Área del almacén (bin/estante) de la cual se toma el stock vendible. */
  areaId?: string | null;
  /**
   * Presentación de venta. Puede ser `null` cuando la venta es por unidad base
   * (por ejemplo cuando la fila la generó una regla sin `sellPresentationId`).
   */
  presentationId: string | null;
  maxSellableQty: string;
  priceProfileId: string | null;
  priceOverrideCents: string | null;
  label: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Origen de la fila (MANUAL vs RULE). */
  source?: SellableSource;
  /** Regla que la generó (solo si `source === 'RULE'`). */
  syncRuleId?: string | null;
  /** Si está fijada, la sync no la modifica ni la desactiva. */
  pinned?: boolean;
  /** Marca si el producto califica como baja rotación en la última evaluación. */
  isLowRotation?: boolean;
  /** Snapshot de la última evaluación de regla; útil para tooltips. */
  ruleSnapshot?: SellableRuleSnapshot | null;
  /** Última vez que la sync tocó esta fila. */
  lastSyncedAt?: string | null;
  companyOwnerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateSellableProductBody {
  productId: string;
  variantId?: string | null;
  warehouseId: string;
  /** Área del almacén (opcional). Si no se envía, aplica al almacén completo. */
  areaId?: string | null;
  presentationId: string;
  maxSellableQty: number;
  priceProfileId?: string | null;
  priceOverrideCents?: number | null;
  label?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateSellableProductBody = Partial<CreateSellableProductBody>;

// ============================================
// Sincronización · Reglas
// ============================================
/**
 * Resumen (canditados / altas / bajas) de una corrida de sincronización.
 * Se devuelve tanto por `POST /rules/:id/run` como en `lastSyncSummary`.
 */
export interface SyncSummary {
  candidates: number;
  added: number;
  updated: number;
  deactivated: number;
  promosUpserted: number;
  promosDeactivated: number;
  skippedManual: number;
  errors: string[];
  dryRun: boolean;
}

/**
 * Regla de sincronización del catálogo vendible.
 * Los campos "decimal" del backend llegan como `string`; convertir con
 * `Number(...)` antes de pintar en UI.
 */
export interface SyncRule {
  id: string;
  warehouseId: string;
  areaId: string | null;
  name: string;
  isActive: boolean;
  priceProfileId: string | null;
  sellPresentationId: string | null;
  minDaysSinceEntry: number | null;
  minDaysWithoutMovement: number | null;
  /** Numeric backend column; llega como string. */
  minStockBase: string;
  /** Porcentaje 0-100; llega como string. */
  maxSellPct: string;
  excludeWithoutPhoto: boolean;
  lowRotationDays: number | null;
  /** Porcentaje 0-100; llega como string. */
  lowRotationDiscountPct: string;
  promoValidDays: number | null;
  /** Factor >= 1; llega como string. */
  minMarginFactor: string;
  syncEveryMinutes: number;
  lastSyncedAt: string | null;
  lastSyncSummary: SyncSummary | null;
  createdAt: string;
  updatedAt: string;
}

/** Body para crear una regla (`POST /chatbot/sync/rules`). */
export interface UpsertSyncRuleBody {
  warehouseId: string;
  areaId?: string | null;
  name: string;
  isActive?: boolean;
  priceProfileId?: string | null;
  sellPresentationId?: string | null;
  minDaysSinceEntry?: number | null;
  minDaysWithoutMovement?: number | null;
  minStockBase?: number;
  /** 0-100. Default 100. */
  maxSellPct?: number;
  excludeWithoutPhoto?: boolean;
  lowRotationDays?: number | null;
  /** 0-100. */
  lowRotationDiscountPct?: number;
  promoValidDays?: number | null;
  /** Piso de margen: precio >= costo * factor. */
  minMarginFactor?: number;
  /** Mínimo 5. */
  syncEveryMinutes?: number;
}

export type UpdateSyncRuleBody = Partial<UpsertSyncRuleBody>;

/**
 * Item devuelto por `GET /chatbot/sync/rules/:id/preview` — no escribe nada.
 */
export interface SyncRulePreviewItem {
  productId: string;
  availableBase: number;
  maxSellableQty: number;
  daysSinceEntry: number | null;
  daysWithoutMovement: number | null;
  isLowRotation: boolean;
  basePriceCents: number;
  promoPriceCents: number | null;
  hasPhoto: boolean;
}

export interface SyncRulePreview {
  ruleId: string;
  name: string;
  count: number;
  items: SyncRulePreviewItem[];
}

// ============================================
// Escalas de precio manuales (tiers)
// ============================================
export type PriceTierKind = 'QTY' | 'BOX' | 'PROMO';

/**
 * Escala de precio de una opción vendible. El precio se expresa por unidad
 * de venta, en centavos. Los tiers `RULE` los gestiona la sync y NO deben
 * editarse desde el frontend.
 */
export interface PriceTier {
  id: string;
  sellableProductId: string;
  kind: PriceTierKind;
  /** Cantidad mínima; llega como string. */
  minQty: string;
  presentationId: string | null;
  /** Precio por unidad de venta, en centavos; llega como string. */
  priceCents: string;
  validFrom: string | null;
  validTo: string | null;
  source: SellableSource;
  syncRuleId: string | null;
  label: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPriceTierBody {
  kind: PriceTierKind;
  /** Default 1; mínimo 0.001. */
  minQty?: number;
  presentationId?: string | null;
  priceCents: number;
  validFrom?: string | null;
  validTo?: string | null;
  label?: string | null;
  isActive?: boolean;
}

export type UpdatePriceTierBody = Partial<UpsertPriceTierBody>;

// ============================================
// Pin de filas del catálogo
// ============================================
export interface PinSellableBody {
  pinned: boolean;
}

// ============================================
// Configuración del bot (personalidad + FAQ)
// ============================================
export interface BotFaqRule {
  keywords: string[];
  reply: string;
}

export interface BotSettings {
  id?: string;
  companyOwnerId?: string;
  botName: string | null;
  persona: string | null;
  tone: string | null;
  customInstructions: string | null;
  emojiLevel: BotEmojiLevel;
  maxLines: number;
  faqKeywords: BotFaqRule[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type UpdateBotSettingsBody = Partial<
  Omit<BotSettings, 'id' | 'companyOwnerId' | 'createdAt' | 'updatedAt'>
>;

// ============================================
// Entrenamiento (casos + base de conocimiento)
// ============================================
export type TrainingCaseStatus = 'PENDING' | 'TAUGHT' | 'ESCALATED' | 'DISMISSED';
export type TrainingCategory =
  | 'QUEJA'
  | 'RECLAMO'
  | 'CONSULTA_PRODUCTO'
  | 'FUERA_DE_TEMA'
  | 'NO_SE'
  | 'OTRO';

export interface TrainingCase {
  id: string;
  conversationId: string;
  messageId: string;
  customerId: string | null;
  phone: string;
  category: TrainingCategory;
  summary: string | null;
  customerText: string | null;
  status: TrainingCaseStatus;
  resolutionNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  companyOwnerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetTrainingCasesParams {
  status?: TrainingCaseStatus;
}

export interface TeachCaseBody {
  topic: string;
  triggerKeywords: string[];
  answer: string;
  category?: TrainingCategory | null;
  replyNow?: boolean;
}

export interface EscalateCaseBody {
  note?: string;
}

export interface TeachCaseResponse {
  status: 'TAUGHT';
  knowledgeId: string;
}

export interface TrainingKnowledge {
  id: string;
  companyOwnerId: string;
  topic: string;
  triggerKeywords: string[];
  answer: string;
  category: TrainingCategory | null;
  isActive: boolean;
  sourceEscalationId: string | null;
  hits: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetTrainingKnowledgeParams {
  includeInactive?: boolean;
}

export interface CreateKnowledgeBody {
  topic: string;
  triggerKeywords: string[];
  answer: string;
  category?: TrainingCategory | null;
}

export type UpdateKnowledgeBody = Partial<CreateKnowledgeBody & { isActive: boolean }>;
