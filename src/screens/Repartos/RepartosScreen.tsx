/**
 * RepartosScreen - Rediseñado con Design System
 *
 * Pantalla de listado de repartos profesional y moderna.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { repartosService } from '@/services/api';
import {
  Campaign,
  CampaignStatus,
  CampaignStatusLabels,
} from '@/types/campaigns';
import { useCampaigns } from '@/hooks/api';
import { RepartoProducto } from '@/types/repartos';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProductSelectionModal, CircularProgress } from '@/components/Repartos';
import * as downloadTracker from '@/utils/downloadTracker';
import { logger } from '@/utils/logger';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  shadows,
} from '@/design-system/tokens';
import {
  Text,
  Title,
  Body,
  Caption,
  Button,
  Card,
  Badge,
  StatusBadge,
  Chip,
  ChipGroup,
  ScreenHeader,
  EmptyState,
  Pagination,
  Divider,
} from '@/design-system/components';

interface RepartosScreenProps {
  navigation: any;
}

// Status colors mapping
const STATUS_COLORS: Record<CampaignStatus, { background: string; text: string; border: string }> = {
  [CampaignStatus.ACTIVE]: colors.status.active,
  [CampaignStatus.DRAFT]: colors.status.draft,
  [CampaignStatus.PAUSED]: colors.status.pending,
  [CampaignStatus.COMPLETED]: colors.status.completed,
  [CampaignStatus.CLOSED]: colors.status.completed,
  [CampaignStatus.CANCELLED]: colors.status.cancelled,
};

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

  // Clean campaigns data
  const campaigns = useMemo(() => {
    if (!data?.data) return [];

    const allCampaigns = data.data.map((campaign: Campaign) => {
      if (campaign.products && campaign.products.length > 0) {
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

    if (selectedStatus === 'NOT_CANCELLED_DRAFT') {
      return allCampaigns.filter(
        (c) => c.status !== CampaignStatus.CANCELLED && c.status !== CampaignStatus.DRAFT
      );
    }
    return allCampaigns;
  }, [data, selectedStatus]);

  // Load campaign progress
  const loadCampaignProgress = useCallback(async (campaignIds: string[]) => {
    const progressMap = new Map<string, { validated: number; total: number; percentage: number }>();
    const BATCH_SIZE = 3;

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
            return {
              campaignId,
              progressData: { validated: 0, total: 0, percentage: 0 },
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

  const lastFetchRef = useRef<number>(0);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const STALE_TIME = 5 * 60 * 1000;

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
      const repartos = await repartosService.getRepartosByCampaign(campaignId);
      const productMap = new Map<string, RepartoProducto>();

      repartos.forEach((reparto) => {
        reparto.participantes?.forEach((participante: any) => {
          participante.productos?.forEach((producto: RepartoProducto) => {
            const productKey = producto.productId;
            if (productKey && !productMap.has(productKey)) {
              productMap.set(productKey, producto);
            }
          });
        });
      });

      const uniqueProducts = Array.from(productMap.values());

      if (uniqueProducts.length === 0) {
        Alert.alert('Sin productos', 'Esta campaña no tiene productos para exportar');
        return;
      }

      const downloadInfo = await downloadTracker.getCampaignDownloads(campaignId);

      const productsWithDownloadInfo = uniqueProducts.map((producto) => {
        const downloadRecord = downloadInfo.get(producto.productId);
        return {
          ...producto,
          downloadCount: downloadRecord?.downloadCount || 0,
          lastDownloadedAt: downloadRecord?.lastDownloadedAt,
        };
      });

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
    if (!selectedCampaign) return;
    setSelectedProductsForExport(selectedProductIds);
    setShowProductSelectionModal(false);
    setDistributionFormatModalVisible(true);
  }, [selectedCampaign]);

  const handleDownloadDistributionSheets = useCallback(async (format: 'pdf' | 'excel') => {
    if (!selectedCampaign) return;

    try {
      setExportingCampaignId(selectedCampaign.id);
      setDistributionFormatModalVisible(false);

      let blob: Blob;
      let extension: string;
      let mimeType: string;
      let uti: string;

      if (format === 'pdf') {
        blob = await repartosService.exportCampaignDistributionSheets(
          selectedCampaign.id,
          selectedProductsForExport
        );
        extension = 'pdf';
        mimeType = 'application/pdf';
        uti = 'com.adobe.pdf';
      } else {
        blob = await repartosService.exportDistributionSummaryExcel(
          selectedCampaign.id,
          selectedProductsForExport
        );
        extension = 'xlsx';
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        uti = 'org.openxmlformats.spreadsheetml.sheet';
      }

      try {
        await downloadTracker.registerDownloads(selectedCampaign.id, selectedProductsForExport);
      } catch (error) {
        logger.warn('⚠️ No se pudo registrar la descarga:', error);
      }

      if (Platform.OS === 'web') {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `hojas-reparto-${selectedCampaign.code}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        Alert.alert('Éxito', `Las hojas de reparto se están descargando`);
      } else {
        const timestamp = new Date().getTime();
        const fileName = `hojas-reparto-${selectedCampaign.code}-${timestamp}.${extension}`;
        const file = new FileSystem.File(FileSystem.Paths.document, fileName);

        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(blob);
        });

        await file.create();
        const writer = file.writableStream().getWriter();
        await writer.write(new Uint8Array(arrayBuffer));
        await writer.close();

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: `Hojas de Reparto - ${selectedCampaign.name}`, UTI: uti });
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
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, []);

  // Status filter options
  const statusOptions = useMemo(() => [
    { label: 'Activas', value: 'NOT_CANCELLED_DRAFT' },
    { label: 'Todos', value: 'ALL' },
    { label: CampaignStatusLabels[CampaignStatus.ACTIVE], value: CampaignStatus.ACTIVE },
    { label: CampaignStatusLabels[CampaignStatus.DRAFT], value: CampaignStatus.DRAFT },
    { label: CampaignStatusLabels[CampaignStatus.COMPLETED], value: CampaignStatus.COMPLETED },
    { label: CampaignStatusLabels[CampaignStatus.CLOSED], value: CampaignStatus.CLOSED },
    { label: CampaignStatusLabels[CampaignStatus.CANCELLED], value: CampaignStatus.CANCELLED },
  ], []);

  // Pagination data
  const paginationData = useMemo(() => {
    if (!data || !data.total) {
      return { page: 1, totalPages: 0, total: 0 };
    }
    return {
      page: currentPage,
      totalPages: Math.ceil(data.total / ITEMS_PER_PAGE),
      total: data.total,
    };
  }, [data, currentPage]);

  // Render campaign card
  const renderCampaignCard = useCallback(({ item: campaign }: { item: Campaign }) => {
    const totalParticipantes = campaign.participants?.length || 0;
    const totalProductos = campaign.products?.length || 0;
    const isExporting = exportingCampaignId === campaign.id;
    const progress = campaignProgress.get(campaign.id) || { validated: 0, total: 0, percentage: 0 };
    const statusColor = STATUS_COLORS[campaign.status] || colors.status.draft;

    return (
      <Card
        variant="elevated"
        padding="none"
        style={styles.campaignCard}
        onPress={() => handleCampaignPress(campaign)}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text variant="titleMedium" color="primary" style={styles.cardCode}>
              {campaign.code}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor.background, borderColor: statusColor.border }]}>
              <Text variant="labelSmall" style={{ color: statusColor.text }}>
                {CampaignStatusLabels[campaign.status]}
              </Text>
            </View>
          </View>
        </View>

        {/* Body */}
        <View style={styles.cardBody}>
          <Title size="medium" numberOfLines={2} style={styles.campaignName}>
            {campaign.name}
          </Title>

          {campaign.description && (
            <Body size="small" color="secondary" numberOfLines={2} style={styles.campaignDescription}>
              {campaign.description}
            </Body>
          )}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text variant="numericMedium" color={colors.accent[600]}>
                {totalParticipantes}
              </Text>
              <Caption color="tertiary">Participantes</Caption>
            </View>

            <View style={styles.statItem}>
              <Text variant="numericMedium" color={colors.accent[600]}>
                {totalProductos}
              </Text>
              <Caption color="tertiary">Productos</Caption>
            </View>

            {progress.total > 0 && (
              <View style={styles.statItem}>
                <CircularProgress
                  size={isTablet ? 70 : 60}
                  strokeWidth={isTablet ? 7 : 6}
                  progress={progress.percentage}
                  total={progress.total}
                  validated={progress.validated}
                  fontSize={isTablet ? 14 : 12}
                />
                <Caption color="tertiary" style={{ marginTop: spacing[2] }}>Validación</Caption>
              </View>
            )}
          </View>

          {campaign.startDate && (
            <View style={styles.dateRow}>
              <Caption color="tertiary">Fecha inicio:</Caption>
              <Text variant="labelMedium" color="primary" style={{ marginLeft: spacing[2] }}>
                {formatDate(campaign.startDate)}
              </Text>
            </View>
          )}
        </View>

        <Divider spacing="none" />

        {/* Footer */}
        <View style={styles.cardFooter}>
          <Caption color="tertiary">Creado: {formatDate(campaign.createdAt)}</Caption>
          <Text variant="titleLarge" color={colors.neutral[300]}>›</Text>
        </View>

        {/* Export Button */}
        {totalParticipantes > 0 && totalProductos > 0 && (
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => handleOpenProductSelection(campaign.id, campaign.name, campaign.code)}
            disabled={isExporting}
            activeOpacity={0.7}
          >
            <Text variant="buttonSmall" color={colors.text.inverse}>
              {isExporting ? '📄 Generando...' : '📄 Descargar Hojas de Reparto'}
            </Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  }, [isTablet, exportingCampaignId, campaignProgress, handleCampaignPress, handleOpenProductSelection, formatDate]);

  // Loading state
  if (isLoading && !isRefetching) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Repartos" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[900]} />
          <Text variant="bodyMedium" color="secondary" style={styles.loadingText}>
            Cargando campañas...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <View style={styles.container}>
        {/* Header */}
        <ScreenHeader
          title="Repartos"
          subtitle="Selecciona una campaña para ver sus repartos"
        />

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ChipGroup
            options={statusOptions}
            selected={[selectedStatus]}
            onChange={(selected) => setSelectedStatus((selected[0] || 'NOT_CANCELLED_DRAFT') as any)}
            size="small"
          />
        </View>

        {/* Campaigns List */}
        <FlatList
          data={campaigns}
          renderItem={renderCampaignCard}
          keyExtractor={(item) => item.id}
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary[900]}
              colors={[colors.primary[900]]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No hay campañas disponibles"
              description="Las campañas con repartos aparecerán aquí"
            />
          }
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          initialNumToRender={10}
        />

        {/* Pagination */}
        {paginationData.total > 0 && (
          <Pagination
            currentPage={paginationData.page}
            totalPages={paginationData.totalPages}
            totalItems={paginationData.total}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            loading={isLoading}
          />
        )}

        {/* Product Selection Modal */}
        <ProductSelectionModal
          visible={showProductSelectionModal}
          onClose={() => setShowProductSelectionModal(false)}
          onConfirm={handleExportDistributionSheets}
          products={allProducts}
          loading={exportingCampaignId !== null}
        />

        {/* Format Selection Modal */}
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
            <Card variant="elevated" padding="large" style={styles.formatModalContainer}>
              <Title size="medium" align="center" style={styles.formatModalTitle}>
                Seleccionar formato de descarga
              </Title>
              <Body size="small" color="secondary" align="center" style={styles.formatModalSubtitle}>
                Hojas de Reparto - {selectedCampaign?.name}
              </Body>

              <View style={styles.formatButtonsContainer}>
                <TouchableOpacity
                  style={[styles.formatButton, styles.pdfButton]}
                  onPress={() => handleDownloadDistributionSheets('pdf')}
                  disabled={exportingCampaignId !== null}
                >
                  <Text style={styles.formatButtonIcon}>📄</Text>
                  <Text variant="titleSmall" color="primary">PDF</Text>
                  <Caption color="secondary" align="center">Hojas detalladas</Caption>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.formatButton, styles.excelButton]}
                  onPress={() => handleDownloadDistributionSheets('excel')}
                  disabled={exportingCampaignId !== null}
                >
                  <Text style={styles.formatButtonIcon}>📊</Text>
                  <Text variant="titleSmall" color="primary">Excel</Text>
                  <Caption color="secondary" align="center">Resumen en tabla</Caption>
                </TouchableOpacity>
              </View>

              <Button
                title="Cancelar"
                onPress={() => {
                  setDistributionFormatModalVisible(false);
                  setSelectedProductsForExport([]);
                }}
                variant="ghost"
                fullWidth
                disabled={exportingCampaignId !== null}
              />
            </Card>
          </View>
        </Modal>
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },

  loadingText: {
    marginTop: spacing[4],
  },

  filtersContainer: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  listContainer: {
    flex: 1,
  },

  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[20],
  },

  // Campaign Card
  campaignCard: {
    marginBottom: spacing[3],
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    paddingBottom: spacing[2],
  },

  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },

  cardCode: {
    fontWeight: '700',
  },

  statusBadge: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },

  cardBody: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },

  campaignName: {
    marginBottom: spacing[1],
  },

  campaignDescription: {
    marginBottom: spacing[3],
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing[3],
  },

  statItem: {
    alignItems: 'center',
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },

  exportButton: {
    backgroundColor: colors.primary[900],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },

  // Format Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },

  formatModalContainer: {
    width: '100%',
    maxWidth: 400,
  },

  formatModalTitle: {
    marginBottom: spacing[2],
  },

  formatModalSubtitle: {
    marginBottom: spacing[6],
  },

  formatButtonsContainer: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },

  formatButton: {
    flex: 1,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border.light,
  },

  pdfButton: {
    borderColor: colors.danger[400],
  },

  excelButton: {
    borderColor: colors.success[400],
  },

  formatButtonIcon: {
    fontSize: 32,
    marginBottom: spacing[2],
  },
});

export default RepartosScreen;
