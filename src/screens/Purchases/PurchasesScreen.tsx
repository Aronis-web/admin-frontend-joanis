/**
 * PurchasesScreen - Lista de Compras
 * Migrado al Design System unificado
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePurchases } from '@/hooks/api';
import {
  Purchase,
  PurchaseStatus,
  PurchaseStatusLabels,
  PurchaseStatusColors,
  QueryPurchasesParams,
  DateFieldType,
  PurchaseAutocompleteSuggestion,
} from '@/types/purchases';
import { useAuthStore } from '@/store/auth';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { StatusFilter, StatusOption } from '@/components/common/StatusFilter';
import { SearchBarWithAutocomplete } from '@/components/common/SearchBarWithAutocomplete';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { formatDateToString } from '@/utils/dateHelpers';
import { useDebounce } from '@/hooks/useDebounce';
import { purchasesService } from '@/services/api';
import { saveAndSharePdf } from '@/utils/fileDownload';
import { logger } from '@/utils/logger';
import { CircularProgress } from '@/components/Repartos';
import type { PurchaseValidationProgressResponse } from '@/types/purchases';
import { usePermissions } from '@/hooks/usePermissions';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  Title,
  Body,
  Label,
  Caption,
  Badge,
  Card,
  Button,
  EmptyState,
  Pagination,
} from '@/design-system';

interface PurchasesScreenProps {
  navigation: any;
}

export const PurchasesScreen: React.FC<PurchasesScreenProps> = ({ navigation }) => {
  // Screen tracking
  useScreenTracking('PurchasesScreen', 'PurchasesScreen');

  const [selectedStatus, setSelectedStatus] = useState<PurchaseStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [purchaseProgress, setPurchaseProgress] = useState<Map<string, PurchaseValidationProgressResponse>>(new Map());

  // Date filter states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateField, setDateField] = useState<DateFieldType>('guideDate');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showDateFilters, setShowDateFilters] = useState(false);

  const limit = 20;

  const { currentCompany, currentSite } = useAuthStore();
  const { width, height } = useWindowDimensions();
  const { hasPermission } = usePermissions();

  const isTablet = width >= 768 || height >= 768;

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Build query params
  const queryParams = useMemo<QueryPurchasesParams>(() => {
    const params: QueryPurchasesParams = {
      page,
      limit,
    };

    if (selectedStatus !== 'ALL') {
      params.status = selectedStatus;
    }

    if (debouncedSearchTerm) {
      params.search = debouncedSearchTerm;
    }

    if (startDate) {
      params.startDate = startDate;
    }

    if (endDate) {
      params.endDate = endDate;
    }

    if (startDate || endDate) {
      params.dateField = dateField;
    }

    return params;
  }, [page, limit, selectedStatus, debouncedSearchTerm, startDate, endDate, dateField]);

  // Fetch purchases with React Query
  const { data, isLoading, isRefetching, refetch } = usePurchases(queryParams);

  const purchases = data?.data || [];
  const pagination = useMemo(
    () => ({
      page: data?.page || 1,
      limit: data?.limit || limit,
      total: data?.total || 0,
      totalPages: Math.ceil((data?.total || 0) / (data?.limit || limit)),
    }),
    [data, limit]
  );

  // Load purchase progress for all purchases
  const loadPurchaseProgress = useCallback(async (purchaseIds: string[]) => {
    const progressMap = new Map<string, PurchaseValidationProgressResponse>();

    for (const purchaseId of purchaseIds) {
      try {
        const progressData = await purchasesService.getPurchaseValidationProgress(purchaseId);
        progressMap.set(purchaseId, progressData);
      } catch (error) {
        logger.error(`Error loading progress for purchase ${purchaseId}:`, error);
        progressMap.set(purchaseId, {
          purchaseId,
          purchaseCode: '',
          purchaseStatus: PurchaseStatus.DRAFT,
          supplierName: '',
          totalProducts: 0,
          productsValidated: 0,
          productsInValidation: 0,
          productsPreliminary: 0,
          productsRejected: 0,
          productsClosed: 0,
          validationProgressPercentage: 0,
          totalPreliminaryCents: 0,
          totalValidatedCents: 0,
          totalDifferenceCents: 0,
          totalPreliminaryStock: 0,
          totalValidatedStock: 0,
          totalStockDifference: 0,
          productsWithPhotos: 0,
        });
      }
    }

    setPurchaseProgress(progressMap);
  }, []);

  // Load progress when purchases change
  useFocusEffect(
    useCallback(() => {
      if (purchases.length > 0) {
        const purchaseIds = purchases.map((p) => p.id);
        loadPurchaseProgress(purchaseIds);
      }
    }, [purchases, loadPurchaseProgress])
  );

  // Auto-reload purchases when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleRefresh = useCallback(() => {
    setPage(1);
    refetch();
  }, [refetch]);

  const handleClearDateFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setPage(1);
  }, []);

  const handleStartDateConfirm = useCallback((date: Date) => {
    const formattedDate = formatDateToString(date);
    setStartDate(formattedDate);
    setShowStartDatePicker(false);
    setPage(1);
  }, []);

  const handleEndDateConfirm = useCallback((date: Date) => {
    const formattedDate = formatDateToString(date);
    setEndDate(formattedDate);
    setShowEndDatePicker(false);
    setPage(1);
  }, []);

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

  const handleCreatePurchase = useCallback(() => {
    navigation.navigate('CreatePurchase');
  }, [navigation]);

  const handlePurchasePress = useCallback(
    (purchase: Purchase) => {
      navigation.navigate('PurchaseDetail', { purchaseId: purchase.id });
    },
    [navigation]
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: PurchaseAutocompleteSuggestion) => {
      navigation.navigate('PurchaseDetail', { purchaseId: suggestion.id });
      setSearchTerm('');
    },
    [navigation]
  );

  const handleDownloadReport = useCallback(
    async (purchase: Purchase, event: any) => {
      event.stopPropagation();

      try {
        setDownloadingReportId(purchase.id);

        logger.info('🔄 Descargando reporte de compra...');
        const startTime = new Date().getTime();

        const pdfBlob = await purchasesService.downloadPurchaseReportPdf(purchase.id);

        const endTime = new Date().getTime();
        logger.info('✅ PDF descargado del servidor');
        logger.info('📦 Tamaño del PDF:', pdfBlob.size, 'bytes');
        logger.info('⏱️ Tiempo de descarga:', endTime - startTime, 'ms');

        const timestamp = new Date().getTime();
        const fileName = `reporte-compra-${purchase.code}-${timestamp}.pdf`;

        await saveAndSharePdf(pdfBlob, fileName, `Reporte de Compra - ${purchase.code}`);

        if (Platform.OS === 'web') {
          Alert.alert('Éxito', 'El reporte se está descargando');
        }
      } catch (error: any) {
        logger.error('Error downloading report:', error);
        Alert.alert('Error', error.message || 'No se pudo descargar el reporte');
      } finally {
        setDownloadingReportId(null);
      }
    },
    []
  );

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, []);

  const formatCurrency = useCallback((cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  }, []);

  const getStatusVariant = useCallback((status: PurchaseStatus): 'active' | 'pending' | 'draft' | 'completed' | 'cancelled' => {
    switch (status) {
      case PurchaseStatus.DRAFT:
        return 'draft';
      case PurchaseStatus.IN_CAPTURE:
      case PurchaseStatus.IN_VALIDATION:
        return 'pending';
      case PurchaseStatus.VALIDATED:
        return 'completed';
      case PurchaseStatus.CLOSED:
        return 'active';
      case PurchaseStatus.CANCELLED:
        return 'cancelled';
      default:
        return 'draft';
    }
  }, []);

  // Status filter options
  const statusOptions: StatusOption[] = useMemo(() => {
    const getStatusColor = (status: PurchaseStatus | 'ALL'): string => {
      if (status === 'ALL') return colors.accent[500];
      return PurchaseStatusColors[status] || colors.neutral[500];
    };

    return [
      { value: 'ALL', label: 'Todos', color: colors.accent[500] },
      { value: PurchaseStatus.DRAFT, label: PurchaseStatusLabels[PurchaseStatus.DRAFT], color: getStatusColor(PurchaseStatus.DRAFT) },
      { value: PurchaseStatus.IN_CAPTURE, label: PurchaseStatusLabels[PurchaseStatus.IN_CAPTURE], color: getStatusColor(PurchaseStatus.IN_CAPTURE) },
      { value: PurchaseStatus.IN_VALIDATION, label: PurchaseStatusLabels[PurchaseStatus.IN_VALIDATION], color: getStatusColor(PurchaseStatus.IN_VALIDATION) },
      { value: PurchaseStatus.VALIDATED, label: PurchaseStatusLabels[PurchaseStatus.VALIDATED], color: getStatusColor(PurchaseStatus.VALIDATED) },
      { value: PurchaseStatus.CLOSED, label: PurchaseStatusLabels[PurchaseStatus.CLOSED], color: getStatusColor(PurchaseStatus.CLOSED) },
      { value: PurchaseStatus.CANCELLED, label: PurchaseStatusLabels[PurchaseStatus.CANCELLED], color: getStatusColor(PurchaseStatus.CANCELLED) },
    ];
  }, []);

  const renderPurchaseCard = useCallback((purchase: Purchase) => {
    const totalProducts = purchase.products?.length || 0;
    const validatedProducts =
      purchase.products?.filter((p) => p.status === 'VALIDATED').length || 0;
    const isDownloading = downloadingReportId === purchase.id;

    const progress = purchaseProgress.get(purchase.id);
    const progressPercentage = progress?.validationProgressPercentage || 0;
    const progressTotal = progress?.totalProducts || totalProducts;
    const progressValidated = progress?.productsValidated || validatedProducts;

    return (
      <Card
        key={purchase.id}
        variant="elevated"
        padding="medium"
        onPress={() => handlePurchasePress(purchase)}
        style={styles.purchaseCard}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Title size="medium" style={styles.cardCode}>
              {purchase.code}
            </Title>
            <Badge
              label={PurchaseStatusLabels[purchase.status]}
              variant={getStatusVariant(purchase.status)}
              size="small"
            />
          </View>
          <Caption color="secondary">{formatDate(purchase.guideDate)}</Caption>
        </View>

        {/* Body */}
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>Proveedor:</Label>
            <Body numberOfLines={1} style={styles.infoValue}>
              {purchase.supplier?.commercialName || 'N/A'}
            </Body>
          </View>

          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>Guía:</Label>
            <Body style={styles.infoValue}>{purchase.guideNumber}</Body>
          </View>

          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>Productos:</Label>
            <Body style={styles.infoValue}>
              {validatedProducts}/{totalProducts}
            </Body>
          </View>

          {/* Circular Progress */}
          {progressTotal > 0 && (
            <View style={styles.progressContainer}>
              <CircularProgress
                size={isTablet ? 70 : 60}
                strokeWidth={isTablet ? 7 : 6}
                progress={progressPercentage}
                total={progressTotal}
                validated={progressValidated}
                fontSize={isTablet ? 14 : 12}
              />
              <Caption color="secondary" style={styles.progressLabel}>
                Validación
              </Caption>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <Caption color="tertiary">Creado: {formatDate(purchase.createdAt)}</Caption>
          <View style={styles.cardActions}>
            {hasPermission('purchases.reports.download') && (
              <TouchableOpacity
                style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
                onPress={(e) => handleDownloadReport(purchase, e)}
                disabled={isDownloading}
                activeOpacity={0.7}
              >
                {isDownloading ? (
                  <ActivityIndicator size="small" color={colors.text.inverse} />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={14} color={colors.text.inverse} />
                    <Caption color={colors.text.inverse} style={styles.downloadButtonText}>
                      Reporte
                    </Caption>
                  </>
                )}
              </TouchableOpacity>
            )}
            <Ionicons name="chevron-forward" size={20} color={colors.icon.tertiary} />
          </View>
        </View>
      </Card>
    );
  }, [isTablet, handlePurchasePress, handleDownloadReport, getStatusVariant, formatDate, downloadingReportId, purchaseProgress, hasPermission]);

  if (isLoading && !isRefetching) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
                <Title size="large" style={styles.headerTitle}>Compras</Title>
              </View>
              <Body style={styles.headerSubtitle}>Gestión de compras y validación</Body>
            </View>
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[900]} />
          <Body color="secondary" style={styles.loadingText}>Cargando compras...</Body>
        </View>
      </SafeAreaView>
    );
  }

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
                <Title size="large" style={styles.headerTitle}>Compras</Title>
              </View>
              <Body style={styles.headerSubtitle}>Gestión de compras y validación</Body>
            </View>

            {/* Stats */}
            <View style={styles.statsHeaderContainer}>
              <View style={styles.statHeaderItem}>
                <Label style={styles.statHeaderValue}>{pagination.total}</Label>
                <Caption style={styles.statHeaderLabel}>Total</Caption>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchInputWrapper}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Buscar por código, proveedor, productos..."
                placeholderTextColor={colors.neutral[400]}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color={colors.neutral[400]} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Status Filter */}
        <StatusFilter
          statuses={statusOptions}
          selectedStatus={selectedStatus}
          onStatusChange={(status) => {
            setSelectedStatus(status as PurchaseStatus | 'ALL');
            setPage(1);
          }}
          style={styles.statusFilter}
        />

        {/* Date Filters Toggle */}
        <View style={styles.dateFilterToggleContainer}>
          <TouchableOpacity
            style={styles.dateFilterToggle}
            onPress={() => setShowDateFilters(!showDateFilters)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showDateFilters ? 'calendar' : 'calendar-outline'}
              size={20}
              color={colors.primary[900]}
            />
            <Label color="primary" style={styles.dateFilterToggleText}>
              {showDateFilters ? 'Ocultar Filtros de Fecha' : 'Filtrar por Fecha'}
            </Label>
            <Ionicons
              name={showDateFilters ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.primary[900]}
            />
          </TouchableOpacity>
          {(startDate || endDate) && (
            <TouchableOpacity
              style={styles.clearDateButton}
              onPress={handleClearDateFilters}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={20} color={colors.danger[500]} />
            </TouchableOpacity>
          )}
        </View>

        {/* Date Filters Panel */}
        {showDateFilters && (
          <View style={styles.dateFiltersPanel}>
            {/* Date Field Selector */}
            <View style={styles.dateFieldSelector}>
              <Label color="secondary">Filtrar por:</Label>
              <View style={styles.dateFieldButtons}>
                {[
                  { field: 'guideDate' as DateFieldType, label: 'Fecha de Guía' },
                  { field: 'createdAt' as DateFieldType, label: 'Fecha de Creación' },
                  { field: 'closedAt' as DateFieldType, label: 'Fecha de Cierre' },
                ].map(({ field, label }) => (
                  <TouchableOpacity
                    key={field}
                    style={[
                      styles.dateFieldButton,
                      dateField === field && styles.dateFieldButtonActive,
                    ]}
                    onPress={() => {
                      setDateField(field);
                      setPage(1);
                    }}
                    activeOpacity={0.7}
                  >
                    <Caption
                      color={dateField === field ? colors.text.inverse : 'secondary'}
                    >
                      {label}
                    </Caption>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date Range Pickers */}
            <View style={styles.dateRangePickers}>
              <View style={styles.datePickerWrapper}>
                <DatePickerButton
                  label="Fecha Inicial"
                  value={startDate}
                  onPress={() => setShowStartDatePicker(true)}
                  placeholder="Seleccionar fecha inicial"
                  icon="calendar-outline"
                />
              </View>
              <View style={styles.datePickerWrapper}>
                <DatePickerButton
                  label="Fecha Final"
                  value={endDate}
                  onPress={() => setShowEndDatePicker(true)}
                  placeholder="Seleccionar fecha final"
                  icon="calendar-outline"
                />
              </View>
            </View>

            {/* Active Filters Info */}
            {(startDate || endDate) && (
              <View style={styles.activeFiltersInfo}>
                <Ionicons name="information-circle" size={16} color={colors.info[500]} />
                <Caption color="secondary" style={styles.activeFiltersText}>
                  {startDate && endDate
                    ? `Mostrando compras desde ${startDate} hasta ${endDate}`
                    : startDate
                    ? `Mostrando compras desde ${startDate}`
                    : `Mostrando compras hasta ${endDate}`}
                </Caption>
              </View>
            )}
          </View>
        )}

        {/* Purchases List */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            isTablet && styles.contentContainerTablet,
          ]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} colors={[colors.primary[900]]} />}
        >
          {purchases.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="No hay compras registradas"
              description="Crea una nueva compra para comenzar"
              actionLabel="Nueva Compra"
              onAction={handleCreatePurchase}
            />
          ) : (
            purchases.map(renderPurchaseCard)
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Pagination Controls */}
        {pagination.total > 0 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={limit}
            onPageChange={setPage}
          />
        )}

        {/* Add Button */}
        <ProtectedFAB
          icon="+"
          onPress={handleCreatePurchase}
          requiredPermissions={['purchases.create']}
          hideIfNoPermission={true}
        />

        {/* Date Pickers */}
        <DatePicker
          visible={showStartDatePicker}
          date={startDate ? new Date(startDate) : new Date()}
          onConfirm={handleStartDateConfirm}
          onCancel={() => setShowStartDatePicker(false)}
          title="Seleccionar Fecha Inicial"
        />

        <DatePicker
          visible={showEndDatePicker}
          date={endDate ? new Date(endDate) : new Date()}
          onConfirm={handleEndDateConfirm}
          onCancel={() => setShowEndDatePicker(false)}
          title="Seleccionar Fecha Final"
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
  // Header con gradiente
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
  headerTitle: {
    color: colors.neutral[0],
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
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
  searchInputWrapper: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[4],
  },
  statusFilter: {
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  dateFilterToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  dateFilterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dateFilterToggleText: {
    marginLeft: spacing[2],
  },
  clearDateButton: {
    padding: spacing[1],
  },
  dateFiltersPanel: {
    backgroundColor: colors.surface.secondary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing[4],
  },
  dateFieldSelector: {
    gap: spacing[2],
  },
  dateFieldButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  dateFieldButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  dateFieldButtonActive: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  dateRangePickers: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  datePickerWrapper: {
    flex: 1,
  },
  activeFiltersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.info[50],
    padding: spacing[3],
    borderRadius: borderRadius.md,
  },
  activeFiltersText: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4],
    gap: spacing[4],
  },
  contentContainerTablet: {
    padding: spacing[6],
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  purchaseCard: {
    marginBottom: spacing[3],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
  },
  cardHeaderLeft: {
    flex: 1,
    gap: spacing[2],
  },
  cardCode: {
    marginBottom: spacing[1],
  },
  cardBody: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    width: 90,
  },
  infoValue: {
    flex: 1,
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  progressLabel: {
    marginTop: spacing[2],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[900],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.md,
    gap: spacing[1],
  },
  downloadButtonDisabled: {
    backgroundColor: colors.neutral[400],
    opacity: 0.7,
  },
  downloadButtonText: {
    marginLeft: spacing[1],
  },
  bottomSpacer: {
    height: spacing[20],
  },
});

export default PurchasesScreen;
