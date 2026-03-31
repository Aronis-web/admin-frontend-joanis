/**
 * ReviewSalesScreen.tsx
 * Pantalla para revisar ventas con filtros avanzados
 * Rediseñado con sistema de diseño global
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateRangePicker } from '@/components/DateRangePicker';
import { Picker } from '@react-native-picker/picker';

import { colors } from '@/design-system/tokens/colors';
import { spacing, borderRadius } from '@/design-system/tokens/spacing';
import { shadows } from '@/design-system/tokens/shadows';
import { fontSizes, fontWeights } from '@/design-system/tokens/typography';
import { durations } from '@/design-system/tokens/animations';

import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';
import { sitesApi } from '@/services/api/sites';
import { Site } from '@/types/sites';
import {
  QUICK_DATE_FILTERS,
  QuickDateFilter,
  getDateRangeByFilter,
  AVAILABLE_QUICK_FILTERS,
  validateDateRange,
} from '@/utils/dateFilters';

type Props = NativeStackScreenProps<any, 'ReviewSales'>;

interface Sale {
  id: string;
  sale_id: string;
  fecha_venta: string;
  hora_venta: string;
  tipo_documento: string;
  serie: string;
  numero_documento: string;
  tipo_pago: string;
  monto: number;
  cliente: string;
  sede: {
    id: string;
    code: string;
    name: string;
  };
  created_at: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface Stats {
  total_monto: number;
  promedio_monto: number;
}

export const ReviewSalesScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Data states
  const [sales, setSales] = useState<Sale[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 50,
    total_pages: 0,
  });
  const [stats, setStats] = useState<Stats>({ total_monto: 0, promedio_monto: 0 });

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [selectedTipoPago, setSelectedTipoPago] = useState<string>('');
  const [selectedTipoDocumento, setSelectedTipoDocumento] = useState<string>('');
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<QuickDateFilter>(QUICK_DATE_FILTERS.YESTERDAY);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);

  // Sedes
  const [sedes, setSedes] = useState<Site[]>([]);
  const [isLoadingSedes, setIsLoadingSedes] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: durations.normal,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: durations.normal,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Initialize with yesterday's date
  useEffect(() => {
    const yesterdayRange = getDateRangeByFilter(QUICK_DATE_FILTERS.YESTERDAY);
    if (yesterdayRange) {
      setFechaInicio(yesterdayRange.fromDate);
      setFechaFin(yesterdayRange.toDate);
    }
  }, []);

  // Load sedes
  useEffect(() => {
    loadSedes();
  }, []);

  const loadSedes = async () => {
    try {
      setIsLoadingSedes(true);
      const response = await sitesApi.getSites({ limit: 100 });
      setSedes(response.data || []);
    } catch (error) {
      console.error('Error loading sedes:', error);
    } finally {
      setIsLoadingSedes(false);
    }
  };

  // Load sales
  const loadSales = useCallback(
    async (page: number = 1, isRefresh: boolean = false) => {
      try {
        if (!fechaInicio || !fechaFin) {
          Alert.alert(
            'Fechas Requeridas',
            'Debe seleccionar un rango de fechas para consultar las ventas. Por defecto se usa "Ayer".'
          );
          return;
        }

        const validation = validateDateRange(fechaInicio, fechaFin, 90);
        if (!validation.valid) {
          Alert.alert('Rango de Fechas Inválido', validation.message || 'El rango de fechas no es válido');
          return;
        }

        if (isRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', pagination.limit.toString());
        params.append('fecha_inicio', fechaInicio);
        params.append('fecha_fin', fechaFin);

        if (searchQuery) params.append('search', searchQuery);
        if (selectedSede) params.append('sede_id', selectedSede);
        if (selectedTipoPago) params.append('tipo_pago', selectedTipoPago);
        if (selectedTipoDocumento) params.append('tipo_documento', selectedTipoDocumento);

        const response = await fetch(
          `${config.API_URL}/cash-reconciliation/sales?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-App-Id': config.APP_ID,
              'X-App-Version': config.APP_VERSION,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Error al cargar ventas');
        }

        const data = await response.json();
        setSales(data.data || []);
        setPagination(data.pagination || pagination);
        setStats(data.stats || stats);
      } catch (error) {
        console.error('Error loading sales:', error);
        Alert.alert('Error', 'No se pudieron cargar las ventas');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, searchQuery, selectedSede, selectedTipoPago, selectedTipoDocumento, fechaInicio, fechaFin, pagination.limit]
  );

  useEffect(() => {
    if (fechaInicio && fechaFin) {
      loadSales(1);
    }
  }, [fechaInicio, fechaFin]);

  const handleQuickFilterSelect = (filter: QuickDateFilter) => {
    setSelectedQuickFilter(filter);
    const range = getDateRangeByFilter(filter);
    if (range) {
      setFechaInicio(range.fromDate);
      setFechaFin(range.toDate);
    }
  };

  const handleApplyFilters = () => {
    loadSales(1);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSede('');
    setSelectedTipoPago('');
    setSelectedTipoDocumento('');
    setSelectedQuickFilter(QUICK_DATE_FILTERS.YESTERDAY);
    const yesterdayRange = getDateRangeByFilter(QUICK_DATE_FILTERS.YESTERDAY);
    if (yesterdayRange) {
      setFechaInicio(yesterdayRange.fromDate);
      setFechaFin(yesterdayRange.toDate);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.total_pages) {
      loadSales(pagination.page + 1);
    }
  };

  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      loadSales(pagination.page - 1);
    }
  };

  const handleRefresh = () => {
    loadSales(pagination.page, true);
  };

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case 'B':
        return colors.success[500];
      case 'F':
        return colors.primary[500];
      case 'NC':
        return colors.danger[500];
      case 'ND':
        return colors.warning[500];
      default:
        return colors.neutral[500];
    }
  };

  const getDocumentTypeBgColor = (type: string) => {
    switch (type) {
      case 'B':
        return colors.success[50];
      case 'F':
        return colors.primary[50];
      case 'NC':
        return colors.danger[50];
      case 'ND':
        return colors.warning[50];
      default:
        return colors.neutral[100];
    }
  };

  const renderSaleItem = (sale: Sale, index: number) => (
    <Animated.View
      key={sale.id}
      style={[
        styles.saleCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.saleHeader}>
        <View style={styles.saleIdContainer}>
          <Text style={styles.saleId}>{sale.sale_id}</Text>
          <View style={[styles.badge, { backgroundColor: getDocumentTypeBgColor(sale.tipo_documento) }]}>
            <Text style={[styles.badgeText, { color: getDocumentTypeColor(sale.tipo_documento) }]}>
              {sale.tipo_documento}
            </Text>
          </View>
        </View>
        <Text style={styles.saleAmount}>S/ {sale.monto.toFixed(2)}</Text>
      </View>

      <View style={styles.saleDetails}>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>📅 Fecha</Text>
            <Text style={styles.detailValue}>{sale.fecha_venta} {sale.hora_venta}</Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>👤 Cliente</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{sale.cliente}</Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>💳 Tipo Pago</Text>
            <Text style={styles.detailValue}>{sale.tipo_pago}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>🏢 Sede</Text>
            <Text style={styles.detailValue}>{sale.sede.code}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Revisar Ventas</Text>
          <Text style={styles.headerSubtitle}>💰 Consulta de ventas</Text>
        </View>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterButton}>
          <Text style={styles.filterButtonText}>⚙️</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Quick Date Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickFiltersContainer}
        contentContainerStyle={styles.quickFiltersContent}
      >
        {AVAILABLE_QUICK_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.quickFilterChip,
              selectedQuickFilter === filter.key && styles.quickFilterChipActive,
            ]}
            onPress={() => handleQuickFilterSelect(filter.key)}
          >
            <Text style={styles.quickFilterIcon}>{filter.icon}</Text>
            <Text
              style={[
                styles.quickFilterText,
                selectedQuickFilter === filter.key && styles.quickFilterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            styles.quickFilterChip,
            selectedQuickFilter === QUICK_DATE_FILTERS.CUSTOM && styles.quickFilterChipActive,
          ]}
          onPress={() => setShowCustomDateModal(true)}
        >
          <Text style={styles.quickFilterIcon}>📅</Text>
          <Text
            style={[
              styles.quickFilterText,
              selectedQuickFilter === QUICK_DATE_FILTERS.CUSTOM && styles.quickFilterTextActive,
            ]}
          >
            Personalizar
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📊</Text>
          <View>
            <Text style={styles.statLabel}>Registros</Text>
            <Text style={styles.statValue}>{pagination.total}</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>💵</Text>
          <View>
            <Text style={styles.statLabel}>Monto Total</Text>
            <Text style={[styles.statValue, styles.successText]}>S/ {stats.total_monto.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📈</Text>
          <View>
            <Text style={styles.statLabel}>Promedio</Text>
            <Text style={styles.statValue}>S/ {stats.promedio_monto.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Filters Panel */}
      {showFilters && (
        <ScrollView style={styles.filtersPanel} showsVerticalScrollIndicator={false}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>🔍 Filtros de Búsqueda</Text>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Búsqueda General</Text>
            <TextInput
              style={styles.input}
              placeholder="ID, serie, número, cliente..."
              placeholderTextColor={colors.neutral[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>🏢 Sede</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedSede}
                onValueChange={setSelectedSede}
                style={styles.picker}
              >
                <Picker.Item label="Todas las sedes" value="" />
                {sedes.map((sede) => (
                  <Picker.Item key={sede.id} label={`${sede.code} - ${sede.name}`} value={sede.id} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>💳 Tipo de Pago</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedTipoPago}
                onValueChange={setSelectedTipoPago}
                style={styles.picker}
              >
                <Picker.Item label="Todos" value="" />
                <Picker.Item label="Efectivo" value="efectivo" />
                <Picker.Item label="Tarjeta" value="tarjeta" />
                <Picker.Item label="Transferencia" value="transferencia" />
                <Picker.Item label="Yape" value="yape" />
                <Picker.Item label="Plin" value="plin" />
                <Picker.Item label="Otro" value="otro" />
              </Picker>
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>📄 Tipo de Documento</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedTipoDocumento}
                onValueChange={setSelectedTipoDocumento}
                style={styles.picker}
              >
                <Picker.Item label="Todos" value="" />
                <Picker.Item label="Boleta (B)" value="B" />
                <Picker.Item label="Factura (F)" value="F" />
                <Picker.Item label="Nota de Crédito (NC)" value="NC" />
                <Picker.Item label="Nota de Débito (ND)" value="ND" />
              </Picker>
            </View>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClearFilters}>
              <Text style={styles.clearButtonText}>🗑️ Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApplyFilters}>
              <Text style={styles.applyButtonText}>✓ Aplicar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Sales List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.success[500]]} />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.success[500]} />
            <Text style={styles.loadingText}>Cargando ventas...</Text>
          </View>
        ) : sales.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
            </View>
            <Text style={styles.emptyText}>No se encontraron ventas</Text>
            <Text style={styles.emptySubtext}>Intenta ajustar los filtros de búsqueda</Text>
          </View>
        ) : (
          <View style={styles.salesList}>{sales.map((sale, index) => renderSaleItem(sale, index))}</View>
        )}
      </ScrollView>

      {/* Pagination */}
      {!isLoading && sales.length > 0 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.paginationButton, pagination.page === 1 && styles.paginationButtonDisabled]}
            onPress={handlePreviousPage}
            disabled={pagination.page === 1}
          >
            <Text style={[styles.paginationButtonText, pagination.page === 1 && styles.paginationButtonTextDisabled]}>
              ← Anterior
            </Text>
          </TouchableOpacity>
          <View style={styles.paginationInfoContainer}>
            <Text style={styles.paginationInfo}>
              {pagination.page} / {pagination.total_pages}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.paginationButton, pagination.page === pagination.total_pages && styles.paginationButtonDisabled]}
            onPress={handleNextPage}
            disabled={pagination.page === pagination.total_pages}
          >
            <Text style={[styles.paginationButtonText, pagination.page === pagination.total_pages && styles.paginationButtonTextDisabled]}>
              Siguiente →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Custom Date Modal */}
      <Modal
        visible={showCustomDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📅 Fecha Personalizada</Text>
              <TouchableOpacity onPress={() => setShowCustomDateModal(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Rango de Fechas</Text>
                <TouchableOpacity
                  style={styles.dateRangeButton}
                  onPress={() => setShowDateRangePicker(true)}
                >
                  <Text style={styles.dateRangeIcon}>📅</Text>
                  <View style={styles.dateRangeTextContainer}>
                    <Text style={styles.dateRangeLabel}>Periodo</Text>
                    <Text style={styles.dateRangeValue}>
                      {fechaInicio && fechaFin
                        ? `${fechaInicio} — ${fechaFin}`
                        : 'Seleccionar rango'}
                    </Text>
                  </View>
                  <Text style={styles.dateRangeChevron}>›</Text>
                </TouchableOpacity>
                <View style={styles.dateHintContainer}>
                  <Text style={styles.dateHintIcon}>💡</Text>
                  <Text style={styles.dateHint}>Máximo 90 días de diferencia</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowCustomDateModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={() => {
                  setShowCustomDateModal(false);
                  setSelectedQuickFilter(QUICK_DATE_FILTERS.CUSTOM);
                }}
              >
                <Text style={styles.modalButtonPrimaryText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Range Picker */}
      <DateRangePicker
        visible={showDateRangePicker}
        startDate={fechaInicio ? new Date(fechaInicio + 'T12:00:00') : new Date()}
        endDate={fechaFin ? new Date(fechaFin + 'T12:00:00') : new Date()}
        onConfirm={(start, end) => {
          const formatDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };
          setFechaInicio(formatDate(start));
          setFechaFin(formatDate(end));
          setSelectedQuickFilter(QUICK_DATE_FILTERS.CUSTOM);
          setShowDateRangePicker(false);
        }}
        onCancel={() => setShowDateRangePicker(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    ...shadows.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: fontSizes['2xl'],
    color: colors.neutral[700],
    fontWeight: fontWeights.semibold,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  headerSubtitle: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
    marginTop: 2,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: fontSizes.xl,
  },
  quickFiltersContainer: {
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    maxHeight: 50,
  },
  quickFiltersContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2],
    flexDirection: 'row',
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: 'transparent',
    gap: spacing[1],
  },
  quickFilterChipActive: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[500],
  },
  quickFilterIcon: {
    fontSize: fontSizes.xs,
  },
  quickFilterText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[600],
  },
  quickFilterTextActive: {
    color: colors.success[700],
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    gap: spacing[2],
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
    padding: spacing[2],
    gap: spacing[2],
  },
  statIcon: {
    fontSize: fontSizes.lg,
  },
  statLabel: {
    fontSize: 9,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    fontWeight: fontWeights.medium,
  },
  statValue: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  successText: {
    color: colors.success[600],
  },
  filtersPanel: {
    backgroundColor: colors.neutral[0],
    maxHeight: 400,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  filterHeader: {
    marginBottom: spacing[4],
  },
  filterTitle: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  filterGroup: {
    marginBottom: spacing[4],
  },
  filterLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[700],
    marginBottom: spacing[2],
  },
  input: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSizes.sm,
    color: colors.neutral[900],
  },
  pickerContainer: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: colors.neutral[900],
  },
  filterActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  clearButton: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[700],
  },
  applyButton: {
    flex: 1,
    backgroundColor: colors.success[500],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[6] * 3,
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[6] * 3,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[700],
    marginBottom: spacing[2],
  },
  emptySubtext: {
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
  },
  salesList: {
    padding: spacing[4],
    gap: spacing[3],
  },
  saleCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    ...shadows.md,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  saleIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  saleId: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  badgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  saleAmount: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.success[600],
  },
  saleDetails: {
    gap: spacing[2],
  },
  detailRow: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  detailValue: {
    fontSize: fontSizes.sm,
    color: colors.neutral[800],
    fontWeight: fontWeights.medium,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    ...shadows.sm,
  },
  paginationButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.success[500],
    borderRadius: borderRadius.lg,
  },
  paginationButtonDisabled: {
    backgroundColor: colors.neutral[200],
  },
  paginationButtonText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },
  paginationButtonTextDisabled: {
    color: colors.neutral[400],
  },
  paginationInfoContainer: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  paginationInfo: {
    fontSize: fontSizes.sm,
    color: colors.neutral[700],
    fontWeight: fontWeights.semibold,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    width: '90%',
    maxWidth: 500,
    ...shadows.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    fontSize: fontSizes.lg,
    color: colors.neutral[600],
    fontWeight: fontWeights.semibold,
  },
  modalBody: {
    padding: spacing[5],
  },
  filterSection: {
    marginBottom: spacing[4],
  },
  filterSectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[700],
    marginBottom: spacing[3],
  },
  dateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    backgroundColor: colors.neutral[50],
    gap: spacing[3],
  },
  dateRangeIcon: {
    fontSize: fontSizes.xl,
  },
  dateRangeTextContainer: {
    flex: 1,
  },
  dateRangeLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  dateRangeValue: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[800],
  },
  dateRangeChevron: {
    fontSize: fontSizes.xl,
    color: colors.neutral[400],
  },
  dateHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
  },
  dateHintIcon: {
    fontSize: fontSizes.base,
  },
  dateHint: {
    fontSize: fontSizes.xs,
    color: colors.warning[700],
    fontWeight: fontWeights.medium,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
  },
  modalButtonSecondaryText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[700],
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    backgroundColor: colors.success[500],
  },
  modalButtonPrimaryText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },
});
