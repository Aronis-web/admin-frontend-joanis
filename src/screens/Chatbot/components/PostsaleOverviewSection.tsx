/**
 * Dashboard de Ventas Redes Sociales: "Estado de pedidos" (pago y flujo de post
 * venta) y alerta de "Pedidos estancados" con su lista paginada.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '@/design-system/themes';
import { useThemedStyles } from '@/design-system/themes/useThemedStyles';
import type { Theme } from '@/design-system/themes/defaultLight';
import { MAIN_ROUTES } from '@/constants/routes';
import { usePostsaleOverview, usePostsaleStalled } from '@/hooks/api/useChatbotPostsale';
import type {
  PostsaleOrder,
  PostsaleStalledItem,
  PostsaleStatus,
} from '@/services/api/chatbot-postsale';
import { PageControls } from './PageControls';
import { OrderDetailModal } from '../postsale/OrderDetailModal';
import { ROUTE_ICON, ROUTE_LABEL, formatOrderNo } from '../postsale/shared';
import { usePostsalePrinting } from '../postsale/usePostsalePrinting';
import { displayPhone } from '../utils';

const STALLED_PAGE_SIZE = 20;

const THRESHOLD_LABEL: Record<string, string> = {
  POR_VALIDAR: 'Por validar',
  PAGADO: 'Pagado',
  EN_ARMADO: 'En armado',
  ARMADO_FINALIZADO: 'Armado finalizado',
  EN_RUTA: 'En ruta',
  EN_TIENDA: 'En tienda',
};

const hoursText = (h: number) => {
  if (!Number.isFinite(h)) return '—';
  if (h >= 48) return `${Math.floor(h / 24)} d ${Math.round(h % 24)} h`;
  return `${Math.round(h)} h`;
};

/** Fila del listado de post venta a partir de un pedido estancado (para el detalle). */
const toFallbackOrder = (it: PostsaleStalledItem): PostsaleOrder =>
  ({
    id: it.id,
    orderNo: it.orderNo,
    postsaleStatus: (it.postsaleStatus ?? 'PAGADO') as PostsaleStatus,
    statusLabel: it.stageLabel,
    route: it.route ?? 'PICKUP',
    fulfillment: null,
    totalCents: it.totalCents,
    validatedAt: null,
    printedAt: null,
    updatedAt: it.since,
    customerName: it.customerName,
    convPhone: it.convPhone,
    packages: it.packages,
  }) as PostsaleOrder;

export const PostsaleOverviewSection: React.FC = () => {
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const overview = usePostsaleOverview();
  const [stalledOpen, setStalledOpen] = useState(false);
  const data = overview.data;

  const openTracking = (status?: string) =>
    navigation.navigate(MAIN_ROUTES.CHATBOT_POSTSALE_TRACKING, status ? { status } : undefined);

  if (overview.isLoading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={theme.color.brand.accent} />
      </View>
    );
  }
  if (overview.isError || !data) {
    return (
      <TouchableOpacity style={styles.errorBox} onPress={() => overview.refetch()}>
        <Text style={styles.cardSub}>
          No se pudo cargar el estado de pedidos. Toca para reintentar.
        </Text>
      </TouchableOpacity>
    );
  }

  const stalled = data.stalled ?? 0;
  const alertColors = stalled > 0 ? theme.color.state.danger : theme.color.state.success;

  return (
    <>
      <Text style={styles.sectionTitle}>📦 Estado de pedidos</Text>
      <Text style={styles.sectionHint}>Pago</Text>
      <View style={styles.grid}>
        {data.payment.map((p) => (
          <View key={p.status} style={styles.card}>
            <Text style={styles.cardLabel}>{p.label}</Text>
            <Text style={styles.cardValue}>{p.n}</Text>
            {p.covered ? (
              <Text style={styles.cardSub}>
                {p.covered} pagado{p.covered === 1 ? '' : 's'} completo{p.covered === 1 ? '' : 's'}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <Text style={styles.sectionHint}>Post venta · toca una etapa para ver sus pedidos</Text>
      <View style={styles.grid}>
        {data.postsale.map((p, i) => (
          <TouchableOpacity
            key={p.status}
            style={[styles.card, styles.flowCard]}
            onPress={() => openTracking(p.status)}
            activeOpacity={0.85}
          >
            <Text style={styles.cardLabel}>
              {i + 1}. {p.label}
            </Text>
            <View style={styles.flowRow}>
              <Text style={styles.cardValue}>{p.n}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.color.text.muted} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Alerta de pedidos estancados */}
      <View
        style={[
          styles.alertCard,
          { borderColor: alertColors.border, backgroundColor: alertColors.background },
        ]}
      >
        <Ionicons
          name={stalled > 0 ? 'warning' : 'checkmark-circle'}
          size={28}
          color={alertColors.text}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.alertTitle, { color: alertColors.text }]}>
            {stalled > 0
              ? `${stalled} pedido${stalled === 1 ? '' : 's'} estancado${stalled === 1 ? '' : 's'}`
              : 'Sin pedidos estancados'}
          </Text>
          <Text style={[styles.alertSub, { color: alertColors.text }]}>
            {stalled > 0
              ? 'Superaron el tiempo límite de su etapa.'
              : 'Todos los pedidos están dentro del tiempo de su etapa.'}
          </Text>
        </View>
        {stalled > 0 ? (
          <TouchableOpacity
            style={[styles.alertButton, { backgroundColor: alertColors.text }]}
            onPress={() => setStalledOpen(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.alertButtonText}>Ver estancados</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <StalledModal
        visible={stalledOpen}
        thresholds={data.thresholds}
        onClose={() => setStalledOpen(false)}
        onOpenTracking={() => {
          setStalledOpen(false);
          openTracking();
        }}
      />
    </>
  );
};

const StalledModal: React.FC<{
  visible: boolean;
  thresholds: Record<string, number>;
  onClose: () => void;
  onOpenTracking: () => void;
}> = ({ visible, thresholds, onClose, onOpenTracking }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [page, setPage] = useState(1);
  const stalled = usePostsaleStalled(page, STALLED_PAGE_SIZE, visible);
  const printing = usePostsalePrinting();
  const [detail, setDetail] = useState<PostsaleStalledItem | null>(null);
  const items = stalled.data?.items ?? [];
  const total = stalled.data?.total ?? 0;

  const thresholdNote = Object.entries(thresholds ?? {})
    .map(([k, h]) => `${THRESHOLD_LABEL[k] ?? k} ${h} h`)
    .join(' · ');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>⚠️ Pedidos estancados ({total})</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={26} color={theme.color.text.muted} />
            </Pressable>
          </View>
          {thresholdNote ? (
            <Text style={styles.note}>Límites por etapa: {thresholdNote}.</Text>
          ) : null}

          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 8 }}>
            {stalled.isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={theme.color.brand.accent} />
              </View>
            ) : stalled.isError ? (
              <Text style={styles.cardSub}>No se pudo cargar la lista.</Text>
            ) : items.length === 0 ? (
              <Text style={styles.cardSub}>Sin pedidos estancados.</Text>
            ) : (
              items.map((it) => {
                const ratio = it.limitHours ? it.hours / it.limitHours : 0;
                const late = ratio >= 2 ? theme.color.state.danger : theme.color.state.warning;
                return (
                  <View key={it.id} style={styles.row}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.flowRow}>
                        <Text style={styles.rowOrder}>{formatOrderNo(it.orderNo)}</Text>
                        <View
                          style={[
                            styles.pill,
                            { borderColor: late.border, backgroundColor: late.background },
                          ]}
                        >
                          <Text style={[styles.pillText, { color: late.text }]}>
                            {it.stageLabel}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.rowText} numberOfLines={1}>
                        {it.customerName || 'Sin nombre'}
                        {it.convPhone ? ` · ${displayPhone(it.convPhone)}` : ''}
                      </Text>
                      <Text style={[styles.rowText, { color: late.text, fontWeight: '700' }]}>
                        hace {hoursText(it.hours)} (límite {hoursText(it.limitHours)})
                      </Text>
                      {it.route ? (
                        <View style={styles.flowRow}>
                          <Ionicons
                            name={ROUTE_ICON[it.route] ?? 'cube-outline'}
                            size={14}
                            color={theme.color.text.muted}
                          />
                          <Text style={styles.cardSub}>
                            {ROUTE_LABEL[it.route] ?? it.route}
                            {(it.packages ?? 1) > 1 ? ` · 📦 ${it.packages}` : ''}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {it.postsaleStatus ? (
                      <TouchableOpacity
                        style={styles.detailButton}
                        onPress={() => setDetail(it)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.detailButtonText}>Ver detalle</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            )}
          </ScrollView>

          <PageControls
            total={total}
            page={page}
            pageSize={STALLED_PAGE_SIZE}
            count={items.length}
            busy={stalled.isFetching}
            onPage={setPage}
          />
          <TouchableOpacity onPress={onOpenTracking} style={{ alignSelf: 'flex-end' }}>
            <Text style={styles.link}>Ir a Seguimiento de post venta →</Text>
          </TouchableOpacity>
        </View>
      </View>

      <OrderDetailModal
        orderId={detail?.id ?? null}
        fallback={detail ? toFallbackOrder(detail) : null}
        printing={printing}
        onClose={() => setDetail(null)}
      />
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    loadingBox: { padding: theme.space[4], alignItems: 'center' },
    errorBox: {
      padding: theme.space[4],
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
      marginBottom: theme.space[5],
    },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      padding: theme.space[4],
      borderRadius: theme.radii.xl,
      borderWidth: 1.5,
      marginBottom: theme.space[5],
    },
    alertTitle: { fontSize: 17, fontWeight: '800' },
    alertSub: { fontSize: 12, marginTop: 2 },
    alertButton: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.lg,
    },
    alertButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
      marginTop: theme.space[2],
    },
    sectionHint: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.space[2],
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[3],
      marginBottom: theme.space[4],
    },
    card: {
      flexGrow: 1,
      flexBasis: '30%',
      minWidth: 140,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    flowCard: { borderLeftWidth: 3, borderLeftColor: theme.color.brand.accent },
    flowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      justifyContent: 'space-between',
    },
    cardLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    cardValue: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.color.text.heading,
      marginTop: theme.space[1],
    },
    cardSub: { fontSize: 12, color: theme.color.text.muted, marginTop: 2 },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[4],
    },
    sheet: {
      width: '100%',
      maxWidth: 760,
      maxHeight: '92%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      gap: theme.space[3],
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.space[2],
    },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.color.text.heading, flex: 1 },
    note: { fontSize: 12, color: theme.color.text.muted },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    rowOrder: { fontSize: 16, fontWeight: '800', color: theme.color.text.heading },
    rowText: { fontSize: 13, color: theme.color.text.body },
    pill: {
      paddingHorizontal: theme.space[2],
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
    },
    pillText: { fontSize: 11, fontWeight: '700' },
    detailButton: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    detailButtonText: { fontSize: 13, fontWeight: '700', color: theme.color.text.heading },
    link: { fontSize: 13, fontWeight: '700', color: theme.color.text.link },
  });
