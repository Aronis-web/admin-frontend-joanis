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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { FormTextInput } from '@/components/ui/FormTextInput';
import { appsApi, UpdateAppDto, App } from '@/services/api/apps';

interface EditAppModalProps {
  visible: boolean;
  app: App | null;
  onClose: () => void;
  onAppUpdated: () => void;
}

export const EditAppModal: React.FC<EditAppModalProps> = ({
  visible,
  app,
  onClose,
  onAppUpdated,
}) => {
  const [formData, setFormData] = useState<UpdateAppDto>({
    name: '',
    description: '',
    isActive: true,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof UpdateAppDto, string>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (app) {
      setFormData({
        name: app.name,
        description: app.description || '',
        isActive: app.isActive,
      });
    }
  }, [app]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof UpdateAppDto, string>> = {};

    // Name validation
    if (formData.name && !formData.name.trim()) {
      newErrors.name = 'El nombre no puede estar vacío';
    } else if (formData.name && formData.name.length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!app) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const appData: UpdateAppDto = {};

      if (formData.name && formData.name.trim() !== app.name) {
        appData.name = formData.name.trim();
      }

      if (
        formData.description !== undefined &&
        formData.description.trim() !== (app.description || '')
      ) {
        appData.description = formData.description.trim();
      }

      if (formData.isActive !== app.isActive) {
        appData.isActive = formData.isActive;
      }

      // Only update if there are changes
      if (Object.keys(appData).length === 0) {
        Alert.alert('Información', 'No hay cambios para guardar');
        return;
      }

      await appsApi.updateApp(app.id, appData);

      Alert.alert('Éxito', 'App actualizada correctamente', [
        {
          text: 'OK',
          onPress: () => {
            handleClose();
            onAppUpdated();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error updating app:', error);
      const errorMessage = error.response?.data?.message || 'Error al actualizar la app';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const updateField = (field: keyof UpdateAppDto, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (!app) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>✏️ Editar App</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Code (Read-only) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Código</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>{app.code}</Text>
              </View>
              <Text style={styles.hint}>El código no se puede modificar</Text>
            </View>

            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre</Text>
              <FormTextInput
                value={formData.name}
                onChangeText={(value) => updateField('name', value)}
                placeholder="Ej: Sistema de Ventas"
                error={errors.name}
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Descripción</Text>
              <FormTextInput
                value={formData.description}
                onChangeText={(value) => updateField('description', value)}
                placeholder="Descripción de la aplicación (opcional)"
                error={errors.description}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* App Type (Read-only) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Tipo de App</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>{app.appType}</Text>
              </View>
              <Text style={styles.hint}>El tipo de app no se puede modificar</Text>
            </View>

            {/* Is Active */}
            <View style={styles.formGroup}>
              <View style={styles.switchContainer}>
                <View style={styles.switchLabel}>
                  <Text style={styles.label}>Estado Activo</Text>
                  <Text style={styles.hint}>
                    {formData.isActive ? 'La app está activa' : 'La app está inactiva'}
                  </Text>
                </View>
                <Switch
                  value={formData.isActive}
                  onValueChange={(value) => updateField('isActive', value)}
                  trackColor={{ false: colors.neutral[200], true: colors.success[500] }}
                  thumbColor={formData.isActive ? colors.neutral[0] : colors.neutral[400]}
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={loading}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.neutral[0]} />
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '90%',
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  form: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
  },
  formGroup: {
    marginBottom: spacing[5],
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[2],
  },
  hint: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 6,
  },
  readOnlyField: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
  },
  readOnlyText: {
    fontSize: 15,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  appTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  appTypeButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: 10,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    marginRight: spacing[2],
    marginBottom: spacing[2],
  },
  appTypeButtonActive: {
    borderColor: colors.accent[500],
    backgroundColor: colors.accent[50],
  },
  appTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  appTypeButtonTextActive: {
    color: colors.accent[500],
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  switchLabel: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing[3],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.accent[500],
    alignItems: 'center',
    shadowColor: colors.accent[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: colors.neutral[400],
    shadowOpacity: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});

export default EditAppModal;
