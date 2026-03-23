import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import logger from '@/utils/logger';

interface SalesScreenProps {
  navigation: any;
}

export const SalesScreen: React.FC<SalesScreenProps> = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

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
  const [filterSaleOrigin, setFilterSaleOrigin] = useState<'ALL' | 'INDEPENDENT' | 'CASH_REGISTER'>('ALL');

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
        // No necesitamos includeDocuments, la info de NC ya viene en la respuesta
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

      if (filterSaleOrigin === 'INDEPENDENT') {
        params.isIndependent = true;
      } else if (filterSaleOrigin === 'CASH_REGISTER') {
        params.isIndependent = false;
      }

      const response = await salesApi.getSales(params);

      logger.info('📊 Ventas cargadas:', response.data.length);
      if (response.data.length > 0) {
        logger.info('📊 Primera venta:', response.data[0]);
        logger.info('📝 Info NC primera venta:', {
          hasCreditNote: response.data[0].hasCreditNote,
          creditNoteType: response.data[0].creditNoteType,
          creditNotesCount: response.data[0].creditNotesCount,
          creditNotes: response.data[0].creditNotes,
        });
      }

      // Siempre reemplazar las ventas cuando se cambia de página
      // Solo acumular cuando se usa scroll infinito (handleLoadMore)
      setSales(response.data);

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
  }, [searchText, filterStatus, filterPaymentStatus, filterSaleType, filterSaleOrigin]);

  // Load sales when page changes
  useEffect(() => {
    if (page > 1) {
      loadSales(page);
    }
  }, [page]);

  // Refresh on focus - mantener la página actual
  useFocusEffect(
    useCallback(() => {
      // Solo recargar si estamos en la página 1, sino mantener la página actual
      if (page === 1) {
        loadSales(1, true);
      } else {
        loadSales(page, true);
      }
    }, [page])
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
    navigation.navigate('SaleDetail', { saleId: sale.id });
  };

  const handleCreateSale = useCallback(() => {
    navigation.navigate('CreateSale');
  }, [navigation]);

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

  const renderSaleCard = useCallback((sale: any) => {
    // Usar la nueva estructura de la API
    const customerName = sale.customerName || sale.customerSnapshot?.fullName || sale.companySnapshot?.razonSocial || 'Sin cliente';
    const isIndependent = sale.source === 'INDEPENDIENTE' || !sale.cashRegisterId;

    // Obtener métodos de pago de la nueva estructura
    const paymentMethodsText = sale.paymentMethods && sale.paymentMethods.length > 0
      ? sale.paymentMethods.map((pm: any) => pm.methodName).join(', ')
      : 'Sin pagos';

    // Obtener nombre del vendedor/cajero
    const sellerName = sale.cashierSnapshot?.name || sale.sellerSnapshot?.name || null;

    // Obtener nombre de la caja
    const cashRegisterName = sale.cashRegisterSnapshot?.name || null;

    // Helper para obtener labels de forma segura
    const getSaleStatusLabel = (status: string) => {
      return SaleStatusLabels[status as SaleStatus] || status;
    };

    const getPaymentStatusLabel = (status: string) => {
      return PaymentStatusLabels[status as PaymentStatus] || status;
    };

    return (
      <TouchableOpacity
        key={sale.id}
        style={[styles.card, isTablet && styles.cardTablet]}
        onPress={() => handleSalePress(sale)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.cardCode, isTablet && styles.cardCodeTablet]}>{sale.code}</Text>
            <View style={styles.badges}>
              {/* Origen de venta */}
              <View style={[styles.statusBadge, { backgroundColor: isIndependent ? '#8B5CF620' : '#10B98120', borderColor: isIndependent ? '#8B5CF6' : '#10B981', borderWidth: 1 }]}>
                <Text style={[styles.statusText, { color: isIndependent ? '#8B5CF6' : '#10B981' }]}>
                  {isIndependent ? '🔓 Independiente' : '💰 Caja'}
                </Text>
              </View>
              {/* Estado */}
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(sale.status) + '20', borderColor: getStatusColor(sale.status), borderWidth: 1 }]}>
                <Text style={[styles.statusText, { color: getStatusColor(sale.status) }]}>
                  {getSaleStatusLabel(sale.status)}
                </Text>
              </View>
              {/* Nota de Crédito */}
              {sale.hasCreditNote && (
                <View style={[styles.statusBadge, { backgroundColor: '#F59E0B20', borderColor: '#F59E0B', borderWidth: 1 }]}>
                  <Text style={[styles.statusText, { color: '#F59E0B' }]}>
                    📝 NC {sale.creditNoteType === 'TOTAL' ? 'Total' : 'Parcial'}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.cardDate, isTablet && styles.cardDateTablet]}>
            {new Date(sale.saleDate).toLocaleDateString('es-PE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Cliente:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
              {customerName}
            </Text>
          </View>

          {sale.customerDocument && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Documento:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
                {sale.customerDocument}
              </Text>
            </View>
          )}

          {/* Mostrar vendedor/cajero si está disponible */}
          {sellerName && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                {isIndependent ? 'Vendedor:' : 'Cajero:'}
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
                {sellerName}
              </Text>
            </View>
          )}

          {/* Mostrar caja si no es independiente */}
          {!isIndependent && cashRegisterName && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Caja:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
                {cashRegisterName}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Items:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {sale.itemCount} ({sale.totalQuantity} unidades)
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Pago:</Text>
            <View style={[styles.paymentBadge, { backgroundColor: getPaymentStatusColor(sale.paymentStatus) + '20', borderColor: getPaymentStatusColor(sale.paymentStatus), borderWidth: 1 }]}>
              <Text style={[styles.paymentBadgeText, { color: getPaymentStatusColor(sale.paymentStatus) }]}>
                {getPaymentStatusLabel(sale.paymentStatus)}
              </Text>
            </View>
          </View>

          {/* Métodos de pago */}
          {sale.paymentMethods && sale.paymentMethods.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Método:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet, styles.paymentMethodText]} numberOfLines={1}>
                {paymentMethodsText}
              </Text>
            </View>
          )}

          {/* Mostrar información de Nota de Crédito si existe */}
          {sale.hasCreditNote && sale.creditNotesCount > 0 && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>NC Monto:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet, { color: '#F59E0B' }]}>
                S/ {sale.creditedAmount?.toFixed(2) || '0.00'} ({sale.creditNotesCount} NC)
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={[styles.footerText, isTablet && styles.footerTextTablet]}>
              S/ {sale.total?.toFixed(2) || (sale.totalCents / 100).toFixed(2)}
            </Text>
            {sale.balanceCents > 0 && (
              <Text style={[styles.balanceText, { fontSize: 12, marginTop: 2 }]}>
                Saldo: S/ {sale.balance?.toFixed(2) || (sale.balanceCents / 100).toFixed(2)}
              </Text>
            )}
          </View>
          <Text style={[styles.arrowIcon, isTablet && styles.arrowIconTablet]}>›</Text>
        </View>
      </TouchableOpacity>
    );
  }, [isTablet, handleSalePress]);

  if (loading && !refreshing) {
    return (
      <ScreenLayout navigation={navigation}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Cargando ventas...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>Ventas</Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              Gestión de ventas B2C y B2B
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, isTablet && styles.searchInputTablet]}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Buscar por código, cliente..."
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          {/* Filtro de Origen */}
          <View style={styles.filtersSection}>
            <Text style={[styles.filterTitle, isTablet && styles.filterTitleTablet]}>Origen de Venta</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <View style={styles.filterButtons}>
                <TouchableOpacity
                  style={[styles.filterButton, filterSaleOrigin === 'ALL' && styles.filterButtonActive]}
                  onPress={() => setFilterSaleOrigin('ALL')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterButtonText, filterSaleOrigin === 'ALL' && styles.filterButtonTextActive]}>
                    Todas
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterButton, filterSaleOrigin === 'INDEPENDENT' && styles.filterButtonActive]}
                  onPress={() => setFilterSaleOrigin('INDEPENDENT')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterButtonText, filterSaleOrigin === 'INDEPENDENT' && styles.filterButtonTextActive]}>
                    🔓 Independientes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterButton, filterSaleOrigin === 'CASH_REGISTER' && styles.filterButtonActive]}
                  onPress={() => setFilterSaleOrigin('CASH_REGISTER')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterButtonText, filterSaleOrigin === 'CASH_REGISTER' && styles.filterButtonTextActive]}>
                    💰 De Caja
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          {/* Filtro de Estado */}
          <View style={styles.filtersSection}>
            <Text style={[styles.filterTitle, isTablet && styles.filterTitleTablet]}>Estado</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <View style={styles.filterButtons}>
                <TouchableOpacity
                  style={[styles.filterButton, filterStatus === 'ALL' && styles.filterButtonActive]}
                  onPress={() => setFilterStatus('ALL')}
                  activeOpacity={0.7}
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
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterButtonText, filterStatus === status && styles.filterButtonTextActive]}>
                      {SaleStatusLabels[status]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Filtro de Pago */}
          <View style={styles.filtersSection}>
            <Text style={[styles.filterTitle, isTablet && styles.filterTitleTablet]}>Pago</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <View style={styles.filterButtons}>
                <TouchableOpacity
                  style={[styles.filterButton, filterPaymentStatus === 'ALL' && styles.filterButtonActive]}
                  onPress={() => setFilterPaymentStatus('ALL')}
                  activeOpacity={0.7}
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
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterButtonText, filterPaymentStatus === status && styles.filterButtonTextActive]}>
                      {PaymentStatusLabels[status]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Sales List */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            isTablet && styles.contentContainerTablet,
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {sales.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyIcon, isTablet && styles.emptyIconTablet]}>💰</Text>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay ventas registradas
              </Text>
              <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                Crea una nueva venta para comenzar
              </Text>
            </View>
          ) : (
            sales.map(renderSaleCard)
          )}

          {loading && page > 1 && (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Pagination Controls */}
        {total > 0 && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[
                styles.paginationButton,
                page === 1 && styles.paginationButtonDisabled,
              ]}
              onPress={() => page > 1 && setPage(page - 1)}
              disabled={page === 1}
            >
              <Text
                style={[
                  styles.paginationButtonText,
                  page === 1 && styles.paginationButtonTextDisabled,
                ]}
              >
                ← Anterior
              </Text>
            </TouchableOpacity>

            <View style={styles.paginationInfo}>
              <Text style={styles.paginationText}>
                Pág. {page}/{totalPages}
              </Text>
              <Text style={styles.paginationSubtext}>
                {sales.length} de {total}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.paginationButton,
                page >= totalPages && styles.paginationButtonDisabled,
              ]}
              onPress={() => page < totalPages && setPage(page + 1)}
              disabled={page >= totalPages}
            >
              <Text
                style={[
                  styles.paginationButtonText,
                  page >= totalPages && styles.paginationButtonTextDisabled,
                ]}
              >
                Siguiente →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Add Button */}
        <ProtectedFAB
          icon="+"
          onPress={handleCreateSale}
          requiredPermissions={['sales.create']}
          hideIfNoPermission={true}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  titleTablet: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  subtitleTablet: {
    fontSize: 16,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#1E293B',
  },
  searchInputTablet: {
    fontSize: 16,
    padding: 14,
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
  },
  filtersSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  filterTitleTablet: {
    fontSize: 14,
  },
  filterScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  contentContainerTablet: {
    padding: 32,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTablet: {
    padding: 24,
    borderRadius: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 8,
  },
  cardCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  cardCodeTablet: {
    fontSize: 20,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardDate: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  cardDateTablet: {
    fontSize: 15,
  },
  cardBody: {
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    width: 110,
  },
  infoLabelTablet: {
    fontSize: 15,
    width: 130,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  infoValueTablet: {
    fontSize: 16,
  },
  balanceText: {
    color: '#EF4444',
  },
  paymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paymentMethodText: {
    color: '#3B82F6',
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '700',
  },
  footerTextTablet: {
    fontSize: 16,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#CBD5E1',
    fontWeight: '300',
  },
  arrowIconTablet: {
    fontSize: 28,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyIconTablet: {
    fontSize: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  emptyTextTablet: {
    fontSize: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
  },
  emptySubtextTablet: {
    fontSize: 16,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  bottomSpacer: {
    height: 100,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    minWidth: 100,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {
    color: '#94A3B8',
  },
  paginationInfo: {
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
});
