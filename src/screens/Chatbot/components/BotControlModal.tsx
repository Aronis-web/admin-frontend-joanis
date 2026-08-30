import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Body, Button, Caption, Title, useTheme, useThemedStyles } from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useBotStatus, useToggleBot } from '@/hooks/api/useChatbotSession';
import Alert from '@/utils/alert';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Modal para prender / apagar la respuesta automática del bot.
 *
 * Endpoints:
 * - GET  /chatbot/bot/status
 * - POST /chatbot/bot/toggle   { active }
 */
export const BotControlModal: React.FC<Props> = ({ visible, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const statusQuery = useBotStatus({ enabled: visible });
  const toggleMutation = useToggleBot();

  const active = statusQuery.data?.active ?? false;
  const scanning = statusQuery.data?.scanning ?? false;
  const wa = statusQuery.data?.whatsapp;

  const tone: BadgeVariant = active ? 'success' : 'danger';
  const label = active ? 'Activo' : 'Pausado';

  const handleToggle = (next: boolean) => {
    if (!next) {
      Alert.alert(
        'Pausar bot',
        'El bot dejará de responder mensajes y de consumir tokens. Los pedidos ya en curso no se afectan.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Pausar',
            style: 'destructive',
            onPress: () =>
              toggleMutation.mutate(false, {
                onError: (err: any) =>
                  Alert.alert('Error', err?.message ?? 'No se pudo pausar el bot'),
              }),
          },
        ]
      );
      return;
    }
    toggleMutation.mutate(true, {
      onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo activar el bot'),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons
                  name={active ? 'sparkles' : 'pause-circle-outline'}
                  size={22}
                  color={active ? '#10B981' : theme.color.text.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Title>Respuesta automática</Title>
                <Caption color={theme.color.text.muted}>
                  Prende o apaga las respuestas del asistente
                </Caption>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.color.text.muted} />
            </Pressable>
          </View>

          <View style={styles.statusRow}>
            <Badge variant={tone} label={label} />
            {scanning ? <Badge variant="info" label="Procesando" /> : null}
            {statusQuery.isFetching ? (
              <ActivityIndicator size="small" color={theme.color.text.muted} />
            ) : null}
          </View>

          <View style={styles.stateBox}>
            <Ionicons
              name={active ? 'chatbubbles' : 'chatbubbles-outline'}
              size={32}
              color={active ? '#10B981' : theme.color.text.muted}
            />
            <Body color={active ? theme.color.text.body : theme.color.text.muted}>
              {active
                ? 'El bot está respondiendo automáticamente a los clientes.'
                : 'El bot está pausado. Los mensajes entrantes NO reciben respuesta automática.'}
            </Body>
            {wa ? (
              <Caption color={theme.color.text.muted}>
                WhatsApp: {wa.status}
                {wa.me ? ` · ${wa.me}` : ''}
              </Caption>
            ) : null}
          </View>

          <View style={styles.actions}>
            {active ? (
              <Button
                title="Pausar bot"
                variant="outline"
                onPress={() => handleToggle(false)}
                loading={toggleMutation.isPending}
                leftIcon="pause"
              />
            ) : (
              <Button
                title="Activar bot"
                onPress={() => handleToggle(true)}
                loading={toggleMutation.isPending}
                leftIcon="play"
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing[4],
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[5],
      gap: spacing[4],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[3],
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: spacing[3],
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.background.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      flexWrap: 'wrap',
    },
    stateBox: {
      alignItems: 'center',
      gap: spacing[2],
      padding: spacing[4],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.lg,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
  });
