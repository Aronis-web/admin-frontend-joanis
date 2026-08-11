import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { webmailApi, webmailAdminApi } from '@/services/api/webmail';
import type {
  ArchiveQueryParams,
  ListMessagesParams,
  ListMessagesResponse,
  MailboxStatus,
  MessageListItem,
  SearchParams,
  SearchResponse,
  SendMailDto,
  UpdateFlagsDto,
} from '@/types/webmail';
import { logger } from '@/utils/logger';

// ============================================================================
// Query keys
// ============================================================================

export const webmailKeys = {
  all: ['webmail'] as const,
  status: () => [...webmailKeys.all, 'status'] as const,
  folders: () => [...webmailKeys.all, 'folders'] as const,
  quota: () => [...webmailKeys.all, 'quota'] as const,
  messages: (params: ListMessagesParams) => [...webmailKeys.all, 'messages', params] as const,
  message: (uid: number, folder: string) => [...webmailKeys.all, 'message', folder, uid] as const,
  thread: (uid: number, folder: string) => [...webmailKeys.all, 'thread', folder, uid] as const,
  search: (params: SearchParams) => [...webmailKeys.all, 'search', params] as const,

  // Admin
  adminAll: ['webmail', 'admin'] as const,
  adminMailboxStatus: (userId: string) =>
    [...webmailKeys.adminAll, 'mailbox-status', userId] as const,
  adminArchive: (params: ArchiveQueryParams) =>
    [...webmailKeys.adminAll, 'archive', params] as const,
  adminArchiveItem: (id: string) => [...webmailKeys.adminAll, 'archive-item', id] as const,
};

// ============================================================================
// Queries — Usuario
// ============================================================================

export const useWebmailStatus = (enabled = true) =>
  useQuery({
    queryKey: webmailKeys.status(),
    queryFn: () => webmailApi.getStatus(),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useWebmailFolders = (enabled = true) =>
  useQuery({
    queryKey: webmailKeys.folders(),
    queryFn: () => webmailApi.listFolders(),
    enabled,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useWebmailQuota = (enabled = true) =>
  useQuery({
    queryKey: webmailKeys.quota(),
    queryFn: () => webmailApi.getQuota(),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useWebmailMessages = (params: ListMessagesParams = {}, enabled = true) =>
  useQuery({
    queryKey: webmailKeys.messages({
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
      folder: params.folder ?? 'INBOX',
    }),
    queryFn: () => webmailApi.listMessages(params),
    enabled,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useWebmailMessage = (uid: number | undefined, folder: string = 'INBOX') =>
  useQuery({
    queryKey: webmailKeys.message(uid ?? -1, folder),
    queryFn: () => webmailApi.getMessage(uid as number, folder),
    enabled: uid !== undefined && uid !== null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useWebmailThread = (
  uid: number | undefined,
  folder: string = 'INBOX',
  enabled = true
) =>
  useQuery({
    queryKey: webmailKeys.thread(uid ?? -1, folder),
    queryFn: () => webmailApi.getThread(uid as number, folder),
    enabled: enabled && uid !== undefined && uid !== null,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useWebmailSearch = (params: SearchParams, enabled = true) =>
  useQuery({
    queryKey: webmailKeys.search({
      q: params.q,
      folder: params.folder ?? 'INBOX',
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    }),
    queryFn: () => webmailApi.search(params),
    enabled: enabled && params.q.trim().length > 0,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

// ============================================================================
// Mutations — Usuario
// ============================================================================

type QueryClient = ReturnType<typeof useQueryClient>;
type MessageListData = ListMessagesResponse | SearchResponse;
type ListSnapshot = [readonly unknown[], MessageListData | undefined][];

/** Invalida listas/detalles/carpetas/cuota tras una acción sobre un mensaje. */
const invalidateMailboxData = (qc: QueryClient) => {
  void qc.invalidateQueries({ queryKey: webmailKeys.all });
};

/** ¿Es una query de listado (bandeja) o de búsqueda? Ambas comparten shape. */
const isMessageListKey = (key: readonly unknown[]): boolean =>
  key[0] === 'webmail' && (key[1] === 'messages' || key[1] === 'search');

/** Toma una foto de todas las listas de mensajes/búsqueda en cache. */
const snapshotMessageLists = (qc: QueryClient): ListSnapshot =>
  qc
    .getQueriesData<MessageListData>({ queryKey: webmailKeys.all })
    .filter(([key]) => isMessageListKey(key));

/** Restaura las listas a partir de una foto previa (rollback en onError). */
const restoreMessageLists = (qc: QueryClient, snapshot?: ListSnapshot) => {
  snapshot?.forEach(([key, data]) => {
    qc.setQueryData(key, data);
  });
};

/**
 * Quita un mensaje (por uid) de todas las listas/búsquedas cacheadas y ajusta
 * el total. Update optimista: la fila desaparece al instante sin esperar al
 * refetch, evitando la sensación de que "no se actualiza" cuando el IMAP tarda.
 */
const optimisticallyRemoveMessage = (qc: QueryClient, uid: number): ListSnapshot => {
  const snapshot = snapshotMessageLists(qc);
  snapshot.forEach(([key, data]) => {
    if (!data?.messages) return;
    const messages = data.messages.filter((m) => m.uid !== uid);
    if (messages.length === data.messages.length) return;
    qc.setQueryData<MessageListData>(key, {
      ...data,
      messages,
      total: Math.max(0, data.total - 1),
    });
  });
  return snapshot;
};

/** Aplica un parche a un mensaje concreto en todas las listas cacheadas. */
const optimisticallyPatchMessage = (
  qc: QueryClient,
  uid: number,
  patch: Partial<MessageListItem>
): ListSnapshot => {
  const snapshot = snapshotMessageLists(qc);
  snapshot.forEach(([key, data]) => {
    if (!data?.messages) return;
    let changed = false;
    const messages = data.messages.map((m) => {
      if (m.uid !== uid) return m;
      changed = true;
      return { ...m, ...patch };
    });
    if (changed) qc.setQueryData<MessageListData>(key, { ...data, messages });
  });
  return snapshot;
};

/**
 * Callbacks compartidos para mutaciones que RETIRAN un mensaje de la carpeta
 * actual (archivar, papelera, spam, mover, eliminar). Aplica update optimista,
 * hace rollback si falla e invalida al terminar.
 */
const removalMutationCallbacks = <TVars extends { uid: number }>(qc: QueryClient) => ({
  onMutate: async (vars: TVars): Promise<{ snapshot: ListSnapshot }> => {
    await qc.cancelQueries({ queryKey: webmailKeys.all });
    const snapshot = optimisticallyRemoveMessage(qc, vars.uid);
    return { snapshot };
  },
  onError: (_error: unknown, _vars: TVars, ctx?: { snapshot: ListSnapshot }) => {
    restoreMessageLists(qc, ctx?.snapshot);
  },
  onSettled: () => invalidateMailboxData(qc),
});

export const useSendMail = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: SendMailDto) => webmailApi.sendMail(dto),
    onSuccess: () => invalidateMailboxData(qc),
    onError: (error) => {
      logger.error('Error enviando correo:', error);
    },
  });
};

export const useUpdateFlags = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, folder, dto }: { uid: number; folder: string; dto: UpdateFlagsDto }) =>
      webmailApi.updateFlags(uid, dto, folder),
    onMutate: async ({ uid, dto }) => {
      await qc.cancelQueries({ queryKey: webmailKeys.all });
      const patch: Partial<MessageListItem> = {};
      if (dto.seen !== undefined) patch.seen = dto.seen;
      if (dto.flagged !== undefined) patch.flagged = dto.flagged;
      const snapshot = optimisticallyPatchMessage(qc, uid, patch);
      return { snapshot };
    },
    onError: (error, _vars, ctx) => {
      restoreMessageLists(qc, ctx?.snapshot);
      logger.error('Error actualizando flags:', error);
    },
    onSettled: () => invalidateMailboxData(qc),
  });
};

export const useMoveMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, folder, toFolder }: { uid: number; folder: string; toFolder: string }) =>
      webmailApi.moveMessage(uid, toFolder, folder),
    ...removalMutationCallbacks<{ uid: number; folder: string; toFolder: string }>(qc),
    onError: (error, vars, ctx) => {
      restoreMessageLists(qc, ctx?.snapshot);
      logger.error('Error moviendo mensaje:', error);
    },
  });
};

export const useArchiveMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, folder }: { uid: number; folder: string }) =>
      webmailApi.archiveMessage(uid, folder),
    ...removalMutationCallbacks<{ uid: number; folder: string }>(qc),
    onError: (error, vars, ctx) => {
      restoreMessageLists(qc, ctx?.snapshot);
      logger.error('Error archivando mensaje:', error);
    },
  });
};

export const useMarkSpam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, folder }: { uid: number; folder: string }) =>
      webmailApi.markSpam(uid, folder),
    ...removalMutationCallbacks<{ uid: number; folder: string }>(qc),
    onError: (error, vars, ctx) => {
      restoreMessageLists(qc, ctx?.snapshot);
      logger.error('Error marcando como spam:', error);
    },
  });
};

export const useMarkNotSpam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, folder }: { uid: number; folder: string }) =>
      webmailApi.markNotSpam(uid, folder),
    ...removalMutationCallbacks<{ uid: number; folder: string }>(qc),
    onError: (error, vars, ctx) => {
      restoreMessageLists(qc, ctx?.snapshot);
      logger.error('Error restaurando de spam:', error);
    },
  });
};

export const useTrashMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, folder }: { uid: number; folder: string }) =>
      webmailApi.trashMessage(uid, folder),
    ...removalMutationCallbacks<{ uid: number; folder: string }>(qc),
    onError: (error, vars, ctx) => {
      restoreMessageLists(qc, ctx?.snapshot);
      logger.error('Error enviando a papelera:', error);
    },
  });
};

export const useDeleteMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, folder }: { uid: number; folder: string }) =>
      webmailApi.deleteMessage(uid, folder),
    ...removalMutationCallbacks<{ uid: number; folder: string }>(qc),
    onError: (error, vars, ctx) => {
      restoreMessageLists(qc, ctx?.snapshot);
      logger.error('Error eliminando mensaje:', error);
    },
  });
};

export const useEmptyTrash = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => webmailApi.emptyTrash(),
    onSuccess: () => invalidateMailboxData(qc),
    onError: (error) => {
      logger.error('Error vaciando papelera:', error);
    },
  });
};

// ============================================================================
// Queries / Mutations — Admin (aprovisionamiento)
// ============================================================================

export const useAdminMailboxStatus = (userId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: webmailKeys.adminMailboxStatus(userId ?? ''),
    queryFn: () => webmailAdminApi.getMailboxStatus(userId as string),
    enabled: !!userId && enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useProvisionMailbox = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      webmailAdminApi.provisionMailbox(userId, password),
    onSuccess: (data, { userId }) => {
      qc.setQueryData<MailboxStatus>(webmailKeys.adminMailboxStatus(userId), {
        configured: true,
        active: data.isActive,
        emailAddress: data.emailAddress,
      });
      void qc.invalidateQueries({ queryKey: webmailKeys.adminMailboxStatus(userId) });
    },
    onError: (error) => {
      logger.error('Error aprovisionando buzón:', error);
    },
  });
};

export const useDeactivateMailbox = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => webmailAdminApi.deactivateMailbox(userId),
    onSuccess: (_data, userId) => {
      void qc.invalidateQueries({ queryKey: webmailKeys.adminMailboxStatus(userId) });
    },
    onError: (error) => {
      logger.error('Error desactivando buzón:', error);
    },
  });
};

// ============================================================================
// Queries — Admin archivo
// ============================================================================

export const useWebmailArchive = (params: ArchiveQueryParams = {}, enabled = true) =>
  useQuery({
    queryKey: webmailKeys.adminArchive({
      direction: params.direction,
      from: params.from,
      subject: params.subject,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    }),
    queryFn: () => webmailAdminApi.searchArchive(params),
    enabled,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useWebmailArchiveItem = (id: string | undefined) =>
  useQuery({
    queryKey: webmailKeys.adminArchiveItem(id ?? ''),
    queryFn: () => webmailAdminApi.getArchiveItem(id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
