import React, { useState, useCallback } from 'react';
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
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { campaignsService, repartosService } from '@/services/api';
import {
  Campaign,
  CampaignStatus,
  CampaignStatusLabels,
  CampaignStatusColors,
} from '@/types/campaigns';
import { RepartoProducto, RepartoProductoValidationStatus } from '@/types/repartos';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProductSelectionModal, CircularProgress } from '@/components/Repartos';

interface RepartosScreenProps {
  navigation: any;
}

export const RepartosScreen: React.FC<RepartosScreenProps> = ({ navigation }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<CampaignStatus | 'ALL'>('ALL');
  const [exportingCampaignId, setExportingCampaignId] = useState<string | null>(null);
  const [showProductSelectionModal, setShowProductSelectionModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);
  const [allProducts, setAllProducts] = useState<RepartoProducto[]>([]);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);

      const params: any = {};

      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }

      const response = await campaignsService.getCampaigns(params);

      // Remove duplicate products from each campaign to avoid React key warnings
      const cleanedCampaigns = response.data.map((campaign: Campaign) => {
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

      setCampaigns(cleanedCampaigns);
    } catch (error: any) {
      console.error('Error loading campaigns:', error);
      Alert.alert('Error', 'No se pudieron cargar las campañas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus]);

  useFocusEffect(
    useCallback(() => {
      console.log('📱 RepartosScreen focused - reloading campaigns...');
      setLoading(true);
      loadCampaigns();
    }, [loadCampaigns])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadCampaigns();
  };

  const handleCampaignPress = (campaign: Campaign) => {
    navigation.navigate('RepartoCampaignDetail', { campaignId: campaign.id });
  };

  const handleOpenProductSelection = async (campaignId: string, campaignName: string, campaignCode: string) => {
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

      // Sort products by area name (ascending)
      const sortedProducts = uniqueProducts.sort((a, b) => {
        const areaA = a.area?.name || a.areaId || '';
        const areaB = b.area?.name || b.areaId || '';
        return areaA.localeCompare(areaB, 'es', { sensitivity: 'base' });
      });

      setSelectedCampaign({ id: campaignId, name: campaignName, code: campaignCode });
      setAllProducts(sortedProducts);
      setShowProductSelectionModal(true);
    } catch (error: any) {
      console.error('Error loading products:', error);
      Alert.alert('No se pudieron cargar los productos de la campaña');
    }
  };

  const handleExportDistributionSheets = async (selectedProductIds: string[]) => {
    if (!selectedCampaign) return;

    try {
      setExportingCampaignId(selectedCampaign.id);
      setShowProductSelectionModal(false);

      console.log('🔄 Iniciando descarga de PDF para campaña:', selectedCampaign.id);
      const startTime = new Date().getTime();

      // Call the API to get the PDF blob with selected products
      const pdfBlob = await repartosService.exportCampaignDistributionSheets(
        selectedCampaign.id,
        selectedProductIds
      );

      const endTime = new Date().getTime();
      console.log('✅ PDF descargado del servidor');
      console.log('📦 Tamaño del PDF:', pdfBlob.size, 'bytes');
      console.log('⏱️ Tiempo de descarga:', (endTime - startTime), 'ms');
      console.log('🕐 Timestamp actual:', new Date().toISOString());

      if (Platform.OS === 'web') {
        // For web, create a download link using blob URL
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `hojas-reparto-${selectedCampaign.code}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        Alert.alert('Éxito', `Las hojas de reparto de "${selectedCampaign.name}" se están descargando`);
      } else {
        // For mobile (iOS/Android), save to file system and share
        // Use timestamp in filename to avoid caching issues
        const timestamp = new Date().getTime();
        const fileName = `hojas-reparto-${selectedCampaign.code}-${timestamp}.pdf`;
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

        // Share the file - user can choose to save to Downloads from share menu
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Hojas de Reparto - ${selectedCampaign.name}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Éxito', `PDF guardado en: ${file.uri}`);
        }
      }
    } catch (error: any) {
      console.error('Error exporting distribution sheets:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudieron exportar las hojas de reparto'
      );
    } finally {
      setExportingCampaignId(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusBadgeStyle = (status: CampaignStatus) => {
    return {
      backgroundColor: CampaignStatusColors[status] + '20',
      borderColor: CampaignStatusColors[status],
    };
  };

  const getStatusTextStyle = (status: CampaignStatus) => {
    return {
      color: CampaignStatusColors[status],
    };
  };

  const renderStatusFilter = () => {
    const statuses: Array<CampaignStatus | 'ALL'> = [
      'ALL',
      CampaignStatus.ACTIVE,
      CampaignStatus.DRAFT,
      CampaignStatus.COMPLETED,
      CampaignStatus.CLOSED,
      CampaignStatus.CANCELLED,
    ];

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
                {status === 'ALL' ? 'Todos' : CampaignStatusLabels[status]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderCampaignCard = useCallback((campaign: Campaign) => {
    const totalParticipantes = campaign.participants?.length || 0;
    const totalProductos = campaign.products?.length || 0;
    const isExporting = exportingCampaignId === campaign.id;

    // Calcular progreso de validación (cantidad de productos validados, no cantidades)
    let totalProductosValidacion = 0;
    let productosValidados = 0;

    // Contar productos validados de todos los participantes
    campaign.participants?.forEach((participant: any) => {
      if (participant.repartoParticipante?.productos) {
        participant.repartoParticipante.productos.forEach((producto: any) => {
          totalProductosValidacion++;
          if (producto.validationStatus === RepartoProductoValidationStatus.VALIDATED) {
            productosValidados++;
          }
        });
      }
    });

    const validationProgress = totalProductosValidacion > 0
      ? (productosValidados / totalProductosValidacion) * 100
      : 0;

    return (
      <View key={campaign.id} style={[styles.card, isTablet && styles.cardTablet]}>
        <TouchableOpacity
          onPress={() => handleCampaignPress(campaign)}
          activeOpacity={0.7}
        >
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
                    size={isTablet ? 70 : 60}
                    strokeWidth={isTablet ? 7 : 6}
                    progress={validationProgress}
                    total={totalProductosValidacion}
                    validated={productosValidados}
                    fontSize={isTablet ? 14 : 12}
                  />
                  <Text style={[styles.statLabel, isTablet && styles.statLabelTablet, { marginTop: 4 }]}>
                    Productos Validados
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
  }, [isTablet, exportingCampaignId, handleCampaignPress, handleOpenProductSelection, formatDate]);

  if (loading) {
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
            <Text style={[styles.title, isTablet && styles.titleTablet]}>
              Repartos
            </Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              Selecciona una campaña para ver sus repartos
            </Text>
          </View>
        </View>

        {/* Status Filter */}
        {renderStatusFilter()}

        {/* Campaigns List */}
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
          {campaigns.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay campañas disponibles
              </Text>
              <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                Las campañas con repartos aparecerán aquí
              </Text>
            </View>
          ) : (
            campaigns.map((campaign) => renderCampaignCard(campaign))
          )}
        </ScrollView>

        {/* Product Selection Modal */}
        <ProductSelectionModal
          visible={showProductSelectionModal}
          onClose={() => setShowProductSelectionModal(false)}
          onConfirm={handleExportDistributionSheets}
          products={allProducts}
          loading={exportingCampaignId !== null}
        />
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
});
