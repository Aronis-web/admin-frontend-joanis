/**
 * Tipos del módulo Webmail / Correo corporativo.
 * Basado en la documentación del backend svc-admin.
 */

/** Envoltorio estándar de respuesta del backend. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

// ============================================================================
// Estado del buzón
// ============================================================================

export interface MailboxStatus {
  configured: boolean;
  active: boolean;
  emailAddress: string | null;
}

// ============================================================================
// Bandeja / listado
// ============================================================================

export interface MessageListItem {
  uid: number;
  seq: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
}

export interface ListMessagesParams {
  page?: number;
  pageSize?: number;
  folder?: string;
}

export interface ListMessagesResponse {
  folder: string;
  total: number;
  page: number;
  pageSize: number;
  messages: MessageListItem[];
}

// ============================================================================
// Detalle de mensaje
// ============================================================================

export interface MessageAttachment {
  index: number;
  filename: string;
  contentType: string;
  size: number;
}

export interface MessageDetail {
  uid: number;
  messageId: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  text: string;
  html: string;
  inReplyTo: string | null;
  references: string[];
  attachments: MessageAttachment[];
}

// ============================================================================
// Envío
// ============================================================================

export interface SendAttachment {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

export interface SendMailDto {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text?: string;
  html?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: SendAttachment[];
}

export interface SendMailResponse {
  messageId: string;
  accepted: string[];
  archived: boolean;
}

// ============================================================================
// Carpetas
// ============================================================================

/** Uso especial de la carpeta según convención IMAP. */
export type FolderSpecialUse =
  | '\\Inbox'
  | '\\Sent'
  | '\\Drafts'
  | '\\Archive'
  | '\\Junk'
  | '\\Trash'
  | '\\All'
  | '\\Flagged'
  | string;

export interface MailFolder {
  path: string;
  name: string;
  specialUse: FolderSpecialUse | null;
  total: number;
  unread: number;
  subscribed: boolean;
}

// ============================================================================
// Cuota
// ============================================================================

export interface MailboxQuota {
  usedBytes: number | null;
  limitBytes: number | null;
  usedPercent: number | null;
  messages: number | null;
}

// ============================================================================
// Búsqueda inteligente
// ============================================================================

export interface SearchParams {
  q: string;
  folder?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchResponse extends ListMessagesResponse {
  query: string;
}

// ============================================================================
// Hilo / conversación
// ============================================================================

export interface ThreadMessage {
  uid: number;
  subject: string;
  from: string;
  date: string;
}

export interface ThreadResponse {
  folder: string;
  subject: string;
  count: number;
  messages: ThreadMessage[];
}

// ============================================================================
// Acciones sobre mensajes
// ============================================================================

export interface UpdateFlagsDto {
  seen?: boolean;
  flagged?: boolean;
}

export interface MoveMessageDto {
  toFolder: string;
}

export interface MoveResult {
  moved: boolean;
  toFolder: string;
}

// ============================================================================
// Administración
// ============================================================================

export interface AdminMailboxStatus extends MailboxStatus {}

export interface ProvisionMailboxDto {
  userId: string;
  password: string;
}

export interface ProvisionMailboxResponse {
  id: string;
  userId: string;
  emailAddress: string;
  isActive: boolean;
}

export interface BulkProvisionResult {
  ok: string[];
  failed: { userId: string; error: string }[];
}

// ============================================================================
// Archivo histórico (admin) — declarado para uso futuro
// ============================================================================

export type ArchiveDirection = 'INBOUND' | 'OUTBOUND';
export type ArchiveSource = 'MTA_ARCHIVE' | 'SYSTEM_SEND';

export interface ArchiveItem {
  id: string;
  messageId: string;
  direction: ArchiveDirection;
  source: ArchiveSource;
  fromAddress: string;
  toAddresses: string;
  ccAddresses: string | null;
  bccAddresses: string | null;
  subject: string;
  sentAt: string;
  sizeBytes: number;
  sha256: string;
  emlPath: string;
  ownerUserId: string | null;
  ingestedAt: string;
}

export interface ArchiveQueryParams {
  direction?: ArchiveDirection;
  from?: string;
  subject?: string;
  page?: number;
  pageSize?: number;
}

export interface ArchiveListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: ArchiveItem[];
}
