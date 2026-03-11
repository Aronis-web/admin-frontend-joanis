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
  Switch,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { cashRegistersApi, CashRegister, CashRegisterStatus } from '@/services/api/cash-registers';
import logger from '@/utils/logger';

interface EditCashRegisterScreenProps {
  navigation: any;
  route: {
    params: {
      cashRegisterId: string;
      emissionPointId: string;
      emissionPointName: string;
      emissionPointCode: string;
    };
  };
}

export const EditCashRegisterScreen: React.FC<EditCashRegisterScreenProps> = ({
  navigation,
  route,
}) => {
  const { cashRegisterId, emissionPointName, emissionPointCode } = route.params;
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [maxCashAmount, setMaxCashAmount] = useState('');
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(false);
  const [requiresManagerApproval, setRequiresManagerApproval] = useState(false);
  const [status, setStatus] = useState<CashRegisterStatus>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCashRegister();
  }, [cashRegisterId]);

  const loadCashRegister = async () => {
    try {
      setLoading(true);
      const data = await cashRegistersApi.getCashRegisterById(cashRegisterId);
      setCashRegister(data);
      setCode(data.code);
      setName(data.name);
      setLocation(data.metadata?.location || '');
      setIpAddress(data.metadata?.ipAddress || '');
      setDeviceId(data.metadata?.deviceId || '');
      setMaxCashAmount(
        data.maxCashAmountCents ? (data.maxCashAmountCents / 100).toString() : ''
      );
      setAllowNegativeBalance(data.allowNegativeBalance);
      setRequiresManagerApproval(data.requiresManagerApproval);
      setStatus(data.status);
    } catch (error: any) {
      logger.error('Error cargando caja registradora:', error);
      Alert.alert('Error', 'No se pudo cargar la caja registradora', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'El código es requerido');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    try {
      setSaving(true);

      const metadata: any = {};
      if (location.trim()) metadata.location = location.trim();
      if (ipAddress.trim()) metadata.ipAddress = ipAddress.trim();
      if (deviceId.trim()) metadata.deviceId = deviceId.trim();

      const maxCashAmountCents = maxCashAmount.trim()
        ? Math.round(parseFloat(maxCashAmount) * 100)
        : undefined;

      await cashRegistersApi.updateCashRegister(cashRegisterId, {
        code: code.trim(),
        name: name.trim(),
        allowNegativeBalance,
        requiresManagerApproval,
        maxCashAmountCents,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });

      Alert.alert('Éxito', 'Caja registradora actualizada exitosamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      logger.error('Error actualizando caja registradora:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo actualizar la caja registradora'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar Caja Registradora',
      `¿Estás seguro de que deseas eliminar la caja "${name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await cashRegistersApi.deleteCashRegister(cashRegisterId);
              Alert.alert('Éxito', 'Caja registradora eliminada exitosamente', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error: any) {
              logger.error('Error eliminando caja registradora:', error);
              Alert.alert('Error', 'No se pudo eliminar la caja registradora');
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleChangeStatus = async (newStatus: CashRegisterStatus) => {
    try {
      setSaving(true);
      await cashRegistersApi.updateCashRegister(cashRegisterId, { status: newStatus });
      setStatus(newStatus);
      Alert.alert('Éxito', 'Estado actualizado exitosamente');
    } catch (error: any) {
      logger.error('Error actualizando estado:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenLayout navigation={navigation}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Cargando caja registradora...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Editar Caja Registradora
            </Text>
            <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
              {emissionPointCode} - {emissionPointName}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estado de la Caja</Text>

            <View style={styles.statusButtons}>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  status === 'ACTIVE' && styles.statusButtonActive,
                ]}
                onPress={() => handleChangeStatus('ACTIVE')}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    status === 'ACTIVE' && styles.statusButtonTextActive,
                  ]}
                >
                  ✅ Activa
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  status === 'INACTIVE' && styles.statusButtonInactive,
                ]}
                onPress={() => handleChangeStatus('INACTIVE')}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    status === 'INACTIVE' && styles.statusButtonTextInactive,
                  ]}
                >
                  ❌ Inactiva
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  status === 'MAINTENANCE' && styles.statusButtonMaintenance,
                ]}
                onPress={() => handleChangeStatus('MAINTENANCE')}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    status === 'MAINTENANCE' && styles.statusButtonTextMaintenance,
                  ]}
                >
                  🔧 Mantenimiento
                </Text>
              </TouchableOpacity>
            </View>

            {cashRegister?.isOpen && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ Esta caja tiene una sesión abierta actualmente
                </Text>
              </View>
            )}
          </View>

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
                keyboardType="default"
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
                keyboardType="default"
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
                keyboardType="default"
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
                keyboardType="default"
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
              style={[styles.button, styles.deleteButton]}
              onPress={handleDelete}
              disabled={saving}
            >
              <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => navigation.goBack()}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleUpdate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
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
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  statusButtonActive: {
    backgroundColor: '#10B98120',
    borderColor: '#10B981',
  },
  statusButtonInactive: {
    backgroundColor: '#EF444420',
    borderColor: '#EF4444',
  },
  statusButtonMaintenance: {
    backgroundColor: '#F59E0B20',
    borderColor: '#F59E0B',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  statusButtonTextActive: {
    color: '#10B981',
  },
  statusButtonTextInactive: {
    color: '#EF4444',
  },
  statusButtonTextMaintenance: {
    color: '#F59E0B',
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
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
  deleteButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
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
  saveButton: {
    backgroundColor: '#6366F1',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
