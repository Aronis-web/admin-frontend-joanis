import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
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
import { usePostsaleOrders } from '@/hooks/api/useChatbotPostsale';
import { postsaleErrorMessage } from '@/services/api/chatbot-postsale';
import { OrderRow, PostsaleShell, createPostsaleStyles } from './shared';
import { usePostsalePrinting } from './usePostsalePrinting';

type Props = NativeStackScreenProps<any, 'ChatbotPostsalePrint'>;

/** Post venta · Imprimir: stickers y hojas de armado de pedidos pagados. */
export const ChatbotPostsalePrintScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const orders = usePostsaleOrders(['PAGADO']);
  const printing = usePostsalePrinting();
  const [selected, setSelected] = useState<string[]>([]);
  const list = useMemo(() => orders.data ?? [], [orders.data]);

  // Reimprimir: busca entre activos + entregados de los últimos 7 días.
  const [search, setSearch] = useState('');
  const term = search.trim().replace(/^#/, '').toUpperCase();
  const all = usePostsaleOrders(undefined, term.length >= 2);
  const found = useMemo(
    () =>
      term.length >= 2
        ? (all.data ?? [])
            .filter((o) => o.postsaleStatus !== 'PAGADO')
            .filter((o) => o.orderNo.replace(/^#/, '').toUpperCase().includes(term))
            .slice(0, 10)
        : [],
    [all.data, term]
  );

  // Si un pedido desaparece de la lista (ya se imprimió), se quita de la selección.
  useEffect(() => {
    setSelected((prev) => prev.filter((id) => list.some((o) => o.id === id)));
  }, [list]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allOn = list.length > 0 && selected.length === list.length;

  const doPrint = async () => {
    const ok = await printing.printStickers(selected);
    if (ok) setSelected([]);
  };

  return (
    <PostsaleShell
      navigation={navigation}
      icon="print-outline"
      title="Post venta · Imprimir"
      subtitle="Stickers y hojas de armado de pedidos pagados"
      stat={{ value: list.length, label: 'Por imprimir' }}
      refreshing={orders.isFetching && !orders.isLoading}
      onRefresh={() => orders.refetch()}
    >
      {printing.printerPicker}

      <Card style={styles.card}>
        <Caption color={theme.color.text.muted}>
          Al imprimir el sticker por primera vez el pedido pasa a &quot;En armado&quot;.
        </Caption>
        <View style={styles.actionsRow}>
          <Button
            title={allOn ? 'Quitar selección' : 'Seleccionar todos'}
            variant="ghost"
            size="small"
            onPress={() => setSelected(allOn ? [] : list.map((o) => o.id))}
            disabled={!list.length}
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
            onPress={() => doPrint()}
            disabled={!selected.length || printing.printingStickers}
            loading={printing.printingStickers}
          />
        </View>
      </Card>

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
          icon="print-outline"
          title="Nada por imprimir"
          description="Los pedidos pagados y validados aparecerán aquí."
        />
      ) : (
        list.map((o) => (
          <OrderRow
            key={o.id}
            order={o}
            selectable
            selected={selected.includes(o.id)}
            onPress={() => toggle(o.id)}
          />
        ))
      )}

      <Card style={styles.card}>
        <Title>Reimprimir</Title>
        <Caption color={theme.color.text.muted}>
          Busca un pedido ya impreso por su número (activos y entregados en los últimos 7 días).
        </Caption>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Número de pedido, ej. ABC123"
          placeholderTextColor={theme.color.text.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
        />
        {term.length >= 2 && all.isLoading ? (
          <ActivityIndicator color={theme.color.brand.accent} />
        ) : term.length >= 2 && found.length === 0 ? (
          <Caption color={theme.color.text.muted}>Sin resultados.</Caption>
        ) : null}
      </Card>
      {found.map((o) => (
        <View key={o.id} style={{ gap: 6 }}>
          <OrderRow order={o} />
          <View style={styles.actionsRow}>
            <Button
              title="Hoja de armado (PDF)"
              leftIcon="document-text-outline"
              variant="outline"
              size="small"
              onPress={() => printing.printPicking([o.id])}
              disabled={printing.printingPicking}
            />
            <Button
              title="Reimprimir sticker"
              leftIcon="print-outline"
              variant="outline"
              size="small"
              onPress={() => printing.printStickers([o.id])}
              disabled={printing.printingStickers}
            />
          </View>
        </View>
      ))}
    </PostsaleShell>
  );
};
