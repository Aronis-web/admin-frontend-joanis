import React, { useMemo, useRef, useState, useEffect } from 'react';
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

interface Props {
  conversation: ChatConversation | null;
  onBack?: () => void;
}

export const ConversationPanel: React.FC<Props> = ({ conversation, onBack }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const {
    data: messages,
    isLoading,
    isError,
    refetch,
  } = useConversationMessages(conversation?.id, { limit: 100 }, { refetchIntervalMs: 5000 });

  const handoffMutation = useHandoffConversation();
  const replyMutation = useReplyConversation();

  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const items = useMemo(() => messages ?? [], [messages]);

  useEffect(() => {
    if (items.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [items.length]);

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
          renderItem={({ item }) => <MessageBubble message={item} theme={theme} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
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

const MessageBubble: React.FC<{ message: ChatMessage; theme: Theme }> = ({ message, theme }) => {
  const styles = useThemedStyles(createStyles);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system' || message.role === 'tool';

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <Caption color={theme.color.text.muted}>{message.content}</Caption>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleWrap, isUser ? styles.bubbleLeft : styles.bubbleRight]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {message.content ? (
          <Body style={isUser ? undefined : { color: '#fff' }}>{message.content}</Body>
        ) : null}
        {message.mediaUrl ? (
          <Caption color={isUser ? theme.color.text.muted : '#fff'}>
            [Adjunto: {message.mediaUrl}]
          </Caption>
        ) : null}
        <Caption color={isUser ? theme.color.text.muted : '#ffffffb0'} style={styles.timeText}>
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
      gap: 2,
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
