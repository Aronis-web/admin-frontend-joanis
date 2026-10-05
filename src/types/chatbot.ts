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
/**
 * Tipo de adjunto entregado por WhatsApp. `null` indica que el mensaje no
 * tiene media.
 */
export type ChatbotMessageMediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker' | null;
/**
 * Estado del escaneo antivirus (ClamAV) sobre el adjunto.
 *
 * - `clean` / `skipped` — se puede reproducir/descargar normalmente.
 * - `pending` — aún en análisis o motor en standby; deshabilitar descarga.
 * - `infected` — malware detectado; archivo eliminado del servidor.
 */
export type ChatbotMessageScanStatus = 'clean' | 'infected' | 'pending' | 'skipped';
export type BotEmojiLevel = 'none' | 'low' | 'high';
export type ChatbotOrderStatus =
  | 'PENDING_PAYMENT'
  | 'AWAITING_BALANCE'
  | 'VALIDATED'
  | 'EMITTED'
  | 'REJECTED'
  | 'EXPIRED';

/**
 * Estado de conciliación de un voucher (comprobante de pago) frente al pedido.
 * - `PENDING` — aún sin conciliar.
 * - `MATCHED` — monto coincide con el saldo esperado.
 * - `MISMATCH_LESS` / `MISMATCH_MORE` — pagó de menos / de más.
 * - `ORPHAN` — sin pedido asociado.
 * - `DUPLICATE` — número de operación repetido.
 * - `REJECTED` — descartado por un operador.
 */
export type VoucherStatus =
  | 'PENDING'
  | 'MATCHED'
  /** Un asesor confirmó que el pago llegó a la cuenta. */
  | 'VERIFIED'
  | 'MISMATCH_LESS'
  | 'MISMATCH_MORE'
  | 'ORPHAN'
  | 'DUPLICATE'
  | 'REJECTED';

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
  /** Casos escalados por el bot pendientes de atender. */
  pendingEscalations?: number;
  /** Resumen del caso escalado más reciente. */
  escalationSummary?: string | null;
  /** Último mensaje (vista previa en la bandeja). */
  lastMessage?: { role: string; text: string | null; at: string } | null;
  /** true si el último mensaje es del cliente (nadie le respondió). */
  awaitingReply?: boolean;
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
  /**
   * Nombre original del archivo. Solo definido cuando
   * `mediaType === 'document'`.
   */
  fileName?: string | null;
  /**
   * Estado del escaneo antivirus del adjunto. Si el backend legacy no lo
   * envía, tratar como `'skipped'` (compatibilidad).
   */
  scanStatus?: ChatbotMessageScanStatus;
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
  /** Vista rápida: escalados, sin responder, en humano o por validar. */
  view?: ConversationView;
  /** Red social: whatsapp, messenger o instagram. */
  channel?: 'whatsapp' | 'messenger' | 'instagram';
}

/** Vistas rápidas de la bandeja (`GET /chatbot/conversations?view=`). */
export type ConversationView = 'escalated' | 'unanswered' | 'human' | 'validation';

/** Conteos de cada vista rápida (`GET /chatbot/conversations/counts`). */
export type ConversationCounts = Record<ConversationView, number>;

/** Caso escalado pendiente de una conversación. */
export interface ConversationEscalation {
  id: string;
  category: string;
  summary: string | null;
  customerText: string | null;
  createdAt: string;
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
/** Entrega de un pedido del bot (`chatbot_orders.fulfillment`). */
export interface ChatbotOrderFulfillment {
  type: 'PICKUP' | 'DELIVERY_LIMA' | 'AGENCY';
  siteId?: string | null;
  /** Punto de recojo o agencia. */
  name?: string | null;
  address?: string | null;
  reference?: string | null;
  lat?: number | null;
  lng?: number | null;
  agency?: string | null;
  /** AGENCY: ciudad / sede de destino. */
  destination?: string | null;
  distanceKm?: number | null;
  feeCents: number;
  /** Detalles que pidio el cliente (color, talla...). Sin garantia. */
  orderNotes?: string | null;
  /** DELIVERY_LIMA: indicaciones para la entrega. */
  deliveryNotes?: string | null;
}

export interface ChatbotOrder {
  id: string;
  cartId: string;
  conversationId: string;
  customerId: string | null;
  /** Nombre y teléfono del cliente (de la conversación). */
  customerName?: string | null;
  phone?: string | null;
  voucherUrl: string | null;
  status: ChatbotOrderStatus;
  stockReservationIds: string[] | null;
  saleIds: string[] | null;
  /** Total del pedido en centavos (llega como string). */
  totalCents: string;
  /** Monto ya acreditado por vouchers conciliados, en centavos (string). */
  paidCents: string;
  /**
   * Saldo en centavos: `pagado - total` (asi lo calcula el backend). Llega
   * como número. `< 0` falta pagar; `0` cubierto; `> 0` pagó de más (a favor).
   */
  balanceCents: number;
  /** Tarifa de envío incluida en `totalCents` (string, "0" = recojo). */
  deliveryFeeCents?: string;
  /** Modalidad de entrega elegida al cerrar el pedido (null en pedidos antiguos). */
  fulfillment?: ChatbotOrderFulfillment | null;
  rejectedReason: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  /**
   * Datos de entrega informados durante el onboarding (modo cajón).
   * Se adjuntan en las notas del pedido/venta al hacer checkout.
   */
  deliveryInLima?: boolean | null;
  deliveryAgency?: 'SHALOM' | 'FLORES' | 'MARVISUR' | null;
  deliveryAddress?: string | null;
  companyOwnerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetChatbotOrdersParams {
  /**
   * Filtra por estado del pedido. Acepta uno o varios estados:
   * - Omitido → el backend devuelve TODOS los pedidos.
   * - `ChatbotOrderStatus` → un solo estado.
   * - `ChatbotOrderStatus[]` → varios estados (se serializan como
   *   `?status=PENDING_PAYMENT,AWAITING_BALANCE`).
   * - `'ALL'` → todos los pedidos (cualquier estado).
   */
  status?: ChatbotOrderStatus | ChatbotOrderStatus[] | 'ALL';
}

export interface ValidateChatbotOrderResponse {
  status: 'EMITTED' | 'VALIDATED';
  saleIds?: string[];
  note?: string;
  error?: string;
}

export interface RejectChatbotOrderBody {
  reason?: string;
  /**
   * Si se envía, la acción aplica a un voucher específico del pedido en vez de
   * cancelar el pedido completo.
   */
  voucherId?: string;
  /**
   * - `request` — descarta el voucher y vuelve a pedir el comprobante
   *   (el pedido regresa a `AWAITING_BALANCE`).
   * - `cancel` — cancela/rechaza el pedido completo.
   */
  action?: 'request' | 'cancel';
}

/**
 * Voucher (comprobante de pago) asociado a una conversación / pedido.
 * `GET /chatbot/conversations/:id/vouchers`.
 */
export interface ConversationVoucher {
  id: string;
  conversationId: string;
  orderId: string | null;
  imageUrl: string | null;
  bank: string | null;
  operationNumber: string | null;
  operationDate: string | null;
  operationTime: string | null;
  /** Monto detectado en el voucher, en centavos. */
  amountCents: number | null;
  currency: string | null;
  beneficiaryName: string | null;
  status: VoucherStatus;
  createdAt: string;
  updatedAt: string;
}

/** Body para extender la vigencia del apartado de stock de un pedido. */
export interface ExtendChatbotOrderBody {
  hours?: number;
}

/** Respuesta de `POST /chatbot/orders/:id/extend-hold`. */
export interface ExtendChatbotOrderResponse {
  status: 'EXTENDED';
  hours: number;
  holds: number;
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

/** Modo de LLM del bot. */
export type BotLlmMode = 'SONNET' | 'TIERED' | 'DEEPSEEK';

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
  /** Modo "Venta por cajón": catálogo curado a precio fijo, sin gate de nivel. */
  crateMode: boolean;
  /** Modelo chico (barato) mientras el cliente saluda/explora; el grande al negociar y cerrar. */
  modelTiering?: boolean;
  /** Modelo de IA: SONNET | TIERED (economico al explorar) | DEEPSEEK. */
  llmMode?: BotLlmMode;
  /** true si el servidor tiene DEEPSEEK_API_KEY (modo DeepSeek disponible). */
  deepseekAvailable?: boolean;
  /**
   * Entrega al cerrar el pedido (recojo en tienda / delivery). `null` = el bot
   * no pregunta la entrega.
   */
  fulfillmentConfig?: BotFulfillmentConfig | null;
  /** Medios de pago que el bot envía al confirmar el pedido. */
  paymentMethods?: BotPaymentMethod[];
  /** Segundos que el bot espera ante mensajes seguidos antes de responder (0–60). */
  replyWaitSeconds?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================
// Medios de pago del bot
// ============================================
export type BotPaymentMethodType = 'TRANSFER' | 'YAPE' | 'PLIN' | 'OTHER';

/** `chatbot_settings.payment_methods[]`. */
export interface BotPaymentMethod {
  id: string;
  type: BotPaymentMethodType;
  label: string;
  bank: string | null;
  holder: string | null;
  accountNumber: string | null;
  cci: string | null;
  phone: string | null;
  notes: string | null;
  enabled: boolean;
}

// ============================================
// Entrega (recojo / delivery)
// ============================================
/** Tramo de tarifa de delivery en Lima: hasta `upToKm` cuesta `feeCents`. */
export interface BotDeliveryBand {
  upToKm: number;
  feeCents: number;
}

export interface BotAgencyOption {
  code: string;
  name: string;
  /** 0 = el cliente paga el envío en destino. */
  feeCents: number;
  enabled: boolean;
}

/** `chatbot_settings.fulfillment_config`. */
export interface BotFulfillmentConfig {
  /** Sedes habilitadas como punto de recojo (sin costo), en orden. */
  pickupSiteIds: string[];
  lima: {
    enabled: boolean;
    /** Sede desde la que se despacha (origen para medir la distancia). */
    originSiteId: string | null;
    /** Tramos ordenados por km; más allá del último = sin cobertura. */
    bands: BotDeliveryBand[];
    /** Costo fijo (centavos) para todo Lima/Callao; si existe reemplaza a los tramos. */
    fixedFeeCents?: number | null;
  };
  agency: {
    enabled: boolean;
    agencies: BotAgencyOption[];
  };
}

/** Sede para configurar la entrega (`GET /chatbot/settings/fulfillment/sites`). */
export interface BotFulfillmentSite {
  id: string;
  name: string;
  district: string | null;
  address: string | null;
  /** Sin coordenadas: no hay pin de mapa ni cálculo de distancia. */
  hasCoords: boolean;
}

export type UpdateBotSettingsBody = Partial<
  Omit<BotSettings, 'id' | 'companyOwnerId' | 'createdAt' | 'updatedAt' | 'deepseekAvailable'>
>;

// ============================================
// Términos y condiciones
// ============================================
/**
 * Términos y condiciones del bot (`GET/PUT /chatbot/settings/terms`).
 * `html` es el contenido enriquecido; `null` restaura el default del sistema.
 */
export interface BotTerms {
  html: string | null;
  updatedAt?: string | null;
}

export interface BotTermsBody {
  /** HTML de los T&C. Enviar `null` para restaurar el default. */
  html: string | null;
}

// ============================================
// Métricas
// ============================================
/** Rango temporal opcional para los endpoints de métricas. */
export interface ChatbotMetricsParams {
  /** ISO date inicial (inclusive). */
  from?: string;
  /** ISO date final (inclusive). */
  to?: string;
  /** Red social (solo dashboard): filtra todos los datos. */
  channel?: 'whatsapp' | 'messenger' | 'instagram';
}

/** Tablero de ventas WhatsApp (`GET /chatbot/metrics/dashboard`). Montos en centavos. */
export interface ChatbotDashboard {
  range: { from: string; to: string };
  /** Chats, mensajes y ventas vigentes por red social. */
  /** Red filtrada (null = todas). */
  channel?: 'whatsapp' | 'messenger' | 'instagram' | null;
  /** Comparativa por red social (solo sin filtro de red). */
  byChannel?: Array<{
    channel: 'whatsapp' | 'messenger' | 'instagram';
    activeChats: number;
    newChats: number;
    customerMessages: number;
    orders: number;
    amountCents: number;
    aiCostPen: number;
    metaCostPen: number | null;
    totalCostPen: number;
    costPerOrderPen: number | null;
  }>;
  sales: {
    orders: number;
    amountCents: number;
    validated: { count: number; amountCents: number };
    pendingValidation: { count: number; amountCents: number };
    awaitingBalance: { count: number; amountCents: number; missingCents: number };
    rejectedOrExpired: number;
    deliveryFeesCents: number;
  };
  vouchers: { received: number; awaitingValidation: number; byStatus: Record<string, number> };
  conversations: { active: number; newChats: number; identified: number; optedOut: number };
  messages: { fromCustomers: number; fromBot: number; manual: number };
  ai: {
    totalUsd: number;
    byProvider: Array<{
      provider: string;
      model: string;
      calls: number;
      inputTokens: number;
      cachedTokens: number;
      outputTokens: number;
      costUsd: number;
      costPen?: number;
    }>;
    totalPen?: number;
  };
  /** Gasto total aproximado en soles (Meta + IA). */
  totalCostPen?: number;
  /** Chats y ventas desde anuncios "clic a WhatsApp" y ahorro por la ventana de 72 h. */
  ads?: {
    chats: number;
    chatsWithOrder: number;
    orders: number;
    amountCents: number;
    freeMessages: number;
    savingsPen: number;
    topAds: Array<{ headline: string; chats: number }>;
  };
  /** Serie para gráficos (por hora si el rango es <= 2 días, por día o por mes). */
  series?: {
    granularity: 'hour' | 'day' | 'month';
    points: Array<{
      bucket: string;
      orders: number;
      amountCents: number;
      customerMessages: number;
      botMessages: number;
      chats: number;
      aiPen: number;
      metaPen: number;
    }>;
  };
  meta: {
    available: boolean;
    currency: string | null;
    freeMessages: number;
    paidMessages: number;
    cost: number;
    costPen?: number | null;
    error?: string;
  };
}

/**
 * Métricas del embudo de compra (`GET /chatbot/metrics/funnel`).
 * El shape exacto lo define el backend; se tipa flexible para no acoplar.
 */
export type ChatbotFunnelMetrics = Record<string, unknown>;

/**
 * Métricas de uso / consumo de tokens (`GET /chatbot/metrics/usage`).
 * El shape exacto lo define el backend; se tipa flexible para no acoplar.
 */
export type ChatbotUsageMetrics = Record<string, unknown>;

// ============================================
// Venta por cajón (catálogo curado + precio fijo)
// ============================================
/**
 * Fila de la tabla `chatbot_crate_products`. Define un producto con su
 * almacén de origen, presentación única de venta, tope vendible y precio
 * manual fijo (igual para todos, sin niveles/tiers/margen).
 *
 * `maxSellableQty` y `priceCents` viajan como string (columnas numeric/bigint).
 * `priceCents` está en centavos (`1500` = S/ 15.00).
 */
export interface ChatbotCrateProduct {
  id: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  /** Área del almacén (bin/estante) de la cual se toma el stock vendible. */
  areaId?: string | null;
  presentationId: string | null;
  maxSellableQty: string;
  priceCents: string;
  label: string | null;
  sortOrder: number;
  isActive: boolean;
  companyOwnerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Body para crear (POST) o actualizar (PATCH) un producto de cajón. */
export interface UpsertCrateProductBody {
  productId: string;
  variantId?: string | null;
  warehouseId: string;
  /** Área del almacén (opcional). Si no se envía, aplica al almacén completo. */
  areaId?: string | null;
  presentationId?: string | null;
  maxSellableQty: number;
  /** Precio manual fijo, entero > 0 (en centavos). */
  priceCents: number;
  label?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateCrateProductBody = Partial<UpsertCrateProductBody>;

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

/** Respuesta de `POST /chatbot/orders/:id/vouchers/:voucherId/verify`. */
export interface VerifyChatbotVoucherResponse {
  voucherStatus: 'VERIFIED';
  /** PENDING si aún faltan vouchers por validar; EMITTED/VALIDATED si se cerró el pedido. */
  orderStatus: 'PENDING' | 'VALIDATED' | 'EMITTED';
  saleIds?: string[];
  note?: string;
  error?: string;
}
