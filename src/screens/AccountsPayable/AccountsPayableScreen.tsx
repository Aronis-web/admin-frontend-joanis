import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';
import { accountsPayableService } from '@/services/api/accounts-payable';
import {
  AccountPayable,
  AccountPayableStatus,
  SupplierType,
  QueryAccountsPayableParams,
} from '@/types/accounts-payable';
import {
  ACCOUNT_PAYABLE_STATUS_LABELS,
  ACCOUNT_PAYABLE_STATUS_COLORS,
  ACCOUNT_PAYABLE_STATUS_ICONS,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_ICONS,
  SUPPLIER_TYPE_LABELS,
  SUPPLIER_TYPE_ICONS,
  CURRENCY_SYMBOLS,
} from '@/constants/accountsPayable';

interface AccountsPayableScreenProps {
  navigation: any;
}

export const AccountsPayableScreen: React.FC<AccountsPayableScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { hasPermission, hasAnyPermission } = usePermissions();

  // Verificar permisos de lectura
  const canRead = hasAnyPermission([
    PERMISSIONS.ACCOUNTS_PAYABLE.READ,
    PERMISSIONS.ACCOUNTS_PAYABLE.READ_OWN_COMPANY,
    PERMISSIONS.ACCOUNTS_PAYABLE.READ_ALL,
  ]);

  const canReadDetails = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.READ_DETAILS);
  const canUseIntelligentSearch = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_INTELLIGENT);
  const canSearchAllCompanies = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_ALL_COMPANIES);
  const canViewReports = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.SUMMARY);

  const [accountsPayable, setAccountsPayable] = useState<AccountPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<AccountPayableStatus[]>([]);
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);
  const [selectedSupplierType, setSelectedSupplierType] = useState<SupplierType | null>(null);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [sortBy, setSortBy] = useState<string>('dueDate');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [summary, setSummary] = useState<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (searchQuery !== debouncedSearchQuery) {
        setPage(1);
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Load accounts payable when filters change
  useEffect(() => {
    loadAccountsPayable();
  }, [page, debouncedSearchQuery, selectedStatuses, selectedCurrencies, selectedSupplierType, showOverdueOnly, sortBy, sortOrder]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedStatuses, selectedCurrencies, selectedSupplierType, showOverdueOnly, sortBy, sortOrder]);

  const loadAccountsPayable = async () => {
    try {
      setLoading(true);

      // Build query params
      const params: QueryAccountsPayableParams = {
        page,
        limit: 20,
        sortBy,
        sortOrder,
      };

      // Add search query
      if (debouncedSearchQuery.trim()) {
        params.search = debouncedSearchQuery.trim();
      }

      // Add status filter
      if (selectedStatuses.length > 0) {
        params.statuses = selectedStatuses.join(',');
      }

      // Add currency filter
      if (selectedCurrencies.length > 0) {
        params.currencies = selectedCurrencies.join(',');
      }

      // Add supplier type filter
      if (selectedSupplierType) {
        params.supplierPrimaryType = selectedSupplierType;
      }

      // Add overdue filter
      if (showOverdueOnly) {
        params.overdue = true;
      }

      console.log('🔍 Loading accounts payable with params:', params);

      // Use standard endpoint for better performance (no details needed for list)
      const response = await accountsPayableService.getAccountsPayable(params);

      console.log('✅ Accounts payable loaded:', {
        total: response.total,
        itemsInPage: response.data.length,
        page,
      });

      setAccountsPayable(response.data);
      setPagination({
        page: response.metadata?.page || page,
        limit: response.metadata?.limit || 20,
        total: response.total,
        totalPages: response.metadata?.totalPages || Math.ceil(response.total / 20),
      });
      setSummary(response.summary);
    } catch (error: any) {
      console.error('❌ Error loading accounts payable:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudieron cargar las cuentas por pagar';
      Alert.alert('Error', errorMessage);
      setAccountsPayable([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await loadAccountsPayable();
    setRefreshing(false);
  }, [debouncedSearchQuery, selectedStatuses, selectedCurrencies, selectedSupplierType, showOverdueOnly, sortBy, sortOrder]);

  const handlePreviousPage = useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    }
  }, [page]);

  const handleNextPage = useCallback(() => {
    if (page < pagination.totalPages) {
      setPage(page + 1);
    }
  }, [page, pagination.totalPages]);

  const handleAccountPayablePress = (accountPayable: AccountPayable) => {
    navigation.navigate('AccountPayableDetail', { accountPayableId: accountPayable.id });
  };

  const toggleStatus = (status: AccountPayableStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleCurrency = (currency: string) => {
    setSelectedCurrencies((prev) =>
      prev.includes(currency) ? prev.filter((c) => c !== currency) : [...prev, currency]
    );
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedCurrencies([]);
    setSelectedSupplierType(null);
    setShowOverdueOnly(false);
    setSearchQuery('');
    setSortBy('dueDate');
    setSortOrder('ASC');
  };

  const formatCurrency = (cents: number, currency: string = 'PEN') => {
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    return `${symbol} ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderAccountPayableCard = (item: AccountPayable) => {
    const statusColor = ACCOUNT_PAYABLE_STATUS_COLORS[item.status];
    const statusIcon = ACCOUNT_PAYABLE_STATUS_ICONS[item.status];
    const statusLabel = ACCOUNT_PAYABLE_STATUS_LABELS[item.status];
    const daysUntilDue = getDaysUntilDue(item.dueDate);
    const isOverdue = item.overdueDays > 0;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.card, isTablet && styles.cardTablet]}
        onPress={() => handleAccountPayablePress(item)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardCode}>{item.code}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={styles.statusIcon}>{statusIcon}</Text>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.cardCurrency}>{item.currency}</Text>
        </View>

        {/* Supplier */}
        <View style={styles.supplierSection}>
          <Text style={styles.supplierIcon}>🏢</Text>
          <View style={styles.supplierInfo}>
            <Text style={styles.supplierName} numberOfLines={1}>
              {item.supplierName}
            </Text>
            {item.taxId && (
              <Text style={styles.supplierTaxId}>RUC: {item.taxId}</Text>
            )}
          </View>
        </View>

        {/* Amounts */}
        <View style={styles.amountsSection}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Total:</Text>
            <Text style={styles.amountTotal}>
              {formatCurrency(item.totalAmountCents, item.currency)}
            </Text>
          </View>
          {item.paidAmountCents > 0 && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Pagado:</Text>
              <Text style={styles.amountPaid}>
                {formatCurrency(item.paidAmountCents, item.currency)}
              </Text>
            </View>
          )}
          {item.remainingAmountCents > 0 && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Pendiente:</Text>
              <Text style={[styles.amountRemaining, isOverdue && styles.amountOverdue]}>
                {formatCurrency(item.remainingAmountCents, item.currency)}
              </Text>
            </View>
          )}
        </View>

        {/* Dates */}
        <View style={styles.datesSection}>
          <View style={styles.dateItem}>
            <Text style={styles.dateIcon}>📅</Text>
            <View>
              <Text style={styles.dateLabel}>Emisión</Text>
              <Text style={styles.dateValue}>{formatDate(item.issueDate)}</Text>
            </View>
          </View>
          <View style={styles.dateItem}>
            <Text style={styles.dateIcon}>⏰</Text>
            <View>
              <Text style={styles.dateLabel}>Vencimiento</Text>
              <Text style={[styles.dateValue, isOverdue && styles.dateOverdue]}>
                {formatDate(item.dueDate)}
              </Text>
              {isOverdue ? (
                <Text style={styles.overdueBadge}>Vencido hace {item.overdueDays} días</Text>
              ) : daysUntilDue <= 7 && daysUntilDue >= 0 ? (
                <Text style={styles.dueSoonBadge}>Vence en {daysUntilDue} días</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Document & Source */}
        {(item.documentNumber || item.sourceType) && (
          <View style={styles.metaSection}>
            {item.documentNumber && (
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>📄</Text>
                <Text style={styles.metaText}>{item.documentNumber}</Text>
              </View>
            )}
            {item.sourceType && (
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>{SOURCE_TYPE_ICONS[item.sourceType]}</Text>
                <Text style={styles.metaText}>{SOURCE_TYPE_LABELS[item.sourceType]}</Text>
              </View>
            )}
          </View>
        )}

        {/* Payment Progress */}
        {item.paymentPercentage > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${item.paymentPercentage}%`, backgroundColor: statusColor },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{item.paymentPercentage.toFixed(0)}% pagado</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderFiltersModal = () => (
    <Modal
      visible={showFiltersModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFiltersModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtros Avanzados</Text>
            <TouchableOpacity onPress={() => setShowFiltersModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Status Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Estado</Text>
              <View style={styles.filterChips}>
                {Object.values(AccountPayableStatus).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterChip,
                      selectedStatuses.includes(status) && styles.filterChipActive,
                      { borderColor: ACCOUNT_PAYABLE_STATUS_COLORS[status] },
                    ]}
                    onPress={() => toggleStatus(status)}
                  >
                    <Text style={styles.filterChipIcon}>{ACCOUNT_PAYABLE_STATUS_ICONS[status]}</Text>
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedStatuses.includes(status) && {
                          color: ACCOUNT_PAYABLE_STATUS_COLORS[status],
                        },
                      ]}
                    >
                      {ACCOUNT_PAYABLE_STATUS_LABELS[status]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Currency Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Moneda</Text>
              <View style={styles.filterChips}>
                {['PEN', 'USD'].map((currency) => (
                  <TouchableOpacity
                    key={currency}
                    style={[
                      styles.filterChip,
                      selectedCurrencies.includes(currency) && styles.filterChipActive,
                    ]}
                    onPress={() => toggleCurrency(currency)}
                  >
                    <Text style={styles.filterChipText}>
                      {CURRENCY_SYMBOLS[currency]} {currency}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Supplier Type Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Tipo de Proveedor</Text>
              <View style={styles.filterChips}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    selectedSupplierType === null && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedSupplierType(null)}
                >
                  <Text style={styles.filterChipText}>Todos</Text>
                </TouchableOpacity>
                {Object.values(SupplierType).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterChip,
                      selectedSupplierType === type && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedSupplierType(type)}
                  >
                    <Text style={styles.filterChipIcon}>{SUPPLIER_TYPE_ICONS[type]}</Text>
                    <Text style={styles.filterChipText}>{SUPPLIER_TYPE_LABELS[type]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Overdue Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Vencimiento</Text>
              <TouchableOpacity
                style={[styles.filterToggle, showOverdueOnly && styles.filterToggleActive]}
                onPress={() => setShowOverdueOnly(!showOverdueOnly)}
              >
                <Text style={styles.filterToggleIcon}>⚠️</Text>
                <Text
                  style={[
                    styles.filterToggleText,
                    showOverdueOnly && styles.filterToggleTextActive,
                  ]}
                >
                  Solo vencidas
                </Text>
                <View style={[styles.checkbox, showOverdueOnly && styles.checkboxActive]}>
                  {showOverdueOnly && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            </View>

            {/* Sort Options */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Ordenar por</Text>
              <View style={styles.sortOptions}>
                {[
                  { key: 'dueDate', label: 'Fecha Vencimiento' },
                  { key: 'issueDate', label: 'Fecha Emisión' },
                  { key: 'totalAmountCents', label: 'Monto Total' },
                  { key: 'remainingAmountCents', label: 'Saldo Pendiente' },
                  { key: 'overdueDays', label: 'Días Atraso' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.sortOption, sortBy === option.key && styles.sortOptionActive]}
                    onPress={() => setSortBy(option.key)}
                  >
                    <Text
                      style={[
                        styles.sortOptionText,
                        sortBy === option.key && styles.sortOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.sortOrder}>
                <TouchableOpacity
                  style={[styles.sortOrderButton, sortOrder === 'ASC' && styles.sortOrderButtonActive]}
                  onPress={() => setSortOrder('ASC')}
                >
                  <Text style={styles.sortOrderIcon}>↑</Text>
                  <Text
                    style={[
                      styles.sortOrderText,
                      sortOrder === 'ASC' && styles.sortOrderTextActive,
                    ]}
                  >
                    Ascendente
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortOrderButton, sortOrder === 'DESC' && styles.sortOrderButtonActive]}
                  onPress={() => setSortOrder('DESC')}
                >
                  <Text style={styles.sortOrderIcon}>↓</Text>
                  <Text
                    style={[
                      styles.sortOrderText,
                      sortOrder === 'DESC' && styles.sortOrderTextActive,
                    ]}
                  >
                    Descendente
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Limpiar Filtros</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFiltersModal(false)}
            >
              <Text style={styles.applyButtonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const activeFiltersCount =
    selectedStatuses.length +
    selectedCurrencies.length +
    (selectedSupplierType ? 1 : 0) +
    (showOverdueOnly ? 1 : 0);

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
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonGradient}>
              <Ionicons name="arrow-back" size={24} color={colors.neutral[0]} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="wallet-outline" size={22} color={colors.neutral[0]} />
                </View>
                <Text style={[styles.titleGradient, isTablet && styles.titleTabletGradient]}>Cuentas por Pagar</Text>
              </View>
              <Text style={styles.subtitleGradient}>Gestión de deudas con proveedores</Text>
            </View>
            <View style={styles.statsHeaderContainer}>
              <View style={styles.statHeaderItem}>
                <Text style={styles.statHeaderValue}>{pagination.total}</Text>
                <Text style={styles.statHeaderLabel}>Total</Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainerGradient}>
            <View style={styles.searchInputContainerGradient}>
              <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIconGradient} />
              <TextInput
                style={[styles.searchInputGradient, isTablet && styles.searchInputTabletGradient]}
                placeholder="Buscar por código, proveedor, RUC..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={colors.neutral[400]}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButtonGradient}>
                  <Ionicons name="close-circle" size={20} color={colors.neutral[400]} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>

      {/* Quick Filters & Filter Button */}
      <View style={styles.quickFiltersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickFilters}>
          <TouchableOpacity
            style={[styles.quickFilterChip, showOverdueOnly && styles.quickFilterChipActive]}
            onPress={() => setShowOverdueOnly(!showOverdueOnly)}
          >
            <Text style={styles.quickFilterIcon}>⚠️</Text>
            <Text
              style={[
                styles.quickFilterText,
                showOverdueOnly && styles.quickFilterTextActive,
              ]}
            >
              Vencidas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickFilterChip,
              selectedStatuses.includes(AccountPayableStatus.PENDING) &&
                styles.quickFilterChipActive,
            ]}
            onPress={() => toggleStatus(AccountPayableStatus.PENDING)}
          >
            <Text style={styles.quickFilterIcon}>⏰</Text>
            <Text
              style={[
                styles.quickFilterText,
                selectedStatuses.includes(AccountPayableStatus.PENDING) &&
                  styles.quickFilterTextActive,
              ]}
            >
              Pendientes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickFilterChip,
              selectedStatuses.includes(AccountPayableStatus.PARTIAL) &&
                styles.quickFilterChipActive,
            ]}
            onPress={() => toggleStatus(AccountPayableStatus.PARTIAL)}
          >
            <Text style={styles.quickFilterIcon}>💰</Text>
            <Text
              style={[
                styles.quickFilterText,
                selectedStatuses.includes(AccountPayableStatus.PARTIAL) &&
                  styles.quickFilterTextActive,
              ]}
            >
              Parciales
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickFilterChip,
              selectedCurrencies.includes('PEN') && styles.quickFilterChipActive,
            ]}
            onPress={() => toggleCurrency('PEN')}
          >
            <Text
              style={[
                styles.quickFilterText,
                selectedCurrencies.includes('PEN') && styles.quickFilterTextActive,
              ]}
            >
              S/ Soles
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickFilterChip,
              selectedCurrencies.includes('USD') && styles.quickFilterChipActive,
            ]}
            onPress={() => toggleCurrency('USD')}
          >
            <Text
              style={[
                styles.quickFilterText,
                selectedCurrencies.includes('USD') && styles.quickFilterTextActive,
              ]}
            >
              $ Dólares
            </Text>
          </TouchableOpacity>
        </ScrollView>
        <TouchableOpacity
          style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFiltersModal(true)}
        >
          <Text style={styles.filterButtonIcon}>⚙️</Text>
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      {summary && summary.totals && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.summaryContainer}
          contentContainerStyle={styles.summaryContent}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(summary.totals.totalAmount, 'PEN')}
            </Text>
            <Text style={styles.summaryCount}>{summary.totals.count} cuentas</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Pendiente</Text>
            <Text style={[styles.summaryValue, styles.summaryValuePending]}>
              {formatCurrency(summary.totals.remainingAmount, 'PEN')}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Pagado</Text>
            <Text style={[styles.summaryValue, styles.summaryValuePaid]}>
              {formatCurrency(summary.totals.paidAmount, 'PEN')}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Accounts Payable List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={[styles.loadingText, isTablet && styles.loadingTextTablet]}>
              Cargando cuentas por pagar...
            </Text>
          </View>
        ) : accountsPayable.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              {debouncedSearchQuery || activeFiltersCount > 0
                ? 'No se encontraron cuentas por pagar con los filtros aplicados'
                : 'No hay cuentas por pagar registradas'}
            </Text>
            {activeFiltersCount > 0 && (
              <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                <Text style={styles.clearFiltersButtonText}>Limpiar Filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.accountsGrid}>
            {accountsPayable.map(renderAccountPayableCard)}
          </View>
        )}
      </ScrollView>

      {/* Pagination Controls */}
      {!loading && pagination.total > 0 && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[
              styles.paginationButton,
              pagination.page === 1 && styles.paginationButtonDisabled,
            ]}
            onPress={handlePreviousPage}
            disabled={pagination.page === 1}
          >
            <Text
              style={[
                styles.paginationButtonText,
                pagination.page === 1 && styles.paginationButtonTextDisabled,
              ]}
            >
              ← Anterior
            </Text>
          </TouchableOpacity>

          <View style={styles.paginationInfo}>
            <Text style={styles.paginationText}>
              Pág. {pagination.page}/{pagination.totalPages}
            </Text>
            <Text style={styles.paginationSubtext}>
              {accountsPayable.length} de {pagination.total}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.paginationButton,
              pagination.page >= pagination.totalPages && styles.paginationButtonDisabled,
            ]}
            onPress={handleNextPage}
            disabled={pagination.page >= pagination.totalPages}
          >
            <Text
              style={[
                styles.paginationButtonText,
                pagination.page >= pagination.totalPages && styles.paginationButtonTextDisabled,
              ]}
            >
              Siguiente →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filters Modal */}
      {renderFiltersModal()}
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  // Header con gradiente
  headerGradient: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
  },
  backButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
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
  titleGradient: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[0],
    letterSpacing: 0.3,
  },
  titleTabletGradient: {
    fontSize: 28,
  },
  subtitleGradient: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginLeft: spacing[12],
  },
  statsHeaderContainer: {
    alignItems: 'flex-end',
  },
  statHeaderItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  statHeaderValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  statHeaderLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  searchContainerGradient: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  searchInputContainerGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
  },
  searchIconGradient: {
    marginRight: spacing[2],
  },
  searchInputGradient: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: 15,
    color: colors.neutral[800],
  },
  searchInputTabletGradient: {
    fontSize: 16,
    paddingVertical: 14,
  },
  clearButtonGradient: {
    padding: spacing[1],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#475569',
  },
  backIconTablet: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerTitleTablet: {
    fontSize: 24,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  headerSubtitleTablet: {
    fontSize: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchContainerTablet: {
    marginHorizontal: 32,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
  searchInputTablet: {
    fontSize: 17,
  },
  clearSearchButton: {
    padding: 4,
  },
  clearSearchButtonText: {
    fontSize: 18,
    color: '#94A3B8',
  },
  searchLoader: {
    marginLeft: 8,
  },
  quickFiltersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  quickFilters: {
    flex: 1,
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    gap: 4,
  },
  quickFilterChipActive: {
    backgroundColor: '#667eea',
  },
  quickFilterIcon: {
    fontSize: 14,
  },
  quickFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  quickFilterTextActive: {
    color: '#FFFFFF',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#667eea',
  },
  filterButtonIcon: {
    fontSize: 20,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  summaryContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  summaryContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    minWidth: 140,
    marginRight: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  summaryValuePending: {
    color: '#F59E0B',
  },
  summaryValuePaid: {
    color: '#10B981',
  },
  summaryCount: {
    fontSize: 11,
    color: '#94A3B8',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 16,
  },
  contentContainerTablet: {
    paddingHorizontal: 32,
  },
  accountsGrid: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTablet: {
    padding: 20,
    borderRadius: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 8,
  },
  cardCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusIcon: {
    fontSize: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardCurrency: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  supplierSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  supplierIcon: {
    fontSize: 20,
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  supplierTaxId: {
    fontSize: 12,
    color: '#64748B',
  },
  amountsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  amountTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  amountPaid: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  amountRemaining: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
  },
  amountOverdue: {
    color: '#EF4444',
  },
  datesSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  dateItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  dateIcon: {
    fontSize: 16,
  },
  dateLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  dateOverdue: {
    color: '#EF4444',
  },
  overdueBadge: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '600',
    marginTop: 2,
  },
  dueSoonBadge: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 2,
  },
  metaSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaIcon: {
    fontSize: 12,
  },
  metaText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  progressSection: {
    gap: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'right',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748B',
  },
  loadingTextTablet: {
    fontSize: 17,
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
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  emptyTextTablet: {
    fontSize: 18,
  },
  clearFiltersButton: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  clearFiltersButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  paginationInfo: {
    alignItems: 'center',
    minWidth: 100,
    flex: 1,
  },
  paginationText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  paginationButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#667eea',
    minWidth: 110,
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  paginationButtonDisabled: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalContentTablet: {
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalClose: {
    fontSize: 28,
    color: '#94A3B8',
    fontWeight: '300',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  filterChipIcon: {
    fontSize: 14,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    gap: 12,
  },
  filterToggleActive: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  filterToggleIcon: {
    fontSize: 20,
  },
  filterToggleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  filterToggleTextActive: {
    color: '#F59E0B',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sortOptions: {
    gap: 8,
    marginBottom: 12,
  },
  sortOption: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortOptionActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#667eea',
    borderWidth: 2,
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  sortOptionTextActive: {
    color: '#667eea',
  },
  sortOrder: {
    flexDirection: 'row',
    gap: 8,
  },
  sortOrderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  sortOrderButtonActive: {
    backgroundColor: '#667eea',
  },
  sortOrderIcon: {
    fontSize: 18,
    color: '#475569',
  },
  sortOrderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  sortOrderTextActive: {
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#667eea',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
