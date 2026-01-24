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
import { priceProfilesApi } from '@/services/api/price-profiles';
import { ProductSalePrice, PriceProfile } from '@/types/price-profiles';
import { Product } from '@/services/api/products';

interface ProductPriceProfilesModalProps {
  visible: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess?: () => void;
}

interface PriceFormData {
  profileId: string;
  profileCode: string;
  profileName: string;
  presentationId: string | null;
  priceCents: number;
  isOverridden: boolean;
  calculatedPriceCents: number;
  factorToCost: number;
  displayValue: string; // Valor que se muestra en el input
}

export const ProductPriceProfilesModal: React.FC<ProductPriceProfilesModalProps> = ({
  visible,
  onClose,
  product,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<PriceProfile[]>([]);
  const [salePrices, setSalePrices] = useState<ProductSalePrice[]>([]);
  const [priceFormData, setPriceFormData] = useState<PriceFormData[]>([]);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && product) {
      // Siempre recargar datos cuando el modal se abre
      loadData();
    } else if (!visible) {
      // Limpiar datos cuando el modal se cierra
      setPriceFormData([]);
      setSalePrices([]);
    }
  }, [visible, product?.id]); // Usar product.id en lugar de product para detectar cambios

  const loadData = async () => {
    if (!product) {
      return;
    }

    try {
      setLoading(true);

      // Load price profiles and product sale prices in parallel
      const [profilesResponse, salePricesResponse] = await Promise.all([
        priceProfilesApi.getActivePriceProfiles(),
        priceProfilesApi.getProductSalePrices(product.id),
      ]);

      console.log('🔍 Sale prices response:', salePricesResponse);

      setProfiles(profilesResponse);

      // La API devuelve {productId, productSku, costCents, salePrices: [...]}
      const salePricesArray = salePricesResponse.salePrices || salePricesResponse.data || [];
      setSalePrices(salePricesArray);

      // Initialize form data
      const formData: PriceFormData[] = profilesResponse.map((profile) => {
        const existingPrice = salePricesArray.find(
          (sp: any) => sp.profileId === profile.id && sp.presentationId === null
        );

        const factorToCost =
          typeof profile.factorToCost === 'string'
            ? parseFloat(profile.factorToCost)
            : profile.factorToCost;

        const calculatedPriceCents = priceProfilesApi.calculatePrice(
          product.costCents || 0,
          factorToCost
        );

        const priceCents = existingPrice?.priceCents || calculatedPriceCents;

        return {
          profileId: profile.id,
          profileCode: profile.code,
          profileName: profile.name,
          presentationId: null,
          priceCents,
          isOverridden: existingPrice?.isOverridden || false,
          calculatedPriceCents,
          factorToCost,
          displayValue: (priceCents / 100).toFixed(2),
        };
      });

      setPriceFormData(formData);
    } catch (error: any) {
      console.error('Error loading price profiles:', error);
      Alert.alert('Error', error.message || 'No se pudieron cargar los perfiles de precio');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (profileId: string, value: string) => {
    // Permitir solo números y un punto decimal
    const sanitizedValue = value.replace(/[^0-9.]/g, '');

    // Evitar múltiples puntos decimales
    const parts = sanitizedValue.split('.');
    const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitizedValue;

    setPriceFormData((prev) =>
      prev.map((item) =>
        item.profileId === profileId
          ? {
              ...item,
              displayValue: finalValue,
              priceCents: finalValue ? Math.round(parseFloat(finalValue) * 100) : 0,
              isOverridden: true,
            }
          : item
      )
    );
  };

  const handleResetPrice = (profileId: string) => {
    setPriceFormData((prev) =>
      prev.map((item) =>
        item.profileId === profileId
          ? {
              ...item,
              priceCents: item.calculatedPriceCents,
              displayValue: (item.calculatedPriceCents / 100).toFixed(2),
              isOverridden: false,
            }
          : item
      )
    );
  };

  const handleSavePrice = async (priceData: PriceFormData) => {
    if (!product) {
      return;
    }

    try {
      setSaving(true);
      setEditingPriceId(priceData.profileId);

      await priceProfilesApi.updateSalePrice(product.id, {
        productId: product.id,
        presentationId: priceData.presentationId,
        profileId: priceData.profileId,
        priceCents: priceData.priceCents,
      });

      Alert.alert('Éxito', 'Precio actualizado correctamente');

      // Reload data to get updated prices
      await loadData();

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error saving price:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar el precio');
    } finally {
      setSaving(false);
      setEditingPriceId(null);
    }
  };

  const handleRecalculateAll = async () => {
    if (!product) {
      return;
    }

    Alert.alert(
      'Recalcular Precios',
      '¿Deseas recalcular todos los precios no modificados manualmente según los factores de los perfiles?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Recalcular',
          onPress: async () => {
            try {
              setSaving(true);
              const response = await priceProfilesApi.recalculateProductPrices(product.id);
              Alert.alert('Éxito', response.message || 'Precios recalculados correctamente');
              await loadData();
              if (onSuccess) {
                onSuccess();
              }
            } catch (error: any) {
              console.error('Error recalculating prices:', error);
              Alert.alert('Error', error.message || 'No se pudieron recalcular los precios');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (cents: number, currency: string = 'PEN'): string => {
    const amount = cents / 100;
    const symbol = currency === 'PEN' ? 'S/' : currency === 'USD' ? '$' : currency;
    return `${symbol} ${amount.toFixed(2)}`;
  };

  const calculateMargin = (costCents: number, priceCents: number): string => {
    if (costCents === 0) {
      return '0%';
    }
    const margin = ((priceCents - costCents) / costCents) * 100;
    return `${margin.toFixed(1)}%`;
  };

  if (!product) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerContent}>
              <Text style={styles.modalTitle}>Perfiles de Precio</Text>
              <Text style={styles.modalSubtitle}>{product.title}</Text>
              <Text style={styles.productCost}>
                Costo: {formatCurrency(product.costCents || 0, product.currency)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Cargando perfiles...</Text>
            </View>
          ) : (
            <>
              {/* Content */}
              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                {priceFormData.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No hay perfiles de precio activos</Text>
                  </View>
                ) : (
                  priceFormData.map((priceData) => (
                    <View key={priceData.profileId} style={styles.priceCard}>
                      {/* Profile Header */}
                      <View style={styles.profileHeader}>
                        <View style={styles.profileInfo}>
                          <Text style={styles.profileName}>{priceData.profileName}</Text>
                          <Text style={styles.profileCode}>{priceData.profileCode}</Text>
                        </View>
                        <View style={styles.factorBadge}>
                          <Text style={styles.factorText}>
                            Factor: {priceData.factorToCost.toFixed(2)}x
                          </Text>
                        </View>
                      </View>

                      {/* Price Input */}
                      <View style={styles.priceInputContainer}>
                        <View style={styles.inputWrapper}>
                          <Text style={styles.inputLabel}>Precio de Venta</Text>
                          <View style={styles.inputRow}>
                            <Text style={styles.currencySymbol}>
                              {product.currency === 'PEN' ? 'S/' : '$'}
                            </Text>
                            <TextInput
                              style={[
                                styles.priceInput,
                                priceData.isOverridden && styles.priceInputOverridden,
                              ]}
                              value={priceData.displayValue}
                              onChangeText={(value) =>
                                handlePriceChange(priceData.profileId, value)
                              }
                              keyboardType="decimal-pad"
                              editable={!saving}
                              selectTextOnFocus={true}
                            />
                          </View>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.actionButtons}>
                          {priceData.isOverridden && (
                            <TouchableOpacity
                              style={styles.resetButton}
                              onPress={() => handleResetPrice(priceData.profileId)}
                              disabled={saving}
                            >
                              <Text style={styles.resetButtonText}>↻ Restaurar</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[
                              styles.saveButton,
                              saving &&
                                editingPriceId === priceData.profileId &&
                                styles.saveButtonDisabled,
                            ]}
                            onPress={() => handleSavePrice(priceData)}
                            disabled={saving}
                          >
                            {saving && editingPriceId === priceData.profileId ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={styles.saveButtonText}>💾 Guardar</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Price Info */}
                      <View style={styles.priceInfo}>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Precio Calculado:</Text>
                          <Text style={styles.infoValue}>
                            {formatCurrency(priceData.calculatedPriceCents, product.currency)}
                          </Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Margen:</Text>
                          <Text style={[styles.infoValue, styles.marginValue]}>
                            {calculateMargin(product.costCents || 0, priceData.priceCents)}
                          </Text>
                        </View>
                        {priceData.isOverridden && (
                          <View style={styles.overriddenBadge}>
                            <Text style={styles.overriddenText}>✏️ Modificado manualmente</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* Footer Actions */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.recalculateButton}
                  onPress={handleRecalculateAll}
                  disabled={saving}
                >
                  <Text style={styles.recalculateButtonText}>🔄 Recalcular Todos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeFooterButton}
                  onPress={onClose}
                  disabled={saving}
                >
                  <Text style={styles.closeFooterButtonText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 6,
  },
  productCost: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  priceCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileCode: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  factorBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  factorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  priceInputContainer: {
    marginBottom: 12,
  },
  inputWrapper: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 10,
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  priceInputOverridden: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  priceInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  marginValue: {
    color: '#10B981',
  },
  overriddenBadge: {
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  overriddenText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 16,
  },
  recalculateButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  recalculateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeFooterButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
