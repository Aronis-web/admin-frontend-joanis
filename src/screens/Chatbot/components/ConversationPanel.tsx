import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge,
  Body,
  Caption,
  EmptyState,
  ErrorState,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import {
  useConversationMessages,
  useHandoffConversation,
  useReplyConversation,
} from '@/hooks/api/useChatbotConversations';
import type { ChatConversation, ChatMessage } from '@/types/chatbot';
import { formatTime } from '../utils';
import Alert from '@/utils/alert';
import { AuthedImage } from './AuthedImage';

interface Props {
  conversation: ChatConversation | null;
  onBack?: () => void;
}

/** Une los items de todas las páginas (más recientes al final, ascendente). */
const flattenPages = (pages: { items: ChatMessage[] }[] | undefined): ChatMessage[] => {
  if (!pages || pages.length === 0) return [];
  // La primera página es la más reciente; las siguientes son más antiguas.
  // Ordenamos por createdAt ascendente después de concatenar.
  const all = pages.flatMap((p) => p.items);
  return all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

export const ConversationPanel: React.FC<Props> = ({ conversation, onBack }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversationMessages(conversation?.id, { limit: 50 }, { refetchIntervalMs: 5000 });

  const handoffMutation = useHandoffConversation();
  const replyMutation = useReplyConversation();

  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const prevCountRef = useRef(0);

  const items = useMemo(() => flattenPages(data?.pages), [data]);

  // Auto-scroll al fondo solo cuando LLEGAN mensajes nuevos (no al cargar
  // páginas antiguas hacia arriba).
  useEffect(() => {
    if (items.length === 0) {
      prevCountRef.current = 0;
      return;
    }
    const prev = prevCountRef.current;
    const last = items[items.length - 1];
    const lastPrev = prev > 0 ? items[prev - 1] : undefined;
    const grewAtEnd = items.length > prev && last?.id !== lastPrev?.id;
    if (grewAtEnd && !isFetchingNextPage) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: prev > 0 });
      });
    }
    prevCountRef.current = items.length;
  }, [items, isFetchingNextPage]);

  const handleLoadOlder = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!conversation) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title="Selecciona un chat"
          description="Elige una conversación de la lista para ver los mensajes."
        />
      </View>
    );
  }

  const handleToggleHandoff = (nextBotEnabled: boolean) => {
    handoffMutation.mutate(
      { id: conversation.id, body: { botEnabled: nextBotEnabled } },
      {
        onError: (err: any) =>
          Alert.alert('Error', err?.message ?? 'No se pudo cambiar el handoff'),
      }
    );
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!conversation.waJid) {
      Alert.alert('Error', 'La conversación no tiene JID de WhatsApp.');
      return;
    }
    const doSend = () =>
      replyMutation.mutate(
        { id: conversation.id, body: { text: trimmed, waJid: conversation.waJid as string } },
        {
          onSuccess: () => setText(''),
          onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo enviar'),
        }
      );

    if (conversation.botEnabled) {
      handoffMutation.mutate(
        { id: conversation.id, body: { botEnabled: false } },
        { onSuccess: doSend, onError: doSend }
      );
    } else {
      doSend();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.color.text.heading} />
          </Pressable>
        ) : null}
        <View style={styles.headerAvatar}>
          <Ionicons name="person" size={20} color={theme.color.text.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Title numberOfLines={1}>{conversation.phone}</Title>
          <Caption color={theme.color.text.muted} numberOfLines={1}>
            {conversation.summary ?? 'Sin resumen'}
          </Caption>
        </View>
        {!conversation.botEnabled ? (
          <Badge variant="warning" label="HUMANO" size="small" />
        ) : (
          <Badge variant="success" label="BOT" size="small" />
        )}
      </View>

      <View style={styles.handoffRow}>
        <Caption color={theme.color.text.muted}>Bot responde</Caption>
        <Switch
          value={conversation.botEnabled}
          onValueChange={handleToggleHandoff}
          disabled={handoffMutation.isPending}
        />
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.color.brand.accent} />
        </View>
      ) : isError ? (
        <View style={styles.centerBox}>
          <ErrorState
            title="Error al cargar mensajes"
            description="Reintenta en un momento."
            onRetry={() => refetch()}
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <MessageBubble message={item} theme={theme} conversationId={conversation.id} />
          )}
          onContentSizeChange={() => {
            if (prevCountRef.current === items.length) {
              // primer paint
              listRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onEndReachedThreshold={0.1}
          // FlatList "invertida": el usuario nota que scrollear hacia ARRIBA
          // en el chat (mensajes más antiguos) hace fetchNextPage. Como el
          // orden es ascendente, el "inicio" de la lista visualmente son los
          // mensajes viejos → usamos `onScroll` para detectar el tope.
          onScroll={({ nativeEvent }) => {
            if (nativeEvent.contentOffset.y <= 40) handleLoadOlder();
          }}
          scrollEventThrottle={200}
          ListHeaderComponent={
            hasNextPage ? (
              <View style={styles.loadOlderWrap}>
                {isFetchingNextPage ? (
                  <ActivityIndicator size="small" color={theme.color.text.muted} />
                ) : (
                  <Pressable onPress={handleLoadOlder} style={styles.loadOlderBtn}>
                    <Ionicons name="arrow-up" size={14} color={theme.color.text.muted} />
                    <Caption color={theme.color.text.muted}>Cargar mensajes anteriores</Caption>
                  </Pressable>
                )}
              </View>
            ) : null
          }
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escribe un mensaje…"
          placeholderTextColor={theme.color.text.muted}
          style={styles.input}
          multiline
          editable={!replyMutation.isPending}
        />
        <Pressable
          onPress={handleSend}
          disabled={replyMutation.isPending || !text.trim()}
          style={[
            styles.sendBtn,
            (replyMutation.isPending || !text.trim()) && styles.sendBtnDisabled,
          ]}
        >
          {replyMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

interface BubbleProps {
  message: ChatMessage;
  theme: Theme;
  conversationId: string;
}

const MessageBubble: React.FC<BubbleProps> = ({ message, theme, conversationId }) => {
  const styles = useThemedStyles(createStyles);
  // Alinear por `direction` según guía del backend: in=cliente (izq), out=bot/asesor (der).
  // Fallback: si el shape viene sin `direction` (legacy), usamos role === 'user' como cliente.
  const isIncoming = message.direction ? message.direction === 'in' : message.role === 'user';
  const isSystem = message.role === 'system' || message.role === 'tool';
  const text = message.text ?? message.content ?? null;

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <Caption color={theme.color.text.muted}>{text}</Caption>
      </View>
    );
  }

  const isImage = message.mediaType === 'image' || !!message.mediaUrl;

  return (
    <View style={[styles.bubbleWrap, isIncoming ? styles.bubbleLeft : styles.bubbleRight]}>
      <View style={[styles.bubble, isIncoming ? styles.bubbleUser : styles.bubbleAssistant]}>
        {isImage ? (
          <AuthedImage
            conversationId={conversationId}
            messageId={message.id}
            width={220}
            height={220}
          />
        ) : null}
        {text ? <Body style={isIncoming ? undefined : { color: '#fff' }}>{text}</Body> : null}
        <Caption color={isIncoming ? theme.color.text.muted : '#ffffffb0'} style={styles.timeText}>
          {formatTime(message.createdAt)}
        </Caption>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[5],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      padding: spacing[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.default,
    },
    backBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.color.background.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    handoffRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      backgroundColor: theme.color.background.subtle,
    },
    centerBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      padding: spacing[3],
      gap: spacing[2],
    },
    loadOlderWrap: {
      alignItems: 'center',
      paddingVertical: spacing[2],
    },
    loadOlderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.background.subtle,
    },
    bubbleWrap: {
      width: '100%',
      flexDirection: 'row',
      marginBottom: spacing[1],
    },
    bubbleLeft: {
      justifyContent: 'flex-start',
    },
    bubbleRight: {
      justifyContent: 'flex-end',
    },
    bubble: {
      maxWidth: '80%',
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.lg,
      gap: 4,
    },
    bubbleUser: {
      backgroundColor: theme.color.background.subtle,
      borderTopLeftRadius: 4,
    },
    bubbleAssistant: {
      backgroundColor: theme.color.brand.accent,
      borderTopRightRadius: 4,
    },
    systemWrap: {
      alignItems: 'center',
      paddingVertical: spacing[1],
    },
    timeText: {
      alignSelf: 'flex-end',
      marginTop: 2,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: spacing[3],
      gap: spacing[2],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.background.subtle,
      color: theme.color.text.body,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.brand.accent,
    },
    sendBtnDisabled: {
      opacity: 0.5,
    },
  });
