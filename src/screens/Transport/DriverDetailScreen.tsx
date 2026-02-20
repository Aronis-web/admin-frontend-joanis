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
  Driver,
  CreateDriverRequest,
  UpdateDriverRequest,
  DocumentType,
  DriverStatus,
} from '@/types/transport';

export const DriverDetailScreen = ({ navigation, route }: any) => {
  const driverId = route?.params?.driverId;
  const isCreateMode = !driverId;

  const [loading, setLoading] = useState(!isCreateMode);
  const [saving, setSaving] = useState(false);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isEditing, setIsEditing] = useState(isCreateMode);

  // Form state
  const [formData, setFormData] = useState({
    tipoDocumento: DocumentType.DNI,
    numeroDocumento: '',
    nombre: '',
    apellido: '',
    numeroLicencia: '',
    categoriaLicencia: '',
    fechaVencimientoLicencia: '',
    telefono: '',
    email: '',
    direccion: '',
    status: DriverStatus.ACTIVE,
    isActive: true,
    notas: '',
  });

  // Modals
  const [showTipoDocumentoModal, setShowTipoDocumentoModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  useEffect(() => {
    if (!isCreateMode) {
      loadDriver();
    }
  }, [driverId]);

  const loadDriver = async () => {
    if (!driverId) return;

    try {
      setLoading(true);
      const data = await transportService.getDriver(driverId);
      setDriver(data);

      // Format date from ISO to YYYY-MM-DD
      const fechaVencimiento = data.fechaVencimientoLicencia
        ? new Date(data.fechaVencimientoLicencia).toISOString().split('T')[0]
        : '';

      setFormData({
        tipoDocumento: data.tipoDocumento,
        numeroDocumento: data.numeroDocumento,
        nombre: data.nombre,
        apellido: data.apellido,
        numeroLicencia: data.numeroLicencia,
        categoriaLicencia: data.categoriaLicencia,
        fechaVencimientoLicencia: fechaVencimiento,
        telefono: data.telefono || '',
        email: data.email || '',
        direccion: data.direccion || '',
        status: data.status,
        isActive: data.isActive,
        notas: data.notas || '',
      });
    } catch (error: any) {
      console.error('Error loading driver:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo cargar el conductor');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.numeroDocumento.trim()) {
      Alert.alert('Error', 'El número de documento es obligatorio');
      return false;
    }
    if (!formData.nombre.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return false;
    }
    if (!formData.apellido.trim()) {
      Alert.alert('Error', 'El apellido es obligatorio');
      return false;
    }
    if (!formData.numeroLicencia.trim()) {
      Alert.alert('Error', 'El número de licencia es obligatorio');
      return false;
    }
    if (!formData.categoriaLicencia.trim()) {
      Alert.alert('Error', 'La categoría de licencia es obligatoria');
      return false;
    }
    if (!formData.fechaVencimientoLicencia) {
      Alert.alert('Error', 'La fecha de vencimiento de licencia es obligatoria');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const requestData: CreateDriverRequest | UpdateDriverRequest = {
        tipoDocumento: formData.tipoDocumento,
        numeroDocumento: formData.numeroDocumento.trim(),
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        numeroLicencia: formData.numeroLicencia.trim().toUpperCase(),
        categoriaLicencia: formData.categoriaLicencia.trim().toUpperCase(),
        fechaVencimientoLicencia: formData.fechaVencimientoLicencia,
        telefono: formData.telefono.trim() || undefined,
        email: formData.email.trim() || undefined,
        direccion: formData.direccion.trim() || undefined,
        status: formData.status,
        isActive: formData.isActive,
        notas: formData.notas.trim() || undefined,
      };

      if (isCreateMode) {
        await transportService.createDriver(requestData as CreateDriverRequest);
        Alert.alert('Éxito', 'Conductor creado correctamente', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await transportService.updateDriver(driverId, requestData as UpdateDriverRequest);
        Alert.alert('Éxito', 'Conductor actualizado correctamente');
        setIsEditing(false);
        loadDriver();
      }
    } catch (error: any) {
      console.error('Error saving driver:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo guardar el conductor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    const fullName = `${formData.nombre} ${formData.apellido}`;
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de que deseas eliminar al conductor "${fullName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await transportService.deleteDriver(driverId);
              Alert.alert('Éxito', 'Conductor eliminado correctamente', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error: any) {
              console.error('Error deleting driver:', error);
              Alert.alert('Error', error.response?.data?.message || 'No se pudo eliminar el conductor');
            }
          },
        },
      ]
    );
  };

  const getTipoDocumentoLabel = (tipo: DocumentType) => {
    switch (tipo) {
      case DocumentType.DNI:
        return 'DNI';
      case DocumentType.CARNET_EXTRANJERIA:
        return 'Carnet de Extranjería';
      case DocumentType.PASAPORTE:
        return 'Pasaporte';
      case DocumentType.CEDULA_DIPLOMATICA:
        return 'Cédula Diplomática';
      default:
        return tipo;
    }
  };

  const getStatusLabel = (status: DriverStatus) => {
    switch (status) {
      case DriverStatus.ACTIVE:
        return 'Activo';
      case DriverStatus.INACTIVE:
        return 'Inactivo';
      case DriverStatus.SUSPENDED:
        return 'Suspendido';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando conductor...</Text>
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
          {isCreateMode ? 'Nuevo Conductor' : isEditing ? 'Editar Conductor' : 'Detalle de Conductor'}
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
        {/* Información Personal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Personal</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Tipo de Documento</Text>
            <TouchableOpacity
              style={[styles.input, styles.selectInput, !isEditing && styles.inputDisabled]}
              onPress={() => isEditing && setShowTipoDocumentoModal(true)}
              disabled={!isEditing}
            >
              <Text style={styles.selectText}>{getTipoDocumentoLabel(formData.tipoDocumento)}</Text>
              {isEditing && <Ionicons name="chevron-down" size={20} color="#6B7280" />}
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Número de Documento <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.numeroDocumento}
              onChangeText={(text) => setFormData({ ...formData, numeroDocumento: text.replace(/[^0-9A-Z]/g, '') })}
              placeholder="12345678"
              keyboardType="default"
              maxLength={formData.tipoDocumento === DocumentType.DNI ? 8 : 20}
              editable={isEditing}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Nombre <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.nombre}
              onChangeText={(text) => setFormData({ ...formData, nombre: text })}
              placeholder="Juan"
              editable={isEditing}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Apellido <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.apellido}
              onChangeText={(text) => setFormData({ ...formData, apellido: text })}
              placeholder="Pérez García"
              editable={isEditing}
            />
          </View>
        </View>

        {/* Licencia de Conducir */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Licencia de Conducir</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Número de Licencia <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.numeroLicencia}
              onChangeText={(text) => setFormData({ ...formData, numeroLicencia: text.toUpperCase() })}
              placeholder="Q12345678"
              editable={isEditing}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Categoría <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.categoriaLicencia}
              onChangeText={(text) => setFormData({ ...formData, categoriaLicencia: text.toUpperCase() })}
              placeholder="A-IIIc"
              editable={isEditing}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Fecha de Vencimiento <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.fechaVencimientoLicencia}
              onChangeText={(text) => {
                // Format as YYYY-MM-DD
                const cleaned = text.replace(/[^0-9]/g, '');
                let formatted = cleaned;
                if (cleaned.length >= 4) {
                  formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
                }
                if (cleaned.length >= 6) {
                  formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4, 6) + '-' + cleaned.slice(6, 8);
                }
                setFormData({ ...formData, fechaVencimientoLicencia: formatted });
              }}
              placeholder="YYYY-MM-DD"
              keyboardType="numeric"
              maxLength={10}
              editable={isEditing}
            />
            <Text style={styles.hint}>Formato: YYYY-MM-DD (ej: 2025-12-31)</Text>
          </View>
        </View>

        {/* Contacto */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contacto</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.telefono}
              onChangeText={(text) => setFormData({ ...formData, telefono: text.replace(/[^0-9]/g, '') })}
              placeholder="987654321"
              keyboardType="phone-pad"
              maxLength={15}
              editable={isEditing}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text.toLowerCase() })}
              placeholder="conductor@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={isEditing}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Dirección</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.direccion}
              onChangeText={(text) => setFormData({ ...formData, direccion: text })}
              placeholder="Av. Principal 123"
              editable={isEditing}
            />
          </View>
        </View>

        {/* Estado */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Estado del Conductor</Text>
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
                  <Text style={styles.buttonText}>{isCreateMode ? 'Crear Conductor' : 'Guardar Cambios'}</Text>
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

      {/* Tipo Documento Modal */}
      <Modal visible={showTipoDocumentoModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowTipoDocumentoModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tipo de Documento</Text>
            {Object.values(DocumentType).map((tipo) => (
              <TouchableOpacity
                key={tipo}
                style={styles.modalOption}
                onPress={() => {
                  setFormData({ ...formData, tipoDocumento: tipo, numeroDocumento: '' });
                  setShowTipoDocumentoModal(false);
                }}
              >
                <Text style={styles.modalOptionText}>{getTipoDocumentoLabel(tipo)}</Text>
                {formData.tipoDocumento === tipo && <Ionicons name="checkmark" size={20} color="#6366F1" />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Status Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowStatusModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Estado del Conductor</Text>
            {Object.values(DriverStatus).map((status) => (
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
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
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
