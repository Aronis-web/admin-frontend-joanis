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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { Pagination } from '@/design-system/components';

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
                  <Ionicons name="megaphone" size={22} color={colors.neutral[0]} />
                </View>
                <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>Campañas</Text>
              </View>
              <Text style={styles.headerSubtitle}>Gestión de campañas de distribución</Text>
            </View>
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[900]} />
          <Text style={styles.loadingText}>Cargando campañas...</Text>
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
                  <Ionicons name="megaphone" size={22} color={colors.neutral[0]} />
                </View>
                <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>Campañas</Text>
              </View>
              <Text style={styles.headerSubtitle}>Gestión de campañas de distribución</Text>
            </View>

            {/* Stats */}
            <View style={styles.statsHeaderContainer}>
              <View style={styles.statHeaderItem}>
                <Text style={styles.statHeaderValue}>{pagination.total}</Text>
                <Text style={styles.statHeaderLabel}>Total</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

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
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={setPage}
            loading={isLoading}
          />
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
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[0],
    letterSpacing: 0.3,
  },
  headerTitleTablet: {
    fontSize: 28,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.neutral[500],
  },
  filterWrapper: {
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  filterContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  filterButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    marginRight: spacing[2],
  },
  filterButtonTablet: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
  },
  filterButtonActive: {
    backgroundColor: colors.primary[900],
  },
  filterButtonText: {
    fontSize: 14,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  filterButtonTextTablet: {
    fontSize: 16,
  },
  filterButtonTextActive: {
    color: colors.neutral[0],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  scrollContentTablet: {
    padding: spacing[8],
  },
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTablet: {
    padding: spacing[6],
    marginBottom: spacing[4],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
  },
  cardCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.neutral[800],
  },
  cardCodeTablet: {
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  statusBadgeTablet: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1.5],
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextTablet: {
    fontSize: 14,
  },
  cardBody: {
    marginBottom: spacing[3],
  },
  campaignName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[2],
  },
  campaignNameTablet: {
    fontSize: 22,
  },
  campaignDescription: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: spacing[3],
    lineHeight: 20,
  },
  campaignDescriptionTablet: {
    fontSize: 16,
    lineHeight: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.neutral[200],
    marginBottom: spacing[3],
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accent[600],
    marginBottom: spacing[1],
  },
  statValueTablet: {
    fontSize: 22,
  },
  statLabel: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  statLabelTablet: {
    fontSize: 14,
  },
  datesRow: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  dateLabel: {
    fontSize: 13,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  dateLabelTablet: {
    fontSize: 15,
  },
  dateValue: {
    fontSize: 13,
    color: colors.neutral[800],
  },
  dateValueTablet: {
    fontSize: 15,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  footerText: {
    fontSize: 12,
    color: colors.neutral[400],
  },
  footerTextTablet: {
    fontSize: 14,
  },
  arrowIcon: {
    fontSize: 24,
    color: colors.neutral[300],
    fontWeight: 'bold',
  },
  arrowIconTablet: {
    fontSize: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[16],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[2],
  },
  emptyTextTablet: {
    fontSize: 22,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.neutral[400],
  },
  emptySubtextTablet: {
    fontSize: 16,
  },
});
