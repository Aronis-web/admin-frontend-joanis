import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { expensesService } from '@/services/api';
import { PaymentMethod, PaymentMethodLabels } from '@/types/expenses';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';

interface CreateExpensePaymentScreenProps {
  navigation: any;
  route: {
    params: {
      expenseId: string;
    };
  };
}

export const CreateExpensePaymentScreen: React.FC<CreateExpensePaymentScreenProps> = ({
  navigation,
  route,
}) => {
  const { expenseId } = route.params;
  const [loading, setLoading] = useState(false);
  const [expense, setExpense] = useState<any>(null);

  // Form fields
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');

  // Date picker states
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);

  const loadExpense = useCallback(async () => {
    try {
      const data = await expensesService.getExpense(expenseId);
      console.log('💰 Raw expense data from API:', {
        amountCents: data.amountCents,
        totalPaidCents: data.totalPaidCents,
        paidAmountCents: data.paidAmountCents,
        remainingAmountCents: data.remainingAmountCents,
        actualAmountCents: data.actualAmountCents,
        estimatedAmountCents: data.estimatedAmountCents,
      });

      setExpense(data);

      // Use actualAmountCents if available, otherwise use amountCents
      const totalAmount = data.actualAmountCents || data.amountCents || 0;
      const paidAmount = data.totalPaidCents || data.paidAmountCents || 0;
      const remainingAmount = totalAmount - paidAmount;

      console.log('💰 Calculated amounts:', {
        totalAmount,
        paidAmount,
        remainingAmount,
        totalAmountReal: totalAmount / 100,
        paidAmountReal: paidAmount / 100,
        remainingAmountReal: remainingAmount / 100,
      });

      if (remainingAmount > 0) {
        setAmount((remainingAmount / 100).toFixed(2));
      }
    } catch (error: any) {
      console.error('Error loading expense:', error);
      Alert.alert('Error', 'No se pudo cargar el gasto');
      navigation.goBack();
    }
  }, [expenseId]);

  React.useEffect(() => {
    loadExpense();
  }, [loadExpense]);

  const handleSave = async () => {
    if (!amount) {
      Alert.alert('Error', 'El monto es requerido');
      return;
    }

    if (!paymentDate) {
      Alert.alert('Error', 'La fecha de pago es requerida');
      return;
    }

    if (paymentMethod !== PaymentMethod.CASH && !bankName) {
      Alert.alert('Error', 'El nombre del banco es requerido');
      return;
    }

    const amountCents = Math.round(parseFloat(amount) * 100);

    if (isNaN(amountCents) || amountCents <= 0) {
      Alert.alert('Error', 'El monto debe ser mayor a 0');
      return;
    }

    setLoading(true);
    try {
      const data = {
        amountCents,
        currency: expense?.currency || 'PEN',
        paymentMethod,
        bankName: paymentMethod !== PaymentMethod.CASH ? bankName : undefined,
        accountNumber: paymentMethod !== PaymentMethod.CASH ? accountNumber : undefined,
        transactionReference: transactionReference.trim() || undefined,
        paymentDate,
        notes: notes.trim() || undefined,
      };

      await expensesService.createPayment(expenseId, data);
      Alert.alert('Éxito', 'Pago registrado correctamente');
      navigation.goBack();
    } catch (error: any) {
      console.error('Error creating payment:', error);
      Alert.alert('Error', error.message || 'No se pudo registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  const renderPicker = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: Array<{ label: string; value: string }>
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.pickerContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.pickerOption,
              value === option.value && styles.pickerOptionSelected,
            ]}
            onPress={() => onChange(option.value)}
          >
            <Text
              style={[
                styles.pickerOptionText,
                value === option.value && styles.pickerOptionTextSelected,
              ]}
            >
              {option.label}
            </Text>
            {value === option.value && (
              <Ionicons name="checkmark-circle" size={20} color="#6366F1" />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
    keyboardType: any = 'default',
    icon?: string
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        {icon && <Ionicons name={icon as any} size={20} color="#64748B" style={styles.inputIcon} />}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );

  if (!expense) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando gasto...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrar Pago</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.container}>
        {/* Expense Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Gasto</Text>
          <Text style={styles.expenseName}>{expense.name}</Text>
          <View style={styles.expenseInfo}>
            <Text style={styles.expenseInfoLabel}>Código:</Text>
            <Text style={styles.expenseInfoValue}>{expense.code}</Text>
          </View>

          {/* Show actual amount (monto real) if available */}
          <View style={styles.expenseInfo}>
            <Text style={styles.expenseInfoLabel}>
              {expense.actualAmountCents ? 'Monto Real:' : 'Monto Total:'}
            </Text>
            <Text style={styles.expenseInfoValue}>
              {expense.currency || 'PEN'} {((expense.actualAmountCents || expense.amountCents || 0) / 100).toFixed(2)}
            </Text>
          </View>

          {/* Show estimated amount if actual amount exists */}
          {expense.actualAmountCents && expense.estimatedAmountCents && (
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseInfoLabel}>Monto Estimado:</Text>
              <Text style={[styles.expenseInfoValue, styles.estimatedAmount]}>
                {expense.currency || 'PEN'} {(expense.estimatedAmountCents / 100).toFixed(2)}
              </Text>
            </View>
          )}

          {(expense.totalPaidCents || expense.paidAmountCents) ? (
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseInfoLabel}>Pagado:</Text>
              <Text style={styles.expenseInfoValue}>
                {expense.currency || 'PEN'} {((expense.totalPaidCents || expense.paidAmountCents || 0) / 100).toFixed(2)}
              </Text>
            </View>
          ) : null}
          <View style={styles.expenseInfo}>
            <Text style={styles.expenseInfoLabel}>Pendiente:</Text>
            <Text style={[styles.expenseInfoValue, styles.pendingAmount]}>
              {expense.currency || 'PEN'} {(((expense.actualAmountCents || expense.amountCents || 0) - (expense.totalPaidCents || expense.paidAmountCents || 0)) / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Payment Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Información del Pago</Text>

          {renderInput(
            `Monto a Pagar (${expense.currency || 'PEN'})`,
            amount,
            setAmount,
            '0.00',
            'decimal-pad',
            'cash'
          )}

          {renderPicker(
            'Método de Pago',
            paymentMethod,
            (value) => setPaymentMethod(value as PaymentMethod),
            Object.entries(PaymentMethodLabels).map(([key, label]) => ({
              label,
              value: key,
            }))
          )}

          {paymentMethod !== PaymentMethod.CASH && (
            <>
              {renderInput(
                'Nombre del Banco',
                bankName,
                setBankName,
                'Ej: BCP, BBVA, Interbank',
                'default',
                'business'
              )}
              {renderInput(
                'Número de Cuenta',
                accountNumber,
                setAccountNumber,
                'Ej: 193-12345678-0-00',
                'default',
                'card'
              )}
            </>
          )}

          {renderInput(
            'Referencia de Transacción (opcional)',
            transactionReference,
            setTransactionReference,
            'Ej: OP-2024-001',
            'default',
            'document'
          )}

          <DatePickerButton
            label="Fecha de Pago"
            value={paymentDate}
            onPress={() => setShowPaymentDatePicker(true)}
            placeholder="Seleccionar fecha de pago"
          />

          {renderInput(
            'Notas (opcional)',
            notes,
            setNotes,
            'Observaciones adicionales',
            'default',
            'document-text'
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Registrar Pago</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Date Pickers */}
        <DatePicker
          visible={showPaymentDatePicker}
          date={paymentDate ? new Date(paymentDate) : new Date()}
          onConfirm={(date) => {
            setPaymentDate(date.toISOString().split('T')[0]);
            setShowPaymentDatePicker(false);
          }}
          onCancel={() => setShowPaymentDatePicker(false)}
          title="Fecha de Pago"
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  expenseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  expenseInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  expenseInfoLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  expenseInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  pendingAmount: {
    color: '#DC2626',
    fontSize: 15,
  },
  estimatedAmount: {
    color: '#92400E',
    fontSize: 13,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
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
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    paddingVertical: 12,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flex: 1,
    minWidth: '45%',
  },
  pickerOptionSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  pickerOptionTextSelected: {
    color: '#6366F1',
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#FEE2E2',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  saveButton: {
    backgroundColor: '#6366F1',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
