import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { DateRangePicker } from '@/components/DateRangePicker';
import { SireSyncModal, type SireSyncApi } from '@/components/SireSync';
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
import { spacing, borderRadius } from '@/design-system/tokens';
import { useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { useSireVentasInvoices, sireVentasKeys } from '@/hooks/api/useSireVentas';
import { sireVentasApi } from '@/services/api';
import type {
  GetSireVentasInvoicesParams,
  SireVentasConciliation,
  SireVentasInvoiceListItem,
  SireVentasInvoiceSortBy,
  SireVentasSortDir,
} from '@/types/sireVentas';
import { formatDateToString } from '@/utils/dateHelpers';
import {
  AVAILABLE_QUICK_FILTERS,
  getDateRangeByFilter,
  QUICK_DATE_FILTERS,
  type QuickDateFilter,
} from '@/utils/dateFilters';

type Props = NativeStackScreenProps<any, 'SireVentas'>;

const DEFAULT_LIMIT = 20;

// Tabla 10 SUNAT (subset típico de ventas)
const CPE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Factura (01)', value: '01' },
  { label: 'Boleta (03)', value: '03' },
  { label: 'N. Crédito (07)', value: '07' },
  { label: 'N. Débito (08)', value: '08' },
];

const CPE_LABELS: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta',
  '07': 'N. Crédito',
  '08': 'N. Débito',
};

const CONCILIATION_OPTIONS: Array<{ label: string; value: SireVentasConciliation }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Conciliados', value: 'linked' },
  { label: 'Pendientes', value: 'unlinked' },
];

const ATTACHMENTS_OPTIONS: Array<{ label: string; value: 'ALL' | 'YES' | 'NO' }> = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Con adjuntos', value: 'YES' },
  { label: 'Sin adjuntos', value: 'NO' },
];

const SORT_OPTIONS: Array<{ label: string; value: SireVentasInvoiceSortBy }> = [
  { label: 'Emisión', value: 'fechaEmision' },
  { label: 'Importe', value: 'importeTotal' },
  { label: 'Cliente', value: 'razonSocialCliente' },
  { label: 'Período', value: 'perTributario' },
];

// Filtros rápidos de fecha (misma UX que los demás módulos) + rango personalizado.
const DATE_FILTER_OPTIONS: Array<{ label: string; value: string }> = [
  ...AVAILABLE_QUICK_FILTERS.map((f) => ({ label: `${f.icon} ${f.label}`, value: f.key })),
  { label: '🎯 Personalizar', value: QUICK_DATE_FILTERS.CUSTOM },
];

const CONCILIATION_COLORS: Record<string, string> = {
  linked: '#10B981',
  partial: '#F59E0B',
  unlinked: '#EF4444',
};

const CONCILIATION_LABELS: Record<string, string> = {
  linked: 'Conciliada',
  partial: 'Parcial',
  unlinked: 'Pendiente',
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

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatPeriodo = (per?: string) => {
  if (!per || per.length !== 6) return per ?? '-';
  return `${per.slice(0, 4)}-${per.slice(4, 6)}`;
};

const formatSerieNumero = (item: SireVentasInvoiceListItem) => {
  const base = `${item.serie}-${item.numero}`;
  if (item.numeroFinal && item.numeroFinal !== item.numero) {
    return `${base} → ${item.numeroFinal}`;
  }
  return base;
};

export const SireVentasScreen: React.FC<Props> = ({ navigation: _navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();

  // ============ Estado de filtros ============
  const [search, setSearch] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [tipoCpe, setTipoCpe] = useState<string>('ALL');
  const [conciliation, setConciliation] = useState<SireVentasConciliation>('all');
  const [attachmentsFilter, setAttachmentsFilter] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [numDocCliente, setNumDocCliente] = useState('');
  const [fechaFrom, setFechaFrom] = useState('');
  const [fechaTo, setFechaTo] = useState('');
  const [montoMin, setMontoMin] = useState('');
  const [montoMax, setMontoMax] = useState('');
  const [sortBy, setSortBy] = useState<SireVentasInvoiceSortBy>('fechaEmision');
  const [sortDir, setSortDir] = useState<SireVentasSortDir>('DESC');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDateRange, setShowDateRange] = useState(false);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<QuickDateFilter | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const [page, setPage] = useState(1);
  const limit = DEFAULT_LIMIT;

  const debouncedSearch = useDebounce(search.trim(), 400);
  const debouncedDoc = useDebounce(numDocCliente.trim(), 400);

  // ============ Query params ============
  const params: GetSireVentasInvoicesParams = useMemo(() => {
    const p: GetSireVentasInvoicesParams = {
      limit,
      offset: (page - 1) * limit,
      sortBy,
      sortDir,
    };
    if (debouncedSearch) p.search = debouncedSearch;
    if (periodo && /^\d{6}$/.test(periodo)) p.periodo = periodo;
    if (tipoCpe && tipoCpe !== 'ALL') p.tipoCpe = tipoCpe;
    if (conciliation !== 'all') p.conciliation = conciliation;
    if (attachmentsFilter === 'YES') p.hasAttachments = true;
    if (attachmentsFilter === 'NO') p.hasAttachments = false;
    if (debouncedDoc) p.numDocCliente = debouncedDoc;
    if (fechaFrom) p.fechaFrom = fechaFrom;
    if (fechaTo) p.fechaTo = fechaTo;
    const min = Number(montoMin);
    const max = Number(montoMax);
    if (montoMin && !Number.isNaN(min)) p.montoMin = min;
    if (montoMax && !Number.isNaN(max)) p.montoMax = max;
    return p;
  }, [
    attachmentsFilter,
    conciliation,
    debouncedDoc,
    debouncedSearch,
    fechaFrom,
    fechaTo,
    limit,
    montoMax,
    montoMin,
    page,
    periodo,
    sortBy,
    sortDir,
    tipoCpe,
  ]);

  const { data, isLoading, isFetching, refetch, isError, error } = useSireVentasInvoices(params);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const activeFiltersCount = useMemo(() => {
    return [
      !!debouncedSearch,
      !!periodo,
      tipoCpe !== 'ALL',
      conciliation !== 'all',
      attachmentsFilter !== 'ALL',
      !!debouncedDoc,
      !!fechaFrom,
      !!fechaTo,
      !!montoMin,
      !!montoMax,
    ].filter(Boolean).length;
  }, [
    attachmentsFilter,
    conciliation,
    debouncedDoc,
    debouncedSearch,
    fechaFrom,
    fechaTo,
    montoMax,
    montoMin,
    periodo,
    tipoCpe,
  ]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setPeriodo('');
    setTipoCpe('ALL');
    setConciliation('all');
    setAttachmentsFilter('ALL');
    setNumDocCliente('');
    setFechaFrom('');
    setFechaTo('');
    setSelectedQuickFilter(null);
    setMontoMin('');
    setMontoMax('');
    setPage(1);
  }, []);

  const handleQuickDateFilter = useCallback((key?: QuickDateFilter) => {
    if (!key) {
      setSelectedQuickFilter(null);
      setFechaFrom('');
      setFechaTo('');
      setPage(1);
      return;
    }
    if (key === QUICK_DATE_FILTERS.CUSTOM) {
      setSelectedQuickFilter(QUICK_DATE_FILTERS.CUSTOM);
      setShowDateRange(true);
      return;
    }
    const range = getDateRangeByFilter(key);
    if (range) {
      setFechaFrom(range.fromDate);
      setFechaTo(range.toDate);
    }
    setSelectedQuickFilter(key);
    setPage(1);
  }, []);

  const handleRefresh = useCallback(() => {
    setPage(1);
    void refetch();
  }, [refetch]);

  const handleRunsChanged = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: sireVentasKeys.invoices() });
  }, [queryClient]);

  const toggleSortDir = useCallback(() => {
    setSortDir((d) => (d === 'ASC' ? 'DESC' : 'ASC'));
  }, []);

  const renderItem = (item: SireVentasInvoiceListItem) => {
    const conciliationColor = CONCILIATION_COLORS[item.conciliation] || theme.color.text.muted;
    const conciliationLabel = CONCILIATION_LABELS[item.conciliation] || item.conciliation;
    const cpeLabel = CPE_LABELS[item.tipoCpe] || item.tipoCpe;

    return (
      <Card key={item.id} style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <View style={{ flex: 1 }}>
            <Title size="small" numberOfLines={1}>
              {item.razonSocialCliente || '(Sin razón social)'}
            </Title>
            <Caption color={theme.color.text.muted}>Doc. {item.numDocCliente || '-'}</Caption>
          </View>
          <View
            style={[
              styles.conciliationPill,
              { backgroundColor: `${conciliationColor}20`, borderColor: conciliationColor },
            ]}
          >
            <Text style={{ color: conciliationColor, fontSize: 11, fontWeight: '600' }}>
              {conciliationLabel}
            </Text>
          </View>
        </View>

        <View style={styles.itemRow}>
          <View style={styles.itemCol}>
            <Caption color={theme.color.text.muted}>Comprobante</Caption>
            <Body style={{ fontWeight: '600' }}>
              {cpeLabel} · {formatSerieNumero(item)}
            </Body>
          </View>
          <View style={styles.itemCol}>
            <Caption color={theme.color.text.muted}>Período / Emisión</Caption>
            <Body style={{ fontWeight: '600' }}>
              {formatPeriodo(item.perTributario)} · {formatDate(item.fechaEmision)}
            </Body>
          </View>
        </View>

        <View style={styles.itemRow}>
          <View style={styles.itemCol}>
            <Caption color={theme.color.text.muted}>Base + IGV</Caption>
            <Body>
              {formatCurrency(item.baseImponible, item.moneda)} +{' '}
              {formatCurrency(item.igv, item.moneda)}
            </Body>
          </View>
          <View style={styles.itemCol}>
            <Caption color={theme.color.text.muted}>Importe total</Caption>
            <Title size="small">{formatCurrency(item.importeTotal, item.moneda)}</Title>
          </View>
        </View>

        <View style={styles.itemFooter}>
          <View style={styles.footerBadge}>
            <Ionicons name="link-outline" size={14} color={theme.color.text.muted} />
            <Caption color={theme.color.text.muted}>
              {item.linksCount} venta{item.linksCount === 1 ? '' : 's'} anexada
              {item.linksCount === 1 ? '' : 's'}
            </Caption>
          </View>
          <View style={styles.footerBadge}>
            <Ionicons name="attach-outline" size={14} color={theme.color.text.muted} />
            <Caption color={theme.color.text.muted}>
              {item.attachmentsCount} adjunto{item.attachmentsCount === 1 ? '' : 's'}
            </Caption>
          </View>
          {item.conciliation === 'linked' ? (
            <Caption color="#10B981">
              Asignado {formatCurrency(item.allocatedTotal, item.moneda)}
            </Caption>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <ScreenLayout navigation={_navigation as any}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
                  <Ionicons name="sync" size={22} color={theme.color.brand.onHeader} />
                </View>
                <Text style={styles.headerTitle}>Registro Ventas · Conciliación</Text>
              </View>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Propuesta SUNAT (RVIE) para conciliar con tus ventas internas
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowSyncModal(true)}
              style={styles.headerAction}
              activeOpacity={0.8}
            >
              <Ionicons name="sync-outline" size={16} color={theme.color.brand.onHeader} />
              <Text style={styles.headerActionText}>Sincronizar</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={handleRefresh} />
          }
        >
          {/* Búsqueda + toggle filtros */}
          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="Buscar por cliente, documento, serie o número"
                value={search}
                onChangeText={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                leftIcon="search-outline"
                size="medium"
              />
            </View>
            <TouchableOpacity
              style={[styles.filterToggle, showAdvanced && styles.filterToggleActive]}
              onPress={() => setShowAdvanced((s) => !s)}
            >
              <Ionicons
                name="options-outline"
                size={20}
                color={showAdvanced ? theme.color.brand.accent : theme.color.text.body}
              />
              {activeFiltersCount > 0 ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>

          {/* Chips rápidos */}
          <View style={styles.chipsSection}>
            <Caption color={theme.color.text.muted}>Estado conciliación</Caption>
            <ChipGroup
              options={CONCILIATION_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              selected={[conciliation]}
              onChange={(sel) => {
                const v = (sel[0] as SireVentasConciliation) || 'all';
                setConciliation(v);
                setPage(1);
              }}
              variant="filled"
              size="small"
            />
          </View>

          <View style={styles.chipsSection}>
            <Caption color={theme.color.text.muted}>Tipo comprobante</Caption>
            <ChipGroup
              options={CPE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              selected={[tipoCpe]}
              onChange={(sel) => {
                setTipoCpe(sel[0] || 'ALL');
                setPage(1);
              }}
              variant="filled"
              size="small"
            />
          </View>

          {/* Rango de fechas (emisión) con filtros rápidos */}
          <View style={styles.chipsSection}>
            <View style={styles.dateFilterHeader}>
              <Caption color={theme.color.text.muted}>Fecha de emisión</Caption>
              {fechaFrom || fechaTo ? (
                <TouchableOpacity onPress={() => handleQuickDateFilter(undefined)}>
                  <Caption color={theme.color.brand.accent}>Quitar</Caption>
                </TouchableOpacity>
              ) : null}
            </View>
            <ChipGroup
              options={DATE_FILTER_OPTIONS}
              selected={selectedQuickFilter ? [selectedQuickFilter] : []}
              onChange={(sel) => handleQuickDateFilter(sel[0] as QuickDateFilter | undefined)}
              variant="filled"
              size="small"
            />
            {fechaFrom || fechaTo ? (
              <Caption color={theme.color.text.body}>
                {formatDate(fechaFrom)} → {formatDate(fechaTo)}
              </Caption>
            ) : null}
          </View>

          {/* Filtros avanzados */}
          {showAdvanced ? (
            <Card style={styles.advancedCard}>
              <View style={styles.row}>
                <View style={styles.field}>
                  <Input
                    label="Período (AAAAMM)"
                    placeholder="202607"
                    keyboardType="numeric"
                    maxLength={6}
                    value={periodo}
                    onChangeText={(v) => {
                      setPeriodo(v.replace(/\D/g, ''));
                      setPage(1);
                    }}
                  />
                </View>
                <View style={styles.field}>
                  <Input
                    label="Doc. cliente"
                    placeholder="20512345678"
                    keyboardType="numeric"
                    maxLength={15}
                    value={numDocCliente}
                    onChangeText={(v) => {
                      setNumDocCliente(v.replace(/\D/g, ''));
                      setPage(1);
                    }}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.field}>
                  <Input
                    label="Monto mínimo"
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={montoMin}
                    onChangeText={(v) => {
                      setMontoMin(v);
                      setPage(1);
                    }}
                  />
                </View>
                <View style={styles.field}>
                  <Input
                    label="Monto máximo"
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={montoMax}
                    onChangeText={(v) => {
                      setMontoMax(v);
                      setPage(1);
                    }}
                  />
                </View>
              </View>

              <View style={styles.chipsSection}>
                <Caption color={theme.color.text.muted}>Adjuntos</Caption>
                <ChipGroup
                  options={ATTACHMENTS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
                  selected={[attachmentsFilter]}
                  onChange={(sel) => {
                    setAttachmentsFilter((sel[0] as 'ALL' | 'YES' | 'NO') || 'ALL');
                    setPage(1);
                  }}
                  variant="filled"
                  size="small"
                />
              </View>

              <View style={styles.chipsSection}>
                <Caption color={theme.color.text.muted}>Ordenar por</Caption>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                  <View style={{ flex: 1 }}>
                    <ChipGroup
                      options={SORT_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
                      selected={[sortBy]}
                      onChange={(sel) => {
                        setSortBy((sel[0] as SireVentasInvoiceSortBy) || 'fechaEmision');
                      }}
                      variant="filled"
                      size="small"
                    />
                  </View>
                  <TouchableOpacity style={styles.sortDirBtn} onPress={toggleSortDir}>
                    <Ionicons
                      name={sortDir === 'ASC' ? 'arrow-up' : 'arrow-down'}
                      size={16}
                      color={theme.color.text.body}
                    />
                    <Text style={{ marginLeft: 4, fontSize: 12 }}>{sortDir}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.advancedFooter}>
                <Button
                  title="Limpiar filtros"
                  onPress={handleClearFilters}
                  variant="ghost"
                  size="small"
                />
              </View>
            </Card>
          ) : null}

          {/* Resumen */}
          <View style={styles.summaryRow}>
            <Caption color={theme.color.text.muted}>
              {isLoading ? 'Cargando…' : `${total} comprobante${total === 1 ? '' : 's'}`}
            </Caption>
            {activeFiltersCount > 0 ? (
              <TouchableOpacity onPress={handleClearFilters}>
                <Caption color={theme.color.brand.accent}>Limpiar filtros</Caption>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Lista */}
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={theme.color.brand.accent} />
            </View>
          ) : isError ? (
            <ErrorState
              title="No se pudieron cargar los comprobantes"
              description={(error as Error)?.message || 'Intenta nuevamente'}
              onRetry={() => refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title="Sin comprobantes"
              description={
                activeFiltersCount > 0
                  ? 'No hay resultados para los filtros aplicados.'
                  : 'Aún no hay comprobantes descargados de SUNAT para conciliar.'
              }
            />
          ) : (
            <View style={styles.list}>{items.map(renderItem)}</View>
          )}

          {/* Paginación */}
          {total > limit ? (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={limit}
              onPageChange={(p) => setPage(p)}
              loading={isFetching}
              variant="full"
            />
          ) : null}
        </ScrollView>

        <DateRangePicker
          visible={showDateRange}
          startDate={fechaFrom ? new Date(`${fechaFrom}T12:00:00`) : new Date()}
          endDate={fechaTo ? new Date(`${fechaTo}T12:00:00`) : new Date()}
          maximumDate={new Date()}
          onConfirm={(start, end) => {
            setFechaFrom(formatDateToString(start));
            setFechaTo(formatDateToString(end));
            setSelectedQuickFilter(QUICK_DATE_FILTERS.CUSTOM);
            setShowDateRange(false);
            setPage(1);
          }}
          onCancel={() => setShowDateRange(false)}
          title="Rango de fechas de emisión"
        />

        <SireSyncModal
          visible={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          api={sireVentasApi as unknown as SireSyncApi}
          title="Sincronizar Ventas · RVIE"
          onRunsChanged={handleRunsChanged}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
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
    scrollContent: {
      padding: spacing[4],
      paddingBottom: spacing[8],
      gap: spacing[3],
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    filterToggle: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.surface.base,
    },
    filterToggleActive: {
      borderColor: theme.color.brand.accent,
      backgroundColor: `${theme.color.brand.accent}10`,
    },
    filterBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '700',
    },
    chipsSection: {
      gap: spacing[1],
    },
    dateFilterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    advancedCard: {
      padding: spacing[3],
      gap: spacing[3],
    },
    row: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    field: {
      flex: 1,
      gap: spacing[1],
    },
    sortDirBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    advancedFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    loadingBox: {
      padding: spacing[5],
      alignItems: 'center',
    },
    list: {
      gap: spacing[3],
    },
    itemCard: {
      padding: spacing[3],
      gap: spacing[2],
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
    },
    conciliationPill: {
      paddingHorizontal: spacing[2],
      paddingVertical: 4,
      borderRadius: borderRadius.full,
      borderWidth: 1,
    },
    itemRow: {
      flexDirection: 'row',
      gap: spacing[3],
    },
    itemCol: {
      flex: 1,
    },
    itemFooter: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing[3],
      paddingTop: spacing[1],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
    },
    footerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
  });
