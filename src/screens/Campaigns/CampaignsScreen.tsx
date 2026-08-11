import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Pagination } from '@/design-system/components';

interface CampaignsScreenProps {
  navigation: any;
}

export const CampaignsScreen: React.FC<CampaignsScreenProps> = ({ navigation }) => {
  // Screen tracking
  useScreenTracking('CampaignsScreen', 'CampaignsScreen');

  // ✅ Por defecto mostrar todas menos canceladas
  const [selectedStatus, setSelectedStatus] = useState<CampaignStatus | 'ALL' | 'NOT_CANCELLED'>(
    'NOT_CANCELLED'
  );
  const [page, setPage] = useState(1);
  const limit = 20;

  const { currentCompany, currentSite } = useAuthStore();
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  // ✅ React Query: Reemplaza loadCampaigns() con caché automático
  const params = useMemo(
    () => ({
      page,
      limit,
      ...(selectedStatus !== 'ALL' &&
        selectedStatus !== 'NOT_CANCELLED' && { status: selectedStatus }),
    }),
    [page, selectedStatus]
  );

  const { data: campaignsResponse, isLoading, isRefetching, refetch } = useCampaigns(params);

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
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="megaphone" size={22} color={theme.color.brand.onHeader} />
                </View>
                <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
                  Campañas
                </Text>
              </View>
              <Text style={styles.headerSubtitle}>Gestión de campañas de distribución</Text>
            </View>
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.primary} />
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
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="megaphone" size={22} color={theme.color.brand.onHeader} />
                </View>
                <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
                  Campañas
                </Text>
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
        actions={[
          {
            icon: 'megaphone-outline',
            label: 'Crear Campa\u00f1a',
            onPress: handleCreateCampaign,
            requiredPermissions: ['campaigns.create'],
          },
        ]}
      />
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  // Header con gradiente
  headerGradient: {
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[4],
    paddingBottom: theme.space[4],
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
    marginBottom: theme.space[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
    letterSpacing: 0.3,
  },
  headerTitleTablet: {
    fontSize: 28,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    marginLeft: theme.space[12],
  },
  statsHeaderContainer: {
    alignItems: 'flex-end',
  },
  statHeaderItem: {
    alignItems: 'center',
    backgroundColor: theme.color.brand.headerBadge,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.lg,
  },
  statHeaderValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
  },
  statHeaderLabel: {
    fontSize: 11,
    color: theme.color.brand.onHeaderMuted,
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
    color: theme.color.text.subtle,
  },
  filterWrapper: {
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  filterContent: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    gap: theme.space[2],
  },
  filterButton: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.muted,
    marginRight: theme.space[2],
  },
  filterButtonTablet: {
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[2.5],
  },
  filterButtonActive: {
    backgroundColor: theme.color.brand.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: theme.color.text.subtle,
    fontWeight: '500',
  },
  filterButtonTextTablet: {
    fontSize: 16,
  },
  filterButtonTextActive: {
    color: theme.color.text.inverse,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.space[4],
  },
  scrollContentTablet: {
    padding: theme.space[8],
  },
  card: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    marginBottom: theme.space[3],
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTablet: {
    padding: theme.space[6],
    marginBottom: theme.space[4],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space[3],
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    flex: 1,
  },
  cardCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.color.text.heading,
  },
  cardCodeTablet: {
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: theme.space[2.5],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.md,
    borderWidth: 1,
  },
  statusBadgeTablet: {
    paddingHorizontal: theme.space[3.5],
    paddingVertical: theme.space[1.5],
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextTablet: {
    fontSize: 14,
  },
  cardBody: {
    marginBottom: theme.space[3],
  },
  campaignName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: theme.space[2],
  },
  campaignNameTablet: {
    fontSize: 22,
  },
  campaignDescription: {
    fontSize: 14,
    color: theme.color.text.subtle,
    marginBottom: theme.space[3],
    lineHeight: 20,
  },
  campaignDescriptionTablet: {
    fontSize: 16,
    lineHeight: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: theme.space[3],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.border.subtle,
    marginBottom: theme.space[3],
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.color.brand.accent,
    marginBottom: theme.space[1],
  },
  statValueTablet: {
    fontSize: 22,
  },
  statLabel: {
    fontSize: 12,
    color: theme.color.text.subtle,
  },
  statLabelTablet: {
    fontSize: 14,
  },
  datesRow: {
    flexDirection: 'row',
    gap: theme.space[4],
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1.5],
  },
  dateLabel: {
    fontSize: 13,
    color: theme.color.text.subtle,
    fontWeight: '500',
  },
  dateLabelTablet: {
    fontSize: 15,
  },
  dateValue: {
    fontSize: 13,
    color: theme.color.text.heading,
  },
  dateValueTablet: {
    fontSize: 15,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.space[3],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  footerText: {
    fontSize: 12,
    color: theme.color.icon.disabled,
  },
  footerTextTablet: {
    fontSize: 14,
  },
  arrowIcon: {
    fontSize: 24,
    color: theme.color.border.default,
    fontWeight: 'bold',
  },
  arrowIconTablet: {
    fontSize: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.space[16],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.subtle,
    marginBottom: theme.space[2],
  },
  emptyTextTablet: {
    fontSize: 22,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.color.icon.disabled,
  },
  emptySubtextTablet: {
    fontSize: 16,
  },
});
