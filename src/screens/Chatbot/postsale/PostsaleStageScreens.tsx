/**
 * Pantallas de escaneo por etapa: Armado, Despacho y Recepción. Cada una muestra
 * su escáner (el backend rechaza pedidos de otra etapa) y lo pendiente en ese paso.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Button, Caption, EmptyState, Title, useTheme, useThemedStyles } from '@/design-system';
import { MAIN_ROUTES } from '@/constants/routes';
import { usePostsaleOrders } from '@/hooks/api/useChatbotPostsale';
import {
  postsaleErrorMessage,
  type PostsaleOrder,
  type PostsaleRoute,
  type PostsaleStatus,
} from '@/services/api/chatbot-postsale';
import { OrderDetailModal } from './OrderDetailModal';
import { StageScanner } from './scanner';
import { OrderRow, PostsaleShell, ROUTE_ICON, ROUTE_ORDER, createPostsaleStyles } from './shared';
import { usePostsalePrinting, type PostsalePrinting } from './usePostsalePrinting';

type Props = NativeStackScreenProps<any, any>;

/** Lista de pedidos pendientes de la etapa, opcionalmente agrupada. */
const PendingList: React.FC<{
  title: string;
  emptyText: string;
  orders: ReturnType<typeof usePostsaleOrders>;
  groups?: {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    filter: (o: PostsaleOrder) => boolean;
  }[];
  printing: PostsalePrinting;
  showPickingButton?: boolean;
  onOpen: (o: PostsaleOrder) => void;
}> = ({ title, emptyText, orders, groups, printing, showPickingButton, onOpen }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const list = orders.data ?? [];

  const renderRow = (o: PostsaleOrder) => (
    <OrderRow
      key={o.id}
      order={o}
      onPress={() => onOpen(o)}
      right={
        showPickingButton ? (
          <Button
            title="Hoja"
            leftIcon="document-text-outline"
            variant="outline"
            size="small"
            onPress={() => printing.printPicking([o.id])}
            disabled={printing.printingPicking}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.color.text.muted} />
        )
      }
    />
  );

  return (
    <>
      <View style={styles.rowBetween}>
        <Title>{title}</Title>
        <Caption color={theme.color.text.muted}>{list.length} pedidos</Caption>
      </View>
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
        <EmptyState icon="checkmark-done-outline" title="Nada pendiente" description={emptyText} />
      ) : groups ? (
        groups.map((g) => {
          const items = list.filter(g.filter);
          if (!items.length) return null;
          return (
            <React.Fragment key={g.key}>
              <View style={styles.sectionHeader}>
                <Ionicons name={g.icon} size={18} color={theme.color.text.heading} />
                <Title>{`${g.label} (${items.length})`}</Title>
              </View>
              {items.map(renderRow)}
            </React.Fragment>
          );
        })
      ) : (
        list.map(renderRow)
      )}
    </>
  );
};

const useDetail = (orders: PostsaleOrder[]) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const fallback = useMemo(() => orders.find((o) => o.id === openId) ?? null, [orders, openId]);
  return { openId, setOpenId, fallback };
};

const ARMADO: PostsaleStatus[] = ['EN_ARMADO'];
const DESPACHO: PostsaleStatus[] = ['ARMADO_FINALIZADO'];
const RECEPCION: PostsaleStatus[] = ['EN_RUTA_TIENDA', 'EN_RUTA_AGENCIA'];

const DISPATCH_GROUP_LABEL: Record<PostsaleRoute, string> = {
  PICKUP: 'Tienda',
  DELIVERY_LIMA: 'Delivery Lima',
  AGENCY: 'Agencia',
};

/** Post venta · Armado. */
export const ChatbotPostsaleAssemblyScreen: React.FC<Props> = ({ navigation }) => {
  const orders = usePostsaleOrders(ARMADO);
  const printing = usePostsalePrinting(false);
  const detail = useDetail(orders.data ?? []);
  return (
    <PostsaleShell
      navigation={navigation}
      icon="construct-outline"
      title="Post venta · Armado"
      subtitle="Arma los pedidos y escanea su sticker al terminar"
      stat={{ value: orders.data?.length ?? 0, label: 'Por armar' }}
      refreshing={orders.isFetching && !orders.isLoading}
      onRefresh={() => orders.refetch()}
    >
      <StageScanner
        stage="armado"
        description="Escanea el sticker cuando termines de armar: el pedido pasa a Armado finalizado y quedas como responsable."
        cameraTitle="Escanea el pedido armado"
      />
      <PendingList
        title="En armado"
        emptyText="No hay pedidos en armado. Imprime stickers en Post venta · Imprimir."
        orders={orders}
        printing={printing}
        showPickingButton
        onOpen={(o) => detail.setOpenId(o.id)}
      />
      <OrderDetailModal
        orderId={detail.openId}
        fallback={detail.fallback}
        printing={printing}
        onClose={() => detail.setOpenId(null)}
      />
    </PostsaleShell>
  );
};

/** Post venta · Despacho. */
export const ChatbotPostsaleDispatchScreen: React.FC<Props> = ({ navigation }) => {
  const orders = usePostsaleOrders(DESPACHO);
  const printing = usePostsalePrinting(false);
  const detail = useDetail(orders.data ?? []);
  const groups = ROUTE_ORDER.map((r) => ({
    key: r,
    label: DISPATCH_GROUP_LABEL[r],
    icon: ROUTE_ICON[r],
    filter: (o: PostsaleOrder) => o.route === r,
  }));
  return (
    <PostsaleShell
      navigation={navigation}
      icon="car-outline"
      title="Post venta · Despacho"
      subtitle="Carga los pedidos armados en el vehículo o courier"
      stat={{ value: orders.data?.length ?? 0, label: 'Por despachar' }}
      refreshing={orders.isFetching && !orders.isLoading}
      onRefresh={() => orders.refetch()}
    >
      <StageScanner
        stage="despacho"
        description="Escanea cada sticker al subirlo al vehículo: el pedido sale en ruta a tienda, domicilio o agencia según su despacho."
        cameraTitle="Escanea el pedido que sale"
      />
      <PendingList
        title="Armados por despachar"
        emptyText="No hay pedidos armados esperando despacho."
        orders={orders}
        groups={groups}
        printing={printing}
        onOpen={(o) => detail.setOpenId(o.id)}
      />
      <OrderDetailModal
        orderId={detail.openId}
        fallback={detail.fallback}
        printing={printing}
        onClose={() => detail.setOpenId(null)}
      />
    </PostsaleShell>
  );
};

/** Post venta · Recepción (tienda o agencia). */
export const ChatbotPostsaleReceptionScreen: React.FC<Props> = ({ navigation }) => {
  const orders = usePostsaleOrders(RECEPCION);
  const printing = usePostsalePrinting(false);
  const detail = useDetail(orders.data ?? []);
  const goDeliver = (orderId: string) =>
    navigation.navigate(MAIN_ROUTES.CHATBOT_POSTSALE_DELIVERY, { orderId });
  const groups = [
    {
      key: 'tienda',
      label: 'En ruta a tienda',
      icon: 'storefront-outline' as const,
      filter: (o: PostsaleOrder) => o.postsaleStatus === 'EN_RUTA_TIENDA',
    },
    {
      key: 'agencia',
      label: 'En ruta a agencia',
      icon: 'bus-outline' as const,
      filter: (o: PostsaleOrder) => o.postsaleStatus === 'EN_RUTA_AGENCIA',
    },
  ];
  return (
    <PostsaleShell
      navigation={navigation}
      icon="download-outline"
      title="Post venta · Recepción"
      subtitle="Recibe los pedidos en tienda o entrégalos a la agencia"
      stat={{ value: orders.data?.length ?? 0, label: 'En camino' }}
      refreshing={orders.isFetching && !orders.isLoading}
      onRefresh={() => orders.refetch()}
    >
      <StageScanner
        stage="recepcion"
        description="Escanea el sticker al recibir el pedido: en tienda queda listo para recojo; en agencia queda entregado y se muestra la clave una sola vez."
        cameraTitle="Escanea el pedido recibido"
        onDeliver={goDeliver}
      />
      <PendingList
        title="En camino"
        emptyText="No hay pedidos en ruta a tienda ni a agencia."
        orders={orders}
        groups={groups}
        printing={printing}
        onOpen={(o) => detail.setOpenId(o.id)}
      />
      <OrderDetailModal
        orderId={detail.openId}
        fallback={detail.fallback}
        printing={printing}
        onClose={() => detail.setOpenId(null)}
      />
    </PostsaleShell>
  );
};
