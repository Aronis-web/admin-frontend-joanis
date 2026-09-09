import { apiClient } from './client';
import { config } from '@/utils/config';
import { downloadWithAuth } from '@/utils/downloadWithAuth';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import type {
  ChatConversation,
  ChatMessage,
  ConversationSearchItem,
  GetChatMessagesParams,
  GetConversationsParams,
  HandoffBody,
  PagedConversations,
  PagedMessages,
  SearchConversationsParams,
  SendReplyBody,
} from '@/types/chatbot';

/**
 * Códigos de error del endpoint de media alineados con el estado antivirus.
 * - `pending`  → 423 (aún en análisis).
 * - `infected` → 403 (malware detectado; archivo eliminado).
 * - `notfound` → 404.
 * - `error`    → cualquier otro fallo.
 */
export type MessageMediaErrorCode = 'pending' | 'infected' | 'notfound' | 'error';

export class MessageMediaError extends Error {
  readonly code: MessageMediaErrorCode;
  readonly status: number;
  constructor(code: MessageMediaErrorCode, status: number, message?: string) {
    super(message ?? code);
    this.name = 'MessageMediaError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Extrae el `filename` del header `Content-Disposition`. Soporta el formato
 * `filename="foo.pdf"` y también `filename*=UTF-8''foo%20bar.pdf` (RFC 5987).
 */
function parseContentDispositionFileName(header: string | null): string | null {
  if (!header) return null;
  // filename*=UTF-8''<encoded>
  const extMatch = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(header);
  if (extMatch?.[1]) {
    try {
      return decodeURIComponent(extMatch[1].trim());
    } catch {
      return extMatch[1].trim();
    }
  }
  // filename="foo.pdf"  o  filename=foo.pdf
  const match = /filename\s*=\s*("([^"]+)"|([^;]+))/i.exec(header);
  const raw = match?.[2] ?? match?.[3];
  return raw ? raw.trim() : null;
}

/**
 * Chatbot · Conversaciones API Service
 *
 * Base path: `/chatbot/conversations`.
 */
class ChatbotConversationsService {
  private readonly basePath = '/chatbot/conversations';

  /**
   * Bandeja paginada por keyset (ordenada por `lastMessageAt` desc).
   *
   * El backend retorna `{ items, hasMore, nextCursor }`. Se acepta también el
   * shape legacy `ChatConversation[]` por compatibilidad con builds antiguos.
   */
  async list(params?: GetConversationsParams): Promise<PagedConversations> {
    const res = await apiClient.get<PagedConversations | ChatConversation[]>(this.basePath, {
      params,
    });
    if (Array.isArray(res)) {
      return { items: res, hasMore: false, nextCursor: null };
    }
    return res;
  }

  /**
   * Búsqueda con autocompletado por nombre del cliente o teléfono.
   * Ordena por `lastMessageAt` desc. Con `q` vacío el backend devuelve `[]`.
   */
  async search(params: SearchConversationsParams): Promise<ConversationSearchItem[]> {
    if (!params.q || !params.q.trim()) return [];
    return apiClient.get<ConversationSearchItem[]>(`${this.basePath}/search`, { params });
  }

  /**
   * Devuelve la página más reciente (o previa vía `before`) de mensajes.
   *
   * El backend retorna `{ items, hasMore, nextCursor }` en orden cronológico
   * ascendente. Se acepta también el shape legacy `ChatMessage[]` por
   * compatibilidad con builds antiguos del backend.
   */
  async getMessages(id: string, params?: GetChatMessagesParams): Promise<PagedMessages> {
    const res = await apiClient.get<PagedMessages | ChatMessage[]>(
      `${this.basePath}/${id}/messages`,
      { params }
    );
    if (Array.isArray(res)) {
      return { items: res, hasMore: false, nextCursor: null };
    }
    return res;
  }

  /**
   * Descarga el binario de un adjunto de mensaje (imagen, audio, video,
   * documento o sticker) usando fetch autenticado.
   *
   * Devuelve `blob`, `contentType` real y `fileName` original (extraído del
   * header `Content-Disposition` cuando el backend lo envía).
   *
   * Errores tipados según estado antivirus (ClamAV) del backend:
   * - `423` → `code: 'pending'`  (aún en análisis; reintentar más tarde).
   * - `403` → `code: 'infected'` (bloqueado por seguridad).
   * - `404` → `code: 'notfound'`.
   * - otros → `code: 'error'` con `status`.
   */
  async fetchMessageMedia(
    conversationId: string,
    messageId: string
  ): Promise<{ blob: Blob; contentType: string; fileName: string | null }> {
    const url = `${config.API_URL}${this.basePath}/${conversationId}/messages/${messageId}/media`;
    const authStore = useAuthStore.getState();
    const tenantStore = useTenantStore.getState();
    let token = authStore.token;
    if (!token) throw new MessageMediaError('error', 401, 'No auth token');

    const buildHeaders = (currentToken: string): Record<string, string> => {
      const headers: Record<string, string> = {
        'X-App-Id': config.APP_ID,
        'X-App-Version': config.APP_VERSION,
        Authorization: `Bearer ${currentToken}`,
      };
      const userId = authStore.user?.id;
      const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id;
      const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id;
      const warehouseId = tenantStore.selectedWarehouse?.id;
      if (userId) headers['X-User-Id'] = userId;
      if (companyId) headers['X-Company-Id'] = companyId;
      if (siteId) headers['X-Site-Id'] = siteId;
      if (warehouseId) headers['X-Warehouse-Id'] = warehouseId;
      return headers;
    };

    let res = await fetch(url, { headers: buildHeaders(token) });
    if (res.status === 401) {
      const ok = await authStore.refreshAccessToken();
      if (!ok) throw new MessageMediaError('error', 401, 'Failed to refresh token');
      token = useAuthStore.getState().token;
      if (!token) throw new MessageMediaError('error', 401, 'No token after refresh');
      res = await fetch(url, { headers: buildHeaders(token) });
    }

    if (!res.ok) {
      if (res.status === 423) throw new MessageMediaError('pending', 423);
      if (res.status === 403) throw new MessageMediaError('infected', 403);
      if (res.status === 404) throw new MessageMediaError('notfound', 404);
      throw new MessageMediaError('error', res.status, `HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const fileName = parseContentDispositionFileName(res.headers.get('content-disposition'));
    const blob = await res.blob();
    return { blob, contentType, fileName };
  }

  /**
   * @deprecated Usar {@link fetchMessageMedia} para tener acceso a
   * `contentType`, `fileName` y errores tipados de antivirus. Se mantiene por
   * compatibilidad con la vista de imágenes que solo necesita el object URL.
   */
  async getMessageMediaObjectUrl(conversationId: string, messageId: string): Promise<string> {
    const url = `${config.API_URL}${this.basePath}/${conversationId}/messages/${messageId}/media`;
    const blob = await downloadWithAuth(url);
    return URL.createObjectURL(blob);
  }

  async handoff(id: string, body: HandoffBody): Promise<{ ok: boolean }> {
    return apiClient.post<{ ok: boolean }>(`${this.basePath}/${id}/handoff`, body);
  }

  async reply(id: string, body: SendReplyBody): Promise<{ ok: boolean }> {
    return apiClient.post<{ ok: boolean }>(`${this.basePath}/${id}/reply`, body);
  }
}

export const chatbotConversationsApi = new ChatbotConversationsService();
