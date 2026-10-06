/**
 * Escaneo de stickers de pedido: cámara (solo nativo), campo manual / lector USB
 * (web y escritorio), tarjeta de resultado y escáner por etapa.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';
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
import { OLD_STICKER_MESSAGE, isOldSticker } from './paging';

/** Ignora el mismo QR si se vuelve a leer dentro de esta ventana (ms). */
const SCAN_DEBOUNCE_MS = 3000;

/**
 * Lector QR compacto: botón "📷 Escanear" que abre la cámara dentro de la
 * pantalla (las listas siguen visibles) + campo de texto para lector USB / pegar
 * (Enter envía). La cámara solo existe en Android/iOS; en web/escritorio queda
 * el campo de texto.
 */
export const QrInput: React.FC<{
  onCode: (code: string) => void | Promise<void>;
  busy?: boolean;
  placeholder?: string;
  buttonTitle?: string;
}> = ({
  onCode,
  busy,
  placeholder = 'Código del sticker o número de pedido',
  buttonTitle = 'Buscar',
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const ensureCamera = useCameraOpener();
  const [open, setOpen] = useState(false);
  const last = useRef<{ code: string; at: number } | null>(null);
  const runningRef = useRef(false);

  const run = useCallback(
    (code: string) => {
      runningRef.current = true;
      Promise.resolve(onCode(code)).finally(() => {
        runningRef.current = false;
      });
    },
    [onCode]
  );

  const handleScanned = ({ data }: { data: string }) => {
    const code = (data ?? '').trim();
    if (!code || runningRef.current || busy) return;
    const now = Date.now();
    if (last.current && last.current.code === code && now - last.current.at < SCAN_DEBOUNCE_MS) {
      return;
    }
    last.current = { code, at: now };
    run(code);
  };

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (await ensureCamera()) {
      last.current = null;
      setOpen(true);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      {CAN_USE_CAMERA ? (
        <Button
          guardDoubleTap
          title={open ? 'Cerrar cámara' : '📷 Escanear'}
          variant={open ? 'outline' : 'primary'}
          size="small"
          onPress={() => toggle()}
        />
      ) : null}
      {CAN_USE_CAMERA && open ? (
        <View style={styles.cameraPanel}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScanned}
          />
          <View style={styles.cameraFrame} pointerEvents="none" />
          {busy ? (
            <View style={styles.cameraBusy} pointerEvents="none">
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      ) : null}
      <ManualCodeInput
        placeholder={placeholder}
        buttonTitle={buttonTitle}
        busy={busy}
        onSubmit={(c) => run(c)}
      />
      {!CAN_USE_CAMERA ? (
        <Caption color={theme.color.text.muted}>
          Lee el QR con el lector USB o pega su texto y presiona Enter.
        </Caption>
      ) : null}
    </View>
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
      <Button
        guardDoubleTap
        title={buttonTitle}
        size="small"
        onPress={submit}
        disabled={busy || !value.trim()}
      />
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
  /** Contenido extra bajo el resultado (p. ej. acciones de bultos). */
  renderExtra?: (r: PostsaleScanResult) => React.ReactNode;
}> = ({ entry, highlight, compact, onDeliver, renderExtra }) => {
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
  const pending = r.pendingPackages ?? [];
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
          {(r.packages ?? 1) > 1
            ? ` · 📦 ${r.packageNo ? `bulto ${r.packageNo} de ${r.packages}` : `${r.packages} bultos`}`
            : ''}
          {!compact ? ` · ${formatDateTime(entry.at)}` : ''}
        </Caption>
      </View>
      {pending.length ? (
        // Escaneo por bulto: el pedido no avanza hasta escanear todos sus bultos.
        <View
          style={[
            styles.stageBanner,
            {
              borderColor: theme.color.state.warning.border,
              backgroundColor: theme.color.state.warning.background,
            },
          ]}
        >
          <Ionicons name="time-outline" size={18} color={theme.color.state.warning.text} />
          <Body style={{ flex: 1, fontWeight: '700', color: theme.color.state.warning.text }}>
            {r.message ||
              `Faltan bultos: ${pending.map((n) => `bulto ${n}`).join(', ')}. El pedido aún no avanza.`}
          </Body>
        </View>
      ) : (
        <View
          style={[
            styles.stageBanner,
            {
              borderColor: theme.color.state.success.border,
              backgroundColor: theme.color.state.success.background,
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={18} color={theme.color.state.success.text} />
          <Body style={{ flex: 1, fontWeight: '700', color: theme.color.state.success.text }}>
            {`Avanzó a ${statusLabel(r.status, r.statusLabel)}`}
            {r.message ? ` · ${r.message}` : ''}
          </Body>
        </View>
      )}
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
            guardDoubleTap
            title="Entregar"
            leftIcon="hand-left-outline"
            size="small"
            onPress={() => onDeliver(r.orderId)}
          />
        </View>
      ) : null}
      {renderExtra ? renderExtra(r) : null}
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
  onDeliver?: (orderId: string) => void;
  renderExtra?: (r: PostsaleScanResult) => React.ReactNode;
}> = ({ stage, description, onDeliver, renderExtra }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const scan = useScanPostsale();
  const [entries, setEntries] = useState<ScanEntry[]>([]);

  const handleCode = useCallback(
    async (code: string) => {
      const at = new Date().toISOString();
      const key = `${at}-${Math.random().toString(36).slice(2, 8)}`;
      if (isOldSticker(code)) {
        setEntries((prev) => [{ key, at, error: OLD_STICKER_MESSAGE }, ...prev].slice(0, 5));
        return;
      }
      try {
        const result = await scan.mutateAsync({ code, stage });
        setEntries((prev) => [{ key, at, result }, ...prev].slice(0, 5));
      } catch (err) {
        setEntries((prev) =>
          [
            { key, at, error: postsaleErrorMessage(err, 'No se pudo registrar el escaneo') },
            ...prev,
          ].slice(0, 5)
        );
      }
    },
    [scan, stage]
  );

  return (
    <>
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color={theme.color.state.info.text} />
        <Body style={{ flex: 1, color: theme.color.state.info.text, fontWeight: '600' }}>
          {description}
        </Body>
      </View>
      <Card style={styles.card}>
        <QrInput
          onCode={handleCode}
          busy={scan.isPending}
          placeholder="Código del sticker"
          buttonTitle="Registrar"
        />
      </Card>
      {entries.map((e, i) => (
        <ScanResultCard
          key={e.key}
          entry={e}
          highlight={i === 0}
          compact={i > 0}
          onDeliver={onDeliver}
          renderExtra={i === 0 ? renderExtra : undefined}
        />
      ))}
    </>
  );
};
