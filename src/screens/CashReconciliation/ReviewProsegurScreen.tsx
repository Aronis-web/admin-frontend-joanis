import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
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
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [tempFromDate, setTempFromDate] = useState(new Date());
  const [tempToDate, setTempToDate] = useState(new Date());

  // Sedes
  const [sedes, setSedes] = useState<Site[]>([]);
  const [isLoadingSedes, setIsLoadingSedes] = useState(false);

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
        // ⚠️ VALIDACIÓN: Fechas obligatorias para evitar escaneo de particiones
        if (!fechaInicio || !fechaFin) {
          Alert.alert(
            'Fechas Requeridas',
            'Debe seleccionar un rango de fechas para consultar los depósitos Prosegur. Por defecto se usa "Ayer".'
          );
          return;
        }

        // ⚠️ VALIDACIÓN: Rango máximo de 90 días
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

        // ⚠️ CRÍTICO: Fechas SIEMPRE presentes
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

  // Initial load - wait for dates to be set
  useEffect(() => {
    if (fechaInicio && fechaFin) {
      loadDeposits(1);
    }
  }, [fechaInicio, fechaFin]);

  // Handle quick filter selection
  const handleQuickFilterSelect = (filter: QuickDateFilter) => {
    setSelectedQuickFilter(filter);
    const range = getDateRangeByFilter(filter);
    if (range) {
      setFechaInicio(range.fromDate);
      setFechaFin(range.toDate);
    }
  };

  // Apply filters
  const handleApplyFilters = () => {
    loadDeposits(1);
    setShowFilters(false);
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSede('');
    setSelectedTipoMovimiento('');
    // Reset to yesterday
    setSelectedQuickFilter(QUICK_DATE_FILTERS.YESTERDAY);
    const yesterdayRange = getDateRangeByFilter(QUICK_DATE_FILTERS.YESTERDAY);
    if (yesterdayRange) {
      setFechaInicio(yesterdayRange.fromDate);
      setFechaFin(yesterdayRange.toDate);
    }
  };

  // Pagination
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

  // Render deposit item
  const renderDepositItem = (deposit: ProsegurDeposit) => (
    <View key={deposit.id} style={styles.depositCard}>
      <View style={styles.depositHeader}>
        <View style={styles.cashtodayContainer}>
          <Text style={styles.cashtodayLabel}>CashToday</Text>
          <Text style={styles.cashtodayName}>{deposit.cashtoday_nombre}</Text>
        </View>
        <View style={styles.amountContainer}>
          <View
            style={[
              styles.movementBadge,
              {
                backgroundColor:
                  deposit.tipo_movimiento === 'deposito' ? '#10B981' : '#EF4444',
              },
            ]}
          >
            <Text style={styles.movementBadgeText}>
              {deposit.tipo_movimiento === 'deposito' ? '↑ Depósito' : '↓ Recogida'}
            </Text>
          </View>
          <Text
            style={[
              styles.depositAmount,
              {
                color: deposit.tipo_movimiento === 'deposito' ? '#10B981' : '#EF4444',
              },
            ]}
          >
            S/ {deposit.monto.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.depositDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Fecha:</Text>
          <Text style={styles.detailValue}>
            {deposit.fecha_deposito} {deposit.hora_deposito}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Usuario:</Text>
          <Text style={styles.detailValue}>{deposit.usuario}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Cliente:</Text>
          <Text style={styles.detailValue}>{deposit.cliente}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Sede:</Text>
          <Text style={styles.detailValue}>
            {deposit.sede.code} - {deposit.sede.name}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>En Cuadre:</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: deposit.incluida_en_cuadre ? '#DBEAFE' : '#FEE2E2',
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                {
                  color: deposit.incluida_en_cuadre ? '#1E40AF' : '#991B1B',
                },
              ]}
            >
              {deposit.incluida_en_cuadre ? 'Sí' : 'No'}
            </Text>
          </View>
        </View>
        {deposit.notas && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notas:</Text>
            <Text style={styles.notesText}>{deposit.notas}</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Revisar Prosegur</Text>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterButton}>
          <Text style={styles.filterButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

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
        {/* Custom Date Button */}
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
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{pagination.total}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Depósitos</Text>
          <Text style={[styles.statValue, styles.depositText]}>
            {stats.total_depositos}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Recogidas</Text>
          <Text style={[styles.statValue, styles.pickupText]}>
            {stats.total_recogidas}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Monto Depósitos</Text>
          <Text style={[styles.statValue, styles.depositText]}>
            S/ {stats.monto_total_depositos.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Filters Panel */}
      {showFilters && (
        <ScrollView style={styles.filtersPanel} showsVerticalScrollIndicator={false}>
          <Text style={styles.filterTitle}>Filtros de Búsqueda</Text>

          {/* Search */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Búsqueda General</Text>
            <TextInput
              style={styles.input}
              placeholder="Usuario, cliente..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Sede */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Sede</Text>
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

          {/* Tipo Movimiento */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Tipo de Movimiento</Text>
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

          {/* Fecha Inicio */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Fecha Inicio (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-01-01"
              value={fechaInicio}
              onChangeText={(text) => {
                setFechaInicio(text);
                setSelectedQuickFilter(QUICK_DATE_FILTERS.CUSTOM);
              }}
            />
          </View>

          {/* Fecha Fin */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Fecha Fin (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-01-31"
              value={fechaFin}
              onChangeText={(text) => {
                setFechaFin(text);
                setSelectedQuickFilter(QUICK_DATE_FILTERS.CUSTOM);
              }}
            />
            <Text style={styles.filterHint}>
              ⚠️ Obligatorio. Máximo 90 días de rango.
            </Text>
          </View>

          {/* Filter Actions */}
          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClearFilters}>
              <Text style={styles.clearButtonText}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApplyFilters}>
              <Text style={styles.applyButtonText}>Aplicar Filtros</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Deposits List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Cargando depósitos...</Text>
          </View>
        ) : deposits.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏦</Text>
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
            <Text style={styles.paginationButtonText}>← Anterior</Text>
          </TouchableOpacity>
          <Text style={styles.paginationInfo}>
            Página {pagination.page} de {pagination.total_pages}
          </Text>
          <TouchableOpacity
            style={[
              styles.paginationButton,
              pagination.page === pagination.total_pages && styles.paginationButtonDisabled,
            ]}
            onPress={handleNextPage}
            disabled={pagination.page === pagination.total_pages}
          >
            <Text style={styles.paginationButtonText}>Siguiente →</Text>
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
              <TouchableOpacity onPress={() => setShowCustomDateModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Rango de Fechas *</Text>
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
                      <Text style={styles.dateInputText}>
                        {fechaInicio || 'Seleccionar fecha'}
                      </Text>
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
                      <Text style={styles.dateInputText}>
                        {fechaFin || 'Seleccionar fecha'}
                      </Text>
                      <Text style={styles.dateInputIcon}>📅</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* DatePickers */}
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
                <Text style={styles.dateHint}>
                  💡 Máximo 90 días de diferencia
                </Text>
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
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#374151',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 20,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  depositText: {
    color: '#10B981',
  },
  pickupText: {
    color: '#EF4444',
  },
  filtersPanel: {
    backgroundColor: '#FFFFFF',
    maxHeight: 400,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  depositsList: {
    padding: 16,
  },
  depositCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  depositHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cashtodayContainer: {
    flex: 1,
  },
  cashtodayLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  cashtodayName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  movementBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  movementBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  depositAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  depositDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  notesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  notesLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#374151',
    fontStyle: 'italic',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  paginationButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationInfo: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  quickFiltersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    maxHeight: 32,
  },
  quickFiltersContent: {
    paddingHorizontal: 16,
    paddingVertical: 1,
    gap: 4,
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 2,
  },
  quickFilterChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#8B5CF6',
  },
  quickFilterIcon: {
    fontSize: 11,
  },
  quickFilterText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  quickFilterTextActive: {
    color: '#8B5CF6',
  },
  filterHint: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    minHeight: 350,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalClose: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 14,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  dateInputText: {
    fontSize: 16,
    color: '#1F2937',
    flex: 1,
  },
  dateInputIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  dateHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButtonSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  modalButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalButtonPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
  },
  modalButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
