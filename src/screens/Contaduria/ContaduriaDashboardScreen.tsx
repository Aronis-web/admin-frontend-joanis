import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { DateRangePicker } from '@/components/DateRangePicker';
import {
  Body,
  Button,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Input,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import {
  useSireInvoicesSummary,
  useSireInvoicesSummaryByProvider,
} from '@/hooks/api/useSireCompras';
import type {
  GetSireInvoicesSummaryParams,
  SireProviderSortBy,
  SireSummaryByPeriodo,
  SireSummaryByTipoCpe,
} from '@/types/sireCompras';

type Props = NativeStackScreenProps<any, 'ContaduriaDashboard'>;

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'year' | 'custom';

const CPE_LABELS: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta',
  '07': 'N. Crédito',
  '08': 'N. Débito',
  '14': 'Servicios',
};

const MONEDA_OPTIONS = [
  { label: 'S/ Soles (PEN)', value: 'PEN' },
  { label: '$ Dólares (USD)', value: 'USD' },
];

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const SORT_OPTIONS: Array<{ label: string; value: SireProviderSortBy }> = [
  { label: 'Importe', value: 'importeTotal' },
  { label: 'N.º docs', value: 'count' },
  { label: 'Proveedor', value: 'razonSocialProveedor' },
];

const DEFAULT_PROVIDER_LIMIT = 20;

const formatCurrency = (amount?: string, currency = 'PEN') => {
  if (amount === undefined || amount === null || amount === '') return '-';
  const num = Number(amount);
  if (Number.isNaN(num)) return amount;
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
};

const formatCurrencyCompact = (amount?: string, currency = 'PEN') => {
  const symbol = currency === 'USD' ? '$' : 'S/';
  if (amount === undefined || amount === null || amount === '') return `${symbol} 0`;
  const num = Number(amount);
  if (Number.isNaN(num)) return `${symbol} ${amount}`;
  if (Math.abs(num) >= 1_000_000) return `${symbol} ${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${symbol} ${(num / 1_000).toFixed(1)}K`;
  return `${symbol} ${num.toFixed(0)}`;
};

const formatInt = (n?: number | string) => {
  if (n === undefined || n === null) return '0';
  const num = typeof n === 'string' ? Number(n) : n;
  if (Number.isNaN(num)) return String(n);
  return new Intl.NumberFormat('es-PE').format(num);
};

const formatPeriodo = (per?: string) => {
  if (!per || per.length !== 6) return per ?? '-';
  return `${per.slice(0, 4)}-${per.slice(4, 6)}`;
};

const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getDateRange = (
  filter: DateFilter,
  customStart: Date,
  customEnd: Date
): { fechaFrom: string; fechaTo: string } => {
  const now = new Date();
  let start: Date;
  let end: Date;
  switch (filter) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate());
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate());
      break;
    }
    case 'week': {
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start = new Date(now);
      start.setDate(now.getDate() - diff);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      break;
    }
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
      break;
    case 'custom':
      start = customStart;
      end = customEnd;
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  return { fechaFrom: toISODate(start), fechaTo: toISODate(end) };
};

const yearRange = (): { fechaFrom: string; fechaTo: string } => {
  const now = new Date();
  return {
    fechaFrom: toISODate(new Date(now.getFullYear(), 0, 1)),
    fechaTo: toISODate(new Date(now.getFullYear(), 11, 31)),
  };
};

export const ContaduriaDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  // ============ Filtros globales ============
  const [selectedFilter, setSelectedFilter] = useState<DateFilter>('month');
  const [customStartDate, setCustomStartDate] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [customEndDate, setCustomEndDate] = useState<Date>(() => new Date());
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN');

  const dateRange = useMemo(
    () => getDateRange(selectedFilter, customStartDate, customEndDate),
    [selectedFilter, customStartDate, customEndDate]
  );

  const summaryParams = useMemo<GetSireInvoicesSummaryParams>(
    () => ({
      fechaFrom: dateRange.fechaFrom,
      fechaTo: dateRange.fechaTo,
      moneda,
    }),
    [dateRange.fechaFrom, dateRange.fechaTo, moneda]
  );

  const yearParams = useMemo<GetSireInvoicesSummaryParams>(() => {
    const y = yearRange();
    return { fechaFrom: y.fechaFrom, fechaTo: y.fechaTo, moneda };
  }, [moneda]);

  const {
    data: summary,
    isLoading: loadingSummary,
    isFetching: fetchingSummary,
    isError: summaryError,
    error: summaryErrorObj,
    refetch: refetchSummary,
  } = useSireInvoicesSummary(summaryParams);

  const {
    data: yearSummary,
    isLoading: loadingYear,
    refetch: refetchYear,
  } = useSireInvoicesSummary(yearParams);

  // ============ Provider modal ============
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [providerPage, setProviderPage] = useState(1);
  const [providerSortBy, setProviderSortBy] = useState<SireProviderSortBy>('importeTotal');
  const [providerSearch, setProviderSearch] = useState('');
  const [pageJumpOpen, setPageJumpOpen] = useState(false);
  const [pageJumpValue, setPageJumpValue] = useState('');

  const providerParams = useMemo(
    () => ({
      ...summaryParams,
      sortBy: providerSortBy,
      sortDir: 'DESC' as const,
      limit: DEFAULT_PROVIDER_LIMIT,
      offset: (providerPage - 1) * DEFAULT_PROVIDER_LIMIT,
    }),
    [providerPage, providerSortBy, summaryParams]
  );

  const {
    data: providersData,
    isLoading: loadingProviders,
    isFetching: fetchingProviders,
    isError: providerError,
    refetch: refetchProviders,
  } = useSireInvoicesSummaryByProvider(providerParams, { enabled: providerModalOpen });

  const openProviderModal = useCallback(() => {
    setProviderPage(1);
    setProviderModalOpen(true);
  }, []);
  const closeProviderModal = useCallback(() => {
    setProviderModalOpen(false);
    setProviderSearch('');
  }, []);

  const providerItems = providersData?.items ?? [];
  const providerTotal = providersData?.total ?? 0;
  const providerTotalPages = Math.max(1, Math.ceil(providerTotal / DEFAULT_PROVIDER_LIMIT));

  const filteredProviderItems = useMemo(() => {
    if (!providerSearch.trim()) return providerItems;
    const q = providerSearch.trim().toLowerCase();
    return providerItems.filter(
      (i) =>
        i.razonSocialProveedor.toLowerCase().includes(q) || i.rucProveedor.toLowerCase().includes(q)
    );
  }, [providerItems, providerSearch]);

  const totals = summary?.totals;
  const displayCurrency = moneda;

  const handleRefresh = useCallback(() => {
    void refetchSummary();
    void refetchYear();
  }, [refetchSummary, refetchYear]);

  const openPageJump = useCallback(() => {
    setPageJumpValue(String(providerPage));
    setPageJumpOpen(true);
  }, [providerPage]);

  const confirmPageJump = useCallback(() => {
    const n = Math.max(1, Math.min(providerTotalPages, parseInt(pageJumpValue, 10) || 1));
    setProviderPage(n);
    setPageJumpOpen(false);
  }, [pageJumpValue, providerTotalPages]);

  // ============ Date filter chip ============
  const renderFilterButton = (filter: DateFilter, label: string) => (
    <TouchableOpacity
      key={filter}
      style={[styles.filterButton, selectedFilter === filter && styles.filterButtonActive]}
      onPress={() => {
        if (filter === 'custom') {
          setShowDateRangePicker(true);
        } else {
          setSelectedFilter(filter);
        }
      }}
      activeOpacity={0.75}
    >
      <RNText
        style={[
          styles.filterButtonText,
          selectedFilter === filter && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </RNText>
    </TouchableOpacity>
  );

  const getFilterLabel = (filter: DateFilter): string => {
    switch (filter) {
      case 'today':
        return 'Hoy';
      case 'yesterday':
        return 'Ayer';
      case 'week':
        return 'Esta Semana';
      case 'month':
        return 'Este Mes';
      case 'lastMonth':
        return 'Mes Pasado';
      case 'year':
        return 'Este Año';
      case 'custom':
        return `${dateRange.fechaFrom} → ${dateRange.fechaTo}`;
      default:
        return 'Este Mes';
    }
  };

  // ============ KPI card ============
  const renderKpi = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    value: string,
    accent: string,
    subtitle?: string
  ) => (
    <View style={[styles.kpi, { borderLeftColor: accent }]}>
      <View style={[styles.kpiIconBox, { backgroundColor: `${accent}22` }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Caption color={theme.color.text.muted}>{label}</Caption>
      <Title size="small" style={{ marginTop: 2 }}>
        {value}
      </Title>
      {subtitle ? <Caption color={theme.color.text.muted}>{subtitle}</Caption> : null}
    </View>
  );

  // ============ Distribution row (period) ============
  const maxPeriodoTotal = useMemo(() => {
    if (!summary?.byPeriodo?.length) return 0;
    return summary.byPeriodo.reduce((max, p) => Math.max(max, Number(p.importeTotal) || 0), 0);
  }, [summary?.byPeriodo]);

  const renderPeriodoRow = (item: SireSummaryByPeriodo) => {
    const total = Number(item.importeTotal) || 0;
    const ratio = maxPeriodoTotal > 0 ? Math.max(0.04, total / maxPeriodoTotal) : 0;
    return (
      <View key={item.perTributario} style={styles.periodRow}>
        <View style={styles.periodLabelCol}>
          <Body style={{ fontWeight: '600' }}>{formatPeriodo(item.perTributario)}</Body>
          <Caption color={theme.color.text.muted}>{formatInt(item.count)} docs</Caption>
        </View>
        <View style={styles.periodBarCol}>
          <View
            style={[
              styles.periodBar,
              { width: `${ratio * 100}%`, backgroundColor: theme.color.brand.accent },
            ]}
          />
        </View>
        <View style={styles.periodValueCol}>
          <Body style={{ fontWeight: '600' }}>
            {formatCurrency(item.importeTotal, displayCurrency)}
          </Body>
        </View>
      </View>
    );
  };

  const renderCpeRow = (item: SireSummaryByTipoCpe) => {
    const label = CPE_LABELS[item.tipoCpe] || `Tipo ${item.tipoCpe}`;
    return (
      <View key={item.tipoCpe} style={styles.cpeRow}>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '600' }}>{label}</Body>
          <Caption color={theme.color.text.muted}>
            Código {item.tipoCpe} · {formatInt(item.count)} docs
          </Caption>
        </View>
        <Body style={{ fontWeight: '600' }}>
          {formatCurrency(item.importeTotal, displayCurrency)}
        </Body>
      </View>
    );
  };

  // ============ Yearly monthly bar chart ============
  const yearMonthly = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const map = new Map<string, { count: number; importeTotal: number }>();
    (yearSummary?.byPeriodo ?? []).forEach((p) => {
      if (!p.perTributario || p.perTributario.length !== 6) return;
      map.set(p.perTributario, {
        count: p.count,
        importeTotal: Number(p.importeTotal) || 0,
      });
    });
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${currentYear}${String(i + 1).padStart(2, '0')}`;
      const found = map.get(key);
      return {
        month: i,
        key,
        label: MONTH_LABELS[i],
        count: found?.count ?? 0,
        importeTotal: found?.importeTotal ?? 0,
      };
    });
  }, [yearSummary?.byPeriodo]);

  const maxMonthlyTotal = useMemo(
    () => yearMonthly.reduce((max, m) => Math.max(max, m.importeTotal), 0),
    [yearMonthly]
  );

  const yearAccumulated = useMemo(
    () => yearMonthly.reduce((sum, m) => sum + m.importeTotal, 0),
    [yearMonthly]
  );

  const currentMonthIdx = new Date().getMonth();

  const renderMonthlyChart = () => {
    const CHART_HEIGHT = 180;
    return (
      <Card style={styles.blockCard}>
        <View style={styles.blockHeader}>
          <Ionicons name="stats-chart-outline" size={18} color={theme.color.text.body} />
          <View style={{ flex: 1 }}>
            <Title size="small">Compras por mes · {new Date().getFullYear()}</Title>
            <Caption color={theme.color.text.muted}>
              Acumulado {formatCurrency(String(yearAccumulated), displayCurrency)} · Moneda{' '}
              {displayCurrency}
            </Caption>
          </View>
        </View>

        {loadingYear ? (
          <View style={styles.loadingBoxSmall}>
            <ActivityIndicator size="small" color={theme.color.brand.accent} />
          </View>
        ) : yearAccumulated <= 0 ? (
          <EmptyState
            icon="bar-chart-outline"
            title="Sin datos"
            description={`No hay compras registradas en ${displayCurrency} este año.`}
          />
        ) : (
          <>
            <View style={[styles.chart, { height: CHART_HEIGHT }]}>
              {yearMonthly.map((m) => {
                const ratio =
                  maxMonthlyTotal > 0 ? Math.max(0, m.importeTotal / maxMonthlyTotal) : 0;
                const barHeight = Math.max(2, Math.round(ratio * (CHART_HEIGHT - 32)));
                const isCurrent = m.month === currentMonthIdx;
                return (
                  <View key={m.key} style={styles.chartCol}>
                    <RNText style={styles.chartBarValue} numberOfLines={1}>
                      {m.importeTotal > 0
                        ? formatCurrencyCompact(String(m.importeTotal), displayCurrency)
                        : ''}
                    </RNText>
                    <View style={styles.chartBarTrack}>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            height: barHeight,
                            backgroundColor: isCurrent
                              ? theme.color.brand.accent
                              : `${theme.color.brand.accent}AA`,
                          },
                        ]}
                      />
                    </View>
                    <RNText style={[styles.chartBarLabel, isCurrent && styles.chartBarLabelActive]}>
                      {m.label}
                    </RNText>
                  </View>
                );
              })}
            </View>

            {/* Tabla detalle mensual */}
            <View style={styles.monthlyTable}>
              {yearMonthly
                .filter((m) => m.importeTotal > 0 || m.count > 0)
                .map((m) => (
                  <View key={`row-${m.key}`} style={styles.monthlyRow}>
                    <View style={styles.monthlyLabelCol}>
                      <Body style={{ fontWeight: '600' }}>
                        {m.label} {new Date().getFullYear()}
                      </Body>
                      <Caption color={theme.color.text.muted}>{formatInt(m.count)} docs</Caption>
                    </View>
                    <Body style={{ fontWeight: '600' }}>
                      {formatCurrency(String(m.importeTotal), displayCurrency)}
                    </Body>
                  </View>
                ))}
            </View>
          </>
        )}
      </Card>
    );
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header con gradiente (patrón global) */}
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="stats-chart" size={22} color={theme.color.brand.onHeader} />
                </View>
                <RNText style={styles.title}>Dashboard Contaduría</RNText>
              </View>
              <RNText style={styles.subtitle} numberOfLines={1}>
                {getFilterLabel(selectedFilter)} · Moneda {displayCurrency}
              </RNText>
            </View>
            <TouchableOpacity
              onPress={openProviderModal}
              style={styles.headerAction}
              activeOpacity={0.8}
            >
              <Ionicons name="people-outline" size={16} color={theme.color.brand.onHeader} />
              <RNText style={styles.headerActionText}>Por proveedor</RNText>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={fetchingSummary && !loadingSummary}
              onRefresh={handleRefresh}
              colors={[theme.color.brand.accent]}
            />
          }
        >
          {/* Filtros globales — patrón dashboard general */}
          <View style={styles.filtersSection}>
            <RNText style={styles.filtersLabel}>📅 Período de Análisis</RNText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersContent}
            >
              {renderFilterButton('today', 'Hoy')}
              {renderFilterButton('yesterday', 'Ayer')}
              {renderFilterButton('week', 'Esta Semana')}
              {renderFilterButton('month', 'Este Mes')}
              {renderFilterButton('lastMonth', 'Mes Pasado')}
              {renderFilterButton('year', 'Este Año')}
              {renderFilterButton('custom', '📅 Personalizado')}
            </ScrollView>
            <View style={styles.currencyRow}>
              <Caption color={theme.color.text.muted}>Moneda</Caption>
              <ChipGroup
                options={MONEDA_OPTIONS}
                selected={[moneda]}
                onChange={(sel) => {
                  const v = sel[0];
                  if (v === 'PEN' || v === 'USD') setMoneda(v);
                }}
                variant="filled"
                size="small"
              />
            </View>
          </View>

          {/* Sección Compras — del período seleccionado */}
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Title size="small">Compras del período</Title>
              <Caption color={theme.color.text.muted}>
                {getFilterLabel(selectedFilter)} · {displayCurrency}
              </Caption>
            </View>
            <Button
              title="Por proveedor"
              onPress={openProviderModal}
              variant="secondary"
              size="small"
            />
          </View>

          {loadingSummary ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={theme.color.brand.accent} />
            </View>
          ) : summaryError ? (
            <ErrorState
              title="No se pudo cargar el resumen"
              description={(summaryErrorObj as Error)?.message || 'Intenta nuevamente'}
              onRetry={() => refetchSummary()}
            />
          ) : !totals || totals.count === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="Sin datos"
              description={`No hay comprobantes en ${displayCurrency} para el período seleccionado.`}
            />
          ) : (
            <>
              <View style={styles.kpisGrid}>
                {renderKpi(
                  'document-text-outline',
                  'Comprobantes',
                  formatInt(totals.count),
                  '#3B82F6',
                  `Moneda ${displayCurrency}`
                )}
                {renderKpi(
                  'cash-outline',
                  'Base imponible',
                  formatCurrency(totals.baseImponible, displayCurrency),
                  '#10B981'
                )}
                {renderKpi(
                  'calculator-outline',
                  'IGV',
                  formatCurrency(totals.igv, displayCurrency),
                  '#F59E0B'
                )}
                {renderKpi(
                  'wallet-outline',
                  'Importe total',
                  formatCurrency(totals.importeTotal, displayCurrency),
                  '#8B5CF6',
                  `ISC ${formatCurrency(totals.isc, displayCurrency)} · Otros ${formatCurrency(
                    totals.otros,
                    displayCurrency
                  )}`
                )}
              </View>

              {summary?.byPeriodo?.length ? (
                <Card style={styles.blockCard}>
                  <View style={styles.blockHeader}>
                    <Ionicons name="bar-chart-outline" size={18} color={theme.color.text.body} />
                    <Title size="small">Compras por período</Title>
                  </View>
                  <View style={{ gap: spacing[2] }}>{summary.byPeriodo.map(renderPeriodoRow)}</View>
                </Card>
              ) : null}

              {summary?.byTipoCpe?.length ? (
                <Card style={styles.blockCard}>
                  <View style={styles.blockHeader}>
                    <Ionicons name="pricetags-outline" size={18} color={theme.color.text.body} />
                    <Title size="small">Por tipo de comprobante</Title>
                  </View>
                  <View style={{ gap: spacing[2] }}>{summary.byTipoCpe.map(renderCpeRow)}</View>
                </Card>
              ) : null}
            </>
          )}

          {/* Gráfico anual mensual — SIEMPRE al final */}
          {renderMonthlyChart()}

          {/* Indicador si el backend aún así reporta otras monedas */}
          {yearSummary && yearSummary.byCurrency.length > 1 ? (
            <Caption color={theme.color.text.muted} style={{ textAlign: 'center' }}>
              También hay operaciones en{' '}
              {yearSummary.byCurrency
                .filter((c) => c.moneda !== displayCurrency)
                .map((c) => c.moneda)
                .join(', ')}
              . Cambia la moneda arriba para verlas.
            </Caption>
          ) : null}
        </ScrollView>

        {/* ================= Provider modal ================= */}
        <Modal
          visible={providerModalOpen}
          animationType="slide"
          transparent
          onRequestClose={closeProviderModal}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeProviderModal} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Title size="small">Compras por proveedor</Title>
                <Caption color={theme.color.text.muted}>
                  {getFilterLabel(selectedFilter)} · {displayCurrency}
                </Caption>
              </View>
              <TouchableOpacity onPress={closeProviderModal} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={theme.color.text.body} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalControls}>
              <Input
                placeholder="Filtrar por proveedor o RUC (en esta página)"
                value={providerSearch}
                onChangeText={setProviderSearch}
                leftIcon="search-outline"
                size="small"
              />
              <View style={styles.currencyRow}>
                <Caption color={theme.color.text.muted}>Ordenar por</Caption>
                <ChipGroup
                  options={SORT_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
                  selected={[providerSortBy]}
                  onChange={(sel) => {
                    setProviderSortBy((sel[0] as SireProviderSortBy) || 'importeTotal');
                    setProviderPage(1);
                  }}
                  variant="filled"
                  size="small"
                />
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalListContent}
              keyboardShouldPersistTaps="handled"
            >
              {loadingProviders ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={theme.color.brand.accent} />
                </View>
              ) : providerError ? (
                <ErrorState
                  title="No se pudo cargar el detalle"
                  description="Intenta nuevamente"
                  onRetry={() => refetchProviders()}
                />
              ) : filteredProviderItems.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title="Sin proveedores"
                  description={
                    providerSearch
                      ? 'Sin coincidencias en esta página. Prueba otra página o limpia el filtro.'
                      : 'No hay compras registradas para los filtros aplicados.'
                  }
                />
              ) : (
                <View style={{ gap: spacing[3] }}>
                  {filteredProviderItems.map((p, idx) => {
                    const rank = (providerPage - 1) * DEFAULT_PROVIDER_LIMIT + idx + 1;
                    return (
                      <Card key={p.rucProveedor} style={styles.providerCard}>
                        <View style={styles.providerHeader}>
                          <View style={styles.rankBadge}>
                            <Text style={styles.rankText}>#{rank}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Body style={{ fontWeight: '600' }} numberOfLines={2}>
                              {p.razonSocialProveedor}
                            </Body>
                            <Caption color={theme.color.text.muted}>RUC {p.rucProveedor}</Caption>
                          </View>
                        </View>
                        <View style={styles.providerRow}>
                          <View style={styles.providerCol}>
                            <Caption color={theme.color.text.muted}>Documentos</Caption>
                            <Body style={{ fontWeight: '600' }}>{formatInt(p.count)}</Body>
                          </View>
                          <View style={styles.providerCol}>
                            <Caption color={theme.color.text.muted}>Base + IGV</Caption>
                            <Body>
                              {formatCurrency(p.baseImponible, displayCurrency)} +{' '}
                              {formatCurrency(p.igv, displayCurrency)}
                            </Body>
                          </View>
                          <View style={styles.providerCol}>
                            <Caption color={theme.color.text.muted}>Importe total</Caption>
                            <Title size="small">
                              {formatCurrency(p.importeTotal, displayCurrency)}
                            </Title>
                          </View>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Paginación fija en el pie */}
            {providerTotal > 0 ? (
              <View style={styles.paginationBar}>
                <TouchableOpacity
                  style={[styles.pagerBtn, providerPage <= 1 && styles.pagerBtnDisabled]}
                  onPress={() => setProviderPage(1)}
                  disabled={providerPage <= 1}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="play-skip-back"
                    size={16}
                    color={providerPage <= 1 ? theme.color.text.disabled : theme.color.text.body}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pagerBtn, providerPage <= 1 && styles.pagerBtnDisabled]}
                  onPress={() => setProviderPage((p) => Math.max(1, p - 1))}
                  disabled={providerPage <= 1}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={providerPage <= 1 ? theme.color.text.disabled : theme.color.text.body}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pageIndicator}
                  onPress={openPageJump}
                  activeOpacity={0.75}
                >
                  <RNText style={styles.pageIndicatorText}>
                    Página {providerPage} de {providerTotalPages}
                  </RNText>
                  <Caption color={theme.color.text.muted}>
                    {formatInt(providerTotal)} proveedores
                  </Caption>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.pagerBtn,
                    providerPage >= providerTotalPages && styles.pagerBtnDisabled,
                  ]}
                  onPress={() => setProviderPage((p) => Math.min(providerTotalPages, p + 1))}
                  disabled={providerPage >= providerTotalPages}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={
                      providerPage >= providerTotalPages
                        ? theme.color.text.disabled
                        : theme.color.text.body
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pagerBtn,
                    providerPage >= providerTotalPages && styles.pagerBtnDisabled,
                  ]}
                  onPress={() => setProviderPage(providerTotalPages)}
                  disabled={providerPage >= providerTotalPages}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="play-skip-forward"
                    size={16}
                    color={
                      providerPage >= providerTotalPages
                        ? theme.color.text.disabled
                        : theme.color.text.body
                    }
                  />
                </TouchableOpacity>

                {fetchingProviders ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.color.brand.accent}
                    style={{ marginLeft: spacing[2] }}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </Modal>

        {/* Modal salto de página */}
        <Modal
          visible={pageJumpOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPageJumpOpen(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setPageJumpOpen(false)} />
          <View style={styles.pageJumpCard}>
            <Title size="small">Ir a la página</Title>
            <Caption color={theme.color.text.muted}>
              Ingresa un número entre 1 y {providerTotalPages}
            </Caption>
            <TextInput
              value={pageJumpValue}
              onChangeText={(v) => setPageJumpValue(v.replace(/\D/g, ''))}
              keyboardType="numeric"
              autoFocus
              placeholder={String(providerPage)}
              placeholderTextColor={theme.color.text.placeholder}
              style={styles.pageJumpInput}
              maxLength={String(providerTotalPages).length + 1}
              onSubmitEditing={confirmPageJump}
              returnKeyType="go"
            />
            <View style={styles.pageJumpActions}>
              <Button
                title="Cancelar"
                variant="secondary"
                size="small"
                onPress={() => setPageJumpOpen(false)}
              />
              <Button title="Ir" variant="primary" size="small" onPress={confirmPageJump} />
            </View>
          </View>
        </Modal>

        {/* Custom date range picker */}
        <DateRangePicker
          visible={showDateRangePicker}
          startDate={customStartDate}
          endDate={customEndDate}
          onConfirm={(s, e) => {
            setCustomStartDate(s);
            setCustomEndDate(e);
            setSelectedFilter('custom');
            setShowDateRangePicker(false);
          }}
          onCancel={() => setShowDateRangePicker(false)}
          title="Seleccionar rango de fechas"
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.brand.headerFrom,
    },
    // ===== Header pattern (dashboard global) =====
    headerGradient: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[5],
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitleContainer: {
      flex: 1,
    },
    headerIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing[1],
    },
    headerIconContainer: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing[3],
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
      letterSpacing: 0.3,
    },
    subtitle: {
      fontSize: 13,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      marginLeft: 48,
    },
    headerAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: theme.color.brand.headerBadge,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      marginLeft: spacing[3],
    },
    headerActionText: {
      fontSize: 12,
      color: theme.color.brand.onHeader,
      fontWeight: '600',
    },
    // ===== Content =====
    scrollView: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    contentContainer: {
      padding: spacing[4],
      paddingBottom: spacing[8],
      gap: spacing[3],
    },
    // ===== Filters =====
    filtersSection: {
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: spacing[3],
    },
    filtersLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    filtersContent: {
      paddingRight: spacing[4],
    },
    filterButton: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1.5,
      borderColor: theme.color.border.subtle,
      marginRight: spacing[2],
    },
    filterButtonActive: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    filterButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    filterButtonTextActive: {
      color: theme.color.text.onAction,
    },
    currencyRow: {
      gap: spacing[1],
    },
    // ===== Section header =====
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingTop: spacing[2],
    },
    // ===== KPIs =====
    loadingBox: {
      padding: spacing[5],
      alignItems: 'center',
    },
    loadingBoxSmall: {
      padding: spacing[3],
      alignItems: 'center',
    },
    kpisGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[3],
    },
    kpi: {
      flexGrow: 1,
      flexBasis: Platform.OS === 'web' ? 220 : '46%',
      padding: spacing[3],
      borderLeftWidth: 4,
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.base,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border.default,
      gap: spacing[1],
    },
    kpiIconBox: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing[1],
    },
    blockCard: {
      padding: spacing[3],
      gap: spacing[3],
    },
    blockHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    periodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    periodLabelCol: {
      width: 80,
    },
    periodBarCol: {
      flex: 1,
      height: 12,
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.surface.muted,
      overflow: 'hidden',
    },
    periodBar: {
      height: '100%',
      borderRadius: borderRadius.full,
    },
    periodValueCol: {
      minWidth: 120,
      alignItems: 'flex-end',
    },
    cpeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingVertical: spacing[1],
    },
    // ===== Monthly chart =====
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 4,
      paddingHorizontal: spacing[1],
    },
    chartCol: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing[1],
    },
    chartBarTrack: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    chartBar: {
      width: '78%',
      borderTopLeftRadius: borderRadius.sm,
      borderTopRightRadius: borderRadius.sm,
      minHeight: 2,
    },
    chartBarValue: {
      fontSize: 9,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    chartBarLabel: {
      fontSize: 11,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    chartBarLabelActive: {
      color: theme.color.brand.accent,
      fontWeight: '700',
    },
    monthlyTable: {
      gap: spacing[1],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
      paddingTop: spacing[3],
    },
    monthlyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing[1],
      gap: spacing[3],
    },
    monthlyLabelCol: {
      flex: 1,
    },
    // ===== Modal =====
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.color.overlay.medium,
    },
    modalSheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      maxHeight: '92%',
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingTop: spacing[3],
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingBottom: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.default,
    },
    closeBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.md,
    },
    modalControls: {
      padding: spacing[4],
      gap: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.default,
    },
    modalListContent: {
      padding: spacing[4],
      paddingBottom: spacing[5],
      gap: spacing[3],
    },
    // ===== Sticky pagination =====
    paginationBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    pagerBtn: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pagerBtnDisabled: {
      opacity: 0.4,
    },
    pageIndicator: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing[1],
      paddingHorizontal: spacing[2],
      borderRadius: borderRadius.md,
      backgroundColor: `${theme.color.brand.accent}11`,
      borderWidth: 1,
      borderColor: `${theme.color.brand.accent}33`,
    },
    pageIndicatorText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    // ===== Page jump modal =====
    pageJumpCard: {
      position: 'absolute',
      top: '30%',
      left: spacing[5],
      right: spacing[5],
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[4],
      gap: spacing[3],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    pageJumpInput: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
      color: theme.color.text.body,
      backgroundColor: theme.color.surface.muted,
    },
    pageJumpActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    // ===== Provider cards =====
    providerCard: {
      padding: spacing[3],
      gap: spacing[2],
    },
    providerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    rankBadge: {
      minWidth: 36,
      height: 28,
      paddingHorizontal: spacing[2],
      borderRadius: borderRadius.full,
      backgroundColor: `${theme.color.brand.accent}22`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      color: theme.color.brand.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    providerRow: {
      flexDirection: 'row',
      gap: spacing[2],
      paddingTop: spacing[1],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
    },
    providerCol: {
      flex: 1,
    },
  });
