import { apiClient } from './client';
import { config } from '@/utils/config';
import { downloadWithAuth } from '@/utils/downloadWithAuth';
import type {
  ApiEnvelope,
  ArchiveItem,
  ArchiveListResponse,
  ArchiveQueryParams,
  BulkProvisionResult,
  ListMessagesParams,
  ListMessagesResponse,
  MailboxQuota,
  MailboxStatus,
  MailFolder,
  MessageDetail,
  MoveResult,
  ProvisionMailboxResponse,
  SearchParams,
  SearchResponse,
  SendMailDto,
  SendMailResponse,
  ThreadResponse,
  UpdateFlagsDto,
} from '@/types/webmail';

/**
 * Desempaca el envoltorio { success, data } del backend, devolviendo `data`.
 */
const unwrap = <T>(res: ApiEnvelope<T>): T => res.data;

// ============================================================================
// Endpoints de USUARIO — /webmail
// ============================================================================

export const webmailApi = {
  /** Estado del buzón del usuario logueado. */
  getStatus: async (): Promise<MailboxStatus> => {
    const res = await apiClient.get<ApiEnvelope<MailboxStatus>>('/webmail/status');
    return unwrap(res);
  },

  /** Listar mensajes de una carpeta. */
  listMessages: async (params: ListMessagesParams = {}): Promise<ListMessagesResponse> => {
    const query = {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
      folder: params.folder ?? 'INBOX',
    };
    const res = await apiClient.get<ApiEnvelope<ListMessagesResponse>>('/webmail/messages', {
      params: query,
    });
    return unwrap(res);
  },

  /** Detalle de un mensaje. Marca como leído (\Seen) como efecto lateral. */
  getMessage: async (uid: number, folder: string = 'INBOX'): Promise<MessageDetail> => {
    const res = await apiClient.get<ApiEnvelope<MessageDetail>>(`/webmail/messages/${uid}`, {
      params: { folder },
    });
    return unwrap(res);
  },

  /**
   * Descarga un adjunto como Blob (binario).
   * Cross-platform: combinar con `saveAndShareFile` para guardar/compartir.
   */
  downloadAttachment: async (
    uid: number,
    index: number,
    folder: string = 'INBOX'
  ): Promise<Blob> => {
    const url = `${config.API_URL}/webmail/messages/${uid}/attachments/${index}?folder=${encodeURIComponent(folder)}`;
    return downloadWithAuth(url);
  },

  /** Enviar un correo (nuevo o respuesta). */
  sendMail: async (dto: SendMailDto): Promise<SendMailResponse> => {
    const res = await apiClient.post<ApiEnvelope<SendMailResponse>>('/webmail/send', dto);
    return unwrap(res);
  },

  // ------------- Carpetas / cuota -------------

  /** Lista de carpetas del buzón con conteos. */
  listFolders: async (): Promise<MailFolder[]> => {
    const res = await apiClient.get<ApiEnvelope<MailFolder[]>>('/webmail/folders');
    return unwrap(res);
  },

  /** Cuota del buzón (usedBytes, limitBytes, usedPercent, messages). */
  getQuota: async (): Promise<MailboxQuota> => {
    const res = await apiClient.get<ApiEnvelope<MailboxQuota>>('/webmail/quota');
    return unwrap(res);
  },

  // ------------- Búsqueda -------------

  /** Búsqueda inteligente con operadores + texto libre. */
  search: async (params: SearchParams): Promise<SearchResponse> => {
    const query = {
      q: params.q,
      folder: params.folder ?? 'INBOX',
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    };
    const res = await apiClient.get<ApiEnvelope<SearchResponse>>('/webmail/search', {
      params: query,
    });
    return unwrap(res);
  },

  // ------------- Hilo -------------

  /** Reconstruye la conversación de un mensaje. */
  getThread: async (uid: number, folder: string = 'INBOX'): Promise<ThreadResponse> => {
    const res = await apiClient.get<ApiEnvelope<ThreadResponse>>(
      `/webmail/messages/${uid}/thread`,
      { params: { folder } }
    );
    return unwrap(res);
  },

  // ------------- Acciones sobre mensajes -------------

  /** Actualiza flags (seen/flagged). */
  updateFlags: async (
    uid: number,
    dto: UpdateFlagsDto,
    folder: string = 'INBOX'
  ): Promise<{ updated: boolean }> => {
    const res = await apiClient.post<ApiEnvelope<{ updated: boolean }>>(
      `/webmail/messages/${uid}/flags`,
      dto,
      { params: { folder } }
    );
    return unwrap(res);
  },

  /** Mover mensaje a una carpeta arbitraria. */
  moveMessage: async (
    uid: number,
    toFolder: string,
    folder: string = 'INBOX'
  ): Promise<MoveResult> => {
    const res = await apiClient.post<ApiEnvelope<MoveResult>>(
      `/webmail/messages/${uid}/move`,
      { toFolder },
      { params: { folder } }
    );
    return unwrap(res);
  },

  /** Archivar mensaje (mueve a \\Archive). */
  archiveMessage: async (uid: number, folder: string = 'INBOX'): Promise<MoveResult> => {
    const res = await apiClient.post<ApiEnvelope<MoveResult>>(
      `/webmail/messages/${uid}/archive`,
      undefined,
      { params: { folder } }
    );
    return unwrap(res);
  },

  /** Marcar como no deseado (mueve a \\Junk). */
  markSpam: async (uid: number, folder: string = 'INBOX'): Promise<MoveResult> => {
    const res = await apiClient.post<ApiEnvelope<MoveResult>>(
      `/webmail/messages/${uid}/spam`,
      undefined,
      { params: { folder } }
    );
    return unwrap(res);
  },

  /** Restaurar desde no deseado (mueve a INBOX). */
  markNotSpam: async (uid: number, folder: string = 'INBOX.spam'): Promise<MoveResult> => {
    const res = await apiClient.post<ApiEnvelope<MoveResult>>(
      `/webmail/messages/${uid}/not-spam`,
      undefined,
      { params: { folder } }
    );
    return unwrap(res);
  },

  /** Enviar a la papelera (mueve a \\Trash). */
  trashMessage: async (uid: number, folder: string = 'INBOX'): Promise<MoveResult> => {
    const res = await apiClient.post<ApiEnvelope<MoveResult>>(
      `/webmail/messages/${uid}/trash`,
      undefined,
      { params: { folder } }
    );
    return unwrap(res);
  },

  /** Eliminar permanentemente (expunge). Usar solo desde \\Trash. */
  deleteMessage: async (
    uid: number,
    folder: string = 'INBOX.Trash'
  ): Promise<{ deleted: boolean }> => {
    const res = await apiClient.delete<ApiEnvelope<{ deleted: boolean }>>(
      `/webmail/messages/${uid}`,
      { params: { folder } }
    );
    return unwrap(res);
  },

  /** Vaciar la papelera. */
  emptyTrash: async (): Promise<{ emptied: boolean; folder: string }> => {
    const res =
      await apiClient.post<ApiEnvelope<{ emptied: boolean; folder: string }>>(
        '/webmail/trash/empty'
      );
    return unwrap(res);
  },
};

// ============================================================================
// Endpoints de ADMINISTRACIÓN — /admin/webmail
// ============================================================================

export const webmailAdminApi = {
  /** Aprovisiona (o actualiza) la contraseña del buzón de un usuario. */
  provisionMailbox: async (userId: string, password: string): Promise<ProvisionMailboxResponse> => {
    const res = await apiClient.post<ApiEnvelope<ProvisionMailboxResponse>>(
      '/admin/webmail/mailboxes',
      { userId, password }
    );
    return unwrap(res);
  },

  /** Aprovisionamiento masivo. */
  bulkProvision: async (
    items: { userId: string; password: string }[]
  ): Promise<BulkProvisionResult> => {
    const res = await apiClient.post<ApiEnvelope<BulkProvisionResult>>(
      '/admin/webmail/mailboxes/bulk',
      { items }
    );
    return unwrap(res);
  },

  /** Estado del buzón de un usuario específico. */
  getMailboxStatus: async (userId: string): Promise<MailboxStatus> => {
    const res = await apiClient.get<ApiEnvelope<MailboxStatus>>(
      `/admin/webmail/mailboxes/${userId}/status`
    );
    return unwrap(res);
  },

  /** Desactiva el buzón (no borra el registro). */
  deactivateMailbox: async (userId: string): Promise<void> => {
    await apiClient.delete<ApiEnvelope<null>>(`/admin/webmail/mailboxes/${userId}`);
  },

  // ------------- Archivo histórico (uso futuro) -------------

  /** Busca en el archivo histórico. */
  searchArchive: async (params: ArchiveQueryParams = {}): Promise<ArchiveListResponse> => {
    const res = await apiClient.get<ApiEnvelope<ArchiveListResponse>>('/admin/webmail/archive', {
      params,
    });
    return unwrap(res);
  },

  /** Detalle de un correo archivado. */
  getArchiveItem: async (id: string): Promise<ArchiveItem> => {
    const res = await apiClient.get<ApiEnvelope<ArchiveItem>>(`/admin/webmail/archive/${id}`);
    return unwrap(res);
  },

  /** Descarga el .eml crudo (RFC 822) como Blob. */
  downloadArchiveEml: async (id: string): Promise<Blob> => {
    const url = `${config.API_URL}/admin/webmail/archive/${id}/eml`;
    return downloadWithAuth(url);
  },
};

export default webmailApi;
