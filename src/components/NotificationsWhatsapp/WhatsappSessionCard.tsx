/**
 * WhatsappSessionCard
 *
 * Tarjeta reutilizable para gestionar una sesión de WhatsApp (Baileys):
 * estado, número vinculado, QR y botones Conectar / Regenerar QR /
 * Desvincular. La usan las pestañas Notificaciones y Consultas.
 */

import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Body, Button, Caption, Card } from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useSingleFlight } from '@/hooks/useSingleFlight';
import type { NotifWaStatus } from '@/types/notifications-whatsapp';
import type { ConsultaWaSessionState } from '@/types/consultas-wa';
import Alert from '@/utils/alert';

import { formatWaJid, getErrorMessage } from './waFormat';

export type WaSessionState = NotifWaStatus | ConsultaWaSessionState;

const STATUS_LABEL: Record<WaSessionState, string> = {
  DISCONNECTED: 'Desconectado',
  CONNECTING: 'Conectando…',
  QR: 'Escanea el QR',
  CONNECTED: 'Conectado',
};

const STATUS_TONE: Record<WaSessionState, BadgeVariant> = {
  DISCONNECTED: 'danger',
  CONNECTING: 'warning',
  QR: 'info',
  CONNECTED: 'success',
};

export interface WhatsappSessionTexts {
  /** Indicación bajo el QR. */
  qrHint: string;
  /** Texto cuando la sesión está activa. */
  connected: string;
  /** Mensaje de confirmación al desvincular. */
  logoutMessage: string;
}

export interface WhatsappSessionCardProps {
  status: WaSessionState;
  me: string | null;
  isFetching: boolean;
  qr: string | null | undefined;
  texts: WhatsappSessionTexts;
  onStart: () => Promise<unknown>;
  onLogout: () => Promise<unknown>;
  startPending: boolean;
  logoutPending: boolean;
}

export const WhatsappSessionCard: React.FC<WhatsappSessionCardProps> = ({
  status,
  me,
  isFetching,
  qr,
  texts,
  onStart,
  onLogout,
  startPending,
  logoutPending,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const runStart = useSingleFlight();
  const runLogout = useSingleFlight();

  const handleStart = () => {
    if (startPending) return;
    void runStart(async () => {
      try {
        await onStart();
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err, 'No se pudo iniciar la sesión'));
      }
    });
  };

  const handleLogout = () => {
    if (logoutPending) return;
    Alert.alert('Cerrar sesión de WhatsApp', texts.logoutMessage, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desvincular',
        style: 'destructive',
        onPress: () => {
          void runLogout(async () => {
            try {
              await onLogout();
            } catch (err) {
              Alert.alert('Error', getErrorMessage(err, 'No se pudo cerrar la sesión'));
            }
          });
        },
      },
    ]);
  };

  const meLabel = formatWaJid(me);

  return (
    <Card variant="elevated" padding="large" style={styles.card}>
      <View style={styles.statusRow}>
        <Badge variant={STATUS_TONE[status]} label={STATUS_LABEL[status]} />
        {isFetching ? <ActivityIndicator size="small" color={theme.color.text.muted} /> : null}
        {meLabel ? (
          <View style={styles.meRow}>
            <Ionicons name="call-outline" size={16} color={theme.color.text.muted} />
            <Body>{meLabel}</Body>
          </View>
        ) : null}
      </View>

      {status === 'QR' ? (
        <View style={styles.qrBox}>
          {qr ? (
            <Image source={{ uri: qr }} style={styles.qrImage} resizeMode="contain" />
          ) : (
            <View style={styles.qrPlaceholder}>
              <ActivityIndicator color={theme.color.text.muted} />
              <Caption color={theme.color.text.muted}>Generando QR…</Caption>
            </View>
          )}
          <Body color={theme.color.text.muted} style={styles.center}>
            {texts.qrHint}
          </Body>
        </View>
      ) : status === 'CONNECTING' ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.color.brand.accent} />
          <Body color={theme.color.text.muted}>Iniciando conexión…</Body>
        </View>
      ) : status === 'CONNECTED' ? (
        <View style={styles.stateBox}>
          <Ionicons name="checkmark-circle" size={40} color={theme.color.icon.success} />
          <Body style={styles.center}>{texts.connected}</Body>
        </View>
      ) : (
        <View style={styles.stateBox}>
          <Ionicons name="cloud-offline-outline" size={40} color={theme.color.text.muted} />
          <Body color={theme.color.text.muted} style={styles.center}>
            No hay sesión iniciada. Pulsa “Conectar” para generar el QR de vinculación.
          </Body>
        </View>
      )}

      <View style={styles.actions}>
        {status === 'CONNECTED' ? (
          <Button
            title="Desvincular"
            variant="outline"
            onPress={handleLogout}
            loading={logoutPending}
            disabled={logoutPending}
            leftIcon="log-out-outline"
          />
        ) : (
          <Button
            title={status === 'QR' ? 'Regenerar QR' : 'Conectar'}
            onPress={handleStart}
            loading={startPending}
            disabled={startPending}
            leftIcon="qr-code-outline"
          />
        )}
      </View>
    </Card>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: spacing[3],
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    meRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      marginLeft: 'auto',
    },
    qrBox: {
      alignItems: 'center',
      gap: spacing[3],
      padding: spacing[3],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.lg,
    },
    qrImage: {
      width: 260,
      height: 260,
      // El QR necesita fondo blanco para escanearse, también en tema oscuro.
      backgroundColor: '#fff',
      borderRadius: borderRadius.md,
    },
    qrPlaceholder: {
      width: 260,
      height: 260,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2],
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.md,
    },
    center: {
      textAlign: 'center',
    },
    stateBox: {
      alignItems: 'center',
      gap: spacing[2],
      padding: spacing[5],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.lg,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
  });

export default WhatsappSessionCard;
