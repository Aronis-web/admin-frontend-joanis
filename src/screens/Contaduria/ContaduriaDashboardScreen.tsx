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
  Pagination,
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
  { label: 'PEN', value: 'PEN' },
  { label: 'USD', value: 'USD' },
  { label: 'Todas', value: 'ALL' },
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
  const [moneda, setMoneda] = useState<string>('PEN');

  const dateRange = useMemo(
    () => getDateRange(selectedFilter, customStartDate, customEndDate),
    [selectedFilter, customStartDate, customEndDate]
  );

  const summaryParams = useMemo<GetSireInvoicesSummaryParams>(() => {
    const p: GetSireInvoicesSummaryParams = {
      fechaFrom: dateRange.fechaFrom,
      fechaTo: dateRange.fechaTo,
    };
    if (moneda && moneda !== 'ALL') p.moneda = moneda;
    return p;
  }, [dateRange.fechaFrom, dateRange.fechaTo, moneda]);

  const yearParams = useMemo<GetSireInvoicesSummaryParams>(() => {
    const y = yearRange();
    const p: GetSireInvoicesSummaryParams = { fechaFrom: y.fechaFrom, fechaTo: y.fechaTo };
    if (moneda && moneda !== 'ALL') p.moneda = moneda;
    return p;
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

  const displayCurrency = moneda !== 'ALL' ? moneda : 'PEN';

  // ============ Provider modal ============
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [providerPage, setProviderPage] = useState(1);
  const [providerSortBy, setProviderSortBy] = useState<SireProviderSortBy>('importeTotal');
  const [providerSearch, setProviderSearch] = useState('');

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

  const handleRefresh = useCallback(() => {
    void refetchSummary();
    void refetchYear();
  }, [refetchSummary, refetchYear]);

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

  // ============ Distribution row ============
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

  const yearTotals = yearSummary?.totals;

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
          style={styles.content}
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
                onChange={(sel) => setMoneda(sel[0] || 'PEN')}
                variant="filled"
                size="small"
              />
            </View>
          </View>

          {/* Resumen anual (siempre año en curso) */}
          <Card style={styles.blockCard}>
            <View style={styles.blockHeader}>
              <Ionicons name="calendar-outline" size={18} color={theme.color.text.body} />
              <View style={{ flex: 1 }}>
                <Title size="small">Resumen del año {new Date().getFullYear()}</Title>
                <Caption color={theme.color.text.muted}>
                  Acumulado enero – diciembre en moneda {displayCurrency}
                </Caption>
              </View>
            </View>
            {loadingYear ? (
              <View style={styles.loadingBoxSmall}>
                <ActivityIndicator size="small" color={theme.color.brand.accent} />
              </View>
            ) : yearTotals ? (
              <View style={styles.kpisGrid}>
                {renderKpi(
                  'document-text-outline',
                  'Comprobantes',
                  formatInt(yearTotals.count),
                  '#3B82F6'
                )}
                {renderKpi(
                  'cash-outline',
                  'Base',
                  formatCurrency(yearTotals.baseImponible, displayCurrency),
                  '#10B981'
                )}
                {renderKpi(
                  'calculator-outline',
                  'IGV',
                  formatCurrency(yearTotals.igv, displayCurrency),
                  '#F59E0B'
                )}
                {renderKpi(
                  'wallet-outline',
                  'Importe total',
                  formatCurrency(yearTotals.importeTotal, displayCurrency),
                  '#8B5CF6'
                )}
              </View>
            ) : (
              <Caption color={theme.color.text.muted}>Sin datos en el año.</Caption>
            )}
          </Card>

          {/* Sección Compras — del período seleccionado */}
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Title size="small">Compras del período</Title>
              <Caption color={theme.color.text.muted}>{getFilterLabel(selectedFilter)}</Caption>
            </View>
            <Button
              title="Detalle por proveedor"
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
          ) : !totals ? (
            <EmptyState
              icon="cube-outline"
              title="Sin datos"
              description="No hay comprobantes para los filtros seleccionados."
            />
          ) : (
            <>
              <View style={styles.kpisGrid}>
                {renderKpi(
                  'document-text-outline',
                  'Comprobantes',
                  formatInt(totals.count),
                  '#3B82F6',
                  moneda !== 'ALL' ? `Moneda ${moneda}` : 'Todas las monedas'
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

              {summary && summary.byCurrency.length > 1 ? (
                <Card style={styles.blockCard}>
                  <View style={styles.blockHeader}>
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={18}
                      color={theme.color.text.body}
                    />
                    <Title size="small">Por moneda</Title>
                  </View>
                  <View style={{ gap: spacing[2] }}>
                    {summary.byCurrency.map((c) => (
                      <View key={c.moneda} style={styles.cpeRow}>
                        <View style={{ flex: 1 }}>
                          <Body style={{ fontWeight: '600' }}>{c.moneda}</Body>
                          <Caption color={theme.color.text.muted}>
                            {formatInt(c.count)} docs · Base{' '}
                            {formatCurrency(c.baseImponible, c.moneda)}
                          </Caption>
                        </View>
                        <Body style={{ fontWeight: '600' }}>
                          {formatCurrency(c.importeTotal, c.moneda)}
                        </Body>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}
            </>
          )}
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

            <ScrollView contentContainerStyle={styles.modalListContent}>
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

              {providerTotal > DEFAULT_PROVIDER_LIMIT ? (
                <Pagination
                  currentPage={providerPage}
                  totalPages={providerTotalPages}
                  totalItems={providerTotal}
                  itemsPerPage={DEFAULT_PROVIDER_LIMIT}
                  onPageChange={(p) => setProviderPage(p)}
                  loading={fetchingProviders}
                  variant="compact"
                />
              ) : null}
            </ScrollView>
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
    content: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
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
      paddingBottom: spacing[8],
      gap: spacing[3],
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
