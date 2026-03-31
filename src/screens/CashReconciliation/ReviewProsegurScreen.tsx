/**
 * ReviewProsegurScreen.tsx
 * Pantalla para revisar depósitos y recogidas de Prosegur
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

type Props = NativeStackScreenProps<any, 'ReviewProsegur'>;

interface ProsegurDeposit {
  id: string;
  cashtoday_nombre: string;
  fecha_deposito: string;
  hora_deposito: string;
  tipo_movimiento: string;
  monto: number;
  usuario: string;
  cliente: string;
  incluida_en_cuadre: boolean;
  notas: string | null;
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
  total_depositos: number;
  total_recogidas: number;
  monto_total_depositos: number;
  monto_total_recogidas: number;
}

export const ReviewProsegurScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Data states
  const [deposits, setDeposits] = useState<ProsegurDeposit[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 50,
    total_pages: 0,
  });
  const [stats, setStats] = useState<Stats>({
    total_depositos: 0,
    total_recogidas: 0,
    monto_total_depositos: 0,
    monto_total_recogidas: 0,
  });

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [selectedTipoMovimiento, setSelectedTipoMovimiento] = useState<string>('');
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

  // Load deposits
  const loadDeposits = useCallback(
    async (page: number = 1, isRefresh: boolean = false) => {
      try {
        if (!fechaInicio || !fechaFin) {
          Alert.alert(
            'Fechas Requeridas',
            'Debe seleccionar un rango de fechas para consultar los depósitos Prosegur. Por defecto se usa "Ayer".'
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
        if (selectedTipoMovimiento) params.append('tipo_movimiento', selectedTipoMovimiento);

        const response = await fetch(
          `${config.API_URL}/cash-reconciliation/prosegur?${params.toString()}`,
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
          throw new Error('Error al cargar depósitos Prosegur');
        }

        const data = await response.json();
        setDeposits(data.data || []);
        setPagination(data.pagination || pagination);
        setStats(data.stats || stats);
      } catch (error) {
        console.error('Error loading Prosegur deposits:', error);
        Alert.alert('Error', 'No se pudieron cargar los depósitos Prosegur');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, searchQuery, selectedSede, selectedTipoMovimiento, fechaInicio, fechaFin, pagination.limit]
  );

  useEffect(() => {
    if (fechaInicio && fechaFin) {
      loadDeposits(1);
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
    loadDeposits(1);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSede('');
    setSelectedTipoMovimiento('');
    setSelectedQuickFilter(QUICK_DATE_FILTERS.YESTERDAY);
    const yesterdayRange = getDateRangeByFilter(QUICK_DATE_FILTERS.YESTERDAY);
    if (yesterdayRange) {
      setFechaInicio(yesterdayRange.fromDate);
      setFechaFin(yesterdayRange.toDate);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.total_pages) {
      loadDeposits(pagination.page + 1);
    }
  };

  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      loadDeposits(pagination.page - 1);
    }
  };

  const handleRefresh = () => {
    loadDeposits(pagination.page, true);
  };

  const renderDepositItem = (deposit: ProsegurDeposit) => {
    const isDeposito = deposit.tipo_movimiento === 'deposito';

    return (
      <Animated.View
        key={deposit.id}
        style={[
          styles.depositCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.depositHeader}>
          <View style={styles.cashtodayContainer}>
            <View style={[styles.typeIconContainer, isDeposito ? styles.depositIconBg : styles.pickupIconBg]}>
              <Text style={styles.typeIcon}>{isDeposito ? '↑' : '↓'}</Text>
            </View>
            <View>
              <Text style={styles.cashtodayLabel}>CashToday</Text>
              <Text style={styles.cashtodayName}>{deposit.cashtoday_nombre}</Text>
            </View>
          </View>
          <View style={styles.amountContainer}>
            <View style={[styles.movementBadge, isDeposito ? styles.depositBadge : styles.pickupBadge]}>
              <Text style={[styles.movementBadgeText, isDeposito ? styles.depositBadgeText : styles.pickupBadgeText]}>
                {isDeposito ? '↑ Depósito' : '↓ Recogida'}
              </Text>
            </View>
            <Text style={[styles.depositAmount, isDeposito ? styles.depositAmountColor : styles.pickupAmountColor]}>
              S/ {deposit.monto.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.depositDetails}>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>📅 Fecha</Text>
              <Text style={styles.detailValue}>{deposit.fecha_deposito} {deposit.hora_deposito}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>👤 Usuario</Text>
              <Text style={styles.detailValue}>{deposit.usuario}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>🏢 Cliente</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{deposit.cliente}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>📍 Sede</Text>
              <Text style={styles.detailValue}>{deposit.sede.code} - {deposit.sede.name}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>✓ En Cuadre</Text>
              <View style={[styles.statusBadge, deposit.incluida_en_cuadre ? styles.statusBadgeSuccess : styles.statusBadgeDanger]}>
                <Text style={[styles.statusBadgeText, deposit.incluida_en_cuadre ? styles.statusTextSuccess : styles.statusTextDanger]}>
                  {deposit.incluida_en_cuadre ? 'Sí' : 'No'}
                </Text>
              </View>
            </View>
          </View>
          {deposit.notas && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>📝 Notas</Text>
              <Text style={styles.notesText}>{deposit.notas}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Revisar Prosegur</Text>
          <Text style={styles.headerSubtitle}>🏦 Depósitos y recogidas</Text>
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
        <View style={[styles.statCard, styles.statCardDeposit]}>
          <Text style={styles.statIcon}>↑</Text>
          <View>
            <Text style={styles.statLabel}>Depósitos</Text>
            <Text style={[styles.statValue, styles.depositText]}>{stats.total_depositos}</Text>
          </View>
        </View>
        <View style={[styles.statCard, styles.statCardPickup]}>
          <Text style={styles.statIcon}>↓</Text>
          <View>
            <Text style={styles.statLabel}>Recogidas</Text>
            <Text style={[styles.statValue, styles.pickupText]}>{stats.total_recogidas}</Text>
          </View>
        </View>
        <View style={[styles.statCard, styles.statCardAmount]}>
          <Text style={styles.statIcon}>💰</Text>
          <View>
            <Text style={styles.statLabel}>Monto Dep.</Text>
            <Text style={[styles.statValue, styles.depositText]}>S/ {stats.monto_total_depositos.toFixed(0)}</Text>
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
              placeholder="Usuario, cliente..."
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
            <Text style={styles.filterLabel}>📋 Tipo de Movimiento</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedTipoMovimiento}
                onValueChange={setSelectedTipoMovimiento}
                style={styles.picker}
              >
                <Picker.Item label="Todos" value="" />
                <Picker.Item label="Depósito" value="deposito" />
                <Picker.Item label="Recogida" value="recogida" />
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

      {/* Deposits List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#8B5CF6']} />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Cargando depósitos...</Text>
          </View>
        ) : deposits.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>🏦</Text>
            </View>
            <Text style={styles.emptyText}>No se encontraron depósitos</Text>
            <Text style={styles.emptySubtext}>Intenta ajustar los filtros de búsqueda</Text>
          </View>
        ) : (
          <View style={styles.depositsList}>{deposits.map(renderDepositItem)}</View>
        )}
      </ScrollView>

      {/* Pagination */}
      {!isLoading && deposits.length > 0 && (
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
    backgroundColor: '#F3E8FF',
    borderColor: '#8B5CF6',
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
    color: '#8B5CF6',
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
  statCardDeposit: {
    backgroundColor: colors.success[50],
  },
  statCardPickup: {
    backgroundColor: colors.danger[50],
  },
  statCardAmount: {
    backgroundColor: colors.success[50],
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
  depositText: {
    color: colors.success[600],
  },
  pickupText: {
    color: colors.danger[600],
  },
  filtersPanel: {
    backgroundColor: colors.neutral[0],
    maxHeight: 380,
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
    backgroundColor: '#8B5CF6',
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
    backgroundColor: '#F3E8FF',
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
  depositsList: {
    padding: spacing[4],
    gap: spacing[3],
  },
  depositCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    ...shadows.md,
  },
  depositHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  cashtodayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  typeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  depositIconBg: {
    backgroundColor: colors.success[100],
  },
  pickupIconBg: {
    backgroundColor: colors.danger[100],
  },
  typeIcon: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.neutral[700],
  },
  cashtodayLabel: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  cashtodayName: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  movementBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    marginBottom: spacing[1],
  },
  depositBadge: {
    backgroundColor: colors.success[100],
  },
  pickupBadge: {
    backgroundColor: colors.danger[100],
  },
  movementBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  depositBadgeText: {
    color: colors.success[700],
  },
  pickupBadgeText: {
    color: colors.danger[700],
  },
  depositAmount: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
  },
  depositAmountColor: {
    color: colors.success[600],
  },
  pickupAmountColor: {
    color: colors.danger[600],
  },
  depositDetails: {
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
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  statusBadgeSuccess: {
    backgroundColor: colors.success[100],
  },
  statusBadgeDanger: {
    backgroundColor: colors.danger[100],
  },
  statusBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
  },
  statusTextSuccess: {
    color: colors.success[700],
  },
  statusTextDanger: {
    color: colors.danger[700],
  },
  notesContainer: {
    marginTop: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  notesLabel: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  notesText: {
    fontSize: fontSizes.sm,
    color: colors.neutral[700],
    fontStyle: 'italic',
    lineHeight: 20,
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
    backgroundColor: '#8B5CF6',
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
    backgroundColor: '#8B5CF6',
  },
  modalButtonPrimaryText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },
});
