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
import { useAuthStore } from '@/store/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';
import { accountsReceivableService } from '@/services/api/accounts-receivable';
import {
  AccountReceivable,
  AccountReceivableStatus,
  DebtorType,
  QueryAccountsReceivableParams,
} from '@/types/accounts-receivable';
import {
  ACCOUNT_RECEIVABLE_STATUS_LABELS,
  ACCOUNT_RECEIVABLE_STATUS_COLORS,
  ACCOUNT_RECEIVABLE_STATUS_ICONS,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_ICONS,
  DEBTOR_TYPE_LABELS,
  DEBTOR_TYPE_ICONS,
  CURRENCY_SYMBOLS,
} from '@/constants/accountsReceivable';
import {
  QUICK_DATE_FILTERS,
  QuickDateFilter,
  getDateRangeByFilter,
  AVAILABLE_QUICK_FILTERS,
  validateDateRange,
} from '@/utils/dateFilters';

interface AccountsReceivableScreenProps {
  navigation: any;
}

export const AccountsReceivableScreen: React.FC<AccountsReceivableScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { hasPermission, hasAnyPermission } = usePermissions();

  // Verificar permisos de lectura
  const canRead = hasAnyPermission([
    PERMISSIONS.ACCOUNTS_RECEIVABLE.READ,
    PERMISSIONS.ACCOUNTS_RECEIVABLE.READ_OWN_COMPANY,
    PERMISSIONS.ACCOUNTS_RECEIVABLE.READ_ALL,
  ]);

  const canReadDetails = hasPermission(PERMISSIONS.ACCOUNTS_RECEIVABLE.READ_DETAILS);
  const canUseIntelligentSearch = hasPermission(PERMISSIONS.ACCOUNTS_RECEIVABLE.SEARCH_INTELLIGENT);
  const canSearchAllCompanies = hasPermission(PERMISSIONS.ACCOUNTS_RECEIVABLE.SEARCH_ALL_COMPANIES);
  const canViewReports = hasPermission(PERMISSIONS.ACCOUNTS_RECEIVABLE.REPORTS.SUMMARY);

  const [accountsReceivable, setAccountsReceivable] = useState<AccountReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<AccountReceivableStatus[]>([]);
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);
  const [selectedDebtorType, setSelectedDebtorType] = useState<DebtorType | null>(null);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [sortBy, setSortBy] = useState<string>('dueDate');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [page, setPage] = useState(1);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<QuickDateFilter>(QUICK_DATE_FILTERS.YESTERDAY);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
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

  // Initialize with yesterday's date
  useEffect(() => {
    const yesterdayRange = getDateRangeByFilter(QUICK_DATE_FILTERS.YESTERDAY);
    if (yesterdayRange) {
      setFromDate(yesterdayRange.fromDate);
      setToDate(yesterdayRange.toDate);
    }
  }, []);

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

  // Load accounts receivable when filters change
  useEffect(() => {
    if (fromDate && toDate) {
      loadAccountsReceivable();
    }
  }, [page, debouncedSearchQuery, selectedStatuses, selectedCurrencies, selectedDebtorType, showOverdueOnly, sortBy, sortOrder, fromDate, toDate]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedStatuses, selectedCurrencies, selectedDebtorType, showOverdueOnly, sortBy, sortOrder]);

  const loadAccountsReceivable = async () => {
    try {
      // ⚠️ VALIDACIÓN: Fechas obligatorias para evitar escaneo de particiones
      if (!fromDate || !toDate) {
        Alert.alert(
          'Fechas Requeridas',
          'Debe seleccionar un rango de fechas para consultar las cuentas por cobrar. Por defecto se usa "Ayer".'
        );
        return;
      }

      // ⚠️ VALIDACIÓN: Rango máximo de 90 días
      const validation = validateDateRange(fromDate, toDate, 90);
      if (!validation.valid) {
        Alert.alert('Rango de Fechas Inválido', validation.message || 'El rango de fechas no es válido');
        return;
      }

      setLoading(true);

      // Build query params
      const params: QueryAccountsReceivableParams = {
        page,
        limit: 20,
        sortBy,
        sortOrder,
        fromDate,
        toDate,
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

      // Add debtor type filter
      if (selectedDebtorType) {
        params.debtorType = selectedDebtorType;
      }

      // Add overdue filter
      if (showOverdueOnly) {
        params.overdue = true;
      }

      console.log('🔍 Loading accounts receivable with params:', params);

      // Use standard endpoint for better performance (no details needed for list)
      const response = await accountsReceivableService.getAccountsReceivable(params);

      console.log('✅ Accounts receivable loaded:', {
        total: response.total,
        itemsInPage: response.data.length,
        page,
      });

      setAccountsReceivable(response.data);
      setPagination({
        page: response.metadata?.page || page,
        limit: response.metadata?.limit || 20,
        total: response.total,
        totalPages: response.metadata?.totalPages || Math.ceil(response.total / 20),
      });
      setSummary(response.summary);
    } catch (error: any) {
      console.error('❌ Error loading accounts receivable:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudieron cargar las cuentas por cobrar';
      Alert.alert('Error', errorMessage);
      setAccountsReceivable([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await loadAccountsReceivable();
    setRefreshing(false);
  }, [debouncedSearchQuery, selectedStatuses, selectedCurrencies, selectedDebtorType, showOverdueOnly, sortBy, sortOrder]);

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

  const handleAccountReceivablePress = (accountReceivable: AccountReceivable) => {
    navigation.navigate('AccountReceivableDetail', { accountReceivableId: accountReceivable.id });
  };

  const toggleStatus = (status: AccountReceivableStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleCurrency = (currency: string) => {
    setSelectedCurrencies((prev) =>
      prev.includes(currency) ? prev.filter((c) => c !== currency) : [...prev, currency]
    );
  };

  const handleQuickFilterSelect = (filter: QuickDateFilter) => {
    setSelectedQuickFilter(filter);
    const range = getDateRangeByFilter(filter);
    if (range) {
      setFromDate(range.fromDate);
      setToDate(range.toDate);
    }
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedCurrencies([]);
    setSelectedDebtorType(null);
    setShowOverdueOnly(false);
    setSearchQuery('');
    setSortBy('dueDate');
    setSortOrder('ASC');
    // Reset to yesterday
    setSelectedQuickFilter(QUICK_DATE_FILTERS.YESTERDAY);
    const yesterdayRange = getDateRangeByFilter(QUICK_DATE_FILTERS.YESTERDAY);
    if (yesterdayRange) {
      setFromDate(yesterdayRange.fromDate);
      setToDate(yesterdayRange.toDate);
    }
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

  const renderAccountReceivableCard = (item: AccountReceivable) => {
    const statusColor = ACCOUNT_RECEIVABLE_STATUS_COLORS[item.status];
    const statusIcon = ACCOUNT_RECEIVABLE_STATUS_ICONS[item.status];
    const statusLabel = ACCOUNT_RECEIVABLE_STATUS_LABELS[item.status];
    const daysUntilDue = getDaysUntilDue(item.dueDate);
    const isOverdue = item.overdueDays > 0;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.card, isTablet && styles.cardTablet]}
        onPress={() => handleAccountReceivablePress(item)}
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

        {/* Debtor */}
        <View style={styles.debtorSection}>
          <Text style={styles.debtorIcon}>{DEBTOR_TYPE_ICONS[item.debtorType]}</Text>
          <View style={styles.debtorInfo}>
            <Text style={styles.debtorName} numberOfLines={1}>
              {item.debtorName}
            </Text>
            {item.debtorTaxId && (
              <Text style={styles.debtorTaxId}>RUC/DNI: {item.debtorTaxId}</Text>
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
          {item.collectedAmountCents > 0 && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Cobrado:</Text>
              <Text style={styles.amountCollected}>
                {formatCurrency(item.collectedAmountCents, item.currency)}
              </Text>
            </View>
          )}
          {item.balanceCents > 0 && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Saldo:</Text>
              <Text style={[styles.amountBalance, isOverdue && styles.amountOverdue]}>
                {formatCurrency(item.balanceCents, item.currency)}
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

        {/* Collection Progress */}
        {item.collectionPercentage > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${item.collectionPercentage}%`, backgroundColor: statusColor },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{item.collectionPercentage.toFixed(0)}% cobrado</Text>
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
                {Object.values(AccountReceivableStatus).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterChip,
                      selectedStatuses.includes(status) && styles.filterChipActive,
                      { borderColor: ACCOUNT_RECEIVABLE_STATUS_COLORS[status] },
                    ]}
                    onPress={() => toggleStatus(status)}
                  >
                    <Text style={styles.filterChipIcon}>{ACCOUNT_RECEIVABLE_STATUS_ICONS[status]}</Text>
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedStatuses.includes(status) && {
                          color: ACCOUNT_RECEIVABLE_STATUS_COLORS[status],
                        },
                      ]}
                    >
                      {ACCOUNT_RECEIVABLE_STATUS_LABELS[status]}
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

            {/* Debtor Type Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Tipo de Deudor</Text>
              <View style={styles.filterChips}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    selectedDebtorType === null && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedDebtorType(null)}
                >
                  <Text style={styles.filterChipText}>Todos</Text>
                </TouchableOpacity>
                {Object.values(DebtorType).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterChip,
                      selectedDebtorType === type && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedDebtorType(type)}
                  >
                    <Text style={styles.filterChipIcon}>{DEBTOR_TYPE_ICONS[type]}</Text>
                    <Text style={styles.filterChipText}>{DEBTOR_TYPE_LABELS[type]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date Range Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Rango de Fechas *</Text>
              <View style={styles.dateInputsContainer}>
                <View style={styles.dateInputGroup}>
                  <Text style={styles.dateInputLabel}>Desde:</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="YYYY-MM-DD"
                    value={fromDate}
                    onChangeText={(text) => {
                      setFromDate(text);
                      setSelectedQuickFilter(QUICK_DATE_FILTERS.CUSTOM);
                    }}
                  />
                </View>
                <View style={styles.dateInputGroup}>
                  <Text style={styles.dateInputLabel}>Hasta:</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="YYYY-MM-DD"
                    value={toDate}
                    onChangeText={(text) => {
                      setToDate(text);
                      setSelectedQuickFilter(QUICK_DATE_FILTERS.CUSTOM);
                    }}
                  />
                </View>
              </View>
              <Text style={styles.dateRangeHint}>
                ⚠️ Obligatorio. Máximo 90 días de rango.
              </Text>
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
                  { key: 'balanceCents', label: 'Saldo Pendiente' },
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
    (selectedDebtorType ? 1 : 0) +
    (showOverdueOnly ? 1 : 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backIcon, isTablet && styles.backIconTablet]}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Cuentas por Cobrar
            </Text>
            <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
              {pagination.total} registros
            </Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, isTablet && styles.searchContainerTablet]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, isTablet && styles.searchInputTablet]}
          placeholder="Buscar por código, deudor, RUC, documento..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
            <Text style={styles.clearSearchButtonText}>✕</Text>
          </TouchableOpacity>
        )}
        {searchQuery !== debouncedSearchQuery && (
          <ActivityIndicator size="small" color="#667eea" style={styles.searchLoader} />
        )}
      </View>

      {/* Quick Date Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickDateFiltersContainer}
        contentContainerStyle={styles.quickDateFiltersContent}
      >
        {AVAILABLE_QUICK_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.quickDateFilterChip,
              selectedQuickFilter === filter.key && styles.quickDateFilterChipActive,
            ]}
            onPress={() => handleQuickFilterSelect(filter.key)}
          >
            <Text style={styles.quickDateFilterIcon}>{filter.icon}</Text>
            <Text
              style={[
                styles.quickDateFilterText,
                selectedQuickFilter === filter.key && styles.quickDateFilterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
              selectedStatuses.includes(AccountReceivableStatus.PENDING) &&
                styles.quickFilterChipActive,
            ]}
            onPress={() => toggleStatus(AccountReceivableStatus.PENDING)}
          >
            <Text style={styles.quickFilterIcon}>⏰</Text>
            <Text
              style={[
                styles.quickFilterText,
                selectedStatuses.includes(AccountReceivableStatus.PENDING) &&
                  styles.quickFilterTextActive,
              ]}
            >
              Pendientes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickFilterChip,
              selectedStatuses.includes(AccountReceivableStatus.PARTIAL) &&
                styles.quickFilterChipActive,
            ]}
            onPress={() => toggleStatus(AccountReceivableStatus.PARTIAL)}
          >
            <Text style={styles.quickFilterIcon}>💰</Text>
            <Text
              style={[
                styles.quickFilterText,
                selectedStatuses.includes(AccountReceivableStatus.PARTIAL) &&
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
            <Text style={styles.summaryLabel}>Por Cobrar</Text>
            <Text style={[styles.summaryValue, styles.summaryValuePending]}>
              {formatCurrency(summary.totals.balanceAmount, 'PEN')}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Cobrado</Text>
            <Text style={[styles.summaryValue, styles.summaryValueCollected]}>
              {formatCurrency(summary.totals.collectedAmount, 'PEN')}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Accounts Receivable List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={[styles.loadingText, isTablet && styles.loadingTextTablet]}>
              Cargando cuentas por cobrar...
            </Text>
          </View>
        ) : accountsReceivable.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              {debouncedSearchQuery || activeFiltersCount > 0
                ? 'No se encontraron cuentas por cobrar con los filtros aplicados'
                : 'No hay cuentas por cobrar registradas'}
            </Text>
            {activeFiltersCount > 0 && (
              <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                <Text style={styles.clearFiltersButtonText}>Limpiar Filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.accountsGrid}>
            {accountsReceivable.map(renderAccountReceivableCard)}
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
              {accountsReceivable.length} de {pagination.total}
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  summaryValueCollected: {
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
    paddingVertical: 16,
    paddingBottom: 40,
  },
  contentContainerTablet: {
    paddingHorizontal: 32,
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
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyTextTablet: {
    fontSize: 18,
  },
  clearFiltersButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#667eea',
    borderRadius: 12,
  },
  clearFiltersButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 16,
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
    fontWeight: '600',
    color: '#64748B',
  },
  debtorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  debtorIcon: {
    fontSize: 24,
  },
  debtorInfo: {
    flex: 1,
  },
  debtorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  debtorTaxId: {
    fontSize: 12,
    color: '#64748B',
  },
  amountsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
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
  amountCollected: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  amountBalance: {
    fontSize: 15,
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
    marginTop: 2,
  },
  dateLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
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
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
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
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#667eea',
    minWidth: 100,
  },
  paginationButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  paginationButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalContentTablet: {
    maxHeight: '70%',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalClose: {
    fontSize: 24,
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
    fontSize: 14,
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
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: '#F8FAFC',
  },
  filterChipIcon: {
    fontSize: 14,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  filterToggleActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  filterToggleIcon: {
    fontSize: 18,
  },
  filterToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  filterToggleTextActive: {
    color: '#EF4444',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sortOptions: {
    gap: 8,
    marginBottom: 12,
  },
  sortOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  sortOptionActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  sortOptionTextActive: {
    color: '#FFFFFF',
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
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  sortOrderButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  sortOrderIcon: {
    fontSize: 16,
    color: '#64748B',
  },
  sortOrderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#667eea',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  quickDateFiltersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  quickDateFiltersContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  quickDateFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 4,
  },
  quickDateFilterChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#667eea',
  },
  quickDateFilterIcon: {
    fontSize: 14,
  },
  quickDateFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  quickDateFilterTextActive: {
    color: '#667eea',
  },
  dateInputsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInputGroup: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  dateInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
  },
  dateRangeHint: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
