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
import { colors, spacing, borderRadius } from '@/design-system/tokens';

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
              <Ionicons name="close" size={24} color={colors.neutral[500]} />
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
                  placeholderTextColor="#94A3B8"
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
                placeholderTextColor="#94A3B8"
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
                <ActivityIndicator size="small" color={colors.neutral[0]} />
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  container: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  closeButton: {
    padding: spacing[1],
  },
  content: {
    padding: spacing[5],
  },
  expenseInfo: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[5],
  },
  expenseName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[2],
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  estimatedAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent[500],
  },
  inputContainer: {
    marginBottom: spacing[4],
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: spacing[2],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
    marginRight: spacing[2],
  },
  input: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.neutral[800],
  },
  notesInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: 14,
    color: colors.neutral[800],
    minHeight: 80,
    textAlignVertical: 'top',
  },
  differenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginTop: spacing[2],
  },
  differenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  differenceValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  differencePositive: {
    color: colors.success[500],
  },
  differenceNegative: {
    color: colors.danger[500],
  },
  differenceZero: {
    color: colors.neutral[500],
  },
  footer: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  button: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  confirmButton: {
    backgroundColor: colors.accent[500],
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});

export default ReconcileAmountModal;
