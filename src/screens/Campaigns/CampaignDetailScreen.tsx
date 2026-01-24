import React, { useState, useCallback, useMemo, useRef } from 'react';
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
  TextInput,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { campaignsService } from '@/services/api';
import { companiesApi } from '@/services/api/companies';
import { sitesApi } from '@/services/api/sites';
import { productsApi, priceProfilesApi } from '@/services/api';
import logger from '@/utils/logger';
import {
  Campaign,
  CampaignStatus,
  CampaignStatusLabels,
  CampaignStatusColors,
  CampaignProduct,
} from '@/types/campaigns';
import { Company } from '@/types/companies';
import { Site } from '@/types/sites';
import { Product } from '@/services/api/products';
import { PriceProfile, ProductSalePrice } from '@/types/price-profiles';
import { ParticipantTotalsResponse } from '@/types/participant-totals';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { CampaignProductBannerModal } from '@/components/Campaigns/CampaignProductBannerModal';

interface CampaignDetailScreenProps {
  navigation: any;
  route: {
    params: {
      campaignId: string;
    };
  };
}

type TabType = 'overview' | 'participants' | 'products';

export const CampaignDetailScreen: React.FC<CampaignDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { campaignId } = route.params;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [companies, setCompanies] = useState<Record<string, Company>>({});
  const [sites, setSites] = useState<Record<string, Site>>({});
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [selectedProduct, setSelectedProduct] = useState<CampaignProduct | null>(null);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [priceProfiles, setPriceProfiles] = useState<PriceProfile[]>([]);
  const [productSalePrices, setProductSalePrices] = useState<Record<string, ProductSalePrice[]>>({});
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [editingPrice, setEditingPrice] = useState<{productId: string, profileId: string, value: string} | null>(null);
  const [editingCost, setEditingCost] = useState<{productId: string, value: string} | null>(null);
  const [savingPrice, setSavingPrice] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [distributionFilter, setDistributionFilter] = useState<'all' | 'generated' | 'not-generated'>('all');
  const [participantTotals, setParticipantTotals] = useState<ParticipantTotalsResponse | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const { width, height } = useWindowDimensions();
  const hasLoadedRef = useRef(false);

  const isTablet = width >= 768 || height >= 768;

  const loadCampaign = useCallback(async () => {
    try {
      const data = await campaignsService.getCampaign(campaignId);
      setCampaign(data);

      // Load price profiles
      try {
        const profiles = await priceProfilesApi.getActivePriceProfiles();
        setPriceProfiles(profiles);
      } catch (error) {
        logger.error('Error loading price profiles:', error);
      }

      // Load companies and sites for participants
      if (data.participants && data.participants.length > 0) {
        const companyIds = data.participants
          .filter(p => p.participantType === 'EXTERNAL_COMPANY' && p.companyId)
          .map(p => p.companyId!);

        const siteIds = data.participants
          .filter(p => p.participantType === 'INTERNAL_SITE' && p.siteId)
          .map(p => p.siteId!);

        // Load companies
        if (companyIds.length > 0) {
          try {
            const companiesResponse = await companiesApi.getCompanies({ limit: 100 });
            const companiesMap: Record<string, Company> = {};
            companiesResponse.data.forEach(company => {
              if (companyIds.includes(company.id)) {
                companiesMap[company.id] = company;
              }
            });
            setCompanies(companiesMap);
          } catch (error) {
            logger.error('Error loading companies:', error);
          }
        }

        // Load sites
        if (siteIds.length > 0) {
          try {
            const sitesResponse = await sitesApi.getSites({ limit: 100 });
            const sitesMap: Record<string, Site> = {};
            sitesResponse.data.forEach(site => {
              if (siteIds.includes(site.id)) {
                sitesMap[site.id] = site;
              }
            });
            setSites(sitesMap);
          } catch (error) {
            logger.error('Error loading sites:', error);
          }
        }
      }

      // Load participant totals
      if (data.participants && data.participants.length > 0) {
        try {
          const totalsResponse = await campaignsService.getParticipantTotals(campaignId);
          setParticipantTotals(totalsResponse);
        } catch (error) {
          logger.error('Error loading participant totals:', error);
        }
      }

      // Load products for campaign products
      if (data.products && data.products.length > 0) {
        // First, use products that come embedded in the campaign response
        const productsMap: Record<string, Product> = {};

        logger.info(`📦 Total campaign products: ${data.products.length}`);

        // Collect products that are already embedded in the response
        let embeddedCount = 0;
        data.products.forEach(campaignProduct => {
          if (campaignProduct.product) {
            embeddedCount++;
            logger.info(`✅ Embedded product found: ${campaignProduct.product.id} - ${campaignProduct.product.title || campaignProduct.product.sku}`);
            productsMap[campaignProduct.productId] = campaignProduct.product as any;
          }
        });

        logger.info(`📊 Embedded products: ${embeddedCount}/${data.products.length}`);

        // Find products that are NOT embedded and need to be fetched
        const missingProductIds = data.products
          .filter(p => !p.product)
          .map(p => p.productId)
          .filter((id, index, self) => self.indexOf(id) === index); // unique IDs

        // Fetch missing products if any
        if (missingProductIds.length > 0) {
          try {
            logger.info(`🔍 Fetching ${missingProductIds.length} missing products:`, missingProductIds.slice(0, 5));

            // Try fetching products individually by ID since bulk fetch isn't working
            await Promise.all(
              missingProductIds.map(async (productId) => {
                try {
                  const product = await productsApi.getProductById(productId);
                  logger.info(`✅ Fetched product: ${product.id} - ${product.title || product.sku} - Costo: ${product.costCents}`);
                  productsMap[productId] = product;
                } catch (error) {
                  logger.error(`❌ Error fetching product ${productId}:`, error);
                }
              })
            );

            logger.info(`✅ Successfully fetched ${Object.keys(productsMap).length} products`);
          } catch (error) {
            logger.error('Error loading missing products:', error);
          }
        }

        logger.info(`📋 Final products map size: ${Object.keys(productsMap).length}`);
        logger.info(`📋 Sample product from map:`, Object.values(productsMap)[0]);

        setProducts(productsMap);

        // Load sale prices for each product
        const productIds = data.products
          .map(p => p.productId)
          .filter((id, index, self) => self.indexOf(id) === index); // unique IDs

        const salePricesMap: Record<string, ProductSalePrice[]> = {};
        await Promise.all(
          productIds.map(async (productId) => {
            try {
              const salePricesResponse = await priceProfilesApi.getProductSalePrices(productId);
              // The API returns {productId, productSku, costCents, salePrices: [...]}
              const prices = (salePricesResponse as any).salePrices || salePricesResponse.data || [];
              salePricesMap[productId] = prices;
            } catch (error) {
              logger.error(`Error loading sale prices for product ${productId}:`, error);
              salePricesMap[productId] = [];
            }
          })
        );
        setProductSalePrices(salePricesMap);
      }
    } catch (error: any) {
      logger.error('Error loading campaign:', error);
      Alert.alert('Error', 'No se pudo cargar la campaña');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId, navigation]);

  useFocusEffect(
    useCallback(() => {
      // Check if we should force reload (e.g., after editing a product)
      const shouldReload = route.params?.shouldReload;

      if (shouldReload) {
        // Clear the param to avoid reloading again
        navigation.setParams({ shouldReload: undefined } as any);
        hasLoadedRef.current = true;
        loadCampaign();
      } else if (!hasLoadedRef.current) {
        // Only load on first mount, not on every focus
        hasLoadedRef.current = true;
        loadCampaign();
      }

      // Don't reset hasLoadedRef on cleanup - keep the campaign loaded
      // Only reset when explicitly needed (e.g., shouldReload param)
    }, [loadCampaign, route.params?.shouldReload, navigation])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    hasLoadedRef.current = true; // Mark as loaded to prevent duplicate loads
    loadCampaign();
  };

  const handleActivate = async () => {
    if (!campaign) return;

    Alert.alert(
      'Activar Campaña',
      '¿Estás seguro de activar esta campaña? Podrás seguir editando y eliminando participantes y productos hasta que cierres la campaña.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Activar',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await campaignsService.activateCampaign(campaignId);
              Alert.alert('Éxito', 'Campaña activada exitosamente');
              loadCampaign();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo activar la campaña'
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = async () => {
    if (!campaign) return;

    Alert.alert(
      'Cerrar Campaña',
      '¿Estás seguro de cerrar esta campaña? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await campaignsService.closeCampaign(campaignId);
              Alert.alert('Éxito', 'Campaña cerrada exitosamente');
              loadCampaign();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo cerrar la campaña'
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancel = async () => {
    if (!campaign) return;

    Alert.alert(
      'Cancelar Campaña',
      '¿Estás seguro de cancelar esta campaña?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await campaignsService.cancelCampaign(campaignId);
              Alert.alert('Éxito', 'Campaña cancelada exitosamente');
              loadCampaign();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo cancelar la campaña'
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
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

  const renderTabs = () => {
    const tabs: Array<{ key: TabType; label: string }> = [
      { key: 'overview', label: 'Resumen' },
      { key: 'participants', label: 'Participantes' },
      { key: 'products', label: 'Productos' },
    ];

    return (
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              isTablet && styles.tabTablet,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                isTablet && styles.tabTextTablet,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderOverview = () => {
    if (!campaign) return null;

    const totalParticipants = campaign.participants?.length || 0;
    const totalProducts = campaign.products?.length || 0;
    const activeProducts =
      campaign.products?.filter((p) => p.productStatus === 'ACTIVE').length || 0;
    const generatedProducts =
      campaign.products?.filter((p) => p.distributionGenerated).length || 0;

    return (
      <View style={styles.overviewContainer}>
        {/* Campaign Info */}
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Información General
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Código:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {campaign.code}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Nombre:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {campaign.name}
            </Text>
          </View>

          {campaign.description && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Descripción:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {campaign.description}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Estado:
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

          {campaign.startDate && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Fecha Inicio:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {formatDate(campaign.startDate)}
              </Text>
            </View>
          )}

          {campaign.endDate && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Fecha Fin:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {formatDate(campaign.endDate)}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Creado:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {formatDate(campaign.createdAt)}
            </Text>
          </View>

          {campaign.closedAt && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                Cerrado:
              </Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {formatDate(campaign.closedAt)}
              </Text>
            </View>
          )}
        </View>

        {/* Statistics */}
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Estadísticas
          </Text>

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                {totalParticipants}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                Participantes
              </Text>
            </View>

            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                {totalProducts}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                Productos
              </Text>
            </View>

            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                {activeProducts}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                Activos
              </Text>
            </View>

            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                {generatedProducts}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                Generados
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {campaign.notes && (
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Notas
            </Text>
            <Text style={[styles.notesText, isTablet && styles.notesTextTablet]}>
              {campaign.notes}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const handleDownloadGeneralReport = async () => {
    try {
      setDownloadingReport(true);

      logger.info('🔄 Descargando reporte general de totales...');
      const startTime = new Date().getTime();

      // Call the API to get the PDF blob
      const pdfBlob = await campaignsService.exportParticipantTotalsPdf(campaignId);

      const endTime = new Date().getTime();
      logger.info('✅ PDF descargado del servidor');
      logger.info('📦 Tamaño del PDF:', pdfBlob.size, 'bytes');
      logger.info('⏱️ Tiempo de descarga:', (endTime - startTime), 'ms');

      if (Platform.OS === 'web') {
        // For web, create a download link using blob URL
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `reporte-totales-${campaign?.code || campaignId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        Alert.alert('Éxito', 'El reporte se está descargando');
      } else {
        // For mobile (iOS/Android), save to file system and share
        const timestamp = new Date().getTime();
        const fileName = `reporte-totales-${timestamp}.pdf`;
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
            dialogTitle: 'Reporte de Totales',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Éxito', `PDF guardado en: ${file.uri}`);
        }
      }
    } catch (error: any) {
      logger.error('Error downloading report:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudo descargar el reporte'
      );
    } finally {
      setDownloadingReport(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  const handleOpenCopyParticipantsModal = async () => {
    try {
      setActionLoading(true);

      // Load all campaigns except the current one, ordered by creation date (newest first)
      const response = await campaignsService.getCampaigns({
        limit: 100,
        orderBy: 'createdAt',
        orderDir: 'DESC'
      });

      // Filter campaigns that are not the current one
      const otherCampaigns = response.data.filter(c => c.id !== campaignId);

      if (otherCampaigns.length === 0) {
        Alert.alert('Error', 'No hay otras campañas disponibles para copiar participantes');
        setActionLoading(false);
        return;
      }

      // Get the most recent campaign (first one after ordering by createdAt DESC)
      const latestCampaign = otherCampaigns[0];

      // Load the full campaign details with participants
      logger.info('📥 Cargando participantes de la campaña:', latestCampaign.code);
      const fullCampaign = await campaignsService.getCampaign(latestCampaign.id);

      if (!fullCampaign.participants || fullCampaign.participants.length === 0) {
        Alert.alert('Error', `La campaña "${latestCampaign.code} - ${latestCampaign.name}" no tiene participantes para copiar`);
        setActionLoading(false);
        return;
      }

      // Show confirmation dialog
      Alert.alert(
        'Copiar Participantes',
        `¿Deseas copiar los ${fullCampaign.participants.length} participante(s) de la campaña "${latestCampaign.code} - ${latestCampaign.name}"?`,
        [
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => setActionLoading(false)
          },
          {
            text: 'Copiar',
            onPress: () => handleCopyParticipantsFromCampaign(fullCampaign)
          }
        ]
      );
    } catch (error: any) {
      logger.error('Error loading campaigns for copy:', error);
      Alert.alert('Error', error.message || 'No se pudieron cargar las campañas');
      setActionLoading(false);
    }
  };

  const handleCopyParticipantsFromCampaign = async (sourceCampaign: Campaign) => {
    try {
      if (!sourceCampaign || !sourceCampaign.participants) {
        Alert.alert('Error', 'No se encontraron participantes en la campaña seleccionada');
        setActionLoading(false);
        return;
      }

      // Copy each participant
      let successCount = 0;
      let errorCount = 0;

      for (const participant of sourceCampaign.participants) {
        try {
          const participantData: any = {
            participantType: participant.participantType,
            assignedAmount: participant.assignedAmountCents / 100,
            currency: participant.currency,
          };

          if (participant.participantType === 'EXTERNAL_COMPANY' && participant.companyId) {
            participantData.companyId = participant.companyId;
          } else if (participant.participantType === 'INTERNAL_SITE' && participant.siteId) {
            participantData.siteId = participant.siteId;
          }

          if (participant.priceProfileId) {
            participantData.priceProfileId = participant.priceProfileId;
          }

          await campaignsService.addParticipant(campaignId, participantData);
          successCount++;
        } catch (error) {
          errorCount++;
          logger.error('Error copying participant:', error);
        }
      }

      if (successCount > 0) {
        Alert.alert(
          'Éxito',
          `Se copiaron ${successCount} participante(s) correctamente${errorCount > 0 ? `. ${errorCount} fallaron.` : ''}`,
          [{ text: 'OK', onPress: () => loadCampaign() }]
        );
      } else {
        Alert.alert('Error', 'No se pudo copiar ningún participante');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudieron copiar los participantes');
    } finally {
      setActionLoading(false);
    }
  };

  const renderParticipants = () => {
    if (!campaign) return null;

    // Calculate total expected amount from all participants
    const totalExpectedAmountCents = campaign.participants?.reduce(
      (sum, participant) => sum + (participant.assignedAmountCents || 0),
      0
    ) || 0;

    return (
      <View style={styles.tabContent}>
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Participantes ({campaign.participants?.length || 0})
            </Text>
            {(campaign.status === CampaignStatus.DRAFT || campaign.status === CampaignStatus.ACTIVE) && (
              <View style={styles.headerButtons}>
                <TouchableOpacity
                  style={[styles.copyButton, isTablet && styles.copyButtonTablet]}
                  onPress={handleOpenCopyParticipantsModal}
                >
                  <Text style={[styles.copyButtonText, isTablet && styles.copyButtonTextTablet]}>
                    📋 Copiar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, isTablet && styles.addButtonTablet]}
                  onPress={() =>
                    navigation.navigate('AddCampaignParticipant', { campaignId })
                  }
                >
                  <Text style={[styles.addButtonText, isTablet && styles.addButtonTextTablet]}>
                    + Agregar
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Summary Section */}
          {participantTotals && campaign.participants && campaign.participants.length > 0 && (
            <View style={[styles.summaryCard, isTablet && styles.summaryCardTablet]}>
              <Text style={[styles.summaryTitle, isTablet && styles.summaryTitleTablet]}>
                Resumen General
              </Text>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
                    Total Compra
                  </Text>
                  <Text style={[styles.summaryValuePurchase, isTablet && styles.summaryValueTablet]}>
                    {formatCurrency(participantTotals.totalPurchaseCents)}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
                    Total Venta
                  </Text>
                  <Text style={[styles.summaryValueSale, isTablet && styles.summaryValueTablet]}>
                    {formatCurrency(participantTotals.totalSaleCents)}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
                    Total Margen
                  </Text>
                  <Text style={[styles.summaryValueMargin, isTablet && styles.summaryValueTablet]}>
                    {formatCurrency(participantTotals.totalMarginCents)}
                  </Text>
                  <Text style={[styles.summaryPercentage, isTablet && styles.summaryPercentageTablet]}>
                    ({participantTotals.totalMarginPercentage.toFixed(2)}%)
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
                    Total Esperado
                  </Text>
                  <Text style={[styles.summaryValueExpected, isTablet && styles.summaryValueTablet]}>
                    {formatCurrency(totalExpectedAmountCents)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Download General Report Button */}
          {participantTotals && campaign.participants && campaign.participants.length > 0 && (
            <TouchableOpacity
              style={[
                styles.downloadGeneralReportButton,
                isTablet && styles.downloadGeneralReportButtonTablet,
                downloadingReport && styles.downloadButtonDisabled,
              ]}
              onPress={handleDownloadGeneralReport}
              disabled={downloadingReport}
              activeOpacity={0.7}
            >
              <Text style={[styles.downloadGeneralReportButtonText, isTablet && styles.downloadGeneralReportButtonTextTablet]}>
                {downloadingReport
                  ? '📄 Generando...'
                  : '📄 Descargar Reporte General de Totales'}
              </Text>
            </TouchableOpacity>
          )}

          {!campaign.participants || campaign.participants.length === 0 ? (
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No hay participantes agregados
            </Text>
          ) : (
            campaign.participants.map((participant) => {
              // Find totals for this participant
              const participantTotal = participantTotals?.participants.find(
                p => p.participantId === participant.id
              );

              return (
                <View key={participant.id} style={[styles.participantCard, isTablet && styles.participantCardTablet]}>
                  <TouchableOpacity
                    style={styles.participantCardMain}
                    onPress={() =>
                      navigation.navigate('ParticipantDetail', {
                        campaignId,
                        participantId: participant.id,
                      })
                    }
                  >
                    <View style={styles.listItemContent}>
                      <View style={styles.participantHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.listItemTitle, isTablet && styles.listItemTitleTablet]}>
                            {participant.participantType === 'EXTERNAL_COMPANY'
                              ? (participant.company?.name || companies[participant.companyId!]?.name || `Empresa ID: ${participant.companyId}`)
                              : (participant.site?.name || sites[participant.siteId!]?.name || `Sede ID: ${participant.siteId}`)}
                          </Text>
                          <Text style={[styles.listItemSubtitle, isTablet && styles.listItemSubtitleTablet]}>
                            {participant.participantType === 'EXTERNAL_COMPANY'
                              ? 'Empresa Externa'
                              : 'Sede Interna'}
                            {(participant.site?.code || sites[participant.siteId!]?.code) && ` - ${participant.site?.code || sites[participant.siteId!]?.code}`}
                          </Text>
                        </View>
                        {(campaign.status === CampaignStatus.DRAFT || campaign.status === CampaignStatus.ACTIVE) && (
                          <TouchableOpacity
                            style={[styles.editParticipantButton, isTablet && styles.editParticipantButtonTablet]}
                            onPress={(e) => {
                              e.stopPropagation();
                              navigation.navigate('EditCampaignParticipant', {
                                campaignId,
                                participantId: participant.id,
                                participant,
                              });
                            }}
                          >
                            <Text style={[styles.editParticipantButtonText, isTablet && styles.editParticipantButtonTextTablet]}>
                              ✏️ Editar
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Totals Display */}
                      {participantTotal && (
                        <View style={styles.totalsContainer}>
                          <View style={styles.totalRow}>
                            <Text style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}>
                              Esperado:
                            </Text>
                            <Text style={[styles.totalValueExpected, isTablet && styles.totalValueTablet]}>
                              {formatCurrency(participant.assignedAmountCents)}
                            </Text>
                          </View>
                          <View style={styles.totalRow}>
                            <Text style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}>
                              Compra:
                            </Text>
                            <Text style={[styles.totalValuePurchase, isTablet && styles.totalValueTablet]}>
                              {formatCurrency(participantTotal.totalPurchaseCents)}
                            </Text>
                          </View>
                          <View style={styles.totalRow}>
                            <Text style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}>
                              Venta:
                            </Text>
                            <Text style={[styles.totalValueSale, isTablet && styles.totalValueTablet]}>
                              {formatCurrency(participantTotal.totalSaleCents)}
                            </Text>
                          </View>
                          <View style={styles.totalRow}>
                            <Text style={[styles.totalLabel, isTablet && styles.totalLabelTablet]}>
                              Margen:
                            </Text>
                            <View style={styles.marginValueContainer}>
                              <Text style={[styles.totalValueMargin, isTablet && styles.totalValueTablet]}>
                                {formatCurrency(participantTotal.marginCents)}
                              </Text>
                              <Text style={[styles.marginPercentage, isTablet && styles.marginPercentageTablet]}>
                                ({participantTotal.marginPercentage.toFixed(2)}%)
                              </Text>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.arrowIcon, isTablet && styles.arrowIconTablet]}>›</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };

  const handleDeleteProduct = async (product: CampaignProduct) => {
    Alert.alert(
      'Eliminar Producto',
      `¿Estás seguro de eliminar "${product.product?.title || 'este producto'}" de la campaña?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await campaignsService.deleteProduct(campaignId, product.id);

              // Update local state instead of reloading everything
              setCampaign(prevCampaign => {
                if (!prevCampaign || !prevCampaign.products) return prevCampaign;
                return {
                  ...prevCampaign,
                  products: prevCampaign.products.filter(p => p.id !== product.id),
                };
              });

              // Remove from product sale prices
              setProductSalePrices(prevPrices => {
                const { [product.productId]: removed, ...rest } = prevPrices;
                return rest;
              });

              Alert.alert('Éxito', 'Producto eliminado de la campaña');
            } catch (error: any) {
              logger.error('Error deleting product:', error);
              Alert.alert('Error', error.message || 'No se pudo eliminar el producto');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleShowBanner = (product: CampaignProduct) => {
    setSelectedProduct(product);
    setShowBannerModal(true);
  };

  const handleCloseBanner = () => {
    setShowBannerModal(false);
    setSelectedProduct(null);
    // No need to reload campaign - the modal updates its own state locally
  };

  const toggleProductExpanded = (productId: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleStartEditCost = (productId: string, currentCost: number) => {
    setEditingCost({
      productId,
      value: (currentCost / 100).toFixed(2),
    });
  };

  const handleStartEditPrice = (productId: string, profileId: string, currentPrice: number) => {
    setEditingPrice({
      productId,
      profileId,
      value: (currentPrice / 100).toFixed(2),
    });
  };

  const handleSaveCost = async (productId: string) => {
    if (!editingCost || editingCost.productId !== productId) return;

    try {
      setSavingPrice(true);
      const costCents = Math.round(parseFloat(editingCost.value) * 100);

      await productsApi.updateProduct(productId, { costCents });

      // Update local state instead of reloading everything
      setProducts(prevProducts => {
        if (!prevProducts || !prevProducts[productId]) return prevProducts;
        return {
          ...prevProducts,
          [productId]: {
            ...prevProducts[productId],
            costCents,
          },
        };
      });

      setEditingCost(null);
      Alert.alert('Éxito', 'Costo actualizado correctamente');
    } catch (error: any) {
      logger.error('Error saving cost:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar el costo');
    } finally {
      setSavingPrice(false);
    }
  };

  const handleSavePrice = async (productId: string, profileId: string) => {
    if (!editingPrice || editingPrice.productId !== productId || editingPrice.profileId !== profileId) return;

    try {
      setSavingPrice(true);
      const priceCents = Math.round(parseFloat(editingPrice.value) * 100);

      await priceProfilesApi.updateSalePrice(productId, {
        productId,
        presentationId: null,
        profileId,
        priceCents,
      });

      // Update local state instead of reloading everything
      setProductSalePrices(prevPrices => {
        const currentPrices = prevPrices[productId] || [];
        const existingIndex = currentPrices.findIndex(
          p => p.profileId === profileId && p.presentationId === null
        );

        let updatedPrices: ProductSalePrice[];
        if (existingIndex >= 0) {
          // Update existing price
          updatedPrices = [...currentPrices];
          updatedPrices[existingIndex] = { ...updatedPrices[existingIndex], priceCents };
        } else {
          // Add new price - create a complete ProductSalePrice object
          const newPrice: ProductSalePrice = {
            id: `temp-${Date.now()}`, // Temporary ID
            productId,
            presentationId: null,
            profileId,
            priceCents,
            currency: 'PEN',
            isOverridden: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          updatedPrices = [...currentPrices, newPrice];
        }

        return {
          ...prevPrices,
          [productId]: updatedPrices,
        };
      });

      setEditingPrice(null);
      Alert.alert('Éxito', 'Precio actualizado correctamente');
    } catch (error: any) {
      logger.error('Error saving price:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar el precio');
    } finally {
      setSavingPrice(false);
    }
  };

  const getSalePriceForProfile = (productId: string, profileId: string): number => {
    const prices = productSalePrices[productId] || [];
    const priceEntry = prices.find(p => p.profileId === profileId && p.presentationId === null);
    return priceEntry?.priceCents || 0;
  };

  const handleCalculateFranquiciaFromSocia = async (productId: string) => {
    // Find Socia and Franquicia profiles
    const sociaProfile = priceProfiles.find(p => p.code === 'SOCIA' || p.name.toLowerCase().includes('socia'));
    const franquiciaProfile = priceProfiles.find(p => p.code === 'FRANQ' || p.name.toLowerCase().includes('franquicia'));

    if (!sociaProfile || !franquiciaProfile) {
      Alert.alert('Error', 'No se encontraron los perfiles de Precio Socia y Precio Franquicia');
      return;
    }

    const sociaPriceCents = getSalePriceForProfile(productId, sociaProfile.id);
    if (sociaPriceCents === 0) {
      Alert.alert('Error', 'El Precio Socia debe estar configurado primero');
      return;
    }

    const franquiciaPriceCents = Math.round(sociaPriceCents / 1.15);

    try {
      setSavingPrice(true);
      await priceProfilesApi.updateSalePrice(productId, {
        productId,
        presentationId: null,
        profileId: franquiciaProfile.id,
        priceCents: franquiciaPriceCents,
      });

      // Update local state instead of reloading everything
      setProductSalePrices(prevPrices => {
        const currentPrices = prevPrices[productId] || [];
        const existingIndex = currentPrices.findIndex(
          p => p.profileId === franquiciaProfile.id && p.presentationId === null
        );

        let updatedPrices: ProductSalePrice[];
        if (existingIndex >= 0) {
          // Update existing price
          updatedPrices = [...currentPrices];
          updatedPrices[existingIndex] = { ...updatedPrices[existingIndex], priceCents: franquiciaPriceCents };
        } else {
          // Add new price
          const newPrice: ProductSalePrice = {
            id: `temp-${Date.now()}`,
            productId,
            presentationId: null,
            profileId: franquiciaProfile.id,
            priceCents: franquiciaPriceCents,
            currency: 'PEN',
            isOverridden: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          updatedPrices = [...currentPrices, newPrice];
        }

        return {
          ...prevPrices,
          [productId]: updatedPrices,
        };
      });

      Alert.alert('Éxito', `Precio Franquicia calculado: S/ ${(franquiciaPriceCents / 100).toFixed(2)}`);
    } catch (error: any) {
      logger.error('Error calculating franquicia price:', error);
      Alert.alert('Error', error.message || 'No se pudo calcular el precio franquicia');
    } finally {
      setSavingPrice(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!campaign?.products) return [];

    let filtered = campaign.products;

    // Apply distribution filter
    if (distributionFilter === 'generated') {
      filtered = filtered.filter(product => product.distributionGenerated);
    } else if (distributionFilter === 'not-generated') {
      filtered = filtered.filter(product => !product.distributionGenerated);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product => {
        const productDetails = product.product || products[product.productId];
        const title = productDetails?.title?.toLowerCase() || '';
        const sku = productDetails?.sku?.toLowerCase() || '';
        const quantity = product.totalQuantityBase.toString();

        return title.includes(query) || sku.includes(query) || quantity.includes(query);
      });
    }

    return filtered;
  }, [campaign?.products, products, searchQuery, distributionFilter]);

  const renderProducts = () => {
    if (!campaign) return null;

    return (
      <View style={styles.tabContent}>
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Productos ({campaign.products?.length || 0})
            </Text>
            {(campaign.status === CampaignStatus.DRAFT || campaign.status === CampaignStatus.ACTIVE) && (
              <TouchableOpacity
                style={[styles.addButton, isTablet && styles.addButtonTablet]}
                onPress={() =>
                  navigation.navigate('AddCampaignProduct', { campaignId })
                }
              >
                <Text style={[styles.addButtonText, isTablet && styles.addButtonTextTablet]}>
                  + Agregar
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search bar */}
          {campaign.products && campaign.products.length > 0 && (
            <>
              <View style={styles.searchContainer}>
                <TextInput
                  style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                  placeholder="Buscar por nombre, SKU o cantidad..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#94A3B8"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearSearchButton}
                    onPress={() => setSearchQuery('')}
                  >
                    <Text style={styles.clearSearchText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Distribution filter */}
              <View style={styles.filterContainer}>
                <Text style={styles.filterLabel}>Reparto:</Text>
                <View style={styles.filterButtons}>
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      distributionFilter === 'all' && styles.filterButtonActive,
                    ]}
                    onPress={() => setDistributionFilter('all')}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        distributionFilter === 'all' && styles.filterButtonTextActive,
                      ]}
                    >
                      Todos ({campaign.products.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      distributionFilter === 'generated' && styles.filterButtonActive,
                    ]}
                    onPress={() => setDistributionFilter('generated')}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        distributionFilter === 'generated' && styles.filterButtonTextActive,
                      ]}
                    >
                      ✓ Generado ({campaign.products.filter(p => p.distributionGenerated).length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      distributionFilter === 'not-generated' && styles.filterButtonActive,
                    ]}
                    onPress={() => setDistributionFilter('not-generated')}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        distributionFilter === 'not-generated' && styles.filterButtonTextActive,
                      ]}
                    >
                      ✕ Sin generar ({campaign.products.filter(p => !p.distributionGenerated).length})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {!campaign.products || campaign.products.length === 0 ? (
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No hay productos agregados
            </Text>
          ) : filteredProducts.length === 0 ? (
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No se encontraron productos que coincidan con "{searchQuery}"
            </Text>
          ) : (
            filteredProducts.map((product) => {
              const productDetails = product.product || products[product.productId];
              const costCents = productDetails?.costCents || 0;
              const isExpanded = expandedProducts.has(product.id);
              const isPreliminary = product.productStatus !== 'ACTIVE';

              return (
                <View
                  key={product.id}
                  style={[
                    styles.productCard,
                    isTablet && styles.productCardTablet,
                    isPreliminary && styles.productCardPreliminary,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.productCardMain}
                    onPress={() =>
                      navigation.navigate('CampaignProductDetail', {
                        campaignId,
                        productId: product.id,
                      })
                    }
                  >
                    <View style={styles.listItemContent}>
                      <View style={styles.productTitleRow}>
                        <Text style={[styles.listItemTitle, isTablet && styles.listItemTitleTablet]}>
                          {productDetails?.title || `Producto ID: ${product.productId}`}
                        </Text>
                        {isPreliminary && (
                          <View style={styles.preliminaryIndicator}>
                            <Text style={styles.preliminaryIndicatorText}>⚠️ PRELIMINAR</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.listItemSubtitle, isTablet && styles.listItemSubtitleTablet]}>
                        SKU: {productDetails?.sku || 'N/A'} | Cant: {product.totalQuantityBase} | Costo: <Text style={styles.quickPriceValue}>S/ {(costCents / 100).toFixed(2)}</Text>
                        {priceProfiles.slice(0, 2).map((profile, index) => {
                          const priceCents = getSalePriceForProfile(product.productId, profile.id);
                          return (
                            <Text key={profile.id}>
                              {' | '}{profile.name}: <Text style={styles.quickPriceValue}>S/ {(priceCents / 100).toFixed(2)}</Text>
                            </Text>
                          );
                        })}
                        {priceProfiles.length > 2 && <Text> (+{priceProfiles.length - 2})</Text>}
                      </Text>

                      <View style={styles.productBadges}>
                        <View
                          style={[
                            styles.badge,
                            product.productStatus === 'ACTIVE'
                              ? styles.badgeActive
                              : styles.badgePreliminary,
                          ]}
                        >
                          <Text style={styles.badgeText}>
                            {product.productStatus === 'ACTIVE' ? 'Activo' : 'Preliminar'}
                          </Text>
                        </View>
                        {product.distributionGenerated && (
                          <View style={[styles.badge, styles.badgeGenerated]}>
                            <Text style={styles.badgeText}>Generado</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.arrowIcon, isTablet && styles.arrowIconTablet]}>›</Text>
                  </TouchableOpacity>

                  {/* Action buttons */}
                  <View style={styles.productCardActions}>
                    <TouchableOpacity
                      style={[styles.productActionButton, styles.productExpandButton]}
                      onPress={() => toggleProductExpanded(product.id)}
                    >
                      <Text style={styles.productActionButtonText}>
                        {isExpanded ? '▼ Ocultar Precios' : '▶ Ver Precios'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.productActionButton, styles.productBannerButton]}
                      onPress={() => handleShowBanner(product)}
                    >
                      <Text style={styles.productActionButtonText}>📊 Banner</Text>
                    </TouchableOpacity>

                    {(campaign.status === CampaignStatus.DRAFT || campaign.status === CampaignStatus.ACTIVE) && (
                      <TouchableOpacity
                        style={[styles.productActionButton, styles.productDeleteButton]}
                        onPress={() => handleDeleteProduct(product)}
                      >
                        <Text style={styles.productDeleteButtonText}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Expanded price details */}
                  {isExpanded && (
                    <View style={styles.priceDetailsContainer}>
                      {/* Cost row */}
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Costo:</Text>
                        {editingCost?.productId === product.productId ? (
                          <View style={styles.priceEditRow}>
                            <Text style={styles.currencySymbol}>S/</Text>
                            <TextInput
                              style={styles.priceInput}
                              value={editingCost.value}
                              onChangeText={(text) => setEditingCost({...editingCost, value: text})}
                              keyboardType="decimal-pad"
                              autoFocus
                              onSubmitEditing={() => handleSaveCost(product.productId)}
                            />
                            <TouchableOpacity
                              style={styles.saveButton}
                              onPress={() => handleSaveCost(product.productId)}
                              disabled={savingPrice}
                            >
                              {savingPrice ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={styles.saveButtonText}>✓</Text>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.cancelEditButton}
                              onPress={() => setEditingCost(null)}
                            >
                              <Text style={styles.cancelEditButtonText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.priceDisplayRow}>
                            <Text style={styles.priceValue}>S/ {(costCents / 100).toFixed(2)}</Text>
                            <TouchableOpacity
                              style={styles.editButton}
                              onPress={() => handleStartEditCost(product.productId, costCents)}
                            >
                              <Text style={styles.editButtonText}>✏️</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      {/* Price profiles rows */}
                      {priceProfiles.map((profile) => {
                        const priceCents = getSalePriceForProfile(product.productId, profile.id);
                        const isEditingThis = editingPrice?.productId === product.productId && editingPrice?.profileId === profile.id;
                        const isFranquicia = profile.code === 'FRANQ' || profile.name.toLowerCase().includes('franquicia');

                        return (
                          <View key={profile.id} style={styles.priceRow}>
                            <Text style={styles.priceLabel}>{profile.name}:</Text>
                            {isEditingThis ? (
                              <View style={styles.priceEditRow}>
                                <Text style={styles.currencySymbol}>S/</Text>
                                <TextInput
                                  style={styles.priceInput}
                                  value={editingPrice.value}
                                  onChangeText={(text) => setEditingPrice({...editingPrice, value: text})}
                                  keyboardType="decimal-pad"
                                  autoFocus
                                  onSubmitEditing={() => handleSavePrice(product.productId, profile.id)}
                                />
                                <TouchableOpacity
                                  style={styles.saveButton}
                                  onPress={() => handleSavePrice(product.productId, profile.id)}
                                  disabled={savingPrice}
                                >
                                  {savingPrice ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                  ) : (
                                    <Text style={styles.saveButtonText}>✓</Text>
                                  )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.cancelEditButton}
                                  onPress={() => setEditingPrice(null)}
                                >
                                  <Text style={styles.cancelEditButtonText}>✕</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={styles.priceDisplayRow}>
                                <Text style={styles.priceValue}>S/ {(priceCents / 100).toFixed(2)}</Text>
                                <TouchableOpacity
                                  style={styles.editButton}
                                  onPress={() => handleStartEditPrice(product.productId, profile.id, priceCents)}
                                >
                                  <Text style={styles.editButtonText}>✏️</Text>
                                </TouchableOpacity>
                                {isFranquicia && (
                                  <TouchableOpacity
                                    style={styles.calculateButton}
                                    onPress={() => handleCalculateFranquiciaFromSocia(product.productId)}
                                    disabled={savingPrice}
                                  >
                                    <Text style={styles.calculateButtonText}>🧮 /1.15</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando campaña...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!campaign) {
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
            {campaign.code}
          </Text>
        </View>

        {/* Tabs */}
        {renderTabs()}

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
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'participants' && renderParticipants()}
          {activeTab === 'products' && renderProducts()}
        </ScrollView>

        {/* Action Buttons */}
        {campaign.status === CampaignStatus.DRAFT && (
          <View style={[styles.footer, isTablet && styles.footerTablet]}>
            <TouchableOpacity
              style={[styles.cancelCampaignButton, isTablet && styles.cancelCampaignButtonTablet]}
              onPress={handleCancel}
              disabled={actionLoading}
            >
              <Text style={[styles.cancelCampaignButtonText, isTablet && styles.cancelCampaignButtonTextTablet]}>
                Cancelar Campaña
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.activateButton, isTablet && styles.activateButtonTablet]}
              onPress={handleActivate}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.activateButtonText, isTablet && styles.activateButtonTextTablet]}>
                  Activar Campaña
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {campaign.status === CampaignStatus.ACTIVE && (
          <View style={[styles.footer, isTablet && styles.footerTablet]}>
            <TouchableOpacity
              style={[styles.closeButton, isTablet && styles.closeButtonTablet]}
              onPress={handleClose}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.closeButtonText, isTablet && styles.closeButtonTextTablet]}>
                  Cerrar Campaña
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Banner Modal */}
        <CampaignProductBannerModal
          visible={showBannerModal}
          campaignProduct={selectedProduct}
          productDetails={selectedProduct ? (selectedProduct.product || products[selectedProduct.productId]) : null}
          onClose={handleCloseBanner}
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabTablet: {
    paddingVertical: 16,
  },
  tabActive: {
    borderBottomColor: '#6366F1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  tabTextTablet: {
    fontSize: 16,
  },
  tabTextActive: {
    color: '#6366F1',
    fontWeight: '600',
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
  overviewContainer: {
    gap: 16,
  },
  tabContent: {
    gap: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
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
    minWidth: 120,
  },
  infoLabelTablet: {
    fontSize: 16,
    minWidth: 150,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  statCardTablet: {
    padding: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366F1',
    marginBottom: 4,
  },
  statValueTablet: {
    fontSize: 28,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  statLabelTablet: {
    fontSize: 14,
  },
  notesText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  notesTextTablet: {
    fontSize: 16,
    lineHeight: 24,
  },
  addButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonTablet: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  addButtonTextTablet: {
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
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  listItemTablet: {
    paddingVertical: 16,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  listItemTitleTablet: {
    fontSize: 18,
  },
  listItemSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  listItemSubtitleTablet: {
    fontSize: 15,
  },
  listItemAmount: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  listItemAmountTablet: {
    fontSize: 16,
  },
  participantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  participantCardTablet: {
    borderRadius: 12,
  },
  participantCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  editParticipantButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  editParticipantButtonTablet: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editParticipantButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  editParticipantButtonTextTablet: {
    fontSize: 13,
  },
  totalsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  totalLabelTablet: {
    fontSize: 15,
  },
  totalValuePurchase: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  totalValueSale: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  totalValueMargin: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  totalValueExpected: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  totalValueTablet: {
    fontSize: 16,
  },
  marginValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  marginPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    opacity: 0.8,
  },
  marginPercentageTablet: {
    fontSize: 14,
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  summaryCardTablet: {
    padding: 24,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryTitleTablet: {
    fontSize: 22,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 6,
    textAlign: 'center',
  },
  summaryLabelTablet: {
    fontSize: 14,
  },
  summaryValuePurchase: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F59E0B',
    textAlign: 'center',
  },
  summaryValueSale: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
  },
  summaryValueMargin: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
    textAlign: 'center',
  },
  summaryValueExpected: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
    textAlign: 'center',
  },
  summaryValueTablet: {
    fontSize: 22,
  },
  summaryPercentage: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
    marginTop: 2,
  },
  summaryPercentageTablet: {
    fontSize: 14,
  },
  downloadGeneralReportButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadGeneralReportButtonTablet: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginBottom: 20,
  },
  downloadGeneralReportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  downloadGeneralReportButtonTextTablet: {
    fontSize: 16,
  },
  downloadButtonDisabled: {
    opacity: 0.5,
  },
  quickPriceValue: {
    fontWeight: '700',
    color: '#10B981',
  },
  productBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeActive: {
    backgroundColor: '#10B98120',
  },
  badgePreliminary: {
    backgroundColor: '#F59E0B40',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  badgeGenerated: {
    backgroundColor: '#6366F120',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E293B',
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  preliminaryIndicator: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  preliminaryIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#CBD5E1',
    fontWeight: 'bold',
  },
  arrowIconTablet: {
    fontSize: 32,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  productCardPreliminary: {
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderLeftWidth: 4,
  },
  productCardTablet: {
    borderRadius: 12,
  },
  productCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  productCardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  productActionButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productBannerButton: {
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  productActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  productDeleteButton: {
    backgroundColor: '#FEF2F2',
  },
  productDeleteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  productExpandButton: {
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  priceDetailsContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
  priceDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  priceEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  priceInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    minWidth: 80,
  },
  editButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: '#3B82F6',
  },
  saveButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelEditButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  cancelEditButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  calculateButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 4,
  },
  calculateButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  searchContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
  },
  searchInputTablet: {
    fontSize: 16,
    paddingVertical: 12,
  },
  clearSearchButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -12 }],
    backgroundColor: '#94A3B8',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
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
  cancelCampaignButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelCampaignButtonTablet: {
    paddingVertical: 16,
  },
  cancelCampaignButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  cancelCampaignButtonTextTablet: {
    fontSize: 18,
  },
  activateButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateButtonTablet: {
    paddingVertical: 16,
  },
  activateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activateButtonTextTablet: {
    fontSize: 18,
  },
  closeButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonTablet: {
    paddingVertical: 16,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButtonTextTablet: {
    fontSize: 18,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  copyButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonTablet: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  copyButtonTextTablet: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContentTablet: {
    padding: 32,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  modalTitleTablet: {
    fontSize: 24,
  },
  modalDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  modalDescriptionTablet: {
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 24,
  },
  pickerContainerTablet: {
    borderRadius: 10,
  },
  picker: {
    height: 50,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonTablet: {
    paddingVertical: 16,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  modalConfirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButtonTextTablet: {
    fontSize: 16,
  },
});
