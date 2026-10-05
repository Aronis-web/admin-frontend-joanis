import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { PhotoCapture, SignatureCapture } from '@/components/Repartos';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import {
  useDeliverPostsale,
  usePostsaleDetail,
  usePostsaleOrders,
  usePrintPostsale,
  useResendPostsaleCode,
  useScanPostsale,
} from '@/hooks/api/useChatbotPostsale';
import {
  chatbotPostsaleApi,
  isPostsaleDeliverable,
  postsaleErrorMessage,
  POSTSALE_DELIVERABLE,
  type PostsaleMediaKind,
  type PostsaleOrder,
  type PostsaleRoute,
  type PostsaleScanResult,
  type PostsaleStatus,
} from '@/services/api/chatbot-postsale';
import { printOrderStickers } from '@/utils/priceLabel/orderStickerPrint';
import { printPickingSheets } from '@/utils/priceLabel/orderPickingSheet';
import {
  isElectronPrinting,
  listPrinters,
  type PrinterInfo,
} from '@/utils/priceLabel/priceLabelPrint';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { formatDateTime, formatSolesFromCents } from './utils';

type Props = NativeStackScreenProps<any, 'ChatbotPostsale'>;

type Tab = 'print' | 'scan' | 'deliver' | 'track';

const TAB_OPTIONS: { label: string; value: Tab }[] = [
  { label: '🖨️ Por imprimir', value: 'print' },
  { label: '📷 Escanear', value: 'scan' },
  { label: '✍️ Entregar', value: 'deliver' },
  { label: '🧭 Seguimiento', value: 'track' },
];

const STATUS_LABEL: Record<PostsaleStatus, string> = {
  PAGADO: 'Pagado, por imprimir',
  EN_ARMADO: 'En armado',
  ARMADO_FINALIZADO: 'Armado finalizado',
  EN_RUTA_TIENDA: 'En ruta a tienda',
  EN_TIENDA: 'Listo para recojo',
  EN_RUTA_DOMICILIO: 'En ruta a domicilio',
  EN_RUTA_AGENCIA: 'En ruta a agencia',
  ENTREGADO_AGENCIA: 'Entregado a agencia',
  ENTREGADO: 'Entregado',
};

const STATUS_VARIANT: Record<PostsaleStatus, BadgeVariant> = {
  PAGADO: 'warning',
  EN_ARMADO: 'pending',
  ARMADO_FINALIZADO: 'info',
  EN_RUTA_TIENDA: 'primary',
  EN_TIENDA: 'active',
  EN_RUTA_DOMICILIO: 'primary',
  EN_RUTA_AGENCIA: 'primary',
  ENTREGADO_AGENCIA: 'completed',
  ENTREGADO: 'success',
};

const STATUS_ORDER: PostsaleStatus[] = [
  'PAGADO',
  'EN_ARMADO',
  'ARMADO_FINALIZADO',
  'EN_RUTA_TIENDA',
  'EN_TIENDA',
  'EN_RUTA_DOMICILIO',
  'EN_RUTA_AGENCIA',
  'ENTREGADO_AGENCIA',
  'ENTREGADO',
];

const ROUTE_LABEL: Record<PostsaleRoute, string> = {
  PICKUP: 'Recojo en tienda',
  DELIVERY_LIMA: 'Delivery Lima',
  AGENCY: 'Agencia',
};

const ROUTE_ICON: Record<PostsaleRoute, keyof typeof Ionicons.glyphMap> = {
  PICKUP: 'storefront-outline',
  DELIVERY_LIMA: 'bicycle-outline',
  AGENCY: 'bus-outline',
};

const PRINTER_STORAGE_KEY = 'postsale.stickerPrinter';
/** Ignora el mismo QR si se vuelve a leer dentro de esta ventana (ms). */
const SCAN_DEBOUNCE_MS = 3000;
const CAN_USE_CAMERA = Platform.OS !== 'web';

const statusLabel = (status: PostsaleStatus, serverLabel?: string | null) =>
  serverLabel || STATUS_LABEL[status] || status;

const formatOrderNo = (orderNo: string) => `#${String(orderNo ?? '').replace(/^#/, '')}`;

/** `GRITPED:<uuid>` → uuid. */
const parseOrderQr = (code: string): string | null => {
  const m = /^GRITPED:([0-9a-f-]{36})$/i.exec(code.trim());
  return m ? m[1].toLowerCase() : null;
};

const readStoredPrinter = (): string | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(PRINTER_STORAGE_KEY) : null;
  } catch {
    return null;
  }
};

const storePrinter = (name: string) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(PRINTER_STORAGE_KEY, name);
  } catch {
    /* noop */
  }
};

// ── Conversión de imágenes a data URL ──────────────────────────────────────

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('No se pudo leer la imagen'));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(blob);
  });

/**
 * Convierte la URI que devuelven SignatureCapture / PhotoCapture en un data URL.
 * - `data:` → se usa tal cual (firma en web vía html2canvas).
 * - Web (`blob:`/`http:`) → fetch + FileReader.
 * - Nativo (`file://`) → expo-file-system/legacy en base64.
 */
const uriToDataUrl = async (uri: string, fallbackMime: string): Promise<string> => {
  if (uri.startsWith('data:')) return uri;
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return blobToDataUrl(await res.blob());
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mime = /\.png(\?|$)/i.test(uri)
    ? 'image/png'
    : /\.jpe?g(\?|$)/i.test(uri)
      ? 'image/jpeg'
      : fallbackMime;
  return `data:${mime};base64,${base64}`;
};

/** Foto de entrega: se reduce a JPEG ~1280 px para no enviar varios MB. */
const photoToDataUrl = async (uri: string): Promise<string> => {
  try {
    const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (out.base64) {
      return out.base64.startsWith('data:') ? out.base64 : `data:image/jpeg;base64,${out.base64}`;
    }
  } catch (err) {
    logger.warn('No se pudo comprimir la foto de entrega; se envía original', err);
  }
  return uriToDataUrl(uri, 'image/jpeg');
};

// ── Pantalla ───────────────────────────────────────────────────────────────

/** Post venta de pedidos de redes sociales: stickers, escaneo, entrega y seguimiento. */
export const ChatbotPostsaleScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [tab, setTab] = useState<Tab>('print');
  const [deliverTarget, setDeliverTarget] = useState<DeliverTarget | null>(null);

  // Impresora (solo Electron)
  const supportsPrinterSelection = isElectronPrinting();
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [printer, setPrinter] = useState<string | null>(() => readStoredPrinter());
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  const loadPrinters = useCallback(async () => {
    if (!supportsPrinterSelection) return;
    setLoadingPrinters(true);
    try {
      const list = await listPrinters();
      setPrinters(list);
      setPrinter((prev) => {
        if (prev && list.some((p) => p.name === prev)) return prev;
        const godex = list.find((p) => /godex/i.test(p.name) || /godex/i.test(p.displayName));
        return (godex || list.find((p) => p.isDefault) || list[0])?.name ?? null;
      });
    } finally {
      setLoadingPrinters(false);
    }
  }, [supportsPrinterSelection]);

  useEffect(() => {
    void loadPrinters();
  }, [loadPrinters]);

  const printMutation = usePrintPostsale();

  /** Registra la impresión en el backend y manda los stickers a la impresora. */
  const printOrders = useCallback(
    async (orderIds: string[]): Promise<boolean> => {
      if (!orderIds.length) return false;
      if (supportsPrinterSelection && !printer) {
        Alert.alert(
          'Sin impresora',
          'No se detecta ninguna impresora. Enciende la Godex y pulsa Actualizar.'
        );
        return false;
      }
      let stickers;
      try {
        stickers = await printMutation.mutateAsync(orderIds);
      } catch (err) {
        Alert.alert('Error', postsaleErrorMessage(err, 'No se pudo generar los stickers'));
        return false;
      }
      try {
        await printOrderStickers(stickers, { deviceName: printer ?? undefined });
        return true;
      } catch (err) {
        logger.error('Error imprimiendo stickers de pedido', err);
        Alert.alert(
          'No se pudo imprimir',
          `${postsaleErrorMessage(err, 'Error de impresora')}\n\nLos pedidos quedaron registrados; usa "Reimprimir sticker" en Seguimiento.`
        );
        return false;
      }
    },
    [printMutation, printer, supportsPrinterSelection]
  );

  const [pickingBusy, setPickingBusy] = useState(false);

  /** Hoja de armado (A4) de uno o varios pedidos, en un solo documento. */
  const printPicking = useCallback(async (orderIds: string[]) => {
    if (!orderIds.length) return;
    setPickingBusy(true);
    try {
      let sheets;
      try {
        sheets = await Promise.all(orderIds.map((id) => chatbotPostsaleApi.picking(id)));
      } catch (err) {
        Alert.alert('Error', postsaleErrorMessage(err, 'No se pudo cargar la hoja de armado'));
        return;
      }
      try {
        await printPickingSheets(sheets);
      } catch (err) {
        logger.error('Error generando hoja de armado', err);
        Alert.alert('Error', postsaleErrorMessage(err, 'No se pudo generar la hoja de armado'));
      }
    } finally {
      setPickingBusy(false);
    }
  }, []);
  const picking: PickingAction = { run: printPicking, busy: pickingBusy };

  const startDelivery = useCallback((target: DeliverTarget) => {
    setDeliverTarget(target);
    setTab('deliver');
  }, []);

  const printerPicker = supportsPrinterSelection ? (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <Caption color={theme.color.text.muted}>Impresora de stickers (104 × 100 mm)</Caption>
        <Pressable onPress={() => void loadPrinters()} disabled={loadingPrinters} hitSlop={8}>
          <Caption color={theme.color.text.link}>
            {loadingPrinters ? 'Buscando…' : 'Actualizar'}
          </Caption>
        </Pressable>
      </View>
      {printers.length === 0 ? (
        <Caption color={theme.color.state.warning.text}>
          No se detecta ninguna impresora. Enciende y conecta la Godex, luego pulsa Actualizar.
        </Caption>
      ) : (
        <ChipGroup
          options={printers.map((p) => ({ label: p.displayName || p.name, value: p.name }))}
          selected={printer ? [printer] : []}
          onChange={(sel) => {
            const name = sel[0];
            if (name) {
              setPrinter(name);
              storePrinter(name);
            }
          }}
          size="small"
        />
      )}
    </Card>
  ) : null;

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerIconRow}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="cube-outline" size={22} color={theme.color.brand.onHeader} />
            </View>
            <Text style={styles.headerTitle}>Post venta</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Stickers, armado, despacho y entrega de pedidos de redes sociales
          </Text>
        </LinearGradient>

        <View style={styles.tabsBar}>
          <ChipGroup
            options={TAB_OPTIONS}
            selected={[tab]}
            onChange={(sel) => sel[0] && setTab(sel[0] as Tab)}
            size="small"
          />
        </View>

        {tab === 'print' && (
          <PrintTab printOrders={printOrders} printing={printMutation.isPending} picking={picking}>
            {printerPicker}
          </PrintTab>
        )}
        {tab === 'scan' && <ScanTab onDeliver={startDelivery} />}
        {tab === 'deliver' && (
          <DeliverTab target={deliverTarget} onTargetChange={setDeliverTarget} />
        )}
        {tab === 'track' && (
          <TrackTab
            printOrders={printOrders}
            printing={printMutation.isPending}
            picking={picking}
            onDeliver={startDelivery}
          >
            {printerPicker}
          </TrackTab>
        )}
      </SafeAreaView>
    </ScreenLayout>
  );
};

interface PickingAction {
  run: (orderIds: string[]) => Promise<void>;
  busy: boolean;
}

interface DeliverTarget {
  id: string;
  orderNo: string;
  customerName: string | null;
  route: PostsaleRoute;
  status: PostsaleStatus;
  statusLabel?: string | null;
}

const toDeliverTarget = (o: PostsaleOrder): DeliverTarget => ({
  id: o.id,
  orderNo: o.orderNo,
  customerName: o.customerName,
  route: o.route,
  status: o.postsaleStatus,
  statusLabel: o.statusLabel,
});

// ── Fila de pedido ─────────────────────────────────────────────────────────

const OrderRow: React.FC<{
  order: PostsaleOrder;
  onPress?: () => void;
  selected?: boolean;
  selectable?: boolean;
  right?: React.ReactNode;
}> = ({ order, onPress, selected, selectable, right }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable onPress={onPress} style={[styles.orderRow, selected && styles.orderRowOn]}>
      {selectable ? (
        <Ionicons
          name={selected ? 'checkbox' : 'square-outline'}
          size={24}
          color={selected ? theme.color.brand.accent : theme.color.text.muted}
        />
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.rowBetween}>
          <Body style={styles.orderNo}>{formatOrderNo(order.orderNo)}</Body>
          <Badge
            variant={STATUS_VARIANT[order.postsaleStatus] ?? 'default'}
            label={statusLabel(order.postsaleStatus, order.statusLabel)}
            size="small"
          />
        </View>
        <Body numberOfLines={1}>{order.customerName || 'Sin nombre'}</Body>
        <View style={styles.metaRow}>
          <Ionicons
            name={ROUTE_ICON[order.route] ?? 'cube-outline'}
            size={14}
            color={theme.color.text.muted}
          />
          <Caption color={theme.color.text.muted}>
            {ROUTE_LABEL[order.route] ?? order.route}
            {order.totalCents !== null && order.totalCents !== undefined
              ? ` · ${formatSolesFromCents(String(order.totalCents))}`
              : ''}
            {` · ${formatDateTime(order.updatedAt)}`}
            {order.printedAt ? ' · 🖨️' : ''}
          </Caption>
        </View>
      </View>
      {right}
    </Pressable>
  );
};

// ── Tab: Por imprimir ──────────────────────────────────────────────────────

const PrintTab: React.FC<{
  printOrders: (ids: string[]) => Promise<boolean>;
  printing: boolean;
  picking: PickingAction;
  children?: React.ReactNode;
}> = ({ printOrders, printing, picking, children }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const orders = usePostsaleOrders(['PAGADO']);
  const [selected, setSelected] = useState<string[]>([]);
  const list = useMemo(() => orders.data ?? [], [orders.data]);

  // Si un pedido desaparece de la lista (ya se imprimió), se quita de la selección.
  useEffect(() => {
    setSelected((prev) => prev.filter((id) => list.some((o) => o.id === id)));
  }, [list]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allOn = list.length > 0 && selected.length === list.length;

  const doPrint = async () => {
    const ok = await printOrders(selected);
    if (ok) setSelected([]);
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={orders.isFetching && !orders.isLoading}
          onRefresh={() => orders.refetch()}
        />
      }
    >
      {children}
      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Title>Pagados por imprimir</Title>
          <Caption color={theme.color.text.muted}>{list.length} pedidos</Caption>
        </View>
        <Caption color={theme.color.text.muted}>
          Al imprimir por primera vez el pedido pasa a "En armado".
        </Caption>
        <View style={styles.actionsRow}>
          <Button
            title={allOn ? 'Quitar selección' : 'Seleccionar todos'}
            variant="outline"
            size="small"
            onPress={() => setSelected(allOn ? [] : list.map((o) => o.id))}
            disabled={!list.length}
          />
          <Button
            title={`Imprimir stickers${selected.length ? ` (${selected.length})` : ''}`}
            leftIcon="print-outline"
            size="small"
            onPress={() => void doPrint()}
            disabled={!selected.length || printing}
            loading={printing}
          />
          <Button
            title={`Hoja de armado (PDF)${selected.length ? ` (${selected.length})` : ''}`}
            leftIcon="document-text-outline"
            variant="outline"
            size="small"
            onPress={() => void picking.run(selected)}
            disabled={!selected.length || picking.busy}
            loading={picking.busy}
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
    </ScrollView>
  );
};

// ── Escáner QR (cámara, solo nativo) ───────────────────────────────────────

const QrScannerModal: React.FC<{
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
  const styles = useThemedStyles(createStyles);
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

const useCameraOpener = () => {
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

/** Campo para pegar o leer con lector USB el texto del QR. */
const ManualCodeInput: React.FC<{
  placeholder: string;
  buttonTitle: string;
  busy?: boolean;
  onSubmit: (code: string) => void;
}> = ({ placeholder, buttonTitle, busy, onSubmit }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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

// ── Tab: Escanear ──────────────────────────────────────────────────────────

interface ScanEntry {
  key: string;
  at: string;
  result?: PostsaleScanResult;
  error?: string;
}

const ScanTab: React.FC<{ onDeliver: (t: DeliverTarget) => void }> = ({ onDeliver }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const scan = useScanPostsale();
  const ensureCamera = useCameraOpener();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [entries, setEntries] = useState<ScanEntry[]>([]);

  const handleCode = useCallback(
    async (code: string) => {
      const at = new Date().toISOString();
      const key = `${at}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        const result = await scan.mutateAsync(code);
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
    [scan]
  );

  const openCamera = async () => {
    if (await ensureCamera()) setCameraOpen(true);
  };

  const latest = entries[0];

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={styles.card}>
        <Title>Escanear sticker</Title>
        <Caption color={theme.color.text.muted}>
          Cada lectura avanza el pedido a su siguiente etapa (armado, despacho, llegada a tienda…).
        </Caption>
        {CAN_USE_CAMERA ? (
          <Button
            title="Abrir cámara"
            leftIcon="qr-code-outline"
            onPress={() => void openCamera()}
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
          onSubmit={(c) => void handleCode(c)}
        />
        {scan.isPending ? <ActivityIndicator color={theme.color.brand.accent} /> : null}
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          icon="qr-code-outline"
          title="Sin lecturas"
          description="Los pedidos escaneados aparecerán aquí."
        />
      ) : (
        entries.map((e, i) => (
          <ScanResultCard key={e.key} entry={e} highlight={i === 0} onDeliver={onDeliver} />
        ))
      )}

      {CAN_USE_CAMERA ? (
        <QrScannerModal
          visible={cameraOpen}
          continuous
          title="Escanea el sticker del pedido"
          subtitle="La cámara queda abierta para leer varios pedidos seguidos"
          busy={scan.isPending}
          onCode={handleCode}
          onClose={() => setCameraOpen(false)}
          footer={
            latest ? (
              <ScanResultCard
                entry={latest}
                compact
                onDeliver={(t) => {
                  setCameraOpen(false);
                  onDeliver(t);
                }}
              />
            ) : null
          }
        />
      ) : null}
    </ScrollView>
  );
};

const ScanResultCard: React.FC<{
  entry: ScanEntry;
  highlight?: boolean;
  compact?: boolean;
  onDeliver: (t: DeliverTarget) => void;
}> = ({ entry, highlight, compact, onDeliver }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
  const deliverable = isPostsaleDeliverable(r.status);
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
      {deliverable ? (
        <View style={styles.actionsRow}>
          <Button
            title="Entregar"
            leftIcon="hand-left-outline"
            size="small"
            onPress={() =>
              onDeliver({
                id: r.orderId,
                orderNo: r.orderNo,
                customerName: r.customerName,
                route: r.route,
                status: r.status,
                statusLabel: r.statusLabel,
              })
            }
          />
        </View>
      ) : null}
    </Card>
  );
};

// ── Tab: Entregar ──────────────────────────────────────────────────────────

const DeliverTab: React.FC<{
  target: DeliverTarget | null;
  onTargetChange: (t: DeliverTarget | null) => void;
}> = ({ target, onTargetChange }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const orders = usePostsaleOrders(POSTSALE_DELIVERABLE);
  const deliver = useDeliverPostsale();
  const ensureCamera = useCameraOpener();
  const [cameraOpen, setCameraOpen] = useState(false);
  // El código solo vive aquí mientras se completa la entrega.
  const [code, setCode] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'signature' | 'photo'>('form');
  const [converting, setConverting] = useState(false);

  const list = useMemo(() => orders.data ?? [], [orders.data]);

  const reset = useCallback(() => {
    setCode('');
    setSignature(null);
    setPhoto(null);
    setStep('form');
  }, []);

  // Al cambiar de pedido se descarta todo lo capturado.
  useEffect(() => {
    reset();
  }, [target?.id, reset]);

  const pickByCode = (raw: string) => {
    const text = raw.trim();
    const id = parseOrderQr(text);
    const norm = text.replace(/^#/, '').toUpperCase();
    const found = list.find(
      (o) => (id && o.id.toLowerCase() === id) || o.orderNo.replace(/^#/, '').toUpperCase() === norm
    );
    if (found) {
      onTargetChange(toDeliverTarget(found));
    } else {
      Alert.alert(
        'Pedido no disponible',
        'Ese pedido no está listo para entregar (debe estar en tienda o en ruta a domicilio).'
      );
    }
  };

  const onSignature = async (uri: string) => {
    setStep('form');
    setConverting(true);
    try {
      setSignature(await uriToDataUrl(uri, 'image/png'));
    } catch (err) {
      logger.error('Error convirtiendo firma', err);
      Alert.alert('Error', 'No se pudo procesar la firma. Inténtalo otra vez.');
    } finally {
      setConverting(false);
    }
  };

  const onPhoto = async (uri: string) => {
    setStep('form');
    setConverting(true);
    try {
      setPhoto(await photoToDataUrl(uri));
    } catch (err) {
      logger.error('Error convirtiendo foto', err);
      Alert.alert('Error', 'No se pudo procesar la foto. Inténtalo otra vez.');
    } finally {
      setConverting(false);
    }
  };

  const codeOk = /^\d{6}$/.test(code);
  const canSubmit =
    !!target && codeOk && !!signature && !!photo && !deliver.isPending && !converting;

  const submit = () => {
    if (!target || !signature || !photo) return;
    if (!codeOk) {
      Alert.alert('Código', 'Ingresa el código de 6 dígitos que te dicta el cliente.');
      return;
    }
    deliver.mutate(
      { id: target.id, payload: { code, signature, photo } },
      {
        onSuccess: (res) => {
          reset();
          onTargetChange(null);
          Alert.alert('Entregado', `Pedido ${formatOrderNo(res.orderNo)} entregado.`);
        },
        onError: (err) => {
          setCode('');
          Alert.alert('No se pudo entregar', postsaleErrorMessage(err));
        },
      }
    );
  };

  if (step === 'signature') {
    return (
      <Modal visible animationType="slide" onRequestClose={() => setStep('form')}>
        <SafeAreaView style={{ flex: 1 }}>
          <SignatureCapture
            title="Firma del cliente"
            subtitle="Pide al cliente que firme en el recuadro"
            onSignatureCapture={(uri) => void onSignature(uri)}
            onCancel={() => setStep('form')}
          />
        </SafeAreaView>
      </Modal>
    );
  }
  if (step === 'photo') {
    return (
      <Modal visible animationType="slide" onRequestClose={() => setStep('form')}>
        <SafeAreaView style={{ flex: 1 }}>
          <PhotoCapture
            onPhotoCapture={(uri) => void onPhoto(uri)}
            onCancel={() => setStep('form')}
          />
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={orders.isFetching && !orders.isLoading}
          onRefresh={() => orders.refetch()}
        />
      }
    >
      {target ? (
        <>
          <Card style={StyleSheet.flatten([styles.card, styles.highlightCard])}>
            <View style={styles.rowBetween}>
              <Text style={styles.bigOrderNo}>{formatOrderNo(target.orderNo)}</Text>
              <Badge
                variant={STATUS_VARIANT[target.status] ?? 'default'}
                label={statusLabel(target.status, target.statusLabel)}
              />
            </View>
            <Body>{target.customerName || 'Sin nombre'}</Body>
            <Caption color={theme.color.text.muted}>
              {ROUTE_LABEL[target.route] ?? target.route}
            </Caption>
            <View style={styles.actionsRow}>
              <Button
                title="Cambiar pedido"
                variant="ghost"
                size="small"
                onPress={() => onTargetChange(null)}
              />
            </View>
          </Card>

          <Card style={styles.card}>
            <Title>1. Código de entrega</Title>
            <Caption color={theme.color.text.muted}>
              El cliente recibió un código de 6 dígitos por WhatsApp. Pídeselo y escríbelo aquí.
            </Caption>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              placeholderTextColor={theme.color.text.muted}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="off"
              autoCorrect={false}
              importantForAutofill="no"
              style={[styles.input, styles.codeInput]}
            />
          </Card>

          <Card style={styles.card}>
            <View style={styles.rowBetween}>
              <Title>2. Firma del cliente</Title>
              {signature ? (
                <Ionicons name="checkmark-circle" size={22} color={theme.color.icon.success} />
              ) : null}
            </View>
            {signature ? (
              <Image
                source={{ uri: signature }}
                style={styles.signaturePreview}
                resizeMode="contain"
              />
            ) : null}
            <Button
              title={signature ? 'Volver a firmar' : 'Capturar firma'}
              variant={signature ? 'outline' : 'primary'}
              leftIcon="create-outline"
              size="small"
              onPress={() => setStep('signature')}
              disabled={converting}
            />
          </Card>

          <Card style={styles.card}>
            <View style={styles.rowBetween}>
              <Title>3. Foto de la entrega</Title>
              {photo ? (
                <Ionicons name="checkmark-circle" size={22} color={theme.color.icon.success} />
              ) : null}
            </View>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photoPreview} resizeMode="contain" />
            ) : null}
            <Button
              title={photo ? 'Tomar otra foto' : 'Tomar foto'}
              variant={photo ? 'outline' : 'primary'}
              leftIcon="camera-outline"
              size="small"
              onPress={() => setStep('photo')}
              disabled={converting}
            />
          </Card>

          {converting ? <ActivityIndicator color={theme.color.brand.accent} /> : null}
          <Button
            title="Confirmar entrega"
            leftIcon="checkmark-done-outline"
            variant="success"
            onPress={submit}
            disabled={!canSubmit}
            loading={deliver.isPending}
            fullWidth
          />
        </>
      ) : (
        <>
          <Card style={styles.card}>
            <Title>¿Qué pedido entregas?</Title>
            <Caption color={theme.color.text.muted}>
              Escanea el sticker o elige un pedido listo para recojo o en ruta a domicilio.
            </Caption>
            {CAN_USE_CAMERA ? (
              <Button
                title="Escanear sticker"
                leftIcon="qr-code-outline"
                onPress={async () => {
                  if (await ensureCamera()) setCameraOpen(true);
                }}
              />
            ) : null}
            <ManualCodeInput
              placeholder="GRITPED:… o número de pedido"
              buttonTitle="Buscar"
              onSubmit={pickByCode}
            />
          </Card>
          {orders.isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.color.brand.accent} />
            </View>
          ) : list.length === 0 ? (
            <EmptyState
              icon="hand-left-outline"
              title="Nada por entregar"
              description="Aquí aparecen los pedidos en tienda o en ruta a domicilio."
            />
          ) : (
            list.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                onPress={() => onTargetChange(toDeliverTarget(o))}
                right={<Ionicons name="chevron-forward" size={20} color={theme.color.text.muted} />}
              />
            ))
          )}
          {CAN_USE_CAMERA ? (
            <QrScannerModal
              visible={cameraOpen}
              title="Escanea el sticker del pedido"
              subtitle="Para iniciar la entrega"
              onCode={pickByCode}
              onClose={() => setCameraOpen(false)}
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
};

// ── Tab: Seguimiento ───────────────────────────────────────────────────────

const TrackTab: React.FC<{
  printOrders: (ids: string[]) => Promise<boolean>;
  printing: boolean;
  picking: PickingAction;
  onDeliver: (t: DeliverTarget) => void;
  children?: React.ReactNode;
}> = ({ printOrders, printing, picking, onDeliver, children }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const orders = usePostsaleOrders();
  const [filter, setFilter] = useState<string>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const all = useMemo(() => orders.data ?? [], [orders.data]);

  const options = useMemo(() => {
    const counts = new Map<PostsaleStatus, number>();
    all.forEach((o) => counts.set(o.postsaleStatus, (counts.get(o.postsaleStatus) ?? 0) + 1));
    return [
      { label: `Todos (${all.length})`, value: 'ALL' },
      ...STATUS_ORDER.filter((s) => counts.get(s)).map((s) => ({
        label: `${STATUS_LABEL[s]} (${counts.get(s)})`,
        value: s,
      })),
    ];
  }, [all]);

  const list = filter === 'ALL' ? all : all.filter((o) => o.postsaleStatus === filter);
  const openOrder = all.find((o) => o.id === openId) ?? null;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={orders.isFetching && !orders.isLoading}
          onRefresh={() => orders.refetch()}
        />
      }
    >
      {children}
      <Caption color={theme.color.text.muted}>
        Pedidos activos y entregados en los últimos 7 días.
      </Caption>
      <ChipGroup
        options={options}
        selected={[filter]}
        onChange={(sel) => sel[0] && setFilter(sel[0])}
        size="small"
      />
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
          icon="cube-outline"
          title="Sin pedidos"
          description="No hay pedidos en este estado."
        />
      ) : (
        list.map((o) => (
          <OrderRow
            key={o.id}
            order={o}
            onPress={() => setOpenId(o.id)}
            right={<Ionicons name="chevron-forward" size={20} color={theme.color.text.muted} />}
          />
        ))
      )}

      <OrderDetailModal
        orderId={openId}
        fallback={openOrder}
        printing={printing}
        picking={picking}
        onClose={() => setOpenId(null)}
        onReprint={(id) => void printOrders([id])}
        onDeliver={(t) => {
          setOpenId(null);
          onDeliver(t);
        }}
      />
    </ScrollView>
  );
};

const OrderDetailModal: React.FC<{
  orderId: string | null;
  fallback: PostsaleOrder | null;
  printing: boolean;
  picking: PickingAction;
  onClose: () => void;
  onReprint: (id: string) => void;
  onDeliver: (t: DeliverTarget) => void;
}> = ({ orderId, fallback, printing, picking, onClose, onReprint, onDeliver }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const detail = usePostsaleDetail(orderId);
  const resend = useResendPostsaleCode();
  const d = detail.data;
  const status = d?.status ?? fallback?.postsaleStatus ?? null;
  const deliverable = isPostsaleDeliverable(status);
  const orderNo = d?.orderNo ?? fallback?.orderNo ?? '';

  const confirmResend = () => {
    if (!orderId) return;
    Alert.alert(
      'Reenviar código',
      `Se enviará un nuevo código de entrega al cliente del pedido ${formatOrderNo(orderNo)} por WhatsApp. ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reenviar',
          onPress: () =>
            resend.mutate(orderId, {
              onSuccess: () =>
                Alert.alert('Código reenviado', 'El cliente recibirá un nuevo código.'),
              onError: (err) =>
                Alert.alert('Error', postsaleErrorMessage(err, 'No se pudo reenviar el código')),
            }),
        },
      ]
    );
  };

  const events = [...(d?.events ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Modal visible={!!orderId} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.rowBetween}>
            <Text style={styles.bigOrderNo}>{formatOrderNo(orderNo)}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={26} color={theme.color.text.muted} />
            </Pressable>
          </View>
          {status ? (
            <View style={styles.metaRow}>
              <Badge
                variant={STATUS_VARIANT[status] ?? 'default'}
                label={statusLabel(status, d?.statusLabel ?? fallback?.statusLabel)}
              />
              <Caption color={theme.color.text.muted}>
                {ROUTE_LABEL[(d?.route ?? fallback?.route) as PostsaleRoute] ?? ''}
              </Caption>
            </View>
          ) : null}
          {fallback?.customerName ? <Body>{fallback.customerName}</Body> : null}

          <View style={styles.actionsRow}>
            <Button
              title="Reimprimir sticker"
              leftIcon="print-outline"
              variant="outline"
              size="small"
              onPress={() => orderId && onReprint(orderId)}
              disabled={printing}
              loading={printing}
            />
            <Button
              title="Hoja de armado (PDF)"
              leftIcon="document-text-outline"
              variant="outline"
              size="small"
              onPress={() => orderId && void picking.run([orderId])}
              disabled={picking.busy}
              loading={picking.busy}
            />
            {deliverable ? (
              <>
                <Button
                  title="Reenviar código"
                  leftIcon="chatbubble-ellipses-outline"
                  variant="outline"
                  size="small"
                  onPress={confirmResend}
                  disabled={resend.isPending}
                  loading={resend.isPending}
                />
                <Button
                  title="Entregar"
                  leftIcon="hand-left-outline"
                  size="small"
                  onPress={() =>
                    orderId &&
                    status &&
                    onDeliver({
                      id: orderId,
                      orderNo,
                      customerName: fallback?.customerName ?? null,
                      route: (d?.route ?? fallback?.route ?? 'PICKUP') as PostsaleRoute,
                      status,
                      statusLabel: d?.statusLabel ?? fallback?.statusLabel,
                    })
                  }
                />
              </>
            ) : null}
          </View>

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing[3] }}>
            {detail.isLoading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={theme.color.brand.accent} />
              </View>
            ) : detail.isError ? (
              <Caption color={theme.color.state.danger.text}>
                {postsaleErrorMessage(detail.error, 'No se pudo cargar el detalle')}
              </Caption>
            ) : (
              <>
                {orderId && (d?.hasSignature || d?.hasPhoto) ? (
                  <View style={styles.mediaRow}>
                    {d?.hasSignature ? (
                      <View style={{ flex: 1, gap: spacing[1] }}>
                        <Caption color={theme.color.text.muted}>Firma</Caption>
                        <PostsaleMediaImage orderId={orderId} kind="firma" />
                      </View>
                    ) : null}
                    {d?.hasPhoto ? (
                      <View style={{ flex: 1, gap: spacing[1] }}>
                        <Caption color={theme.color.text.muted}>Foto</Caption>
                        <PostsaleMediaImage orderId={orderId} kind="foto" />
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <Title>Historial</Title>
                {events.length === 0 ? (
                  <Caption color={theme.color.text.muted}>Sin movimientos registrados.</Caption>
                ) : (
                  events.map((ev, i) => (
                    <View key={`${ev.createdAt}-${i}`} style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Body style={{ fontWeight: '700' }}>
                          {ev.toStatus ? (STATUS_LABEL[ev.toStatus] ?? ev.toStatus) : ev.action}
                        </Body>
                        {ev.fromStatus && ev.toStatus && ev.fromStatus !== ev.toStatus ? (
                          <Caption color={theme.color.text.muted}>
                            {STATUS_LABEL[ev.fromStatus] ?? ev.fromStatus} →{' '}
                            {STATUS_LABEL[ev.toStatus] ?? ev.toStatus}
                          </Caption>
                        ) : ev.toStatus ? (
                          <Caption color={theme.color.text.muted}>{ev.action}</Caption>
                        ) : null}
                        {ev.note ? <Caption>{ev.note}</Caption> : null}
                        <Caption color={theme.color.text.muted}>
                          {formatDateTime(ev.createdAt)} · {ev.userName || 'Sistema'}
                        </Caption>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/** Firma o foto de entrega (endpoint autenticado → data URL). */
const PostsaleMediaImage: React.FC<{ orderId: string; kind: PostsaleMediaKind }> = ({
  orderId,
  kind,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    setFailed(false);
    chatbotPostsaleApi
      .fetchMedia(orderId, kind)
      .then(blobToDataUrl)
      .then((u) => !cancelled && setUri(u))
      .catch((err) => {
        logger.error(`No se pudo cargar ${kind} de post venta`, err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, kind]);

  if (failed) return <Caption color={theme.color.text.muted}>No se pudo cargar.</Caption>;
  if (!uri) return <ActivityIndicator color={theme.color.brand.accent} />;
  return <Image source={{ uri }} style={styles.mediaImage} resizeMode="contain" />;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.color.brand.headerFrom },
    headerGradient: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[5],
    },
    headerIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[1] },
    headerIconContainer: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing[3],
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
      letterSpacing: 0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      marginLeft: 48,
    },
    tabsBar: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      backgroundColor: theme.color.background.subtle,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    scrollView: { flex: 1, backgroundColor: theme.color.background.subtle },
    scrollContent: { padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3] },
    centerBox: { padding: spacing[5], alignItems: 'center' },
    card: { padding: spacing[3], gap: spacing[2] },
    highlightCard: { borderWidth: 2, borderColor: theme.color.brand.accent },
    errorCard: {
      borderWidth: 1,
      borderColor: theme.color.state.danger.border,
      backgroundColor: theme.color.state.danger.background,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexWrap: 'wrap' },
    inlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      padding: spacing[3],
      color: theme.color.text.body,
      backgroundColor: theme.color.surface.base,
    },
    codeInput: {
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: 10,
      textAlign: 'center',
    },
    orderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      padding: spacing[3],
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    orderRowOn: { borderColor: theme.color.brand.accent, borderWidth: 2 },
    orderNo: { fontWeight: '800', fontSize: 16 },
    bigOrderNo: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.color.text.heading,
      letterSpacing: 0.5,
    },
    agencyBox: {
      alignItems: 'center',
      gap: spacing[1],
      padding: spacing[3],
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: theme.color.state.warning.border,
      backgroundColor: theme.color.state.warning.background,
    },
    agencyCode: {
      fontSize: 40,
      fontWeight: '900',
      letterSpacing: 4,
      color: theme.color.state.warning.text,
      textAlign: 'center',
    },
    signaturePreview: {
      width: '100%',
      height: 140,
      borderRadius: borderRadius.md,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    photoPreview: {
      width: '100%',
      height: 220,
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.background.muted,
    },
    scannerContainer: { flex: 1, backgroundColor: '#000' },
    scannerOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: spacing[4],
      paddingBottom: spacing[8],
      gap: spacing[2],
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    scannerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
    scannerSubtitle: { fontSize: 13, color: '#E5E7EB', textAlign: 'center' },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    modalSheet: {
      width: '100%',
      maxWidth: 720,
      maxHeight: '90%',
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      padding: spacing[4],
      paddingBottom: spacing[6],
      gap: spacing[3],
    },
    mediaRow: { flexDirection: 'row', gap: spacing[3] },
    mediaImage: {
      width: '100%',
      height: 180,
      borderRadius: borderRadius.md,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    timelineItem: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 6,
      backgroundColor: theme.color.brand.accent,
    },
  });
