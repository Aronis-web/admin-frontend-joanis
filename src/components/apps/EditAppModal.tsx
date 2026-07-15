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
import { appsApi, UpdateAppDto, App } from '@/services/api/apps';
import Alert from '@/utils/alert';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
                  trackColor={{
                    false: theme.color.border.subtle,
                    true: theme.color.icon.success,
                  }}
                  thumbColor={
                    formData.isActive ? theme.color.text.onAction : theme.color.text.placeholder
                  }
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
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    title: {
      fontSize: 22,
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
    form: {
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
    },
    formGroup: {
      marginBottom: theme.space[5],
    },
    label: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    hint: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginTop: 6,
    },
    readOnlyField: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[4],
      paddingVertical: 14,
    },
    readOnlyText: {
      fontSize: 15,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    appTypeContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    appTypeButton: {
      paddingHorizontal: theme.space[4],
      paddingVertical: 10,
      borderRadius: theme.radii.xl,
      borderWidth: 1.5,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
      marginRight: theme.space[2],
      marginBottom: theme.space[2],
    },
    appTypeButtonActive: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.brand.accentSoft,
    },
    appTypeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    appTypeButtonTextActive: {
      color: theme.color.brand.accent,
    },
    switchContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[2],
    },
    switchLabel: {
      flex: 1,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.xl,
      borderWidth: 1.5,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    submitButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      shadowColor: theme.color.brand.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    submitButtonDisabled: {
      backgroundColor: theme.color.text.placeholder,
      shadowOpacity: 0,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
  });

export default EditAppModal;
