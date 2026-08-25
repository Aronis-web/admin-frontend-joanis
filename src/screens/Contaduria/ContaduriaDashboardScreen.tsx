import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
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

const currentYearMonth = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
};

const yearMonthMinus = (months: number): string => {
  const now = new Date();
  now.setDate(1);
  now.setMonth(now.getMonth() - months);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
};

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

export const ContaduriaDashboardScreen: React.FC<Props> = ({ navigation: _navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  // ============ Filtros globales ============
  const [periodoFrom, setPeriodoFrom] = useState(yearMonthMinus(5));
  const [periodoTo, setPeriodoTo] = useState(currentYearMonth());
  const [moneda, setMoneda] = useState<string>('PEN');

  const summaryParams = useMemo<GetSireInvoicesSummaryParams>(() => {
    const p: GetSireInvoicesSummaryParams = {};
    if (/^\d{6}$/.test(periodoFrom)) p.periodoFrom = periodoFrom;
    if (/^\d{6}$/.test(periodoTo)) p.periodoTo = periodoTo;
    if (moneda && moneda !== 'ALL') p.moneda = moneda;
    return p;
  }, [moneda, periodoFrom, periodoTo]);

  const {
    data: summary,
    isLoading: loadingSummary,
    isFetching: fetchingSummary,
    isError: summaryError,
    error: summaryErrorObj,
    refetch: refetchSummary,
  } = useSireInvoicesSummary(summaryParams);

  const displayCurrency = moneda !== 'ALL' ? moneda : 'PEN';

  // ============ Provider modal ============
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [providerPage, setProviderPage] = useState(1);
  const [providerSortBy, setProviderSortBy] = useState<SireProviderSortBy>('importeTotal');
  const [providerSearch, setProviderSearch] = useState('');

  const providerParams = useMemo(() => {
    return {
      ...summaryParams,
      sortBy: providerSortBy,
      sortDir: 'DESC' as const,
      limit: DEFAULT_PROVIDER_LIMIT,
      offset: (providerPage - 1) * DEFAULT_PROVIDER_LIMIT,
    };
  }, [providerPage, providerSortBy, summaryParams]);

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
  }, [refetchSummary]);

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScreenLayout navigation={_navigation as any}>
        <View style={styles.header}>
          <Title>Dashboard Contaduría</Title>
          <Caption color={theme.color.text.muted}>
            Vista consolidada de compras declaradas por SUNAT (RCE)
          </Caption>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={fetchingSummary && !loadingSummary}
              onRefresh={handleRefresh}
            />
          }
        >
          {/* Filtros */}
          <Card style={styles.filtersCard}>
            <View style={styles.filtersRow}>
              <View style={styles.field}>
                <Input
                  label="Período desde (AAAAMM)"
                  placeholder="202601"
                  keyboardType="numeric"
                  maxLength={6}
                  value={periodoFrom}
                  onChangeText={(v) => setPeriodoFrom(v.replace(/\D/g, ''))}
                />
              </View>
              <View style={styles.field}>
                <Input
                  label="Período hasta (AAAAMM)"
                  placeholder="202608"
                  keyboardType="numeric"
                  maxLength={6}
                  value={periodoTo}
                  onChangeText={(v) => setPeriodoTo(v.replace(/\D/g, ''))}
                />
              </View>
            </View>
            <View style={styles.chipsSection}>
              <Caption color={theme.color.text.muted}>Moneda</Caption>
              <ChipGroup
                options={MONEDA_OPTIONS}
                selected={[moneda]}
                onChange={(sel) => setMoneda(sel[0] || 'PEN')}
                variant="filled"
                size="small"
              />
            </View>
          </Card>

          {/* Sección Compras */}
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Title size="small">Compras declaradas por SUNAT</Title>
              <Caption color={theme.color.text.muted}>
                Propuesta RCE del período seleccionado
              </Caption>
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
              {/* KPIs */}
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

              {/* By periodo */}
              {summary?.byPeriodo?.length ? (
                <Card style={styles.blockCard}>
                  <View style={styles.blockHeader}>
                    <Ionicons name="bar-chart-outline" size={18} color={theme.color.text.body} />
                    <Title size="small">Compras por período</Title>
                  </View>
                  <View style={{ gap: spacing[2] }}>{summary.byPeriodo.map(renderPeriodoRow)}</View>
                </Card>
              ) : null}

              {/* By tipoCpe */}
              {summary?.byTipoCpe?.length ? (
                <Card style={styles.blockCard}>
                  <View style={styles.blockHeader}>
                    <Ionicons name="pricetags-outline" size={18} color={theme.color.text.body} />
                    <Title size="small">Por tipo de comprobante</Title>
                  </View>
                  <View style={{ gap: spacing[2] }}>{summary.byTipoCpe.map(renderCpeRow)}</View>
                </Card>
              ) : null}

              {/* By currency (solo si hay más de una) */}
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
                  {periodoFrom && periodoTo
                    ? `${formatPeriodo(periodoFrom)} → ${formatPeriodo(periodoTo)}`
                    : 'Todos los períodos'}
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
              <View style={styles.chipsSection}>
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
      </ScreenLayout>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.color.background.canvas,
    },
    header: {
      paddingHorizontal: spacing[4],
      paddingTop: spacing[3],
      paddingBottom: spacing[2],
    },
    scrollContent: {
      padding: spacing[4],
      paddingBottom: spacing[8],
      gap: spacing[3],
    },
    filtersCard: {
      padding: spacing[3],
      gap: spacing[3],
    },
    filtersRow: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    field: {
      flex: 1,
      gap: spacing[1],
    },
    chipsSection: {
      gap: spacing[1],
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingTop: spacing[2],
    },
    loadingBox: {
      padding: spacing[5],
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
    // Modal
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
