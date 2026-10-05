/**
 * Piezas compartidas de las pantallas de Post venta (pedidos de redes sociales):
 * etiquetas de estado/ruta, conversión de imágenes, estilos, layout y fila de pedido.
 */
import React from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { Badge, Body, Caption, useTheme, useThemedStyles } from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import { GradientHeader, contentWidthStyle } from '@/design-system/components';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import type { PostsaleOrder, PostsaleRoute, PostsaleStatus } from '@/services/api/chatbot-postsale';
import { logger } from '@/utils/logger';
import { formatDateTime, formatSolesFromCents } from '../utils';

// ── Etiquetas ──────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<PostsaleStatus, string> = {
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

export const STATUS_VARIANT: Record<PostsaleStatus, BadgeVariant> = {
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

export const STATUS_ORDER: PostsaleStatus[] = [
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

export const ROUTE_LABEL: Record<PostsaleRoute, string> = {
  PICKUP: 'Recojo en tienda',
  DELIVERY_LIMA: 'Delivery Lima',
  AGENCY: 'Agencia',
};

export const ROUTE_ICON: Record<PostsaleRoute, keyof typeof Ionicons.glyphMap> = {
  PICKUP: 'storefront-outline',
  DELIVERY_LIMA: 'bicycle-outline',
  AGENCY: 'bus-outline',
};

/** Acciones del historial con etiqueta propia (las demás muestran el estado). */
export const ACTION_LABEL: Record<string, string> = {
  IMPRESO: 'Sticker impreso',
  REIMPRESO: 'Sticker reimpreso',
  HOJA_ARMADO: 'Hoja de armado impresa',
};

export const PRINT_ACTIONS = ['IMPRESO', 'REIMPRESO', 'HOJA_ARMADO'];

export const timesLabel = (n: number | undefined) => {
  const v = n ?? 0;
  return `${v} ${v === 1 ? 'vez' : 'veces'}`;
};

export const ROUTE_ORDER: PostsaleRoute[] = ['PICKUP', 'DELIVERY_LIMA', 'AGENCY'];

export const CAN_USE_CAMERA = Platform.OS !== 'web';

export const statusLabel = (status: PostsaleStatus, serverLabel?: string | null) =>
  serverLabel || STATUS_LABEL[status] || status;

export const formatOrderNo = (orderNo: string) => `#${String(orderNo ?? '').replace(/^#/, '')}`;

/** `GRITPED:<uuid>` → uuid. */
export const parseOrderQr = (code: string): string | null => {
  const m = /^GRITPED:([0-9a-f-]{36})$/i.exec(code.trim());
  return m ? m[1].toLowerCase() : null;
};

// ── Conversión de imágenes a data URL ──────────────────────────────────────

export const blobToDataUrl = (blob: Blob): Promise<string> =>
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
export const uriToDataUrl = async (uri: string, fallbackMime: string): Promise<string> => {
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
export const photoToDataUrl = async (uri: string): Promise<string> => {
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

// ── Layout ─────────────────────────────────────────────────────────────────

interface PostsaleShellProps {
  navigation: unknown;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  stat?: { value: number | string; label: string };
  refreshing?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
  /** Contenido fijo al pie, fuera del scroll (p. ej. la paginación). */
  footer?: React.ReactNode;
}

/** Cabecera estándar + cuerpo desplazable centrado. */
export const PostsaleShell: React.FC<PostsaleShellProps> = ({
  navigation,
  icon,
  title,
  subtitle,
  stat,
  refreshing,
  onRefresh,
  children,
  footer,
}) => {
  const styles = useThemedStyles(createPostsaleStyles);
  return (
    <ScreenLayout navigation={navigation as never}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <GradientHeader icon={icon} title={title} subtitle={subtitle} stat={stat} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, contentWidthStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
        {footer}
      </SafeAreaView>
    </ScreenLayout>
  );
};

// ── Fila de pedido ─────────────────────────────────────────────────────────

export const OrderRow: React.FC<{
  order: PostsaleOrder;
  onPress?: () => void;
  selected?: boolean;
  selectable?: boolean;
  right?: React.ReactNode;
  /** Muestra cuántas veces se imprimió el sticker (🏷️) y la hoja de armado (📄). */
  showPrintCounts?: boolean;
}> = ({ order, onPress, selected, selectable, right, showPrintCounts }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.orderRow, selected && styles.orderRowOn]}
    >
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
            {order.printedAt && !showPrintCounts ? ' · 🖨️' : ''}
          </Caption>
        </View>
        {showPrintCounts && ((order.stickerPrints ?? 0) > 0 || (order.sheetPrints ?? 0) > 0) ? (
          <View style={styles.metaRow}>
            {(order.stickerPrints ?? 0) > 0 ? (
              <Badge variant="default" size="small" label={`🏷️ ${order.stickerPrints}`} />
            ) : null}
            {(order.sheetPrints ?? 0) > 0 ? (
              <Badge variant="default" size="small" label={`📄 ${order.sheetPrints}`} />
            ) : null}
          </View>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
};

export const createPostsaleStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.color.brand.headerFrom },
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
    infoBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      padding: spacing[3],
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: theme.color.state.info.border,
      backgroundColor: theme.color.state.info.background,
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
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      marginTop: spacing[2],
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
      fontSize: 44,
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
    cameraPanel: {
      height: 260,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      backgroundColor: '#000',
    },
    cameraFrame: {
      position: 'absolute',
      top: '15%',
      bottom: '15%',
      left: '25%',
      right: '25%',
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.85)',
      borderRadius: borderRadius.md,
    },
    cameraBusy: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing[3],
      backgroundColor: theme.color.surface.base,
    },
    searchInput: { flex: 1, paddingVertical: spacing[3], color: theme.color.text.body },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
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
    block: {
      gap: spacing[1],
      padding: spacing[3],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.background.subtle,
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
