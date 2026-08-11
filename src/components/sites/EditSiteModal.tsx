import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { FormTextInput } from '@/components/ui/FormTextInput';
import { sitesApi } from '@/services/api';
import { Site, UpdateSiteRequest } from '@/types/sites';
import { SiteType, SiteTypeLabels, SiteTypeDescriptions } from '@/types/enums';
import Alert from '@/utils/alert';

import { LocationSearchInput, LocationData } from '@/components/common/LocationSearchInput';

interface EditSiteModalProps {
  visible: boolean;
  site: Site | null;
  onClose: () => void;
  onSiteUpdated: () => void;
}

export const EditSiteModal: React.FC<EditSiteModalProps> = ({
  visible,
  site,
  onClose,
  onSiteUpdated,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [formData, setFormData] = useState<UpdateSiteRequest>({
    code: '',
    name: '',
    isActive: true,
    siteTypes: [],
    phone: '',
    addressLine1: '',
    addressLine2: '',
    numberExt: '',
    district: '',
    province: '',
    department: '',
    country: '',
    postalCode: '',
    latitude: undefined,
    longitude: undefined,
    ubigeo: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof UpdateSiteRequest, string>>>({});
  const [loading, setLoading] = useState(false);

  // Initialize form data when site changes
  useEffect(() => {
    if (site) {
      setFormData({
        code: site.code || '',
        name: site.name || '',
        isActive: site.isActive,
        siteTypes: site.siteTypes || [],
        phone: site.phone || '',
        addressLine1: site.addressLine1 || '',
        addressLine2: site.addressLine2 || '',
        numberExt: site.numberExt || '',
        district: site.district || '',
        province: site.province || '',
        department: site.department || '',
        country: site.country || '',
        postalCode: site.postalCode || '',
        latitude: site.latitude,
        longitude: site.longitude,
        ubigeo: site.ubigeo || '',
      });
    }
  }, [site]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof UpdateSiteRequest, string>> = {};

    // Code validation (optional but if provided must be valid)
    if (formData.code && formData.code.trim().length > 0) {
      if (formData.code.length < 2 || formData.code.length > 20) {
        newErrors.code = 'El código debe tener entre 2 y 20 caracteres';
      } else if (!/^[A-Z0-9_-]+$/.test(formData.code)) {
        newErrors.code =
          'El código solo puede contener mayúsculas, números, guiones y guiones bajos';
      }
    }

    // Name validation (optional but if provided must be valid)
    if (formData.name && formData.name.trim().length > 0) {
      if (formData.name.length < 2 || formData.name.length > 120) {
        newErrors.name = 'El nombre debe tener entre 2 y 120 caracteres';
      }
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
    if (!site) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Prepare data - only send fields that have values
      const siteData: UpdateSiteRequest = {};

      if (formData.code?.trim()) {
        siteData.code = formData.code.trim().toUpperCase();
      }

      if (formData.name?.trim()) {
        siteData.name = formData.name.trim();
      }

      // Always send isActive
      siteData.isActive = formData.isActive;

      // Send siteTypes if it has values
      if (formData.siteTypes && formData.siteTypes.length > 0) {
        siteData.siteTypes = formData.siteTypes;
      }

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

      if (formData.ubigeo?.trim()) {
        siteData.ubigeo = formData.ubigeo.trim();
      }

      if (
        formData.latitude !== undefined &&
        formData.latitude !== null
      ) {
        siteData.latitude = Number(formData.latitude);
      }

      if (
        formData.longitude !== undefined &&
        formData.longitude !== null
      ) {
        siteData.longitude = Number(formData.longitude);
      }

      await sitesApi.updateSite(site.id, siteData);

      Alert.alert('Éxito', 'Sede actualizada correctamente', [
        {
          text: 'OK',
          onPress: () => {
            onClose();
            onSiteUpdated();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error updating site:', error);
      const errorMessage = error.response?.data?.message || 'Error al actualizar la sede';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (
    field: keyof UpdateSiteRequest,
    value: string | boolean | number | undefined
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setErrors((prev: any) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleLocationSearchSelected = (locationData: LocationData) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFormData((prev: any) => ({
      ...prev,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      addressLine1: locationData.addressLine1 || prev.addressLine1,
      numberExt: locationData.numberExt || prev.numberExt,
      district: locationData.district || prev.district,
      province: locationData.province || prev.province,
      department: locationData.department || prev.department,
      country: locationData.country || prev.country,
      postalCode: locationData.postalCode || prev.postalCode,
      ubigeo: locationData.ubigeo || prev.ubigeo,
    }));
  };

  const toggleSiteType = (type: SiteType) => {
    setFormData((prev: any) => {
      const currentTypes = prev.siteTypes || [];
      const hasType = currentTypes.includes(type);

      if (hasType) {
        // Remove type
        return {
          ...prev,
          siteTypes: currentTypes.filter((t: SiteType) => t !== type),
        };
      } else {
        // Add type
        return {
          ...prev,
          siteTypes: [...currentTypes, type],
        };
      }
    });
  };

  if (!site) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar Sede</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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
              label="Código"
              placeholder="HQ, STORE1, etc."
              value={formData.code}
              onChangeText={(text) => updateField('code', text.toUpperCase())}
              error={errors.code}
              autoCapitalize="characters"
              editable={!loading}
            />

            <FormTextInput
              label="Nombre"
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
                trackColor={{
                  false: theme.color.border.subtle,
                  true: theme.color.brand.primary,
                }}
                thumbColor={
                  formData.isActive ? theme.color.text.onAction : theme.color.text.placeholder
                }
              />
            </View>

            <Text style={styles.sectionTitle}>Tipos de Sede</Text>
            <Text style={styles.sectionDescription}>
              Selecciona uno o más tipos. Una sede puede ser Tienda, Almacén y/o Administrativo simultáneamente.
            </Text>

            <View style={styles.checkboxGroup}>
              {Object.values(SiteType).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.checkboxItem}
                  onPress={() => toggleSiteType(type)}
                  disabled={loading}
                >
                  <View style={[
                    styles.checkbox,
                    formData.siteTypes?.includes(type) && styles.checkboxChecked
                  ]}>
                    {formData.siteTypes?.includes(type) && (
                      <Text style={styles.checkboxIcon}>✓</Text>
                    )}
                  </View>
                  <View style={styles.checkboxTextContainer}>
                    <Text style={styles.checkboxLabel}>{SiteTypeLabels[type]}</Text>
                    <Text style={styles.checkboxDescription}>{SiteTypeDescriptions[type]}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Dirección</Text>

            <View style={styles.locationSearchSection}>
              <Text style={styles.locationSearchLabel}>🔍 Buscar Ubicación con Google Maps</Text>
              <Text style={styles.locationSearchHint}>
                Busca la dirección y se autocompletarán todos los campos
              </Text>
              <LocationSearchInput
                onLocationSelected={handleLocationSearchSelected}
                placeholder="Buscar dirección, negocio o lugar..."
                disabled={loading}
                country="pe"
                language="es"
              />
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o ingresa manualmente</Text>
              <View style={styles.dividerLine} />
            </View>

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

            <FormTextInput
              label="Ubigeo SUNAT"
              placeholder="150122"
              value={formData.ubigeo}
              onChangeText={(text) => updateField('ubigeo', text)}
              editable={!loading}
              maxLength={6}
              keyboardType="numeric"
            />

            <Text style={styles.sectionTitle}>Coordenadas GPS (Opcional)</Text>

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
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
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
                <ActivityIndicator color={theme.color.text.onAction} />
              ) : (
                <Text style={styles.submitButtonText}>Guardar Cambios</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: theme.radii['2xl'],
      borderTopRightRadius: theme.radii['2xl'],
      maxHeight: '90%',
      paddingBottom: theme.space[5],
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 18,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    formContainer: {
      paddingHorizontal: theme.space[6],
      paddingTop: theme.space[5],
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginTop: theme.space[4],
      marginBottom: theme.space[3],
    },
    sectionDescription: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginBottom: theme.space[3],
      lineHeight: 18,
    },
    checkboxGroup: {
      marginBottom: theme.space[4],
    },
    checkboxItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      marginBottom: theme.space[2],
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: theme.radii.md,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    checkboxChecked: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    checkboxIcon: {
      color: theme.color.text.onAction,
      fontSize: 16,
      fontWeight: '700',
    },
    checkboxTextContainer: {
      flex: 1,
    },
    checkboxLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 2,
    },
    checkboxDescription: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    switchContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[4],
      paddingHorizontal: theme.space[4],
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      marginBottom: theme.space[4],
    },
    switchLabelContainer: {
      flex: 1,
      marginRight: theme.space[4],
    },
    switchLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    switchDescription: {
      fontSize: 13,
      color: theme.color.text.muted,
    },
    mapButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.brand.accentSoft,
      paddingVertical: theme.space[4],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.xl,
      marginBottom: theme.space[4],
      borderWidth: 2,
      borderColor: theme.color.brand.primary,
    },
    mapButtonIcon: {
      fontSize: 32,
      marginRight: theme.space[3],
    },
    mapButtonContent: {
      flex: 1,
    },
    mapButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.brand.primary,
      marginBottom: theme.space[1],
    },
    mapButtonSubtext: {
      fontSize: 13,
      color: theme.color.text.muted,
    },
    modalActions: {
      flexDirection: 'row',
      paddingHorizontal: theme.space[6],
      paddingTop: theme.space[5],
      gap: theme.space[3],
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    submitButton: {
      backgroundColor: theme.color.brand.primary,
    },
    submitButtonDisabled: {
      backgroundColor: theme.color.text.placeholder,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    locationSearchSection: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    locationSearchLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    locationSearchHint: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: theme.space[3],
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: theme.space[4],
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.color.border.subtle,
    },
    dividerText: {
      fontSize: 13,
      color: theme.color.text.placeholder,
      marginHorizontal: theme.space[3],
      fontWeight: '500',
    },
  });

export default EditSiteModal;
