import React, { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { Button, EmptyState } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';
import logger from '@/utils/logger';
import {
  useArchiveMessage,
  useDeleteMessage,
  useMarkNotSpam,
  useMarkSpam,
  useMoveMessage,
  useTrashMessage,
  useUpdateFlags,
  useWebmailFolders,
  useWebmailMessage,
  useWebmailStatus,
  useWebmailThread,
  webmailKeys,
} from '@/hooks/api/useWebmail';
import { webmailApi } from '@/services/api/webmail';
import { saveAndShareFile } from '@/utils/fileDownload';
import { MAIN_ROUTES } from '@/constants/routes';
import { useOnReload } from '@/hooks/useOnReload';
import type { MessageAttachment, MessageDetail } from '@/types/webmail';
import {
  folderLabel,
  formatMailDate,
  isSpam,
  isTrash,
  parseSender,
  sortFolders,
} from './folderUtils';

const stripHtml = (html: string): string =>
  html
    ? html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

/**
 * Renderiza HTML sólo en web usando un `<div>` nativo (no `View`) para no
 * romper el layout HTML embebido con `display: flex` de React Native Web.
 */
const WebHtml: React.FC<{ html: string; theme: Theme }> = ({ html, theme }) => {
  if (Platform.OS !== 'web') return null;
  return React.createElement('div', {
    // eslint-disable-next-line react/no-danger
    dangerouslySetInnerHTML: { __html: html },
    style: {
      color: theme.color.text.body,
      fontSize: 14,
      lineHeight: 1.6,
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
      maxWidth: '100%',
    },
  });
};

interface Props {
  navigation: any;
  route: {
    params?: {
      uid: number;
      folder?: string;
    };
  };
}

export const WebmailMessageScreen: React.FC<Props> = ({ navigation, route }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const uid = route.params?.uid;
  const folder = route.params?.folder ?? 'INBOX';

  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [showMove, setShowMove] = useState(false);

  const { data, isLoading, error } = useWebmailMessage(uid, folder);
  const folders = useWebmailFolders(true);
  const thread = useWebmailThread(uid, folder, showThread);
  const status = useWebmailStatus();
  const myEmail = (status.data?.emailAddress ?? '').toLowerCase();

  // Detalle de cada mensaje del hilo (para render tipo chat con burbujas).
  const threadUids = useMemo(
    () => (showThread && thread.data ? thread.data.messages.map((m) => m.uid) : []),
    [showThread, thread.data]
  );
  const threadDetails = useQueries({
    queries: threadUids.map((tuid) => ({
      queryKey: webmailKeys.message(tuid, folder),
      queryFn: () => webmailApi.getMessage(tuid, folder),
      staleTime: 5 * 60 * 1000,
      enabled: showThread,
    })),
  });

  const inTrash = isTrash(folder, folders.data);
  const inSpam = isSpam(folder, folders.data);

  // Recarga desde el botón universal: refetch del mensaje, hilo y catálogos.
  useOnReload(() => {
    void status.refetch();
    void folders.refetch();
    if (showThread) void thread.refetch();
  });

  const updateFlags = useUpdateFlags();
  const archiveMsg = useArchiveMessage();
  const trashMsg = useTrashMessage();
  const deleteMsg = useDeleteMessage();
  const markSpam = useMarkSpam();
  const markNotSpam = useMarkNotSpam();
  const moveMsg = useMoveMessage();

  const runMutation = async (
    action: () => Promise<unknown>,
    errorMsg: string,
    goBackOnSuccess = false
  ): Promise<boolean> => {
    try {
      await action();
      if (goBackOnSuccess) navigation.goBack();
      return true;
    } catch (e: any) {
      logger.error(errorMsg, e);
      const msg = e?.response?.data?.message || e?.message || errorMsg;
      Alert.alert('Error', String(msg));
      return false;
    }
  };

  const handleDownload = async (attachment: MessageAttachment) => {
    if (uid === undefined) return;
    try {
      setDownloadingIndex(attachment.index);
      const blob = await webmailApi.downloadAttachment(uid, attachment.index, folder);
      await saveAndShareFile({
        blob,
        fileName: attachment.filename,
        mimeType: attachment.contentType || 'application/octet-stream',
        dialogTitle: `Compartir ${attachment.filename}`,
      });
    } catch (e) {
      logger.error('Error descargando adjunto:', e);
      Alert.alert('Error', 'No se pudo descargar el adjunto.');
    } finally {
      setDownloadingIndex(null);
    }
  };

  const handleReply = () => {
    if (!data) return;
    const subject = data.subject.startsWith('Re:') ? data.subject : `Re: ${data.subject}`;
    const references = [...(data.references ?? [])];
    if (data.messageId && !references.includes(data.messageId)) {
      references.push(data.messageId);
    }
    navigation.navigate(MAIN_ROUTES.WEBMAIL_COMPOSE, {
      to: data.from,
      subject,
      inReplyTo: data.messageId,
      references,
    });
  };

  const handleForward = () => {
    if (!data) return;
    const subject = data.subject.startsWith('Fwd:') ? data.subject : `Fwd: ${data.subject}`;
    const preview = data.text || stripHtml(data.html) || '';
    const body = `\n\n---------- Mensaje original ----------\nDe: ${data.from}\nFecha: ${new Date(
      data.date
    ).toLocaleString()}\nAsunto: ${data.subject}\n\n${preview}`;
    navigation.navigate(MAIN_ROUTES.WEBMAIL_COMPOSE, {
      subject,
      body,
    });
  };

  const handleToggleFlag = () => {
    if (!data) return;
    runMutation(
      () =>
        updateFlags.mutateAsync({
          uid: data.uid,
          folder,
          dto: { flagged: !(data as any).flagged },
        }),
      'No se pudo actualizar el destacado.'
    );
  };

  const handleMarkUnread = () => {
    if (!data) return;
    runMutation(
      () =>
        updateFlags.mutateAsync({
          uid: data.uid,
          folder,
          dto: { seen: false },
        }),
      'No se pudo marcar como no leído.',
      true
    );
  };

  const handleArchive = () => {
    if (!data) return;
    runMutation(
      () => archiveMsg.mutateAsync({ uid: data.uid, folder }),
      'No se pudo archivar.',
      true
    );
  };

  const handleSpam = () => {
    if (!data) return;
    runMutation(
      () => markSpam.mutateAsync({ uid: data.uid, folder }),
      'No se pudo marcar como no deseado.',
      true
    );
  };

  const handleNotSpam = () => {
    if (!data) return;
    runMutation(
      () => markNotSpam.mutateAsync({ uid: data.uid, folder }),
      'No se pudo restaurar el mensaje.',
      true
    );
  };

  const handleTrash = () => {
    if (!data) return;
    runMutation(
      () => trashMsg.mutateAsync({ uid: data.uid, folder }),
      'No se pudo mover a la papelera.',
      true
    );
  };

  const handleDelete = () => {
    if (!data) return;
    Alert.alert(
      'Eliminar permanentemente',
      '¿Confirmas que quieres eliminar este mensaje de forma permanente? No se podrá recuperar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            runMutation(
              () => deleteMsg.mutateAsync({ uid: data.uid, folder }),
              'No se pudo eliminar el mensaje.',
              true
            ),
        },
      ]
    );
  };

  const handleMoveTo = async (targetPath: string) => {
    if (!data) return;
    const ok = await runMutation(
      () => moveMsg.mutateAsync({ uid: data.uid, folder, toFolder: targetPath }),
      'No se pudo mover el mensaje.'
    );
    if (ok) {
      setShowMove(false);
      navigation.goBack();
    }
  };

  if (isLoading) {
    return (
      <ScreenLayout navigation={navigation}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.color.icon.accent} />
        </View>
      </ScreenLayout>
    );
  }

  if (error || !data) {
    return (
      <ScreenLayout navigation={navigation}>
        <EmptyState
          icon="alert-circle-outline"
          title="No se pudo cargar el mensaje"
          description="Intenta nuevamente."
          actionLabel="Volver"
          onAction={() => navigation.goBack()}
        />
      </ScreenLayout>
    );
  }

  const sender = parseSender(data.from);

  return (
    <ScreenLayout navigation={navigation}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={theme.color.icon.default} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {data.subject || '(sin asunto)'}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.actionBarScroll}
        contentContainerStyle={styles.actionBar}
      >
        <ActionBtn
          icon="arrow-undo-outline"
          label="Responder"
          onPress={handleReply}
          theme={theme}
        />
        <ActionBtn
          icon="arrow-redo-outline"
          label="Reenviar"
          onPress={handleForward}
          theme={theme}
        />
        <ActionBtn
          icon="mail-unread-outline"
          label="No leído"
          onPress={handleMarkUnread}
          theme={theme}
        />
        <ActionBtn icon="star-outline" label="Destacar" onPress={handleToggleFlag} theme={theme} />
        {!inTrash && !inSpam ? (
          <ActionBtn
            icon="archive-outline"
            label="Archivar"
            onPress={handleArchive}
            theme={theme}
          />
        ) : null}
        <ActionBtn
          icon="folder-outline"
          label="Mover"
          onPress={() => setShowMove(true)}
          theme={theme}
        />
        {!inSpam ? (
          <ActionBtn icon="warning-outline" label="Spam" onPress={handleSpam} theme={theme} />
        ) : (
          <ActionBtn
            icon="return-up-back-outline"
            label="No spam"
            onPress={handleNotSpam}
            theme={theme}
          />
        )}
        {inTrash ? (
          <ActionBtn
            icon="trash-bin-outline"
            label="Eliminar"
            onPress={handleDelete}
            theme={theme}
            danger
          />
        ) : (
          <ActionBtn
            icon="trash-outline"
            label="Papelera"
            onPress={handleTrash}
            theme={theme}
            danger
          />
        )}
        <ActionBtn
          icon="git-network-outline"
          label={showThread ? 'Ocultar hilo' : 'Ver hilo'}
          onPress={() => setShowThread((v) => !v)}
          theme={theme}
        />
      </ScrollView>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.subject}>{data.subject || '(sin asunto)'}</Text>

          <View style={styles.senderBlock}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(sender.name || sender.email || '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.senderName}>{sender.name || sender.email}</Text>
              {sender.email && sender.email !== sender.name ? (
                <Text style={styles.senderEmail}>&lt;{sender.email}&gt;</Text>
              ) : null}
              <Text style={styles.metaValue}>
                Para: <Text style={styles.metaValueStrong}>{data.to}</Text>
              </Text>
              {data.cc ? <Text style={styles.metaValue}>CC: {data.cc}</Text> : null}
              <Text style={styles.metaDate}>{new Date(data.date).toLocaleString()}</Text>
            </View>
          </View>

          {data.attachments && data.attachments.length > 0 ? (
            <View style={styles.attachments}>
              <View style={styles.attachmentsTitleRow}>
                <Ionicons name="attach" size={16} color={theme.color.icon.muted} />
                <Text style={styles.sectionTitle}>
                  {data.attachments.length} adjunto{data.attachments.length > 1 ? 's' : ''}
                </Text>
              </View>
              {data.attachments.map((att) => (
                <View key={att.index} style={styles.attachmentRow}>
                  <Ionicons
                    name="document-attach-outline"
                    size={20}
                    color={theme.color.icon.muted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {att.filename}
                    </Text>
                    <Text style={styles.attachmentSize}>
                      {(att.size / 1024).toFixed(1)} KB · {att.contentType}
                    </Text>
                  </View>
                  <Button
                    title="Descargar"
                    leftIcon="download-outline"
                    variant="secondary"
                    size="small"
                    loading={downloadingIndex === att.index}
                    onPress={() => handleDownload(att)}
                  />
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.body}>
            {Platform.OS === 'web' && data.html ? (
              <WebHtml html={data.html} theme={theme} />
            ) : (
              <Text style={styles.bodyText}>{data.text || stripHtml(data.html) || ''}</Text>
            )}
          </View>
        </View>

        {showThread ? (
          <View style={styles.threadCard}>
            <View style={styles.threadHeader}>
              <Ionicons name="chatbubbles-outline" size={18} color={theme.color.icon.accent} />
              <Text style={styles.threadTitle}>
                Conversación
                {thread.data
                  ? ` · ${thread.data.count} mensaje${thread.data.count === 1 ? '' : 's'}`
                  : ''}
              </Text>
            </View>

            {thread.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="small" color={theme.color.icon.accent} />
              </View>
            ) : !thread.data || thread.data.messages.length === 0 ? (
              <Text style={styles.threadEmpty}>Sin hilo asociado.</Text>
            ) : (
              <View style={styles.chatColumn}>
                {thread.data.messages.map((m, idx) => {
                  const detailQuery = threadDetails[idx];
                  const detail = detailQuery?.data as MessageDetail | undefined;
                  const senderRaw = detail?.from ?? m.from;
                  const s = parseSender(senderRaw);
                  const isMine = s.email.toLowerCase() === myEmail && !!myEmail;
                  const isCurrent = m.uid === data.uid;

                  return (
                    <View
                      key={m.uid}
                      style={[styles.chatRow, isMine ? styles.chatRowRight : styles.chatRowLeft]}
                    >
                      {!isMine ? (
                        <View style={styles.chatAvatar}>
                          <Text style={styles.chatAvatarText}>
                            {(s.name || s.email || '?').slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.chatBubbleWrap}>
                        <View style={styles.chatMeta}>
                          <Text style={styles.chatSender} numberOfLines={1}>
                            {isMine ? 'Tú' : s.name || s.email}
                          </Text>
                          <Text style={styles.chatDate}>{formatMailDate(m.date)}</Text>
                        </View>

                        <Pressable
                          onPress={() => {
                            if (!isCurrent) {
                              navigation.navigate(MAIN_ROUTES.WEBMAIL_MESSAGE, {
                                uid: m.uid,
                                folder,
                              });
                            }
                          }}
                          style={[
                            styles.chatBubble,
                            isMine ? styles.chatBubbleMine : styles.chatBubbleOther,
                            isCurrent && styles.chatBubbleCurrent,
                          ]}
                        >
                          {detailQuery?.isLoading ? (
                            <ActivityIndicator size="small" color={theme.color.icon.muted} />
                          ) : detailQuery?.isError || !detail ? (
                            <Text style={[styles.chatBody, isMine && styles.chatBodyMine]}>
                              {m.subject}
                            </Text>
                          ) : (
                            <>
                              {m.subject && m.subject !== data.subject ? (
                                <Text
                                  style={[styles.chatSubject, isMine && styles.chatSubjectMine]}
                                  numberOfLines={2}
                                >
                                  {m.subject}
                                </Text>
                              ) : null}

                              {Platform.OS === 'web' && detail.html ? (
                                <WebHtml html={detail.html} theme={theme} />
                              ) : (
                                <Text style={[styles.chatBody, isMine && styles.chatBodyMine]}>
                                  {detail.text || stripHtml(detail.html) || '(sin contenido)'}
                                </Text>
                              )}

                              {detail.attachments && detail.attachments.length > 0 ? (
                                <View style={styles.chatAttachments}>
                                  <Ionicons
                                    name="attach"
                                    size={14}
                                    color={
                                      isMine ? theme.color.text.onAction : theme.color.icon.muted
                                    }
                                  />
                                  <Text
                                    style={[
                                      styles.chatAttachmentText,
                                      isMine && { color: theme.color.text.onAction },
                                    ]}
                                  >
                                    {detail.attachments.length} adjunto
                                    {detail.attachments.length > 1 ? 's' : ''}
                                  </Text>
                                </View>
                              ) : null}
                            </>
                          )}
                        </Pressable>
                      </View>

                      {isMine ? (
                        <View style={[styles.chatAvatar, styles.chatAvatarMine]}>
                          <Text style={styles.chatAvatarText}>
                            {(s.name || s.email || 'Y').slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Move modal */}
      <Modal
        visible={showMove}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMove(false)}
      >
        <View style={styles.centerModal}>
          <View style={styles.moveDialog}>
            <View style={styles.moveHeader}>
              <Text style={styles.moveTitle}>Mover a…</Text>
              <TouchableOpacity onPress={() => setShowMove(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={theme.color.icon.default} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {(folders.data ? sortFolders(folders.data) : [])
                .filter((f) => f.path !== folder)
                .map((f) => (
                  <TouchableOpacity
                    key={f.path}
                    style={styles.moveItem}
                    onPress={() => handleMoveTo(f.path)}
                    disabled={moveMsg.isPending}
                  >
                    <Ionicons name="folder-outline" size={18} color={theme.color.icon.muted} />
                    <Text style={styles.moveItemLabel}>{folderLabel(f)}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
};

interface ActionBtnProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  theme: Theme;
  danger?: boolean;
}

const ActionBtn: React.FC<ActionBtnProps> = ({ icon, label, onPress, theme, danger }) => {
  // En web pasamos `title` al DOM para el tooltip nativo del navegador.
  const webProps = Platform.OS === 'web' ? ({ title: label } as any) : {};
  return (
    <TouchableOpacity
      onPress={onPress}
      style={actionBtnStyle}
      accessibilityLabel={label}
      {...webProps}
    >
      <Ionicons
        name={icon}
        size={20}
        color={danger ? theme.color.icon.danger : theme.color.icon.default}
      />
      <Text
        style={{
          fontSize: 11,
          marginTop: 4,
          color: danger ? theme.color.text.danger : theme.color.text.body,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const actionBtnStyle = {
  paddingHorizontal: 12,
  paddingVertical: 8,
  alignItems: 'center' as const,
  minWidth: 72,
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.space[3],
      gap: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    backBtn: { padding: 4 },
    topBarTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    actionBarScroll: {
      flexGrow: 0,
      flexShrink: 0,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.subtle,
    },
    actionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[2],
      gap: 4,
    },
    contentScroll: {
      flex: 1,
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: {
      padding: theme.space[4],
      gap: theme.space[4],
    },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      padding: theme.space[4],
      gap: theme.space[3],
    },
    subject: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    senderBlock: {
      flexDirection: 'row',
      gap: theme.space[3],
      paddingBottom: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: theme.color.text.onAction,
      fontSize: 18,
      fontWeight: '700',
    },
    senderName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    senderEmail: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: 6,
    },
    metaValue: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    metaValueStrong: {
      color: theme.color.text.body,
    },
    metaDate: {
      fontSize: 12,
      color: theme.color.text.subtle,
      marginTop: 4,
    },
    attachments: {
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.subtle,
      gap: theme.space[2],
    },
    attachmentsTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sectionTitle: {
      fontWeight: '700',
      color: theme.color.text.heading,
      fontSize: 13,
    },
    attachmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
    },
    attachmentName: {
      color: theme.color.text.body,
      fontSize: 14,
    },
    attachmentSize: {
      color: theme.color.text.muted,
      fontSize: 11,
      marginTop: 2,
    },
    body: {
      paddingTop: theme.space[2],
    },
    bodyText: {
      color: theme.color.text.body,
      lineHeight: 22,
      fontSize: 14,
    },
    threadCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      padding: theme.space[4],
      gap: theme.space[2],
    },
    threadHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: theme.space[2],
    },
    threadTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    threadEmpty: {
      color: theme.color.text.muted,
      fontSize: 13,
    },
    chatColumn: {
      gap: theme.space[3],
    },
    chatRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: theme.space[2],
    },
    chatRowLeft: {
      justifyContent: 'flex-start',
    },
    chatRowRight: {
      justifyContent: 'flex-end',
    },
    chatAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.color.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatAvatarMine: {
      backgroundColor: theme.color.brand.accent,
    },
    chatAvatarText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.onAction,
    },
    chatBubbleWrap: {
      maxWidth: '78%',
      minWidth: 0,
      gap: 4,
    },
    chatMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: theme.space[2],
    },
    chatSender: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.muted,
    },
    chatDate: {
      fontSize: 10,
      color: theme.color.text.subtle,
    },
    chatBubble: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.xl,
      gap: 6,
    },
    chatBubbleOther: {
      backgroundColor: theme.color.surface.subtle,
      borderTopLeftRadius: 4,
    },
    chatBubbleMine: {
      backgroundColor: theme.color.brand.accent,
      borderTopRightRadius: 4,
    },
    chatBubbleCurrent: {
      borderWidth: 2,
      borderColor: theme.color.brand.accent,
    },
    chatSubject: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 2,
    },
    chatSubjectMine: {
      color: theme.color.text.onAction,
    },
    chatBody: {
      fontSize: 13,
      color: theme.color.text.body,
      lineHeight: 20,
    },
    chatBodyMine: {
      color: theme.color.text.onAction,
    },
    chatAttachments: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    chatAttachmentText: {
      fontSize: 11,
      color: theme.color.text.muted,
    },
    centerModal: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.overlay.medium,
      padding: theme.space[4],
    },
    moveDialog: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
    },
    moveHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.space[3],
    },
    moveTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    moveItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: theme.radii.md,
    },
    moveItemLabel: {
      fontSize: 14,
      color: theme.color.text.body,
    },
  });

export default WebmailMessageScreen;
