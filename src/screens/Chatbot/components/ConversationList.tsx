import React from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Body, Caption, EmptyState, useTheme, useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import type { ChatConversation } from '@/types/chatbot';
import { formatRelative } from '../utils';

interface Props {
  conversations: ChatConversation[];
  selectedId?: string;
  onSelect: (c: ChatConversation) => void;
  isLoading?: boolean;
}

export const ConversationList: React.FC<Props> = ({
  conversations,
  selectedId,
  onSelect,
  isLoading,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!isLoading && conversations.length === 0) {
    return (
      <EmptyState
        icon="chatbubbles-outline"
        title="Sin conversaciones"
        description="Cuando lleguen mensajes por WhatsApp aparecerán aquí."
      />
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      renderItem={({ item }) => {
        const isSelected = item.id === selectedId;
        return (
          <TouchableOpacity
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
            style={[styles.row, isSelected && styles.rowSelected]}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color={theme.color.text.muted} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.rowTop}>
                <Body numberOfLines={1} style={styles.phone}>
                  {item.phone}
                </Body>
                <Caption color={theme.color.text.muted}>
                  {formatRelative(item.lastMessageAt)}
                </Caption>
              </View>
              <View style={styles.rowBottom}>
                <Caption color={theme.color.text.muted} numberOfLines={1} style={{ flex: 1 }}>
                  {item.summary ?? 'Sin resumen'}
                </Caption>
                {!item.botEnabled ? <Badge variant="warning" size="small" label="HUMANO" /> : null}
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
    },
    phone: {
      fontWeight: '600',
      flex: 1,
    },
    _unused: {
      borderRadius: borderRadius.md,
    },
  });
