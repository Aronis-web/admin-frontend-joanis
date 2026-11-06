/**
 * WhatsappSessionCard
 *
 * Tarjeta reutilizable para gestionar una sesión de WhatsApp (Baileys):
 * estado, número vinculado, QR y botones Conectar / Regenerar QR /
 * Desvincular. Si recibe `onPair`, también permite vincular con el número de
 * celular (código de 8 caracteres) en vez de escanear el QR. La usan las pestañas Notificaciones y Consultas.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Body, Button, Caption, Card, Input, Title } from '@/design-system';
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
  /** Vincular por número: devuelve el código que se escribe en el celular. */
  onPair?: (phone: string) => Promise<{ code: string; phone: string }>;
  pairPending?: boolean;
}

/** 9 dígitos que empiezan en 9 = celular de Perú; si no, se toma tal cual. */
const normalizePhone = (raw: string): string | null => {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith('9')) digits = `51${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
};

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
  onPair,
  pairPending = false,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const runStart = useSingleFlight();
  const runLogout = useSingleFlight();
  const runPair = useSingleFlight();
  const [pairPhone, setPairPhone] = useState('');
  const [pairCode, setPairCode] = useState<{ code: string; phone: string } | null>(null);
  const normalizedPairPhone = normalizePhone(pairPhone);

  // El código deja de servir al conectar o si la sesión se cae.
  useEffect(() => {
    if (status === 'CONNECTED' || status === 'DISCONNECTED') setPairCode(null);
  }, [status]);

  const handlePair = () => {
    if (!onPair || pairPending || !normalizedPairPhone) return;
    void runPair(async () => {
      try {
        setPairCode(null);
        const res = await onPair(normalizedPairPhone);
        setPairCode(res);
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err, 'No se pudo generar el código'));
      }
    });
  };

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

      {onPair && status !== 'CONNECTED' ? (
        <View style={styles.pairBox}>
          <Title size="small">Vincular con número de celular</Title>
          <Caption color={theme.color.text.muted}>
            Si no puedes escanear el QR: escribe el número de notificaciones, pide el código y en
            ese celular abre WhatsApp → Dispositivos vinculados → Vincular dispositivo → “Vincular
            con número de teléfono”.
          </Caption>
          <Input
            label="Celular de notificaciones"
            placeholder="987654321"
            value={pairPhone}
            onChangeText={(t) => setPairPhone(t.replace(/[^\d+\s]/g, ''))}
            keyboardType="phone-pad"
            leftIcon="call-outline"
            size="small"
            helperText={
              normalizedPairPhone
                ? `Se vinculará +${normalizedPairPhone}`
                : '9 dígitos para Perú, o con código de país.'
            }
            editable={!pairPending}
          />
          <View style={styles.actions}>
            <Button
              title={pairCode ? 'Pedir otro código' : 'Pedir código'}
              variant="outline"
              onPress={handlePair}
              loading={pairPending}
              disabled={pairPending || !normalizedPairPhone}
              leftIcon="keypad-outline"
            />
          </View>
          {pairCode ? (
            <View style={styles.codeBox}>
              <Caption color={theme.color.text.muted}>Escribe este código en el celular:</Caption>
              <Body selectable style={styles.code}>
                {pairCode.code}
              </Body>
              <Caption color={theme.color.text.muted} style={styles.center}>
                Vence en unos 2 minutos. Si vence, pide otro.
              </Caption>
            </View>
          ) : null}
        </View>
      ) : null}

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
    pairBox: {
      gap: spacing[2],
      padding: spacing[3],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.lg,
    },
    codeBox: {
      alignItems: 'center',
      gap: spacing[1],
      padding: spacing[3],
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.md,
    },
    code: {
      fontSize: 32,
      fontWeight: '700',
      letterSpacing: 4,
      fontVariant: ['tabular-nums'],
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
  });

export default WhatsappSessionCard;
