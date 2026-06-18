import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { expensesService } from '@/services/api';
import { ReconcileAmountRequest } from '@/types/expenses';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface ReconcileAmountModalProps {
  visible: boolean;
  onClose: () => void;
  expenseId: string;
  expenseName: string;
  estimatedAmount: number;
  onSuccess?: () => void;
}

export const ReconcileAmountModal: React.FC<ReconcileAmountModalProps> = ({
  visible,
  onClose,
  expenseId,
  expenseName,
  estimatedAmount,
  onSuccess,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [actualAmount, setActualAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReconcile = async () => {
    if (!actualAmount.trim()) {
      Alert.alert('Error', 'El monto real es requerido');
      return;
    }

    const amountValue = parseFloat(actualAmount);

    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Error', 'El monto debe ser mayor a 0');
      return;
    }

    setLoading(true);
    try {
      const data: ReconcileAmountRequest = {
        actualAmountCents: Math.round(amountValue * 100),
        notes: notes.trim() || undefined,
      };

      await expensesService.reconcileAmount(expenseId, data);
      Alert.alert('Éxito', 'Monto real conciliado correctamente', [
        {
          text: 'OK',
          onPress: () => {
            onClose();
            onSuccess?.();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error reconciling amount:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo conciliar el monto');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Actualizar Monto Real</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.color.icon.subtle} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Expense Info */}
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseName}>{expenseName}</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Monto Estimado:</Text>
                <Text style={styles.estimatedAmount}>{formatAmount(estimatedAmount)}</Text>
              </View>
            </View>

            {/* Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Monto Real de Factura</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencySymbol}>S/</Text>
                <TextInput
                  style={styles.input}
                  value={actualAmount}
                  onChangeText={setActualAmount}
                  placeholder="0.00"
                  placeholderTextColor={theme.color.text.placeholder}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Notes */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Notas (opcional)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Ej: Factura recibida con descuento"
                placeholderTextColor={theme.color.text.placeholder}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Difference Info */}
            {actualAmount && !isNaN(parseFloat(actualAmount)) && (
              <View style={styles.differenceContainer}>
                <Text style={styles.differenceLabel}>Diferencia:</Text>
                <Text
                  style={[
                    styles.differenceValue,
                    parseFloat(actualAmount) > estimatedAmount
                      ? styles.differencePositive
                      : parseFloat(actualAmount) < estimatedAmount
                        ? styles.differenceNegative
                        : styles.differenceZero,
                  ]}
                >
                  {formatAmount(parseFloat(actualAmount) - estimatedAmount)}
                </Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton, loading && styles.buttonDisabled]}
              onPress={handleReconcile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={theme.color.text.inverse} />
              ) : (
                <Text style={styles.confirmButtonText}>Conciliar</Text>
              )}
            </TouchableOpacity>
          </View>
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
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[5],
    },
    container: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      width: '100%',
      maxWidth: 500,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.default,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    closeButton: {
      padding: theme.space[1],
    },
    content: {
      padding: theme.space[5],
    },
    expenseInfo: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[5],
    },
    expenseName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    amountRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    amountLabel: {
      fontSize: 14,
      color: theme.color.text.subtle,
    },
    estimatedAmount: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    inputContainer: {
      marginBottom: theme.space[4],
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[2],
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      paddingHorizontal: theme.space[3],
    },
    currencySymbol: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.subtle,
      marginRight: theme.space[2],
    },
    input: {
      flex: 1,
      paddingVertical: theme.space[3],
      fontSize: 16,
      color: theme.color.text.heading,
    },
    notesInput: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      fontSize: 14,
      color: theme.color.text.heading,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    differenceContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      marginTop: theme.space[2],
    },
    differenceLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.subtle,
    },
    differenceValue: {
      fontSize: 16,
      fontWeight: '700',
    },
    differencePositive: {
      color: theme.color.icon.success,
    },
    differenceNegative: {
      color: theme.color.text.danger,
    },
    differenceZero: {
      color: theme.color.text.subtle,
    },
    footer: {
      flexDirection: 'row',
      gap: theme.space[3],
      padding: theme.space[5],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
    },
    button: {
      flex: 1,
      paddingVertical: theme.space[3.5],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    cancelButton: {
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.subtle,
    },
    confirmButton: {
      backgroundColor: theme.color.brand.accent,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
  });

export default ReconcileAmountModal;
