import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { campaignsService } from '@/services/api';
import {
  Campaign,
  CampaignStatus,
  CampaignStatusLabels,
  CampaignStatusColors,
  ProductStatus,
} from '@/types/campaigns';
import { useAuthStore } from '@/store/auth';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import logger from '@/utils/logger';
import { useCampaigns } from '@/hooks/api/useCampaigns';
import { useScreenTracking } from '@/hooks/useScreenTracking';

interface CampaignsScreenProps {
  navigation: any;
}

export const CampaignsScreen: React.FC<CampaignsScreenProps> = ({ navigation }) => {
  // Screen tracking
  useScreenTracking('CampaignsScreen', 'CampaignsScreen');

  // ✅ Por defecto mostrar todas menos canceladas
  const [selectedStatus, setSelectedStatus] = useState<CampaignStatus | 'ALL' | 'NOT_CANCELLED'>('NOT_CANCELLED');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { currentCompany, currentSite } = useAuthStore();
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  // ✅ React Query: Reemplaza loadCampaigns() con caché automático
  const params = useMemo(
    () => ({
      page,
      limit,
      ...(selectedStatus !== 'ALL' && selectedStatus !== 'NOT_CANCELLED' && { status: selectedStatus }),
    }),
    [page, selectedStatus]
  );

  const {
    data: campaignsResponse,
    isLoading,
    isRefetching,
    refetch,
  } = useCampaigns(params);

  // Extraer campaigns y paginación de la respuesta
  const campaigns = useMemo(() => {
    const allCampaigns = campaignsResponse?.data || [];
    // ✅ Filtrar canceladas si selectedStatus es 'NOT_CANCELLED'
    if (selectedStatus === 'NOT_CANCELLED') {
      return allCampaigns.filter((c) => c.status !== CampaignStatus.CANCELLED);
    }
    return allCampaigns;
  }, [campaignsResponse, selectedStatus]);
  const pagination = useMemo(
    () => ({
      page: campaignsResponse?.page || 1,
      limit: campaignsResponse?.limit || limit,
      total: campaignsResponse?.total || 0,
      totalPages: Math.ceil((campaignsResponse?.total || 0) / (campaignsResponse?.limit || limit)),
    }),
    [campaignsResponse]
  );

  // Auto-reload campaigns when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      logger.debug('📱 CampaignsScreen focused - refetching campaigns...');
      refetch();
    }, [refetch])
  );

  // Reset to page 1 when status filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedStatus]);

  // ✅ Handlers simplificados
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handlePreviousPage = useCallback(() => {
    if (pagination.page > 1) {
      setPage(pagination.page - 1);
    }
  }, [pagination.page]);

  const handleNextPage = useCallback(() => {
    if (pagination.page < pagination.totalPages) {
      setPage(pagination.page + 1);
    }
  }, [pagination.page, pagination.totalPages]);

  const handleCreateCampaign = () => {
    navigation.navigate('CreateCampaign');
  };

  const handleCampaignPress = (campaign: Campaign) => {
    navigation.navigate('CampaignDetail', { campaignId: campaign.id });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return 'N/A';
    }
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
    const statuses: Array<CampaignStatus | 'ALL' | 'NOT_CANCELLED'> = [
      'NOT_CANCELLED', // ✅ Por defecto
      'ALL',
      CampaignStatus.DRAFT,
      CampaignStatus.ACTIVE,
      CampaignStatus.CLOSED,
      CampaignStatus.CANCELLED,
    ];

    const getStatusLabel = (status: CampaignStatus | 'ALL' | 'NOT_CANCELLED') => {
      if (status === 'ALL') return 'Todos';
      if (status === 'NOT_CANCELLED') return 'Activas'; // Todas menos canceladas
      return CampaignStatusLabels[status];
    };

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
  };

  const renderCampaignCard = useCallback(
    (campaign: Campaign) => {
      const totalParticipants = campaign.participants?.length || 0;
      const totalProducts = campaign.products?.length || 0;
      const activeProducts =
        campaign.products?.filter((p) => p.productStatus === ProductStatus.ACTIVE).length || 0;
      const generatedProducts =
        campaign.products?.filter((p) => p.distributionGenerated).length || 0;

      return (
        <TouchableOpacity
          key={campaign.id}
          style={[styles.card, isTablet && styles.cardTablet]}
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
              style={[styles.campaignName, isTablet && styles.campaignNameTablet]}
              numberOfLines={2}
            >
              {campaign.name}
            </Text>

            {campaign.description && (
              <Text
                style={[styles.campaignDescription, isTablet && styles.campaignDescriptionTablet]}
                numberOfLines={2}
              >
                {campaign.description}
              </Text>
            )}

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                  {totalParticipants}
                </Text>
                <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                  Participantes
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                  {activeProducts}/{totalProducts}
                </Text>
                <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                  Productos Activos
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                  {generatedProducts}/{totalProducts}
                </Text>
                <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>Repartos</Text>
              </View>
            </View>

            {(campaign.startDate || campaign.endDate) && (
              <View style={styles.datesRow}>
                {campaign.startDate && (
                  <View style={styles.dateItem}>
                    <Text style={[styles.dateLabel, isTablet && styles.dateLabelTablet]}>
                      Inicio:
                    </Text>
                    <Text style={[styles.dateValue, isTablet && styles.dateValueTablet]}>
                      {formatDate(campaign.startDate)}
                    </Text>
                  </View>
                )}
                {campaign.endDate && (
                  <View style={styles.dateItem}>
                    <Text style={[styles.dateLabel, isTablet && styles.dateLabelTablet]}>Fin:</Text>
                    <Text style={[styles.dateValue, isTablet && styles.dateValueTablet]}>
                      {formatDate(campaign.endDate)}
                    </Text>
                  </View>
                )}
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
      );
    },
    [isTablet, handleCampaignPress, formatDate]
  );

  if (isLoading && !campaignsResponse) {
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
            <Text style={[styles.title, isTablet && styles.titleTablet]}>Campañas</Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              Gestión de campañas de distribución
            </Text>
          </View>
        </View>

        {/* Status Filter */}
        {renderStatusFilter()}

        {/* Campaigns List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
        >
          {campaigns.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay campañas disponibles
              </Text>
              <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                Crea una nueva campaña para comenzar
              </Text>
            </View>
          ) : (
            campaigns.map((campaign) => renderCampaignCard(campaign))
          )}
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
                {campaigns.length} de {pagination.total}
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
      </SafeAreaView>
      <ProtectedFAB
        icon="+"
        onPress={handleCreateCampaign}
        requiredPermissions={['campaigns.create']}
        hideIfNoPermission={true}
      />
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
  campaignName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  campaignNameTablet: {
    fontSize: 22,
  },
  campaignDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 20,
  },
  campaignDescriptionTablet: {
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
  datesRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dateItem: {
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
