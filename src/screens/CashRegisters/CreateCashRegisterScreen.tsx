import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useAuthStore } from '@/store/auth';
import { cashRegistersApi } from '@/services/api/cash-registers';
import logger from '@/utils/logger';

interface CreateCashRegisterScreenProps {
  navigation: any;
  route: {
    params: {
      emissionPointId: string;
      emissionPointName: string;
      emissionPointCode: string;
    };
  };
}

export const CreateCashRegisterScreen: React.FC<CreateCashRegisterScreenProps> = ({
  navigation,
  route,
}) => {
  const { emissionPointId, emissionPointName, emissionPointCode } = route.params;
  const { currentSite, currentCompany } = useAuthStore();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [maxCashAmount, setMaxCashAmount] = useState('');
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(false);
  const [requiresManagerApproval, setRequiresManagerApproval] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'El código es requerido');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    if (!currentSite?.id || !currentCompany?.id) {
      Alert.alert('Error', 'No hay sede o empresa seleccionada');
      return;
    }

    try {
      setLoading(true);

      const metadata: any = {};
      if (location.trim()) metadata.location = location.trim();
      if (ipAddress.trim()) metadata.ipAddress = ipAddress.trim();
      if (deviceId.trim()) metadata.deviceId = deviceId.trim();

      const maxCashAmountCents = maxCashAmount.trim()
        ? Math.round(parseFloat(maxCashAmount) * 100)
        : undefined;

      await cashRegistersApi.createCashRegister({
        companyId: currentCompany.id,
        siteId: currentSite.id,
        code: code.trim(),
        name: name.trim(),
        emissionPointId,
        allowNegativeBalance,
        requiresManagerApproval,
        maxCashAmountCents,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });

      Alert.alert('Éxito', 'Caja registradora creada exitosamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      logger.error('Error creando caja registradora:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo crear la caja registradora'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Nueva Caja Registradora
            </Text>
            <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
              {emissionPointCode} - {emissionPointName}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información Básica</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Código <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Ej: CAJA-01"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Nombre <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej: Caja Principal - Tienda Norte"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Ubicación</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Ej: Piso 1, Área de ventas"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Configuración Técnica</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Dirección IP</Text>
              <TextInput
                style={styles.input}
                value={ipAddress}
                onChangeText={setIpAddress}
                placeholder="Ej: 192.168.1.100"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>ID de Dispositivo</Text>
              <TextInput
                style={styles.input}
                value={deviceId}
                onChangeText={setDeviceId}
                placeholder="Ej: DEVICE-001"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Monto Máximo de Efectivo ($)</Text>
              <TextInput
                style={styles.input}
                value={maxCashAmount}
                onChangeText={setMaxCashAmount}
                placeholder="Ej: 1000.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
              <Text style={styles.helpText}>
                Monto máximo permitido en efectivo en la caja
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Opciones de Configuración</Text>

            <View style={styles.switchGroup}>
              <View style={styles.switchLabel}>
                <Text style={styles.switchTitle}>Permitir Saldo Negativo</Text>
                <Text style={styles.switchDescription}>
                  Permite que la caja tenga saldo negativo
                </Text>
              </View>
              <Switch
                value={allowNegativeBalance}
                onValueChange={setAllowNegativeBalance}
                trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.switchGroup}>
              <View style={styles.switchLabel}>
                <Text style={styles.switchTitle}>Requiere Aprobación de Gerente</Text>
                <Text style={styles.switchDescription}>
                  Las operaciones requieren aprobación de un gerente
                </Text>
              </View>
              <Switch
                value={requiresManagerApproval}
                onValueChange={setRequiresManagerApproval}
                trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.createButton, loading && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>Crear Caja</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTablet: {
    padding: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerTitleTablet: {
    fontSize: 32,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  headerSubtitleTablet: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  switchLabel: {
    flex: 1,
    marginRight: 12,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#6366F1',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
