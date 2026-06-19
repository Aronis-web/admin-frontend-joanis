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
import { useFocusEffect } from '@react-navigation/native';
import { salesApi } from '@/services/api/sales';
import {
  Sale,
  SaleType,
  SaleStatus,
  PaymentStatus,
  SaleStatusLabels,
  PaymentStatusLabels,
} from '@/types/sales';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import logger from '@/utils/logger';

interface SalesScreenProps {
  navigation: any;
}

export const SalesScreen: React.FC<SalesScreenProps> = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

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

      logger.info('ðŸ“Š Ventas cargadas:', response.data.length);
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
    void loadSales(page);
  }, [page, searchText, filterStatus, filterPaymentStatus, filterSaleType, filterSaleOrigin]);

  const lastFetchRef = React.useRef<number>(0);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const isStale = now - lastFetchRef.current > 5 * 60 * 1000;

      if (isStale) {
        lastFetchRef.current = now;
        void loadSales(page, true);
      }
    }, [page])
  );

  const handleRefresh = () => {
    void loadSales(1, true);
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
        return theme.color.state.success.border;
      case SaleStatus.COMPLETED:
        return theme.color.brand.accent;
      case SaleStatus.CANCELLED:
        return theme.color.state.danger.border;
      case SaleStatus.DRAFT:
        return theme.color.state.warning.border;
      default:
        return theme.color.text.subtle;
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return theme.color.state.success.border;
      case PaymentStatus.PARTIAL:
        return theme.color.state.warning.border;
      case PaymentStatus.PENDING:
        return theme.color.text.subtle;
      case PaymentStatus.OVERDUE:
        return theme.color.state.danger.border;
      default:
        return theme.color.text.subtle;
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
    const sellerName = sale.cashierSnapshot?.name || sale.sellerSnapshot?.name || null;

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
              <Ionicons name="receipt-outline" size={18} color={theme.color.brand.accent} />
              <Text style={[styles.cardCode, isTablet && styles.cardCodeTablet]}>{sale.code}</Text>
            </View>
            <View style={styles.badges}>
              {/* Origen */}
              <View style={[styles.badge, { backgroundColor: isIndependent ? theme.color.state.info.background : theme.color.state.success.background }]}>
                <Ionicons
                  name={isIndependent ? "person-outline" : "cash-outline"}
                  size={12}
                  color={isIndependent ? theme.color.state.info.text : theme.color.state.success.text}
                />
                <Text style={[styles.badgeText, { color: isIndependent ? theme.color.state.info.text : theme.color.state.success.text }]}>
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
              {/* Nota de CrÃ©dito */}
              {sale.hasCreditNote && (
                <View style={[styles.badge, { backgroundColor: theme.color.state.warning.background }]}>
                  <Ionicons name="document-text-outline" size={12} color={theme.color.state.warning.text} />
                  <Text style={[styles.badgeText, { color: theme.color.state.warning.text }]}>
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
            <Ionicons name="person" size={16} color={theme.color.icon.disabled} />
            <Text style={styles.infoLabel}>Cliente</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
              {customerName}
            </Text>
          </View>

          {sale.customerDocument && (
            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={16} color={theme.color.icon.disabled} />
              <Text style={styles.infoLabel}>Doc.</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
                {sale.customerDocument}
              </Text>
            </View>
          )}

          {sellerName && (
            <View style={styles.infoRow}>
              <Ionicons name="briefcase-outline" size={16} color={theme.color.icon.disabled} />
              <Text style={styles.infoLabel}>{isIndependent ? 'Vendedor' : 'Cajero'}</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
                {sellerName}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={16} color={theme.color.icon.disabled} />
            <Text style={styles.infoLabel}>Items</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {sale.itemCount} ({sale.totalQuantity} uds.)
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="wallet-outline" size={16} color={theme.color.icon.disabled} />
            <Text style={styles.infoLabel}>Pago</Text>
            <View style={[styles.paymentBadge, { backgroundColor: getPaymentStatusColor(sale.paymentStatus) + '15' }]}>
              <Text style={[styles.paymentBadgeText, { color: getPaymentStatusColor(sale.paymentStatus) }]}>
                {getPaymentStatusLabel(sale.paymentStatus)}
              </Text>
            </View>
          </View>

          {sale.hasCreditNote && sale.creditNotesCount > 0 && (
            <View style={styles.infoRow}>
              <Ionicons name="return-down-back-outline" size={16} color={theme.color.icon.warning} />
              <Text style={[styles.infoLabel, { color: theme.color.text.warning }]}>NC</Text>
              <Text style={[styles.infoValue, { color: theme.color.text.warning }]}>
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
            <Ionicons name="chevron-forward" size={24} color={theme.color.border.default} />
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
          color={currentValue === value ? theme.color.brand.onHeader : theme.color.text.subtle}
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
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="cart" size={22} color={theme.color.brand.onHeader} />
                </View>
                <Text style={[styles.title, isTablet && styles.titleTablet]}>Ventas</Text>
              </View>
              <Text style={styles.subtitle}>
                GestiÃ³n de ventas B2C y B2B
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
              <Ionicons name="search" size={20} color={theme.color.icon.disabled} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Buscar por cÃ³digo, cliente..."
                placeholderTextColor={theme.color.text.placeholder}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color={theme.color.icon.disabled} />
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
                color={getActiveFiltersCount() > 0 ? theme.color.brand.onHeader : theme.color.text.muted}
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
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
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
                colors={[theme.color.brand.accent]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="cart-outline" size={64} color={theme.color.border.default} />
                </View>
                <Text style={styles.emptyText}>No hay ventas registradas</Text>
                <Text style={styles.emptySubtext}>
                  Crea una nueva venta para comenzar
                </Text>
                <TouchableOpacity style={styles.emptyButton} onPress={handleCreateSale}>
                  <Ionicons name="add" size={20} color={theme.color.brand.onHeader} />
                  <Text style={styles.emptyButtonText}>Nueva Venta</Text>
                </TouchableOpacity>
              </View>
            }
            ListFooterComponent={
              <>
                {loading && page > 1 && (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={theme.color.brand.accent} />
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
                color={page === 1 ? theme.color.border.default : theme.color.brand.onHeader}
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
                PÃ¡gina {page} de {totalPages}
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
                color={page >= totalPages ? theme.color.border.default : theme.color.brand.onHeader}
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
                  <Ionicons name="close" size={24} color={theme.color.icon.subtle} />
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
                      <Ionicons name="person-outline" size={16} color={filterSaleOrigin === 'INDEPENDENT' ? theme.color.brand.onHeader : theme.color.text.muted} />
                      <Text style={[styles.filterOptionText, filterSaleOrigin === 'INDEPENDENT' && styles.filterOptionTextActive]}>
                        Independientes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.filterOption, filterSaleOrigin === 'CASH_REGISTER' && styles.filterOptionActive]}
                      onPress={() => setFilterSaleOrigin('CASH_REGISTER')}
                    >
                      <Ionicons name="cash-outline" size={16} color={filterSaleOrigin === 'CASH_REGISTER' ? theme.color.brand.onHeader : theme.color.text.muted} />
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  headerGradient: {
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[4],
    paddingBottom: theme.space[4],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.space[4],
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
    letterSpacing: 0.3,
  },
  titleTablet: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    marginLeft: theme.space[12],
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: theme.color.brand.headerBadge,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.lg,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
  },
  statLabel: {
    fontSize: 11,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.space[3],
  },
  searchIcon: {
    marginRight: theme.space[2],
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.space[3],
    fontSize: 15,
    color: theme.color.text.body,
  },
  searchInputTablet: {
    fontSize: 16,
    paddingVertical: theme.space[3.5],
  },
  clearButton: {
    padding: theme.space[1],
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: theme.color.brand.accent,
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: theme.color.action.danger.background,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
  },
  quickFiltersContainer: {
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  quickFiltersContent: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    gap: theme.space[2],
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.background.muted,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  filterChipActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.color.text.muted,
  },
  filterChipTextActive: {
    color: theme.color.brand.onHeader,
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.color.border.subtle,
    marginHorizontal: theme.space[2],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.space[3],
    fontSize: 15,
    color: theme.color.text.subtle,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.space[4],
    paddingBottom: theme.space[20],
  },
  contentContainerTablet: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii['2xl'],
    marginBottom: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    ...theme.shadow.sm,
    overflow: 'hidden',
  },
  cardTablet: {
    borderRadius: theme.radii['2xl'],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: theme.space[4],
    paddingBottom: theme.space[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.background.muted,
    backgroundColor: theme.color.background.subtle,
  },
  cardHeaderLeft: {
    flex: 1,
    gap: theme.space[2],
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  cardCode: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.body,
  },
  cardCodeTablet: {
    fontSize: 18,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[1.5],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.full,
    gap: theme.space[1],
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
    color: theme.color.text.body,
  },
  cardTime: {
    fontSize: 11,
    color: theme.color.text.subtle,
    marginTop: theme.space[0.5],
  },
  cardBody: {
    padding: theme.space[4],
    gap: theme.space[2.5],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  infoLabel: {
    fontSize: 12,
    color: theme.color.text.subtle,
    fontWeight: '500',
    width: 60,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: theme.color.text.body,
    fontWeight: '500',
  },
  infoValueTablet: {
    fontSize: 15,
  },
  paymentBadge: {
    paddingHorizontal: theme.space[2.5],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.md,
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.space[4],
    paddingTop: theme.space[3],
    borderTopWidth: 1,
    borderTopColor: theme.color.background.muted,
    backgroundColor: theme.color.background.subtle,
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 11,
    color: theme.color.text.subtle,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: theme.space[0.5],
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.success,
  },
  totalValueTablet: {
    fontSize: 22,
  },
  balanceText: {
    fontSize: 12,
    color: theme.color.text.danger,
    fontWeight: '500',
    marginTop: theme.space[0.5],
  },
  arrowContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.background.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: theme.space[10],
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.color.background.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.space[5],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: theme.space[2],
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.color.text.placeholder,
    marginBottom: theme.space[5],
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.brand.accent,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.lg,
    gap: theme.space[2],
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.brand.onHeader,
  },
  loadingMore: {
    paddingVertical: theme.space[5],
    alignItems: 'center',
  },
  bottomSpacer: {
    height: 100,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.surface.base,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2.5],
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.primary,
    gap: theme.space[1],
  },
  paginationButtonDisabled: {
    backgroundColor: theme.color.background.muted,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.brand.onHeader,
  },
  paginationButtonTextDisabled: {
    color: theme.color.text.placeholder,
  },
  paginationInfo: {
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  paginationSubtext: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginTop: theme.space[0.5],
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.color.surface.base,
    borderTopLeftRadius: theme.radii['2xl'],
    borderTopRightRadius: theme.radii['2xl'],
    maxHeight: '80%',
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
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  modalBody: {
    padding: theme.space[5],
  },
  filterSection: {
    marginBottom: theme.space[6],
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.space[3],
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2.5],
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.background.muted,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    gap: theme.space[2],
  },
  filterOptionActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.text.muted,
  },
  filterOptionTextActive: {
    color: theme.color.brand.onHeader,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: theme.space[3],
    padding: theme.space[5],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  clearFiltersButton: {
    flex: 1,
    paddingVertical: theme.space[3.5],
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.background.muted,
    alignItems: 'center',
  },
  clearFiltersButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text.muted,
  },
  applyFiltersButton: {
    flex: 1,
    paddingVertical: theme.space[3.5],
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.primary,
    alignItems: 'center',
  },
  applyFiltersButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.brand.onHeader,
  },
});
