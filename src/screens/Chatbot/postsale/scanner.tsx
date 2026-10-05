/**
 * Escaneo de stickers de pedido: cámara (solo nativo), campo manual / lector USB
 * (web y escritorio), tarjeta de resultado y escáner por etapa.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Text,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import { useScanPostsale } from '@/hooks/api/useChatbotPostsale';
import {
  isPostsaleDeliverable,
  postsaleErrorMessage,
  type PostsaleScanResult,
  type PostsaleScanStage,
} from '@/services/api/chatbot-postsale';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { formatDateTime } from '../utils';
import {
  CAN_USE_CAMERA,
  ROUTE_ICON,
  ROUTE_LABEL,
  STATUS_VARIANT,
  createPostsaleStyles,
  formatOrderNo,
  statusLabel,
} from './shared';

/** Ignora el mismo QR si se vuelve a leer dentro de esta ventana (ms). */
const SCAN_DEBOUNCE_MS = 3000;

export const QrScannerModal: React.FC<{
  visible: boolean;
  title: string;
  subtitle: string;
  busy?: boolean;
  /** Mantener la cámara abierta tras cada lectura (escaneo continuo). */
  continuous?: boolean;
  onCode: (code: string) => void | Promise<void>;
  onClose: () => void;
  footer?: React.ReactNode;
}> = ({ visible, title, subtitle, busy, continuous, onCode, onClose, footer }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const last = useRef<{ code: string; at: number } | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    busyRef.current = !!busy;
  }, [busy]);

  useEffect(() => {
    if (visible) last.current = null;
  }, [visible]);

  const handleScanned = ({ data }: { data: string }) => {
    const code = (data ?? '').trim();
    if (!code || busyRef.current) return;
    const now = Date.now();
    if (last.current && last.current.code === code && now - last.current.at < SCAN_DEBOUNCE_MS) {
      return;
    }
    last.current = { code, at: now };
    busyRef.current = true;
    Promise.resolve(onCode(code)).finally(() => {
      busyRef.current = false;
      if (!continuous) onClose();
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.scannerContainer}>
        {visible ? (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScanned}
          />
        ) : null}
        <View style={styles.scannerOverlay}>
          <Text style={styles.scannerTitle}>{title}</Text>
          <Text style={styles.scannerSubtitle}>{subtitle}</Text>
          {busy ? <ActivityIndicator color={theme.color.text.inverse} /> : null}
          {footer}
          <Button title="Cerrar" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
};

/** Pide permiso de cámara; devuelve true si se puede abrir el escáner. */
export const useCameraOpener = () => {
  const [permission, requestPermission] = useCameraPermissions();
  return useCallback(async (): Promise<boolean> => {
    try {
      const p = permission?.status === 'granted' ? permission : await requestPermission();
      if (p?.status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos permiso de cámara para escanear el QR.');
        return false;
      }
      return true;
    } catch (err) {
      logger.error('Error pidiendo permiso de cámara', err);
      Alert.alert('Error', 'No se pudo abrir la cámara.');
      return false;
    }
  }, [permission, requestPermission]);
};

/** Campo para pegar o leer con lector USB el texto del QR (Enter envía). */
export const ManualCodeInput: React.FC<{
  placeholder: string;
  buttonTitle: string;
  busy?: boolean;
  onSubmit: (code: string) => void;
}> = ({ placeholder, buttonTitle, busy, onSubmit }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const [value, setValue] = useState('');
  const submit = () => {
    const code = value.trim();
    if (!code) return;
    onSubmit(code);
    setValue('');
  };
  return (
    <View style={styles.inlineRow}>
      <TextInput
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor={theme.color.text.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus={Platform.OS === 'web'}
        blurOnSubmit={false}
        returnKeyType="go"
        style={[styles.input, { flex: 1 }]}
      />
      <Button title={buttonTitle} size="small" onPress={submit} disabled={busy || !value.trim()} />
    </View>
  );
};

export interface ScanEntry {
  key: string;
  at: string;
  result?: PostsaleScanResult;
  error?: string;
}

export const ScanResultCard: React.FC<{
  entry: ScanEntry;
  highlight?: boolean;
  compact?: boolean;
  onDeliver?: (orderId: string) => void;
}> = ({ entry, highlight, compact, onDeliver }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  if (entry.error) {
    return (
      <Card style={StyleSheet.flatten([styles.card, styles.errorCard])}>
        <View style={styles.metaRow}>
          <Ionicons name="close-circle" size={20} color={theme.color.state.danger.text} />
          <Body style={{ flex: 1, color: theme.color.state.danger.text, fontWeight: '700' }}>
            {entry.error}
          </Body>
        </View>
        {!compact ? (
          <Caption color={theme.color.text.muted}>{formatDateTime(entry.at)}</Caption>
        ) : null}
      </Card>
    );
  }
  const r = entry.result;
  if (!r) return null;
  return (
    <Card style={StyleSheet.flatten([styles.card, highlight && styles.highlightCard])}>
      <View style={styles.rowBetween}>
        <Text style={styles.bigOrderNo}>{formatOrderNo(r.orderNo)}</Text>
        <Badge
          variant={STATUS_VARIANT[r.status] ?? 'default'}
          label={statusLabel(r.status, r.statusLabel)}
        />
      </View>
      <Body>{r.customerName || 'Sin nombre'}</Body>
      <View style={styles.metaRow}>
        <Ionicons
          name={ROUTE_ICON[r.route] ?? 'cube-outline'}
          size={14}
          color={theme.color.text.muted}
        />
        <Caption color={theme.color.text.muted}>
          {ROUTE_LABEL[r.route] ?? r.route}
          {!compact ? ` · ${formatDateTime(entry.at)}` : ''}
        </Caption>
      </View>
      {r.agencyCode ? (
        <View style={styles.agencyBox}>
          <Caption color={theme.color.state.warning.text}>Clave de agencia</Caption>
          <Text selectable style={styles.agencyCode}>
            {r.agencyCode}
          </Text>
          <Body
            style={{
              color: theme.color.state.warning.text,
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            ⚠️ Anótalo en el envío contraentrega; no se volverá a mostrar
          </Body>
        </View>
      ) : null}
      {onDeliver && isPostsaleDeliverable(r.status) ? (
        <View style={styles.actionsRow}>
          <Button
            title="Entregar"
            leftIcon="hand-left-outline"
            size="small"
            onPress={() => onDeliver(r.orderId)}
          />
        </View>
      ) : null}
    </Card>
  );
};

/**
 * Escáner de una etapa (armado / despacho / recepción): la descripción dice en
 * una línea qué pasa al escanear. El backend rechaza pedidos de otra etapa y
 * dice dónde escanearlos.
 */
export const StageScanner: React.FC<{
  stage: PostsaleScanStage;
  description: string;
  cameraTitle: string;
  onDeliver?: (orderId: string) => void;
}> = ({ stage, description, cameraTitle, onDeliver }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const scan = useScanPostsale();
  const ensureCamera = useCameraOpener();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [entries, setEntries] = useState<ScanEntry[]>([]);

  const handleCode = useCallback(
    async (code: string) => {
      const at = new Date().toISOString();
      const key = `${at}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        const result = await scan.mutateAsync({ code, stage });
        setEntries((prev) => [{ key, at, result }, ...prev].slice(0, 20));
      } catch (err) {
        setEntries((prev) =>
          [
            { key, at, error: postsaleErrorMessage(err, 'No se pudo registrar el escaneo') },
            ...prev,
          ].slice(0, 20)
        );
      }
    },
    [scan, stage]
  );

  const latest = entries[0];

  return (
    <>
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color={theme.color.state.info.text} />
        <Body style={{ flex: 1, color: theme.color.state.info.text, fontWeight: '600' }}>
          {description}
        </Body>
      </View>
      <Card style={styles.card}>
        {CAN_USE_CAMERA ? (
          <Button
            title="Escanear con la cámara"
            leftIcon="qr-code-outline"
            onPress={async () => {
              if (await ensureCamera()) setCameraOpen(true);
            }}
          />
        ) : null}
        <Caption color={theme.color.text.muted}>
          {CAN_USE_CAMERA
            ? 'O escribe el código del QR:'
            : 'Lee el QR con el lector o pega su texto (GRITPED:…) y presiona Enter.'}
        </Caption>
        <ManualCodeInput
          placeholder="GRITPED:…"
          buttonTitle="Registrar"
          busy={scan.isPending}
          onSubmit={(c) => handleCode(c)}
        />
        {scan.isPending ? <ActivityIndicator color={theme.color.brand.accent} /> : null}
      </Card>

      {entries.map((e, i) => (
        <ScanResultCard key={e.key} entry={e} highlight={i === 0} onDeliver={onDeliver} />
      ))}

      {CAN_USE_CAMERA ? (
        <QrScannerModal
          visible={cameraOpen}
          continuous
          title={cameraTitle}
          subtitle="La cámara queda abierta para leer varios pedidos seguidos"
          busy={scan.isPending}
          onCode={handleCode}
          onClose={() => setCameraOpen(false)}
          footer={
            latest ? (
              <ScanResultCard
                entry={latest}
                compact
                onDeliver={
                  onDeliver
                    ? (id) => {
                        setCameraOpen(false);
                        onDeliver(id);
                      }
                    : undefined
                }
              />
            ) : null
          }
        />
      ) : null}
    </>
  );
};
