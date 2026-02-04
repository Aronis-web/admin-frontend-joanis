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
import {
  BalanceOperation,
  OperationType,
  PaymentMethod,
  getOperationTypeLabel,
  getPaymentMethodLabel,
  UpdateBalanceOperationRequest,
} from '@/types/balances';
import { balancesApi } from '@/services/api';

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
  const [operationDate, setOperationDate] = useState(new Date().toISOString().split('T')[0]);
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    padding: 4,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  operationTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  operationTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  operationTypeButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  operationTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  operationTypeButtonTextActive: {
    color: '#FFFFFF',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    paddingVertical: 12,
  },
  currencyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1E293B',
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentMethodButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentMethodButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  paymentMethodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  paymentMethodButtonTextActive: {
    color: '#6366F1',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
