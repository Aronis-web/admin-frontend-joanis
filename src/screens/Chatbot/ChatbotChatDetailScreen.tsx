import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { useConversationsList } from '@/hooks/api/useChatbotConversations';
import { ConversationPanel } from './components/ConversationPanel';

type Props = NativeStackScreenProps<any, 'ChatbotChatDetail'>;

export const ChatbotChatDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const styles = useThemedStyles(createStyles);

  const conversationId = (route.params as { conversationId?: string } | undefined)?.conversationId;

  const { data } = useConversationsList({ limit: 30 });

  const conversation = useMemo(() => {
    const items = data?.pages.flatMap((p) => p.items) ?? [];
    return items.find((c) => c.id === conversationId) ?? null;
  }, [data, conversationId]);

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.body}>
          <ConversationPanel conversation={conversation} onBack={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
    },
    body: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
    },
  });
