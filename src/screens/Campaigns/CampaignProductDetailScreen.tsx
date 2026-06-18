import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Modal,
  TextInput,
} from 'react-native';
import Alert from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { campaignsService, inventoryApi } from '@/services/api';
import logger from '@/utils/logger';
import {
  CampaignProduct,
  DistributionPreviewResponse,
  DistributionTypeLabels,
  DistributionTypeDescriptions,
  ProductStatusLabels,
  ProductStatusColors,
  ProductStatus,
  ProductSourceType,
  DistributionType,
  SetCustomDistributionRequest,
  StockDetailByWarehouse,
} from '@/types/campaigns';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { DistributionFormModal } from '@/components/Campaigns/DistributionFormModal';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface CampaignProductDetailScreenProps {
  navigation: any;
  route: {
    params: {
      campaignId: string;
      productId: string;
      fromCampaignDetail?: boolean;
      openDistributionModal?: boolean;
    };
  };
}

export const CampaignProductDetailScreen: React.FC<CampaignProductDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { campaignId, productId, fromCampaignDetail, openDistributionModal } = route.params;
  const [product, setProduct] = useState<CampaignProduct | null>(null);
  const [preview, setPreview] = useState<DistributionPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  // Local stock data fetched from inventory API
  const [localStockData, setLocalStockData] = useState<StockDetailByWarehouse[] | undefined>(
    undefined
  );

  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;

  const loadProduct = useCallback(async () => {
    try {
      // Optimized: Load only the specific product instead of all campaign products
      const foundProduct = await campaignsService.getProduct(campaignId, productId);
      logger.debug('ðŸ“¦ Producto cargado:', {
        id: foundProduct.id,
        productId: foundProduct.productId,
        hasProduct: !!foundProduct.product,
        hasPresentations: !!foundProduct.product?.presentations,
        presentationsCount: foundProduct.product?.presentations?.length || 0,
        presentations: foundProduct.product?.presentations,
        hasStockItems: !!foundProduct.product?.stockItems,
        stockItemsCount: foundProduct.product?.stockItems?.length || 0,
        stockItems: foundProduct.product?.stockItems,
      });
      setProduct(foundProduct);
    } catch (error: any) {
      logger.error('Error loading product:', error);
      Alert.alert('Error', 'No se pudo cargar el producto');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId, productId, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadProduct();
    }, [loadProduct])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadProduct();
  }, [loadProduct]);

  const handleShowPreview = useCallback(async () => {
    if (!product) {
      return;
    }

    setActionLoading(true);
    try {
      const previewData = await campaignsService.getDistributionPreview(campaignId, productId);
      setPreview(previewData);
      setShowPreviewModal(true);
    } catch (error: any) {
      logger.error('Error loading preview:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo cargar la vista previa');
    } finally {
      setActionLoading(false);
    }
  }, [campaignId, productId]);

  const handleGenerateDistribution = useCallback(async () => {
    if (!product) {
      return;
    }

    // Check if the PRODUCT itself is preliminary (not the campaign product status)
    const isProductPreliminary = (product.product?.status as any) === 'preliminary';

    if (isProductPreliminary) {
      Alert.alert(
        'Producto Preliminar',
        'No se puede generar reparto para productos preliminares. El producto debe estar validado primero.'
      );
      return;
    }

    // Also check campaign product status (should be ACTIVE)
    if (product.productStatus !== 'ACTIVE') {
      Alert.alert(
        'Error',
        'Solo se pueden generar repartos de productos en estado ACTIVO en la campaÃ±a'
      );
      return;
    }

    // Cargar stock directamente desde el API de inventario
    logger.debug('ðŸ“¦ [STOCK] Consultando stock directamente del API de inventario...');
    try {
      const stockResponse: any = await inventoryApi.getAllStock({ productId: product.productId });
      logger.debug('âœ… [STOCK] Stock obtenido del API:', {
        stockResponse: stockResponse,
      });

      // El API puede devolver un array o un objeto paginado { data: [...], total, page, limit }
      const stockData = Array.isArray(stockResponse) ? stockResponse : stockResponse?.data || [];

      // Guardar en estado local sin actualizar el producto (evita recargar la campaÃ±a)
      if (stockData && stockData.length > 0) {
        const stockDetails: StockDetailByWarehouse[] = stockData.map((item: any) => ({
          warehouse: item.warehouse?.name || 'AlmacÃ©n desconocido',
          total: item.quantityBase || 0,
          reserved: item.reservedQuantityBase || 0,
          available: item.availableQuantityBase || item.quantityBase || 0,
        }));

        setLocalStockData(stockDetails);
        logger.debug('âœ… [STOCK] Stock guardado en estado local:', stockDetails);
      }
    } catch (error: any) {
      logger.error('âŒ [STOCK] Error obteniendo stock del API:', error);
      // Continuar sin stock si hay error
    }

    // Abrir el modal de distribuciÃ³n
    setShowAdjustModal(true);
  }, [product]);

  // Auto-open distribution modal if flag is set
  React.useEffect(() => {
    if (openDistributionModal && product && !loading && !showAdjustModal) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        handleGenerateDistribution();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [openDistributionModal, product, loading, showAdjustModal, handleGenerateDistribution]);

  // Handler for successful distribution generation
  const handleDistributionSuccess = useCallback(() => {
    // Si venimos de CampaignDetail, navegar de vuelta con updatedProductId
    // Esto actualiza SOLO este producto sin recargar toda la campaÃ±a
    if (fromCampaignDetail) {
      navigation.navigate('CampaignDetail', {
        campaignId,
        updatedProductId: productId,
      });
    } else {
      loadProduct();
    }
  }, [fromCampaignDetail, navigation, campaignId, productId, loadProduct]);

  const handleManageCustomDistribution = useCallback(() => {
    navigation.navigate('ManageCustomDistribution', {
      campaignId,
      productId,
    });
  }, [navigation, campaignId, productId]);

  const handleChangeToActive = useCallback(async () => {
    if (!product) {
      return;
    }

    Alert.alert(
      'Cambiar a Activo',
      'Â¿EstÃ¡s seguro de cambiar este producto a estado ACTIVO? Esto permitirÃ¡ generar el reparto.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cambiar',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await campaignsService.updateProduct(campaignId, productId, {
                productStatus: ProductStatus.ACTIVE,
              });

              Alert.alert('Ã‰xito', 'El producto ahora estÃ¡ en estado ACTIVO', [
                {
                  text: 'OK',
                  onPress: () => loadProduct(),
                },
              ]);
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo actualizar el producto'
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }, [product, campaignId, productId, loadProduct]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.primary} />
          <Text style={styles.loadingText}>Cargando producto...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity
            onPress={() => {
              if (fromCampaignDetail) {
                // Navigate back with skipReloadOnce flag to prevent reload
                navigation.navigate('CampaignDetail', {
                  campaignId,
                  skipReloadOnce: true,
                });
              } else {
                navigation.goBack();
              }
            }}
            style={styles.backButton}
          >
            <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
              â† Volver
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>Detalle del Producto</Text>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {/* Product Info */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              InformaciÃ³n del Producto
            </Text>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Producto:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {product.product?.title || 'N/A'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>SKU:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {product.product?.correlativeNumber && `#${product.product.correlativeNumber} | `}
                {product.product?.sku || 'N/A'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Cantidad Total:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {product.totalQuantityBase}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Estado:</Text>
              <View style={styles.statusContainer}>
                <View
                  style={[
                    styles.statusBadge,
                    isTablet && styles.statusBadgeTablet,
                    {
                      backgroundColor: ProductStatusColors[product.productStatus] + '20',
                      borderColor: ProductStatusColors[product.productStatus],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isTablet && styles.statusTextTablet,
                      { color: ProductStatusColors[product.productStatus] },
                    ]}
                  >
                    {ProductStatusLabels[product.productStatus]}
                  </Text>
                </View>
                {product.productStatus === 'PRELIMINARY' && !product.distributionGenerated && (
                  <TouchableOpacity
                    style={[styles.changeStatusButton, isTablet && styles.changeStatusButtonTablet]}
                    onPress={handleChangeToActive}
                    disabled={actionLoading}
                  >
                    <Text
                      style={[
                        styles.changeStatusButtonText,
                        isTablet && styles.changeStatusButtonTextTablet,
                      ]}
                    >
                      Cambiar a Activo
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Tipo de DistribuciÃ³n:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {DistributionTypeLabels[product.distributionType]}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Reparto Generado:
              </Text>
              <Text
                style={[
                  styles.infoValue,
                  isTablet && styles.infoValueTablet,
                  product.distributionGenerated ? styles.generatedYes : styles.generatedNo,
                ]}
              >
                {product.distributionGenerated ? 'SÃ­' : 'No'}
              </Text>
            </View>

            {/* @ts-ignore */}
            {product.purchase && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Compra:</Text>
                <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                  {product.purchase.code}
                </Text>
              </View>
            )}
          </View>

          {/* Custom Distributions */}
          {product.distributionType === 'CUSTOM' && (
            <View style={[styles.section, isTablet && styles.sectionTablet]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                  Distribuciones Personalizadas
                </Text>
                <TouchableOpacity
                  style={[styles.manageButton, isTablet && styles.manageButtonTablet]}
                  onPress={handleManageCustomDistribution}
                >
                  <Text
                    style={[styles.manageButtonText, isTablet && styles.manageButtonTextTablet]}
                  >
                    Gestionar
                  </Text>
                </TouchableOpacity>
              </View>

              {!product.customDistributions || product.customDistributions.length === 0 ? (
                <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                  No hay distribuciones personalizadas configuradas
                </Text>
              ) : (
                product.customDistributions.map((dist) => (
                  <View key={dist.id} style={styles.distributionItem}>
                    <Text style={styles.distributionName}>{dist.name || 'Sin nombre'}</Text>
                    <Text style={styles.distributionItems}>
                      {dist.items?.length || 0} participantes
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Actions Info */}
          <View style={[styles.infoBox, isTablet && styles.infoBoxTablet]}>
            <Text style={[styles.infoTitle, isTablet && styles.infoTitleTablet]}>
              â„¹ï¸ Acciones Disponibles
            </Text>
            <Text style={[styles.infoText, isTablet && styles.infoTextTablet]}>
              â€¢ Vista Previa: Ver cÃ³mo se distribuirÃ¡ el producto{'\n'}â€¢ Generar Reparto:
              Crear los registros de distribuciÃ³n{'\n'}â€¢ Solo productos ACTIVOS pueden generar
              reparto{'\n'}â€¢ El reparto se genera una sola vez por producto
            </Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.footer, isTablet && styles.footerTablet]}>
          <TouchableOpacity
            style={[styles.previewButton, isTablet && styles.previewButtonTablet]}
            onPress={handleShowPreview}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color={theme.color.brand.primary} />
            ) : (
              <Text style={[styles.previewButtonText, isTablet && styles.previewButtonTextTablet]}>
                Vista Previa
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.generateButton,
              isTablet && styles.generateButtonTablet,
              (product.distributionGenerated ||
                product.productStatus !== 'ACTIVE' ||
                (product.product?.status as any) === 'preliminary') &&
                styles.generateButtonDisabled,
            ]}
            onPress={handleGenerateDistribution}
            disabled={
              actionLoading ||
              product.distributionGenerated ||
              product.productStatus !== 'ACTIVE' ||
              (product.product?.status as any) === 'preliminary'
            }
          >
            <Text style={[styles.generateButtonText, isTablet && styles.generateButtonTextTablet]}>
              {product.distributionGenerated
                ? 'Ya Generado'
                : (product.product?.status as any) === 'preliminary'
                  ? 'Producto Preliminar'
                  : 'Generar Reparto'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Preview Modal */}
        <Modal
          visible={showPreviewModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPreviewModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isTablet && styles.modalTitleTablet]}>
                  Vista Previa de DistribuciÃ³n
                </Text>
                <TouchableOpacity onPress={() => setShowPreviewModal(false)}>
                  <Text style={styles.modalClose}>âœ•</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {preview && (
                  <>
                    {/* InformaciÃ³n del Producto */}
                    <View style={styles.previewHeader}>
                      <Text style={styles.previewProductName}>{preview.productName}</Text>
                      <Text style={styles.previewProductStatus}>
                        Estado: {preview.isPreliminary ? 'âš ï¸ Preliminar' : 'âœ“ Activo'}
                      </Text>
                    </View>

                    {/* Tipo de DistribuciÃ³n */}
                    <View style={styles.previewSection}>
                      <Text style={styles.previewSectionTitle}>Tipo de Reparto</Text>
                      <Text style={styles.previewType}>
                        {DistributionTypeLabels[preview.distributionType]}
                      </Text>
                      {preview.distributionDescription && (
                        <Text style={styles.previewDescription}>
                          {preview.distributionDescription}
                        </Text>
                      )}
                    </View>

                    {/* Resumen de DistribuciÃ³n */}
                    <View style={styles.previewSection}>
                      <Text style={styles.previewSectionTitle}>Resumen</Text>
                      <View style={styles.previewSummaryRow}>
                        <Text style={styles.previewSummaryLabel}>Total de participantes:</Text>
                        <Text style={styles.previewSummaryValue}>{preview.totalParticipants}</Text>
                      </View>
                      <View style={styles.previewSummaryRow}>
                        <Text style={styles.previewSummaryLabel}>Monto total asignado:</Text>
                        <Text style={styles.previewSummaryValue}>
                          {preview.currency} {preview.totalAssignedAmount?.toFixed(2) || '0.00'}
                        </Text>
                      </View>
                      <View style={styles.previewSummaryRow}>
                        <Text style={styles.previewSummaryLabel}>Cantidad total:</Text>
                        <Text style={styles.previewSummaryValue}>
                          {preview.totalQuantity} unidades
                        </Text>
                      </View>
                      <View style={styles.previewSummaryRow}>
                        <Text style={styles.previewSummaryLabel}>Total distribuido:</Text>
                        <Text style={styles.previewSummaryValue}>
                          {preview.totalDistributed} unidades
                        </Text>
                      </View>
                      {preview.remainder > 0 && (
                        <View style={styles.previewSummaryRow}>
                          <Text style={styles.previewSummaryLabel}>Remanente (por redondeo):</Text>
                          <Text style={[styles.previewSummaryValue, styles.previewRemainder]}>
                            {preview.remainder} unidades
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Detalle por Participante */}
                    <View style={styles.previewSection}>
                      <Text style={styles.previewSectionTitle}>DistribuciÃ³n por Participante</Text>
                      {preview.preview.map((item, index) => (
                        <View key={index} style={styles.previewItem}>
                          <View style={styles.previewItemHeader}>
                            <Text style={styles.previewParticipantName}>
                              {item.participantName}
                            </Text>
                            <Text style={styles.previewParticipantType}>
                              {item.participantType === 'EXTERNAL_COMPANY'
                                ? 'ðŸ¢ Empresa'
                                : 'ðŸ›ï¸ Sede'}
                            </Text>
                          </View>
                          <View style={styles.previewItemDetails}>
                            <View style={styles.previewDetailRow}>
                              <Text style={styles.previewDetailLabel}>Monto asignado:</Text>
                              <Text style={styles.previewAmount}>
                                {preview.currency} {(item.assignedAmount || 0).toFixed(2)}
                              </Text>
                            </View>
                            <View style={styles.previewDetailRow}>
                              <Text style={styles.previewDetailLabel}>Porcentaje:</Text>
                              <Text style={styles.previewPercentage}>
                                {(item.percentage || 0).toFixed(2)}%
                              </Text>
                            </View>
                            <View style={styles.previewDetailRow}>
                              <Text style={styles.previewDetailLabel}>Cantidad calculada:</Text>
                              <Text style={styles.previewCalculated}>
                                {item.calculatedQuantity} unidades
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </ScrollView>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowPreviewModal(false)}
              >
                <Text style={styles.modalCloseButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Distribution Form Modal */}
        <DistributionFormModal
          visible={showAdjustModal}
          campaignId={campaignId}
          product={product}
          localStockData={localStockData}
          onClose={() => setShowAdjustModal(false)}
          onSuccess={handleDistributionSuccess}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.color.text.subtle,
    },
    header: {
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerTablet: {
      paddingHorizontal: 32,
      paddingVertical: 24,
    },
    backButton: {
      marginBottom: 8,
    },
    backButtonText: {
      fontSize: 16,
      color: theme.color.brand.primary,
      fontWeight: '600',
    },
    backButtonTextTablet: {
      fontSize: 18,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    titleTablet: {
      fontSize: 32,
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
    section: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTablet: {
      padding: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 16,
    },
    sectionTitleTablet: {
      fontSize: 22,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    infoLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.color.text.subtle,
      minWidth: 150,
    },
    infoLabelTablet: {
      fontSize: 16,
      minWidth: 180,
    },
    infoValue: {
      fontSize: 14,
      color: theme.color.text.heading,
      flex: 1,
    },
    infoValueTablet: {
      fontSize: 16,
    },
    statusContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
    changeStatusButton: {
      backgroundColor: theme.color.action.success.background,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    changeStatusButtonTablet: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    changeStatusButtonText: {
      color: theme.color.surface.base,
      fontSize: 12,
      fontWeight: '600',
    },
    changeStatusButtonTextTablet: {
      fontSize: 14,
    },
    generatedYes: {
      color: theme.color.action.success.background,
      fontWeight: '600',
    },
    generatedNo: {
      color: theme.color.border.error,
      fontWeight: '600',
    },
    manageButton: {
      backgroundColor: theme.color.brand.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    manageButtonTablet: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    manageButtonText: {
      color: theme.color.surface.base,
      fontSize: 12,
      fontWeight: '600',
    },
    manageButtonTextTablet: {
      fontSize: 14,
    },
    emptyText: {
      fontSize: 14,
      color: theme.color.text.disabled,
      textAlign: 'center',
      paddingVertical: 20,
    },
    emptyTextTablet: {
      fontSize: 16,
    },
    distributionItem: {
      padding: 12,
      backgroundColor: theme.color.background.subtle,
      borderRadius: 8,
      marginBottom: 8,
    },
    distributionName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 4,
    },
    distributionItems: {
      fontSize: 12,
      color: theme.color.text.subtle,
    },
    infoBox: {
      backgroundColor: theme.color.state.info.background,
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 4,
      borderLeftColor: theme.color.state.info.border,
    },
    infoBoxTablet: {
      padding: 16,
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.state.info.text,
      marginBottom: 8,
    },
    infoTitleTablet: {
      fontSize: 16,
    },
    infoText: {
      fontSize: 13,
      color: theme.color.state.info.text,
      lineHeight: 20,
    },
    infoTextTablet: {
      fontSize: 15,
      lineHeight: 24,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      backgroundColor: theme.color.surface.base,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    footerTablet: {
      padding: 24,
      gap: 16,
    },
    previewButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.color.brand.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewButtonTablet: {
      paddingVertical: 16,
    },
    previewButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.brand.primary,
    },
    previewButtonTextTablet: {
      fontSize: 18,
    },
    generateButton: {
      flex: 1,
      backgroundColor: theme.color.action.success.background,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    generateButtonTablet: {
      paddingVertical: 16,
    },
    generateButtonDisabled: {
      backgroundColor: theme.color.text.disabled,
    },
    generateButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.surface.base,
    },
    generateButtonTextTablet: {
      fontSize: 18,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      width: '100%',
      maxHeight: '80%',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalContentTablet: {
      width: '80%',
      maxWidth: 600,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    modalTitleTablet: {
      fontSize: 22,
    },
    modalClose: {
      fontSize: 24,
      color: theme.color.text.subtle,
      fontWeight: 'bold',
    },
    modalBody: {
      padding: 16,
    },
    previewHeader: {
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    previewProductName: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 8,
    },
    previewProductStatus: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginBottom: 4,
    },
    previewSection: {
      marginBottom: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    previewSectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 12,
    },
    previewType: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.brand.primary,
      marginBottom: 8,
    },
    previewDescription: {
      fontSize: 13,
      color: theme.color.text.subtle,
      fontStyle: 'italic',
      lineHeight: 18,
    },
    previewSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    previewSummaryLabel: {
      fontSize: 14,
      color: theme.color.text.subtle,
      flex: 1,
    },
    previewSummaryValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    previewRemainder: {
      color: theme.color.icon.warning,
    },
    previewQuantity: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginBottom: 4,
    },
    previewItem: {
      padding: 12,
      backgroundColor: theme.color.background.subtle,
      borderRadius: 8,
      marginBottom: 8,
    },
    previewItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    previewParticipantName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    previewParticipantType: {
      fontSize: 12,
      color: theme.color.text.subtle,
    },
    previewItemDetails: {
      marginTop: 8,
    },
    previewDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    previewDetailLabel: {
      fontSize: 13,
      color: theme.color.text.subtle,
      flex: 1,
    },
    // Adjust Modal Styles
    warningBox: {
      backgroundColor: theme.color.state.warning.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: theme.color.icon.warning,
    },
    warningTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.state.warning.text,
      marginBottom: 6,
    },
    warningText: {
      fontSize: 13,
      color: theme.color.state.warning.text,
      lineHeight: 18,
    },
    adjustHint: {
      fontSize: 13,
      color: theme.color.brand.primary,
      fontStyle: 'italic',
      marginBottom: 12,
      lineHeight: 18,
    },
    infoBoxModal: {
      backgroundColor: theme.color.state.info.background,
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.color.state.info.border,
    },
    infoBoxTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.brand.primary,
      marginBottom: 8,
    },
    infoBoxText: {
      fontSize: 13,
      color: theme.color.brand.primary,
      lineHeight: 18,
    },
    adjustItem: {
      padding: 14,
      backgroundColor: theme.color.surface.base,
      borderRadius: 8,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    adjustItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.surface.muted,
    },
    adjustParticipantName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    adjustParticipantType: {
      fontSize: 12,
      color: theme.color.text.subtle,
      fontWeight: '500',
    },
    adjustItemDetails: {
      marginTop: 4,
    },
    adjustDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    adjustDetailLabel: {
      fontSize: 13,
      color: theme.color.text.subtle,
      flex: 1,
    },
    adjustAmount: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.brand.primary,
    },
    adjustPercentage: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.brand.primary,
    },
    adjustQuantity: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.action.success.background,
    },
    modalFooter: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      backgroundColor: theme.color.background.subtle,
    },
    modalCancelButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.color.text.disabled,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.surface.base,
    },
    modalCancelButtonTablet: {
      paddingVertical: 14,
    },
    modalCancelButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.subtle,
    },
    modalCancelButtonTextTablet: {
      fontSize: 17,
    },
    modalConfirmButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.action.success.background,
      shadowColor: theme.color.action.success.background,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    modalConfirmButtonTablet: {
      paddingVertical: 14,
    },
    modalConfirmButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.surface.base,
    },
    modalConfirmButtonTextTablet: {
      fontSize: 17,
    },
    // Distribution Type Selector Styles
    distributionTypeHint: {
      fontSize: 13,
      color: theme.color.text.subtle,
      marginBottom: 12,
      lineHeight: 18,
    },
    // Presentation Styles
    presentationToggleContainer: {
      gap: 10,
      marginBottom: 16,
    },
    presentationToggleOption: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    presentationToggleOptionSelected: {
      borderColor: theme.color.action.success.background,
      backgroundColor: theme.color.state.success.background,
    },
    presentationToggleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    presentationToggleRadio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      marginRight: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    presentationToggleRadioSelected: {
      borderColor: theme.color.action.success.background,
    },
    presentationToggleRadioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.color.action.success.background,
    },
    presentationToggleLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    presentationToggleLabelSelected: {
      color: theme.color.action.success.background,
    },
    presentationToggleDescription: {
      fontSize: 12,
      color: theme.color.text.subtle,
      lineHeight: 16,
      marginLeft: 30,
    },
    presentationSelectorContainer: {
      marginTop: 12,
    },
    presentationSelectorLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: 10,
    },
    presentationOptions: {
      gap: 8,
    },
    presentationOption: {
      padding: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    presentationOptionSelected: {
      borderColor: theme.color.action.success.background,
      backgroundColor: theme.color.state.success.background,
    },
    presentationOptionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    presentationOptionRadio: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      marginRight: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    presentationOptionRadioSelected: {
      borderColor: theme.color.action.success.background,
    },
    presentationOptionRadioInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.color.action.success.background,
    },
    presentationOptionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    presentationOptionLabelSelected: {
      color: theme.color.action.success.background,
    },
    presentationOptionFactor: {
      fontSize: 11,
      color: theme.color.text.subtle,
      marginLeft: 24,
    },
    previewSummarySecondary: {
      fontSize: 12,
      color: theme.color.text.subtle,
      fontWeight: '400',
    },
    adjustQuantitySecondary: {
      fontSize: 12,
      color: theme.color.text.subtle,
      fontWeight: '400',
    },
    distributionTypeContainer: {
      gap: 10,
    },
    distributionTypeOption: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    distributionTypeOptionSelected: {
      borderColor: theme.color.brand.primary,
      backgroundColor: theme.color.state.info.background,
    },
    distributionTypeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    distributionTypeRadio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      marginRight: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    distributionTypeRadioSelected: {
      borderColor: theme.color.brand.primary,
    },
    distributionTypeRadioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.color.brand.primary,
    },
    distributionTypeLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    distributionTypeLabelSelected: {
      color: theme.color.brand.primary,
    },
    distributionTypeDescription: {
      fontSize: 12,
      color: theme.color.text.subtle,
      lineHeight: 16,
      marginLeft: 30,
    },
    previewLoadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      gap: 8,
    },
    previewLoadingText: {
      fontSize: 13,
      color: theme.color.brand.primary,
    },
    // Custom Distribution Styles
    customTotalContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      backgroundColor: theme.color.surface.muted,
      borderRadius: 8,
      marginBottom: 12,
    },
    customTotalLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    customTotalValue: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.action.success.background,
    },
    customTotalError: {
      color: theme.color.border.error,
    },
    customItem: {
      padding: 12,
      backgroundColor: theme.color.surface.base,
      borderRadius: 8,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    customItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    customParticipantName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    customParticipantType: {
      fontSize: 12,
      color: theme.color.text.subtle,
    },
    customInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    customInputLabel: {
      fontSize: 13,
      color: theme.color.text.subtle,
      minWidth: 70,
    },
    customInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: theme.color.text.heading,
      backgroundColor: theme.color.surface.base,
    },
    customInputUnit: {
      fontSize: 13,
      color: theme.color.text.subtle,
    },
    // Remainder Info Styles
    remainderInfoBox: {
      backgroundColor: theme.color.state.success.background,
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
      borderLeftWidth: 4,
      borderLeftColor: theme.color.action.success.background,
    },
    remainderInfoTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.state.success.text,
      marginBottom: 6,
    },
    remainderInfoText: {
      fontSize: 12,
      color: theme.color.state.success.text,
      lineHeight: 16,
    },
    remainderSiteName: {
      fontWeight: '700',
      color: theme.color.state.success.text,
    },
    remainderWarningBox: {
      backgroundColor: theme.color.state.warning.background,
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
      borderLeftWidth: 4,
      borderLeftColor: theme.color.icon.warning,
    },
    remainderWarningTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.state.warning.text,
      marginBottom: 6,
    },
    remainderWarningText: {
      fontSize: 12,
      color: theme.color.state.warning.text,
      lineHeight: 16,
    },
    remainderAssignedBox: {
      backgroundColor: theme.color.state.info.background,
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
      borderLeftWidth: 4,
      borderLeftColor: theme.color.state.info.border,
    },
    remainderAssignedTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.state.info.text,
      marginBottom: 6,
    },
    remainderAssignedText: {
      fontSize: 12,
      color: theme.color.state.info.text,
      lineHeight: 16,
    },
    remainderParticipantName: {
      fontWeight: '700',
      color: theme.color.state.info.text,
    },
    previewAmount: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    previewPercentage: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.brand.primary,
    },
    previewCalculated: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.action.success.background,
    },
    modalCloseButton: {
      margin: 16,
      padding: 12,
      backgroundColor: theme.color.brand.primary,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalCloseButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.surface.base,
    },
    // Stock Info Styles
    stockInfoSection: {
      backgroundColor: theme.color.state.info.background,
      borderRadius: 8,
      padding: 16,
      marginBottom: 20,
      borderLeftWidth: 4,
      borderLeftColor: theme.color.state.info.border,
    },
    stockInfoTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.state.info.text,
      marginBottom: 12,
    },
    stockInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    stockInfoLabel: {
      fontSize: 13,
      color: theme.color.state.info.text,
      fontWeight: '500',
    },
    stockInfoValue: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.state.info.text,
    },
    stockInfoValueDifferent: {
      color: theme.color.text.danger,
    },
    stockDifferenceWarning: {
      flexDirection: 'row',
      backgroundColor: theme.color.state.warning.background,
      borderRadius: 6,
      padding: 10,
      marginTop: 8,
      gap: 10,
    },
    stockDifferenceWarningIcon: {
      fontSize: 18,
    },
    stockDifferenceWarningTextContainer: {
      flex: 1,
    },
    stockDifferenceWarningTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.state.warning.text,
      marginBottom: 4,
    },
    stockDifferenceWarningText: {
      fontSize: 12,
      color: theme.color.state.warning.text,
      lineHeight: 16,
    },
    previewSummaryError: {
      color: theme.color.border.error,
    },
    // Include in Sheet Checkbox Styles
    includeInSheetGlobalContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 16,
      backgroundColor: theme.color.background.subtle,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    includeInSheetCheckbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.surface.base,
      marginTop: 2,
    },
    includeInSheetCheckboxChecked: {
      backgroundColor: theme.color.action.success.background,
      borderColor: theme.color.action.success.background,
    },
    includeInSheetCheckmark: {
      color: theme.color.surface.base,
      fontSize: 16,
      fontWeight: 'bold',
    },
    includeInSheetTextContainer: {
      flex: 1,
    },
    includeInSheetLabelLarge: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 6,
      lineHeight: 20,
    },
    includeInSheetDescription: {
      fontSize: 13,
      color: theme.color.text.subtle,
      lineHeight: 18,
    },
    // Stock Detail Styles
    stockDetailCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 8,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    stockWarehouseName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 10,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.surface.muted,
    },
    stockDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    stockDetailLabel: {
      fontSize: 13,
      color: theme.color.text.subtle,
      fontWeight: '500',
    },
    stockDetailValue: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    stockReserved: {
      color: theme.color.icon.warning,
    },
    stockAvailable: {
      color: theme.color.action.success.background,
    },
    // Editable Total Quantity Styles
    editableTotalQuantityContainer: {
      backgroundColor: theme.color.state.info.background,
      borderRadius: 8,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.color.state.info.border,
    },
    editableTotalQuantityLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.state.info.text,
      marginBottom: 10,
    },
    editableTotalQuantityInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    editableTotalQuantityInput: {
      flex: 1,
      borderWidth: 2,
      borderColor: theme.color.state.info.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.state.info.text,
      backgroundColor: theme.color.surface.base,
    },
    editableTotalQuantityUnit: {
      fontSize: 14,
      color: theme.color.state.info.text,
      fontWeight: '600',
    },
    editableTotalQuantityHint: {
      fontSize: 12,
      color: theme.color.state.info.text,
      fontStyle: 'italic',
      lineHeight: 16,
    },
    recalculateButton: {
      backgroundColor: theme.color.state.info.border,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    recalculateButtonText: {
      color: theme.color.surface.base,
      fontSize: 14,
      fontWeight: '700',
    },
    // Editable Distribution Styles
    editableItem: {
      padding: 14,
      backgroundColor: theme.color.surface.base,
      borderRadius: 8,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    editableItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.surface.muted,
    },
    editableParticipantName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    editableParticipantType: {
      fontSize: 12,
      color: theme.color.text.subtle,
      fontWeight: '500',
    },
    editableItemDetails: {
      gap: 10,
    },
    editableDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    editableDetailLabel: {
      fontSize: 13,
      color: theme.color.text.subtle,
    },
    editablePercentage: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.brand.primary,
    },
    roundingFactorContainer: {
      marginTop: 4,
    },
    roundingFactorLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: 8,
    },
    roundingFactorButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    roundingFactorButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
      alignItems: 'center',
    },
    roundingFactorButtonSelected: {
      borderColor: theme.color.action.success.background,
      backgroundColor: theme.color.state.success.background,
    },
    roundingFactorButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.subtle,
    },
    roundingFactorButtonTextSelected: {
      color: theme.color.action.success.background,
    },
    editableQuantityContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    editableQuantityLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
      minWidth: 70,
    },
    editableQuantityInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: theme.color.text.heading,
      backgroundColor: theme.color.surface.base,
      fontWeight: '600',
    },
    editableQuantityUnit: {
      fontSize: 13,
      color: theme.color.text.subtle,
    },
    presentationEquivalence: {
      marginTop: 6,
      paddingLeft: 78,
    },
    presentationEquivalenceText: {
      fontSize: 12,
      color: theme.color.brand.primary,
      fontStyle: 'italic',
    },
  });
