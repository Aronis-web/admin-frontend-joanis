import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { salesApi } from '@/services/api/sales';
import {
  Sale,
  SaleType,
  SaleStatus,
  PaymentStatus,
  SaleTypeLabels,
  SaleStatusLabels,
  PaymentStatusLabels,
} from '@/types/sales';
import logger from '@/utils/logger';

interface SalesScreenProps {
  navigation: any;
}

export const SalesScreen: React.FC<SalesScreenProps> = () => {
  const navigation = useNavigation();

  // State
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchText, setSearchText] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState<SaleStatus | 'ALL'>('ALL');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<PaymentStatus | 'ALL'>('ALL');
  const [filterSaleType, setFilterSaleType] = useState<SaleType | 'ALL'>('ALL');

  // Load sales
  const loadSales = async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const params: any = {
        page: pageNum,
        limit: 20,
        includeItems: true,
      };

      if (searchText.trim()) {
        params.search = searchText.trim();
      }

      if (filterStatus !== 'ALL') {
        params.status = filterStatus;
      }

      if (filterPaymentStatus !== 'ALL') {
        params.paymentStatus = filterPaymentStatus;
      }

      if (filterSaleType !== 'ALL') {
        params.saleType = filterSaleType;
      }

      const response = await salesApi.getSales(params);

      if (isRefresh || pageNum === 1) {
        setSales(response.data);
      } else {
        setSales([...sales, ...response.data]);
      }

      setPage(response.page);
      setTotalPages(response.totalPages);
      setTotal(response.total);
    } catch (error) {
      logger.error('Error cargando ventas:', error);
      Alert.alert('Error', 'No se pudieron cargar las ventas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadSales(1);
  }, [searchText, filterStatus, filterPaymentStatus, filterSaleType]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadSales(1, true);
    }, [])
  );

  const handleRefresh = () => {
    loadSales(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && page < totalPages) {
      loadSales(page + 1);
    }
  };

  const handleSalePress = (sale: Sale) => {
    (navigation as any).navigate('SaleDetail', { saleId: sale.id });
  };

  const getStatusColor = (status: SaleStatus) => {
    switch (status) {
      case SaleStatus.CONFIRMED:
        return '#10B981';
      case SaleStatus.COMPLETED:
        return '#3B82F6';
      case SaleStatus.CANCELLED:
        return '#EF4444';
      case SaleStatus.DRAFT:
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return '#10B981';
      case PaymentStatus.PARTIAL:
        return '#F59E0B';
      case PaymentStatus.PENDING:
        return '#6B7280';
      case PaymentStatus.OVERDUE:
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const renderSaleItem = ({ item }: { item: Sale }) => {
    const customerName = item.customerSnapshot?.fullName || item.companySnapshot?.razonSocial || 'Sin cliente';
    const documentNumber = item.customerSnapshot?.documentNumber || item.companySnapshot?.ruc || '';

    return (
      <TouchableOpacity
        style={styles.saleCard}
        onPress={() => handleSalePress(item)}
      >
        <View style={styles.saleHeader}>
          <View style={styles.saleHeaderLeft}>
            <Text style={styles.saleCode}>{item.code}</Text>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.badgeText}>{SaleStatusLabels[item.status]}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: item.saleType === SaleType.B2C ? '#F59E0B' : '#3B82F6' }]}>
                <Text style={styles.badgeText}>{SaleTypeLabels[item.saleType]}</Text>
              </View>
            </View>
          </View>
          <View style={styles.saleHeaderRight}>
            <Text style={styles.saleTotal}>S/ {(item.totalCents / 100).toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.saleBody}>
          <View style={styles.saleRow}>
            <Text style={styles.saleLabel}>Cliente:</Text>
            <Text style={styles.saleValue} numberOfLines={1}>
              {customerName}
            </Text>
          </View>

          {documentNumber && (
            <View style={styles.saleRow}>
              <Text style={styles.saleLabel}>Documento:</Text>
              <Text style={styles.saleValue}>{documentNumber}</Text>
            </View>
          )}

          <View style={styles.saleRow}>
            <Text style={styles.saleLabel}>Productos:</Text>
            <Text style={styles.saleValue}>{item.itemCount} items ({item.totalQuantity} unidades)</Text>
          </View>

          <View style={styles.saleRow}>
            <Text style={styles.saleLabel}>Fecha:</Text>
            <Text style={styles.saleValue}>
              {new Date(item.saleDate).toLocaleDateString('es-PE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </Text>
          </View>

          <View style={styles.saleRow}>
            <Text style={styles.saleLabel}>Estado de Pago:</Text>
            <View style={[styles.paymentBadge, { backgroundColor: getPaymentStatusColor(item.paymentStatus) }]}>
              <Text style={styles.paymentBadgeText}>{PaymentStatusLabels[item.paymentStatus]}</Text>
            </View>
          </View>

          {item.paymentStatus !== PaymentStatus.PAID && (
            <View style={styles.saleRow}>
              <Text style={styles.saleLabel}>Saldo:</Text>
              <Text style={[styles.saleValue, styles.balanceText]}>
                S/ {(item.balanceCents / 100).toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Ventas</Text>
      <Text style={styles.subtitle}>Total: {total} ventas</Text>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Buscar por código, cliente..."
        placeholderTextColor="#999"
      />

      {/* Filters */}
      <View style={styles.filtersSection}>
        <Text style={styles.filterTitle}>Estado de Venta</Text>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'ALL' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('ALL')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'ALL' && styles.filterButtonTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
          {Object.values(SaleStatus).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterButton, filterStatus === status && styles.filterButtonActive]}
              onPress={() => setFilterStatus(status)}
            >
              <Text style={[styles.filterButtonText, filterStatus === status && styles.filterButtonTextActive]}>
                {SaleStatusLabels[status]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.filtersSection}>
        <Text style={styles.filterTitle}>Estado de Pago</Text>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, filterPaymentStatus === 'ALL' && styles.filterButtonActive]}
            onPress={() => setFilterPaymentStatus('ALL')}
          >
            <Text style={[styles.filterButtonText, filterPaymentStatus === 'ALL' && styles.filterButtonTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
          {Object.values(PaymentStatus).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterButton, filterPaymentStatus === status && styles.filterButtonActive]}
              onPress={() => setFilterPaymentStatus(status)}
            >
              <Text style={[styles.filterButtonText, filterPaymentStatus === status && styles.filterButtonTextActive]}>
                {PaymentStatusLabels[status]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.filtersSection}>
        <Text style={styles.filterTitle}>Tipo de Venta</Text>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, filterSaleType === 'ALL' && styles.filterButtonActive]}
            onPress={() => setFilterSaleType('ALL')}
          >
            <Text style={[styles.filterButtonText, filterSaleType === 'ALL' && styles.filterButtonTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
          {Object.values(SaleType).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.filterButton, filterSaleType === type && styles.filterButtonActive]}
              onPress={() => setFilterSaleType(type)}
            >
              <Text style={[styles.filterButtonText, filterSaleType === type && styles.filterButtonTextActive]}>
                {SaleTypeLabels[type]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loading || page === 1) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#007bff" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading && page === 1) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.emptyText}>Cargando ventas...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hay ventas registradas</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={sales}
        renderItem={renderSaleItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => (navigation as any).navigate('CreateSale')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
  },
  filtersSection: {
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  filterButtonActive: {
    borderColor: '#007bff',
    backgroundColor: '#E3F2FD',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#007bff',
    fontWeight: '600',
  },
  saleCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  saleHeaderLeft: {
    flex: 1,
  },
  saleCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  saleHeaderRight: {
    alignItems: 'flex-end',
  },
  saleTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
  },
  saleBody: {
    gap: 8,
  },
  saleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saleLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  saleValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  balanceText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
});
