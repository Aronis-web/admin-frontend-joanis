import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { inventoryApi, AdjustStockDto, StockAdjustmentReason } from '@/services/api/inventory';
import { warehousesApi, warehouseAreasApi } from '@/services/api/warehouses';
import { Warehouse, WarehouseArea } from '@/types/warehouses';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  shadows,
} from '@/design-system/tokens';
import {
  Text,
  Title,
  Body,
  Caption,
  Label,
  Button,
  Card,
  IconButton,
  Badge,
} from '@/design-system/components';

interface StockAdjustmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productId?: string;
  productTitle?: string;
  productSku?: string;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  visible,
  onClose,
  onSuccess,
  productId,
  productTitle,
  productSku,
}) => {
  const { currentSite, currentCompany } = useAuthStore();
  const { selectedSite, selectedCompany } = useTenantStore();

  // Get effective site and company (prefer tenant store, fallback to auth store)
  const effectiveSite = selectedSite || currentSite;
  const effectiveCompany = selectedCompany || currentCompany;

  const [loading, setLoading] = useState(false);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [availableAreas, setAvailableAreas] = useState<WarehouseArea[]>([]);
  const [formData, setFormData] = useState({
    productId: '',
    warehouseId: '',
    areaId: '',
    deltaBase: '',
    reason: 'ADJUST' as StockAdjustmentReason,
    clientOperationId: '',
  });

  useEffect(() => {
    if (visible) {
      loadWarehouses();
      if (productId) {
        setFormData((prev) => ({ ...prev, productId }));
      }
    }
  }, [visible, productId]);

  const loadWarehouses = async () => {
    try {
      setLoadingWarehouses(true);
      console.log('🔄 Loading warehouses for stock adjustment...');
      console.log('📋 Company ID:', effectiveCompany?.id);
      console.log('📋 Site ID:', effectiveSite?.id);

      // Use warehousesApi with proper parameters
      const warehousesData = await warehousesApi.getWarehouses(
        effectiveCompany?.id,
        effectiveSite?.id
      );

      console.log('✅ Warehouses received:', warehousesData?.length || 0);

      // Filter active warehouses
      const filteredWarehouses = (warehousesData || []).filter((w) => w.isActive !== false);

      setWarehouses(filteredWarehouses);
      console.log('🏢 Available warehouses loaded:', filteredWarehouses.length);
    } catch (error: any) {
      console.error('❌ Error loading warehouses:', error);
      Alert.alert('Error', 'No se pudieron cargar los almacenes');
      setWarehouses([]);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const loadAreasForWarehouse = async (warehouseId: string) => {
    if (!warehouseId) {
      console.log('⚠️ No warehouse ID provided, clearing areas');
      setAvailableAreas([]);
      return;
    }

    try {
      setLoadingAreas(true);
      console.log('🔄 Loading areas for warehouse:', warehouseId);

      // Find the warehouse in the warehouses array
      const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);

      if (selectedWarehouse && selectedWarehouse.areas) {
        console.log('✅ Warehouse found in cache:', selectedWarehouse.name);
        console.log('📦 Warehouse has areas:', selectedWarehouse.areas.length);

        const areas = selectedWarehouse.areas || [];
        setAvailableAreas(areas);
        console.log('📍 Available areas loaded from warehouse:', areas.length);
      } else {
        console.log('⚠️ Warehouse not found in cache or no areas, fetching from API...');

        // Fallback: fetch from API if warehouse not in cache
        const areas = await warehouseAreasApi.getWarehouseAreas(warehouseId);

        console.log('✅ Areas received from API:', areas?.length || 0);
        setAvailableAreas(areas || []);
        console.log('📍 Available areas loaded from API:', areas?.length || 0);
      }
    } catch (error: any) {
      console.error('❌ Error loading areas:', error);
      setAvailableAreas([]);
    } finally {
      setLoadingAreas(false);
    }
  };

  // Load areas when warehouse changes
  useEffect(() => {
    if (formData.warehouseId) {
      loadAreasForWarehouse(formData.warehouseId);
    } else {
      setAvailableAreas([]);
      setFormData((prev) => ({ ...prev, areaId: '' }));
    }
  }, [formData.warehouseId]);

  const resetForm = () => {
    setFormData({
      productId: productId || '',
      warehouseId: '',
      areaId: '',
      deltaBase: '',
      reason: 'ADJUST',
      clientOperationId: '',
    });
  };

  const validateForm = (): boolean => {
    if (!formData.productId.trim()) {
      Alert.alert('Error', 'El ID del producto es obligatorio');
      return false;
    }

    if (!formData.warehouseId.trim()) {
      Alert.alert('Error', 'Debe seleccionar un almacén');
      return false;
    }

    if (!formData.areaId.trim()) {
      Alert.alert('Error', 'Debe seleccionar un área del almacén');
      return false;
    }

    if (!formData.deltaBase || parseFloat(formData.deltaBase) === 0) {
      Alert.alert('Error', 'La cantidad debe ser diferente de 0');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const adjustmentData: AdjustStockDto = {
        productId: formData.productId,
        warehouseId: formData.warehouseId,
        areaId: formData.areaId || undefined,
        deltaBase: parseFloat(formData.deltaBase),
        reason: formData.reason,
        clientOperationId: formData.clientOperationId || undefined,
      };

      await inventoryApi.adjustStock(adjustmentData);

      Alert.alert(
        'Éxito',
        `Stock ajustado correctamente: ${parseFloat(formData.deltaBase) > 0 ? '+' : ''}${formData.deltaBase} unidades`
      );

      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Error adjusting stock:', error);
      Alert.alert('Error', error.message || 'No se pudo ajustar el stock');
    } finally {
      setLoading(false);
    }
  };

  const getReasonLabel = (reason: StockAdjustmentReason): string => {
    switch (reason) {
      case 'PURCHASE':
        return 'Compra a Proveedor';
      case 'SALE':
        return 'Venta a Cliente';
      case 'ADJUST':
        return 'Ajuste Manual/Inventario';
      case 'TRANSFER':
        return 'Transferencia entre Bodegas';
      default:
        return reason;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="close"
            onPress={onClose}
            variant="ghost"
            size="medium"
          />
          <Title size="medium">Ajustar Stock</Title>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Product Info */}
          {productTitle && (
            <View style={styles.productInfo}>
              <Title size="small">{productTitle}</Title>
              {productSku && <Caption color="secondary">SKU: {productSku}</Caption>}
            </View>
          )}

          {/* Form */}
          <Card variant="outlined" padding="medium" style={styles.section}>
            <Title size="small" style={styles.sectionTitle}>Información del Ajuste</Title>

            {!productId && (
              <View style={styles.formGroup}>
                <Label size="medium" color="secondary">
                  ID del Producto <Text variant="labelMedium" color={colors.danger[500]}>*</Text>
                </Label>
                <TextInput
                  style={styles.input}
                  value={formData.productId}
                  onChangeText={(text) => setFormData({ ...formData, productId: text })}
                  placeholder="UUID del producto"
                  placeholderTextColor={colors.text.placeholder}
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Label size="medium" color="secondary">
                Almacén <Text variant="labelMedium" color={colors.danger[500]}>*</Text>
              </Label>
              {loadingWarehouses ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary[900]} />
                  <Body size="small" color="secondary">Cargando almacenes...</Body>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => {
                      if (warehouses.length === 0) {
                        Alert.alert(
                          'Sin almacenes',
                          'No hay almacenes disponibles. Por favor, crea uno primero.'
                        );
                        return;
                      }

                      const options = warehouses.map((w) => ({
                        text: `${w.name} (${w.code})`,
                        onPress: () =>
                          setFormData({ ...formData, warehouseId: w.id, areaId: '' }),
                      }));

                      Alert.alert('Seleccionar Almacén', '', [
                        ...options,
                        { text: 'Cancelar', style: 'cancel' },
                      ]);
                    }}
                  >
                    <Body size="medium" color={formData.warehouseId ? 'primary' : 'tertiary'}>
                      {formData.warehouseId
                        ? (() => {
                            const selected = warehouses.find(
                              (w) => w.id === formData.warehouseId
                            );
                            return selected
                              ? `${selected.name} (${selected.code})`
                              : 'Seleccionar almacén...';
                          })()
                        : 'Seleccionar almacén...'}
                    </Body>
                  </TouchableOpacity>
                  <Caption color="tertiary" style={styles.helpText}>
                    {warehouses.length > 0
                      ? `${warehouses.length} almacén(es) disponible(s)`
                      : 'No hay almacenes disponibles'}
                  </Caption>
                </>
              )}
            </View>

            {formData.warehouseId && (
              <View style={styles.formGroup}>
                <Label size="medium" color="secondary">
                  Área <Text variant="labelMedium" color={colors.danger[500]}>*</Text>
                </Label>
                {loadingAreas ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary[900]} />
                    <Body size="small" color="secondary">Cargando áreas...</Body>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.picker}
                      onPress={() => {
                        if (availableAreas.length === 0) {
                          Alert.alert('Sin áreas', 'Este almacén no tiene áreas configuradas.');
                          return;
                        }

                        const options = availableAreas.map((a) => ({
                          text: a.name || a.code || `Área ${a.id.substring(0, 8)}`,
                          onPress: () => setFormData({ ...formData, areaId: a.id }),
                        }));

                        Alert.alert('Seleccionar Área', '', [
                          ...options,
                          { text: 'Cancelar', style: 'cancel' },
                        ]);
                      }}
                    >
                      <Body size="medium" color={formData.areaId ? 'primary' : 'tertiary'}>
                        {formData.areaId
                          ? (() => {
                              const selected = availableAreas.find(
                                (a) => a.id === formData.areaId
                              );
                              return selected
                                ? selected.name ||
                                    selected.code ||
                                    `Área ${selected.id.substring(0, 8)}`
                                : 'Seleccionar área...';
                            })()
                          : 'Seleccionar área...'}
                      </Body>
                    </TouchableOpacity>
                    <Caption color="tertiary" style={styles.helpText}>
                      {availableAreas.length > 0
                        ? `${availableAreas.length} área(s) disponible(s)`
                        : 'Este almacén no tiene áreas'}
                    </Caption>
                  </>
                )}
              </View>
            )}

            <View style={styles.formGroup}>
              <Label size="medium" color="secondary">
                Cantidad (Unidades Base) <Text variant="labelMedium" color={colors.danger[500]}>*</Text>
              </Label>
              <TextInput
                style={styles.input}
                value={formData.deltaBase}
                onChangeText={(text) => setFormData({ ...formData, deltaBase: text })}
                placeholder="Ej: 100 (positivo) o -50 (negativo)"
                placeholderTextColor={colors.text.placeholder}
                keyboardType="numeric"
              />
              <Caption color="tertiary" style={styles.helpText}>
                Usa números positivos para aumentar stock y negativos para disminuir
              </Caption>
            </View>

            <View style={styles.formGroup}>
              <Label size="medium" color="secondary">
                Razón del Ajuste <Text variant="labelMedium" color={colors.danger[500]}>*</Text>
              </Label>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => {
                  const reasons: StockAdjustmentReason[] = [
                    'PURCHASE',
                    'SALE',
                    'ADJUST',
                    'TRANSFER',
                  ];

                  const options = reasons.map((reason) => ({
                    text: getReasonLabel(reason),
                    onPress: () => setFormData({ ...formData, reason }),
                  }));

                  Alert.alert('Seleccionar Razón', '', [
                    ...options,
                    { text: 'Cancelar', style: 'cancel' },
                  ]);
                }}
              >
                <Body size="medium" color="primary">{getReasonLabel(formData.reason)}</Body>
              </TouchableOpacity>
              <Caption color="tertiary" style={styles.helpText}>
                {formData.reason === 'PURCHASE' && 'Entrada de mercadería por compra'}
                {formData.reason === 'SALE' && 'Salida de mercadería por venta'}
                {formData.reason === 'ADJUST' && 'Ajuste manual o inventario físico'}
                {formData.reason === 'TRANSFER' && 'Transferencia entre bodegas'}
              </Caption>
            </View>

            <View style={styles.formGroup}>
              <Label size="medium" color="secondary">ID de Operación (Opcional)</Label>
              <TextInput
                style={styles.input}
                value={formData.clientOperationId}
                onChangeText={(text) => setFormData({ ...formData, clientOperationId: text })}
                placeholder="COMPRA-2024-001"
                placeholderTextColor={colors.text.placeholder}
              />
              <Caption color="tertiary" style={styles.helpText}>
                Para idempotencia y trazabilidad de la operación
              </Caption>
            </View>
          </Card>

          {/* Summary */}
          <Card variant="filled" padding="medium" style={styles.summarySection}>
            <Title size="small" style={styles.sectionTitle}>Resumen</Title>
            <View style={styles.summaryRow}>
              <Body size="small" color="secondary">Producto:</Body>
              <Body size="small" color="primary" style={styles.summaryValue}>
                {productTitle || formData.productId || 'No especificado'}
              </Body>
            </View>
            <View style={styles.summaryRow}>
              <Body size="small" color="secondary">Almacén:</Body>
              <Body size="small" color="primary" style={styles.summaryValue}>
                {formData.warehouseId
                  ? warehouses.find((w) => w.id === formData.warehouseId)?.name || 'Seleccionado'
                  : 'No seleccionado'}
              </Body>
            </View>
            <View style={styles.summaryRow}>
              <Body size="small" color="secondary">Área:</Body>
              <Body size="small" color="primary" style={styles.summaryValue}>
                {formData.areaId
                  ? (() => {
                      const selected = availableAreas.find((a) => a.id === formData.areaId);
                      return selected
                        ? selected.name || selected.code || 'Seleccionada'
                        : 'Seleccionada';
                    })()
                  : 'No seleccionada'}
              </Body>
            </View>
            <View style={styles.summaryRow}>
              <Body size="small" color="secondary">Ajuste:</Body>
              <Text
                variant="titleSmall"
                color={parseFloat(formData.deltaBase) > 0 ? colors.success[600] : colors.danger[600]}
                style={styles.summaryValue}
              >
                {formData.deltaBase
                  ? `${parseFloat(formData.deltaBase) > 0 ? '+' : ''}${formData.deltaBase} unidades`
                  : '0 unidades'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Body size="small" color="secondary">Razón:</Body>
              <Body size="small" color="primary" style={styles.summaryValue}>
                {getReasonLabel(formData.reason)}
              </Body>
            </View>
          </Card>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Cancelar"
            variant="secondary"
            onPress={() => {
              onClose();
              resetForm();
            }}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button
            title={loading ? 'Ajustando...' : 'Ajustar Stock'}
            variant="success"
            onPress={handleSubmit}
            disabled={loading}
            loading={loading}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  content: {
    flex: 1,
    padding: spacing[4],
  },
  productInfo: {
    backgroundColor: colors.accent[50],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.accent[200],
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionTitle: {
    marginBottom: spacing[4],
  },
  formGroup: {
    marginBottom: spacing[4],
  },
  input: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    fontSize: 15,
    color: colors.text.primary,
    marginTop: spacing[2],
  },
  picker: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    marginTop: spacing[2],
  },
  helpText: {
    marginTop: spacing[1],
  },
  summarySection: {
    marginBottom: spacing[4],
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    gap: spacing[2],
    marginTop: spacing[2],
  },
});

export default StockAdjustmentModal;
