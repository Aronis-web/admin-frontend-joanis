import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import {
  Button,
  Caption,
  Card,
  EmptyState,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import { usePostsaleOrders } from '@/hooks/api/useChatbotPostsale';
import { POSTSALE_DELIVERABLE, postsaleErrorMessage } from '@/services/api/chatbot-postsale';
import Alert from '@/utils/alert';
import { DeliveryForm } from './DeliveryForm';
import { ManualCodeInput, QrScannerModal, useCameraOpener } from './scanner';
import {
  CAN_USE_CAMERA,
  OrderRow,
  PostsaleShell,
  createPostsaleStyles,
  findOrderByCode,
} from './shared';

type Props = NativeStackScreenProps<any, 'ChatbotPostsaleDelivery'>;

/** Post venta · Entrega: código del cliente + firma + foto. */
export const ChatbotPostsaleDeliveryScreen: React.FC<Props> = ({ navigation, route }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const orders = usePostsaleOrders(POSTSALE_DELIVERABLE);
  const ensureCamera = useCameraOpener();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const list = useMemo(() => orders.data ?? [], [orders.data]);
  const target = list.find((o) => o.id === targetId) ?? null;

  // Llegada desde Recepción / Seguimiento con un pedido ya elegido.
  const paramOrderId = (route.params as { orderId?: string } | undefined)?.orderId;
  useEffect(() => {
    if (paramOrderId) {
      setTargetId(paramOrderId);
      navigation.setParams({ orderId: undefined } as never);
    }
  }, [paramOrderId, navigation]);

  const pickByCode = (raw: string) => {
    const found = findOrderByCode(list, raw);
    if (found) {
      setTargetId(found.id);
    } else {
      Alert.alert(
        'Pedido no disponible',
        'Ese pedido no está listo para entregar (debe estar en tienda o en ruta a domicilio).'
      );
    }
  };

  return (
    <PostsaleShell
      navigation={navigation}
      icon="hand-left-outline"
      title="Post venta · Entrega"
      subtitle="Entrega al cliente con su código, firma y foto"
      stat={{ value: list.length, label: 'Por entregar' }}
      refreshing={orders.isFetching && !orders.isLoading}
      onRefresh={() => orders.refetch()}
    >
      {target ? (
        <DeliveryForm
          order={target}
          onChangeOrder={() => setTargetId(null)}
          onDelivered={() => setTargetId(null)}
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
            {CAN_USE_CAMERA ? (
              <Button
                title="Escanear sticker"
                leftIcon="qr-code-outline"
                onPress={async () => {
                  if (await ensureCamera()) setCameraOpen(true);
                }}
              />
            ) : null}
            <ManualCodeInput
              placeholder="GRITPED:… o número de pedido"
              buttonTitle="Buscar"
              onSubmit={pickByCode}
            />
          </Card>

          {targetId && !target && !orders.isLoading ? (
            <Caption color={theme.color.state.warning.text}>
              El pedido elegido ya no está pendiente de entrega.
            </Caption>
          ) : null}

          <Title>Listos para entregar</Title>
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
              icon="hand-left-outline"
              title="Nada por entregar"
              description="Aquí aparecen los pedidos en tienda o en ruta a domicilio."
            />
          ) : (
            list.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                onPress={() => setTargetId(o.id)}
                right={<Ionicons name="chevron-forward" size={20} color={theme.color.text.muted} />}
              />
            ))
          )}

          {CAN_USE_CAMERA ? (
            <QrScannerModal
              visible={cameraOpen}
              title="Escanea el sticker del pedido"
              subtitle="Para iniciar la entrega"
              onCode={pickByCode}
              onClose={() => setCameraOpen(false)}
            />
          ) : null}
        </>
      )}
    </PostsaleShell>
  );
};
