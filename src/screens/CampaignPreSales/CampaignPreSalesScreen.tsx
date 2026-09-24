/**
 * CampaignPreSalesScreen - Listado de pre-ventas de campaña.
 *
 * Módulo de pre-venta (consolidado externo) dentro de la categoría de campañas.
 * Listado paginado con filtro por estado y buscador.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import {
  Text,
  Caption,
  Body,
  Card,
  Badge,
  ChipGroup,
  SearchBar,
  EmptyState,
  ErrorState,
  Pagination,
  Divider,
} from '@/design-system/components';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCampaignPreSales } from '@/hooks/api';
import {
  CampaignPreSale,
  CampaignPreSaleStatus,
  CampaignPreSaleStatusLabels,
  formatCents,
  formatQuantity,
} from '@/types/campaign-pre-sales';
import { ROUTES } from '@/constants/routes';
import type { NavigationProp } from '@/types/navigation';

export const CampaignPreSalesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [status, setStatus] = useState<'ALL' | CampaignPreSaleStatus>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const ITEMS_PER_PAGE = 10;

  // Debounce de búsqueda
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const queryParams = useMemo(() => {
    const params: {
      page: number;
      limit: number;
      status?: CampaignPreSaleStatus;
      search?: string;
    } = {
      page,
      limit: ITEMS_PER_PAGE,
    };
    if (status !== 'ALL') params.status = status;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    return params;
  }, [page, status, debouncedSearch]);

  const { data, isLoading, isFetching, isError, refetch } = useCampaignPreSales(queryParams);

  const items = useMemo<CampaignPreSale[]>(() => {
    const list = data?.data;
    return Array.isArray(list) ? list : [];
  }, [data]);

  const meta = useMemo(() => data?.meta, [data]);

  const handleOpenDetail = useCallback(
    (id: string) => {
      navigation.navigate(ROUTES.CAMPAIGN_PRE_SALE_DETAIL, { preSaleId: id });
    },
    [navigation]
  );

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, []);

  const statusOptions = useMemo(
    () => [
      { label: 'Todas', value: 'ALL' },
      {
        label: CampaignPreSaleStatusLabels[CampaignPreSaleStatus.DRAFT],
        value: CampaignPreSaleStatus.DRAFT,
      },
      {
        label: CampaignPreSaleStatusLabels[CampaignPreSaleStatus.CONFIRMED],
        value: CampaignPreSaleStatus.CONFIRMED,
      },
      {
        label: CampaignPreSaleStatusLabels[CampaignPreSaleStatus.CANCELLED],
        value: CampaignPreSaleStatus.CANCELLED,
      },
    ],
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: CampaignPreSale }) => {
      const companyName =
        item.companySnapshot?.name || item.campaignParticipant?.company?.name || 'Empresa destino';
      const campaignName = item.campaign?.name || item.campaign?.code || 'Campaña';

      return (
        <Card
          variant="elevated"
          padding="none"
          style={styles.card}
          onPress={() => handleOpenDetail(item.id)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Text variant="titleMedium" color="primary" numberOfLines={1}>
                {companyName}
              </Text>
              <Badge
                label={CampaignPreSaleStatusLabels[item.status]}
                variant={
                  item.status === CampaignPreSaleStatus.CONFIRMED
                    ? 'success'
                    : item.status === CampaignPreSaleStatus.CANCELLED
                      ? 'danger'
                      : 'warning'
                }
              />
            </View>
            {item.priceProfileSnapshot && (
              <Caption color="tertiary">Perfil: {item.priceProfileSnapshot.name}</Caption>
            )}
          </View>

          <Divider spacing="none" />

          <View style={styles.cardBody}>
            <Caption color="tertiary">Campaña</Caption>
            <Body size="small" color="secondary" numberOfLines={1}>
              {campaignName}
            </Body>

            <View style={styles.totalsRow}>
              <View style={styles.totalCell}>
                <Text variant="numericMedium" color={theme.color.brand.accent}>
                  {formatCents(item.totalSaleCents)}
                </Text>
                <Caption color="tertiary">Venta total</Caption>
              </View>
              <View style={styles.totalCell}>
                <Text variant="numericMedium" color={theme.color.text.success}>
                  {formatCents(item.totalMarginCents)}
                </Text>
                <Caption color="tertiary">Utilidad</Caption>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Caption color="tertiary">Cantidad: {formatQuantity(item.totalQuantity)}</Caption>
              <Caption color="tertiary">
                Margen: {Number(item.marginPercentage).toFixed(2)}%
              </Caption>
            </View>
          </View>

          <Divider spacing="none" />
          <View style={styles.cardFooter}>
            <Caption color="tertiary">Creado: {formatDate(item.createdAt)}</Caption>
            <Ionicons name="chevron-forward" size={20} color={theme.color.border.default} />
          </View>
        </Card>
      );
    },
    [handleOpenDetail, formatDate, theme, styles]
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading && !isFetching) {
    return (
      <ScreenLayout navigation={navigation}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.primary} />
          <Text variant="bodyMedium" color="secondary" style={styles.loadingText}>
            Cargando pre-ventas...
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  if (isError) {
    return (
      <ScreenLayout navigation={navigation}>
        <View style={styles.centerContainer}>
          <ErrorState onRetry={() => refetch()} />
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <View style={styles.container}>
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerIconRow}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="cart-outline" size={22} color={theme.color.brand.onHeader} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Pre-ventas</Text>
              <Text style={styles.headerSubtitle}>Consolidado externo de campañas</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.filtersContainer}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por campaña, empresa o perfil..."
            loading={isFetching}
          />
          <View style={styles.chipsRow}>
            <ChipGroup
              options={statusOptions}
              selected={[status]}
              onChange={(selected) =>
                setStatus((selected[0] || 'ALL') as 'ALL' | CampaignPreSaleStatus)
              }
              size="small"
            />
          </View>
        </View>

        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={handleRefresh}
              tintColor={theme.color.brand.primary}
              colors={[theme.color.brand.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No hay pre-ventas"
              description="Las pre-ventas generadas al cerrar consolidados externos aparecerán aquí."
            />
          }
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          initialNumToRender={10}
        />

        {meta && meta.total > 0 && (
          <Pagination
            currentPage={meta.page}
            totalPages={meta.totalPages}
            totalItems={meta.total}
            itemsPerPage={meta.limit}
            onPageChange={setPage}
            loading={isFetching}
          />
        )}
      </View>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[8],
      backgroundColor: theme.color.background.subtle,
    },
    loadingText: {
      marginTop: theme.space[4],
    },
    headerGradient: {
      paddingHorizontal: theme.space[5],
      paddingTop: theme.space[4],
      paddingBottom: theme.space[4],
    },
    headerIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
    headerSubtitle: {
      fontSize: 14,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
    },
    filtersContainer: {
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
    chipsRow: {
      marginTop: theme.space[1],
    },
    list: {
      flex: 1,
    },
    listContent: {
      padding: theme.space[4],
      paddingBottom: theme.space[20],
    },
    card: {
      marginBottom: theme.space[3],
    },
    cardHeader: {
      padding: theme.space[4],
      paddingBottom: theme.space[2],
    },
    cardTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.space[2],
      marginBottom: theme.space[1],
    },
    cardBody: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
    },
    totalsRow: {
      flexDirection: 'row',
      gap: theme.space[6],
      marginTop: theme.space[3],
      marginBottom: theme.space[2],
    },
    totalCell: {
      alignItems: 'flex-start',
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: theme.space[1],
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
    },
  });

export default CampaignPreSalesScreen;
