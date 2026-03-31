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
import DateTimePicker from '@react-native-community/datetimepicker';
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
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [tempFromDate, setTempFromDate] = useState(new Date());
  const [tempToDate, setTempToDate] = useState(new Date());

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
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary[500]]} />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
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
                <View style={styles.dateInputsRow}>
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateInputLabel}>Desde</Text>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => {
                        if (fechaInicio) {
                          const [year, month, day] = fechaInicio.split('-');
                          setTempFromDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
                        }
                        setShowFromDatePicker(true);
                      }}
                    >
                      <Text style={styles.dateInputText}>{fechaInicio || 'Seleccionar'}</Text>
                      <Text style={styles.dateInputIcon}>📅</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.dateInputContainer}>
                    <Text style={styles.dateInputLabel}>Hasta</Text>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => {
                        if (fechaFin) {
                          const [year, month, day] = fechaFin.split('-');
                          setTempToDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
                        }
                        setShowToDatePicker(true);
                      }}
                    >
                      <Text style={styles.dateInputText}>{fechaFin || 'Seleccionar'}</Text>
                      <Text style={styles.dateInputIcon}>📅</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {showFromDatePicker && (
                  <DateTimePicker
                    value={tempFromDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowFromDatePicker(false);
                      if (event.type === 'set' && selectedDate) {
                        const year = selectedDate.getFullYear();
                        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(selectedDate.getDate()).padStart(2, '0');
                        setFechaInicio(`${year}-${month}-${day}`);
                        setSelectedQuickFilter(QUICK_DATE_FILTERS.CUSTOM);
                      }
                    }}
                  />
                )}
                {showToDatePicker && (
                  <DateTimePicker
                    value={tempToDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowToDatePicker(false);
                      if (event.type === 'set' && selectedDate) {
                        const year = selectedDate.getFullYear();
                        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(selectedDate.getDate()).padStart(2, '0');
                        setFechaFin(`${year}-${month}-${day}`);
                        setSelectedQuickFilter(QUICK_DATE_FILTERS.CUSTOM);
                      }
                    }}
                  />
                )}
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
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
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
    color: colors.primary[700],
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    gap: spacing[1],
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    padding: spacing[2],
    gap: spacing[1],
  },
  statCardDanger: {
    backgroundColor: colors.danger[50],
  },
  statCardSuccess: {
    backgroundColor: colors.primary[50],
  },
  statIcon: {
    fontSize: fontSizes.sm,
  },
  statLabel: {
    fontSize: 8,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    fontWeight: fontWeights.medium,
  },
  statValue: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  dangerText: {
    color: colors.danger[600],
  },
  primaryText: {
    color: colors.primary[600],
  },
  filtersPanel: {
    backgroundColor: colors.neutral[0],
    maxHeight: 350,
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
    backgroundColor: colors.primary[500],
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
    backgroundColor: colors.primary[50],
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
  transactionsList: {
    padding: spacing[4],
    gap: spacing[3],
  },
  transactionCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    ...shadows.md,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  authContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  authIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  authIcon: {
    fontSize: fontSizes.xl,
  },
  authLabel: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  authNumber: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  amountBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  transactionAmount: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.primary[600],
  },
  transactionDetails: {
    gap: spacing[3],
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
  amountsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    gap: spacing[2],
  },
  amountItem: {
    flex: 1,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 9,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    fontWeight: fontWeights.medium,
    marginBottom: 2,
  },
  amountValueBruto: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.neutral[700],
  },
  amountValueComision: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.danger[600],
  },
  amountValueNeto: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.primary[600],
  },
  amountSeparator: {
    width: 20,
    alignItems: 'center',
  },
  amountSeparatorText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.neutral[400],
  },
  sedeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  sedeIcon: {
    fontSize: fontSizes.sm,
  },
  sedeText: {
    fontSize: fontSizes.xs,
    color: colors.neutral[600],
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
    backgroundColor: colors.primary[500],
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
  dateInputsRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  dateInputContainer: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[500],
    marginBottom: spacing[2],
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral[50],
  },
  dateInputText: {
    fontSize: fontSizes.sm,
    color: colors.neutral[700],
    fontWeight: fontWeights.medium,
  },
  dateInputIcon: {
    fontSize: fontSizes.base,
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
    backgroundColor: colors.primary[500],
  },
  modalButtonPrimaryText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },
});
