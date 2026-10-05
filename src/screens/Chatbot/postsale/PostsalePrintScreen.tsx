import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  Button,
  Caption,
  Card,
  EmptyState,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import { postsaleErrorMessage, type PostsaleOrder } from '@/services/api/chatbot-postsale';
import Alert from '@/utils/alert';
import { OrderSearchBox, Pager, lookupOrder, usePagedOrders } from './paging';
import { QrInput } from './scanner';
import { OrderRow, PostsaleShell, createPostsaleStyles } from './shared';
import { usePostsalePrinting } from './usePostsalePrinting';

type Props = NativeStackScreenProps<any, 'ChatbotPostsalePrint'>;

const PAGADO = ['PAGADO' as const];

/** Post venta · Imprimir: stickers y hojas de armado de pedidos pagados. */
export const ChatbotPostsalePrintScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const paged = usePagedOrders(PAGADO);
  const printing = usePostsalePrinting();
  const [selected, setSelected] = useState<string[]>([]);
  const [scanned, setScanned] = useState<PostsaleOrder | null>(null);
  const [looking, setLooking] = useState(false);
  const pageItems = paged.items;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const pageAllOn = pageItems.length > 0 && pageItems.every((o) => selected.includes(o.id));
  const togglePage = () =>
    setSelected((prev) =>
      pageAllOn
        ? prev.filter((id) => !pageItems.some((o) => o.id === id))
        : Array.from(new Set([...prev, ...pageItems.map((o) => o.id)]))
    );

  /** Escanear / escribir un pedido lo muestra con sus acciones (y lo selecciona si está por imprimir). */
  const findByCode = useCallback(async (raw: string) => {
    setLooking(true);
    try {
      const found = await lookupOrder(raw);
      if (!found) {
        Alert.alert('Sin resultados', 'No se encontró ese pedido.');
        return;
      }
      setScanned(found);
      if (found.postsaleStatus === 'PAGADO') {
        setSelected((prev) => (prev.includes(found.id) ? prev : [...prev, found.id]));
      }
    } catch (err) {
      Alert.alert('Error', postsaleErrorMessage(err, 'No se pudo buscar el pedido'));
    } finally {
      setLooking(false);
    }
  }, []);

  const printSelected = async () => {
    const ok = await printing.printStickers(selected);
    if (ok) {
      setSelected([]);
      if (scanned && selected.includes(scanned.id)) setScanned(null);
    }
  };

  const printScanned = async () => {
    if (!scanned) return;
    const ok = await printing.printStickers([scanned.id]);
    if (ok) {
      setSelected((prev) => prev.filter((id) => id !== scanned.id));
      // Refresca el estado mostrado (PAGADO → En armado).
      lookupOrder(`GRITPED:${scanned.id}`)
        .then((o) => o && setScanned(o))
        .catch(() => undefined);
    }
  };

  return (
    <PostsaleShell
      navigation={navigation}
      icon="print-outline"
      title="Post venta · Imprimir"
      subtitle="Stickers y hojas de armado de pedidos pagados"
      stat={{ value: paged.total, label: 'Por imprimir' }}
      refreshing={paged.query.isFetching && !paged.query.isLoading}
      onRefresh={() => paged.query.refetch()}
    >
      {printing.printerPicker}

      <Card style={styles.card}>
        <Caption color={theme.color.text.muted}>
          Escanea o escribe un pedido para imprimir o reimprimir su sticker y su hoja de armado.
        </Caption>
        <QrInput onCode={findByCode} busy={looking} />
      </Card>

      {scanned ? (
        <Card style={StyleSheet.flatten([styles.card, styles.highlightCard])}>
          <View style={styles.rowBetween}>
            <Title>Pedido encontrado</Title>
            <Button title="Quitar" variant="ghost" size="small" onPress={() => setScanned(null)} />
          </View>
          <OrderRow order={scanned} showPrintCounts />
          <View style={styles.actionsRow}>
            <Button
              title="Hoja de armado (PDF)"
              leftIcon="document-text-outline"
              variant="outline"
              size="small"
              onPress={() => printing.printPicking([scanned.id])}
              disabled={printing.printingPicking}
              loading={printing.printingPicking}
            />
            <Button
              title={
                scanned.postsaleStatus === 'PAGADO' ? 'Imprimir sticker' : 'Reimprimir sticker'
              }
              leftIcon="print-outline"
              size="small"
              onPress={() => printScanned()}
              disabled={printing.printingStickers}
              loading={printing.printingStickers}
            />
          </View>
        </Card>
      ) : null}

      <View style={styles.rowBetween}>
        <Title>Pagados por imprimir</Title>
        <Caption color={theme.color.text.muted}>{selected.length} seleccionados</Caption>
      </View>
      <Caption color={theme.color.text.muted}>
        Al imprimir el sticker por primera vez el pedido pasa a &quot;En armado&quot;.
      </Caption>
      <View style={styles.actionsRow}>
        <Button
          title={pageAllOn ? 'Quitar página' : 'Seleccionar página'}
          variant="ghost"
          size="small"
          onPress={togglePage}
          disabled={!pageItems.length}
        />
        <Button
          title={`Hoja de armado (PDF)${selected.length ? ` (${selected.length})` : ''}`}
          leftIcon="document-text-outline"
          variant="outline"
          size="small"
          onPress={() => printing.printPicking(selected)}
          disabled={!selected.length || printing.printingPicking}
          loading={printing.printingPicking}
        />
        <Button
          title={`Imprimir stickers${selected.length ? ` (${selected.length})` : ''}`}
          leftIcon="print-outline"
          size="small"
          onPress={() => printSelected()}
          disabled={!selected.length || printing.printingStickers}
          loading={printing.printingStickers}
        />
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
      ) : pageItems.length === 0 ? (
        <EmptyState
          icon="print-outline"
          title={paged.q ? 'Sin resultados' : 'Nada por imprimir'}
          description={
            paged.q
              ? 'Ningún pedido pagado coincide con la búsqueda.'
              : 'Los pedidos pagados y validados aparecerán aquí.'
          }
        />
      ) : (
        pageItems.map((o) => (
          <OrderRow
            key={o.id}
            order={o}
            selectable
            selected={selected.includes(o.id)}
            onPress={() => toggle(o.id)}
          />
        ))
      )}
      <Pager paged={paged} />
    </PostsaleShell>
  );
};
