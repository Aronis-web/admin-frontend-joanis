import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { Badge, Body, Caption, ErrorState, Text, useTheme, useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import { useConversationsList, useConversationsSearch } from '@/hooks/api/useChatbotConversations';
import type { ChatConversation, ConversationSearchItem, PurchaseStage } from '@/types/chatbot';
import { ConversationList } from './components/ConversationList';
import { ConversationPanel } from './components/ConversationPanel';
import { WaSessionModal } from './components/WaSessionModal';
import { BotControlModal } from './components/BotControlModal';
import {
  formatRelative,
  PURCHASE_STAGES,
  PURCHASE_STAGE_LABEL,
  PURCHASE_STAGE_VARIANT,
} from './utils';

type Props = NativeStackScreenProps<any, 'ChatbotChats'>;

const SPLIT_BREAKPOINT = 900;
const SEARCH_DEBOUNCE_MS = 300;

export const ChatbotChatsScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const isSplit = width >= SPLIT_BREAKPOINT;

  const [sessionOpen, setSessionOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [stageFilter, setStageFilter] = useState<PurchaseStage | undefined>(undefined);

  // Buscador con debounce
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isSearching = debouncedQuery.length > 0;

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useConversationsList({ limit: 30, stage: stageFilter }, { refetchIntervalMs: 15000 });

  const conversations = useMemo<ChatConversation[]>(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data]
  );

  const searchQuery = useConversationsSearch(
    { q: debouncedQuery, limit: 10 },
    { enabled: isSearching }
  );

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const handleSelect = useCallback(
    (c: { id: string }) => {
      if (isSplit) {
        setSelectedId(c.id);
      } else {
        navigation.navigate('ChatbotChatDetail', { conversationId: c.id });
      }
    },
    [isSplit, navigation]
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderStageFilters = () => (
    <View style={styles.filtersRow}>
      <Pressable
        onPress={() => setStageFilter(undefined)}
        style={[styles.filterChip, !stageFilter && styles.filterChipActive]}
      >
        <Caption color={!stageFilter ? theme.color.brand.onHeader : theme.color.text.body}>
          Todos
        </Caption>
      </Pressable>
      {PURCHASE_STAGES.map((s) => {
        const active = stageFilter === s;
        return (
          <Pressable
            key={s}
            onPress={() => setStageFilter(active ? undefined : s)}
            style={[styles.filterChip, active && styles.filterChipActive]}
          >
            <Caption color={active ? theme.color.brand.onHeader : theme.color.text.body}>
              {PURCHASE_STAGE_LABEL[s]}
            </Caption>
          </Pressable>
        );
      })}
    </View>
  );

  const renderSearchResults = () => {
    const items = searchQuery.data ?? [];
    if (searchQuery.isLoading) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.color.brand.accent} />
        </View>
      );
    }
    if (items.length === 0) {
      return (
        <View style={styles.centerBox}>
          <Caption color={theme.color.text.muted}>Sin resultados para “{debouncedQuery}”</Caption>
        </View>
      );
    }
    return (
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }: { item: ConversationSearchItem }) => (
          <TouchableOpacity
            style={styles.searchRow}
            activeOpacity={0.7}
            onPress={() => {
              handleSelect(item);
              setSearchInput('');
            }}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color={theme.color.text.muted} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Body numberOfLines={1} style={{ fontWeight: '600' }}>
                {item.customerName?.trim() || item.phone}
              </Body>
              {item.customerName ? (
                <Caption color={theme.color.text.muted} numberOfLines={1}>
                  {item.phone}
                </Caption>
              ) : null}
              <View style={styles.searchRowBottom}>
                <Badge
                  size="small"
                  variant={PURCHASE_STAGE_VARIANT[item.purchaseStage]}
                  label={PURCHASE_STAGE_LABEL[item.purchaseStage]}
                />
                <Caption color={theme.color.text.muted}>
                  {formatRelative(item.lastMessageAt)}
                </Caption>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    );
  };

  const listPane = (
    <View style={{ flex: 1 }}>
      <View style={styles.searchWrap}>
        <View style={styles.searchInputBox}>
          <Ionicons name="search" size={16} color={theme.color.text.muted} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Buscar por nombre o teléfono…"
            placeholderTextColor={theme.color.text.muted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchInput ? (
            <Pressable onPress={() => setSearchInput('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.color.text.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {!isSearching ? renderStageFilters() : null}
      <View style={{ flex: 1 }}>
        {isSearching ? (
          renderSearchResults()
        ) : isLoading ? (
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
        ) : (
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={handleSelect}
            isLoading={isLoading}
            onEndReached={handleEndReached}
            isFetchingNextPage={isFetchingNextPage}
          />
        )}
      </View>
    </View>
  );

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
            <View style={styles.headerActionsRow}>
              <TouchableOpacity
                onPress={() => setBotOpen(true)}
                style={styles.headerAction}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={16} color={theme.color.brand.onHeader} />
                <Text style={styles.headerActionText}>Bot</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSessionOpen(true)}
                style={styles.headerAction}
                activeOpacity={0.8}
              >
                <Ionicons name="qr-code-outline" size={16} color={theme.color.brand.onHeader} />
                <Text style={styles.headerActionText}>Sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {isSplit ? (
            <View style={styles.splitRow}>
              <View style={styles.splitLeft}>{listPane}</View>
              <View style={styles.splitRight}>
                <ConversationPanel conversation={selected} />
              </View>
            </View>
          ) : (
            listPane
          )}
        </View>

        <WaSessionModal visible={sessionOpen} onClose={() => setSessionOpen(false)} />
        <BotControlModal visible={botOpen} onClose={() => setBotOpen(false)} />
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
    headerActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
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
    searchWrap: {
      paddingHorizontal: spacing[3],
      paddingTop: spacing[3],
      paddingBottom: spacing[2],
      backgroundColor: theme.color.surface.base,
    },
    searchInputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    searchInput: {
      flex: 1,
      color: theme.color.text.body,
      fontSize: 14,
      paddingVertical: 0,
    },
    filtersRow: {
      paddingHorizontal: spacing[3],
      paddingBottom: spacing[2],
      gap: spacing[1],
      rowGap: spacing[1],
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    filterChip: {
      paddingHorizontal: spacing[2],
      paddingVertical: 4,
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.background.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border.default,
    },
    filterChipActive: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      gap: spacing[3],
    },
    searchRowBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.color.background.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.color.border.default,
      marginHorizontal: spacing[3],
    },
  });
