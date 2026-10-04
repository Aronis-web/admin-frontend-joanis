import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import {
  Body,
  Caption,
  Card,
  ErrorState,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useChatbotDashboard } from '@/hooks/api/useChatbotMetrics';
import type { ChatbotMetricsParams } from '@/types/chatbot';

type Props = NativeStackScreenProps<any, 'ChatbotDashboard'>;

type RangeKey = 'today' | '7d' | 'month';

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: 'month', label: 'Este mes' },
];

/** Inicio del día en Perú (UTC-5) como ISO. */
const limaStartOfDay = (daysAgo = 0): string => {
  const lima = new Date(Date.now() - 5 * 3600_000);
  const d = new Date(
    Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate() - daysAgo, 5, 0, 0)
  );
  return d.toISOString();
};

const rangeParams = (key: RangeKey): ChatbotMetricsParams => {
  if (key === 'today') return { from: limaStartOfDay(0) };
  if (key === '7d') return { from: limaStartOfDay(6) };
  return {}; // el backend usa desde el 1ro del mes
};

const soles = (cents: number) =>
  `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => new Intl.NumberFormat('es-PE').format(n);
const money = (n: number, currency: string | null) =>
  `${currency ?? ''} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();

const PROVIDER_LABEL: Record<string, string> = {
  deepseek: 'DeepSeek',
  anthropic: 'Claude',
  gemini: 'Gemini',
};

/** Tablero de ventas por WhatsApp: ventas, vouchers, mensajes y gasto. */
export const ChatbotDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [range, setRange] = useState<RangeKey>('month');
  const params = useMemo(() => rangeParams(range), [range]);
  const { data, isLoading, isError, isFetching, refetch } = useChatbotDashboard(params);

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

  const Kpi: React.FC<{
    icon: any;
    label: string;
    value: string;
    hint?: string;
    tone?: string;
  }> = ({ icon, label, value, hint, tone }) => (
    <Card style={styles.kpi}>
      <View style={styles.kpiHeader}>
        <Ionicons name={icon} size={16} color={tone ?? theme.color.brand.accent} />
        <Caption color={theme.color.text.muted}>{label}</Caption>
      </View>
      <Text style={[styles.kpiValue, tone ? { color: tone } : null]}>{value}</Text>
      {hint ? <Caption color={theme.color.text.muted}>{hint}</Caption> : null}
    </Card>
  );

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
              <Ionicons name="speedometer-outline" size={22} color={theme.color.brand.onHeader} />
            </View>
            <Text style={styles.headerTitle}>Dashboard WhatsApp</Text>
          </View>
          <Text style={styles.headerSubtitle}>Ventas, pagos, mensajes y gasto del bot</Text>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
          }
        >
          <View style={styles.rangeRow}>
            {RANGES.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                style={[styles.rangeChip, range === r.key && styles.rangeChipActive]}
              >
                <Caption
                  color={range === r.key ? theme.color.brand.onHeader : theme.color.text.body}
                >
                  {r.label}
                </Caption>
              </Pressable>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.color.brand.accent} />
            </View>
          ) : isError || !data ? (
            <ErrorState
              title="Error al cargar el dashboard"
              description="Reintenta en un momento."
              onRetry={refetch}
            />
          ) : (
            <>
              <Title>Ventas</Title>
              <View style={styles.grid}>
                <Kpi
                  icon="cart-outline"
                  label="Pedidos"
                  value={num(data.sales.orders)}
                  hint={`${num(data.sales.validated.count)} validados`}
                />
                <Kpi
                  icon="cash-outline"
                  label="Monto de ventas"
                  value={soles(data.sales.amountCents)}
                  hint={`Validado: ${soles(data.sales.validated.amountCents)}`}
                />
                <Kpi
                  icon="receipt-outline"
                  label="Vouchers por validar"
                  value={num(data.vouchers.awaitingValidation)}
                  hint={soles(data.sales.pendingValidation.amountCents)}
                  tone={data.vouchers.awaitingValidation ? theme.color.text.warning : undefined}
                />
                <Kpi
                  icon="hourglass-outline"
                  label="Falta saldo"
                  value={num(data.sales.awaitingBalance.count)}
                  hint={`Faltan ${soles(data.sales.awaitingBalance.missingCents)}`}
                />
                <Kpi
                  icon="bicycle-outline"
                  label="Envíos cobrados"
                  value={soles(data.sales.deliveryFeesCents)}
                />
                <Kpi
                  icon="close-circle-outline"
                  label="Rechazados / vencidos"
                  value={num(data.sales.rejectedOrExpired)}
                />
              </View>

              <Title>Chats y mensajes</Title>
              <View style={styles.grid}>
                <Kpi
                  icon="chatbubbles-outline"
                  label="Chats activos"
                  value={num(data.conversations.active)}
                  hint={`${num(data.conversations.newChats)} nuevos · ${num(data.conversations.identified)} identificados`}
                />
                <Kpi
                  icon="arrow-down-outline"
                  label="Mensajes de clientes"
                  value={num(data.messages.fromCustomers)}
                />
                <Kpi
                  icon="arrow-up-outline"
                  label="Mensajes del bot"
                  value={num(data.messages.fromBot)}
                  hint={data.messages.manual ? `${num(data.messages.manual)} manuales` : undefined}
                />
                <Kpi
                  icon="remove-circle-outline"
                  label="Dados de baja"
                  value={num(data.conversations.optedOut)}
                />
              </View>

              <Title>Gasto (aprox. en soles)</Title>
              <View style={styles.grid}>
                <Kpi
                  icon="wallet-outline"
                  label="Gasto total"
                  value={soles(Math.round((data.totalCostPen ?? 0) * 100))}
                  hint="Meta + IA"
                />
                <Kpi
                  icon="logo-whatsapp"
                  label="Meta (WhatsApp)"
                  value={
                    data.meta.available && data.meta.costPen != null
                      ? soles(Math.round(data.meta.costPen * 100))
                      : '—'
                  }
                  hint={
                    data.meta.available
                      ? `Real: ${money(data.meta.cost, data.meta.currency)} · ${num(data.meta.paidMessages)} pagados · ${num(data.meta.freeMessages)} gratis`
                      : data.meta.error
                  }
                />
                <Kpi
                  icon="hardware-chip-outline"
                  label="IA total"
                  value={soles(Math.round((data.ai.totalPen ?? 0) * 100))}
                  hint={`Real: US$ ${data.ai.totalUsd.toFixed(2)}`}
                />
                {(['deepseek', 'gemini', 'anthropic'] as const).map((p) => {
                  const a = aiByProvider[p] ?? { usd: 0, pen: 0, calls: 0 };
                  return (
                    <Kpi
                      key={p}
                      icon="sparkles-outline"
                      label={PROVIDER_LABEL[p]}
                      value={soles(Math.round(a.pen * 100))}
                      hint={`Real: US$ ${a.usd.toFixed(2)} · ${num(a.calls)} llamadas`}
                    />
                  );
                })}
              </View>
              <Caption color={theme.color.text.muted}>
                Soles aproximados (ARS 17,500 = S/ 39.84; US$ 1 = S/ 3.60). Debajo de cada monto, el
                valor real en la moneda original: Meta según su facturación (ARS), IA según tokens y
                tarifas públicas (US$).
              </Caption>
              <Body color={theme.color.text.muted}>
                Desde {new Date(data.range.from).toLocaleString('es-PE')}
              </Body>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
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
    scrollView: { flex: 1, backgroundColor: theme.color.background.subtle },
    scrollContent: { padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3] },
    centerBox: { padding: spacing[5], alignItems: 'center' },
    rangeRow: { flexDirection: 'row', gap: spacing[2] },
    rangeChip: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    rangeChipActive: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
    kpi: { padding: spacing[3], gap: spacing[1], minWidth: 160, flexGrow: 1, flexBasis: 160 },
    kpiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    kpiValue: { fontSize: 22, fontWeight: '700', color: theme.color.text.heading },
  });
