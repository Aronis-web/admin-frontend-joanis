import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ErrorState, Text, useTheme, useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import { useConversationsList } from '@/hooks/api/useChatbotConversations';
import type { ChatConversation } from '@/types/chatbot';
import { ConversationList } from './components/ConversationList';
import { ConversationPanel } from './components/ConversationPanel';
import { WaSessionModal } from './components/WaSessionModal';

type Props = NativeStackScreenProps<any, 'ChatbotChats'>;

const SPLIT_BREAKPOINT = 900;

export const ChatbotChatsScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const isSplit = width >= SPLIT_BREAKPOINT;

  const [sessionOpen, setSessionOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const { data, isLoading, isError, refetch } = useConversationsList(
    { limit: 100 },
    { refetchIntervalMs: 15000 }
  );

  const conversations = useMemo(() => data ?? [], [data]);
  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const handleSelect = (c: ChatConversation) => {
    if (isSplit) {
      setSelectedId(c.id);
    } else {
      navigation.navigate('ChatbotChatDetail', { conversationId: c.id });
    }
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="logo-whatsapp" size={22} color={theme.color.brand.onHeader} />
                </View>
                <Text style={styles.headerTitle}>Chats WhatsApp</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Bandeja de conversaciones del chatbot de ventas
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSessionOpen(true)}
              style={styles.headerAction}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={16} color={theme.color.brand.onHeader} />
              <Text style={styles.headerActionText}>Sesión</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.color.brand.accent} />
            </View>
          ) : isError ? (
            <View style={styles.centerBox}>
              <ErrorState
                title="Error al cargar chats"
                description="No se pudieron cargar las conversaciones."
                onRetry={() => refetch()}
              />
            </View>
          ) : isSplit ? (
            <View style={styles.splitRow}>
              <View style={styles.splitLeft}>
                <ConversationList
                  conversations={conversations}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  isLoading={isLoading}
                />
              </View>
              <View style={styles.splitRight}>
                <ConversationPanel conversation={selected} />
              </View>
            </View>
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={handleSelect}
              isLoading={isLoading}
            />
          )}
        </View>

        <WaSessionModal visible={sessionOpen} onClose={() => setSessionOpen(false)} />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.color.brand.headerFrom,
    },
    headerGradient: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[5],
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitleContainer: {
      flex: 1,
    },
    headerIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing[1],
    },
    headerIconContainer: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing[3],
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
      letterSpacing: 0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      marginLeft: 48,
    },
    headerAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: theme.color.brand.headerBadge,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    headerActionText: {
      fontSize: 12,
      color: theme.color.brand.onHeader,
      fontWeight: '600',
    },
    body: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    centerBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[5],
    },
    splitRow: {
      flex: 1,
      flexDirection: 'row',
    },
    splitLeft: {
      width: 340,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    splitRight: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
    },
  });
