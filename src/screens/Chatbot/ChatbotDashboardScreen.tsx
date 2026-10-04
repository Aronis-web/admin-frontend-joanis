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

/** Tablero de ventas por WhatsApp (mismo estilo que el Dashboard principal). */
export const ChatbotDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const chartWidth = Math.min(width, 1200) - 64;

  const [filter, setFilter] = useState<QuickFilter>('today');
  const [custom, setCustom] = useState<{ from: Date; to: Date } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const params = useMemo(() => rangeFor(filter, custom), [filter, custom]);
  const { data, isLoading, isError, isFetching, refetch } = useChatbotDashboard(params);

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

  const toneStyle = {
    info: styles.statInfo,
    success: styles.statSuccess,
    warning: styles.statWarning,
    danger: styles.statDanger,
    primary: styles.statPrimary,
  };

  const Stat: React.FC<{
    icon: string;
    label: string;
    value: string;
    sub?: string;
    tone: keyof typeof toneStyle;
  }> = ({ icon, label, value, sub, tone }) => (
    <View style={[styles.statCard, toneStyle[tone]]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>{value}</Text>
      {sub ? <Text style={styles.statSubtext}>{sub}</Text> : null}
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
              <Ionicons name="logo-whatsapp" size={22} color={theme.color.brand.onHeader} />
            </View>
            <Text style={styles.title}>Dashboard WhatsApp</Text>
          </View>
          <Text style={styles.subtitle}>Ventas, pagos, mensajes y gasto del bot</Text>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              colors={[theme.color.brand.accent]}
            />
          }
        >
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
              <Text style={styles.sectionTitle}>💰 Ventas</Text>
              <View style={styles.statsGrid}>
                <Stat
                  icon="🛒"
                  label="Pedidos"
                  value={num(data.sales.orders)}
                  sub={`${num(data.sales.validated.count)} validados`}
                  tone="info"
                />
                <Stat
                  icon="💵"
                  label="Monto de ventas"
                  value={solesCents(data.sales.amountCents)}
                  sub={`Validado ${solesCents(data.sales.validated.amountCents)}`}
                  tone="success"
                />
                <Stat
                  icon="🧾"
                  label="Vouchers por validar"
                  value={num(data.vouchers.awaitingValidation)}
                  sub={solesCents(data.sales.pendingValidation.amountCents)}
                  tone="warning"
                />
                <Stat
                  icon="⏳"
                  label="Falta saldo"
                  value={num(data.sales.awaitingBalance.count)}
                  sub={`Faltan ${solesCents(data.sales.awaitingBalance.missingCents)}`}
                  tone="primary"
                />
                <Stat
                  icon="🛵"
                  label="Envíos cobrados"
                  value={solesCents(data.sales.deliveryFeesCents)}
                  tone="info"
                />
                <Stat
                  icon="✖️"
                  label="Rechazados / vencidos"
                  value={num(data.sales.rejectedOrExpired)}
                  tone="danger"
                />
              </View>

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

              <Text style={styles.sectionTitle}>💬 Chats y mensajes</Text>
              <View style={styles.statsGrid}>
                <Stat
                  icon="💬"
                  label="Chats activos"
                  value={num(data.conversations.active)}
                  sub={`${num(data.conversations.newChats)} nuevos · ${num(data.conversations.identified)} identificados`}
                  tone="info"
                />
                <Stat
                  icon="📥"
                  label="Mensajes de clientes"
                  value={num(data.messages.fromCustomers)}
                  tone="primary"
                />
                <Stat
                  icon="🤖"
                  label="Mensajes del bot"
                  value={num(data.messages.fromBot)}
                  sub={data.messages.manual ? `${num(data.messages.manual)} manuales` : undefined}
                  tone="success"
                />
                <Stat
                  icon="🚫"
                  label="Dados de baja"
                  value={num(data.conversations.optedOut)}
                  tone="danger"
                />
              </View>

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

              <Text style={styles.sectionTitle}>💸 Gasto (aprox. en soles)</Text>
              <View style={styles.statsGrid}>
                <Stat
                  icon="👛"
                  label="Gasto total"
                  value={soles(data.totalCostPen ?? 0)}
                  sub="Meta + IA"
                  tone="warning"
                />
                <Stat
                  icon="🟢"
                  label="Meta (WhatsApp)"
                  value={
                    data.meta.available && data.meta.costPen != null
                      ? soles(data.meta.costPen)
                      : '—'
                  }
                  sub={
                    data.meta.available
                      ? `Real ${money(data.meta.cost, data.meta.currency)} · ${num(data.meta.paidMessages)} pagados · ${num(data.meta.freeMessages)} gratis`
                      : data.meta.error
                  }
                  tone="success"
                />
                <Stat
                  icon="🧠"
                  label="IA total"
                  value={soles(data.ai.totalPen ?? 0)}
                  sub={`Real US$ ${data.ai.totalUsd.toFixed(2)}`}
                  tone="primary"
                />
                {(
                  [
                    ['deepseek', 'DeepSeek', '🐋'],
                    ['gemini', 'Gemini', '✨'],
                    ['anthropic', 'Claude', '🤖'],
                  ] as const
                ).map(([key, label, icon]) => {
                  const a = aiByProvider[key] ?? { usd: 0, pen: 0, calls: 0 };
                  return (
                    <Stat
                      key={key}
                      icon={icon}
                      label={label}
                      value={soles(a.pen)}
                      sub={`Real US$ ${a.usd.toFixed(2)} · ${num(a.calls)} llamadas`}
                      tone="info"
                    />
                  );
                })}
              </View>

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
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -theme.space[1.5],
      marginBottom: theme.space[4],
    },
    statCard: {
      flex: 1,
      minWidth: '30%',
      margin: theme.space[1.5],
      padding: theme.space[4],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      borderWidth: 1,
    },
    statInfo: {
      backgroundColor: theme.color.state.info.background,
      borderColor: theme.color.state.info.background,
    },
    statSuccess: {
      backgroundColor: theme.color.state.success.background,
      borderColor: theme.color.state.success.background,
    },
    statWarning: {
      backgroundColor: theme.color.state.warning.background,
      borderColor: theme.color.state.warning.background,
    },
    statDanger: {
      backgroundColor: theme.color.state.danger.background,
      borderColor: theme.color.state.danger.background,
    },
    statPrimary: {
      backgroundColor: theme.color.brand.accentSoft,
      borderColor: theme.color.brand.accentSoft,
    },
    statIcon: { fontSize: 26, marginBottom: theme.space[2] },
    statLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.color.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.space[1],
      textAlign: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
      textAlign: 'center',
    },
    statValueTablet: { fontSize: 24 },
    statSubtext: {
      fontSize: 10,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
      fontWeight: '500',
      textAlign: 'center',
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
  });
