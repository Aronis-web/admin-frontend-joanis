import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { campaignsService } from '@/services/api';
import {
  CampaignProduct,
  DistributionPreviewResponse,
  DistributionTypeLabels,
  ProductStatusLabels,
  ProductStatusColors,
} from '@/types/campaigns';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

interface CampaignProductDetailScreenProps {
  navigation: any;
  route: {
    params: {
      campaignId: string;
      productId: string;
    };
  };
}

export const CampaignProductDetailScreen: React.FC<CampaignProductDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { campaignId, productId } = route.params;
  const [product, setProduct] = useState<CampaignProduct | null>(null);
  const [preview, setPreview] = useState<DistributionPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;

  const loadProduct = useCallback(async () => {
    try {
      const products = await campaignsService.getProducts(campaignId);
      const foundProduct = products.find((p) => p.id === productId);
      if (foundProduct) {
        setProduct(foundProduct);
      } else {
        Alert.alert('Error', 'Producto no encontrado');
        navigation.goBack();
      }
    } catch (error: any) {
      console.error('Error loading product:', error);
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

  const handleRefresh = () => {
    setRefreshing(true);
    loadProduct();
  };

  const handleShowPreview = async () => {
    if (!product) return;

    setActionLoading(true);
    try {
      const previewData = await campaignsService.getDistributionPreview(
        campaignId,
        productId
      );
      setPreview(previewData);
      setShowPreviewModal(true);
    } catch (error: any) {
      console.error('Error loading preview:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo cargar la vista previa'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateDistribution = async () => {
    if (!product) return;

    if (product.productStatus !== 'ACTIVE') {
      Alert.alert(
        'Error',
        'Solo se pueden generar repartos de productos en estado ACTIVO'
      );
      return;
    }

    Alert.alert(
      'Generar Reparto',
      '¿Estás seguro de generar el reparto para este producto? Esta acción creará los registros de distribución.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              const result = await campaignsService.generateDistribution(
                campaignId,
                productId
              );

              Alert.alert(
                'Éxito',
                `Reparto generado exitosamente\n\n${result.distributionsCreated} distribuciones creadas`,
                [
                  {
                    text: 'OK',
                    onPress: () => loadProduct(),
                  },
                ]
              );
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo generar el reparto'
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleManageCustomDistribution = () => {
    navigation.navigate('ManageCustomDistribution', {
      campaignId,
      productId,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
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
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
              ← Volver
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>
            Detalle del Producto
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && styles.scrollContentTablet,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Product Info */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Información del Producto
            </Text>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Producto:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {product.product?.title || 'N/A'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                SKU:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
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
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Estado:
              </Text>
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
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Tipo de Distribución:
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
                  product.distributionGenerated
                    ? styles.generatedYes
                    : styles.generatedNo,
                ]}
              >
                {product.distributionGenerated ? 'Sí' : 'No'}
              </Text>
            </View>

            {product.sourceType === 'FROM_PURCHASE' && product.purchase && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                  Compra:
                </Text>
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
                  <Text style={[styles.manageButtonText, isTablet && styles.manageButtonTextTablet]}>
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
                    <Text style={styles.distributionName}>
                      {dist.name || 'Sin nombre'}
                    </Text>
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
              ℹ️ Acciones Disponibles
            </Text>
            <Text style={[styles.infoText, isTablet && styles.infoTextTablet]}>
              • Vista Previa: Ver cómo se distribuirá el producto{'\n'}
              • Generar Reparto: Crear los registros de distribución{'\n'}
              • Solo productos ACTIVOS pueden generar reparto{'\n'}
              • El reparto se genera una sola vez por producto
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
              <ActivityIndicator color="#6366F1" />
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
              (product.distributionGenerated || product.productStatus !== 'ACTIVE') &&
                styles.generateButtonDisabled,
            ]}
            onPress={handleGenerateDistribution}
            disabled={
              actionLoading ||
              product.distributionGenerated ||
              product.productStatus !== 'ACTIVE'
            }
          >
            <Text style={[styles.generateButtonText, isTablet && styles.generateButtonTextTablet]}>
              {product.distributionGenerated ? 'Ya Generado' : 'Generar Reparto'}
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
                  Vista Previa de Distribución
                </Text>
                <TouchableOpacity onPress={() => setShowPreviewModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {preview && (
                  <>
                    <View style={styles.previewHeader}>
                      <Text style={styles.previewProductName}>{preview.productName}</Text>
                      <Text style={styles.previewQuantity}>
                        Total: {preview.totalQuantity} unidades
                      </Text>
                      <Text style={styles.previewType}>
                        {DistributionTypeLabels[preview.distributionType]}
                      </Text>
                    </View>

                    {preview.preview.map((item, index) => (
                      <View key={index} style={styles.previewItem}>
                        <View style={styles.previewItemHeader}>
                          <Text style={styles.previewParticipantName}>
                            {item.participantName}
                          </Text>
                          <Text style={styles.previewParticipantType}>
                            {item.participantType === 'EXTERNAL_COMPANY'
                              ? 'Empresa'
                              : 'Sede'}
                          </Text>
                        </View>
                        <View style={styles.previewItemDetails}>
                          <Text style={styles.previewAmount}>
                            Monto: S/ {item.assignedAmount.toFixed(2)}
                          </Text>
                          <Text style={styles.previewPercentage}>
                            {item.percentage.toFixed(2)}%
                          </Text>
                          <Text style={styles.previewCalculated}>
                            → {item.calculatedQuantity} unidades
                          </Text>
                        </View>
                      </View>
                    ))}
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    color: '#6366F1',
    fontWeight: '600',
  },
  backButtonTextTablet: {
    fontSize: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
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
    color: '#1E293B',
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
    color: '#64748B',
    minWidth: 150,
  },
  infoLabelTablet: {
    fontSize: 16,
    minWidth: 180,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
  },
  infoValueTablet: {
    fontSize: 16,
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
  generatedYes: {
    color: '#10B981',
    fontWeight: '600',
  },
  generatedNo: {
    color: '#EF4444',
    fontWeight: '600',
  },
  manageButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  manageButtonTablet: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  manageButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  manageButtonTextTablet: {
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyTextTablet: {
    fontSize: 16,
  },
  distributionItem: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 8,
  },
  distributionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  distributionItems: {
    fontSize: 12,
    color: '#64748B',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoBoxTablet: {
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoTitleTablet: {
    fontSize: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
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
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
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
    borderColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonTablet: {
    paddingVertical: 16,
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  previewButtonTextTablet: {
    fontSize: 18,
  },
  generateButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonTablet: {
    paddingVertical: 16,
  },
  generateButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  generateButtonTextTablet: {
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
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
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  modalTitleTablet: {
    fontSize: 22,
  },
  modalClose: {
    fontSize: 24,
    color: '#64748B',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
  },
  previewHeader: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  previewProductName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  previewQuantity: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  previewType: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '500',
  },
  previewItem: {
    padding: 12,
    backgroundColor: '#F8FAFC',
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
    color: '#1E293B',
  },
  previewParticipantType: {
    fontSize: 12,
    color: '#64748B',
  },
  previewItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewAmount: {
    fontSize: 12,
    color: '#64748B',
  },
  previewPercentage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  previewCalculated: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  modalCloseButton: {
    margin: 16,
    padding: 12,
    backgroundColor: '#6366F1',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
