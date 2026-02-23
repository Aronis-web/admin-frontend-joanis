import React, { useState, useEffect } from 'react';
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { salesApi } from '@/services/api/sales';
import { companiesApi } from '@/services/api/companies';
import { useAuthStore } from '@/store/auth';
import { PaymentMethod } from '@/types/companies';
import logger from '@/utils/logger';

type RegisterSalePaymentRouteProp = RouteProp<
  { RegisterSalePayment: { saleId: string } },
  'RegisterSalePayment'
>;

export const RegisterSalePaymentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RegisterSalePaymentRouteProp>();
  const { saleId } = route.params;
  const { currentCompany } = useAuthStore();

  // State
  const [loading, setLoading] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [amountCents, setAmountCents] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [notes, setNotes] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Load payment methods
  useEffect(() => {
    if (currentCompany?.id) {
      loadPaymentMethods();
    }
  }, [currentCompany?.id]);

  const loadPaymentMethods = async () => {
    if (!currentCompany?.id) return;

    setLoadingPaymentMethods(true);
    try {
      const data = await companiesApi.getPaymentMethods(currentCompany.id);
      setPaymentMethods(data);

      // Auto-select first payment method
      if (data.length > 0) {
        setSelectedPaymentMethod(data[0]);
      }
    } catch (error) {
      logger.error('Error cargando métodos de pago:', error);
      Alert.alert('Error', 'No se pudieron cargar los métodos de pago');
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const handleRegisterPayment = async () => {
    // Validaciones
    const amount = parseFloat(amountCents);
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Debe ingresar un monto válido');
      return;
    }

    if (!selectedPaymentMethod) {
      Alert.alert('Error', 'Debe seleccionar un método de pago');
      return;
    }

    setLoading(true);
    try {
      const paymentData = {
        amountCents: Math.round(amount * 100),
        paymentMethodId: selectedPaymentMethod.id,
        notes: notes.trim() || undefined,
      };

      logger.info('📝 Registrando pago:', paymentData);

      await salesApi.registerPayment(saleId, paymentData);

      logger.info('✅ Pago registrado exitosamente');

      Alert.alert(
        'Éxito',
        'Pago registrado exitosamente',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      logger.error('❌ Error registrando pago:', error);

      const errorMessage = error?.response?.data?.message || error?.message || 'Error desconocido';
      Alert.alert('Error', `No se pudo registrar el pago: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Registrar Pago</Text>
          <Text style={styles.subtitle}>Ingresa los detalles del pago recibido</Text>
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monto (S/)</Text>
          <TextInput
            style={styles.input}
            value={amountCents}
            onChangeText={setAmountCents}
            placeholder="0.00"
            keyboardType="decimal-pad"
            placeholderTextColor="#999"
          />
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Método de Pago</Text>
          {loadingPaymentMethods ? (
            <ActivityIndicator size="small" color="#007bff" />
          ) : (
            <View style={styles.pickerContainer}>
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.pickerItem,
                    selectedPaymentMethod?.id === method.id && styles.pickerItemActive,
                  ]}
                  onPress={() => setSelectedPaymentMethod(method)}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      selectedPaymentMethod?.id === method.id && styles.pickerItemTextActive,
                    ]}
                  >
                    {method.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notas (Opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notas adicionales sobre el pago..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor="#999"
          />
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleRegisterPayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Registrar Pago</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#333',
  },
  textArea: {
    minHeight: 100,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  pickerItemActive: {
    borderColor: '#007bff',
    backgroundColor: '#E3F2FD',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#666',
  },
  pickerItemTextActive: {
    color: '#007bff',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  submitButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
