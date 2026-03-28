import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import {
  BalanceOperation,
  OperationType,
  PaymentMethod,
  getOperationTypeLabel,
  getPaymentMethodLabel,
  UpdateBalanceOperationRequest,
} from '@/types/balances';
import { balancesApi } from '@/services/api';
import { getTodayString } from '@/utils/dateHelpers';

interface EditBalanceOperationModalProps {
  visible: boolean;
  operation: BalanceOperation | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditBalanceOperationModal: React.FC<EditBalanceOperationModalProps> = ({
  visible,
  operation,
  onClose,
  onSuccess,
}) => {
  const [operationType, setOperationType] = useState<OperationType>(OperationType.DISTRIBUTED);
  const [amountCents, setAmountCents] = useState('');
  const [currency, setCurrency] = useState('PEN');
  const [operationDate, setOperationDate] = useState(getTodayString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && operation) {
      // Initialize form with operation data
      setOperationType(operation.operationType);
      setAmountCents((operation.amountCents / 100).toString());
      setCurrency(operation.currency || 'PEN');
      setOperationDate(operation.operationDate.split('T')[0]);
      setPaymentMethod(operation.paymentMethod || '');
      setDescription(operation.description || '');
      setReference(operation.reference || '');
      setNotes(operation.notes || '');
    }
  }, [visible, operation]);

  const handleSave = async () => {
    if (!operation) {
      return;
    }

    // Validation
    if (!amountCents || parseFloat(amountCents) <= 0) {
      Alert.alert('Error', 'Por favor ingresa un monto válido');
      return;
    }

    try {
      setSaving(true);

      const updateData: UpdateBalanceOperationRequest = {
        operationType,
        amountCents: Math.round(parseFloat(amountCents) * 100),
        currency,
        operationDate,
        description: description.trim() || undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      await balancesApi.updateBalanceOperation(operation.balanceId, operation.id, updateData);

      Alert.alert('Éxito', 'Operación actualizada correctamente');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating operation:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar la operación');
    } finally {
      setSaving(false);
    }
  };

  if (!operation) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar Operación</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Operation Type */}
            <View style={styles.section}>
              <Text style={styles.label}>Tipo de Operación *</Text>
              <View style={styles.operationTypeContainer}>
                {Object.values(OperationType).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.operationTypeButton,
                      operationType === type && styles.operationTypeButtonActive,
                    ]}
                    onPress={() => setOperationType(type)}
                  >
                    <Text
                      style={[
                        styles.operationTypeButtonText,
                        operationType === type && styles.operationTypeButtonTextActive,
                      ]}
                    >
                      {getOperationTypeLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Amount */}
            <View style={styles.section}>
              <Text style={styles.label}>Monto *</Text>
              <View style={styles.amountContainer}>
                <TextInput
                  style={styles.amountInput}
                  value={amountCents}
                  onChangeText={setAmountCents}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.currencyText}>{currency}</Text>
              </View>
            </View>

            {/* Operation Date */}
            <View style={styles.section}>
              <Text style={styles.label}>Fecha de Operación *</Text>
              <DatePickerButton date={operationDate} onPress={() => setShowDatePicker(true)} />
            </View>

            {/* Payment Method */}
            <View style={styles.section}>
              <Text style={styles.label}>Método de Pago</Text>
              <View style={styles.paymentMethodContainer}>
                <TouchableOpacity
                  style={[
                    styles.paymentMethodButton,
                    paymentMethod === '' && styles.paymentMethodButtonActive,
                  ]}
                  onPress={() => setPaymentMethod('')}
                >
                  <Text
                    style={[
                      styles.paymentMethodButtonText,
                      paymentMethod === '' && styles.paymentMethodButtonTextActive,
                    ]}
                  >
                    Ninguno
                  </Text>
                </TouchableOpacity>
                {Object.values(PaymentMethod).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.paymentMethodButton,
                      paymentMethod === method && styles.paymentMethodButtonActive,
                    ]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text
                      style={[
                        styles.paymentMethodButtonText,
                        paymentMethod === method && styles.paymentMethodButtonTextActive,
                      ]}
                    >
                      {getPaymentMethodLabel(method)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={styles.textArea}
                value={description}
                onChangeText={setDescription}
                placeholder="Descripción de la operación"
                multiline
                numberOfLines={3}
                maxLength={100}
              />
            </View>

            {/* Reference */}
            <View style={styles.section}>
              <Text style={styles.label}>Referencia</Text>
              <TextInput
                style={styles.input}
                value={reference}
                onChangeText={setReference}
                placeholder="Número de referencia o documento"
                maxLength={100}
              />
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.label}>Notas</Text>
              <TextInput
                style={styles.textArea}
                value={notes}
                onChangeText={setNotes}
                placeholder="Notas adicionales"
                multiline
                numberOfLines={3}
                maxLength={100}
              />
            </View>
          </ScrollView>

          {/* Date Picker Modal */}
          <DatePicker
            visible={showDatePicker}
            date={operationDate}
            onConfirm={(date) => {
              setOperationDate(date);
              setShowDatePicker(false);
            }}
            onCancel={() => setShowDatePicker(false)}
            title="Fecha de Operación"
          />

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Guardar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? spacing[5] : 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  closeButton: {
    padding: spacing[1],
  },
  section: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[2],
  },
  operationTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  operationTypeButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  operationTypeButtonActive: {
    backgroundColor: colors.accent[500],
    borderColor: colors.accent[500],
  },
  operationTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  operationTypeButtonTextActive: {
    color: colors.neutral[0],
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[4],
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[800],
    paddingVertical: spacing[3],
  },
  currencyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[500],
    marginLeft: spacing[2],
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    gap: spacing[3],
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.neutral[800],
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  paymentMethodButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  paymentMethodButtonActive: {
    backgroundColor: colors.accent[50],
    borderColor: colors.accent[500],
  },
  paymentMethodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  paymentMethodButtonTextActive: {
    color: colors.accent[500],
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.neutral[800],
  },
  textArea: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.neutral[800],
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing[3],
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.accent[500],
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});
