import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Switch,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { transportService } from '@/services/api';
import {
  Vehicle,
  CreateVehicleRequest,
  UpdateVehicleRequest,
  VehicleType,
  VehicleStatus,
  AuthorizedCode,
} from '@/types/transport';

export const VehicleDetailScreen = ({ navigation, route }: any) => {
  const vehicleId = route?.params?.vehicleId;
  const isCreateMode = !vehicleId;

  const [loading, setLoading] = useState(!isCreateMode);
  const [saving, setSaving] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isEditing, setIsEditing] = useState(isCreateMode);

  // Form state
  const [formData, setFormData] = useState({
    numeroPlaca: '',
    tipoVehiculo: VehicleType.PRINCIPAL,
    tarjetaUnicaCirculacion: '',
    numeroAutorizacion: '',
    codigoAutorizado: AuthorizedCode.TRANSPORTE_PRIVADO,
    marca: '',
    modelo: '',
    anio: '',
    color: '',
    capacidadCargaKg: '',
    indTrasVehiculoCatM1L: false,
    status: VehicleStatus.ACTIVE,
    isActive: true,
    notas: '',
  });

  // Modals
  const [showTipoVehiculoModal, setShowTipoVehiculoModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCodigoAutorizadoModal, setShowCodigoAutorizadoModal] = useState(false);

  useEffect(() => {
    if (!isCreateMode) {
      loadVehicle();
    }
  }, [vehicleId]);

  const loadVehicle = async () => {
    if (!vehicleId) return;

    try {
      setLoading(true);
      const data = await transportService.getVehicle(vehicleId);
      setVehicle(data);

      setFormData({
        numeroPlaca: data.numeroPlaca,
        tipoVehiculo: data.tipoVehiculo,
        tarjetaUnicaCirculacion: data.tarjetaUnicaCirculacion || '',
        numeroAutorizacion: data.numeroAutorizacion || '',
        codigoAutorizado: data.codigoAutorizado || AuthorizedCode.TRANSPORTE_PRIVADO,
        marca: data.marca,
        modelo: data.modelo,
        anio: data.anio?.toString() || '',
        color: data.color || '',
        capacidadCargaKg: data.capacidadCargaKg?.toString() || '',
        indTrasVehiculoCatM1L: data.indTrasVehiculoCatM1L || false,
        status: data.status,
        isActive: data.isActive,
        notas: data.notas || '',
      });
    } catch (error: any) {
      console.error('Error loading vehicle:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo cargar el vehículo');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.numeroPlaca.trim()) {
      Alert.alert('Error', 'El número de placa es obligatorio');
      return false;
    }
    if (!formData.marca.trim()) {
      Alert.alert('Error', 'La marca es obligatoria');
      return false;
    }
    if (!formData.modelo.trim()) {
      Alert.alert('Error', 'El modelo es obligatorio');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const requestData: CreateVehicleRequest | UpdateVehicleRequest = {
        numeroPlaca: formData.numeroPlaca.trim().toUpperCase(),
        tipoVehiculo: formData.tipoVehiculo,
        tarjetaUnicaCirculacion: formData.tarjetaUnicaCirculacion.trim() || undefined,
        numeroAutorizacion: formData.numeroAutorizacion.trim() || undefined,
        codigoAutorizado: formData.codigoAutorizado || undefined,
        marca: formData.marca.trim(),
        modelo: formData.modelo.trim(),
        anio: formData.anio ? parseInt(formData.anio) : undefined,
        color: formData.color.trim() || undefined,
        capacidadCargaKg: formData.capacidadCargaKg ? parseFloat(formData.capacidadCargaKg) : undefined,
        indTrasVehiculoCatM1L: formData.indTrasVehiculoCatM1L,
        status: formData.status,
        isActive: formData.isActive,
        notas: formData.notas.trim() || undefined,
      };

      if (isCreateMode) {
        await transportService.createVehicle(requestData as CreateVehicleRequest);
        Alert.alert('Éxito', 'Vehículo creado correctamente', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await transportService.updateVehicle(vehicleId, requestData as UpdateVehicleRequest);
        Alert.alert('Éxito', 'Vehículo actualizado correctamente');
        setIsEditing(false);
        loadVehicle();
      }
    } catch (error: any) {
      console.error('Error saving vehicle:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo guardar el vehículo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de que deseas eliminar el vehículo "${formData.numeroPlaca}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await transportService.deleteVehicle(vehicleId);
              Alert.alert('Éxito', 'Vehículo eliminado correctamente', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error: any) {
              console.error('Error deleting vehicle:', error);
              Alert.alert('Error', error.response?.data?.message || 'No se pudo eliminar el vehículo');
            }
          },
        },
      ]
    );
  };

  const getTipoVehiculoLabel = (tipo: VehicleType) => {
    switch (tipo) {
      case VehicleType.PRINCIPAL:
        return 'Principal';
      case VehicleType.SECONDARY:
        return 'Secundario';
      default:
        return tipo;
    }
  };

  const getStatusLabel = (status: VehicleStatus) => {
    switch (status) {
      case VehicleStatus.ACTIVE:
        return 'Activo';
      case VehicleStatus.INACTIVE:
        return 'Inactivo';
      case VehicleStatus.MAINTENANCE:
        return 'En Mantenimiento';
      case VehicleStatus.OUT_OF_SERVICE:
        return 'Fuera de Servicio';
      default:
        return status;
    }
  };

  const getCodigoAutorizadoLabel = (codigo: AuthorizedCode) => {
    switch (codigo) {
      case AuthorizedCode.TRANSPORTE_PRIVADO:
        return '01 - Transporte Privado';
      case AuthorizedCode.TRANSPORTE_PUBLICO:
        return '02 - Transporte Público';
      case AuthorizedCode.TRANSPORTE_CARGA:
        return '03 - Transporte de Carga';
      case AuthorizedCode.TRANSPORTE_PASAJEROS:
        return '04 - Transporte de Pasajeros';
      case AuthorizedCode.TRANSPORTE_MIXTO:
        return '05 - Transporte Mixto';
      case AuthorizedCode.TRANSPORTE_ESPECIAL:
        return '06 - Transporte Especial';
      case AuthorizedCode.TRANSPORTE_INTERNACIONAL:
        return '07 - Transporte Internacional';
      default:
        return codigo;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando vehículo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isCreateMode ? 'Nuevo Vehículo' : isEditing ? 'Editar Vehículo' : 'Detalle de Vehículo'}
        </Text>
        <View style={styles.headerActions}>
          {!isCreateMode && !isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
              <Ionicons name="create-outline" size={24} color="#6366F1" />
            </TouchableOpacity>
          )}
          {!isCreateMode && isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.cancelButton}>
              <Ionicons name="close" size={24} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Información Básica */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Básica</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Número de Placa <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.numeroPlaca}
              onChangeText={(text) => setFormData({ ...formData, numeroPlaca: text.toUpperCase() })}
              placeholder="Ej: ABC-123"
              editable={isEditing}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Tipo de Vehículo</Text>
            <TouchableOpacity
              style={[styles.input, styles.selectInput, !isEditing && styles.inputDisabled]}
              onPress={() => isEditing && setShowTipoVehiculoModal(true)}
              disabled={!isEditing}
            >
              <Text style={styles.selectText}>{getTipoVehiculoLabel(formData.tipoVehiculo)}</Text>
              {isEditing && <Ionicons name="chevron-down" size={20} color="#6B7280" />}
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Marca <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.marca}
              onChangeText={(text) => setFormData({ ...formData, marca: text })}
              placeholder="Ej: Toyota"
              editable={isEditing}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Modelo <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.modelo}
              onChangeText={(text) => setFormData({ ...formData, modelo: text })}
              placeholder="Ej: Hilux"
              editable={isEditing}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, styles.halfWidth]}>
              <Text style={styles.label}>Año</Text>
              <TextInput
                style={[styles.input, !isEditing && styles.inputDisabled]}
                value={formData.anio}
                onChangeText={(text) => setFormData({ ...formData, anio: text.replace(/[^0-9]/g, '') })}
                placeholder="2020"
                keyboardType="numeric"
                maxLength={4}
                editable={isEditing}
              />
            </View>

            <View style={[styles.formGroup, styles.halfWidth]}>
              <Text style={styles.label}>Color</Text>
              <TextInput
                style={[styles.input, !isEditing && styles.inputDisabled]}
                value={formData.color}
                onChangeText={(text) => setFormData({ ...formData, color: text })}
                placeholder="Blanco"
                editable={isEditing}
              />
            </View>
          </View>
        </View>

        {/* Documentación */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documentación</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Tarjeta Única de Circulación</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.tarjetaUnicaCirculacion}
              onChangeText={(text) => setFormData({ ...formData, tarjetaUnicaCirculacion: text })}
              placeholder="TUC-123456"
              editable={isEditing}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Número de Autorización</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.numeroAutorizacion}
              onChangeText={(text) => setFormData({ ...formData, numeroAutorizacion: text })}
              placeholder="AUTH-123"
              editable={isEditing}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Código Autorizado</Text>
            <TouchableOpacity
              style={[styles.input, styles.selectInput, !isEditing && styles.inputDisabled]}
              onPress={() => isEditing && setShowCodigoAutorizadoModal(true)}
              disabled={!isEditing}
            >
              <Text style={styles.selectText}>
                {formData.codigoAutorizado ? getCodigoAutorizadoLabel(formData.codigoAutorizado) : 'Seleccionar'}
              </Text>
              {isEditing && <Ionicons name="chevron-down" size={20} color="#6B7280" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Capacidad */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capacidad</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Capacidad de Carga (kg)</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.capacidadCargaKg}
              onChangeText={(text) => setFormData({ ...formData, capacidadCargaKg: text.replace(/[^0-9.]/g, '') })}
              placeholder="1500"
              keyboardType="numeric"
              editable={isEditing}
            />
          </View>

          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Vehículo Categoría M1 o L</Text>
            <Switch
              value={formData.indTrasVehiculoCatM1L}
              onValueChange={(value) => setFormData({ ...formData, indTrasVehiculoCatM1L: value })}
              disabled={!isEditing}
              trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
              thumbColor={formData.indTrasVehiculoCatM1L ? '#FFFFFF' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Estado */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Estado del Vehículo</Text>
            <TouchableOpacity
              style={[styles.input, styles.selectInput, !isEditing && styles.inputDisabled]}
              onPress={() => isEditing && setShowStatusModal(true)}
              disabled={!isEditing}
            >
              <Text style={styles.selectText}>{getStatusLabel(formData.status)}</Text>
              {isEditing && <Ionicons name="chevron-down" size={20} color="#6B7280" />}
            </TouchableOpacity>
          </View>

          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Activo</Text>
            <Switch
              value={formData.isActive}
              onValueChange={(value) => setFormData({ ...formData, isActive: value })}
              disabled={!isEditing}
              trackColor={{ false: '#D1D5DB', true: '#10B981' }}
              thumbColor={formData.isActive ? '#FFFFFF' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Notas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notas</Text>

          <View style={styles.formGroup}>
            <TextInput
              style={[styles.input, styles.textArea, !isEditing && styles.inputDisabled]}
              value={formData.notas}
              onChangeText={(text) => setFormData({ ...formData, notas: text })}
              placeholder="Notas adicionales..."
              multiline
              numberOfLines={4}
              editable={isEditing}
            />
          </View>
        </View>

        {/* Buttons */}
        {isEditing && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>{isCreateMode ? 'Crear Vehículo' : 'Guardar Cambios'}</Text>
                </>
              )}
            </TouchableOpacity>

            {!isCreateMode && (
              <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Eliminar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Tipo Vehículo Modal */}
      <Modal visible={showTipoVehiculoModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowTipoVehiculoModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tipo de Vehículo</Text>
            {Object.values(VehicleType).map((tipo) => (
              <TouchableOpacity
                key={tipo}
                style={styles.modalOption}
                onPress={() => {
                  setFormData({ ...formData, tipoVehiculo: tipo });
                  setShowTipoVehiculoModal(false);
                }}
              >
                <Text style={styles.modalOptionText}>{getTipoVehiculoLabel(tipo)}</Text>
                {formData.tipoVehiculo === tipo && <Ionicons name="checkmark" size={20} color="#6366F1" />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Status Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowStatusModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Estado del Vehículo</Text>
            {Object.values(VehicleStatus).map((status) => (
              <TouchableOpacity
                key={status}
                style={styles.modalOption}
                onPress={() => {
                  setFormData({ ...formData, status });
                  setShowStatusModal(false);
                }}
              >
                <Text style={styles.modalOptionText}>{getStatusLabel(status)}</Text>
                {formData.status === status && <Ionicons name="checkmark" size={20} color="#6366F1" />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Código Autorizado Modal */}
      <Modal visible={showCodigoAutorizadoModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowCodigoAutorizadoModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Código Autorizado</Text>
            <ScrollView style={styles.modalScroll}>
              {Object.values(AuthorizedCode).map((codigo) => (
                <TouchableOpacity
                  key={codigo}
                  style={styles.modalOption}
                  onPress={() => {
                    setFormData({ ...formData, codigoAutorizado: codigo });
                    setShowCodigoAutorizadoModal(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{getCodigoAutorizadoLabel(codigo)}</Text>
                  {formData.codigoAutorizado === codigo && <Ionicons name="checkmark" size={20} color="#6366F1" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
  },
  cancelButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
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
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#6366F1',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#1F2937',
  },
});
