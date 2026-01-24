import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { FormTextInput } from '@/components/ui/FormTextInput';
import { sitesApi, CreateSiteRequest } from '@/services/api';
import { LocationPickerModal } from './LocationPickerModal';

interface CreateSiteModalProps {
  visible: boolean;
  onClose: () => void;
  onSiteCreated: () => void;
  companyId: string; // Required company ID - sites must belong to a company
}

export const CreateSiteModal: React.FC<CreateSiteModalProps> = ({
  visible,
  onClose,
  onSiteCreated,
  companyId,
}) => {
  const [formData, setFormData] = useState<CreateSiteRequest>({
    companyId: companyId, // Required - sites must belong to a company
    code: '',
    name: '',
    isActive: true,
    phone: '',
    addressLine1: '',
    addressLine2: '',
    numberExt: '',
    district: '',
    province: '',
    department: '',
    country: 'Perú',
    postalCode: '',
    latitude: undefined,
    longitude: undefined,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateSiteRequest, string>>>({});
  const [loading, setLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Update companyId when prop changes
  useEffect(() => {
    if (companyId) {
      setFormData((prev) => ({ ...prev, companyId }));
    }
  }, [companyId]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateSiteRequest, string>> = {};

    // Company ID validation (required for multi-tenancy)
    if (!formData.companyId || !formData.companyId.trim()) {
      newErrors.companyId = 'El ID de la empresa es requerido';
      Alert.alert('Error', 'Debe seleccionar una empresa antes de crear una sede');
      return false;
    }

    // Code validation
    if (!formData.code.trim()) {
      newErrors.code = 'El código es requerido';
    } else if (formData.code.length < 2 || formData.code.length > 20) {
      newErrors.code = 'El código debe tener entre 2 y 20 caracteres';
    } else if (!/^[A-Z0-9_-]+$/.test(formData.code)) {
      newErrors.code = 'El código solo puede contener mayúsculas, números, guiones y guiones bajos';
    }

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    } else if (formData.name.length < 2 || formData.name.length > 120) {
      newErrors.name = 'El nombre debe tener entre 2 y 120 caracteres';
    }

    // Latitude validation
    if (formData.latitude !== undefined && formData.latitude !== null) {
      const lat = Number(formData.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        newErrors.latitude = 'La latitud debe estar entre -90 y 90';
      }
    }

    // Longitude validation
    if (formData.longitude !== undefined && formData.longitude !== null) {
      const lng = Number(formData.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        newErrors.longitude = 'La longitud debe estar entre -180 y 180';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Prepare data - only send non-empty optional fields
      const siteData: CreateSiteRequest = {
        companyId: formData.companyId.trim(), // Required for multi-tenancy
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        isActive: formData.isActive,
      };

      if (formData.phone?.trim()) {
        siteData.phone = formData.phone.trim();
      }

      if (formData.addressLine1?.trim()) {
        siteData.addressLine1 = formData.addressLine1.trim();
      }

      if (formData.addressLine2?.trim()) {
        siteData.addressLine2 = formData.addressLine2.trim();
      }

      if (formData.numberExt?.trim()) {
        siteData.numberExt = formData.numberExt.trim();
      }

      if (formData.district?.trim()) {
        siteData.district = formData.district.trim();
      }

      if (formData.province?.trim()) {
        siteData.province = formData.province.trim();
      }

      if (formData.department?.trim()) {
        siteData.department = formData.department.trim();
      }

      if (formData.country?.trim()) {
        siteData.country = formData.country.trim();
      }

      if (formData.postalCode?.trim()) {
        siteData.postalCode = formData.postalCode.trim();
      }

      if (
        formData.latitude !== undefined &&
        formData.latitude !== null &&
        formData.latitude !== ''
      ) {
        siteData.latitude = Number(formData.latitude);
      }

      if (
        formData.longitude !== undefined &&
        formData.longitude !== null &&
        formData.longitude !== ''
      ) {
        siteData.longitude = Number(formData.longitude);
      }

      await sitesApi.createSite(siteData);

      Alert.alert('Éxito', 'Sede creada correctamente', [
        {
          text: 'OK',
          onPress: () => {
            handleClose();
            onSiteCreated();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error creating site:', error);
      const errorMessage = error.response?.data?.message || 'Error al crear la sede';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      companyId: companyId, // Reset to initial companyId (required)
      code: '',
      name: '',
      isActive: true,
      phone: '',
      addressLine1: '',
      addressLine2: '',
      numberExt: '',
      district: '',
      province: '',
      department: '',
      country: 'Perú',
      postalCode: '',
      latitude: undefined,
      longitude: undefined,
    });
    setErrors({});
    onClose();
  };

  const updateField = (
    field: keyof CreateSiteRequest,
    value: string | boolean | number | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleLocationSelected = (locationData: any) => {
    setFormData((prev) => ({
      ...prev,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      addressLine1: locationData.addressLine1 || prev.addressLine1,
      district: locationData.district || prev.district,
      province: locationData.province || prev.province,
      department: locationData.department || prev.department,
      country: locationData.country || prev.country,
      postalCode: locationData.postalCode || prev.postalCode,
    }));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Crear Nueva Sede</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView
            style={styles.formContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionTitle}>Información Básica</Text>

            <FormTextInput
              label="Código *"
              placeholder="HQ, STORE1, etc."
              value={formData.code}
              onChangeText={(text) => updateField('code', text.toUpperCase())}
              error={errors.code}
              autoCapitalize="characters"
              editable={!loading}
            />

            <FormTextInput
              label="Nombre *"
              placeholder="Sede Principal"
              value={formData.name}
              onChangeText={(text) => updateField('name', text)}
              error={errors.name}
              editable={!loading}
            />

            <FormTextInput
              label="Teléfono"
              placeholder="987654321"
              value={formData.phone}
              onChangeText={(text) => updateField('phone', text)}
              keyboardType="phone-pad"
              editable={!loading}
            />

            <View style={styles.switchContainer}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchLabel}>Sede Activa</Text>
                <Text style={styles.switchDescription}>
                  La sede estará disponible para operaciones
                </Text>
              </View>
              <Switch
                value={formData.isActive}
                onValueChange={(value) => updateField('isActive', value)}
                disabled={loading}
                trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                thumbColor={formData.isActive ? '#FFFFFF' : '#94A3B8'}
              />
            </View>

            <Text style={styles.sectionTitle}>Dirección</Text>

            <FormTextInput
              label="Dirección Línea 1"
              placeholder="Av. Principal 123"
              value={formData.addressLine1}
              onChangeText={(text) => updateField('addressLine1', text)}
              editable={!loading}
            />

            <FormTextInput
              label="Dirección Línea 2"
              placeholder="Piso 2, Oficina 201"
              value={formData.addressLine2}
              onChangeText={(text) => updateField('addressLine2', text)}
              editable={!loading}
            />

            <FormTextInput
              label="Número Exterior"
              placeholder="123-A"
              value={formData.numberExt}
              onChangeText={(text) => updateField('numberExt', text)}
              editable={!loading}
            />

            <FormTextInput
              label="Distrito"
              placeholder="Miraflores"
              value={formData.district}
              onChangeText={(text) => updateField('district', text)}
              editable={!loading}
            />

            <FormTextInput
              label="Provincia"
              placeholder="Lima"
              value={formData.province}
              onChangeText={(text) => updateField('province', text)}
              editable={!loading}
            />

            <FormTextInput
              label="Departamento"
              placeholder="Lima"
              value={formData.department}
              onChangeText={(text) => updateField('department', text)}
              editable={!loading}
            />

            <FormTextInput
              label="País"
              placeholder="Perú"
              value={formData.country}
              onChangeText={(text) => updateField('country', text)}
              editable={!loading}
            />

            <FormTextInput
              label="Código Postal"
              placeholder="15074"
              value={formData.postalCode}
              onChangeText={(text) => updateField('postalCode', text)}
              editable={!loading}
            />

            <Text style={styles.sectionTitle}>Coordenadas GPS (Opcional)</Text>

            <TouchableOpacity
              style={styles.mapButton}
              onPress={() => setShowLocationPicker(true)}
              disabled={loading}
            >
              <Text style={styles.mapButtonIcon}>🗺️</Text>
              <View style={styles.mapButtonContent}>
                <Text style={styles.mapButtonText}>Seleccionar en el Mapa</Text>
                <Text style={styles.mapButtonSubtext}>
                  Autocompletará la dirección y coordenadas
                </Text>
              </View>
            </TouchableOpacity>

            <FormTextInput
              label="Latitud"
              placeholder="-12.046374"
              value={formData.latitude?.toString() || ''}
              onChangeText={(text) => updateField('latitude', text ? parseFloat(text) : undefined)}
              error={errors.latitude}
              keyboardType="numeric"
              editable={!loading}
            />

            <FormTextInput
              label="Longitud"
              placeholder="-77.042793"
              value={formData.longitude?.toString() || ''}
              onChangeText={(text) => updateField('longitude', text ? parseFloat(text) : undefined)}
              error={errors.longitude}
              keyboardType="numeric"
              editable={!loading}
            />

            <Text style={styles.requiredNote}>* Campos requeridos</Text>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Crear Sede</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Location Picker Modal */}
      <LocationPickerModal
        visible={showLocationPicker}
        initialLocation={{
          latitude: formData.latitude,
          longitude: formData.longitude,
        }}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelected={handleLocationSelected}
      />
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
    paddingBottom: 20,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 12,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 16,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 13,
    color: '#64748B',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  mapButtonIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  mapButtonContent: {
    flex: 1,
  },
  mapButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 4,
  },
  mapButtonSubtext: {
    fontSize: 13,
    color: '#64748B',
  },
  requiredNote: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  submitButton: {
    backgroundColor: '#3B82F6',
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CreateSiteModal;
