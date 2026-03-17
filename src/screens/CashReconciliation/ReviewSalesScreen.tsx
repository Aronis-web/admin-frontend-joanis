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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  // Load sales
  const loadSales = useCallback(
    async (page: number = 1, isRefresh: boolean = false) => {
      try {
        // ⚠️ VALIDACIÓN: Fechas obligatorias para evitar escaneo de particiones
        if (!fechaInicio || !fechaFin) {
          Alert.alert(
            'Fechas Requeridas',
            'Debe seleccionar un rango de fechas para consultar las ventas. Por defecto se usa "Ayer".'
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
        if (selectedTipoPago) params.append('tipo_pago', selectedTipoPago);
        if (selectedTipoDocumento) params.append('tipo_documento', selectedTipoDocumento);

        const response = await fetch(
          `${config.API_URL}/cash-reconciliation/sales?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-App-Id': config.APP_ID,
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

  // Initial load - wait for dates to be set
  useEffect(() => {
    if (fechaInicio && fechaFin) {
      loadSales(1);
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
    loadSales(1);
    setShowFilters(false);
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSede('');
    setSelectedTipoPago('');
    setSelectedTipoDocumento('');
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

  // Render sale item
  const renderSaleItem = (sale: Sale) => (
    <View key={sale.id} style={styles.saleCard}>
      <View style={styles.saleHeader}>
        <View style={styles.saleIdContainer}>
          <Text style={styles.saleId}>{sale.sale_id}</Text>
          <View style={[styles.badge, { backgroundColor: getDocumentTypeColor(sale.tipo_documento) }]}>
            <Text style={styles.badgeText}>{sale.tipo_documento}</Text>
          </View>
        </View>
        <Text style={styles.saleAmount}>S/ {sale.monto.toFixed(2)}</Text>
      </View>

      <View style={styles.saleDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Fecha:</Text>
          <Text style={styles.detailValue}>
            {sale.fecha_venta} {sale.hora_venta}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Cliente:</Text>
          <Text style={styles.detailValue}>{sale.cliente}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tipo Pago:</Text>
          <Text style={styles.detailValue}>{sale.tipo_pago}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Sede:</Text>
          <Text style={styles.detailValue}>
            {sale.sede.code} - {sale.sede.name}
          </Text>
        </View>
      </View>
    </View>
  );

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case 'B':
        return '#10B981';
      case 'F':
        return '#3B82F6';
      case 'NC':
        return '#EF4444';
      case 'ND':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Revisar Ventas</Text>
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
      </ScrollView>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Registros</Text>
          <Text style={styles.statValue}>{pagination.total}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Monto Total</Text>
          <Text style={styles.statValue}>S/ {stats.total_monto.toFixed(2)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Promedio</Text>
          <Text style={styles.statValue}>S/ {stats.promedio_monto.toFixed(2)}</Text>
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
              placeholder="ID, serie, número, cliente..."
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

          {/* Tipo Pago */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Tipo de Pago</Text>
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

          {/* Tipo Documento */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Tipo de Documento</Text>
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

      {/* Sales List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Cargando ventas...</Text>
          </View>
        ) : sales.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No se encontraron ventas</Text>
            <Text style={styles.emptySubtext}>Intenta ajustar los filtros de búsqueda</Text>
          </View>
        ) : (
          <View style={styles.salesList}>{sales.map(renderSaleItem)}</View>
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
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
    backgroundColor: '#10B981',
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
  salesList: {
    padding: 16,
  },
  saleCard: {
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
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  saleIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saleId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saleAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  saleDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    backgroundColor: '#10B981',
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
  },
  quickFiltersContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
  },
  quickFilterChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#10B981',
  },
  quickFilterIcon: {
    fontSize: 16,
  },
  quickFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  quickFilterTextActive: {
    color: '#10B981',
  },
  filterHint: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
