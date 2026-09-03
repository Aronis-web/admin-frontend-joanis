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
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { SunatReportModal } from '@/components/SunatReport';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
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
import { useDebounce } from '@/hooks/useDebounce';
import {
  useSireComprasDeclaredInvoices,
  useSyncSireComprasDeclared,
} from '@/hooks/api/useSireComprasDeclared';
import type {
  GetSireComprasDeclaredInvoicesParams,
  SireComprasDeclaredInvoiceListItem,
} from '@/types/sireComprasDeclared';
import { formatDateToString } from '@/utils/dateHelpers';
import Alert from '@/utils/alert';

type Props = NativeStackScreenProps<any, 'SireComprasDeclared'>;

const DEFAULT_LIMIT = 50;

// Tabla 10 SUNAT (subset típico de compras)
const CPE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Factura (01)', value: '01' },
  { label: 'N. Crédito (07)', value: '07' },
  { label: 'N. Débito (08)', value: '08' },
  { label: 'Recibo Serv. Púb. (14)', value: '14' },
];

const CPE_LABELS: Record<string, string> = {
  '01': 'Factura',
  '07': 'N. Crédito',
  '08': 'N. Débito',
  '14': 'Recibo Serv. Púb.',
};

const MONEDA_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Soles (PEN)', value: 'PEN' },
  { label: 'Dólares (USD)', value: 'USD' },
];

const formatCurrency = (amount?: string | null, currency = 'PEN') => {
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

export const SireComprasDeclaredScreen: React.FC<Props> = ({ navigation: _navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  // ============ Estado de filtros ============
  const [search, setSearch] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [tipoCpe, setTipoCpe] = useState<string>('ALL');
  const [moneda, setMoneda] = useState<string>('ALL');
  const [rucProveedor, setRucProveedor] = useState('');
  const [estado, setEstado] = useState('');
  const [fechaFrom, setFechaFrom] = useState('');
  const [fechaTo, setFechaTo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [page, setPage] = useState(1);
  const limit = DEFAULT_LIMIT;

  const debouncedSearch = useDebounce(search.trim(), 400);
  const debouncedRuc = useDebounce(rucProveedor.trim(), 400);

  // ============ Query params ============
  const params: GetSireComprasDeclaredInvoicesParams = useMemo(() => {
    const p: GetSireComprasDeclaredInvoicesParams = {
      limit,
      offset: (page - 1) * limit,
    };
    if (debouncedSearch) p.search = debouncedSearch;
    if (periodo && /^\d{6}$/.test(periodo)) p.periodo = periodo;
    if (tipoCpe && tipoCpe !== 'ALL') p.tipoCpe = tipoCpe;
    if (moneda && moneda !== 'ALL') p.moneda = moneda;
    if (debouncedRuc) p.rucProveedor = debouncedRuc;
    if (estado.trim()) p.estado = estado.trim();
    if (fechaFrom) p.fechaFrom = fechaFrom;
    if (fechaTo) p.fechaTo = fechaTo;
    return p;
  }, [
    debouncedRuc,
    debouncedSearch,
    estado,
    fechaFrom,
    fechaTo,
    limit,
    moneda,
    page,
    periodo,
    tipoCpe,
  ]);

  const { data, isLoading, isFetching, refetch, isError, error } =
    useSireComprasDeclaredInvoices(params);
  const syncMutation = useSyncSireComprasDeclared();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const activeFiltersCount = useMemo(() => {
    return [
      !!debouncedSearch,
      !!periodo,
      tipoCpe !== 'ALL',
      moneda !== 'ALL',
      !!debouncedRuc,
      !!estado.trim(),
      !!fechaFrom,
      !!fechaTo,
    ].filter(Boolean).length;
  }, [debouncedRuc, debouncedSearch, estado, fechaFrom, fechaTo, moneda, periodo, tipoCpe]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setPeriodo('');
    setTipoCpe('ALL');
    setMoneda('ALL');
    setRucProveedor('');
    setEstado('');
    setFechaFrom('');
    setFechaTo('');
    setPage(1);
  }, []);

  const handleRefresh = useCallback(() => {
    setPage(1);
    void refetch();
  }, [refetch]);

  const handleSync = useCallback(async () => {
    try {
      const body = periodo && /^\d{6}$/.test(periodo) ? { periodo } : {};
      await syncMutation.mutateAsync(body);
      Alert.alert(
        'Sincronización iniciada',
        'Se disparó la descarga del registro declarado (RCE) de SUNAT. Podrás ver el avance en el historial de corridas.'
      );
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || 'No se pudo iniciar la sincronización';
      Alert.alert('Error', msg);
    }
  }, [periodo, syncMutation]);

  const renderItem = (item: SireComprasDeclaredInvoiceListItem) => {
    const cpeLabel = CPE_LABELS[item.tipoCpe] || item.tipoCpe;
    const hasCreditoFiscal = item.marcaCreditoFiscal === '1' || item.marcaCreditoFiscal === 'true';

    return (
      <Card key={item.id} style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <View style={{ flex: 1 }}>
            <Title size="small" numberOfLines={1}>
              {item.razonSocialProveedor || '(Sin razón social)'}
            </Title>
            <Caption color={theme.color.text.muted}>RUC {item.rucProveedor || '-'}</Caption>
          </View>
          <View style={styles.monedaPill}>
            <Text style={{ color: theme.color.text.muted, fontSize: 11, fontWeight: '600' }}>
              {item.moneda}
            </Text>
          </View>
        </View>

        <View style={styles.itemRow}>
          <View style={styles.itemCol}>
            <Caption color={theme.color.text.muted}>Comprobante</Caption>
            <Body style={{ fontWeight: '600' }}>
              {cpeLabel} · {item.serie}-{item.numero}
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
            <Ionicons
              name={hasCreditoFiscal ? 'checkmark-circle-outline' : 'ellipse-outline'}
              size={14}
              color={hasCreditoFiscal ? '#10B981' : theme.color.text.muted}
            />
            <Caption color={theme.color.text.muted}>
              {hasCreditoFiscal ? 'Con crédito fiscal' : 'Sin crédito fiscal'}
            </Caption>
          </View>
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
                  <Ionicons
                    name="cloud-done-outline"
                    size={22}
                    color={theme.color.brand.onHeader}
                  />
                </View>
                <Text style={styles.headerTitle}>Compras declaradas a SUNAT</Text>
              </View>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Registro declarado / presentado (RCE)
              </Text>
            </View>
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
                placeholder="Buscar por proveedor, RUC, serie o número"
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

          <View style={styles.chipsSection}>
            <Caption color={theme.color.text.muted}>Moneda</Caption>
            <ChipGroup
              options={MONEDA_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              selected={[moneda]}
              onChange={(sel) => {
                setMoneda(sel[0] || 'ALL');
                setPage(1);
              }}
              variant="filled"
              size="small"
            />
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
                    label="RUC proveedor"
                    placeholder="20512345678"
                    keyboardType="numeric"
                    maxLength={11}
                    value={rucProveedor}
                    onChangeText={(v) => {
                      setRucProveedor(v.replace(/\D/g, ''));
                      setPage(1);
                    }}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.field}>
                  <DatePickerButton
                    label="Fecha desde"
                    value={fechaFrom}
                    onPress={() => setShowFromPicker(true)}
                    placeholder="Selecciona fecha"
                  />
                </View>
                <View style={styles.field}>
                  <DatePickerButton
                    label="Fecha hasta"
                    value={fechaTo}
                    onPress={() => setShowToPicker(true)}
                    placeholder="Selecciona fecha"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.field}>
                  <Input
                    label="Estado"
                    placeholder="1 anotado, 2 anulado…"
                    keyboardType="numeric"
                    maxLength={2}
                    value={estado}
                    onChangeText={(v) => {
                      setEstado(v.replace(/\D/g, ''));
                      setPage(1);
                    }}
                  />
                </View>
                <View style={styles.field} />
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
                  : 'Aún no hay comprobantes declarados descargados de SUNAT.'
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

        <DatePicker
          visible={showFromPicker}
          date={fechaFrom ? new Date(fechaFrom) : new Date()}
          onCancel={() => setShowFromPicker(false)}
          onConfirm={(d) => {
            setFechaFrom(formatDateToString(d));
            setShowFromPicker(false);
            setPage(1);
          }}
          title="Fecha desde"
        />
        <DatePicker
          visible={showToPicker}
          date={fechaTo ? new Date(fechaTo) : new Date()}
          onCancel={() => setShowToPicker(false)}
          onConfirm={(d) => {
            setFechaTo(formatDateToString(d));
            setShowToPicker(false);
            setPage(1);
          }}
          title="Fecha hasta"
        />

        <SunatReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          title="Descargar reporte · Compras declaradas"
          defaultDatasets={['compras-declaradas']}
          fileBaseName="reporte-sire-compras-declaradas"
        />

        <ProtectedFAB
          actions={[
            {
              icon: 'sync-outline',
              label: syncMutation.isPending ? 'Sincronizando…' : 'Sincronizar',
              onPress: () => void handleSync(),
            },
            {
              icon: 'download-outline',
              label: 'Descargar reporte',
              onPress: () => setShowReportModal(true),
            },
          ]}
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
    monedaPill: {
      paddingHorizontal: spacing[2],
      paddingVertical: 4,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
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
