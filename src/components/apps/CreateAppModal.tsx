import React, { useState } from 'react';
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
import { appsApi, CreateAppDto, AppType } from '@/services/api/apps';

// Helper function to get app type labels
const getAppTypeLabel = (type: AppType): string => {
  const labels: Record<AppType, string> = {
    [AppType.SALES]: '💰 Ventas',
    [AppType.POS]: '🏪 Punto de Venta',
    [AppType.ADMIN]: '⚙️ Administración',
    [AppType.INTERNAL]: '🔧 Interno',
  };
  return labels[type] || type;
};

interface CreateAppModalProps {
  visible: boolean;
  onClose: () => void;
  onAppCreated: () => void;
}

export const CreateAppModal: React.FC<CreateAppModalProps> = ({
  visible,
  onClose,
  onAppCreated,
}) => {
  const [formData, setFormData] = useState<CreateAppDto>({
    code: '',
    name: '',
    description: '',
    appType: AppType.INTERNAL,
    isActive: true,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateAppDto, string>>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateAppDto, string>> = {};

    // Code validation
    if (!formData.code.trim()) {
      newErrors.code = 'El código es requerido';
    } else if (formData.code.length < 2) {
      newErrors.code = 'El código debe tener al menos 2 caracteres';
    } else if (!/^[A-Z0-9_]+$/.test(formData.code)) {
      newErrors.code = 'El código solo puede contener letras mayúsculas, números y guiones bajos';
    }

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    } else if (formData.name.length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres';
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
      const appData: CreateAppDto = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        appType: formData.appType,
        isActive: formData.isActive,
      };

      await appsApi.createApp(appData);

      Alert.alert('Éxito', 'App creada correctamente', [
        {
          text: 'OK',
          onPress: () => {
            handleClose();
            onAppCreated();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error creating app:', error);
      const errorMessage = error.response?.data?.message || 'Error al crear la app';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      appType: AppType.INTERNAL,
      isActive: true,
    });
    setErrors({});
    onClose();
  };

  const updateField = (field: keyof CreateAppDto, value: string | boolean | AppType) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>📱 Crear Nueva App</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Code */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Código <Text style={styles.required}>*</Text>
              </Text>
              <FormTextInput
                value={formData.code}
                onChangeText={(value) => updateField('code', value.toUpperCase())}
                placeholder="Ej: VENTAS, ADMIN"
                error={errors.code}
                autoCapitalize="characters"
              />
              <Text style={styles.hint}>Solo letras mayúsculas, números y guiones bajos</Text>
            </View>

            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Nombre <Text style={styles.required}>*</Text>
              </Text>
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

            {/* App Type */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Tipo de App <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.appTypeContainer}>
                {Object.values(AppType).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.appTypeButton,
                      formData.appType === type && styles.appTypeButtonActive,
                    ]}
                    onPress={() => updateField('appType', type)}
                  >
                    <Text
                      style={[
                        styles.appTypeButtonText,
                        formData.appType === type && styles.appTypeButtonTextActive,
                      ]}
                    >
                      {getAppTypeLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
                <Text style={styles.submitButtonText}>Crear App</Text>
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
  required: {
    color: colors.danger[500],
  },
  hint: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 6,
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

export default CreateAppModal;
