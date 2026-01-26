import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { usePurchases } from '@/hooks/api';
import {
  Purchase,
  PurchaseStatus,
  PurchaseStatusLabels,
  PurchaseStatusColors,
  QueryPurchasesParams,
} from '@/types/purchases';
import { useAuthStore } from '@/store/auth';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { AddButton } from '@/components/Navigation/AddButton';
import { StatusFilter, StatusOption } from '@/components/common/StatusFilter';
import { SearchBar } from '@/components/common/SearchBar';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { useDebounce } from '@/hooks/useDebounce';
import { purchasesService } from '@/services/api';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { logger } from '@/utils/logger';
import { CircularProgress } from '@/components/Repartos';
import type { PurchaseValidationProgressResponse } from '@/types/purchases';
import { usePermissions } from '@/hooks/usePermissions';

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
  const limit = 20;

  const { currentCompany, currentSite } = useAuthStore();
  const { width, height } = useWindowDimensions();
  const { hasPermission } = usePermissions();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

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

    return params;
  }, [page, limit, selectedStatus, debouncedSearchTerm]);

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
        // Set default values on error
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
      console.log('📱 PurchasesScreen focused - reloading purchases...');
      refetch();
    }, [refetch])
  );

  const handleRefresh = useCallback(() => {
    setPage(1);
    refetch();
  }, [refetch]);

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

  const handleDownloadReport = useCallback(
    async (purchase: Purchase, event: any) => {
      // Prevent navigation to detail screen
      event.stopPropagation();

      try {
        setDownloadingReportId(purchase.id);

        logger.info('🔄 Descargando reporte de compra...');
        const startTime = new Date().getTime();

        // Call the API to get the PDF blob
        const pdfBlob = await purchasesService.downloadPurchaseReportPdf(purchase.id);

        const endTime = new Date().getTime();
        logger.info('✅ PDF descargado del servidor');
        logger.info('📦 Tamaño del PDF:', pdfBlob.size, 'bytes');
        logger.info('⏱️ Tiempo de descarga:', endTime - startTime, 'ms');

        if (Platform.OS === 'web') {
          // For web, create a download link using blob URL
          const blobUrl = URL.createObjectURL(pdfBlob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `reporte-compra-${purchase.code}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Clean up the blob URL after a short delay
          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

          Alert.alert('Éxito', 'El reporte se está descargando');
        } else {
          // For mobile (iOS/Android), save to file system and share
          const timestamp = new Date().getTime();
          const fileName = `reporte-compra-${purchase.code}-${timestamp}.pdf`;
          const file = new FileSystem.File(FileSystem.Paths.document, fileName);

          // Convert blob to array buffer using FileReader
          const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(pdfBlob);
          });

          // Write to file
          await file.create();
          const writer = file.writableStream().getWriter();
          await writer.write(new Uint8Array(arrayBuffer));
          await writer.close();

          // Share the file
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(file.uri, {
              mimeType: 'application/pdf',
              dialogTitle: `Reporte de Compra - ${purchase.code}`,
              UTI: 'com.adobe.pdf',
            });
          } else {
            Alert.alert('Éxito', `PDF guardado en: ${file.uri}`);
          }
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

  const getStatusBadgeStyle = useCallback(
    (status: PurchaseStatus) => {
      return {
        backgroundColor: PurchaseStatusColors[status] + '20',
        borderColor: PurchaseStatusColors[status],
      };
    },
    []
  );

  const getStatusTextStyle = useCallback(
    (status: PurchaseStatus) => {
      return {
        color: PurchaseStatusColors[status],
      };
    },
    []
  );

  const statuses = useMemo<Array<PurchaseStatus | 'ALL'>>(
    () => [
      'ALL',
      PurchaseStatus.DRAFT,
      PurchaseStatus.IN_CAPTURE,
      PurchaseStatus.IN_VALIDATION,
      PurchaseStatus.VALIDATED,
      PurchaseStatus.CLOSED,
    ],
    []
  );

  // Status filter options using new StatusFilter component
  const statusOptions: StatusOption[] = useMemo(() => {
    const getStatusColor = (status: PurchaseStatus | 'ALL'): string => {
      if (status === 'ALL') return '#6366F1';
      return PurchaseStatusColors[status] || '#6B7280';
    };

    return [
      { value: 'ALL', label: 'Todos', color: '#6366F1' },
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

    // Get progress data from state
    const progress = purchaseProgress.get(purchase.id);
    const progressPercentage = progress?.validationProgressPercentage || 0;
    const progressTotal = progress?.totalProducts || totalProducts;
    const progressValidated = progress?.productsValidated || validatedProducts;

    return (
      <TouchableOpacity
        key={purchase.id}
        style={[styles.card, isTablet && styles.cardTablet]}
        onPress={() => handlePurchasePress(purchase)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.cardCode, isTablet && styles.cardCodeTablet]}>
              {purchase.code}
            </Text>
            <View
              style={[
                styles.statusBadge,
                isTablet && styles.statusBadgeTablet,
                getStatusBadgeStyle(purchase.status),
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isTablet && styles.statusTextTablet,
                  getStatusTextStyle(purchase.status),
                ]}
              >
                {PurchaseStatusLabels[purchase.status]}
              </Text>
            </View>
          </View>
          <Text style={[styles.cardDate, isTablet && styles.cardDateTablet]}>
            {formatDate(purchase.guideDate)}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Proveedor:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
              {purchase.supplier?.commercialName || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Guía:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {purchase.guideNumber}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Productos:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {validatedProducts}/{totalProducts}
            </Text>
          </View>

          {/* Circular Progress for Validation */}
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
              <Text style={[styles.progressLabel, isTablet && styles.progressLabelTablet]}>
                Validación
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.footerText, isTablet && styles.footerTextTablet]}>
            Creado: {formatDate(purchase.createdAt)}
          </Text>
          <View style={styles.cardActions}>
            {hasPermission('purchases.reports.download') && (
              <TouchableOpacity
                style={[
                  styles.downloadButton,
                  isTablet && styles.downloadButtonTablet,
                  isDownloading && styles.downloadButtonDisabled,
                ]}
                onPress={(e) => handleDownloadReport(purchase, e)}
                disabled={isDownloading}
                activeOpacity={0.7}
              >
                {isDownloading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.downloadButtonText, isTablet && styles.downloadButtonTextTablet]}>
                    📄 Reporte
                  </Text>
                )}
              </TouchableOpacity>
            )}
            <Text style={[styles.arrowIcon, isTablet && styles.arrowIconTablet]}>›</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [isTablet, handlePurchasePress, handleDownloadReport, getStatusBadgeStyle, getStatusTextStyle, formatDate, formatCurrency, downloadingReportId, purchaseProgress, hasPermission]);

  if (isLoading && !isRefetching) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando compras...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>Compras</Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              Gestión de compras y validación de productos
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Buscar por código, proveedor..."
            onClear={() => setSearchTerm('')}
          />
        </View>

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

        {/* Purchases List */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            isTablet && styles.contentContainerTablet,
          ]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
        >
          {purchases.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyIcon, isTablet && styles.emptyIconTablet]}>📦</Text>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay compras registradas
              </Text>
              <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                Crea una nueva compra para comenzar
              </Text>
            </View>
          ) : (
            purchases.map(renderPurchaseCard)
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Pagination Controls */}
        {pagination.total > 0 && (
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
                {purchases.length} de {pagination.total}
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

        {/* Add Button */}
        <AddButton onPress={handleCreatePurchase} icon="+" />
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
  statusFilter: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeTablet: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextTablet: {
    fontSize: 13,
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
  progressContainer: {
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  progressLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 6,
  },
  progressLabelTablet: {
    fontSize: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    width: 90,
  },
  infoLabelTablet: {
    fontSize: 15,
    width: 110,
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  footerTextTablet: {
    fontSize: 14,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  downloadButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonTablet: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 100,
  },
  downloadButtonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.7,
  },
  downloadButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  downloadButtonTextTablet: {
    fontSize: 12,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
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
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyTextTablet: {
    fontSize: 22,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  emptySubtextTablet: {
    fontSize: 16,
  },
  bottomSpacer: {
    height: 100,
  },
  paginationContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 60,
  },
  paginationInfo: {
    alignItems: 'center',
    minWidth: 100,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  paginationButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    minWidth: 110,
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
});

export default PurchasesScreen;
