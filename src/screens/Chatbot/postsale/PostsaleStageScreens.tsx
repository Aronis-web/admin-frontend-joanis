/**
 * Pantallas de escaneo por etapa: Armado, Despacho y Recepción. Cada una muestra
 * su escáner (el backend rechaza pedidos de otra etapa) y lo pendiente en ese
 * paso, con búsqueda y paginación.
 */
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Button, Caption, EmptyState, Title, useTheme, useThemedStyles } from '@/design-system';
import { MAIN_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import {
  postsaleErrorMessage,
  type PostsaleOrder,
  type PostsaleRoute,
  type PostsaleStatus,
} from '@/services/api/chatbot-postsale';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderSearchBox, Pager, usePagedOrders, type PagedOrders } from './paging';
import { StageScanner } from './scanner';
import { OrderRow, PostsaleShell, ROUTE_ICON, ROUTE_ORDER, createPostsaleStyles } from './shared';
import { usePostsalePrinting, type PostsalePrinting } from './usePostsalePrinting';

type Props = NativeStackScreenProps<any, any>;

interface Group {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  filter: (o: PostsaleOrder) => boolean;
}

/** Lista paginada de pedidos pendientes de la etapa; agrupa la página actual. */
const PendingList: React.FC<{
  title: string;
  emptyText: string;
  paged: PagedOrders;
  groups?: Group[];
  printing: PostsalePrinting;
  showPickingButton?: boolean;
  onOpen: (o: PostsaleOrder) => void;
}> = ({ title, emptyText, paged, groups, printing, showPickingButton, onOpen }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const { query, items } = paged;

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
        <Caption color={theme.color.text.muted}>{paged.total} pedidos</Caption>
      </View>
      <OrderSearchBox paged={paged} />
      {query.isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.color.brand.accent} />
        </View>
      ) : query.isError ? (
        <EmptyState
          icon="alert-circle-outline"
          title="No se pudo cargar"
          description={postsaleErrorMessage(query.error)}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title={paged.q ? 'Sin resultados' : 'Nada pendiente'}
          description={paged.q ? 'Ningún pedido coincide con la búsqueda.' : emptyText}
        />
      ) : groups ? (
        groups.map((g) => {
          const groupItems = items.filter(g.filter);
          if (!groupItems.length) return null;
          return (
            <React.Fragment key={g.key}>
              <View style={styles.sectionHeader}>
                <Ionicons name={g.icon} size={18} color={theme.color.text.heading} />
                <Title>{`${g.label} (${groupItems.length})`}</Title>
              </View>
              {groupItems.map(renderRow)}
            </React.Fragment>
          );
        })
      ) : (
        items.map(renderRow)
      )}
    </>
  );
};

const ARMADO: PostsaleStatus[] = ['EN_ARMADO'];
const DESPACHO: PostsaleStatus[] = ['ARMADO_FINALIZADO'];
const RECEPCION: PostsaleStatus[] = ['EN_RUTA_TIENDA', 'EN_RUTA_AGENCIA'];

const DISPATCH_LABEL: Record<PostsaleRoute, string> = {
  PICKUP: 'Tienda',
  DELIVERY_LIMA: 'Delivery Lima',
  AGENCY: 'Agencia',
};

const DISPATCH_GROUPS: Group[] = ROUTE_ORDER.map((r) => ({
  key: r,
  label: DISPATCH_LABEL[r],
  icon: ROUTE_ICON[r],
  filter: (o: PostsaleOrder) => o.route === r,
}));

const RECEPTION_GROUPS: Group[] = [
  {
    key: 'tienda',
    label: 'En ruta a tienda',
    icon: 'storefront-outline',
    filter: (o) => o.postsaleStatus === 'EN_RUTA_TIENDA',
  },
  {
    key: 'agencia',
    label: 'En ruta a agencia',
    icon: 'bus-outline',
    filter: (o) => o.postsaleStatus === 'EN_RUTA_AGENCIA',
  },
];

/** Plantilla común de las tres pantallas de etapa. */
const StageScreen: React.FC<{
  navigation: Props['navigation'];
  statuses: PostsaleStatus[];
  stage: 'armado' | 'despacho' | 'recepcion';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  statLabel: string;
  description: string;
  listTitle: string;
  emptyText: string;
  groups?: Group[];
  showPickingButton?: boolean;
  allowDeliver?: boolean;
}> = (p) => {
  const paged = usePagedOrders(p.statuses);
  const printing = usePostsalePrinting(false);
  const { hasPermission } = usePermissions();
  const canDeliver = hasPermission(PERMISSIONS.CHATBOT.POSTSALE_DELIVER);
  const [open, setOpen] = useState<PostsaleOrder | null>(null);
  const goDeliver = (orderId: string) =>
    p.navigation.navigate(MAIN_ROUTES.CHATBOT_POSTSALE_DELIVERY, { orderId });

  return (
    <PostsaleShell
      navigation={p.navigation}
      icon={p.icon}
      title={p.title}
      subtitle={p.subtitle}
      stat={{ value: paged.total, label: p.statLabel }}
      refreshing={paged.query.isFetching && !paged.query.isLoading}
      onRefresh={() => paged.query.refetch()}
      footer={<Pager paged={paged} />}
    >
      <StageScanner
        stage={p.stage}
        description={p.description}
        onDeliver={p.allowDeliver && canDeliver ? goDeliver : undefined}
      />
      <PendingList
        title={p.listTitle}
        emptyText={p.emptyText}
        paged={paged}
        groups={p.groups}
        printing={printing}
        showPickingButton={p.showPickingButton}
        onOpen={setOpen}
      />
      <OrderDetailModal
        orderId={open?.id ?? null}
        fallback={open}
        printing={printing}
        onClose={() => setOpen(null)}
      />
    </PostsaleShell>
  );
};

/** Post venta · Armado. */
export const ChatbotPostsaleAssemblyScreen: React.FC<Props> = ({ navigation }) => (
  <StageScreen
    navigation={navigation}
    statuses={ARMADO}
    stage="armado"
    icon="construct-outline"
    title="Post venta · Armado"
    subtitle="Arma los pedidos y escanea su sticker al terminar"
    statLabel="Por armar"
    description="Escanea el sticker cuando termines de armar: el pedido pasa a Armado finalizado y quedas como responsable."
    listTitle="En armado"
    emptyText="No hay pedidos en armado. Imprime stickers en Post venta · Imprimir."
    showPickingButton
  />
);

/** Post venta · Despacho. */
export const ChatbotPostsaleDispatchScreen: React.FC<Props> = ({ navigation }) => (
  <StageScreen
    navigation={navigation}
    statuses={DESPACHO}
    stage="despacho"
    icon="car-outline"
    title="Post venta · Despacho"
    subtitle="Carga los pedidos armados en el vehículo o courier"
    statLabel="Por despachar"
    description="Escanea cada sticker al subirlo al vehículo: el pedido sale en ruta a tienda, domicilio o agencia según su despacho."
    listTitle="Armados por despachar"
    emptyText="No hay pedidos armados esperando despacho."
    groups={DISPATCH_GROUPS}
  />
);

/** Post venta · Recepción (tienda o agencia). */
export const ChatbotPostsaleReceptionScreen: React.FC<Props> = ({ navigation }) => (
  <StageScreen
    navigation={navigation}
    statuses={RECEPCION}
    stage="recepcion"
    icon="download-outline"
    title="Post venta · Recepción"
    subtitle="Recibe los pedidos en tienda o entrégalos a la agencia"
    statLabel="En camino"
    description="Escanea el sticker al recibir el pedido: en tienda queda listo para recojo; en agencia queda entregado y se muestra la clave una sola vez."
    listTitle="En camino"
    emptyText="No hay pedidos en ruta a tienda ni a agencia."
    groups={RECEPTION_GROUPS}
    allowDeliver
  />
);
