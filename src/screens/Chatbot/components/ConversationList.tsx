import React from 'react';
import { ActivityIndicator, StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Body, Caption, EmptyState, useTheme, useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import type { ChatConversation } from '@/types/chatbot';
import { formatRelative, PURCHASE_STAGE_LABEL, PURCHASE_STAGE_VARIANT } from '../utils';

interface Props {
  conversations: ChatConversation[];
  selectedId?: string;
  onSelect: (c: ChatConversation) => void;
  isLoading?: boolean;
  /** Se dispara al llegar al final de la lista (scroll infinito). */
  onEndReached?: () => void;
  /** Muestra loader al final cuando se está cargando la siguiente página. */
  isFetchingNextPage?: boolean;
  /** Título del estado vacío (según el filtro). */
  emptyTitle?: string;
}

/** Iniciales para el avatar ("ANA PEREZ" -> "AP"). */
const initials = (name?: string | null) =>
  (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

export const ConversationList: React.FC<Props> = ({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  onEndReached,
  isFetchingNextPage,
  emptyTitle,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!isLoading && conversations.length === 0) {
    return (
      <EmptyState
        icon="chatbubbles-outline"
        title={emptyTitle ?? 'Sin conversaciones'}
        description={
          emptyTitle
            ? 'No hay chats en este filtro.'
            : 'Cuando lleguen mensajes por WhatsApp aparecerán aquí.'
        }
      />
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color={theme.color.text.muted} />
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const isSelected = item.id === selectedId;
        const displayName = item.customerName?.trim() || item.phone;
        const stage = item.purchaseStage;
        return (
          <TouchableOpacity
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
            style={[styles.row, isSelected && styles.rowSelected]}
          >
            <View style={styles.avatar}>
              {item.customerName ? (
                <Body style={styles.avatarText}>{initials(item.customerName)}</Body>
              ) : (
                <Ionicons name="person" size={20} color={theme.color.text.muted} />
              )}
              {item.awaitingReply ? <View style={styles.unreadDot} /> : null}
            </View>
            <View style={styles.rowContent}>
              <View style={styles.rowTop}>
                <Body numberOfLines={1} style={styles.name}>
                  {displayName}
                </Body>
                <Caption color={theme.color.text.muted}>
                  {formatRelative(item.lastMessageAt)}
                </Caption>
              </View>
              {item.lastMessage?.text ? (
                <Caption
                  color={item.awaitingReply ? theme.color.text.body : theme.color.text.muted}
                  numberOfLines={1}
                  style={item.awaitingReply ? styles.previewUnread : undefined}
                >
                  {item.lastMessage.role === 'user' ? '' : 'Tienda: '}
                  {item.lastMessage.text.replace(/\[En respuesta a [^\]]*\]\s*/g, '')}
                </Caption>
              ) : item.customerName ? (
                <Caption color={theme.color.text.muted} numberOfLines={1}>
                  {item.phone}
                </Caption>
              ) : null}
              {item.pendingEscalations ? (
                <Caption color={theme.color.text.danger} numberOfLines={2}>
                  🚨 {item.escalationSummary ?? 'Caso escalado pendiente'}
                </Caption>
              ) : null}
              <View style={styles.rowBottom}>
                {stage ? (
                  <Badge
                    size="small"
                    variant={PURCHASE_STAGE_VARIANT[stage]}
                    label={PURCHASE_STAGE_LABEL[stage]}
                  />
                ) : null}
                {!item.botEnabled ? <Badge variant="warning" size="small" label="HUMANO" /> : null}
                {item.pendingEscalations ? (
                  <Badge
                    variant="danger"
                    size="small"
                    label={`ESCALADO${item.pendingEscalations > 1 ? ` ×${item.pendingEscalations}` : ''}`}
                  />
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    list: {
      paddingVertical: spacing[2],
    },
    sep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.color.border.default,
      marginHorizontal: spacing[3],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      gap: spacing[3],
    },
    rowSelected: {
      backgroundColor: `${theme.color.brand.accent}12`,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.color.background.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontWeight: '700',
      color: theme.color.text.muted,
    },
    unreadDot: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.color.brand.accent,
      borderWidth: 2,
      borderColor: theme.color.surface.base,
    },
    previewUnread: {
      fontWeight: '600',
    },
    rowContent: {
      flex: 1,
      gap: 4,
    },
    rowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing[2],
    },
    rowBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      flexWrap: 'wrap',
    },
    name: {
      fontWeight: '600',
      flex: 1,
    },
    footerLoader: {
      paddingVertical: spacing[3],
      alignItems: 'center',
    },
    _unused: {
      borderRadius: borderRadius.md,
    },
  });
