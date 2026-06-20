/**
 * ReviewIzipayScreen.tsx
 * Pantalla para revisar transacciones de Izipay con filtros avanzados
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

import { Pagination } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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

type Props = NativeStackScreenProps<any, 'ReviewIzipay'>;

interface IzipayTransaction {
  id: string;
  numero_autorizacion: string;
  fecha_transaccion: string;
  codigo_comercio: string;
  monto_bruto: number;
  comision: number;
  monto_neto: number;
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
  total_monto_bruto: number;
  total_comision: number;
  total_monto_neto: number;
}

export const ReviewIzipayScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { token } = useAuthStore();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Data states
  const [transactions, setTransactions] = useState<IzipayTransaction[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 50,
    total_pages: 0,
  });
  const [stats, setStats] = useState<Stats>({
    total_monto_bruto: 0,
    total_comision: 0,
    total_monto_neto: 0,
  });

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<QuickDateFilter>(QUICK_DATE_FILTERS.YESTERDAY);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);

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

  // Load transactions
  const loadTransactions = useCallback(
    async (page: number = 1, isRefresh: boolean = false) => {
      try {
        if (!fechaInicio || !fechaFin) {
          Alert.alert(
            'Fechas Requeridas',
            'Debe seleccionar un rango de fechas para consultar las transacciones Izipay. Por defecto se usa "Ayer".'
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

        const response = await fetch(
          `${config.API_URL}/cash-reconciliation/izipay?${params.toString()}`,
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
          throw new Error('Error al cargar transacciones Izipay');
        }

        const data = await response.json();
        setTransactions(data.data || []);
        setPagination(data.pagination || pagination);
        setStats(data.stats || stats);
      } catch (error) {
        console.error('Error loading Izipay transactions:', error);
        Alert.alert('Error', 'No se pudieron cargar las transacciones Izipay');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, searchQuery, selectedSede, fechaInicio, fechaFin, pagination.limit]
  );

  useEffect(() => {
    if (fechaInicio && fechaFin) {
      loadTransactions(1);
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
    loadTransactions(1);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSede('');
    setSelectedQuickFilter(QUICK_DATE_FILTERS.YESTERDAY);
    const yesterdayRange = getDateRangeByFilter(QUICK_DATE_FILTERS.YESTERDAY);
    if (yesterdayRange) {
      setFechaInicio(yesterdayRange.fromDate);
      setFechaFin(yesterdayRange.toDate);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.total_pages) {
      loadTransactions(pagination.page + 1);
    }
  };

  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      loadTransactions(pagination.page - 1);
    }
  };

  const handleRefresh = () => {
    loadTransactions(pagination.page, true);
  };

  const renderTransactionItem = (transaction: IzipayTransaction) => (
    <Animated.View
      key={transaction.id}
      style={[
        styles.transactionCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.transactionHeader}>
        <View style={styles.authContainer}>
          <View style={styles.authIconContainer}>
            <Text style={styles.authIcon}>💳</Text>
          </View>
          <View>
            <Text style={styles.authLabel}>Autorización</Text>
            <Text style={styles.authNumber}>{transaction.numero_autorizacion}</Text>
          </View>
        </View>
        <View style={styles.amountBadge}>
          <Text style={styles.transactionAmount}>S/ {transaction.monto_neto.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.transactionDetails}>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>📅 Fecha</Text>
            <Text style={styles.detailValue}>{transaction.fecha_transaccion}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>🏪 Código Comercio</Text>
            <Text style={styles.detailValue}>{transaction.codigo_comercio}</Text>
          </View>
        </View>

        <View style={styles.amountsContainer}>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Monto Bruto</Text>
            <Text style={styles.amountValueBruto}>S/ {transaction.monto_bruto.toFixed(2)}</Text>
          </View>
          <View style={styles.amountSeparator}>
            <Text style={styles.amountSeparatorText}>-</Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Comisión</Text>
            <Text style={styles.amountValueComision}>S/ {transaction.comision.toFixed(2)}</Text>
          </View>
          <View style={styles.amountSeparator}>
            <Text style={styles.amountSeparatorText}>=</Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Neto</Text>
            <Text style={styles.amountValueNeto}>S/ {transaction.monto_neto.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.sedeContainer}>
          <Text style={styles.sedeIcon}>🏢</Text>
          <Text style={styles.sedeText}>{transaction.sede.code} - {transaction.sede.name}</Text>
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
          <Text style={styles.headerTitle}>Revisar Izipay</Text>
          <Text style={styles.headerSubtitle}>💳 Transacciones de tarjeta</Text>
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
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{pagination.total}</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>💵</Text>
          <View>
            <Text style={styles.statLabel}>Bruto</Text>
            <Text style={styles.statValue}>S/ {stats.total_monto_bruto.toFixed(2)}</Text>
          </View>
        </View>
        <View style={[styles.statCard, styles.statCardDanger]}>
          <Text style={styles.statIcon}>📉</Text>
          <View>
            <Text style={styles.statLabel}>Comisión</Text>
            <Text style={[styles.statValue, styles.dangerText]}>S/ {stats.total_comision.toFixed(2)}</Text>
          </View>
        </View>
        <View style={[styles.statCard, styles.statCardSuccess]}>
          <Text style={styles.statIcon}>✓</Text>
          <View>
            <Text style={styles.statLabel}>Neto</Text>
            <Text style={[styles.statValue, styles.primaryText]}>S/ {stats.total_monto_neto.toFixed(2)}</Text>
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
              placeholder="Número autorización, código comercio..."
              placeholderTextColor={theme.color.text.placeholder}
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

      {/* Transactions List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[theme.color.brand.primary]} />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.color.brand.primary} />
            <Text style={styles.loadingText}>Cargando transacciones...</Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>💳</Text>
            </View>
            <Text style={styles.emptyText}>No se encontraron transacciones</Text>
            <Text style={styles.emptySubtext}>Intenta ajustar los filtros de búsqueda</Text>
          </View>
        ) : (
          <View style={styles.transactionsList}>{transactions.map(renderTransactionItem)}</View>
        )}
      </ScrollView>

      {/* Pagination */}
      {!isLoading && transactions.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.total_pages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={loadTransactions}
          loading={isLoading}
        />
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.background.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: theme.color.text.body,
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginTop: 2,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.background.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 20,
  },
  quickFiltersContainer: {
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    maxHeight: 50,
  },
  quickFiltersContent: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    gap: theme.space[2],
    flexDirection: 'row',
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.background.muted,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: theme.space[1],
  },
  quickFilterChipActive: {
    backgroundColor: theme.color.brand.primarySoft,
    borderColor: theme.color.brand.primary,
  },
  quickFilterIcon: {
    fontSize: 12,
  },
  quickFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.muted,
  },
  quickFilterTextActive: {
    color: theme.color.brand.primary,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: theme.color.surface.base,
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    gap: theme.space[1],
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.md,
    padding: theme.space[2],
    gap: theme.space[1],
  },
  statCardDanger: {
    backgroundColor: theme.color.state.danger.background,
  },
  statCardSuccess: {
    backgroundColor: theme.color.brand.primarySoft,
  },
  statIcon: {
    fontSize: 14,
  },
  statLabel: {
    fontSize: 8,
    color: theme.color.text.subtle,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  dangerText: {
    color: theme.color.state.danger.border,
  },
  primaryText: {
    color: theme.color.brand.primary,
  },
  filtersPanel: {
    backgroundColor: theme.color.surface.base,
    maxHeight: 350,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
  },
  filterHeader: {
    marginBottom: theme.space[4],
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  filterGroup: {
    marginBottom: theme.space[4],
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: theme.space[2],
  },
  input: {
    backgroundColor: theme.color.background.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    fontSize: 14,
    color: theme.color.text.heading,
  },
  pickerContainer: {
    backgroundColor: theme.color.background.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: theme.color.text.heading,
  },
  filterActions: {
    flexDirection: 'row',
    gap: theme.space[3],
    marginTop: theme.space[2],
  },
  clearButton: {
    flex: 1,
    backgroundColor: theme.color.background.muted,
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  applyButton: {
    flex: 1,
    backgroundColor: theme.color.brand.primary,
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.surface.base,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.space[6] * 3,
  },
  loadingText: {
    marginTop: theme.space[3],
    fontSize: 14,
    color: theme.color.text.subtle,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.space[6] * 3,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.brand.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.space[4],
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: theme.space[2],
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.color.text.subtle,
  },
  transactionsList: {
    padding: theme.space[4],
    gap: theme.space[3],
  },
  transactionCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    ...theme.shadow.md,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space[4],
    paddingBottom: theme.space[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.background.muted,
  },
  authContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
  },
  authIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authIcon: {
    fontSize: 20,
  },
  authLabel: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginBottom: 2,
  },
  authNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  amountBadge: {
    backgroundColor: theme.color.brand.primarySoft,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.lg,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.brand.primary,
  },
  transactionDetails: {
    gap: theme.space[3],
  },
  detailRow: {
    flexDirection: 'row',
    gap: theme.space[4],
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: theme.color.text.heading,
    fontWeight: '500',
  },
  amountsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.lg,
    padding: theme.space[3],
    gap: theme.space[2],
  },
  amountItem: {
    flex: 1,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 9,
    color: theme.color.text.subtle,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 2,
  },
  amountValueBruto: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.text.body,
  },
  amountValueComision: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.state.danger.border,
  },
  amountValueNeto: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.brand.primary,
  },
  amountSeparator: {
    width: 20,
    alignItems: 'center',
  },
  amountSeparatorText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.placeholder,
  },
  sedeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    paddingTop: theme.space[2],
    borderTopWidth: 1,
    borderTopColor: theme.color.background.muted,
  },
  sedeIcon: {
    fontSize: 14,
  },
  sedeText: {
    fontSize: 12,
    color: theme.color.text.muted,
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.surface.base,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  paginationButton: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    backgroundColor: theme.color.brand.primary,
    borderRadius: theme.radii.lg,
  },
  paginationButtonDisabled: {
    backgroundColor: theme.color.border.subtle,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.surface.base,
  },
  paginationButtonTextDisabled: {
    color: theme.color.text.placeholder,
  },
  paginationInfoContainer: {
    backgroundColor: theme.color.background.muted,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.lg,
  },
  paginationInfo: {
    fontSize: 14,
    color: theme.color.text.body,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    width: '90%',
    maxWidth: 500,
    ...theme.shadow.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.space[5],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.background.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    fontSize: 18,
    color: theme.color.text.muted,
    fontWeight: '600',
  },
  modalBody: {
    padding: theme.space[5],
  },
  filterSection: {
    marginBottom: theme.space[4],
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: theme.space[3],
  },
  dateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radii.lg,
    padding: theme.space[3],
    backgroundColor: theme.color.background.subtle,
    gap: theme.space[3],
  },
  dateRangeIcon: {
    fontSize: 20,
  },
  dateRangeTextContainer: {
    flex: 1,
  },
  dateRangeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.subtle,
    marginBottom: theme.space[1],
  },
  dateRangeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  dateRangeChevron: {
    fontSize: 20,
    color: theme.color.text.placeholder,
  },
  dateHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.space[3],
    padding: theme.space[3],
    backgroundColor: theme.color.state.warning.background,
    borderRadius: theme.radii.lg,
    gap: theme.space[2],
  },
  dateHintIcon: {
    fontSize: 16,
  },
  dateHint: {
    fontSize: 12,
    color: theme.color.state.warning.text,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: theme.space[3],
    padding: theme.space[5],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    backgroundColor: theme.color.background.muted,
  },
  modalButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    backgroundColor: theme.color.brand.primary,
  },
  modalButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.surface.base,
  },
});
