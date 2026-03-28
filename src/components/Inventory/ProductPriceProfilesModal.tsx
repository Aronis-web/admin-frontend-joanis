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
import { priceProfilesApi } from '@/services/api/price-profiles';
import { ProductSalePrice, PriceProfile } from '@/types/price-profiles';
import { Product } from '@/services/api/products';

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
  IconButton,
  EmptyState,
} from '@/design-system/components';

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
              <Title size="large">Perfiles de Precio</Title>
              <Body size="medium" color="secondary" style={styles.modalSubtitle}>
                {product.title}
              </Body>
              <Text variant="labelLarge" color={colors.accent[600]}>
                Costo: {formatCurrency(product.costCents || 0, product.currency)}
              </Text>
            </View>
            <IconButton
              icon="close"
              onPress={onClose}
              variant="ghost"
              size="medium"
            />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary[900]} />
              <Body color="secondary" style={styles.loadingText}>Cargando perfiles...</Body>
            </View>
          ) : (
            <>
              {/* Content */}
              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                {priceFormData.length === 0 ? (
                  <EmptyState
                    icon="pricetag-outline"
                    title="Sin perfiles de precio"
                    description="No hay perfiles de precio activos"
                  />
                ) : (
                  priceFormData.map((priceData) => (
                    <View key={priceData.profileId} style={styles.priceCard}>
                      {/* Profile Header */}
                      <View style={styles.profileHeader}>
                        <View style={styles.profileInfo}>
                          <Title size="small">{priceData.profileName}</Title>
                          <Caption color="tertiary" style={styles.profileCode}>
                            {priceData.profileCode}
                          </Caption>
                        </View>
                        <View style={styles.factorBadge}>
                          <Label size="medium" color={colors.accent[700]}>
                            Factor: {priceData.factorToCost.toFixed(2)}x
                          </Label>
                        </View>
                      </View>

                      {/* Price Input */}
                      <View style={styles.priceInputContainer}>
                        <View style={styles.inputWrapper}>
                          <Label size="medium" color="secondary" style={styles.inputLabel}>
                            Precio de Venta
                          </Label>
                          <View style={styles.inputRow}>
                            <Text variant="titleMedium" color="primary" style={styles.currencySymbol}>
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
                            <Button
                              title="↻ Restaurar"
                              variant="secondary"
                              size="small"
                              onPress={() => handleResetPrice(priceData.profileId)}
                              disabled={saving}
                              style={{ flex: 1 }}
                            />
                          )}
                          <Button
                            title="💾 Guardar"
                            variant="primary"
                            size="small"
                            onPress={() => handleSavePrice(priceData)}
                            disabled={saving}
                            loading={saving && editingPriceId === priceData.profileId}
                            style={{ flex: 1 }}
                          />
                        </View>
                      </View>

                      {/* Price Info */}
                      <View style={styles.priceInfo}>
                        <View style={styles.infoRow}>
                          <Body size="small" color="secondary">Precio Calculado:</Body>
                          <Text variant="labelLarge" color="primary">
                            {formatCurrency(priceData.calculatedPriceCents, product.currency)}
                          </Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Body size="small" color="secondary">Margen:</Body>
                          <Text variant="labelLarge" color={colors.success[600]}>
                            {calculateMargin(product.costCents || 0, priceData.priceCents)}
                          </Text>
                        </View>
                        {priceData.isOverridden && (
                          <View style={styles.overriddenBadge}>
                            <Caption color={colors.warning[800]}>✏️ Modificado manualmente</Caption>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* Footer Actions */}
              <View style={styles.modalFooter}>
                <Button
                  title="🔄 Recalcular Todos"
                  variant="outline"
                  onPress={handleRecalculateAll}
                  disabled={saving}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Cerrar"
                  variant="primary"
                  onPress={onClose}
                  disabled={saving}
                  style={{ flex: 1 }}
                />
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
    backgroundColor: colors.background.secondary,
    paddingTop: spacing[5],
    paddingBottom: spacing[5],
    paddingHorizontal: spacing[4],
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    ...shadows.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerContent: {
    flex: 1,
  },
  modalSubtitle: {
    marginTop: spacing[1],
    marginBottom: spacing[1],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[10],
  },
  loadingText: {
    marginTop: spacing[3],
  },
  modalContent: {
    flex: 1,
    padding: spacing[6],
  },
  priceCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  profileInfo: {
    flex: 1,
  },
  profileCode: {
    fontFamily: 'monospace',
    marginTop: spacing[1],
  },
  factorBadge: {
    backgroundColor: colors.accent[100],
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  priceInputContainer: {
    marginBottom: spacing[3],
  },
  inputWrapper: {
    marginBottom: spacing[3],
  },
  inputLabel: {
    marginBottom: spacing[2],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    marginRight: spacing[2.5],
  },
  priceInput: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    padding: spacing[3.5],
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  priceInputOverridden: {
    borderColor: colors.warning[500],
    borderWidth: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  priceInfo: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1.5],
  },
  overriddenBadge: {
    marginTop: spacing[2],
    backgroundColor: colors.warning[50],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: spacing[6],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing[4],
  },
});
