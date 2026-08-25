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
  Heading,
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

const CURRENCIES: Array<'PEN' | 'USD'> = ['PEN', 'USD'];

const CURRENCY_LABELS: Record<'PEN' | 'USD', string> = {
  PEN: 'Soles (PEN)',
  USD: 'Dólares (USD)',
};

const CURRENCY_ACCENTS: Record<'PEN' | 'USD', string> = {
  PEN: '#10B981',
  USD: '#3B82F6',
};

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

  const dateRange = useMemo(
    () => getDateRange(selectedFilter, customStartDate, customEndDate),
    [selectedFilter, customStartDate, customEndDate]
  );

  // No enviamos `moneda` a los endpoints: el backend siempre retorna PEN y USD
  // en bloques separados. La moneda seleccionada solo se usa para el render.
  const summaryParams = useMemo<GetSireInvoicesSummaryParams>(
    () => ({
      fechaFrom: dateRange.fechaFrom,
      fechaTo: dateRange.fechaTo,
    }),
    [dateRange.fechaFrom, dateRange.fechaTo]
  );

  const yearParams = useMemo<GetSireInvoicesSummaryParams>(() => {
    const y = yearRange();
    return { fechaFrom: y.fechaFrom, fechaTo: y.fechaTo };
  }, []);

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

  // Monedas con datos en el período seleccionado
  const visibleCurrencies = useMemo(
    () =>
      CURRENCIES.filter((c) => {
        const t = summary?.totals?.[c];
        return t ? t.count > 0 : false;
      }),
    [summary?.totals]
  );

  // Monedas con datos en el año en curso
  const visibleYearCurrencies = useMemo(
    () =>
      CURRENCIES.filter((c) => {
        const t = yearSummary?.totals?.[c];
        return t ? t.count > 0 : false;
      }),
    [yearSummary?.totals]
  );

  const hasSummaryData = visibleCurrencies.length > 0;

  // Índice { moneda -> filas byPeriodo } del período seleccionado
  const summaryByPeriodoByMoneda = useMemo(() => {
    const acc: Record<'PEN' | 'USD', SireSummaryByPeriodo[]> = { PEN: [], USD: [] };
    (summary?.byPeriodo ?? []).forEach((p) => {
      if (p.moneda === 'PEN' || p.moneda === 'USD') acc[p.moneda].push(p);
    });
    return acc;
  }, [summary?.byPeriodo]);

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
  const renderPeriodoRow = (item: SireSummaryByPeriodo, maxTotal: number, accent: string) => {
    const total = Number(item.importeTotal) || 0;
    const ratio = maxTotal > 0 ? Math.max(0.04, total / maxTotal) : 0;
    return (
      <View key={`${item.perTributario}-${item.moneda}`} style={styles.periodRow}>
        <View style={styles.periodLabelCol}>
          <Body style={{ fontWeight: '600' }}>{formatPeriodo(item.perTributario)}</Body>
          <Caption color={theme.color.text.muted}>{formatInt(item.count)} docs</Caption>
        </View>
        <View style={styles.periodBarCol}>
          <View style={[styles.periodBar, { width: `${ratio * 100}%`, backgroundColor: accent }]} />
        </View>
        <View style={styles.periodValueCol}>
          <Body style={{ fontWeight: '600' }}>
            {formatCurrency(item.importeTotal, item.moneda)}
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
        <Body style={{ fontWeight: '600' }}>{formatInt(item.count)}</Body>
      </View>
    );
  };

  // ============ Yearly monthly bar chart (por moneda) ============
  const currentMonthIdx = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const yearMonthlyUnified = useMemo(() => {
    // Un solo array de 12 meses con datos de PEN y USD juntos.
    const empty = { count: 0, importeTotal: 0 };
    const build = (cur: 'PEN' | 'USD') => {
      const map = new Map<string, { count: number; importeTotal: number }>();
      (yearSummary?.byPeriodo ?? [])
        .filter((p) => p.moneda === cur)
        .forEach((p) => {
          if (!p.perTributario || p.perTributario.length !== 6) return;
          map.set(p.perTributario, {
            count: p.count,
            importeTotal: Number(p.importeTotal) || 0,
          });
        });
      return map;
    };
    const penMap = build('PEN');
    const usdMap = build('USD');
    const months = Array.from({ length: 12 }, (_, i) => {
      const key = `${currentYear}${String(i + 1).padStart(2, '0')}`;
      const pen = penMap.get(key) ?? empty;
      const usd = usdMap.get(key) ?? empty;
      return {
        month: i,
        key,
        label: MONTH_LABELS[i],
        PEN: pen,
        USD: usd,
      };
    });
    const maxPen = months.reduce((max, m) => Math.max(max, m.PEN.importeTotal), 0);
    const maxUsd = months.reduce((max, m) => Math.max(max, m.USD.importeTotal), 0);
    const accPen = months.reduce((sum, m) => sum + m.PEN.importeTotal, 0);
    const accUsd = months.reduce((sum, m) => sum + m.USD.importeTotal, 0);
    const totalDocsPen = months.reduce((sum, m) => sum + m.PEN.count, 0);
    const totalDocsUsd = months.reduce((sum, m) => sum + m.USD.count, 0);
    return {
      months,
      maxPen,
      maxUsd,
      accPen,
      accUsd,
      totalDocsPen,
      totalDocsUsd,
    };
  }, [yearSummary?.byPeriodo, currentYear]);

  const renderUnifiedMonthlyChart = () => {
    const CHART_HEIGHT = 200;
    const { months, maxPen, maxUsd, accPen, accUsd, totalDocsPen, totalDocsUsd } =
      yearMonthlyUnified;
    const penAccent = CURRENCY_ACCENTS.PEN;
    const usdAccent = CURRENCY_ACCENTS.USD;
    const rows = months.filter(
      (m) => m.PEN.importeTotal > 0 || m.USD.importeTotal > 0 || m.PEN.count > 0 || m.USD.count > 0
    );
    return (
      <Card key="chart-unified" style={styles.blockCard}>
        <View style={styles.blockHeader}>
          <Ionicons name="stats-chart-outline" size={18} color={theme.color.brand.accent} />
          <View style={{ flex: 1 }}>
            <Title size="small">Compras por mes · {currentYear}</Title>
            <Caption color={theme.color.text.muted}>
              Acumulado {formatCurrency(String(accPen), 'PEN')} ·{' '}
              {formatCurrency(String(accUsd), 'USD')}
            </Caption>
          </View>
        </View>

        {/* Leyenda */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: penAccent }]} />
            <Caption color={theme.color.text.muted}>Soles (PEN)</Caption>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: usdAccent }]} />
            <Caption color={theme.color.text.muted}>Dólares (USD)</Caption>
          </View>
        </View>

        <View style={[styles.chart, { height: CHART_HEIGHT }]}>
          {months.map((m) => {
            const ratioPen = maxPen > 0 ? Math.max(0, m.PEN.importeTotal / maxPen) : 0;
            const ratioUsd = maxUsd > 0 ? Math.max(0, m.USD.importeTotal / maxUsd) : 0;
            const penHeight = Math.max(
              m.PEN.importeTotal > 0 ? 2 : 0,
              Math.round(ratioPen * (CHART_HEIGHT - 44))
            );
            const usdHeight = Math.max(
              m.USD.importeTotal > 0 ? 2 : 0,
              Math.round(ratioUsd * (CHART_HEIGHT - 44))
            );
            const isCurrent = m.month === currentMonthIdx;
            return (
              <View key={m.key} style={styles.chartCol}>
                <View style={styles.chartBarTrackGrouped}>
                  <View style={styles.chartBarPair}>
                    <View
                      style={[
                        styles.chartBarSmall,
                        {
                          height: penHeight,
                          backgroundColor: isCurrent ? penAccent : `${penAccent}AA`,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.chartBarSmall,
                        {
                          height: usdHeight,
                          backgroundColor: isCurrent ? usdAccent : `${usdAccent}AA`,
                        },
                      ]}
                    />
                  </View>
                </View>
                <RNText style={[styles.chartBarLabel, isCurrent && styles.chartBarLabelActive]}>
                  {m.label}
                </RNText>
              </View>
            );
          })}
        </View>

        {/* Tabla detalle mensual unificada */}
        <View style={styles.monthlyTable}>
          <View style={styles.monthlyHeaderRow}>
            <View style={styles.monthlyLabelCol}>
              <Caption color={theme.color.text.muted}>Mes</Caption>
            </View>
            <View style={styles.monthlyAmountCol}>
              <Caption color={theme.color.text.muted}>Soles</Caption>
            </View>
            <View style={styles.monthlyAmountCol}>
              <Caption color={theme.color.text.muted}>Dólares</Caption>
            </View>
          </View>
          {rows.length === 0 ? (
            <View style={{ paddingVertical: spacing[3] }}>
              <Caption color={theme.color.text.muted}>Sin datos para {currentYear}</Caption>
            </View>
          ) : (
            rows.map((m) => (
              <View key={`row-${m.key}`} style={styles.monthlyRow}>
                <View style={styles.monthlyLabelCol}>
                  <Body style={{ fontWeight: '600' }}>
                    {m.label} {currentYear}
                  </Body>
                  <Caption color={theme.color.text.muted}>
                    {formatInt(m.PEN.count + m.USD.count)} docs
                  </Caption>
                </View>
                <View style={styles.monthlyAmountCol}>
                  <Body
                    style={{
                      fontWeight: '600',
                      color: m.PEN.importeTotal > 0 ? penAccent : theme.color.text.muted,
                    }}
                  >
                    {m.PEN.importeTotal > 0
                      ? formatCurrency(String(m.PEN.importeTotal), 'PEN')
                      : '—'}
                  </Body>
                  {m.PEN.count > 0 ? (
                    <Caption color={theme.color.text.muted}>{formatInt(m.PEN.count)} docs</Caption>
                  ) : null}
                </View>
                <View style={styles.monthlyAmountCol}>
                  <Body
                    style={{
                      fontWeight: '600',
                      color: m.USD.importeTotal > 0 ? usdAccent : theme.color.text.muted,
                    }}
                  >
                    {m.USD.importeTotal > 0
                      ? formatCurrency(String(m.USD.importeTotal), 'USD')
                      : '—'}
                  </Body>
                  {m.USD.count > 0 ? (
                    <Caption color={theme.color.text.muted}>{formatInt(m.USD.count)} docs</Caption>
                  ) : null}
                </View>
              </View>
            ))
          )}
          {rows.length > 0 ? (
            <View style={[styles.monthlyRow, styles.monthlyTotalRow]}>
              <View style={styles.monthlyLabelCol}>
                <Body style={{ fontWeight: '700' }}>Total {currentYear}</Body>
                <Caption color={theme.color.text.muted}>
                  {formatInt(totalDocsPen + totalDocsUsd)} docs
                </Caption>
              </View>
              <View style={styles.monthlyAmountCol}>
                <Body style={{ fontWeight: '700', color: penAccent }}>
                  {formatCurrency(String(accPen), 'PEN')}
                </Body>
              </View>
              <View style={styles.monthlyAmountCol}>
                <Body style={{ fontWeight: '700', color: usdAccent }}>
                  {formatCurrency(String(accUsd), 'USD')}
                </Body>
              </View>
            </View>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        {/* Header alineado al patrón global (gradient + badge) */}
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
                  <Ionicons name="stats-chart" size={20} color={theme.color.brand.onHeader} />
                </View>
                <RNText style={styles.title}>Dashboard Contaduría</RNText>
              </View>
              <RNText style={styles.subtitle} numberOfLines={1}>
                {getFilterLabel(selectedFilter)} · Soles y Dólares
              </RNText>
            </View>
            <TouchableOpacity
              style={styles.headerAction}
              onPress={openProviderModal}
              activeOpacity={0.85}
            >
              <Ionicons name="people-outline" size={16} color={theme.color.brand.onHeader} />
              <RNText style={styles.headerActionText}>Detalle por proveedor</RNText>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={fetchingSummary} onRefresh={handleRefresh} />}
        >
          {/* Filtros globales */}
          <View style={styles.filtersSection}>
            <RNText style={styles.filtersLabel}>Filtros</RNText>
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
          </View>

          {/* Sección Compras Mapeadas Sunat — engloba KPIs, por período,
              por tipo de CPE, gráfico anual y detalle por proveedor */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderIcon}>
              <Ionicons name="shield-checkmark" size={22} color={theme.color.brand.onHeader} />
            </View>
            <View style={{ flex: 1 }}>
              <Heading size="medium">Compras Mapeadas Sunat</Heading>
              <Caption color={theme.color.text.muted}>
                Registro de compras (RCE) del período seleccionado
              </Caption>
            </View>
          </View>

          {loadingSummary ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={theme.color.brand.accent} />
            </View>
          ) : summaryError ? (
            <ErrorState
              title="No se pudo cargar el resumen"
              description={(summaryErrorObj as Error)?.message ?? 'Intenta nuevamente'}
              onRetry={() => refetchSummary()}
            />
          ) : !hasSummaryData ? (
            <EmptyState
              icon="stats-chart-outline"
              title="Sin compras"
              description="No se registran compras en el período seleccionado."
            />
          ) : (
            <>
              {visibleCurrencies.map((cur) => {
                const t = summary!.totals[cur];
                const fac = summary!.facturas?.[cur];
                const nc = summary!.notasCredito?.[cur];
                const rows = summaryByPeriodoByMoneda[cur];
                const maxTotal = rows.reduce(
                  (max, p) => Math.max(max, Number(p.importeTotal) || 0),
                  0
                );
                const accent = CURRENCY_ACCENTS[cur];
                return (
                  <View key={`cur-${cur}`} style={styles.currencyBlock}>
                    <View style={styles.currencyBlockHeader}>
                      <View style={[styles.currencyBadge, { backgroundColor: `${accent}1A` }]}>
                        <RNText style={[styles.currencyBadgeText, { color: accent }]}>
                          {cur === 'PEN' ? 'S/' : '$'}
                        </RNText>
                      </View>
                      <Title size="small">{CURRENCY_LABELS[cur]}</Title>
                    </View>

                    <View style={styles.kpisGrid}>
                      {renderKpi(
                        'document-text-outline',
                        'Comprobantes',
                        formatInt(t.count),
                        accent
                      )}
                      {renderKpi(
                        'cash-outline',
                        'Base imponible',
                        formatCurrency(t.baseImponible, cur),
                        '#10B981'
                      )}
                      {renderKpi(
                        'calculator-outline',
                        'IGV',
                        formatCurrency(t.igv, cur),
                        '#F59E0B'
                      )}
                      {renderKpi(
                        'wallet-outline',
                        'Importe neto',
                        formatCurrency(t.importeTotal, cur),
                        '#8B5CF6',
                        fac && nc
                          ? `Facturas ${formatCurrencyCompact(fac.importeTotal, cur)} − NC ${formatCurrencyCompact(nc.importeTotal, cur)}`
                          : `ISC ${formatCurrency(t.isc, cur)} · Otros ${formatCurrency(t.otros, cur)}`
                      )}
                    </View>

                    {fac || nc ? (
                      <Card style={styles.blockCard}>
                        <View style={styles.blockHeader}>
                          <Ionicons name="swap-vertical-outline" size={18} color={accent} />
                          <Title size="small">Facturas vs Notas de crédito · {cur}</Title>
                        </View>
                        <View style={styles.breakdownRow}>
                          <View style={[styles.breakdownCell, { borderLeftColor: '#10B981' }]}>
                            <View style={styles.breakdownHeader}>
                              <Ionicons name="receipt-outline" size={16} color="#10B981" />
                              <Caption color={theme.color.text.muted}>Facturas</Caption>
                            </View>
                            <Body style={{ fontWeight: '700' }}>
                              {formatCurrency(fac?.importeTotal ?? '0', cur)}
                            </Body>
                            <Caption color={theme.color.text.muted}>
                              {formatInt(fac?.count ?? 0)} docs · IGV{' '}
                              {formatCurrency(fac?.igv ?? '0', cur)}
                            </Caption>
                          </View>
                          <View style={[styles.breakdownCell, { borderLeftColor: '#EF4444' }]}>
                            <View style={styles.breakdownHeader}>
                              <Ionicons name="arrow-undo-outline" size={16} color="#EF4444" />
                              <Caption color={theme.color.text.muted}>Notas de crédito</Caption>
                            </View>
                            <Body style={{ fontWeight: '700', color: '#EF4444' }}>
                              − {formatCurrency(nc?.importeTotal ?? '0', cur)}
                            </Body>
                            <Caption color={theme.color.text.muted}>
                              {formatInt(nc?.count ?? 0)} docs · IGV{' '}
                              {formatCurrency(nc?.igv ?? '0', cur)}
                            </Caption>
                          </View>
                        </View>
                      </Card>
                    ) : null}

                    {rows.length ? (
                      <Card style={styles.blockCard}>
                        <View style={styles.blockHeader}>
                          <Ionicons name="bar-chart-outline" size={18} color={accent} />
                          <Title size="small">Compras por período · {cur}</Title>
                        </View>
                        <View style={{ gap: spacing[2] }}>
                          {rows.map((r) => renderPeriodoRow(r, maxTotal, accent))}
                        </View>
                      </Card>
                    ) : null}
                  </View>
                );
              })}

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

          {/* Gráfico anual mensual unificado (PEN + USD) */}
          {loadingYear ? (
            <View style={styles.loadingBoxSmall}>
              <ActivityIndicator size="small" color={theme.color.brand.accent} />
            </View>
          ) : visibleYearCurrencies.length ? (
            renderUnifiedMonthlyChart()
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
                  {getFilterLabel(selectedFilter)} · Soles y Dólares
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
                    const blocks = CURRENCIES.map((cur) => ({ cur, block: p[cur] })).filter(
                      (b) => b.block && b.block.count > 0
                    );
                    if (blocks.length === 0) return null;
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
                            <Caption color={theme.color.text.muted}>
                              RUC {p.rucProveedor} · {formatInt(p.count)} docs en total
                            </Caption>
                          </View>
                        </View>
                        {blocks.map(({ cur, block }) => {
                          const accent = CURRENCY_ACCENTS[cur];
                          const facP = p.facturas?.[cur];
                          const ncP = p.notasCredito?.[cur];
                          return (
                            <View key={cur} style={styles.providerCurrencyBlock}>
                              <View style={styles.providerCurrencyHeader}>
                                <View
                                  style={[styles.currencyBadge, { backgroundColor: `${accent}1A` }]}
                                >
                                  <RNText style={[styles.currencyBadgeText, { color: accent }]}>
                                    {cur === 'PEN' ? 'S/' : '$'}
                                  </RNText>
                                </View>
                                <Caption color={theme.color.text.muted}>
                                  {CURRENCY_LABELS[cur]}
                                </Caption>
                              </View>
                              <View style={styles.providerRow}>
                                <View style={styles.providerCol}>
                                  <Caption color={theme.color.text.muted}>Docs</Caption>
                                  <Body style={{ fontWeight: '600' }}>
                                    {formatInt(block!.count)}
                                  </Body>
                                </View>
                                <View style={styles.providerCol}>
                                  <Caption color={theme.color.text.muted}>Base + IGV</Caption>
                                  <Body>
                                    {formatCurrency(block!.baseImponible, cur)} +{' '}
                                    {formatCurrency(block!.igv, cur)}
                                  </Body>
                                </View>
                                <View style={styles.providerCol}>
                                  <Caption color={theme.color.text.muted}>Importe neto</Caption>
                                  <Title size="small">
                                    {formatCurrency(block!.importeTotal, cur)}
                                  </Title>
                                </View>
                              </View>
                              {facP || ncP ? (
                                <View style={styles.providerBreakdownRow}>
                                  <View style={styles.providerBreakdownCell}>
                                    <View style={styles.breakdownHeader}>
                                      <Ionicons name="receipt-outline" size={12} color="#10B981" />
                                      <Caption color={theme.color.text.muted}>Facturas</Caption>
                                    </View>
                                    <Body style={{ fontWeight: '600' }}>
                                      {formatCurrency(facP?.importeTotal ?? '0', cur)}
                                    </Body>
                                    <Caption color={theme.color.text.muted}>
                                      {formatInt(facP?.count ?? 0)} docs
                                    </Caption>
                                  </View>
                                  <View style={styles.providerBreakdownCell}>
                                    <View style={styles.breakdownHeader}>
                                      <Ionicons
                                        name="arrow-undo-outline"
                                        size={12}
                                        color="#EF4444"
                                      />
                                      <Caption color={theme.color.text.muted}>NC</Caption>
                                    </View>
                                    <Body style={{ fontWeight: '600', color: '#EF4444' }}>
                                      − {formatCurrency(ncP?.importeTotal ?? '0', cur)}
                                    </Body>
                                    <Caption color={theme.color.text.muted}>
                                      {formatInt(ncP?.count ?? 0)} docs
                                    </Caption>
                                  </View>
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
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
    scrollView: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    contentContainer: {
      padding: spacing[4],
      paddingBottom: spacing[8],
      gap: spacing[3],
    },
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
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingTop: spacing[3],
      paddingBottom: spacing[1],
      borderBottomWidth: 2,
      borderBottomColor: theme.color.brand.accent,
      marginBottom: spacing[1],
    },
    sectionHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    currencyBlock: {
      gap: spacing[3],
      marginTop: spacing[2],
    },
    currencyBlockHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    currencyBadge: {
      minWidth: 34,
      height: 26,
      paddingHorizontal: spacing[2],
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    currencyBadgeText: {
      fontSize: 12,
      fontWeight: '800',
    },
    providerCurrencyBlock: {
      gap: spacing[1],
      paddingTop: spacing[2],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
    },
    breakdownRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    breakdownCell: {
      flexGrow: 1,
      flexBasis: Platform.OS === 'web' ? 200 : '46%',
      padding: spacing[3],
      borderLeftWidth: 4,
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.muted,
      gap: spacing[1],
    },
    breakdownHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    providerBreakdownRow: {
      flexDirection: 'row',
      gap: spacing[2],
      paddingTop: spacing[1],
    },
    providerBreakdownCell: {
      flex: 1,
      padding: spacing[2],
      borderRadius: borderRadius.sm,
      backgroundColor: theme.color.surface.muted,
      gap: spacing[1],
    },
    providerCurrencyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
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
    chartBarTrackGrouped: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    chartBarPair: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 2,
      width: '100%',
      height: '100%',
    },
    chartBar: {
      width: '78%',
      borderTopLeftRadius: borderRadius.sm,
      borderTopRightRadius: borderRadius.sm,
      minHeight: 2,
    },
    chartBarSmall: {
      width: 8,
      borderTopLeftRadius: borderRadius.sm,
      borderTopRightRadius: borderRadius.sm,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[3],
      paddingBottom: spacing[2],
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    monthlyHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[3],
      paddingBottom: spacing[1],
    },
    monthlyAmountCol: {
      flex: 1,
      alignItems: 'flex-end',
    },
    monthlyTotalRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
      marginTop: spacing[1],
      paddingTop: spacing[2],
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
