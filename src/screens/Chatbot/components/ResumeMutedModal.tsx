import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Caption, Title, useTheme, useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import { chatbotConversationsApi } from '@/services/api/chatbot-conversations';
import type { ResumeMutedResult } from '@/services/api/chatbot-conversations';

interface Props {
  visible: boolean;
  onClose: () => void;
  onDone?: () => void;
}

const money = (c: number) => `S/ ${(c / 100).toFixed(2)}`;

/**
 * Retomar los chats de Messenger/Instagram que quedaron con el bot apagado.
 * Primero muestra el ensayo (que haria en cada chat) y solo con "Retomar" lo
 * hace de verdad.
 */
export const ResumeMutedModal: React.FC<Props> = ({ visible, onClose, onDone }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [plan, setPlan] = useState<ResumeMutedResult | null>(null);
  const [result, setResult] = useState<ResumeMutedResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (dryRun: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await chatbotConversationsApi.resumeMuted({ dryRun, days: 3 });
      if (dryRun) setPlan(res);
      else {
        setResult(res);
        onDone?.();
      }
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setPlan(null);
      setResult(null);
      void run(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const counts = (plan?.plan ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.action] = (acc[c.action] ?? 0) + 1;
    return acc;
  }, {});
  const shown = (plan?.plan ?? []).filter((c) => c.pending > 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Title>Retomar chats con el bot apagado</Title>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.color.text.muted} />
            </Pressable>
          </View>
          {busy && !plan ? <ActivityIndicator color={theme.color.brand.accent} /> : null}
          {error ? <Body color={theme.color.text.danger}>{error}</Body> : null}
          {result ? (
            <Body>
              Listo: bot prendido en {result.enabled} chats y {result.resumed} retomados. Las
              respuestas salen de a una en los próximos minutos.
            </Body>
          ) : plan ? (
            <>
              <Caption color={theme.color.text.muted}>
                Ensayo (no se cambió nada): Messenger e Instagram de los últimos {plan.days} días.
                Meta solo deja responder hasta 24 h después del último mensaje del cliente.
              </Caption>
              <View style={styles.counts}>
                {Object.entries(counts).map(([k, n]) => (
                  <Body key={k}>
                    • {k}: {n}
                  </Body>
                ))}
              </View>
              <ScrollView style={styles.list}>
                {shown.map((c) => (
                  <View key={c.id} style={styles.row}>
                    <Body numberOfLines={1} style={styles.bold}>
                      {c.name ?? c.phone}
                    </Body>
                    <Caption color={theme.color.text.muted}>
                      {c.action} · {c.pending} mensaje(s)
                      {c.images ? ` · ${c.images} foto(s)` : ''}
                      {c.cartItems ? ` · carrito ${money(c.cartTotalCents)}` : ''}
                      {c.openOrder ? ' · pedido abierto' : ''}
                    </Caption>
                  </View>
                ))}
              </ScrollView>
              <Button
                title={`Retomar ${plan.total} chats`}
                onPress={() => void run(false)}
                loading={busy}
                disabled={!plan.total}
                leftIcon="play-outline"
              />
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[4],
    },
    card: {
      width: '100%',
      maxWidth: 560,
      maxHeight: '90%',
      backgroundColor: theme.color.surface.elevated,
      borderRadius: borderRadius.lg,
      padding: spacing[4],
      gap: spacing[3],
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    counts: { gap: spacing[1] },
    list: { maxHeight: 320 },
    row: {
      paddingVertical: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.subtle,
    },
    bold: { fontWeight: '600' },
  });
