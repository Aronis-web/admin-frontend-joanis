/**
 * NotificationsWhatsappScreen
 *
 * Gestión de la sesión del número saliente de WhatsApp para notificaciones
 * (reparto, documentos de empleados, exports, campañas).
 *
 * Independiente del chatbot de ventas. Requiere el permiso
 * `notifications.whatsapp.session.manage`.
 *
 * API: `/notifications/whatsapp/{status,qr,start,logout}`.
 */

import React from 'react';
import { ScrollView, StyleSheet, View, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Body, Button, Caption, Card, Title } from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';

import {
  useLogoutNotifWaSession,
  useNotifWaQr,
  useNotifWaStatus,
  useStartNotifWaSession,
} from '@/hooks/api/useNotificationsWhatsapp';
import type { NotifWaStatus } from '@/types/notifications-whatsapp';
import Alert from '@/utils/alert';

const STATUS_LABEL: Record<NotifWaStatus, string> = {
  DISCONNECTED: 'Desconectado',
  CONNECTING: 'Conectando…',
  QR: 'Escanea el QR',
  CONNECTED: 'Conectado',
};

const STATUS_TONE: Record<NotifWaStatus, BadgeVariant> = {
  DISCONNECTED: 'danger',
  CONNECTING: 'warning',
  QR: 'info',
  CONNECTED: 'success',
};

const WHATSAPP_GREEN = '#25D366';

export const NotificationsWhatsappScreen: React.FC = () => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const statusQuery = useNotifWaStatus();
  const status: NotifWaStatus = statusQuery.data?.status ?? 'DISCONNECTED';
  const me = statusQuery.data?.me ?? null;

  const qrQuery = useNotifWaQr({ enabled: status === 'QR' });

  const startMutation = useStartNotifWaSession();
  const logoutMutation = useLogoutNotifWaSession();

  const handleStart = () => {
    startMutation.mutate(undefined, {
      onError: (err: any) => {
        Alert.alert('Error', err?.message ?? 'No se pudo iniciar la sesión');
      },
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión de WhatsApp',
      'Se borrarán las credenciales del número de notificaciones y necesitarás escanear el QR de nuevo para reconectar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: () =>
            logoutMutation.mutate(undefined, {
              onError: (err: any) => {
                Alert.alert('Error', err?.message ?? 'No se pudo cerrar la sesión');
              },
            }),
        },
      ]
    );
  };

  const formatMe = (jid: string | null): string | null => {
    if (!jid) return null;
    // Formato típico: `51999888777:12@s.whatsapp.net`
    const raw = jid.split('@')[0]?.split(':')[0];
    return raw ? `+${raw}` : jid;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.color.background.canvas }}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + spacing[6] }]}
    >
      {/* Header card */}
      <Card variant="elevated" padding="large" style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="logo-whatsapp" size={28} color={WHATSAPP_GREEN} />
          </View>
          <View style={{ flex: 1 }}>
            <Title>WhatsApp de Notificaciones</Title>
            <Caption color={theme.color.text.muted}>
              Sesión del número saliente para reparto, documentos, exports y campañas.
            </Caption>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Badge variant={STATUS_TONE[status]} label={STATUS_LABEL[status]} />
          {statusQuery.isFetching ? (
            <ActivityIndicator size="small" color={theme.color.text.muted} />
          ) : null}
        </View>

        {me ? (
          <View style={styles.meRow}>
            <Ionicons name="call-outline" size={16} color={theme.color.text.muted} />
            <Body>{formatMe(me)}</Body>
          </View>
        ) : null}
      </Card>

      {/* Estado / QR */}
      <Card variant="elevated" padding="large">
        {status === 'QR' ? (
          <View style={styles.qrBox}>
            {qrQuery.data?.qr ? (
              <Image
                source={{ uri: qrQuery.data.qr }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <ActivityIndicator color={theme.color.text.muted} />
                <Caption color={theme.color.text.muted}>Generando QR…</Caption>
              </View>
            )}
            <Body color={theme.color.text.muted} style={styles.qrHint}>
              Abre WhatsApp en el celular del número de notificaciones → Dispositivos vinculados →
              Vincular dispositivo.
            </Body>
          </View>
        ) : status === 'CONNECTING' ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={theme.color.brand.accent} />
            <Body color={theme.color.text.muted}>Iniciando conexión…</Body>
          </View>
        ) : status === 'CONNECTED' ? (
          <View style={styles.stateBox}>
            <Ionicons name="checkmark-circle" size={40} color="#10B981" />
            <Body>La sesión está activa. Se pueden enviar notificaciones.</Body>
          </View>
        ) : (
          <View style={styles.stateBox}>
            <Ionicons name="cloud-offline-outline" size={40} color={theme.color.text.muted} />
            <Body color={theme.color.text.muted} style={{ textAlign: 'center' }}>
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
              loading={logoutMutation.isPending}
              leftIcon="log-out-outline"
            />
          ) : (
            <Button
              title={status === 'QR' ? 'Regenerar QR' : 'Conectar'}
              onPress={handleStart}
              loading={startMutation.isPending}
              leftIcon="qr-code-outline"
            />
          )}
        </View>
      </Card>

      {/* Info operativa */}
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
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      padding: spacing[4],
      gap: spacing[4],
    },
    headerCard: {
      gap: spacing[3],
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.lg,
      backgroundColor: `${WHATSAPP_GREEN}20`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    meRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
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
    qrHint: {
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
      marginTop: spacing[4],
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

export default NotificationsWhatsappScreen;
