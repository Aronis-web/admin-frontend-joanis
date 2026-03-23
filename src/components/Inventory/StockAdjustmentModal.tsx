import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
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
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ajustar Stock</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView style={styles.content}>
          {/* Product Info */}
          {productTitle && (
            <View style={styles.productInfo}>
              <Text style={styles.productTitle}>{productTitle}</Text>
              {productSku && <Text style={styles.productSku}>SKU: {productSku}</Text>}
            </View>
          )}

          {/* Form */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información del Ajuste</Text>

            {!productId && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  ID del Producto <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.productId}
                  onChangeText={(text) => setFormData({ ...formData, productId: text })}
                  placeholder="UUID del producto"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Almacén <Text style={styles.required}>*</Text>
              </Text>
              {loadingWarehouses ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text style={styles.loadingText}>Cargando almacenes...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.pickerContainer}>
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
                      <Text style={styles.pickerText}>
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
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.helpText}>
                    {warehouses.length > 0
                      ? `${warehouses.length} almacén(es) disponible(s)`
                      : 'No hay almacenes disponibles'}
                  </Text>
                </>
              )}
            </View>

            {formData.warehouseId && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Área <Text style={styles.required}>*</Text>
                </Text>
                {loadingAreas ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#3B82F6" />
                    <Text style={styles.loadingText}>Cargando áreas...</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.pickerContainer}>
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
                        <Text style={styles.pickerText}>
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
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.helpText}>
                      {availableAreas.length > 0
                        ? `${availableAreas.length} área(s) disponible(s)`
                        : 'Este almacén no tiene áreas'}
                    </Text>
                  </>
                )}
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Cantidad (Unidades Base) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={formData.deltaBase}
                onChangeText={(text) => setFormData({ ...formData, deltaBase: text })}
                placeholder="Ej: 100 (positivo) o -50 (negativo)"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />
              <Text style={styles.helpText}>
                Usa números positivos para aumentar stock y negativos para disminuir
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Razón del Ajuste <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.pickerContainer}>
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
                  <Text style={styles.pickerText}>{getReasonLabel(formData.reason)}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helpText}>
                {formData.reason === 'PURCHASE' && 'Entrada de mercadería por compra'}
                {formData.reason === 'SALE' && 'Salida de mercadería por venta'}
                {formData.reason === 'ADJUST' && 'Ajuste manual o inventario físico'}
                {formData.reason === 'TRANSFER' && 'Transferencia entre bodegas'}
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>ID de Operación (Opcional)</Text>
              <TextInput
                style={styles.input}
                value={formData.clientOperationId}
                onChangeText={(text) => setFormData({ ...formData, clientOperationId: text })}
                placeholder="COMPRA-2024-001"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.helpText}>Para idempotencia y trazabilidad de la operación</Text>
            </View>
          </View>

          {/* Summary */}
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Resumen</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Producto:</Text>
              <Text style={styles.summaryValue}>
                {productTitle || formData.productId || 'No especificado'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Almacén:</Text>
              <Text style={styles.summaryValue}>
                {formData.warehouseId
                  ? warehouses.find((w) => w.id === formData.warehouseId)?.name || 'Seleccionado'
                  : 'No seleccionado'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Área:</Text>
              <Text style={styles.summaryValue}>
                {formData.areaId
                  ? (() => {
                      const selected = availableAreas.find((a) => a.id === formData.areaId);
                      return selected
                        ? selected.name || selected.code || 'Seleccionada'
                        : 'Seleccionada';
                    })()
                  : 'No seleccionada'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ajuste:</Text>
              <Text
                style={[
                  styles.summaryValue,
                  styles.summaryAdjustment,
                  parseFloat(formData.deltaBase) > 0
                    ? styles.summaryPositive
                    : styles.summaryNegative,
                ]}
              >
                {formData.deltaBase
                  ? `${parseFloat(formData.deltaBase) > 0 ? '+' : ''}${formData.deltaBase} unidades`
                  : '0 unidades'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Razón:</Text>
              <Text style={styles.summaryValue}>{getReasonLabel(formData.reason)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => {
              onClose();
              resetForm();
            }}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Ajustando...' : 'Ajustar Stock'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#1E293B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  productInfo: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  productSku: {
    fontSize: 13,
    color: '#64748B',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1E293B',
  },
  pickerContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  picker: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1F2937',
  },
  pickerText: {
    fontSize: 15,
    color: '#1E293B',
  },
  helpText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  summarySection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  summaryAdjustment: {
    fontSize: 16,
  },
  summaryPositive: {
    color: '#10B981',
  },
  summaryNegative: {
    color: '#EF4444',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  submitButton: {
    backgroundColor: '#10B981',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
});

export default StockAdjustmentModal;
