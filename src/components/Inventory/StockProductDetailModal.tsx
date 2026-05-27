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
import { colors, spacing, borderRadius, shadows } from '@/design-system/tokens';
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

const getBatchStatusColor = (status?: string) => {
  switch (status) {
    case 'ACTIVE':
      return colors.success[600];
    case 'DEPLETED':
      return colors.neutral[500];
    case 'BLOCKED':
      return colors.danger[600];
    default:
      return colors.accent[600];
  }
};

const getMovementColor = (type?: string) => {
  if (!type) return colors.neutral[500];
  if (type.includes('IN') || type.includes('PURCHASE') || type.includes('RETURN')) {
    return colors.success[600];
  }
  if (type.includes('OUT') || type.includes('SALE')) {
    return colors.danger[600];
  }
  return colors.warning[600];
};

export const StockProductDetailModal: React.FC<StockProductDetailModalProps> = ({
  visible,
  onClose,
  product,
  warehouseId,
  areaId,
}) => {
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
        <View style={[styles.statusPill, { backgroundColor: getBatchStatusColor(batch.status) }]}>
          <Text variant="labelSmall" color={colors.text.inverse}>
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
          <Text variant="numericSmall" color={colors.warning[700]}>{formatQuantity(batch.reservedStock)}</Text>
        </View>
        <View style={styles.metricCompact}>
          <Caption color="tertiary">Disponible</Caption>
          <Text variant="numericSmall" color={colors.success[700]}>{formatQuantity(batch.availableStock)}</Text>
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
        <Text variant="numericMedium" color={colors.success[700]}>
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
            <Text variant="numericSmall" color={colors.accent[700]}>
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
              <Ionicons name="close" size={24} color={colors.icon.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={[styles.toggleButton, styles.toggleButtonActive]}>
              <Text variant="labelSmall" color={colors.text.inverse}>
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
              <Text variant="labelSmall" color={includeMovements ? colors.text.inverse : 'primary'}>
                Movimientos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()} disabled={isRefetching}>
              <Ionicons name="refresh" size={16} color={colors.accent[700]} />
              <Text variant="labelSmall" color={colors.accent[700]}>
                Actualizar
              </Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary[900]} />
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
                  <View style={[styles.statusPill, { backgroundColor: summary?.lowStock ? colors.warning[600] : colors.success[600] }]}>
                    <Text variant="labelSmall" color={colors.text.inverse}>
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
                    <Text variant="numericMedium" color={colors.warning[700]}>{formatQuantity(summary?.reservedStock)}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Caption color="tertiary">Disponible</Caption>
                    <Text variant="numericMedium" color={colors.success[700]}>{formatQuantity(summary?.availableStock)}</Text>
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
                      color={colors.icon.secondary}
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
                            <View style={[styles.movementDot, { backgroundColor: getMovementColor(movement.movementType) }]} />
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '92%',
    minHeight: '70%',
    overflow: 'hidden',
    ...shadows.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[3],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.secondary,
    marginLeft: spacing[3],
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.primary,
  },
  toggleButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  toggleButtonActive: {
    backgroundColor: colors.accent[600],
    borderColor: colors.accent[600],
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginLeft: 'auto',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  loadingText: {
    marginTop: spacing[3],
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  summaryCard: {
    marginBottom: spacing[1],
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  sectionCard: {
    marginBottom: spacing[3],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  flexOne: {
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  metricBox: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  inlineMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  areaBlock: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  areaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[1],
  },
  batchesList: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  batchCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  batchHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  metricGridCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  metricCompact: {
    flexBasis: '23%',
    flexGrow: 1,
  },
  batchMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  noBatchesText: {
    marginTop: spacing[2],
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  movementDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: spacing[1],
    marginRight: spacing[3],
  },
  movementRight: {
    alignItems: 'flex-end',
    marginLeft: spacing[3],
  },
});

export default StockProductDetailModal;
