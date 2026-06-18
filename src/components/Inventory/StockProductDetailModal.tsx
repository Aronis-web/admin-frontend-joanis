import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ProductStockBatch,
  ProductStockDetailWarehouse,
  ProductStockSummaryItem,
} from '@/services/api/inventory';
import { useProductStockDetail } from '@/hooks/api/useStock';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Caption, Card, Divider, EmptyState, Text } from '@/design-system/components';

interface StockProductDetailModalProps {
  visible: boolean;
  onClose: () => void;
  product: ProductStockSummaryItem | null;
  warehouseId?: string;
  areaId?: string;
}

const formatQuantity = (value?: number) => {
  const numericValue = Number(value || 0);
  return Number.isInteger(numericValue)
    ? numericValue.toString()
    : numericValue.toLocaleString('es-PE', { maximumFractionDigits: 2 });
};

const formatMoney = (cents?: number, currency = 'PEN') => {
  const value = Number(cents || 0) / 100;
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
};

const formatDate = (value?: string) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const getBatchStatusColor = (status: string | undefined, theme: Theme) => {
  switch (status) {
    case 'ACTIVE':
      return theme.color.action.success.background;
    case 'DEPLETED':
      return theme.color.icon.subtle;
    case 'BLOCKED':
      return theme.color.action.danger.background;
    default:
      return theme.color.brand.accent;
  }
};

const getMovementColor = (type: string | undefined, theme: Theme) => {
  if (!type) return theme.color.icon.subtle;
  if (type.includes('IN') || type.includes('PURCHASE') || type.includes('RETURN')) {
    return theme.color.action.success.background;
  }
  if (type.includes('OUT') || type.includes('SALE')) {
    return theme.color.action.danger.background;
  }
  return theme.color.text.warning;
};

export const StockProductDetailModal: React.FC<StockProductDetailModalProps> = ({
  visible,
  onClose,
  product,
  warehouseId,
  areaId,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [includeMovements, setIncludeMovements] = useState(true);
  const [isMovementsExpanded, setIsMovementsExpanded] = useState(false);

  const detailParams = useMemo(
    () => ({
      warehouseId,
      areaId,
      includeBatches: true,
      includeMovements,
      movementsLimit: 20,
      sortBatchesBy: 'receivedAt' as const,
      sortOrder: 'DESC' as const,
    }),
    [warehouseId, areaId, includeMovements]
  );

  const {
    data: detail,
    isLoading,
    isRefetching,
    refetch,
  } = useProductStockDetail(product?.productId || '', detailParams, visible && !!product?.productId);

  useEffect(() => {
    if (!visible || !product?.productId) return;

    console.group('[StockDetail] Abriendo detalle de stock');
    console.log('Producto seleccionado desde listado:', product);
    console.log('Product ID:', product.productId);
    console.log('Params enviados al endpoint:', detailParams);
    console.log('Estado query:', { isLoading, hasDetail: !!detail });
    console.groupEnd();
  }, [visible, product?.productId, detailParams, isLoading, detail, product]);

  useEffect(() => {
    if (!visible || !detail) return;

    console.group('[StockDetail] Respuesta stock-detail recibida');
    console.log('Respuesta completa:', detail);
    console.log('Producto:', detail.product);
    console.log('Resumen:', detail.stockSummary);
    console.log('Warehouses count:', detail.warehouses?.length || 0);

    detail.warehouses?.forEach((warehouse, warehouseIndex) => {
      console.group(`[StockDetail] Warehouse ${warehouseIndex + 1}`);
      console.log('Warehouse raw:', warehouse);
      console.log('Areas count:', warehouse.areas?.length || 0);

      warehouse.areas?.forEach((area, areaIndex) => {
        const rawArea = area as any;
        const batches = rawArea.batches;
        console.group(`[StockDetail] Area ${areaIndex + 1}`);
        console.log('Area raw:', rawArea);
        console.log('Area keys:', Object.keys(rawArea || {}));
        console.log('Batches raw:', batches);
        console.log('Batches isArray:', Array.isArray(batches));
        console.log('Batches count:', Array.isArray(batches) ? batches.length : 'no-array');

        if (Array.isArray(batches)) {
          batches.forEach((batch, batchIndex) => {
            console.log(`[StockDetail] Batch ${batchIndex + 1} keys:`, Object.keys(batch || {}));
            console.log(`[StockDetail] Batch ${batchIndex + 1} raw:`, batch);
          });
        }

        console.groupEnd();
      });

      console.groupEnd();
    });

    console.log('Movements:', detail.lastMovements);
    console.groupEnd();
  }, [visible, detail]);

  const currency = detail?.product.currency || 'PEN';
  const summary = detail?.stockSummary;
  const warehouses = detail?.warehouses || [];
  const movements = detail?.lastMovements || [];

  const renderBatch = (batch: ProductStockBatch) => (
    <View key={batch.batchId} style={styles.batchCard}>
      <View style={styles.batchHeader}>
        <View style={styles.flexOne}>
          <Text variant="labelMedium" color="primary" numberOfLines={1}>
            {batch.batchNumber || 'Lote sin número'}
          </Text>
          <Caption color="tertiary">Ingreso: {formatDate(batch.receivedAt)}</Caption>
        </View>
        <View style={[styles.statusPill, { backgroundColor: getBatchStatusColor(batch.status, theme) }]}>
          <Text variant="labelSmall" color={theme.color.text.inverse}>
            {batch.status}
          </Text>
        </View>
      </View>

      <View style={styles.metricGridCompact}>
        <View style={styles.metricCompact}>
          <Caption color="tertiary">Ingreso</Caption>
          <Text variant="numericSmall" color="primary">{formatQuantity(batch.initialStock)}</Text>
        </View>
        <View style={styles.metricCompact}>
          <Caption color="tertiary">Actual</Caption>
          <Text variant="numericSmall" color="primary">{formatQuantity(batch.currentStock)}</Text>
        </View>
        <View style={styles.metricCompact}>
          <Caption color="tertiary">Reservado</Caption>
          <Text variant="numericSmall" color={theme.color.state.warning.text}>{formatQuantity(batch.reservedStock)}</Text>
        </View>
        <View style={styles.metricCompact}>
          <Caption color="tertiary">Disponible</Caption>
          <Text variant="numericSmall" color={theme.color.state.success.text}>{formatQuantity(batch.availableStock)}</Text>
        </View>
        <View style={styles.metricCompact}>
          <Caption color="tertiary">Valor</Caption>
          <Text variant="numericSmall" color="primary">
            {formatMoney(batch.currentValueCents, batch.currency || currency)}
          </Text>
        </View>
      </View>

      <View style={styles.batchMeta}>
        <Caption color="tertiary">Vence: {formatDate(batch.expirationDate)}</Caption>
        {batch.unitCostCents !== undefined && (
          <Caption color="tertiary">Costo: {formatMoney(batch.unitCostCents, batch.currency || currency)}</Caption>
        )}
      </View>

      {(batch.supplier || batch.purchase) && <Divider spacing="small" />}

      {batch.supplier && (
        <Caption color="secondary" numberOfLines={2}>
          Proveedor: {batch.supplier.commercialName || batch.supplier.code || batch.supplier.supplierId}
        </Caption>
      )}
      {batch.purchase && (
        <Caption color="secondary" numberOfLines={2}>
          Compra: {batch.purchase.code || batch.purchase.guideNumber || batch.purchase.purchaseId}
        </Caption>
      )}
    </View>
  );

  const renderWarehouse = (warehouse: ProductStockDetailWarehouse) => (
    <Card key={warehouse.warehouseId} variant="outlined" padding="medium" style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.flexOne}>
          <Text variant="titleSmall" color="primary">{warehouse.warehouseName}</Text>
          <Caption color="tertiary">
            {[warehouse.warehouseCode, warehouse.siteCode].filter(Boolean).join(' • ') || 'Sin código'}
          </Caption>
        </View>
        <Text variant="numericMedium" color={theme.color.state.success.text}>
          {formatQuantity(warehouse.availableStock)}
        </Text>
      </View>

      <View style={styles.inlineMetrics}>
        <Caption color="tertiary">Total {formatQuantity(warehouse.totalStock)}</Caption>
        <Caption color="tertiary">Reservado {formatQuantity(warehouse.reservedStock)}</Caption>
        <Caption color="tertiary">Valor {formatMoney(warehouse.availableValueCents, currency)}</Caption>
      </View>

      {warehouse.areas.map((area) => (
        <View key={area.areaId} style={styles.areaBlock}>
          <View style={styles.areaHeader}>
            <View style={styles.flexOne}>
              <Text variant="labelMedium" color="primary">
                {area.areaName || area.areaCode || 'Área sin nombre'}
              </Text>
              {!!area.areaCode && <Caption color="tertiary">Código: {area.areaCode}</Caption>}
            </View>
            <Text variant="numericSmall" color={theme.color.state.info.text}>
              {formatQuantity(area.availableStock)} disp.
            </Text>
          </View>

          <View style={styles.inlineMetrics}>
            <Caption color="tertiary">Total {formatQuantity(area.totalStock)}</Caption>
            <Caption color="tertiary">Reservado {formatQuantity(area.reservedStock)}</Caption>
            <Caption color="tertiary">Valor {formatMoney(area.availableValueCents, currency)}</Caption>
          </View>

          {area.batches && area.batches.length > 0 ? (
            <View style={styles.batchesList}>{area.batches.map(renderBatch)}</View>
          ) : (
            <Caption color="tertiary" style={styles.noBatchesText}>
              No hay lotes registrados en esta área.
            </Caption>
          )}
        </View>
      ))}
    </Card>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.flexOne}>
              <Text variant="titleLarge" color="primary" numberOfLines={2}>
                {detail?.product.name || product?.name || 'Detalle de stock'}
              </Text>
              <Caption color="tertiary">
                SKU: {detail?.product.sku || product?.sku || 'Sin SKU'}
                {detail?.product.correlativeNumber ? ` • #${detail.product.correlativeNumber}` : ''}
              </Caption>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.color.icon.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={[styles.toggleButton, styles.toggleButtonActive]}>
              <Text variant="labelSmall" color={theme.color.text.inverse}>
                Lotes visibles
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggleButton, includeMovements && styles.toggleButtonActive]}
              onPress={() => {
                setIncludeMovements((value) => !value);
                setIsMovementsExpanded(false);
              }}
            >
              <Text variant="labelSmall" color={includeMovements ? theme.color.text.inverse : 'primary'}>
                Movimientos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()} disabled={isRefetching}>
              <Ionicons name="refresh" size={16} color={theme.color.state.info.text} />
              <Text variant="labelSmall" color={theme.color.state.info.text}>
                Actualizar
              </Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.color.brand.primary} />
              <Text variant="bodyMedium" color="secondary" style={styles.loadingText}>
                Cargando detalle de stock...
              </Text>
            </View>
          ) : !detail ? (
            <EmptyState
              emoji=""
              title="No se pudo cargar el detalle"
              description="Intenta actualizar o vuelve a abrir el producto."
              actionLabel="Actualizar"
              onAction={() => refetch()}
            />
          ) : (
            <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
              <Card variant="filled" padding="medium" style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <View style={styles.flexOne}>
                    <Text variant="titleSmall" color="primary">Resumen</Text>
                    <Caption color="tertiary">
                      {detail.product.categoryName || 'Sin categoría'} • {detail.product.status}
                    </Caption>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: summary?.lowStock ? theme.color.text.warning : theme.color.action.success.background }]}>
                    <Text variant="labelSmall" color={theme.color.text.inverse}>
                      {summary?.lowStock ? 'Stock bajo' : 'Stock OK'}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricGrid}>
                  <View style={styles.metricBox}>
                    <Caption color="tertiary">Total</Caption>
                    <Text variant="numericMedium" color="primary">{formatQuantity(summary?.totalStock)}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Caption color="tertiary">Reservado</Caption>
                    <Text variant="numericMedium" color={theme.color.state.warning.text}>{formatQuantity(summary?.reservedStock)}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Caption color="tertiary">Disponible</Caption>
                    <Text variant="numericMedium" color={theme.color.state.success.text}>{formatQuantity(summary?.availableStock)}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Caption color="tertiary">Valor</Caption>
                    <Text variant="numericMedium" color="primary">{formatMoney(summary?.availableValueCents, currency)}</Text>
                  </View>
                </View>

                <View style={styles.inlineMetrics}>
                  <Caption color="tertiary">Almacenes: {summary?.warehousesCount || 0}</Caption>
                  <Caption color="tertiary">Áreas: {summary?.areasCount || 0}</Caption>
                  <Caption color="tertiary">Lotes: {summary?.batchesCount || 0}</Caption>
                </View>
              </Card>

              {warehouses.length === 0 ? (
                <EmptyState
                  emoji=""
                  title="Sin ubicaciones"
                  description="No hay stock registrado para los filtros seleccionados."
                />
              ) : (
                warehouses.map(renderWarehouse)
              )}

              {includeMovements && (
                <Card variant="outlined" padding="medium" style={styles.sectionCard}>
                  <TouchableOpacity
                    style={styles.collapsibleHeader}
                    onPress={() => setIsMovementsExpanded((value) => !value)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.flexOne}>
                      <Text variant="titleSmall" color="primary">Últimos movimientos</Text>
                      <Caption color="tertiary">
                        {movements.length} movimiento(s) reciente(s)
                      </Caption>
                    </View>
                    <Ionicons
                      name={isMovementsExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.color.icon.muted}
                    />
                  </TouchableOpacity>

                  {isMovementsExpanded && (
                    <>
                      <Divider spacing="small" />
                      {movements.length === 0 ? (
                        <Caption color="tertiary">No hay movimientos recientes para este producto.</Caption>
                      ) : (
                        movements.map((movement) => (
                          <View key={movement.movementId} style={styles.movementRow}>
                            <View style={[styles.movementDot, { backgroundColor: getMovementColor(movement.movementType, theme) }]} />
                            <View style={styles.flexOne}>
                              <Text variant="labelMedium" color="primary">{movement.movementType}</Text>
                              <Caption color="tertiary">
                                {movement.warehouseName || 'Sin almacén'}
                                {movement.areaName ? ` / ${movement.areaName}` : ''}
                              </Caption>
                              {!!movement.notes && <Caption color="secondary">{movement.notes}</Caption>}
                            </View>
                            <View style={styles.movementRight}>
                              <Text variant="numericSmall" color="primary">{formatQuantity(movement.quantity)}</Text>
                              <Caption color="tertiary">{formatDate(movement.createdAt)}</Caption>
                            </View>
                          </View>
                        ))
                      )}
                    </>
                  )}
                </Card>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.color.background.subtle,
      borderTopLeftRadius: theme.radii['2xl'],
      borderTopRightRadius: theme.radii['2xl'],
      maxHeight: '92%',
      minHeight: '70%',
      overflow: 'hidden',
      ...theme.shadow.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: theme.space[5],
      paddingTop: theme.space[5],
      paddingBottom: theme.space[3],
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.surface.subtle,
      marginLeft: theme.space[3],
    },
    toggleRow: {
      flexDirection: 'row',
      gap: theme.space[2],
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[3],
      backgroundColor: theme.color.surface.base,
    },
    toggleButton: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    toggleButtonActive: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
      marginLeft: 'auto',
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[6],
    },
    loadingText: {
      marginTop: theme.space[3],
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: theme.space[4],
      paddingBottom: theme.space[8],
      gap: theme.space[3],
    },
    summaryCard: {
      marginBottom: theme.space[1],
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.space[3],
    },
    sectionCard: {
      marginBottom: theme.space[3],
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.space[2],
    },
    flexOne: {
      flex: 1,
    },
    statusPill: {
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.full,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
      marginBottom: theme.space[3],
    },
    metricBox: {
      flexBasis: '48%',
      flexGrow: 1,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    inlineMetrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[3],
    },
    areaBlock: {
      marginTop: theme.space[3],
      paddingTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    areaHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.space[1],
    },
    batchesList: {
      marginTop: theme.space[3],
      gap: theme.space[2],
    },
    batchCard: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    batchHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.space[2],
    },
    metricGridCompact: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    metricCompact: {
      flexBasis: '23%',
      flexGrow: 1,
    },
    batchMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[3],
      marginTop: theme.space[2],
    },
    noBatchesText: {
      marginTop: theme.space[2],
    },
    collapsibleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    movementRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    movementDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: theme.space[1],
      marginRight: theme.space[3],
    },
    movementRight: {
      alignItems: 'flex-end',
      marginLeft: theme.space[3],
    },
  });

export default StockProductDetailModal;
