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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { FormTextInput } from '@/components/ui/FormTextInput';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { RoleSelector } from '@/components/users/RoleSelector';
import { WorkerProfileFields } from '@/components/users/WorkerProfileFields';
import { usersApi, CreateUserRequest } from '@/services/api/users';

interface CreateUserModalProps {
  visible: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  visible,
  onClose,
  onUserCreated,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [formData, setFormData] = useState<CreateUserRequest>({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    is_active: true,
    roleIds: [],
    // Worker profile fields
    document_type: undefined,
    document_number: '',
    birth_date: undefined,
    gender: undefined,
    nationality: '',
    marital_status: undefined,
    address: '',
    ubigeo: '',
    phone: '',
    emergency_contact_name: '',
    emergency_contact_relationship: '',
    emergency_contact_phone: '',
    photo_url: '',
    epp_size: undefined,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateUserRequest, string>>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateUserRequest, string>> = {};

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'El nombre de usuario es requerido';
    } else if (formData.username.length < 3) {
      newErrors.username = 'El nombre de usuario debe tener al menos 3 caracteres';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
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
      const userData: CreateUserRequest = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        is_active: formData.is_active,
        roleIds: Array.isArray(formData.roleIds) ? formData.roleIds : [],
      };

      if (formData.first_name?.trim()) {
        userData.first_name = formData.first_name.trim();
      }

      if (formData.last_name?.trim()) {
        userData.last_name = formData.last_name.trim();
      }


      // Add worker profile fields if provided
      if (formData.document_type) {
        userData.document_type = formData.document_type;
      }
      if (formData.document_number?.trim()) {
        userData.document_number = formData.document_number.trim();
      }
      if (formData.birth_date) {
        userData.birth_date = formData.birth_date;
      }
      if (formData.gender) {
        userData.gender = formData.gender;
      }
      if (formData.nationality?.trim()) {
        userData.nationality = formData.nationality.trim();
      }
      if (formData.marital_status) {
        userData.marital_status = formData.marital_status;
      }
      if (formData.address?.trim()) {
        userData.address = formData.address.trim();
      }
      if (formData.ubigeo?.trim()) {
        userData.ubigeo = formData.ubigeo.trim();
      }
      if (formData.phone?.trim()) {
        userData.phone = formData.phone.trim();
      }
      if (formData.emergency_contact_name?.trim()) {
        userData.emergency_contact_name = formData.emergency_contact_name.trim();
      }
      if (formData.emergency_contact_relationship?.trim()) {
        userData.emergency_contact_relationship = formData.emergency_contact_relationship.trim();
      }
      if (formData.emergency_contact_phone?.trim()) {
        userData.emergency_contact_phone = formData.emergency_contact_phone.trim();
      }
      if (formData.photo_url?.trim()) {
        userData.photo_url = formData.photo_url.trim();
      }
      if (formData.epp_size) {
        userData.epp_size = formData.epp_size;
      }

      await usersApi.createUser(userData);

      Alert.alert('Éxito', 'Usuario creado correctamente', [
        {
          text: 'OK',
          onPress: () => {
            handleClose();
            onUserCreated();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error creating user:', error);
      const errorMessage = error.response?.data?.message || 'Error al crear el usuario';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      is_active: true,
      roleIds: [],
      // Reset worker profile fields
      document_type: undefined,
      document_number: '',
      birth_date: undefined,
      gender: undefined,
      nationality: '',
      marital_status: undefined,
      address: '',
      ubigeo: '',
      phone: '',
      emergency_contact_name: '',
      emergency_contact_relationship: '',
      emergency_contact_phone: '',
      photo_url: '',
      epp_size: undefined,
    });
    setErrors({});
    onClose();
  };

  const updateField = (field: keyof CreateUserRequest, value: string | boolean | string[]) => {
    const normalizedValue =
      field === 'roleIds'
        ? Array.isArray(value)
          ? value
          : typeof value === 'string' && value.trim()
            ? [value]
            : []
        : value;

    setFormData((prev) => ({ ...prev, [field]: normalizedValue }));
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
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Crear Nuevo Usuario</Text>
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
            <FormTextInput
              label="Nombre de Usuario *"
              placeholder="johndoe"
              value={formData.username}
              onChangeText={(text) => updateField('username', text)}
              error={errors.username}
              autoCapitalize="none"
              editable={!loading}
            />

            <FormTextInput
              label="Email *"
              placeholder="john.doe@example.com"
              value={formData.email}
              onChangeText={(text) => updateField('email', text)}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />

            <PasswordInput
              label="Contraseña *"
              placeholder="Mínimo 6 caracteres"
              value={formData.password}
              onChangeText={(text) => updateField('password', text)}
              error={errors.password}
              editable={!loading}
            />

            <FormTextInput
              label="Nombre"
              placeholder="John"
              value={formData.first_name}
              onChangeText={(text) => updateField('first_name', text)}
              editable={!loading}
            />

            <FormTextInput
              label="Apellido"
              placeholder="Doe"
              value={formData.last_name}
              onChangeText={(text) => updateField('last_name', text)}
              editable={!loading}
            />

            <View style={styles.switchContainer}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchLabel}>Usuario Activo</Text>
                <Text style={styles.switchDescription}>El usuario podrá iniciar sesión</Text>
              </View>
              <Switch
                value={formData.is_active}
                onValueChange={(value) => updateField('is_active', value)}
                disabled={loading}
                trackColor={{
                  false: theme.color.border.subtle,
                  true: theme.color.brand.primary,
                }}
                thumbColor={
                  formData.is_active ? theme.color.text.onAction : theme.color.text.placeholder
                }
              />
            </View>

            <RoleSelector
              selectedRoleIds={formData.roleIds || []}
              onRolesChange={(roleIds) => updateField('roleIds', roleIds)}
              disabled={loading}
              singleSelection={false}
            />

            {/* Worker Profile Fields */}
            <WorkerProfileFields
              formData={formData}
              onFieldChange={updateField}
              errors={errors}
              disabled={loading}
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
                <ActivityIndicator color={theme.color.text.onAction} />
              ) : (
                <Text style={styles.submitButtonText}>Crear Usuario</Text>
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
      borderTopLeftRadius: theme.radii.full,
      borderTopRightRadius: theme.radii.full,
      maxHeight: '90%',
      paddingBottom: theme.space[5],
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[5],
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
      borderRadius: theme.radii['2xl'],
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 20,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    formContainer: {
      paddingHorizontal: theme.space[5],
      paddingTop: theme.space[5],
      maxHeight: '70%',
    },
    switchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.space[4],
      paddingHorizontal: theme.space[4],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    switchLabelContainer: {
      flex: 1,
      marginRight: theme.space[3],
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
    requiredNote: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontStyle: 'italic',
      marginTop: theme.space[2],
      marginBottom: theme.space[4],
    },
    modalActions: {
      flexDirection: 'row',
      paddingHorizontal: theme.space[5],
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
  });

export default CreateUserModal;
