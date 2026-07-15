import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { InventoryEntrySourceType } from '@/services/api/inventory';
import { useExportInventoryEntries, useWarehouses } from '@/hooks/api/useStock';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Button, Caption, Chip, Divider, Input, Text } from '@/design-system/components';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { saveAndShareExcel } from '@/utils/fileDownload';
import Alert from '@/utils/alert';

interface ProductInventoryEntriesModalProps {
  visible: boolean;
  onClose: () => void;
  productId: string | null;
  productName?: string;
  productSku?: string;
  /** Warehouse por defecto para pre-filtrar. */
  initialWarehouseId?: string;
}

const SOURCE_TYPES: { value: InventoryEntrySourceType; label: string }[] = [
  { value: 'PURCHASE', label: 'Compra' },
  { value: 'MANUAL_ADJUSTMENT', label: 'Ajuste manual' },
  { value: 'BULK_STOCK_UPDATE', label: 'Carga masiva' },
  { value: 'TRANSFER', label: 'Traslado' },
  { value: 'RETURN', label: 'Devolución' },
];

/** Fecha marcador "desde siempre". */
const EPOCH_FROM = '1900-01-01';

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

export const ProductInventoryEntriesModal: React.FC<ProductInventoryEntriesModalProps> = ({
  visible,
  onClose,
  productId,
  productName,
  productSku,
  initialWarehouseId,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  // Tenant context — necesario para filtrar warehouses por sede actual.
  const selectedCompany = useTenantStore((s) => s.selectedCompany);
  const selectedSite = useTenantStore((s) => s.selectedSite);
  const authCompany = useAuthStore((s) => s.currentCompany);
  const authSite = useAuthStore((s) => s.currentSite);
  const companyId = selectedCompany?.id || authCompany?.id;
  const siteId = selectedSite?.id || authSite?.id;

  const [useCustomRange, setUseCustomRange] = useState(false);
  const [fromDate, setFromDate] = useState<string>(toIsoDate(firstDayOfMonth()));
  const [toDate, setToDate] = useState<string>(toIsoDate(new Date()));
  // undefined = ninguno seleccionado aún; 'ALL' = todos los almacenes de la sede actual.
  const [warehouseFilter, setWarehouseFilter] = useState<string | 'ALL' | undefined>(
    initialWarehouseId
  );
  const [sourceFilter, setSourceFilter] = useState<InventoryEntrySourceType | undefined>(undefined);
  const [supplierId, setSupplierId] = useState<string>('');

  const [fromPickerOpen, setFromPickerOpen] = useState(false);
  const [toPickerOpen, setToPickerOpen] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setUseCustomRange(false);
    setFromDate(toIsoDate(firstDayOfMonth()));
    setToDate(toIsoDate(new Date()));
    setWarehouseFilter(initialWarehouseId);
    setSourceFilter(undefined);
    setSupplierId('');
  }, [visible, initialWarehouseId]);

  // Solo almacenes de la sede seleccionada en el login.
  const { data: siteWarehouses } = useWarehouses(companyId, siteId);

  // Asegura que el almacén filtrado pertenezca a la sede actual;
  // si no hay o no pertenece, cae a "ALL" (todos los de la sede).
  React.useEffect(() => {
    if (!siteWarehouses || siteWarehouses.length === 0) return;
    if (warehouseFilter === 'ALL') return;
    const belongs = warehouseFilter ? siteWarehouses.some((w) => w.id === warehouseFilter) : false;
    if (!belongs) setWarehouseFilter('ALL');
  }, [warehouseFilter, siteWarehouses]);

  const exportMutation = useExportInventoryEntries();

  const fileName = useMemo(() => {
    const skuTag = productSku ? `_${productSku}` : '';
    const rangeTag = useCustomRange ? `_${fromDate}_${toDate}` : '_all';
    return `entries${rangeTag}${skuTag}.xlsx`;
  }, [fromDate, toDate, productSku, useCustomRange]);

  const hasSiteWarehouses = !!siteWarehouses && siteWarehouses.length > 0;
  const canDownload =
    !!productId && !!warehouseFilter && hasSiteWarehouses && !exportMutation.isPending;

  const handleDownload = async () => {
    if (!productId) {
      Alert.alert('Producto requerido', 'No se puede exportar sin un producto.');
      return;
    }
    if (!warehouseFilter) {
      Alert.alert('Almacén requerido', 'Seleccioná un almacén de la sede actual.');
      return;
    }
    if (warehouseFilter === 'ALL' && !hasSiteWarehouses) {
      Alert.alert('Sin almacenes', 'La sede actual no tiene almacenes disponibles.');
      return;
    }

    try {
      const effectiveFrom = useCustomRange ? fromDate || undefined : EPOCH_FROM;
      const effectiveTo = useCustomRange ? toDate || undefined : toIsoDate(new Date());

      const effectiveWarehouseId =
        warehouseFilter === 'ALL' ? (siteWarehouses || []).map((w) => w.id) : warehouseFilter;

      const blob = await exportMutation.mutateAsync({
        from: effectiveFrom,
        to: effectiveTo,
        warehouseId: effectiveWarehouseId,
        productId,
        sourceType: sourceFilter,
        supplierId: supplierId.trim() || undefined,
      });

      await saveAndShareExcel(blob, fileName, 'Descargar reporte de ingresos');
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
                Exportar ingresos
              </Text>
              <Caption color="tertiary" numberOfLines={2}>
                {productName
                  ? `${productName}${productSku ? ` · SKU: ${productSku}` : ''}`
                  : 'Reporte de entries en Excel'}
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
                      : 'Por defecto: desde siempre hasta hoy.'}
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

            <View style={styles.section}>
              <Caption color="tertiary" style={styles.sectionLabel}>
                Origen
              </Caption>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                <Chip
                  label="Todos"
                  variant={!sourceFilter ? 'filled' : 'outlined'}
                  onPress={() => setSourceFilter(undefined)}
                  size="small"
                />
                {SOURCE_TYPES.map((s) => (
                  <Chip
                    key={s.value}
                    label={s.label}
                    variant={sourceFilter === s.value ? 'filled' : 'outlined'}
                    onPress={() => setSourceFilter(s.value)}
                    size="small"
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Caption color="tertiary" style={styles.sectionLabel}>
                Proveedor (opcional)
              </Caption>
              <Input
                placeholder="UUID del proveedor"
                value={supplierId}
                onChangeText={setSupplierId}
                autoCapitalize="none"
                autoCorrect={false}
              />
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

export default ProductInventoryEntriesModal;
