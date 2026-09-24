/**
 * CampaignPreSaleDetailScreen - Detalle de una pre-venta de campaña.
 *
 * Muestra cabecera (empresa, campaña, perfil de precio, totales) y el detalle
 * por producto con costos, precio de venta y utilidad. Permite confirmar o
 * cancelar la pre-venta (permiso `repartos.pre_sale`).
 */

import React, { useCallback } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import {
  Text,
  Title,
  Caption,
  Body,
  Card,
  Badge,
  Button,
  Divider,
  EmptyState,
  ErrorState,
} from '@/design-system/components';
import type { ScreenProps } from '@/types/navigation';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Ionicons } from '@expo/vector-icons';
import { useCampaignPreSale, useUpdateCampaignPreSaleStatus } from '@/hooks/api';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';
import Alert from '@/utils/alert';
import {
  CampaignPreSaleItem,
  CampaignPreSaleStatus,
  CampaignPreSaleStatusLabels,
  formatCents,
  formatQuantity,
} from '@/types/campaign-pre-sales';

type Props = ScreenProps<'CampaignPreSaleDetail'>;

export const CampaignPreSaleDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { preSaleId } = route.params;

  const { data: preSale, isLoading, isError, refetch } = useCampaignPreSale(preSaleId);
  const updateStatus = useUpdateCampaignPreSaleStatus();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.REPARTOS.PRE_SALE);

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, []);

  const handleChangeStatus = useCallback(
    (status: Exclude<CampaignPreSaleStatus, CampaignPreSaleStatus.DRAFT>) => {
      const confirmTitle =
        status === CampaignPreSaleStatus.CONFIRMED ? 'Confirmar pre-venta' : 'Cancelar pre-venta';
      const confirmMsg =
        status === CampaignPreSaleStatus.CONFIRMED
          ? '¿Estás seguro de confirmar esta pre-venta?'
          : '¿Estás seguro de cancelar esta pre-venta?';

      Alert.alert(confirmTitle, confirmMsg, [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Confirmar',
          style: status === CampaignPreSaleStatus.CANCELLED ? 'destructive' : 'default',
          onPress: () => {
            updateStatus.mutate(
              { id: preSaleId, status },
              {
                onSuccess: () => Alert.alert('Listo', 'Estado actualizado correctamente'),
              }
            );
          },
        },
      ]);
    },
    [preSaleId, updateStatus]
  );

  if (isLoading) {
    return (
      <ScreenLayout navigation={navigation}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.primary} />
          <Text variant="bodyMedium" color="secondary" style={styles.loadingText}>
            Cargando pre-venta...
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  if (isError || !preSale) {
    return (
      <ScreenLayout navigation={navigation}>
        <View style={styles.centerContainer}>
          <ErrorState onRetry={() => refetch()} />
        </View>
      </ScreenLayout>
    );
  }

  const companyName =
    preSale.companySnapshot?.name ||
    preSale.campaignParticipant?.company?.name ||
    'Empresa destino';
  const campaignName = preSale.campaign?.name || preSale.campaign?.code || 'Campaña';
  const items: CampaignPreSaleItem[] = Array.isArray(preSale.items) ? preSale.items : [];

  const badgeVariant =
    preSale.status === CampaignPreSaleStatus.CONFIRMED
      ? 'success'
      : preSale.status === CampaignPreSaleStatus.CANCELLED
        ? 'danger'
        : 'draft';

  return (
    <ScreenLayout navigation={navigation}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <Card variant="elevated" padding="large" style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Title size="medium">{companyName}</Title>
            <Badge label={CampaignPreSaleStatusLabels[preSale.status]} variant={badgeVariant} />
          </View>
          <Body size="small" color="secondary" style={styles.campaignRow}>
            {campaignName}
          </Body>

          {preSale.priceProfileSnapshot && (
            <View style={styles.infoRow}>
              <Ionicons name="pricetag-outline" size={16} color={theme.color.icon.subtle} />
              <Caption color="tertiary">
                Perfil: {preSale.priceProfileSnapshot.name} ({preSale.priceProfileSnapshot.code}) —
                factor {Number(preSale.priceProfileSnapshot.factorToCost).toFixed(2)}
              </Caption>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.color.icon.subtle} />
            <Caption color="tertiary">Creado: {formatDate(preSale.createdAt)}</Caption>
          </View>

          {preSale.notes && (
            <Body size="small" color="secondary" style={styles.notesRow}>
              {preSale.notes}
            </Body>
          )}
        </Card>

        {/* Totales */}
        <Card variant="elevated" padding="large" style={styles.totalsCard}>
          <Title size="small" style={styles.sectionTitle}>
            Totales
          </Title>
          <View style={styles.totalsGrid}>
            <View style={styles.totalCell}>
              <Caption color="tertiary">Cantidad</Caption>
              <Text variant="numericLarge" color="primary">
                {formatQuantity(preSale.totalQuantity)}
              </Text>
            </View>
            <View style={styles.totalCell}>
              <Caption color="tertiary">Costo total</Caption>
              <Text variant="numericLarge" color="primary">
                {formatCents(preSale.totalCostCents)}
              </Text>
            </View>
            <View style={styles.totalCell}>
              <Caption color="tertiary">Venta total</Caption>
              <Text variant="numericLarge" color={theme.color.brand.accent}>
                {formatCents(preSale.totalSaleCents)}
              </Text>
            </View>
            <View style={styles.totalCell}>
              <Caption color="tertiary">Utilidad</Caption>
              <Text variant="numericLarge" color={theme.color.text.success}>
                {formatCents(preSale.totalMarginCents)}
              </Text>
            </View>
            <View style={styles.totalCell}>
              <Caption color="tertiary">Margen %</Caption>
              <Text variant="numericLarge" color="primary">
                {Number(preSale.marginPercentage).toFixed(2)}%
              </Text>
            </View>
          </View>
          <Caption color="tertiary">Moneda: {preSale.currency || 'PEN'}</Caption>
        </Card>

        {/* Items */}
        <Title size="small" style={styles.itemsTitle}>
          Detalle por producto
        </Title>
        {items.length === 0 ? (
          <EmptyState
            icon="cube-outline"
            title="Sin productos"
            description="Esta pre-venta no tiene detalle de productos."
            size="small"
          />
        ) : (
          items.map((item, index) => (
            <Card key={item.id} variant="elevated" padding="medium" style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleRow}>
                  <Text
                    variant="titleMedium"
                    color="primary"
                    numberOfLines={2}
                    style={styles.itemName}
                  >
                    {item.product?.name || item.product?.title || `Producto ${index + 1}`}
                  </Text>
                  {item.product?.sku ? (
                    <Caption color="tertiary">SKU: {item.product.sku}</Caption>
                  ) : null}
                </View>
              </View>

              <Divider spacing="none" style={styles.itemDivider} />

              <View style={styles.itemFieldsRow}>
                <View style={styles.itemField}>
                  <Caption color="tertiary">Cantidad</Caption>
                  <Text variant="labelMedium" color="primary">
                    {formatQuantity(item.quantity)}
                  </Text>
                </View>
                <View style={styles.itemField}>
                  <Caption color="tertiary">Costo unit.</Caption>
                  <Text variant="labelMedium" color="primary">
                    {formatCents(item.costCents)}
                  </Text>
                </View>
                <View style={styles.itemField}>
                  <Caption color="tertiary">PV</Caption>
                  <Text variant="labelMedium" color="primary">
                    {formatCents(item.salePriceCents)}
                  </Text>
                </View>
                <View style={styles.itemField}>
                  <Caption color="tertiary">Utilidad</Caption>
                  <Text variant="labelMedium" color={theme.color.text.success}>
                    {formatCents(item.marginCents)}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}

        {/* Acciones */}
        {canManage && preSale.status === CampaignPreSaleStatus.DRAFT && (
          <View style={styles.actionsRow}>
            <Button
              title="Confirmar"
              variant="primary"
              fullWidth
              loading={updateStatus.isPending}
              onPress={() => handleChangeStatus(CampaignPreSaleStatus.CONFIRMED)}
              style={styles.actionButton}
            />
            <Button
              title="Cancelar"
              variant="outline"
              fullWidth
              loading={updateStatus.isPending}
              onPress={() => handleChangeStatus(CampaignPreSaleStatus.CANCELLED)}
              style={styles.actionButton}
            />
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    content: {
      padding: theme.space[4],
      paddingBottom: theme.space[24],
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
    headerCard: {
      marginBottom: theme.space[3],
    },
    headerTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.space[2],
      marginBottom: theme.space[1],
    },
    campaignRow: {
      marginBottom: theme.space[2],
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1.5],
      marginTop: theme.space[1],
    },
    notesRow: {
      marginTop: theme.space[2],
    },
    totalsCard: {
      marginBottom: theme.space[4],
    },
    sectionTitle: {
      marginBottom: theme.space[3],
    },
    totalsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[4],
      marginBottom: theme.space[2],
    },
    totalCell: {
      minWidth: '40%',
    },
    itemsTitle: {
      marginBottom: theme.space[2],
    },
    itemCard: {
      marginBottom: theme.space[2],
    },
    itemHeader: {
      marginBottom: theme.space[2],
    },
    itemTitleRow: {
      flexDirection: 'column',
    },
    itemName: {
      marginBottom: theme.space[0.5],
    },
    itemDivider: {
      marginVertical: theme.space[2],
    },
    itemFieldsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[4],
    },
    itemField: {
      minWidth: '40%',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginTop: theme.space[4],
    },
    actionButton: {
      flex: 1,
    },
  });

export default CampaignPreSaleDetailScreen;
