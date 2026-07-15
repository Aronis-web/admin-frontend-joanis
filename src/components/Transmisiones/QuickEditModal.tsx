import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useThemedStyles, useTheme } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { transmisionesApi } from '@/services/api';
import {
  TransmisionProduct,
  formatCentsToCurrency,
  currencyToCents,
  calculateProfitMargin,
} from '@/types/transmisiones';
import Alert from '@/utils/alert';

interface QuickEditModalProps {
  visible: boolean;
  transmisionId: string;
  product: TransmisionProduct;
  onClose: () => void;
  onSaved: () => void;
}

export const QuickEditModal: React.FC<QuickEditModalProps> = ({
  visible,
  transmisionId,
  product,
  onClose,
  onSaved,
}) => {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const placeholderColor = theme.color.text.placeholder;
  const [costInput, setCostInput] = useState('');
  const [salePriceInput, setSalePriceInput] = useState('');
  const [saving, setSaving] = useState(false);

  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  useEffect(() => {
    if (visible && product) {
      // Convert cents to currency for display
      setCostInput((product.costCents / 100).toFixed(2));
      setSalePriceInput((product.salePriceCents / 100).toFixed(2));
    }
  }, [visible, product]);

  const handleSave = async () => {
    // Validate inputs
    const cost = parseFloat(costInput);
    const salePrice = parseFloat(salePriceInput);

    if (isNaN(cost) || cost < 0) {
      Alert.alert('Error', 'El costo debe ser un número válido');
      return;
    }

    if (isNaN(salePrice) || salePrice < 0) {
      Alert.alert('Error', 'El precio de venta debe ser un número válido');
      return;
    }

    if (salePrice < cost) {
      Alert.alert('Advertencia', 'El precio de venta es menor que el costo. ¿Deseas continuar?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: () => performSave(cost, salePrice) },
      ]);
      return;
    }

    await performSave(cost, salePrice);
  };

  const performSave = async (cost: number, salePrice: number) => {
    try {
      setSaving(true);

      const costCents = currencyToCents(cost);
      const salePriceCents = currencyToCents(salePrice);

      await transmisionesApi.quickEditPrices(transmisionId, product.id, {
        costCents,
        salePriceCents,
      });

      Alert.alert('Éxito', 'Precios actualizados correctamente');
      onSaved();
    } catch (error: any) {
      console.error('Error updating prices:', error);
      Alert.alert('Error', 'No se pudieron actualizar los precios');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!saving) {
      onClose();
    }
  };

  const calculateCurrentMargin = () => {
    const cost = parseFloat(costInput);
    const salePrice = parseFloat(salePriceInput);

    if (isNaN(cost) || isNaN(salePrice) || cost === 0) {
      return 0;
    }

    return calculateProfitMargin(currencyToCents(cost), currencyToCents(salePrice));
  };

  const margin = calculateCurrentMargin();

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleCancel} />

        <View style={[styles.modal, isTablet && styles.modalTablet]}>
          <View style={styles.header}>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>
              Edición Rápida de Precios
            </Text>
            <TouchableOpacity onPress={handleCancel} disabled={saving}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.product?.title}</Text>
            <Text style={styles.productSku}>SKU: {product.product?.sku}</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Costo (S/)</Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={costInput}
                onChangeText={setCostInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={placeholderColor}
                editable={!saving}
                selectTextOnFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Precio de Venta (S/)
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={salePriceInput}
                onChangeText={setSalePriceInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={placeholderColor}
                editable={!saving}
                selectTextOnFocus
              />
            </View>

            <View style={styles.marginContainer}>
              <Text style={styles.marginLabel}>Margen de Ganancia:</Text>
              <Text
                style={[
                  styles.marginValue,
                  margin > 0 ? styles.marginPositive : styles.marginNegative,
                ]}
              >
                {margin.toFixed(2)}%
              </Text>
            </View>

            <View style={styles.comparisonContainer}>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>Costo Actual</Text>
                <Text style={styles.comparisonValue}>
                  {formatCentsToCurrency(product.costCents)}
                </Text>
              </View>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>Precio Actual</Text>
                <Text style={styles.comparisonValue}>
                  {formatCentsToCurrency(product.salePriceCents)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={theme.color.text.inverse} size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.color.overlay.medium,
    },
    modal: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      width: '90%',
      maxWidth: 500,
      padding: 24,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalTablet: {
      maxWidth: 600,
      padding: 32,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    titleTablet: {
      fontSize: 24,
    },
    closeButton: {
      fontSize: 24,
      color: theme.color.text.muted,
      padding: 4,
    },
    productInfo: {
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      marginBottom: 20,
    },
    productName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    productSku: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    content: {
      marginBottom: 20,
    },
    inputGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
      marginBottom: theme.space[2],
    },
    labelTablet: {
      fontSize: 16,
    },
    input: {
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      fontSize: 18,
      color: theme.color.text.heading,
      fontWeight: '600',
    },
    inputTablet: {
      padding: 16,
      fontSize: 20,
    },
    marginContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.color.surface.muted,
      padding: theme.space[4],
      borderRadius: theme.radii.lg,
      marginBottom: theme.space[4],
    },
    marginLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    marginValue: {
      fontSize: 24,
      fontWeight: '700',
    },
    marginPositive: {
      color: theme.color.text.success,
    },
    marginNegative: {
      color: theme.color.text.danger,
    },
    comparisonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: theme.space[4],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    comparisonItem: {
      flex: 1,
      alignItems: 'center',
    },
    comparisonLabel: {
      fontSize: 12,
      color: theme.color.text.placeholder,
      marginBottom: theme.space[1],
    },
    comparisonValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.lg,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    saveButton: {
      backgroundColor: theme.color.brand.primary,
    },
    saveButtonDisabled: {
      backgroundColor: theme.color.text.placeholder,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
  });
