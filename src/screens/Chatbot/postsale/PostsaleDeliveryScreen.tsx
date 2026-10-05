import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Caption, Card, EmptyState, Title, useTheme, useThemedStyles } from '@/design-system';
import {
  POSTSALE_DELIVERABLE,
  postsaleErrorMessage,
  type PostsaleOrder,
} from '@/services/api/chatbot-postsale';
import Alert from '@/utils/alert';
import { DeliveryForm } from './DeliveryForm';
import { OrderSearchBox, Pager, lookupOrder, usePagedOrders } from './paging';
import { QrInput } from './scanner';
import { OrderRow, PostsaleShell, createPostsaleStyles } from './shared';

type Props = NativeStackScreenProps<any, 'ChatbotPostsaleDelivery'>;

/** Post venta · Entrega: código del cliente + firma + foto. */
export const ChatbotPostsaleDeliveryScreen: React.FC<Props> = ({ navigation, route }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const paged = usePagedOrders(POSTSALE_DELIVERABLE);
  const [target, setTarget] = useState<PostsaleOrder | null>(null);
  const [looking, setLooking] = useState(false);

  /** Abre el formulario del pedido escaneado / escrito (solo si se puede entregar). */
  const openByCode = useCallback(async (raw: string) => {
    setLooking(true);
    try {
      const found = await lookupOrder(raw, POSTSALE_DELIVERABLE);
      if (found) {
        setTarget(found);
      } else {
        Alert.alert(
          'Pedido no disponible',
          'Ese pedido no está listo para entregar (debe estar en tienda o en ruta a domicilio).'
        );
      }
    } catch (err) {
      Alert.alert('Error', postsaleErrorMessage(err, 'No se pudo buscar el pedido'));
    } finally {
      setLooking(false);
    }
  }, []);

  // Llegada desde Recepción / Seguimiento con un pedido ya elegido.
  const paramOrderId = (route.params as { orderId?: string } | undefined)?.orderId;
  useEffect(() => {
    if (paramOrderId) {
      openByCode(`GRITPED:${paramOrderId}`);
      navigation.setParams({ orderId: undefined } as never);
    }
  }, [paramOrderId, navigation, openByCode]);

  return (
    <PostsaleShell
      navigation={navigation}
      icon="hand-left-outline"
      title="Post venta · Entrega"
      subtitle="Entrega al cliente con su código, firma y foto"
      stat={{ value: paged.total, label: 'Por entregar' }}
      refreshing={paged.query.isFetching && !paged.query.isLoading}
      onRefresh={() => paged.query.refetch()}
    >
      {target ? (
        <DeliveryForm
          order={target}
          onChangeOrder={() => setTarget(null)}
          onDelivered={() => setTarget(null)}
        />
      ) : (
        <>
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color={theme.color.state.info.text} />
            <Caption color={theme.color.state.info.text} style={{ flex: 1 }}>
              Escanea el sticker o elige el pedido; luego pide al cliente su código de 6 dígitos, su
              firma y toma una foto de la entrega.
            </Caption>
          </View>
          <Card style={styles.card}>
            <QrInput onCode={openByCode} busy={looking} buttonTitle="Abrir" />
          </Card>

          <View style={styles.rowBetween}>
            <Title>Listos para entregar</Title>
            <Caption color={theme.color.text.muted}>{paged.total} pedidos</Caption>
          </View>
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
              icon="hand-left-outline"
              title={paged.q ? 'Sin resultados' : 'Nada por entregar'}
              description={
                paged.q
                  ? 'Ningún pedido coincide con la búsqueda.'
                  : 'Aquí aparecen los pedidos en tienda o en ruta a domicilio.'
              }
            />
          ) : (
            paged.items.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                onPress={() => setTarget(o)}
                right={<Ionicons name="chevron-forward" size={20} color={theme.color.text.muted} />}
              />
            ))
          )}
          <Pager paged={paged} />
        </>
      )}
    </PostsaleShell>
  );
};
