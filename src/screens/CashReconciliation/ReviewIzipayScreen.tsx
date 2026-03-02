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
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Sedes
  const [sedes, setSedes] = useState<Site[]>([]);
  const [isLoadingSedes, setIsLoadingSedes] = useState(false);

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
        if (isRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', pagination.limit.toString());

        if (searchQuery) params.append('search', searchQuery);
        if (selectedSede) params.append('sede_id', selectedSede);
        if (fechaInicio) params.append('fecha_inicio', fechaInicio);
        if (fechaFin) params.append('fecha_fin', fechaFin);

        const response = await fetch(
          `${config.API_URL}/cash-reconciliation/izipay?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-App-Id': config.APP_ID,
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

  // Initial load
  useEffect(() => {
    loadTransactions(1);
  }, []);

  // Apply filters
  const handleApplyFilters = () => {
    loadTransactions(1);
    setShowFilters(false);
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSede('');
    setFechaInicio('');
    setFechaFin('');
    loadTransactions(1);
  };

  // Pagination
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

  // Render transaction item
  const renderTransactionItem = (transaction: IzipayTransaction) => (
    <View key={transaction.id} style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <View style={styles.authContainer}>
          <Text style={styles.authLabel}>Autorización</Text>
          <Text style={styles.authNumber}>{transaction.numero_autorizacion}</Text>
        </View>
        <Text style={styles.transactionAmount}>S/ {transaction.monto_neto.toFixed(2)}</Text>
      </View>

      <View style={styles.transactionDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Fecha:</Text>
          <Text style={styles.detailValue}>{transaction.fecha_transaccion}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Código Comercio:</Text>
          <Text style={styles.detailValue}>{transaction.codigo_comercio}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Monto Bruto:</Text>
          <Text style={styles.detailValue}>S/ {transaction.monto_bruto.toFixed(2)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Comisión:</Text>
          <Text style={[styles.detailValue, styles.commissionText]}>
            - S/ {transaction.comision.toFixed(2)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Sede:</Text>
          <Text style={styles.detailValue}>
            {transaction.sede.code} - {transaction.sede.name}
          </Text>
        </View>
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
        <Text style={styles.headerTitle}>Revisar Izipay</Text>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterButton}>
          <Text style={styles.filterButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{pagination.total}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Monto Bruto</Text>
          <Text style={styles.statValue}>S/ {stats.total_monto_bruto.toFixed(2)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Comisión</Text>
          <Text style={[styles.statValue, styles.commissionText]}>
            S/ {stats.total_comision.toFixed(2)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Monto Neto</Text>
          <Text style={[styles.statValue, styles.netAmountText]}>
            S/ {stats.total_monto_neto.toFixed(2)}
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
              placeholder="Número autorización, código comercio..."
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

          {/* Fecha Inicio */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Fecha Inicio (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-01-01"
              value={fechaInicio}
              onChangeText={setFechaInicio}
            />
          </View>

          {/* Fecha Fin */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Fecha Fin (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-01-31"
              value={fechaFin}
              onChangeText={setFechaFin}
            />
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

      {/* Transactions List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Cargando transacciones...</Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💳</Text>
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
  commissionText: {
    color: '#EF4444',
  },
  netAmountText: {
    color: '#10B981',
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
    backgroundColor: '#3B82F6',
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
  transactionsList: {
    padding: 16,
  },
  transactionCard: {
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
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  authContainer: {
    flex: 1,
  },
  authLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  authNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  transactionDetails: {
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
    backgroundColor: '#3B82F6',
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
});
