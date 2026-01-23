import React, { useState, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { campaignsService } from '@/services/api';
import { companiesApi } from '@/services/api/companies';
import { sitesApi } from '@/services/api/sites';
import { productsApi } from '@/services/api';
import logger from '@/utils/logger';
import {
  Campaign,
  CampaignStatus,
  CampaignStatusLabels,
  CampaignStatusColors,
} from '@/types/campaigns';
import { Company } from '@/types/companies';
import { Site } from '@/types/sites';
import { Product } from '@/services/api/products';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

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
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;

  const loadCampaign = useCallback(async () => {
    try {
      const data = await campaignsService.getCampaign(campaignId);
      setCampaign(data);

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

      // Load products for campaign products
      if (data.products && data.products.length > 0) {
        const productIds = data.products
          .map(p => p.productId)
          .filter((id, index, self) => self.indexOf(id) === index); // unique IDs

        if (productIds.length > 0) {
          try {
            const productsResponse = await productsApi.getProducts({ limit: 1000 });
            const productsMap: Record<string, Product> = {};
            const productsList = productsResponse.products || [];
            productsList.forEach(product => {
              if (productIds.includes(product.id)) {
                productsMap[product.id] = product;
              }
            });
            setProducts(productsMap);
          } catch (error) {
            logger.error('Error loading products:', error);
          }
        }
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
      loadCampaign();
    }, [loadCampaign])
  );

  const handleRefresh = () => {
    setRefreshing(true);
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

  const renderParticipants = () => {
    if (!campaign) return null;

    return (
      <View style={styles.tabContent}>
        <View style={[styles.section, isTablet && styles.sectionTablet]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Participantes ({campaign.participants?.length || 0})
            </Text>
            {(campaign.status === CampaignStatus.DRAFT || campaign.status === CampaignStatus.ACTIVE) && (
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
            )}
          </View>

          {!campaign.participants || campaign.participants.length === 0 ? (
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No hay participantes agregados
            </Text>
          ) : (
            campaign.participants.map((participant) => (
              <TouchableOpacity
                key={participant.id}
                style={[styles.listItem, isTablet && styles.listItemTablet]}
                onPress={() =>
                  navigation.navigate('ParticipantDetail', {
                    campaignId,
                    participantId: participant.id,
                  })
                }
              >
                <View style={styles.listItemContent}>
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
                  <Text style={[styles.listItemAmount, isTablet && styles.listItemAmountTablet]}>
                    Monto: S/ {(participant.assignedAmountCents / 100).toFixed(2)}
                  </Text>
                </View>
                <Text style={[styles.arrowIcon, isTablet && styles.arrowIconTablet]}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    );
  };

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

          {!campaign.products || campaign.products.length === 0 ? (
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No hay productos agregados
            </Text>
          ) : (
            campaign.products.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={[styles.listItem, isTablet && styles.listItemTablet]}
                onPress={() =>
                  navigation.navigate('CampaignProductDetail', {
                    campaignId,
                    productId: product.id,
                  })
                }
              >
                <View style={styles.listItemContent}>
                  <Text style={[styles.listItemTitle, isTablet && styles.listItemTitleTablet]}>
                    {product.product?.title || products[product.productId]?.title || `Producto ID: ${product.productId}`}
                  </Text>
                  <Text style={[styles.listItemSubtitle, isTablet && styles.listItemSubtitleTablet]}>
                    SKU: {product.product?.sku || products[product.productId]?.sku || 'N/A'} | Cantidad: {product.totalQuantityBase}
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
            ))
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
              style={[styles.cancelButton, isTablet && styles.cancelButtonTablet]}
              onPress={handleCancel}
              disabled={actionLoading}
            >
              <Text style={[styles.cancelButtonText, isTablet && styles.cancelButtonTextTablet]}>
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
    backgroundColor: '#F59E0B20',
  },
  badgeGenerated: {
    backgroundColor: '#6366F120',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E293B',
  },
  arrowIcon: {
    fontSize: 24,
    color: '#CBD5E1',
    fontWeight: 'bold',
  },
  arrowIconTablet: {
    fontSize: 32,
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
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonTablet: {
    paddingVertical: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  cancelButtonTextTablet: {
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
});
