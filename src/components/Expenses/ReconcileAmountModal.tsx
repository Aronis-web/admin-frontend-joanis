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
              <Ionicons name="close" size={24} color="#64748B" />
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
                <ActivityIndicator size="small" color="#FFFFFF" />
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  expenseInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  expenseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  estimatedAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  differenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  differenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  differenceValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  differencePositive: {
    color: '#10B981',
  },
  differenceNegative: {
    color: '#EF4444',
  },
  differenceZero: {
    color: '#64748B',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  confirmButton: {
    backgroundColor: '#6366F1',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ReconcileAmountModal;
