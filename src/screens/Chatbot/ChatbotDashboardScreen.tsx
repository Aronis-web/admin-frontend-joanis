import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Path, Rect, Text as SvgText, Circle } from 'react-native-svg';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { DateRangePicker } from '@/components/DateRangePicker';
import { useTheme } from '@/design-system/themes';
import { useThemedStyles } from '@/design-system/themes/useThemedStyles';
import type { Theme } from '@/design-system/themes/defaultLight';
import { useChatbotDashboard } from '@/hooks/api/useChatbotMetrics';
import type { ChatbotDashboard, ChatbotMetricsParams } from '@/types/chatbot';
import { CHANNEL_META, SALES_CHANNELS, type SalesChannel } from './utils';
import { useQueryClient } from '@tanstack/react-query';
import { chatbotPostsaleKeys } from '@/hooks/api/useChatbotPostsale';
import { PostsaleOverviewSection } from './components/PostsaleOverviewSection';

type Props = NativeStackScreenProps<any, 'ChatbotDashboard'>;

type QuickFilter = 'today' | 'yesterday' | '7d' | 'month' | 'lastMonth' | 'custom';
type Granularity = NonNullable<ChatbotDashboard['series']>['granularity'];

const LIMA_OFFSET_MS = 5 * 3600_000;

/** Medianoche de Perú (como Date UTC) del día local de `d` + `days`. */
const limaMidnight = (d: Date, days = 0): Date => {
  const lima = new Date(d.getTime() - LIMA_OFFSET_MS);
  return new Date(
    Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate() + days, 5, 0, 0)
  );
};

const limaMonthStart = (d: Date, monthsBack = 0): Date => {
  const lima = new Date(d.getTime() - LIMA_OFFSET_MS);
  return new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth() - monthsBack, 1, 5, 0, 0));
};

const rangeFor = (
  f: QuickFilter,
  custom: { from: Date; to: Date } | null
): ChatbotMetricsParams => {
  const now = new Date();
  switch (f) {
    case 'today':
      return { from: limaMidnight(now).toISOString(), to: now.toISOString() };
    case 'yesterday':
      return { from: limaMidnight(now, -1).toISOString(), to: limaMidnight(now).toISOString() };
    case '7d':
      return { from: limaMidnight(now, -6).toISOString(), to: now.toISOString() };
    case 'lastMonth':
      return { from: limaMonthStart(now, 1).toISOString(), to: limaMonthStart(now).toISOString() };
    case 'custom':
      if (custom) {
        return {
          from: limaMidnight(custom.from).toISOString(),
          to: limaMidnight(custom.to, 1).toISOString(),
        };
      }
      return {};
    case 'month':
    default:
      return { from: limaMonthStart(now).toISOString(), to: now.toISOString() };
  }
};

const soles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const solesCents = (c: number) => soles(c / 100);
const num = (n: number) => new Intl.NumberFormat('es-PE').format(n);
const money = (n: number, currency: string | null) =>
  `${currency ?? ''} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();

/** Etiqueta corta del eje X segun la granularidad. */
const xLabel = (bucket: string, g: Granularity): string => {
  if (g === 'hour') return `${bucket.slice(11, 13)}h`;
  if (g === 'day') return `${bucket.slice(8, 10)}/${bucket.slice(5, 7)}`;
  return `${bucket.slice(5, 7)}/${bucket.slice(2, 4)}`;
};

interface ChartSeries {
  label: string;
  color: string;
  values: number[];
}

/** Grafico de lineas/area (varias series) con eje Y y scroll horizontal. */
const LineChart: React.FC<{
  labels: string[];
  series: ChartSeries[];
  width: number;
  format?: (n: number) => string;
  theme: Theme;
}> = ({ labels, series, width, format = (n) => num(Math.round(n)), theme }) => {
  const height = 210;
  const pad = { top: 16, right: 16, bottom: 34, left: 56 };
  const step = Math.max((width - pad.left - pad.right) / Math.max(labels.length - 1, 1), 34);
  const totalWidth = Math.max(width, pad.left + pad.right + step * Math.max(labels.length - 1, 1));
  const gh = height - pad.top - pad.bottom;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i: number) => pad.left + i * step;
  const y = (v: number) => pad.top + gh - (v / max) * gh;
  const every = Math.max(1, Math.ceil(labels.length / 12));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={totalWidth} height={height}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <React.Fragment key={t}>
            <Line
              x1={pad.left}
              x2={totalWidth - pad.right}
              y1={y(max * t)}
              y2={y(max * t)}
              stroke={theme.color.chart.grid}
              strokeWidth={1}
            />
            <SvgText
              x={pad.left - 6}
              y={y(max * t) + 4}
              fontSize={10}
              fill={theme.color.chart.axis}
              textAnchor="end"
            >
              {format(max * t)}
            </SvgText>
          </React.Fragment>
        ))}
        {series.map((s, si) => {
          if (!s.values.length) return null;
          const line = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
          const area = `${line} L ${x(s.values.length - 1)} ${pad.top + gh} L ${x(0)} ${pad.top + gh} Z`;
          return (
            <React.Fragment key={s.label}>
              {si === 0 ? <Path d={area} fill={s.color} fillOpacity={0.1} /> : null}
              <Path d={line} stroke={s.color} strokeWidth={2.5} fill="none" />
              {labels.length <= 40
                ? s.values.map((v, i) => (
                    <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color} />
                  ))
                : null}
            </React.Fragment>
          );
        })}
        {labels.map((l, i) =>
          i % every === 0 ? (
            <SvgText
              key={l + i}
              x={x(i)}
              y={height - 10}
              fontSize={10}
              fill={theme.color.chart.axis}
              textAnchor="middle"
            >
              {l}
            </SvgText>
          ) : null
        )}
      </Svg>
    </ScrollView>
  );
};

/** Grafico de barras con el conteo encima de cada barra. */
const BarChart: React.FC<{
  labels: string[];
  values: number[];
  counts?: number[];
  width: number;
  color: string;
  format?: (n: number) => string;
  theme: Theme;
}> = ({ labels, values, counts, width, color, format = (n) => num(Math.round(n)), theme }) => {
  const height = 220;
  const pad = { top: 22, right: 16, bottom: 34, left: 60 };
  const slot = Math.max((width - pad.left - pad.right) / Math.max(labels.length, 1), 26);
  const totalWidth = Math.max(width, pad.left + pad.right + slot * labels.length);
  const gh = height - pad.top - pad.bottom;
  const max = Math.max(1, ...values);
  const y = (v: number) => pad.top + gh - (v / max) * gh;
  const every = Math.max(1, Math.ceil(labels.length / 12));
  const bw = Math.min(28, slot * 0.6);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={totalWidth} height={height}>
        {[0, 0.5, 1].map((t) => (
          <React.Fragment key={t}>
            <Line
              x1={pad.left}
              x2={totalWidth - pad.right}
              y1={y(max * t)}
              y2={y(max * t)}
              stroke={theme.color.chart.grid}
              strokeWidth={1}
            />
            <SvgText
              x={pad.left - 6}
              y={y(max * t) + 4}
              fontSize={10}
              fill={theme.color.chart.axis}
              textAnchor="end"
            >
              {format(max * t)}
            </SvgText>
          </React.Fragment>
        ))}
        {values.map((v, i) => {
          const cx = pad.left + slot * i + slot / 2;
          return (
            <React.Fragment key={i}>
              <Rect
                x={cx - bw / 2}
                y={y(v)}
                width={bw}
                height={Math.max(0, pad.top + gh - y(v))}
                rx={4}
                fill={color}
              />
              {counts && counts[i] ? (
                <SvgText
                  x={cx}
                  y={y(v) - 5}
                  fontSize={10}
                  fill={theme.color.text.heading}
                  textAnchor="middle"
                >
                  {counts[i]}
                </SvgText>
              ) : null}
              {i % every === 0 ? (
                <SvgText
                  x={cx}
                  y={height - 10}
                  fontSize={10}
                  fill={theme.color.chart.axis}
                  textAnchor="middle"
                >
                  {labels[i]}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
    </ScrollView>
  );
};

/** Tablero de ventas por redes sociales (mismo estilo que el Dashboard principal). */
export const ChatbotDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width, 1200) - 64;

  const [filter, setFilter] = useState<QuickFilter>('today');
  const [custom, setCustom] = useState<{ from: Date; to: Date } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [channel, setChannel] = useState<SalesChannel | undefined>(undefined);
  const params = useMemo(
    () => ({ ...rangeFor(filter, custom), ...(channel ? { channel } : {}) }),
    [filter, custom, channel]
  );
  const chMeta = channel ? CHANNEL_META[channel] : null;
  const waOnly = !channel || channel === 'whatsapp';
  const { data, isLoading, isError, isFetching, refetch } = useChatbotDashboard(params);
  const queryClient = useQueryClient();
  /** Refresca el dashboard y el estado de pedidos / estancados. */
  const refreshAll = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: chatbotPostsaleKeys.overview() });
    queryClient.invalidateQueries({ queryKey: [...chatbotPostsaleKeys.all, 'stalled'] });
  };

  const series = data?.series;
  const labels = useMemo(
    () => (series ? series.points.map((p) => xLabel(p.bucket, series.granularity)) : []),
    [series]
  );
  const granularityText =
    series?.granularity === 'hour'
      ? 'por hora'
      : series?.granularity === 'day'
        ? 'por día'
        : 'por mes';

  const aiByProvider = useMemo(() => {
    const acc: Record<string, { usd: number; pen: number; calls: number }> = {};
    for (const r of data?.ai.byProvider ?? []) {
      const a = (acc[r.provider] ??= { usd: 0, pen: 0, calls: 0 });
      a.usd += r.costUsd;
      a.pen += r.costPen ?? 0;
      a.calls += r.calls;
    }
    return acc;
  }, [data]);

  const filters: Array<{ key: QuickFilter; label: string }> = [
    { key: 'today', label: 'Hoy' },
    { key: 'yesterday', label: 'Ayer' },
    { key: '7d', label: 'Últimos 7 días' },
    { key: 'month', label: 'Este Mes' },
    { key: 'lastMonth', label: 'Mes Pasado' },
    {
      key: 'custom',
      label:
        filter === 'custom' && custom
          ? `📅 ${custom.from.toLocaleDateString('es-PE')} – ${custom.to.toLocaleDateString('es-PE')}`
          : '📅 Personalizado',
    },
  ];

  const Panel: React.FC<{
    title: string;
    color: string;
    rows: Array<{ k: string; v: string; sub?: string }>;
  }> = ({ title, color, rows }) => (
    <View style={[styles.compareCard, { borderTopColor: color }]}>
      <Text style={styles.compareName}>{title}</Text>
      {rows.map((r) => (
        <View key={r.k} style={styles.compareRow}>
          <Text style={styles.compareKey}>{r.k}</Text>
          <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
            <Text style={styles.compareVal}>{r.v}</Text>
            {r.sub ? <Text style={styles.panelSub}>{r.sub}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );

  const Legend: React.FC<{ items: Array<{ label: string; color: string }> }> = ({ items }) => (
    <View style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: i.color }]} />
          <Text style={styles.legendText}>{i.label}</Text>
        </View>
      ))}
    </View>
  );

  const c = theme.color.chart.categorical;
  const hasSeries = !!series && series.points.length > 0;

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerIconRow}>
            <View style={styles.headerIconContainer}>
              <Ionicons
                name={chMeta?.icon ?? 'share-social'}
                size={22}
                color={theme.color.brand.onHeader}
              />
            </View>
            <Text style={styles.title}>Dashboard Redes Sociales</Text>
          </View>
          <Text style={styles.subtitle}>
            {chMeta
              ? `Solo ${chMeta.label}: ventas, chats y gasto`
              : 'WhatsApp, Messenger e Instagram: ventas, chats y gasto'}
          </Text>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refreshAll}
              colors={[theme.color.brand.accent]}
            />
          }
        >
          <View style={styles.channelTabs}>
            {([undefined, ...SALES_CHANNELS] as Array<SalesChannel | undefined>).map((ch) => {
              const active = channel === ch;
              const meta = ch ? CHANNEL_META[ch] : null;
              return (
                <TouchableOpacity
                  key={ch ?? 'all'}
                  style={[
                    styles.channelTab,
                    active && { backgroundColor: meta?.color ?? theme.color.brand.primary },
                  ]}
                  onPress={() => setChannel(ch)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={meta?.icon ?? 'apps-outline'}
                    size={16}
                    color={active ? '#fff' : (meta?.color ?? theme.color.text.muted)}
                  />
                  <Text style={[styles.channelTabText, active && styles.channelTabTextActive]}>
                    {meta?.label ?? 'Todas'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.filtersSection}>
            <Text style={styles.filtersLabel}>📅 Período de Análisis</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {filters.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterButton, filter === f.key && styles.filterButtonActive]}
                  onPress={() => (f.key === 'custom' ? setShowPicker(true) : setFilter(f.key))}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      filter === f.key && styles.filterButtonTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Estado de pedidos y estancados (independiente del período elegido) */}
          <PostsaleOverviewSection />

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.color.brand.accent} />
              <Text style={styles.loadingText}>Cargando dashboard...</Text>
            </View>
          ) : isError || !data ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>No se pudo cargar el dashboard</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                <Text style={styles.retryButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Resumen: lo mas importante en 4 numeros */}
              <View style={styles.kpiStrip}>
                {[
                  {
                    label: 'Ventas',
                    value: solesCents(data.sales.amountCents),
                    sub: `${num(data.sales.orders)} pedidos`,
                  },
                  {
                    label: 'Chats activos',
                    value: num(data.conversations.active),
                    sub: `${num(data.conversations.newChats)} nuevos`,
                  },
                  {
                    label: 'Gasto',
                    value: soles(data.totalCostPen ?? 0),
                    sub: waOnly ? 'Meta + IA' : 'Solo IA (mensajes gratis)',
                  },
                  {
                    label: 'Costo por pedido',
                    value: data.sales.orders
                      ? soles((data.totalCostPen ?? 0) / data.sales.orders)
                      : '—',
                    sub: data.sales.amountCents
                      ? `${((((data.totalCostPen ?? 0) * 100) / data.sales.amountCents) * 100).toFixed(1)}% de las ventas`
                      : 'sin ventas',
                  },
                ].map((k) => (
                  <View key={k.label} style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>{k.label}</Text>
                    <Text style={styles.kpiValue}>{k.value}</Text>
                    <Text style={styles.kpiSub}>{k.sub}</Text>
                  </View>
                ))}
              </View>

              {!channel && data.byChannel?.length ? (
                <>
                  <Text style={styles.sectionTitle}>🌐 Comparativa por red social</Text>
                  <Text style={styles.sectionHint}>
                    Toca una red para ver todos sus datos por separado.
                  </Text>
                  <View style={styles.compareGrid}>
                    {data.byChannel.map((row) => {
                      const meta = CHANNEL_META[row.channel];
                      const share = data.sales.amountCents
                        ? Math.round((row.amountCents / data.sales.amountCents) * 100)
                        : 0;
                      return (
                        <TouchableOpacity
                          key={row.channel}
                          style={[styles.compareCard, { borderTopColor: meta.color }]}
                          onPress={() => setChannel(row.channel)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.compareHead}>
                            <Ionicons name={meta.icon} size={18} color={meta.color} />
                            <Text style={styles.compareName}>{meta.label}</Text>
                            <Text style={styles.compareShare}>{share}% de ventas</Text>
                          </View>
                          <View style={styles.shareBar}>
                            <View
                              style={[
                                styles.shareFill,
                                { width: `${share}%`, backgroundColor: meta.color },
                              ]}
                            />
                          </View>
                          <Text style={styles.compareAmount}>{solesCents(row.amountCents)}</Text>
                          {[
                            ['Pedidos', num(row.orders)],
                            [
                              'Chats activos',
                              `${num(row.activeChats)} (${num(row.newChats)} nuevos)`,
                            ],
                            ['Mensajes de clientes', num(row.customerMessages)],
                            [
                              'Gasto',
                              `${soles(row.totalCostPen)}${
                                row.channel === 'whatsapp'
                                  ? ` (Meta ${row.metaCostPen != null ? soles(row.metaCostPen) : '—'} · IA ${soles(row.aiCostPen)})`
                                  : ' (solo IA)'
                              }`,
                            ],
                            [
                              'Costo por pedido',
                              row.costPerOrderPen != null ? soles(row.costPerOrderPen) : '—',
                            ],
                          ].map(([k, v]) => (
                            <View key={k} style={styles.compareRow}>
                              <Text style={styles.compareKey}>{k}</Text>
                              <Text style={styles.compareVal}>{v}</Text>
                            </View>
                          ))}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {/* Detalle: cada tema en una tarjeta (lo del resumen no se repite) */}
              <View style={styles.compareGrid}>
                <Panel
                  title="💰 Ventas"
                  color={c[1]}
                  rows={[
                    {
                      k: 'Validadas',
                      v: solesCents(data.sales.validated.amountCents),
                      sub: `${num(data.sales.validated.count)} pedidos`,
                    },
                    {
                      k: 'Por validar (voucher)',
                      v: solesCents(data.sales.pendingValidation.amountCents),
                      sub: `${num(data.vouchers.awaitingValidation)} vouchers`,
                    },
                    {
                      k: 'Falta saldo',
                      v: `Faltan ${solesCents(data.sales.awaitingBalance.missingCents)}`,
                      sub: `${num(data.sales.awaitingBalance.count)} pedidos`,
                    },
                    { k: 'Envíos cobrados', v: solesCents(data.sales.deliveryFeesCents) },
                    { k: 'Rechazados / vencidos', v: num(data.sales.rejectedOrExpired) },
                  ]}
                />
                <Panel
                  title="💬 Chats y mensajes"
                  color={c[0]}
                  rows={[
                    {
                      k: 'Identificados (DNI/RUC)',
                      v: num(data.conversations.identified),
                    },
                    { k: 'Mensajes de clientes', v: num(data.messages.fromCustomers) },
                    {
                      k: 'Mensajes del bot',
                      v: num(data.messages.fromBot),
                      sub: data.messages.manual
                        ? `${num(data.messages.manual)} manuales`
                        : undefined,
                    },
                    { k: 'Dados de baja', v: num(data.conversations.optedOut) },
                  ]}
                />
                <Panel
                  title="💸 Gasto (S/ aprox.)"
                  color={c[3] ?? c[2]}
                  rows={[
                    {
                      k: 'Meta (WhatsApp)',
                      v: !waOnly
                        ? 'Gratis'
                        : data.meta.available && data.meta.costPen != null
                          ? soles(data.meta.costPen)
                          : '—',
                      sub: !waOnly
                        ? `${chMeta?.label} no cobra mensajes`
                        : data.meta.available
                          ? `${money(data.meta.cost, data.meta.currency)} · ${num(data.meta.paidMessages)} pagados · ${num(data.meta.freeMessages)} gratis`
                          : data.meta.error,
                    },
                    {
                      k: 'IA',
                      v: soles(data.ai.totalPen ?? 0),
                      sub: `US$ ${data.ai.totalUsd.toFixed(2)}`,
                    },
                    ...(
                      [
                        ['deepseek', 'IA · DeepSeek'],
                        ['gemini', 'IA · Gemini'],
                        ['anthropic', 'IA · Claude'],
                      ] as const
                    )
                      .filter(([key]) => (aiByProvider[key]?.calls ?? 0) > 0)
                      .map(([key, label]) => ({
                        k: label,
                        v: soles(aiByProvider[key].pen),
                        sub: `${num(aiByProvider[key].calls)} llamadas`,
                      })),
                  ]}
                />
                {waOnly ? (
                  <Panel
                    title={'📣 Anuncios "clic a WhatsApp"'}
                    color={c[2]}
                    rows={[
                      {
                        k: 'Chats desde anuncios',
                        v: num(data.ads?.chats ?? 0),
                        sub: data.ads?.topAds?.[0]
                          ? `Top: ${data.ads.topAds[0].headline} (${data.ads.topAds[0].chats})`
                          : undefined,
                      },
                      {
                        k: 'Ventas desde anuncios',
                        v: solesCents(data.ads?.amountCents ?? 0),
                        sub: `${num(data.ads?.orders ?? 0)} pedidos · ${num(data.ads?.chatsWithOrder ?? 0)} clientes`,
                      },
                      {
                        k: 'Mensajes gratis (72 h)',
                        v: num(data.ads?.freeMessages ?? 0),
                      },
                      { k: 'Ahorro estimado', v: soles(data.ads?.savingsPen ?? 0) },
                    ]}
                  />
                ) : null}
              </View>

              {hasSeries ? (
                <Text style={styles.sectionTitle}>
                  📈 Tendencia {granularityText}
                  {chMeta ? ` · ${chMeta.label}` : ''}
                </Text>
              ) : null}
              {hasSeries ? (
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Ventas {granularityText}</Text>
                  <Text style={styles.chartSubtitle}>
                    Monto en soles · número de pedidos sobre cada barra
                  </Text>
                  <BarChart
                    labels={labels}
                    values={series!.points.map((p) => p.amountCents / 100)}
                    counts={series!.points.map((p) => p.orders)}
                    width={chartWidth}
                    color={c[1]}
                    format={(n) => `S/${Math.round(n)}`}
                    theme={theme}
                  />
                </View>
              ) : null}

              {hasSeries ? (
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Mensajes {granularityText}</Text>
                  <Legend
                    items={[
                      { label: 'Clientes', color: c[0] },
                      { label: 'Bot', color: c[1] },
                      { label: 'Chats', color: c[2] },
                    ]}
                  />
                  <LineChart
                    labels={labels}
                    width={chartWidth}
                    theme={theme}
                    series={[
                      {
                        label: 'Clientes',
                        color: c[0],
                        values: series!.points.map((p) => p.customerMessages),
                      },
                      {
                        label: 'Bot',
                        color: c[1],
                        values: series!.points.map((p) => p.botMessages),
                      },
                      { label: 'Chats', color: c[2], values: series!.points.map((p) => p.chats) },
                    ]}
                  />
                </View>
              ) : null}

              {hasSeries ? (
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Gasto {granularityText} (S/)</Text>
                  <Legend
                    items={[
                      { label: 'Meta', color: c[1] },
                      { label: 'IA', color: c[0] },
                    ]}
                  />
                  <LineChart
                    labels={labels}
                    width={chartWidth}
                    theme={theme}
                    format={(n) => `S/${n.toFixed(n < 10 ? 1 : 0)}`}
                    series={[
                      { label: 'Meta', color: c[1], values: series!.points.map((p) => p.metaPen) },
                      { label: 'IA', color: c[0], values: series!.points.map((p) => p.aiPen) },
                    ]}
                  />
                </View>
              ) : null}

              <Text style={styles.footnote}>
                Soles aproximados (ARS 17,500 = S/ 39.84; US$ 1 = S/ 3.60). Meta según su
                facturación (puede variar de la factura); IA según tokens y tarifas públicas.
              </Text>
            </>
          )}
        </ScrollView>

        <DateRangePicker
          visible={showPicker}
          startDate={custom?.from}
          endDate={custom?.to}
          maximumDate={new Date()}
          title="Rango del dashboard"
          onCancel={() => setShowPicker(false)}
          onConfirm={(from, to) => {
            setCustom({ from, to });
            setFilter('custom');
            setShowPicker(false);
          }}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.color.brand.headerFrom },
    headerGradient: {
      paddingHorizontal: theme.space[5],
      paddingTop: theme.space[4],
      paddingBottom: theme.space[5],
    },
    headerIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.space[1] },
    headerIconContainer: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    title: { fontSize: 22, fontWeight: '700', color: theme.color.brand.onHeader },
    subtitle: {
      fontSize: 13,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      marginLeft: 48,
    },
    content: { flex: 1, backgroundColor: theme.color.background.subtle },
    contentContainer: { padding: theme.space[4], paddingBottom: theme.space[10] },
    filtersSection: { marginBottom: theme.space[5] },
    filtersLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    filterButton: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1.5,
      borderColor: theme.color.border.subtle,
      marginRight: theme.space[2],
    },
    filterButtonActive: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    filterButtonText: { fontSize: 13, fontWeight: '600', color: theme.color.text.muted },
    filterButtonTextActive: { color: theme.color.text.onAction },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
      marginTop: theme.space[2],
    },
    chartContainer: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[5],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    chartTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    chartSubtitle: { fontSize: 11, color: theme.color.text.muted, marginBottom: theme.space[2] },
    legend: { flexDirection: 'row', gap: theme.space[4], marginBottom: theme.space[2] },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: theme.space[1.5] },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12, color: theme.color.text.body, fontWeight: '600' },
    loadingContainer: { padding: theme.space[8], alignItems: 'center' },
    loadingText: { marginTop: theme.space[2], color: theme.color.text.muted },
    errorContainer: { padding: theme.space[6], alignItems: 'center' },
    errorIcon: { fontSize: 32, marginBottom: theme.space[2] },
    errorText: { color: theme.color.text.body, marginBottom: theme.space[3] },
    retryButton: {
      backgroundColor: theme.color.brand.primary,
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.full,
    },
    retryButtonText: { color: theme.color.text.onAction, fontWeight: '700' },
    footnote: { fontSize: 11, color: theme.color.text.muted, marginTop: theme.space[2] },
    channelTabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
      marginBottom: theme.space[4],
    },
    channelTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1.5],
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    channelTabText: { fontSize: 14, fontWeight: '700', color: theme.color.text.body },
    channelTabTextActive: { color: '#fff' },
    kpiStrip: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[3],
      marginBottom: theme.space[5],
    },
    kpiCard: {
      flexGrow: 1,
      flexBasis: '45%',
      minWidth: 150,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    kpiValue: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.color.text.heading,
      marginTop: theme.space[1],
    },
    kpiSub: { fontSize: 12, color: theme.color.text.muted, marginTop: 2 },
    sectionHint: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: -theme.space[2],
      marginBottom: theme.space[3],
    },
    compareGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[3],
      marginBottom: theme.space[5],
    },
    compareCard: {
      flexGrow: 1,
      flexBasis: 260,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderTopWidth: 4,
      gap: theme.space[1.5],
    },
    compareHead: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] },
    compareName: { fontSize: 16, fontWeight: '800', color: theme.color.text.heading, flex: 1 },
    compareShare: { fontSize: 12, fontWeight: '700', color: theme.color.text.muted },
    shareBar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.color.background.subtle,
      overflow: 'hidden',
    },
    shareFill: { height: 6, borderRadius: 3 },
    compareAmount: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.color.text.heading,
      marginVertical: theme.space[1],
    },
    compareRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.space[2],
      paddingVertical: 3,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    compareKey: { fontSize: 12, color: theme.color.text.muted, flexShrink: 1 },
    panelSub: { fontSize: 10, color: theme.color.text.muted, textAlign: 'right' },
    compareVal: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.body,
      flexShrink: 1,
      textAlign: 'right',
    },
  });
