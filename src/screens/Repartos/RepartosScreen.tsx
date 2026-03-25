import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { repartosService } from '@/services/api';
import {
  Campaign,
  CampaignStatus,
  CampaignStatusLabels,
  CampaignStatusColors,
} from '@/types/campaigns';
import { useCampaigns } from '@/hooks/api';
import { RepartoProducto, RepartoProductoValidationStatus } from '@/types/repartos';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProductSelectionModal, CircularProgress } from '@/components/Repartos';
import * as downloadTracker from '@/utils/downloadTracker';
import { logger } from '@/utils/logger';

interface RepartosScreenProps {
  navigation: any;
}

export const RepartosScreen: React.FC<RepartosScreenProps> = ({ navigation }) => {
  // ✅ Por defecto mostrar todas menos canceladas y borrador
  const [selectedStatus, setSelectedStatus] = useState<CampaignStatus | 'ALL' | 'NOT_CANCELLED_DRAFT'>('NOT_CANCELLED_DRAFT');
  const [exportingCampaignId, setExportingCampaignId] = useState<string | null>(null);
  const [showProductSelectionModal, setShowProductSelectionModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);
  const [allProducts, setAllProducts] = useState<RepartoProducto[]>([]);
  const [campaignProgress, setCampaignProgress] = useState<Map<string, { validated: number; total: number; percentage: number }>>(new Map());
  const [distributionFormatModalVisible, setDistributionFormatModalVisible] = useState(false);
  const [selectedProductsForExport, setSelectedProductsForExport] = useState<string[]>([]);
  // ✅ Estado de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  // Build query params con paginación
  const queryParams = useMemo(() => {
    const params: any = {
      page: currentPage,
      limit: ITEMS_PER_PAGE,
    };
    if (selectedStatus !== 'ALL' && selectedStatus !== 'NOT_CANCELLED_DRAFT') {
      params.status = selectedStatus;
    }
    return params;
  }, [selectedStatus, currentPage]);

  // React Query hook
  const { data, isLoading, isRefetching, refetch } = useCampaigns(queryParams);

  // Clean campaigns data - remove duplicate products and filter by status
  const campaigns = useMemo(() => {
    if (!data?.data) return [];

    const allCampaigns = data.data.map((campaign: Campaign) => {
      if (campaign.products && campaign.products.length > 0) {
        // Group products by productId to remove duplicates
        const uniqueProductsMap = new Map();
        campaign.products.forEach((product: any) => {
          const productId = product.productId || product.id;
          if (productId && !uniqueProductsMap.has(productId)) {
            uniqueProductsMap.set(productId, product);
          }
        });
        return {
          ...campaign,
          products: Array.from(uniqueProductsMap.values()),
        };
      }
      return campaign;
    });

    // ✅ Filtrar canceladas y borrador si selectedStatus es 'NOT_CANCELLED_DRAFT'
    if (selectedStatus === 'NOT_CANCELLED_DRAFT') {
      return allCampaigns.filter(
        (c) => c.status !== CampaignStatus.CANCELLED && c.status !== CampaignStatus.DRAFT
      );
    }
    return allCampaigns;
  }, [data, selectedStatus]);

  // ✅ Cargar progreso de campañas con límite de concurrencia (batches de 3)
  const loadCampaignProgress = useCallback(async (campaignIds: string[]) => {
    const progressMap = new Map<string, { validated: number; total: number; percentage: number }>();
    const BATCH_SIZE = 3; // Limitar a 3 requests simultáneos

    for (let i = 0; i < campaignIds.length; i += BATCH_SIZE) {
      const batch = campaignIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (campaignId) => {
          try {
            const progressData = await repartosService.getCampaignProgress(campaignId);
            return {
              campaignId,
              progressData: {
                validated: progressData.overallProgress.productsValidated,
                total: progressData.overallProgress.productsAssigned,
                percentage: progressData.overallProgress.productsPercentage,
              },
            };
          } catch (error) {
            // Si falla, usar valores por defecto
            return {
              campaignId,
              progressData: {
                validated: 0,
                total: 0,
                percentage: 0,
              },
            };
          }
        })
      );

      results.forEach(({ campaignId, progressData }) => {
        progressMap.set(campaignId, progressData);
      });
    }

    setCampaignProgress(progressMap);
  }, []);

  // ✅ Combinar useEffects con stale time check
  const lastFetchRef = useRef<number>(0);

  // ✅ Resetear página cuando cambia el filtro de estado
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const STALE_TIME = 5 * 60 * 1000; // 5 minutos

      if (now - lastFetchRef.current > STALE_TIME) {
        refetch();
        lastFetchRef.current = now;
      }

      if (campaigns.length > 0) {
        const campaignIds = campaigns.map((c) => c.id);
        loadCampaignProgress(campaignIds);
      }
    }, [campaigns, loadCampaignProgress, refetch])
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleCampaignPress = useCallback(
    (campaign: Campaign) => {
      navigation.navigate('RepartoCampaignDetail', { campaignId: campaign.id });
    },
    [navigation]
  );

  const handleOpenProductSelection = useCallback(async (
    campaignId: string,
    campaignName: string,
    campaignCode: string
  ) => {
    try {
      // Load repartos for this campaign to get all products
      const repartos = await repartosService.getRepartosByCampaign(campaignId);

      // Collect all products from all repartos and group by product ID
      const productMap = new Map<string, RepartoProducto>();

      repartos.forEach((reparto) => {
        reparto.participantes?.forEach((participante: any) => {
          participante.productos?.forEach((producto: RepartoProducto) => {
            // Use product ID as key to avoid duplicates
            const productKey = producto.productId;
            if (productKey && !productMap.has(productKey)) {
              productMap.set(productKey, producto);
            }
          });
        });
      });

      // Convert map to array
      const uniqueProducts = Array.from(productMap.values());

      if (uniqueProducts.length === 0) {
        Alert.alert('Sin productos', 'Esta campaña no tiene productos para exportar');
        return;
      }

      // Cargar información de descargas desde el almacenamiento local
      const downloadInfo = await downloadTracker.getCampaignDownloads(campaignId);

      // Combinar productos con información de descargas
      const productsWithDownloadInfo = uniqueProducts.map((producto) => {
        const downloadRecord = downloadInfo.get(producto.productId);
        return {
          ...producto,
          downloadCount: downloadRecord?.downloadCount || 0,
          lastDownloadedAt: downloadRecord?.lastDownloadedAt,
        };
      });

      // Sort products by area name (ascending)
      const sortedProducts = productsWithDownloadInfo.sort((a, b) => {
        const areaA = a.area?.name || a.areaId || '';
        const areaB = b.area?.name || b.areaId || '';
        return areaA.localeCompare(areaB, 'es', { sensitivity: 'base' });
      });

      setSelectedCampaign({ id: campaignId, name: campaignName, code: campaignCode });
      setAllProducts(sortedProducts);
      setShowProductSelectionModal(true);
    } catch (error: any) {
      logger.error('Error loading products:', error);
      Alert.alert('No se pudieron cargar los productos de la campaña');
    }
  }, []);

  const handleExportDistributionSheets = useCallback(async (selectedProductIds: string[]) => {
    if (!selectedCampaign) {
      return;
    }

    // Store selected products and show format selection modal
    setSelectedProductsForExport(selectedProductIds);
    setShowProductSelectionModal(false);
    setDistributionFormatModalVisible(true);
  }, [selectedCampaign]);

  const handleDownloadDistributionSheets = useCallback(async (format: 'pdf' | 'excel') => {
    if (!selectedCampaign) {
      return;
    }

    try {
      setExportingCampaignId(selectedCampaign.id);
      setDistributionFormatModalVisible(false);

      logger.info(`🔄 Iniciando descarga de ${format.toUpperCase()} para campaña:`, selectedCampaign.id);
      const startTime = new Date().getTime();

      let blob: Blob;
      let extension: string;
      let mimeType: string;
      let uti: string;

      if (format === 'pdf') {
        // Call the API to get the PDF blob with selected products
        blob = await repartosService.exportCampaignDistributionSheets(
          selectedCampaign.id,
          selectedProductsForExport
        );
        extension = 'pdf';
        mimeType = 'application/pdf';
        uti = 'com.adobe.pdf';
      } else {
        // Call the API to get the Excel blob with selected products
        blob = await repartosService.exportDistributionSummaryExcel(
          selectedCampaign.id,
          selectedProductsForExport
        );
        extension = 'xlsx';
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        uti = 'org.openxmlformats.spreadsheetml.sheet';
      }

      // Register download for tracking purposes (local storage)
      try {
        await downloadTracker.registerDownloads(selectedCampaign.id, selectedProductsForExport);
        logger.debug('✅ Descarga registrada localmente para seguimiento');
      } catch (error) {
        logger.warn('⚠️ No se pudo registrar la descarga:', error);
        // Don't fail the download if tracking fails
      }

      const endTime = new Date().getTime();
      logger.info(`✅ ${format.toUpperCase()} descargado del servidor`);
      logger.debug(`📦 Tamaño del archivo:`, blob.size, 'bytes');
      logger.debug('⏱️ Tiempo de descarga:', endTime - startTime, 'ms');
      logger.debug('🕐 Timestamp actual:', new Date().toISOString());

      if (Platform.OS === 'web') {
        // For web, create a download link using blob URL
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `hojas-reparto-${selectedCampaign.code}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        Alert.alert(
          'Éxito',
          `Las hojas de reparto de "${selectedCampaign.name}" en ${format.toUpperCase()} se están descargando`
        );
      } else {
        // For mobile (iOS/Android), save to file system and share
        // Use timestamp in filename to avoid caching issues
        const timestamp = new Date().getTime();
        const fileName = `hojas-reparto-${selectedCampaign.code}-${timestamp}.${extension}`;
        const file = new FileSystem.File(FileSystem.Paths.document, fileName);

        // Convert blob to array buffer using FileReader
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(blob);
        });

        // Write to file
        await file.create();
        const writer = file.writableStream().getWriter();
        await writer.write(new Uint8Array(arrayBuffer));
        await writer.close();

        // Share the file - user can choose to save to Downloads from share menu
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType,
            dialogTitle: `Hojas de Reparto - ${selectedCampaign.name}`,
            UTI: uti,
          });
        } else {
          Alert.alert('Éxito', `Archivo guardado en: ${file.uri}`);
        }
      }
    } catch (error: any) {
      logger.error('Error exporting distribution sheets:', error);
      Alert.alert('Error', error.message || 'No se pudieron exportar las hojas de reparto');
    } finally {
      setExportingCampaignId(null);
      setSelectedProductsForExport([]);
    }
  }, [selectedCampaign, selectedProductsForExport]);

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) {
      return 'N/A';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, []);

  const getStatusBadgeStyle = useCallback((status: CampaignStatus) => {
    return {
      backgroundColor: CampaignStatusColors[status] + '20',
      borderColor: CampaignStatusColors[status],
    };
  }, []);

  const getStatusTextStyle = useCallback((status: CampaignStatus) => {
    return {
      color: CampaignStatusColors[status],
    };
  }, []);

  const statuses: Array<CampaignStatus | 'ALL' | 'NOT_CANCELLED_DRAFT'> = useMemo(
    () => [
      'NOT_CANCELLED_DRAFT', // ✅ Por defecto
      'ALL',
      CampaignStatus.ACTIVE,
      CampaignStatus.DRAFT,
      CampaignStatus.COMPLETED,
      CampaignStatus.CLOSED,
      CampaignStatus.CANCELLED,
    ],
    []
  );

  const getStatusLabel = useCallback((status: CampaignStatus | 'ALL' | 'NOT_CANCELLED_DRAFT') => {
    if (status === 'ALL') return 'Todos';
    if (status === 'NOT_CANCELLED_DRAFT') return 'Activas'; // Todas menos canceladas y borrador
    return CampaignStatusLabels[status];
  }, []);

  const renderStatusFilter = useMemo(() => {
    return (
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {statuses.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                isTablet && styles.filterButtonTablet,
                selectedStatus === status && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  isTablet && styles.filterButtonTextTablet,
                  selectedStatus === status && styles.filterButtonTextActive,
                ]}
              >
                {getStatusLabel(status)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }, [statuses, isTablet, selectedStatus]);

  const renderCampaignCard = useCallback(
    (campaign: Campaign) => {
      const totalParticipantes = campaign.participants?.length || 0;
      const totalProductos = campaign.products?.length || 0;
      const isExporting = exportingCampaignId === campaign.id;

      // Obtener progreso de la campaña desde el estado
      const progress = campaignProgress.get(campaign.id) || {
        validated: 0,
        total: 0,
        percentage: 0,
      };

      const totalProductosValidacion = progress.total;
      const productosValidados = progress.validated;
      const validationProgress = progress.percentage;

      return (
        <View key={campaign.id} style={[styles.card, isTablet && styles.cardTablet]}>
          <TouchableOpacity onPress={() => handleCampaignPress(campaign)} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={[styles.cardCode, isTablet && styles.cardCodeTablet]}>
                  {campaign.code}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    isTablet && styles.statusBadgeTablet,
                    getStatusBadgeStyle(campaign.status),
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isTablet && styles.statusTextTablet,
                      getStatusTextStyle(campaign.status),
                    ]}
                  >
                    {CampaignStatusLabels[campaign.status]}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.cardBody}>
              <Text
                style={[styles.repartoName, isTablet && styles.repartoNameTablet]}
                numberOfLines={2}
              >
                {campaign.name}
              </Text>

              {campaign.description && (
                <Text
                  style={[styles.repartoDescription, isTablet && styles.repartoDescriptionTablet]}
                  numberOfLines={2}
                >
                  {campaign.description}
                </Text>
              )}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                    {totalParticipantes}
                  </Text>
                  <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                    Participantes
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                    {totalProductos}
                  </Text>
                  <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                    Productos
                  </Text>
                </View>

                {/* Circular Progress for Validation */}
                {totalProductosValidacion > 0 && (
                  <View style={styles.statItem}>
                    <CircularProgress
                      size={isTablet ? 80 : 70}
                      strokeWidth={isTablet ? 8 : 7}
                      progress={validationProgress}
                      total={totalProductosValidacion}
                      validated={productosValidados}
                      fontSize={isTablet ? 16 : 14}
                    />
                    <Text
                      style={[
                        styles.statLabel,
                        isTablet && styles.statLabelTablet,
                        { marginTop: 8 },
                      ]}
                    >
                      Validación
                    </Text>
                  </View>
                )}
              </View>

              {campaign.startDate && (
                <View style={styles.dateRow}>
                  <Text style={[styles.dateLabel, isTablet && styles.dateLabelTablet]}>
                    Fecha inicio:
                  </Text>
                  <Text style={[styles.dateValue, isTablet && styles.dateValueTablet]}>
                    {formatDate(campaign.startDate)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.cardFooter}>
              <Text style={[styles.footerText, isTablet && styles.footerTextTablet]}>
                Creado: {formatDate(campaign.createdAt)}
              </Text>
              <Text style={[styles.arrowIcon, isTablet && styles.arrowIconTablet]}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Export Button */}
          {totalParticipantes > 0 && totalProductos > 0 && (
            <TouchableOpacity
              style={[styles.exportButton, isTablet && styles.exportButtonTablet]}
              onPress={() => handleOpenProductSelection(campaign.id, campaign.name, campaign.code)}
              disabled={isExporting}
              activeOpacity={0.7}
            >
              <Text style={[styles.exportButtonText, isTablet && styles.exportButtonTextTablet]}>
                {isExporting ? '📄 Generando...' : '📄 Descargar Hojas de Reparto'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [isTablet, exportingCampaignId, campaignProgress, handleCampaignPress, handleOpenProductSelection, formatDate]
  );

  if (isLoading && !isRefetching) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando campañas...</Text>
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
            <Text style={[styles.title, isTablet && styles.titleTablet]}>Repartos</Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              Selecciona una campaña para ver sus repartos
            </Text>
          </View>
        </View>

        {/* Status Filter */}
        {renderStatusFilter}

        {/* Campaigns List - ✅ Migrado a FlatList para virtualización */}
        <FlatList
          data={campaigns}
          renderItem={({ item }) => renderCampaignCard(item)}
          keyExtractor={(item) => item.id}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay campañas disponibles
              </Text>
              <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                Las campañas con repartos aparecerán aquí
              </Text>
            </View>
          }
          ListFooterComponent={
            data && data.total > 0 ? (
              <View style={styles.paginationContainer}>
                <View style={styles.paginationInfo}>
                  <Text style={styles.paginationText}>
                    Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, data.total)} de {data.total} campañas
                  </Text>
                </View>
                <View style={styles.paginationButtons}>
                  <TouchableOpacity
                    style={[
                      styles.paginationButton,
                      currentPage === 1 && styles.paginationButtonDisabled
                    ]}
                    onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isLoading}
                  >
                    <Text style={[
                      styles.paginationButtonText,
                      currentPage === 1 && styles.paginationButtonTextDisabled
                    ]}>
                      ← Anterior
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.paginationPageText}>
                    Página {currentPage} de {Math.ceil(data.total / ITEMS_PER_PAGE)}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.paginationButton,
                      currentPage >= Math.ceil(data.total / ITEMS_PER_PAGE) && styles.paginationButtonDisabled
                    ]}
                    onPress={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage >= Math.ceil(data.total / ITEMS_PER_PAGE) || isLoading}
                  >
                    <Text style={[
                      styles.paginationButtonText,
                      currentPage >= Math.ceil(data.total / ITEMS_PER_PAGE) && styles.paginationButtonTextDisabled
                    ]}>
                      Siguiente →
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null
          }
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          initialNumToRender={10}
        />

        {/* Product Selection Modal */}
        <ProductSelectionModal
          visible={showProductSelectionModal}
          onClose={() => setShowProductSelectionModal(false)}
          onConfirm={handleExportDistributionSheets}
          products={allProducts}
          loading={exportingCampaignId !== null}
        />

        {/* Format Selection Modal - Distribution Sheets */}
        <Modal
          visible={distributionFormatModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setDistributionFormatModalVisible(false);
            setSelectedProductsForExport([]);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.formatModalContainer, isTablet && styles.formatModalContainerTablet]}>
              <Text style={[styles.formatModalTitle, isTablet && styles.formatModalTitleTablet]}>
                Seleccionar formato de descarga
              </Text>
              <Text style={[styles.formatModalSubtitle, isTablet && styles.formatModalSubtitleTablet]}>
                Hojas de Reparto - {selectedCampaign?.name}
              </Text>

              <View style={styles.formatButtonsContainer}>
                <TouchableOpacity
                  style={[styles.formatButton, styles.pdfButton]}
                  onPress={() => handleDownloadDistributionSheets('pdf')}
                  disabled={exportingCampaignId !== null}
                >
                  <Text style={styles.formatButtonIcon}>📄</Text>
                  <Text style={styles.formatButtonTitle}>PDF</Text>
                  <Text style={styles.formatButtonDescription}>
                    Hojas de reparto detalladas
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.formatButton, styles.excelButton]}
                  onPress={() => handleDownloadDistributionSheets('excel')}
                  disabled={exportingCampaignId !== null}
                >
                  <Text style={styles.formatButtonIcon}>📊</Text>
                  <Text style={styles.formatButtonTitle}>Excel</Text>
                  <Text style={styles.formatButtonDescription}>
                    Resumen en tabla
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.formatCancelButton}
                onPress={() => {
                  setDistributionFormatModalVisible(false);
                  setSelectedProductsForExport([]);
                }}
                disabled={exportingCampaignId !== null}
              >
                <Text style={styles.formatCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 32,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  subtitleTablet: {
    fontSize: 16,
  },
  filterWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  filterButtonTablet: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterButtonActive: {
    backgroundColor: '#6366F1',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  filterButtonTextTablet: {
    fontSize: 16,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentTablet: {
    padding: 32,
  },
  card: {
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
  cardTablet: {
    padding: 24,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  cardCodeTablet: {
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeTablet: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextTablet: {
    fontSize: 14,
  },
  cardBody: {
    marginBottom: 12,
  },
  repartoName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  repartoNameTablet: {
    fontSize: 22,
  },

  repartoDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 20,
  },
  repartoDescriptionTablet: {
    fontSize: 16,
    lineHeight: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6366F1',
    marginBottom: 4,
  },
  statValueTablet: {
    fontSize: 22,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  statLabelTablet: {
    fontSize: 14,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  dateLabelTablet: {
    fontSize: 15,
  },
  dateValue: {
    fontSize: 13,
    color: '#1E293B',
  },
  dateValueTablet: {
    fontSize: 15,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  footerTextTablet: {
    fontSize: 14,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#CBD5E1',
    fontWeight: 'bold',
  },
  arrowIconTablet: {
    fontSize: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  emptyTextTablet: {
    fontSize: 22,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
  },
  emptySubtextTablet: {
    fontSize: 16,
  },
  exportButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  exportButtonTablet: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  exportButtonTextTablet: {
    fontSize: 15,
  },
  // Format Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formatModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  formatModalContainerTablet: {
    padding: 32,
    maxWidth: 500,
  },
  formatModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  formatModalTitleTablet: {
    fontSize: 24,
  },
  formatModalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
    textAlign: 'center',
  },
  formatModalSubtitleTablet: {
    fontSize: 16,
  },
  formatButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formatButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  pdfButton: {
    borderColor: '#EF4444',
  },
  excelButton: {
    borderColor: '#10B981',
  },
  formatButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  formatButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  formatButtonDescription: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  formatCancelButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  formatCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  // ✅ Estilos de paginación
  paginationContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  paginationInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  paginationText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  paginationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  paginationButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  paginationButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  paginationButtonTextDisabled: {
    color: '#94A3B8',
  },
  paginationPageText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
});
