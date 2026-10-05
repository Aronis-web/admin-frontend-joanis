import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Caption, ChipGroup, EmptyState, useTheme, useThemedStyles } from '@/design-system';
import { MAIN_ROUTES } from '@/constants/routes';
import { usePostsaleOrders } from '@/hooks/api/useChatbotPostsale';
import { postsaleErrorMessage, type PostsaleStatus } from '@/services/api/chatbot-postsale';
import { OrderDetailModal } from './OrderDetailModal';
import {
  OrderRow,
  PostsaleShell,
  STATUS_LABEL,
  STATUS_ORDER,
  createPostsaleStyles,
} from './shared';
import { usePostsalePrinting } from './usePostsalePrinting';

type Props = NativeStackScreenProps<any, 'ChatbotPostsaleTracking'>;

/** Post venta · Seguimiento: todos los pedidos, historial, reimpresión y reenvío de código. */
export const ChatbotPostsaleTrackingScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const orders = usePostsaleOrders();
  const printing = usePostsalePrinting();
  const [filter, setFilter] = useState<string>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const all = useMemo(() => orders.data ?? [], [orders.data]);

  const options = useMemo(() => {
    const counts = new Map<PostsaleStatus, number>();
    all.forEach((o) => counts.set(o.postsaleStatus, (counts.get(o.postsaleStatus) ?? 0) + 1));
    return [
      { label: `Todos (${all.length})`, value: 'ALL' },
      ...STATUS_ORDER.filter((s) => counts.get(s)).map((s) => ({
        label: `${STATUS_LABEL[s]} (${counts.get(s)})`,
        value: s,
      })),
    ];
  }, [all]);

  // Si el estado filtrado se queda sin pedidos, vuelve a "Todos".
  useEffect(() => {
    if (filter !== 'ALL' && !options.some((o) => o.value === filter)) setFilter('ALL');
  }, [filter, options]);

  const list = filter === 'ALL' ? all : all.filter((o) => o.postsaleStatus === filter);
  const openOrder = all.find((o) => o.id === openId) ?? null;

  return (
    <PostsaleShell
      navigation={navigation}
      icon="git-network-outline"
      title="Post venta · Seguimiento"
      subtitle="Pedidos activos y entregados en los últimos 7 días"
      stat={{ value: all.length, label: 'Pedidos' }}
      refreshing={orders.isFetching && !orders.isLoading}
      onRefresh={() => orders.refetch()}
    >
      {printing.printerPicker}
      <ChipGroup
        options={options}
        selected={[filter]}
        onChange={(sel) => sel[0] && setFilter(sel[0])}
        size="small"
      />
      {orders.isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.color.brand.accent} />
        </View>
      ) : orders.isError ? (
        <EmptyState
          icon="alert-circle-outline"
          title="No se pudo cargar"
          description={postsaleErrorMessage(orders.error)}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="Sin pedidos"
          description="No hay pedidos en este estado."
        />
      ) : (
        list.map((o) => (
          <OrderRow
            key={o.id}
            order={o}
            onPress={() => setOpenId(o.id)}
            right={<Ionicons name="chevron-forward" size={20} color={theme.color.text.muted} />}
          />
        ))
      )}
      <Caption color={theme.color.text.muted}>Toca un pedido para ver su historial.</Caption>

      <OrderDetailModal
        orderId={openId}
        fallback={openOrder}
        printing={printing}
        onClose={() => setOpenId(null)}
        onDeliver={(orderId) => {
          setOpenId(null);
          navigation.navigate(MAIN_ROUTES.CHATBOT_POSTSALE_DELIVERY, { orderId });
        }}
      />
    </PostsaleShell>
  );
};
