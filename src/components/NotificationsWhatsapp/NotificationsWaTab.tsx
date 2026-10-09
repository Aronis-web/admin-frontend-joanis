/**
 * Pestaña "Notificaciones": sesión del número saliente de notificaciones
 * (reparto, documentos de empleados, exports, campañas).
 *
 * Permiso: `notifications.whatsapp.session.manage`.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Body, Card, Title } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';
import {
  useLogoutNotifWaSession,
  useNotifWaQr,
  useNotifWaStatus,
  useStartNotifWaSession,
} from '@/hooks/api/useNotificationsWhatsapp';
import type { NotifWaStatus } from '@/types/notifications-whatsapp';

import { WhatsappSessionCard } from './WhatsappSessionCard';

const TEXTS = {
  qrHint:
    'Abre WhatsApp en el celular del número de notificaciones → Dispositivos vinculados → Vincular dispositivo.',
  connected: 'La sesión está activa. Se pueden enviar notificaciones.',
  logoutMessage:
    'Se borrarán las credenciales del número de notificaciones y necesitarás escanear el QR de nuevo para reconectar.',
};

export const NotificationsWaTab: React.FC = () => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const statusQuery = useNotifWaStatus();
  const status: NotifWaStatus = statusQuery.data?.status ?? 'DISCONNECTED';
  const qrQuery = useNotifWaQr({ enabled: status === 'QR' });
  const startMutation = useStartNotifWaSession();
  const logoutMutation = useLogoutNotifWaSession();

  return (
    <View style={styles.container}>
      <WhatsappSessionCard
        status={status}
        me={statusQuery.data?.me ?? null}
        isFetching={statusQuery.isFetching}
        qr={qrQuery.data?.qr}
        texts={TEXTS}
        onStart={() => startMutation.mutateAsync()}
        onLogout={() => logoutMutation.mutateAsync()}
        startPending={startMutation.isPending}
        logoutPending={logoutMutation.isPending}
      />

      <Card variant="outlined" padding="large" style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={theme.color.state.info.border}
          />
          <Title size="small">Información</Title>
        </View>
        <Body color={theme.color.text.muted} style={styles.infoText}>
          • Este número es independiente del robot de ventas (chatbot).
        </Body>
        <Body color={theme.color.text.muted} style={styles.infoText}>
          • La sesión se reconecta sola ante caídas de red. Sólo hace falta volver a escanear el QR
          tras un logout explícito o si el teléfono desvincula el dispositivo.
        </Body>
        <Body color={theme.color.text.muted} style={styles.infoText}>
          • El envío de notificaciones (texto, PDF, Excel, imágenes) lo disparan los flujos
          existentes de reparto, documentos, exports y campañas.
        </Body>
      </Card>
    </View>
  );
};

const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: spacing[4],
    },
    infoCard: {
      gap: spacing[2],
    },
    infoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      marginBottom: spacing[2],
    },
    infoText: {
      lineHeight: 20,
    },
  });

export default NotificationsWaTab;
