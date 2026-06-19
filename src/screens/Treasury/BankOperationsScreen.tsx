/**
 * BankOperationsScreen.tsx
 *
 * Pantalla para listar, filtrar y paginar operaciones bancarias.
 * Muestra transacciones de tesorería con múltiples filtros avanzados.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import Alert from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { spacing, borderRadius } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { treasuryApi } from '@/services/api/treasury';
import {
  BankTransaction,
  TransactionDirection,
  AssignmentStatus,
  TransferType,
  QueryBankTransactionsParams,
  MOVEMENT_TYPE_LABELS,
  DIRECTION_LABELS,
  DIRECTION_COLORS,
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_COLORS,
  ASSIGNMENT_STATUS_ICONS,
  TRANSFER_TYPE_LABELS,
} from '@/types/treasury';

type Props = NativeStackScreenProps<any, 'BankOperations'>;

// Currency symbols
const CURRENCY_SYMBOLS: Record<string, string> = {
  PEN: 'S/',
  USD: '$',
};

// Movement type groups for filter UI
const MOVEMENT_TYPES_INCOME = [
  'ABONO_TRANSFERENCIA',
  'DEP_EFECTIVO',
  'TRAN_INTERNA_ABONO',
  'ABONO_CHEQUE',
  'INTERES_GANADO',
  'DEVOLUCION',
  'OTRO_ABONO',
];

const MOVEMENT_TYPES_EXPENSE = [
  'CARGO_TRANSFERENCIA',
  'TRAN_INTERNA_CARGO',
  'PAGO_MASIVO_PROVEEDORES',
  'PAGO_PLANILLAS',
  'RETIRO_EFECTIVO',
  'PAGO_CHEQUE',
  'OTRO_CARGO',
];

const MOVEMENT_TYPES_COMMISSION = [
  'ITF',
  'COMISION_OPERACION',
  'COMISION_PLANILLA',
  'COMISION_MANTENIMIENTO',
  'COMISION_IBANC',
  'NOTA_DEBITO',
];

export const BankOperationsScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  // State
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedDirection, setSelectedDirection] = useState<TransactionDirection | null>(null);
  const [selectedMovementType, setSelectedMovementType] = useState<string | null>(null);
  const [selectedAssignmentStatus, setSelectedAssignmentStatus] = useState<AssignmentStatus | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [sortBy, setSortBy] = useState<string>('transactionDate');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

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

  // Load transactions when filters change
  useEffect(() => {
    loadTransactions();
  }, [
    page,
    debouncedSearchQuery,
    selectedDirection,
    selectedMovementType,
    selectedAssignmentStatus,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    sortBy,
    sortOrder,
  ]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [
    selectedDirection,
    selectedMovementType,
    selectedAssignmentStatus,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    sortBy,
    sortOrder,
  ]);

  const loadTransactions = async () => {
    try {
      setLoading(true);

      // Build query params
      const params: QueryBankTransactionsParams = {
        page,
        limit: 50,
        sortBy,
        sortOrder,
      };

      // Add search query
      if (debouncedSearchQuery.trim()) {
        params.search = debouncedSearchQuery.trim();
      }

      // Add direction filter
      if (selectedDirection) {
        params.direction = selectedDirection;
      }

      // Add movement type filter
      if (selectedMovementType) {
        params.movementType = selectedMovementType;
      }

      // Add assignment status filter
      if (selectedAssignmentStatus) {
        params.assignmentStatus = selectedAssignmentStatus;
      }

      // Add date filters
      if (startDate) {
        params.startDate = startDate;
      }
      if (endDate) {
        params.endDate = endDate;
      }

      // Add amount filters
      if (minAmount) {
        params.minAmountCents = Math.round(parseFloat(minAmount) * 100);
      }
      if (maxAmount) {
        params.maxAmountCents = Math.round(parseFloat(maxAmount) * 100);
      }

      console.log('🔍 Loading bank transactions with params:', params);

      const response = await treasuryApi.getTransactions(params);

      console.log('✅ Bank transactions loaded:', {
        total: response.total,
        itemsInPage: response.data.length,
        page,
      });

      setTransactions(response.data);
      setPagination({
        page: response.page || page,
        limit: response.limit || 50,
        total: response.total,
        totalPages: response.totalPages || Math.ceil(response.total / 50),
      });
    } catch (error: any) {
      console.error('❌ Error loading bank transactions:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudieron cargar las operaciones bancarias';
      Alert.alert('Error', errorMessage);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await loadTransactions();
    setRefreshing(false);
  }, [
    debouncedSearchQuery,
    selectedDirection,
    selectedMovementType,
    selectedAssignmentStatus,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    sortBy,
    sortOrder,
  ]);

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

  const clearFilters = () => {
    setSelectedDirection(null);
    setSelectedMovementType(null);
    setSelectedAssignmentStatus(null);
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setSearchQuery('');
    setSortBy('transactionDate');
    setSortOrder('DESC');
  };

  const formatCurrency = (cents: number, currency: string = 'PEN') => {
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    return `${symbol} ${(cents / 100).toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const activeFiltersCount =
    (selectedDirection ? 1 : 0) +
    (selectedMovementType ? 1 : 0) +
    (selectedAssignmentStatus ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0);

  // Render transaction card
  const renderTransactionCard = (item: BankTransaction) => {
    const directionColor = DIRECTION_COLORS[item.direction];
    const statusColor = ASSIGNMENT_STATUS_COLORS[item.assignmentStatus];
    const statusIcon = ASSIGNMENT_STATUS_ICONS[item.assignmentStatus];
    const statusLabel = ASSIGNMENT_STATUS_LABELS[item.assignmentStatus];
    const movementLabel = MOVEMENT_TYPE_LABELS[item.movementType] || item.movementType;
    const isIncome = item.direction === TransactionDirection.INGRESO;
    const transferTypeLabel = item.transferType ? TRANSFER_TYPE_LABELS[item.transferType as TransferType] : null;

    // Get bank info from new fields or fallback to bankAccount
    const displayBankName = item.bankName || item.bankAccount?.bankName;
    const displayAccountNumber = item.accountNumber || item.bankAccount?.accountNumber;
    const displayAccountAlias = item.accountAlias;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.card, isTablet && styles.cardTablet]}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.directionBadge, { backgroundColor: directionColor + '20' }]}>
              <Ionicons
                name={isIncome ? 'arrow-down-circle' : 'arrow-up-circle'}
                size={18}
                color={directionColor}
              />
              <Text style={[styles.directionText, { color: directionColor }]}>
                {DIRECTION_LABELS[item.direction]}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={styles.statusIcon}>{statusIcon}</Text>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            {/* Own Company Transfer Badge */}
            {item.isOwnCompanyTransfer && (
              <View style={[styles.ownTransferBadge]}>
                <Ionicons name="repeat" size={12} color={theme.color.icon.accent} />
                <Text style={styles.ownTransferText}>Propio</Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardAmount, { color: directionColor }]}>
            {isIncome ? '+' : '-'} {formatCurrency(item.amountCents, item.bankAccount?.currency || 'PEN')}
          </Text>
        </View>

        {/* Bank Info Row */}
        <View style={styles.bankInfoRow}>
          {item.bankCode && (
            <View style={styles.bankCodeBadge}>
              <Ionicons name="business" size={12} color={theme.color.brand.primary} />
              <Text style={styles.bankCodeText}>{item.bankCode}</Text>
            </View>
          )}
          {displayAccountAlias && (
            <Text style={styles.accountAliasText} numberOfLines={1}>
              {displayAccountAlias}
            </Text>
          )}
          {transferTypeLabel && (
            <View style={styles.transferTypeBadge}>
              <Text style={styles.transferTypeText}>{transferTypeLabel}</Text>
            </View>
          )}
        </View>

        {/* Account Number */}
        {displayAccountNumber && (
          <View style={styles.accountNumberRow}>
            <Ionicons name="card-outline" size={14} color={theme.color.icon.disabled} />
            <Text style={styles.accountNumberText}>{displayAccountNumber}</Text>
          </View>
        )}

        {/* Movement Type */}
        <View style={styles.movementTypeContainer}>
          <Ionicons name="swap-horizontal" size={16} color={theme.color.icon.subtle} />
          <Text style={styles.movementTypeText}>{movementLabel}</Text>
        </View>

        {/* Description */}
        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {/* Counterparty */}
        {item.counterpartyName && (
          <View style={styles.counterpartyContainer}>
            <Ionicons name="person-outline" size={14} color={theme.color.icon.disabled} />
            <Text style={styles.counterpartyText} numberOfLines={1}>
              {item.counterpartyName}
            </Text>
          </View>
        )}

        {/* Footer: Date & Bank Name */}
        <View style={styles.cardFooter}>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={14} color={theme.color.icon.disabled} />
            <Text style={styles.dateText}>{formatDate(item.transactionDate)}</Text>
          </View>
          {displayBankName && (
            <View style={styles.bankAccountContainer}>
              <Ionicons name="business-outline" size={14} color={theme.color.icon.disabled} />
              <Text style={styles.bankAccountText} numberOfLines={1}>
                {displayBankName}
              </Text>
            </View>
          )}
        </View>

        {/* Operation Number & Batch Number */}
        {(item.operationNumber || item.batchNumber) && (
          <View style={styles.operationNumberContainer}>
            {item.operationNumber && (
              <View style={styles.operationItem}>
                <Text style={styles.operationNumberLabel}>Nro. Op:</Text>
                <Text style={styles.operationNumberValue}>{item.operationNumber}</Text>
              </View>
            )}
            {item.batchNumber && (
              <View style={styles.operationItem}>
                <Text style={styles.operationNumberLabel}>Lote:</Text>
                <Text style={styles.operationNumberValue}>{item.batchNumber}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render filters modal
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
              <Ionicons name="close" size={24} color={theme.color.icon.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Direction Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Dirección</Text>
              <View style={styles.filterChips}>
                <TouchableOpacity
                  style={[styles.filterChip, selectedDirection === null && styles.filterChipActive]}
                  onPress={() => setSelectedDirection(null)}
                >
                  <Text style={[styles.filterChipText, selectedDirection === null && styles.filterChipTextActive]}>
                    Todos
                  </Text>
                </TouchableOpacity>
                {Object.values(TransactionDirection).map((direction) => (
                  <TouchableOpacity
                    key={direction}
                    style={[
                      styles.filterChip,
                      selectedDirection === direction && styles.filterChipActive,
                      { borderColor: DIRECTION_COLORS[direction] },
                    ]}
                    onPress={() => setSelectedDirection(selectedDirection === direction ? null : direction)}
                  >
                    <Ionicons
                      name={direction === TransactionDirection.INGRESO ? 'arrow-down-circle' : 'arrow-up-circle'}
                      size={16}
                      color={selectedDirection === direction ? theme.color.text.inverse : DIRECTION_COLORS[direction]}
                    />
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedDirection === direction && styles.filterChipTextActive,
                      ]}
                    >
                      {DIRECTION_LABELS[direction]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Assignment Status Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Estado de Asignación</Text>
              <View style={styles.filterChips}>
                <TouchableOpacity
                  style={[styles.filterChip, selectedAssignmentStatus === null && styles.filterChipActive]}
                  onPress={() => setSelectedAssignmentStatus(null)}
                >
                  <Text style={[styles.filterChipText, selectedAssignmentStatus === null && styles.filterChipTextActive]}>
                    Todos
                  </Text>
                </TouchableOpacity>
                {Object.values(AssignmentStatus).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterChip,
                      selectedAssignmentStatus === status && styles.filterChipActive,
                      { borderColor: ASSIGNMENT_STATUS_COLORS[status] },
                    ]}
                    onPress={() => setSelectedAssignmentStatus(selectedAssignmentStatus === status ? null : status)}
                  >
                    <Text style={styles.filterChipIcon}>{ASSIGNMENT_STATUS_ICONS[status]}</Text>
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedAssignmentStatus === status && styles.filterChipTextActive,
                      ]}
                    >
                      {ASSIGNMENT_STATUS_LABELS[status]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Movement Type Filter - Income */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Tipo de Movimiento - Ingresos</Text>
              <View style={styles.filterChips}>
                {MOVEMENT_TYPES_INCOME.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterChip,
                      selectedMovementType === type && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedMovementType(selectedMovementType === type ? null : type)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedMovementType === type && styles.filterChipTextActive,
                      ]}
                    >
                      {MOVEMENT_TYPE_LABELS[type]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Movement Type Filter - Expense */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Tipo de Movimiento - Egresos</Text>
              <View style={styles.filterChips}>
                {MOVEMENT_TYPES_EXPENSE.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterChip,
                      selectedMovementType === type && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedMovementType(selectedMovementType === type ? null : type)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedMovementType === type && styles.filterChipTextActive,
                      ]}
                    >
                      {MOVEMENT_TYPE_LABELS[type]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Movement Type Filter - Commissions */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Tipo de Movimiento - Comisiones</Text>
              <View style={styles.filterChips}>
                {MOVEMENT_TYPES_COMMISSION.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterChip,
                      selectedMovementType === type && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedMovementType(selectedMovementType === type ? null : type)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedMovementType === type && styles.filterChipTextActive,
                      ]}
                    >
                      {MOVEMENT_TYPE_LABELS[type]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date Filters */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Rango de Fechas</Text>
              <View style={styles.dateInputsContainer}>
                <View style={styles.dateInputWrapper}>
                  <Text style={styles.dateInputLabel}>Desde</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="YYYY-MM-DD"
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholderTextColor={theme.color.text.placeholder}
                  />
                </View>
                <View style={styles.dateInputWrapper}>
                  <Text style={styles.dateInputLabel}>Hasta</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="YYYY-MM-DD"
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholderTextColor={theme.color.text.placeholder}
                  />
                </View>
              </View>
            </View>

            {/* Amount Filters */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Rango de Montos</Text>
              <View style={styles.amountInputsContainer}>
                <View style={styles.amountInputWrapper}>
                  <Text style={styles.amountInputLabel}>Mínimo</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    value={minAmount}
                    onChangeText={setMinAmount}
                    keyboardType="decimal-pad"
                    placeholderTextColor={theme.color.text.placeholder}
                  />
                </View>
                <View style={styles.amountInputWrapper}>
                  <Text style={styles.amountInputLabel}>Máximo</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    value={maxAmount}
                    onChangeText={setMaxAmount}
                    keyboardType="decimal-pad"
                    placeholderTextColor={theme.color.text.placeholder}
                  />
                </View>
              </View>
            </View>

            {/* Sort Options */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Ordenar por</Text>
              <View style={styles.sortOptions}>
                {[
                  { key: 'transactionDate', label: 'Fecha' },
                  { key: 'amountCents', label: 'Monto' },
                  { key: 'direction', label: 'Dirección' },
                  { key: 'assignmentStatus', label: 'Estado' },
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
                  <Ionicons
                    name="arrow-up"
                    size={16}
                    color={sortOrder === 'ASC' ? theme.color.text.inverse : theme.color.icon.muted}
                  />
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
                  <Ionicons
                    name="arrow-down"
                    size={16}
                    color={sortOrder === 'DESC' ? theme.color.text.inverse : theme.color.icon.muted}
                  />
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

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.color.brand.onHeader} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="swap-horizontal-outline" size={22} color={theme.color.brand.onHeader} />
                </View>
                <Text style={[styles.titleGradient, isTablet && styles.titleTabletGradient]}>
                  Operaciones Bancarias
                </Text>
              </View>
              <Text style={styles.subtitleGradient}>Tesorería - Transacciones</Text>
            </View>
            <View style={styles.statsHeaderContainer}>
              <View style={styles.statHeaderItem}>
                <Text style={styles.statHeaderValue}>{pagination.total}</Text>
                <Text style={styles.statHeaderLabel}>Total</Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={theme.color.text.placeholder} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                placeholder="Buscar descripción, contraparte, nro. operación..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={theme.color.text.placeholder}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                  <Ionicons name="close-circle" size={20} color={theme.color.text.placeholder} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Quick Filters & Filter Button */}
        <View style={styles.quickFiltersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickFilters}>
            <TouchableOpacity
              style={[
                styles.quickFilterChip,
                selectedDirection === TransactionDirection.INGRESO && styles.quickFilterChipActive,
              ]}
              onPress={() =>
                setSelectedDirection(
                  selectedDirection === TransactionDirection.INGRESO ? null : TransactionDirection.INGRESO
                )
              }
            >
              <Ionicons name="arrow-down-circle" size={16} color={selectedDirection === TransactionDirection.INGRESO ? theme.color.text.inverse : DIRECTION_COLORS[TransactionDirection.INGRESO]} />
              <Text
                style={[
                  styles.quickFilterText,
                  selectedDirection === TransactionDirection.INGRESO && styles.quickFilterTextActive,
                ]}
              >
                Ingresos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.quickFilterChip,
                selectedDirection === TransactionDirection.EGRESO && styles.quickFilterChipActive,
              ]}
              onPress={() =>
                setSelectedDirection(
                  selectedDirection === TransactionDirection.EGRESO ? null : TransactionDirection.EGRESO
                )
              }
            >
              <Ionicons name="arrow-up-circle" size={16} color={selectedDirection === TransactionDirection.EGRESO ? theme.color.text.inverse : DIRECTION_COLORS[TransactionDirection.EGRESO]} />
              <Text
                style={[
                  styles.quickFilterText,
                  selectedDirection === TransactionDirection.EGRESO && styles.quickFilterTextActive,
                ]}
              >
                Egresos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.quickFilterChip,
                selectedAssignmentStatus === AssignmentStatus.PENDING && styles.quickFilterChipActive,
              ]}
              onPress={() =>
                setSelectedAssignmentStatus(
                  selectedAssignmentStatus === AssignmentStatus.PENDING ? null : AssignmentStatus.PENDING
                )
              }
            >
              <Text style={styles.quickFilterIcon}>⏳</Text>
              <Text
                style={[
                  styles.quickFilterText,
                  selectedAssignmentStatus === AssignmentStatus.PENDING && styles.quickFilterTextActive,
                ]}
              >
                Pendientes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.quickFilterChip,
                selectedAssignmentStatus === AssignmentStatus.ASSIGNED && styles.quickFilterChipActive,
              ]}
              onPress={() =>
                setSelectedAssignmentStatus(
                  selectedAssignmentStatus === AssignmentStatus.ASSIGNED ? null : AssignmentStatus.ASSIGNED
                )
              }
            >
              <Text style={styles.quickFilterIcon}>✓</Text>
              <Text
                style={[
                  styles.quickFilterText,
                  selectedAssignmentStatus === AssignmentStatus.ASSIGNED && styles.quickFilterTextActive,
                ]}
              >
                Asignados
              </Text>
            </TouchableOpacity>
          </ScrollView>
          <TouchableOpacity
            style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
            onPress={() => setShowFiltersModal(true)}
          >
            <Ionicons name="options" size={20} color={activeFiltersCount > 0 ? theme.color.text.inverse : theme.color.icon.muted} />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Transactions List */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.color.brand.primary} />
              <Text style={[styles.loadingText, isTablet && styles.loadingTextTablet]}>
                Cargando operaciones bancarias...
              </Text>
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={theme.color.icon.disabled} />
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                {debouncedSearchQuery || activeFiltersCount > 0
                  ? 'No se encontraron operaciones con los filtros aplicados'
                  : 'No hay operaciones bancarias registradas'}
              </Text>
              {activeFiltersCount > 0 && (
                <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                  <Text style={styles.clearFiltersButtonText}>Limpiar Filtros</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.transactionsGrid}>
              {transactions.map(renderTransactionCard)}
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
              <Ionicons
                name="chevron-back"
                size={20}
                color={pagination.page === 1 ? theme.color.text.disabled : theme.color.brand.primary}
              />
              <Text
                style={[
                  styles.paginationButtonText,
                  pagination.page === 1 && styles.paginationButtonTextDisabled,
                ]}
              >
                Anterior
              </Text>
            </TouchableOpacity>

            <View style={styles.paginationInfo}>
              <Text style={styles.paginationText}>
                Pág. {pagination.page}/{pagination.totalPages}
              </Text>
              <Text style={styles.paginationSubtext}>
                {transactions.length} de {pagination.total}
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
                Siguiente
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={pagination.page >= pagination.totalPages ? theme.color.text.disabled : theme.color.brand.primary}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Filters Modal */}
        {renderFiltersModal()}
      </SafeAreaView>
    </ScreenLayout>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.surface.muted,
  },

  // Header
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: theme.color.brand.headerBadge,
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
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  titleGradient: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.text.inverse,
    letterSpacing: 0.3,
  },
  titleTabletGradient: {
    fontSize: 28,
  },
  subtitleGradient: {
    fontSize: 14,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    marginLeft: spacing[12],
  },
  statsHeaderContainer: {
    alignItems: 'flex-end',
  },
  statHeaderItem: {
    alignItems: 'center',
    backgroundColor: theme.color.brand.headerBadge,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  statHeaderValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
  },
  statHeaderLabel: {
    fontSize: 11,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
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
    color: theme.color.text.body,
  },
  searchInputTablet: {
    fontSize: 16,
    paddingVertical: 14,
  },
  clearSearchButton: {
    padding: spacing[1],
  },

  // Quick Filters
  quickFiltersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  quickFilters: {
    flex: 1,
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginRight: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: theme.color.surface.muted,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    gap: spacing[1],
  },
  quickFilterChipActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  quickFilterIcon: {
    fontSize: 14,
  },
  quickFilterText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.color.text.body,
  },
  quickFilterTextActive: {
    color: theme.color.text.inverse,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: theme.color.surface.muted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  filterButtonActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.color.icon.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.color.text.inverse,
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4],
  },
  contentContainerTablet: {
    padding: spacing[6],
  },
  transactionsGrid: {
    gap: spacing[3],
  },

  // Card
  card: {
    backgroundColor: theme.color.surface.base,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTablet: {
    padding: spacing[5],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
    flex: 1,
  },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    gap: spacing[1],
  },
  directionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    gap: spacing[1],
  },
  statusIcon: {
    fontSize: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  movementTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  movementTypeText: {
    fontSize: 13,
    color: theme.color.text.muted,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: theme.color.text.body,
    lineHeight: 20,
    marginBottom: spacing[2],
  },
  counterpartyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  counterpartyText: {
    fontSize: 13,
    color: theme.color.text.subtle,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  dateText: {
    fontSize: 12,
    color: theme.color.text.subtle,
  },
  bankAccountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    flex: 1,
    justifyContent: 'flex-end',
  },
  bankAccountText: {
    fontSize: 12,
    color: theme.color.text.subtle,
  },
  operationNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  operationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  operationNumberLabel: {
    fontSize: 11,
    color: theme.color.text.disabled,
  },
  operationNumberValue: {
    fontSize: 11,
    color: theme.color.text.muted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // New fields styles
  ownTransferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    backgroundColor: theme.color.state.info.background,
    gap: spacing[1],
  },
  ownTransferText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.color.state.info.text,
  },
  bankInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  bankCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    backgroundColor: theme.color.brand.primarySoft,
    borderWidth: 1,
    borderColor: theme.color.brand.primary,
    gap: spacing[1],
  },
  bankCodeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.color.brand.primary,
  },
  accountAliasText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.color.text.body,
    flex: 1,
  },
  transferTypeBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    backgroundColor: theme.color.state.warning.background,
  },
  transferTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.color.state.warning.text,
  },
  accountNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    backgroundColor: theme.color.surface.subtle,
    borderRadius: borderRadius.md,
  },
  accountNumberText: {
    fontSize: 12,
    color: theme.color.text.muted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Loading & Empty
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[16],
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: 14,
    color: theme.color.text.subtle,
  },
  loadingTextTablet: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[16],
  },
  emptyText: {
    marginTop: spacing[4],
    fontSize: 14,
    color: theme.color.text.subtle,
    textAlign: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyTextTablet: {
    fontSize: 16,
  },
  clearFiltersButton: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: theme.color.brand.primarySoft,
    borderRadius: borderRadius.full,
  },
  clearFiltersButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.brand.primary,
  },

  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: theme.color.surface.base,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    gap: spacing[1],
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.brand.primary,
  },
  paginationButtonTextDisabled: {
    color: theme.color.text.disabled,
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
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.color.surface.base,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
  },
  modalContentTablet: {
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  modalBody: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
    gap: spacing[3],
  },

  // Filter sections
  filterSection: {
    marginBottom: spacing[5],
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: spacing[3],
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: theme.color.surface.muted,
    borderWidth: 1,
    borderColor: theme.color.border.default,
    gap: spacing[1],
  },
  filterChipActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  filterChipIcon: {
    fontSize: 14,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.color.text.body,
  },
  filterChipTextActive: {
    color: theme.color.text.inverse,
  },

  // Date inputs
  dateInputsContainer: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginBottom: spacing[1],
  },
  dateInput: {
    backgroundColor: theme.color.surface.muted,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: 14,
    color: theme.color.text.body,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },

  // Amount inputs
  amountInputsContainer: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  amountInputWrapper: {
    flex: 1,
  },
  amountInputLabel: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginBottom: spacing[1],
  },
  amountInput: {
    backgroundColor: theme.color.surface.muted,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: 14,
    color: theme.color.text.body,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },

  // Sort options
  sortOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  sortOption: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: theme.color.surface.muted,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  sortOptionActive: {
    backgroundColor: theme.color.brand.primarySoft,
    borderColor: theme.color.brand.primary,
  },
  sortOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.color.text.muted,
  },
  sortOptionTextActive: {
    color: theme.color.brand.primary,
  },
  sortOrder: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  sortOrderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: theme.color.surface.muted,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    gap: spacing[1],
  },
  sortOrderButtonActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  sortOrderText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.color.text.muted,
  },
  sortOrderTextActive: {
    color: theme.color.text.inverse,
  },

  // Buttons
  clearButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    backgroundColor: theme.color.surface.muted,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text.muted,
  },
  applyButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    backgroundColor: theme.color.brand.primary,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text.inverse,
  },
});

export default BankOperationsScreen;
