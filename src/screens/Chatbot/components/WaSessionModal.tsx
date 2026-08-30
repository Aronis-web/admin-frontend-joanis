import React from 'react';
import { Modal, StyleSheet, View, Image, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Body, Button, Caption, Title, useTheme, useThemedStyles } from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import {
  useLogoutWaSession,
  useStartWaSession,
  useWaQr,
  useWaStatus,
} from '@/hooks/api/useChatbotSession';
import type { WaStatus } from '@/types/chatbot';
import Alert from '@/utils/alert';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const STATUS_LABEL: Record<WaStatus, string> = {
  DISCONNECTED: 'Desconectado',
  CONNECTING: 'Conectando…',
  QR: 'Escanea el QR',
  CONNECTED: 'Conectado',
};

const STATUS_TONE: Record<WaStatus, BadgeVariant> = {
  DISCONNECTED: 'danger',
  CONNECTING: 'warning',
  QR: 'info',
  CONNECTED: 'success',
};

export const WaSessionModal: React.FC<Props> = ({ visible, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const statusQuery = useWaStatus({ enabled: visible });
  const status: WaStatus = statusQuery.data?.status ?? 'DISCONNECTED';
  const me = statusQuery.data?.me ?? null;

  const qrQuery = useWaQr({ enabled: visible && status === 'QR' });

  const startMutation = useStartWaSession();
  const logoutMutation = useLogoutWaSession();

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
      'Se borrarán las credenciales y necesitarás escanear el QR de nuevo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
              </View>
              <View style={{ flex: 1 }}>
                <Title>Sesión WhatsApp</Title>
                {me ? (
                  <Caption color={theme.color.text.muted}>{me}</Caption>
                ) : (
                  <Caption color={theme.color.text.muted}>Sin sesión activa</Caption>
                )}
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.color.text.muted} />
            </Pressable>
          </View>

          <View style={styles.statusRow}>
            <Badge variant={STATUS_TONE[status]} label={STATUS_LABEL[status]} />
            {statusQuery.isFetching ? (
              <ActivityIndicator size="small" color={theme.color.text.muted} />
            ) : null}
          </View>

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
                Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo.
              </Body>
            </View>
          ) : status === 'CONNECTING' ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={theme.color.brand.accent} />
              <Body color={theme.color.text.muted}>Iniciando conexión…</Body>
            </View>
          ) : status === 'CONNECTED' ? (
            <View style={styles.stateBox}>
              <Ionicons name="checkmark-circle" size={32} color="#10B981" />
              <Body>El bot está conectado y respondiendo.</Body>
            </View>
          ) : (
            <View style={styles.stateBox}>
              <Ionicons name="cloud-offline-outline" size={32} color={theme.color.text.muted} />
              <Body color={theme.color.text.muted}>
                No hay sesión iniciada. Pulsa “Iniciar sesión” para generar el QR.
              </Body>
            </View>
          )}

          <View style={styles.actions}>
            {status === 'CONNECTED' ? (
              <Button
                title="Cerrar sesión"
                variant="outline"
                onPress={handleLogout}
                loading={logoutMutation.isPending}
                leftIcon="log-out-outline"
              />
            ) : (
              <Button
                title={status === 'QR' ? 'Regenerar QR' : 'Iniciar sesión'}
                onPress={handleStart}
                loading={startMutation.isPending}
                leftIcon="qr-code-outline"
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
      backgroundColor: '#25D36620',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusRow: {
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
      width: 240,
      height: 240,
      backgroundColor: '#fff',
      borderRadius: borderRadius.md,
    },
    qrPlaceholder: {
      width: 240,
      height: 240,
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
