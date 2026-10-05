import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Caption, Card, ChipGroup, EmptyState, useTheme, useThemedStyles } from '@/design-system';
import { MAIN_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import {
  postsaleErrorMessage,
  type PostsaleOrder,
  type PostsaleStatus,
} from '@/services/api/chatbot-postsale';
import Alert from '@/utils/alert';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderSearchBox, Pager, lookupOrder, usePagedOrders } from './paging';
import { QrInput } from './scanner';
import {
  OrderRow,
  PostsaleShell,
  STATUS_LABEL,
  STATUS_ORDER,
  createPostsaleStyles,
} from './shared';
import { usePostsalePrinting } from './usePostsalePrinting';

type Props = NativeStackScreenProps<any, 'ChatbotPostsaleTracking'>;

const FILTER_OPTIONS = [
  { label: 'Todos', value: 'ALL' },
  ...STATUS_ORDER.map((s) => ({ label: STATUS_LABEL[s], value: s })),
];

/** Post venta · Seguimiento: todos los pedidos, historial, reimpresión y reenvío de código. */
export const ChatbotPostsaleTrackingScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const [filter, setFilter] = useState<string>('ALL');
  const statuses = useMemo<PostsaleStatus[] | undefined>(
    () => (filter === 'ALL' ? undefined : [filter as PostsaleStatus]),
    [filter]
  );
  const paged = usePagedOrders(statuses);
  const { hasPermission } = usePermissions();
  // El selector de impresora solo aparece para quien puede reimprimir stickers.
  const printing = usePostsalePrinting(hasPermission(PERMISSIONS.CHATBOT.POSTSALE_PRINT));
  const [open, setOpen] = useState<PostsaleOrder | null>(null);
  const [looking, setLooking] = useState(false);

  /** Escanear / escribir un pedido abre directamente su detalle. */
  const openByCode = useCallback(async (raw: string) => {
    setLooking(true);
    try {
      const found = await lookupOrder(raw);
      if (found) setOpen(found);
      else Alert.alert('Sin resultados', 'No se encontró ese pedido.');
    } catch (err) {
      Alert.alert('Error', postsaleErrorMessage(err, 'No se pudo buscar el pedido'));
    } finally {
      setLooking(false);
    }
  }, []);

  return (
    <PostsaleShell
      navigation={navigation}
      icon="git-network-outline"
      title="Post venta · Seguimiento"
      subtitle="Pedidos activos y entregados en los últimos 7 días"
      stat={{ value: paged.total, label: 'Pedidos' }}
      refreshing={paged.query.isFetching && !paged.query.isLoading}
      onRefresh={() => paged.query.refetch()}
    >
      {printing.printerPicker}
      <Card style={styles.card}>
        <Caption color={theme.color.text.muted}>
          Escanea un sticker para abrir su historial al instante.
        </Caption>
        <QrInput onCode={openByCode} busy={looking} buttonTitle="Abrir" />
      </Card>
      <ChipGroup
        options={FILTER_OPTIONS}
        selected={[filter]}
        onChange={(sel) => sel[0] && setFilter(sel[0])}
        size="small"
      />
      <OrderSearchBox paged={paged} />
      {paged.query.isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.color.brand.accent} />
        </View>
      ) : paged.query.isError ? (
        <EmptyState
          icon="alert-circle-outline"
          title="No se pudo cargar"
          description={postsaleErrorMessage(paged.query.error)}
        />
      ) : paged.items.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="Sin pedidos"
          description={
            paged.q ? 'Ningún pedido coincide con la búsqueda.' : 'No hay pedidos en este estado.'
          }
        />
      ) : (
        paged.items.map((o) => (
          <OrderRow
            key={o.id}
            order={o}
            onPress={() => setOpen(o)}
            showPrintCounts
            right={<Ionicons name="chevron-forward" size={20} color={theme.color.text.muted} />}
          />
        ))
      )}
      <Pager paged={paged} />

      <OrderDetailModal
        orderId={open?.id ?? null}
        fallback={open}
        printing={printing}
        onClose={() => setOpen(null)}
        onDeliver={(orderId) => {
          setOpen(null);
          navigation.navigate(MAIN_ROUTES.CHATBOT_POSTSALE_DELIVERY, { orderId });
        }}
      />
    </PostsaleShell>
  );
};
