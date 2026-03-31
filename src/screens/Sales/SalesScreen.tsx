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
  useWindowDimensions,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
import { colors, spacing, borderRadius, shadows } from '@/design-system/tokens';
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
  const [showFiltersModal, setShowFiltersModal] = useState(false);

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

  useEffect(() => {
    loadSales(page);
  }, [page, searchText, filterStatus, filterPaymentStatus, filterSaleType, filterSaleOrigin]);

  const lastFetchRef = React.useRef<number>(0);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const isStale = now - lastFetchRef.current > 5 * 60 * 1000;

      if (isStale) {
        lastFetchRef.current = now;
        loadSales(page, true);
      }
    }, [page])
  );

  const handleRefresh = () => {
    loadSales(1, true);
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
        return colors.success[500];
      case SaleStatus.COMPLETED:
        return colors.accent[500];
      case SaleStatus.CANCELLED:
        return colors.danger[500];
      case SaleStatus.DRAFT:
        return colors.warning[500];
      default:
        return colors.neutral[500];
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return colors.success[500];
      case PaymentStatus.PARTIAL:
        return colors.warning[500];
      case PaymentStatus.PENDING:
        return colors.neutral[500];
      case PaymentStatus.OVERDUE:
        return colors.danger[500];
      default:
        return colors.neutral[500];
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filterStatus !== 'ALL') count++;
    if (filterPaymentStatus !== 'ALL') count++;
    if (filterSaleType !== 'ALL') count++;
    if (filterSaleOrigin !== 'ALL') count++;
    return count;
  };

  const clearAllFilters = () => {
    setFilterStatus('ALL');
    setFilterPaymentStatus('ALL');
    setFilterSaleType('ALL');
    setFilterSaleOrigin('ALL');
  };

  const renderSaleCard = useCallback((sale: any) => {
    const customerName = sale.customerName || sale.customerSnapshot?.fullName || sale.companySnapshot?.razonSocial || 'Sin cliente';
    const isIndependent = sale.source === 'INDEPENDIENTE' || !sale.cashRegisterId;
    const paymentMethodsText = sale.paymentMethods && sale.paymentMethods.length > 0
      ? sale.paymentMethods.map((pm: any) => pm.methodName).join(', ')
      : 'Sin pagos';
    const sellerName = sale.cashierSnapshot?.name || sale.sellerSnapshot?.name || null;
    const cashRegisterName = sale.cashRegisterSnapshot?.name || null;

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
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.codeContainer}>
              <Ionicons name="receipt-outline" size={18} color={colors.accent[600]} />
              <Text style={[styles.cardCode, isTablet && styles.cardCodeTablet]}>{sale.code}</Text>
            </View>
            <View style={styles.badges}>
              {/* Origen */}
              <View style={[styles.badge, { backgroundColor: isIndependent ? colors.info[50] : colors.success[50] }]}>
                <Ionicons
                  name={isIndependent ? "person-outline" : "cash-outline"}
                  size={12}
                  color={isIndependent ? colors.info[600] : colors.success[600]}
                />
                <Text style={[styles.badgeText, { color: isIndependent ? colors.info[600] : colors.success[600] }]}>
                  {isIndependent ? 'Independiente' : 'Caja'}
                </Text>
              </View>
              {/* Estado */}
              <View style={[styles.badge, { backgroundColor: getStatusColor(sale.status) + '15' }]}>
                <View style={[styles.badgeDot, { backgroundColor: getStatusColor(sale.status) }]} />
                <Text style={[styles.badgeText, { color: getStatusColor(sale.status) }]}>
                  {getSaleStatusLabel(sale.status)}
                </Text>
              </View>
              {/* Nota de Crédito */}
              {sale.hasCreditNote && (
                <View style={[styles.badge, { backgroundColor: colors.warning[50] }]}>
                  <Ionicons name="document-text-outline" size={12} color={colors.warning[600]} />
                  <Text style={[styles.badgeText, { color: colors.warning[600] }]}>
                    NC {sale.creditNoteType === 'TOTAL' ? 'Total' : 'Parcial'}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.cardDate}>
              {new Date(sale.saleDate).toLocaleDateString('es-PE', {
                day: '2-digit',
                month: 'short',
              })}
            </Text>
            <Text style={styles.cardTime}>
              {new Date(sale.saleDate).toLocaleTimeString('es-PE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>

        {/* Card Body */}
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={16} color={colors.neutral[400]} />
            <Text style={styles.infoLabel}>Cliente</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
              {customerName}
            </Text>
          </View>

          {sale.customerDocument && (
            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={16} color={colors.neutral[400]} />
              <Text style={styles.infoLabel}>Doc.</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
                {sale.customerDocument}
              </Text>
            </View>
          )}

          {sellerName && (
            <View style={styles.infoRow}>
              <Ionicons name="briefcase-outline" size={16} color={colors.neutral[400]} />
              <Text style={styles.infoLabel}>{isIndependent ? 'Vendedor' : 'Cajero'}</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
                {sellerName}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={16} color={colors.neutral[400]} />
            <Text style={styles.infoLabel}>Items</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {sale.itemCount} ({sale.totalQuantity} uds.)
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="wallet-outline" size={16} color={colors.neutral[400]} />
            <Text style={styles.infoLabel}>Pago</Text>
            <View style={[styles.paymentBadge, { backgroundColor: getPaymentStatusColor(sale.paymentStatus) + '15' }]}>
              <Text style={[styles.paymentBadgeText, { color: getPaymentStatusColor(sale.paymentStatus) }]}>
                {getPaymentStatusLabel(sale.paymentStatus)}
              </Text>
            </View>
          </View>

          {sale.hasCreditNote && sale.creditNotesCount > 0 && (
            <View style={styles.infoRow}>
              <Ionicons name="return-down-back-outline" size={16} color={colors.warning[500]} />
              <Text style={[styles.infoLabel, { color: colors.warning[600] }]}>NC</Text>
              <Text style={[styles.infoValue, { color: colors.warning[600] }]}>
                S/ {sale.creditedAmount?.toFixed(2) || '0.00'} ({sale.creditNotesCount})
              </Text>
            </View>
          )}
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={[styles.totalValue, isTablet && styles.totalValueTablet]}>
              S/ {sale.total?.toFixed(2) || (sale.totalCents / 100).toFixed(2)}
            </Text>
            {sale.balanceCents > 0 && (
              <Text style={styles.balanceText}>
                Saldo: S/ {sale.balance?.toFixed(2) || (sale.balanceCents / 100).toFixed(2)}
              </Text>
            )}
          </View>
          <View style={styles.arrowContainer}>
            <Ionicons name="chevron-forward" size={24} color={colors.neutral[300]} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [isTablet, handleSalePress]);

  const renderFilterChip = (
    label: string,
    value: string,
    currentValue: string,
    onPress: () => void,
    icon?: string
  ) => (
    <TouchableOpacity
      style={[
        styles.filterChip,
        currentValue === value && styles.filterChipActive,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && (
        <Ionicons
          name={icon as any}
          size={14}
          color={currentValue === value ? colors.neutral[0] : colors.neutral[500]}
          style={{ marginRight: 4 }}
        />
      )}
      <Text style={[
        styles.filterChipText,
        currentValue === value && styles.filterChipTextActive,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[colors.primary[900], colors.primary[800]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="cart" size={22} color={colors.neutral[0]} />
                </View>
                <Text style={[styles.title, isTablet && styles.titleTablet]}>Ventas</Text>
              </View>
              <Text style={styles.subtitle}>
                Gestión de ventas B2C y B2B
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Buscar por código, cliente..."
                placeholderTextColor={colors.neutral[400]}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color={colors.neutral[400]} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.filterButton, getActiveFiltersCount() > 0 && styles.filterButtonActive]}
              onPress={() => setShowFiltersModal(true)}
            >
              <Ionicons
                name="options"
                size={20}
                color={getActiveFiltersCount() > 0 ? colors.neutral[0] : colors.neutral[600]}
              />
              {getActiveFiltersCount() > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Quick Filters */}
        <View style={styles.quickFiltersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickFiltersContent}
          >
            {renderFilterChip('Todas', 'ALL', filterSaleOrigin, () => setFilterSaleOrigin('ALL'))}
            {renderFilterChip('Independientes', 'INDEPENDENT', filterSaleOrigin, () => setFilterSaleOrigin('INDEPENDENT'), 'person-outline')}
            {renderFilterChip('De Caja', 'CASH_REGISTER', filterSaleOrigin, () => setFilterSaleOrigin('CASH_REGISTER'), 'cash-outline')}
            <View style={styles.filterDivider} />
            {renderFilterChip('Pendiente', PaymentStatus.PENDING, filterPaymentStatus, () =>
              setFilterPaymentStatus(filterPaymentStatus === PaymentStatus.PENDING ? 'ALL' : PaymentStatus.PENDING)
            )}
            {renderFilterChip('Pagado', PaymentStatus.PAID, filterPaymentStatus, () =>
              setFilterPaymentStatus(filterPaymentStatus === PaymentStatus.PAID ? 'ALL' : PaymentStatus.PAID)
            )}
          </ScrollView>
        </View>

        {/* Loading State */}
        {loading && !refreshing && sales.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent[500]} />
            <Text style={styles.loadingText}>Cargando ventas...</Text>
          </View>
        ) : (
          /* Sales List */
          <FlatList
            data={sales}
            renderItem={({ item }) => renderSaleCard(item)}
            keyExtractor={(item) => item.id}
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer,
              isTablet && styles.contentContainerTablet,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.accent[500]]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="cart-outline" size={64} color={colors.neutral[300]} />
                </View>
                <Text style={styles.emptyText}>No hay ventas registradas</Text>
                <Text style={styles.emptySubtext}>
                  Crea una nueva venta para comenzar
                </Text>
                <TouchableOpacity style={styles.emptyButton} onPress={handleCreateSale}>
                  <Ionicons name="add" size={20} color={colors.neutral[0]} />
                  <Text style={styles.emptyButtonText}>Nueva Venta</Text>
                </TouchableOpacity>
              </View>
            }
            ListFooterComponent={
              <>
                {loading && page > 1 && (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={colors.accent[500]} />
                  </View>
                )}
                <View style={styles.bottomSpacer} />
              </>
            }
            windowSize={5}
            maxToRenderPerBatch={10}
            initialNumToRender={10}
            removeClippedSubviews={true}
          />
        )}

        {/* Pagination */}
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
              <Ionicons
                name="chevron-back"
                size={20}
                color={page === 1 ? colors.neutral[300] : colors.neutral[0]}
              />
              <Text style={[
                styles.paginationButtonText,
                page === 1 && styles.paginationButtonTextDisabled,
              ]}>
                Anterior
              </Text>
            </TouchableOpacity>

            <View style={styles.paginationInfo}>
              <Text style={styles.paginationText}>
                Página {page} de {totalPages}
              </Text>
              <Text style={styles.paginationSubtext}>
                {sales.length} de {total} ventas
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
              <Text style={[
                styles.paginationButtonText,
                page >= totalPages && styles.paginationButtonTextDisabled,
              ]}>
                Siguiente
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={page >= totalPages ? colors.neutral[300] : colors.neutral[0]}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Filters Modal */}
        <Modal
          visible={showFiltersModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowFiltersModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filtros</Text>
                <TouchableOpacity onPress={() => setShowFiltersModal(false)}>
                  <Ionicons name="close" size={24} color={colors.neutral[500]} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Estado de Venta */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Estado de Venta</Text>
                  <View style={styles.filterOptions}>
                    <TouchableOpacity
                      style={[styles.filterOption, filterStatus === 'ALL' && styles.filterOptionActive]}
                      onPress={() => setFilterStatus('ALL')}
                    >
                      <Text style={[styles.filterOptionText, filterStatus === 'ALL' && styles.filterOptionTextActive]}>
                        Todos
                      </Text>
                    </TouchableOpacity>
                    {Object.values(SaleStatus).map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[styles.filterOption, filterStatus === status && styles.filterOptionActive]}
                        onPress={() => setFilterStatus(status)}
                      >
                        <View style={[styles.filterDot, { backgroundColor: getStatusColor(status) }]} />
                        <Text style={[styles.filterOptionText, filterStatus === status && styles.filterOptionTextActive]}>
                          {SaleStatusLabels[status]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Estado de Pago */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Estado de Pago</Text>
                  <View style={styles.filterOptions}>
                    <TouchableOpacity
                      style={[styles.filterOption, filterPaymentStatus === 'ALL' && styles.filterOptionActive]}
                      onPress={() => setFilterPaymentStatus('ALL')}
                    >
                      <Text style={[styles.filterOptionText, filterPaymentStatus === 'ALL' && styles.filterOptionTextActive]}>
                        Todos
                      </Text>
                    </TouchableOpacity>
                    {Object.values(PaymentStatus).map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[styles.filterOption, filterPaymentStatus === status && styles.filterOptionActive]}
                        onPress={() => setFilterPaymentStatus(status)}
                      >
                        <View style={[styles.filterDot, { backgroundColor: getPaymentStatusColor(status) }]} />
                        <Text style={[styles.filterOptionText, filterPaymentStatus === status && styles.filterOptionTextActive]}>
                          {PaymentStatusLabels[status]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Origen de Venta */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Origen de Venta</Text>
                  <View style={styles.filterOptions}>
                    <TouchableOpacity
                      style={[styles.filterOption, filterSaleOrigin === 'ALL' && styles.filterOptionActive]}
                      onPress={() => setFilterSaleOrigin('ALL')}
                    >
                      <Text style={[styles.filterOptionText, filterSaleOrigin === 'ALL' && styles.filterOptionTextActive]}>
                        Todas
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.filterOption, filterSaleOrigin === 'INDEPENDENT' && styles.filterOptionActive]}
                      onPress={() => setFilterSaleOrigin('INDEPENDENT')}
                    >
                      <Ionicons name="person-outline" size={16} color={filterSaleOrigin === 'INDEPENDENT' ? colors.neutral[0] : colors.neutral[600]} />
                      <Text style={[styles.filterOptionText, filterSaleOrigin === 'INDEPENDENT' && styles.filterOptionTextActive]}>
                        Independientes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.filterOption, filterSaleOrigin === 'CASH_REGISTER' && styles.filterOptionActive]}
                      onPress={() => setFilterSaleOrigin('CASH_REGISTER')}
                    >
                      <Ionicons name="cash-outline" size={16} color={filterSaleOrigin === 'CASH_REGISTER' ? colors.neutral[0] : colors.neutral[600]} />
                      <Text style={[styles.filterOptionText, filterSaleOrigin === 'CASH_REGISTER' && styles.filterOptionTextActive]}>
                        De Caja
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.clearFiltersButton}
                  onPress={clearAllFilters}
                >
                  <Text style={styles.clearFiltersButtonText}>Limpiar Filtros</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.applyFiltersButton}
                  onPress={() => setShowFiltersModal(false)}
                >
                  <Text style={styles.applyFiltersButtonText}>Aplicar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* FAB */}
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
    backgroundColor: colors.background.secondary,
  },
  headerGradient: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[0],
    letterSpacing: 0.3,
  },
  titleTablet: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginLeft: spacing[12],
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
  },
  searchIcon: {
    marginRight: spacing[2],
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: 15,
    color: colors.neutral[800],
  },
  searchInputTablet: {
    fontSize: 16,
    paddingVertical: spacing[3.5],
  },
  clearButton: {
    padding: spacing[1],
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.accent[500],
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.danger[500],
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  quickFiltersContainer: {
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  quickFiltersContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  filterChipActive: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral[600],
  },
  filterChipTextActive: {
    color: colors.neutral[0],
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing[2],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: 15,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4],
    paddingBottom: spacing[20],
  },
  contentContainerTablet: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
    overflow: 'hidden',
  },
  cardTablet: {
    borderRadius: borderRadius['2xl'],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    backgroundColor: colors.neutral[50],
  },
  cardHeaderLeft: {
    flex: 1,
    gap: spacing[2],
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  cardCode: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  cardCodeTablet: {
    fontSize: 18,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1.5],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    gap: spacing[1],
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
  },
  cardDate: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  cardTime: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  cardBody: {
    padding: spacing[4],
    gap: spacing[2.5],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  infoLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    fontWeight: '500',
    width: 60,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: colors.neutral[800],
    fontWeight: '500',
  },
  infoValueTablet: {
    fontSize: 15,
  },
  paymentBadge: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    backgroundColor: colors.neutral[50],
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: spacing[0.5],
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success[600],
  },
  totalValueTablet: {
    fontSize: 22,
  },
  balanceText: {
    fontSize: 12,
    color: colors.danger[500],
    fontWeight: '500',
    marginTop: spacing[0.5],
  },
  arrowContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: spacing[10],
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: spacing[2],
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.neutral[400],
    marginBottom: spacing[5],
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent[500],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  loadingMore: {
    paddingVertical: spacing[5],
    alignItems: 'center',
  },
  bottomSpacer: {
    height: 100,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[900],
    gap: spacing[1],
  },
  paginationButtonDisabled: {
    backgroundColor: colors.neutral[100],
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  paginationButtonTextDisabled: {
    color: colors.neutral[400],
  },
  paginationInfo: {
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  paginationSubtext: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '80%',
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  modalBody: {
    padding: spacing[5],
  },
  filterSection: {
    marginBottom: spacing[6],
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing[2],
  },
  filterOptionActive: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.neutral[600],
  },
  filterOptionTextActive: {
    color: colors.neutral[0],
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  clearFiltersButton: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  clearFiltersButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  applyFiltersButton: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[900],
    alignItems: 'center',
  },
  applyFiltersButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});
