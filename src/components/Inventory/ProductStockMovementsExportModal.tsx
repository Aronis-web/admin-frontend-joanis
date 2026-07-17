import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useExportProductStockMovements,
  useWarehouses,
  useWarehouseAreas,
} from '@/hooks/api/useStock';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Button, Caption, Chip, Divider, Text } from '@/design-system/components';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { saveAndShareExcel } from '@/utils/fileDownload';
import Alert from '@/utils/alert';
import { MovementType } from '@/types/transfers';

interface ProductStockMovementsExportModalProps {
  visible: boolean;
  onClose: () => void;
  productId: string | null;
  productName?: string;
  productSku?: string;
  /** Warehouse por defecto para pre-filtrar. */
  initialWarehouseId?: string;
}

const MOVEMENT_TYPES: { value: MovementType; label: string }[] = [
  { value: MovementType.TRANSFER_OUT, label: 'Traslado salida' },
  { value: MovementType.TRANSFER_IN, label: 'Traslado entrada' },
  { value: MovementType.TRANSFER_INTERNAL, label: 'Traslado interno' },
  { value: MovementType.ADJUSTMENT, label: 'Ajuste' },
  { value: MovementType.PURCHASE, label: 'Compra' },
  { value: MovementType.SALE, label: 'Venta' },
  { value: MovementType.RETURN, label: 'Devolución' },
  { value: MovementType.TRANSFER_DISCREPANCY, label: 'Discrepancia' },
  { value: MovementType.INITIAL_STOCK, label: 'Stock inicial' },
];

const toIsoDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const firstDayOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

export const ProductStockMovementsExportModal: React.FC<ProductStockMovementsExportModalProps> = ({
  visible,
  onClose,
  productId,
  productName,
  productSku,
  initialWarehouseId,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const selectedCompany = useTenantStore((s) => s.selectedCompany);
  const selectedSite = useTenantStore((s) => s.selectedSite);
  const authCompany = useAuthStore((s) => s.currentCompany);
  const authSite = useAuthStore((s) => s.currentSite);
  const companyId = selectedCompany?.id || authCompany?.id;
  const siteId = selectedSite?.id || authSite?.id;

  const [useCustomRange, setUseCustomRange] = useState(false);
  const [fromDate, setFromDate] = useState<string>(toIsoDate(firstDayOfMonth()));
  const [toDate, setToDate] = useState<string>(toIsoDate(new Date()));
  // 'ALL' = todos los almacenes de la sede actual.
  const [warehouseFilter, setWarehouseFilter] = useState<string | 'ALL'>(
    initialWarehouseId || 'ALL'
  );
  const [areaFilter, setAreaFilter] = useState<string | undefined>(undefined);
  const [movementTypeFilter, setMovementTypeFilter] = useState<MovementType | undefined>(undefined);

  const [fromPickerOpen, setFromPickerOpen] = useState(false);
  const [toPickerOpen, setToPickerOpen] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setUseCustomRange(false);
    setFromDate(toIsoDate(firstDayOfMonth()));
    setToDate(toIsoDate(new Date()));
    setWarehouseFilter(initialWarehouseId || 'ALL');
    setAreaFilter(undefined);
    setMovementTypeFilter(undefined);
  }, [visible, initialWarehouseId]);

  // Solo almacenes de la sede seleccionada en el login.
  const { data: siteWarehouses } = useWarehouses(companyId, siteId);

  // Asegurar que el warehouseFilter pertenezca a la sede actual.
  React.useEffect(() => {
    if (!siteWarehouses || siteWarehouses.length === 0) return;
    if (warehouseFilter === 'ALL') return;
    const belongs = siteWarehouses.some((w) => w.id === warehouseFilter);
    if (!belongs) setWarehouseFilter('ALL');
  }, [warehouseFilter, siteWarehouses]);

  // Áreas del warehouse seleccionado (solo si es uno específico).
  const specificWarehouseId = warehouseFilter !== 'ALL' ? warehouseFilter : '';
  const { data: warehouseAreas } = useWarehouseAreas(specificWarehouseId, !!specificWarehouseId);

  // Reset area si cambia el warehouse.
  React.useEffect(() => {
    setAreaFilter(undefined);
  }, [warehouseFilter]);

  const exportMutation = useExportProductStockMovements();

  const fileName = useMemo(() => {
    const skuTag = productSku ? `_${productSku}` : '';
    const rangeTag = useCustomRange ? `_${fromDate}_${toDate}` : '_all';
    return `stock-movements${rangeTag}${skuTag}.xlsx`;
  }, [fromDate, toDate, productSku, useCustomRange]);

  const hasSiteWarehouses = !!siteWarehouses && siteWarehouses.length > 0;
  const canDownload = !!productId && hasSiteWarehouses && !exportMutation.isPending;

  const handleDownload = async () => {
    if (!productId) {
      Alert.alert('Producto requerido', 'No se puede exportar sin un producto.');
      return;
    }
    if (warehouseFilter === 'ALL' && !hasSiteWarehouses) {
      Alert.alert('Sin almacenes', 'La sede actual no tiene almacenes disponibles.');
      return;
    }

    try {
      const effectiveWarehouseId =
        warehouseFilter === 'ALL' ? (siteWarehouses || []).map((w) => w.id) : warehouseFilter;

      const params = {
        warehouseId: effectiveWarehouseId,
        warehouseAreaId: areaFilter,
        movementType: movementTypeFilter,
        dateFrom: useCustomRange ? fromDate || undefined : undefined,
        dateTo: useCustomRange ? toDate || undefined : undefined,
      };

      const blob = await exportMutation.mutateAsync({ productId, params });

      await saveAndShareExcel(blob, fileName, 'Descargar reporte de movimientos');
    } catch (e: any) {
      const message = e?.message || 'No se pudo generar el reporte.';
      Alert.alert('Error', message);
    }
  };

  const parsedFrom = fromDate ? new Date(`${fromDate}T12:00:00`) : new Date();
  const parsedTo = toDate ? new Date(`${toDate}T12:00:00`) : new Date();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.flexOne}>
              <Text variant="titleLarge" color="primary" numberOfLines={2}>
                Reporte de Movimientos
              </Text>
              <Caption color="tertiary" numberOfLines={2}>
                {productName
                  ? `${productName}${productSku ? ` · SKU: ${productSku}` : ''}`
                  : 'Historial de movimientos en Excel'}
              </Caption>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.color.icon.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            <View style={styles.section}>
              <View style={styles.switchRow}>
                <View style={styles.flexOne}>
                  <Text variant="labelMedium" color="primary">
                    Rango definido
                  </Text>
                  <Caption color="tertiary">
                    {useCustomRange
                      ? 'Se enviarán las fechas seleccionadas.'
                      : 'Por defecto: todo el historial.'}
                  </Caption>
                </View>
                <Switch
                  value={useCustomRange}
                  onValueChange={setUseCustomRange}
                  trackColor={{
                    false: theme.color.surface.subtle,
                    true: theme.color.brand.accent,
                  }}
                  thumbColor={theme.color.surface.base}
                />
              </View>

              {useCustomRange && (
                <View style={styles.dateRow}>
                  <View style={styles.flexOne}>
                    <DatePickerButton
                      label="Desde"
                      value={fromDate}
                      onPress={() => setFromPickerOpen(true)}
                    />
                  </View>
                  <View style={styles.flexOne}>
                    <DatePickerButton
                      label="Hasta"
                      value={toDate}
                      onPress={() => setToPickerOpen(true)}
                    />
                  </View>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Caption color="tertiary" style={styles.sectionLabel}>
                Almacén {selectedSite?.name ? `· Sede: ${selectedSite.name}` : ''}
              </Caption>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                <Chip
                  label={`Todos${hasSiteWarehouses ? ` (${siteWarehouses!.length})` : ''}`}
                  variant={warehouseFilter === 'ALL' ? 'filled' : 'outlined'}
                  onPress={() => setWarehouseFilter('ALL')}
                  size="small"
                />
                {(siteWarehouses || []).map((w) => (
                  <Chip
                    key={w.id}
                    label={w.name}
                    variant={warehouseFilter === w.id ? 'filled' : 'outlined'}
                    onPress={() => setWarehouseFilter(w.id)}
                    size="small"
                  />
                ))}
              </ScrollView>
              {siteWarehouses && siteWarehouses.length === 0 && (
                <Caption color="tertiary">No hay almacenes en esta sede.</Caption>
              )}
            </View>

            {warehouseFilter !== 'ALL' && warehouseAreas && warehouseAreas.length > 0 && (
              <View style={styles.section}>
                <Caption color="tertiary" style={styles.sectionLabel}>
                  Área (opcional)
                </Caption>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                >
                  <Chip
                    label="Todas"
                    variant={!areaFilter ? 'filled' : 'outlined'}
                    onPress={() => setAreaFilter(undefined)}
                    size="small"
                  />
                  {warehouseAreas.map((a) => (
                    <Chip
                      key={a.id}
                      label={a.name || a.code}
                      variant={areaFilter === a.id ? 'filled' : 'outlined'}
                      onPress={() => setAreaFilter(a.id)}
                      size="small"
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.section}>
              <Caption color="tertiary" style={styles.sectionLabel}>
                Tipo de movimiento
              </Caption>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                <Chip
                  label="Todos"
                  variant={!movementTypeFilter ? 'filled' : 'outlined'}
                  onPress={() => setMovementTypeFilter(undefined)}
                  size="small"
                />
                {MOVEMENT_TYPES.map((m) => (
                  <Chip
                    key={m.value}
                    label={m.label}
                    variant={movementTypeFilter === m.value ? 'filled' : 'outlined'}
                    onPress={() => setMovementTypeFilter(m.value)}
                    size="small"
                  />
                ))}
              </ScrollView>
            </View>

            <Divider spacing="small" />

            <Button
              title={exportMutation.isPending ? 'Generando…' : 'Descargar Excel'}
              variant="primary"
              size="medium"
              fullWidth
              loading={exportMutation.isPending}
              disabled={!canDownload}
              onPress={handleDownload}
              leftIcon="download-outline"
            />
          </ScrollView>
        </View>
      </View>

      <DatePicker
        visible={fromPickerOpen}
        date={parsedFrom}
        onCancel={() => setFromPickerOpen(false)}
        onConfirm={(d) => {
          setFromDate(toIsoDate(d));
          setFromPickerOpen(false);
        }}
        title="Desde"
        maximumDate={parsedTo}
      />
      <DatePicker
        visible={toPickerOpen}
        date={parsedTo}
        onCancel={() => setToPickerOpen(false)}
        onConfirm={(d) => {
          setToDate(toIsoDate(d));
          setToPickerOpen(false);
        }}
        title="Hasta"
        minimumDate={parsedFrom}
      />
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
      minHeight: '60%',
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
    flexOne: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: theme.space[4],
      paddingBottom: theme.space[8],
      gap: theme.space[4],
    },
    section: {
      gap: theme.space[2],
    },
    sectionLabel: {
      marginBottom: theme.space[1],
    },
    chipsRow: {
      flexDirection: 'row',
      gap: theme.space[2],
      paddingVertical: theme.space[1],
      flexWrap: 'wrap',
    },
    dateRow: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginTop: theme.space[1],
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
  });

export default ProductStockMovementsExportModal;
