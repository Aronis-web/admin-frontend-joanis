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
import { RoleSelector } from '@/components/users/RoleSelector';
import { WorkerProfileFields } from '@/components/users/WorkerProfileFields';
import { usersApi, User, UpdateUserRequest } from '@/services/api/users';
import Alert from '@/utils/alert';

interface EditUserModalProps {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onUserUpdated: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  visible,
  user,
  onClose,
  onUserUpdated,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [formData, setFormData] = useState<UpdateUserRequest>({
    username: '',
    email: '',
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

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  const [errors, setErrors] = useState<
    Partial<Record<keyof UpdateUserRequest | 'password' | 'confirmPassword', string>>
  >({});
  const [loading, setLoading] = useState(false);

  // Initialize form data when user changes or modal becomes visible
  useEffect(() => {
    if (user && visible) {
      console.log('EditUserModal - Initializing form with user:', user);
      console.log('EditUserModal - User roles:', user.roles);
      const roleIds = user.roles ? user.roles.map((role) => role.id) : [];
      console.log('EditUserModal - Extracted roleIds:', roleIds);

      setFormData({
        username: user.username || '',
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        is_active: user.is_active !== undefined ? user.is_active : user.status === 'active',
        roleIds: roleIds,
        // Worker profile fields
        document_type: user.document_type,
        document_number: user.document_number || '',
        birth_date: user.birth_date,
        gender: user.gender,
        nationality: user.nationality || '',
        marital_status: user.marital_status,
        address: user.address || '',
        ubigeo: user.ubigeo || '',
        phone: user.phone || '',
        emergency_contact_name: user.emergency_contact_name || '',
        emergency_contact_relationship: user.emergency_contact_relationship || '',
        emergency_contact_phone: user.emergency_contact_phone || '',
        photo_url: user.photo_url || '',
        epp_size: user.epp_size,
      });

      // Reset password fields
      setPassword('');
      setConfirmPassword('');
      setShowPasswordFields(false);
    }
  }, [user, visible]);

  const validateForm = (): boolean => {
    const newErrors: Partial<
      Record<keyof UpdateUserRequest | 'password' | 'confirmPassword', string>
    > = {};

    // Username validation (optional but if provided must be valid)
    if (
      formData.username &&
      formData.username.trim().length > 0 &&
      formData.username.trim().length < 3
    ) {
      newErrors.username = 'El nombre de usuario debe tener al menos 3 caracteres';
    }

    // Email validation (optional but if provided must be valid)
    if (formData.email && formData.email.trim().length > 0) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'El email no es válido';
      }
    }

    // Password validation (only if changing password)
    if (showPasswordFields) {
      if (!password || password.trim().length === 0) {
        newErrors.password = 'La contraseña es requerida';
      } else if (password.length < 6) {
        newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
      }

      if (!confirmPassword || confirmPassword.trim().length === 0) {
        newErrors.confirmPassword = 'Debes confirmar la contraseña';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Las contraseñas no coinciden';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!user) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Prepare data - only send fields that have values
      const userData: UpdateUserRequest = {};

      if (formData.username?.trim()) {
        userData.username = formData.username.trim();
      }

      if (formData.email?.trim()) {
        userData.email = formData.email.trim();
      }

      if (formData.first_name?.trim()) {
        userData.first_name = formData.first_name.trim();
      }

      if (formData.last_name?.trim()) {
        userData.last_name = formData.last_name.trim();
      }

      // Always send is_active status
      userData.is_active = formData.is_active;

      // Send roles (this will replace all existing roles)
      const rawRoleIds = (formData as any).roleIds;
      userData.roleIds = Array.isArray(rawRoleIds)
        ? rawRoleIds
            .filter((id) => typeof id === 'string')
            .map((id) => id.trim())
            .filter((id) => id.length > 0)
        : typeof rawRoleIds === 'string'
          ? rawRoleIds
              .split(',')
              .map((id) => id.trim())
              .filter((id) => id.length > 0)
          : rawRoleIds && typeof rawRoleIds === 'object'
            ? Object.values(rawRoleIds)
                .filter((id) => typeof id === 'string')
                .map((id) => id.trim())
                .filter((id) => id.length > 0)
            : [];

      console.log('EditUserModal - roleIds before update:', {
        rawRoleIds,
        normalizedRoleIds: userData.roleIds,
        isArray: Array.isArray(userData.roleIds),
        size: userData.roleIds.length,
      });

      // Send password if changing
      if (showPasswordFields && password.trim()) {
        userData.password = password.trim();
      }

      // Add worker profile fields if provided
      if (formData.document_type !== undefined) {
        userData.document_type = formData.document_type;
      }
      if (formData.document_number !== undefined && formData.document_number?.trim()) {
        userData.document_number = formData.document_number.trim();
      }
      if (formData.birth_date !== undefined) {
        userData.birth_date = formData.birth_date;
      }
      if (formData.gender !== undefined) {
        userData.gender = formData.gender;
      }
      if (formData.nationality !== undefined && formData.nationality?.trim()) {
        userData.nationality = formData.nationality.trim();
      }
      if (formData.marital_status !== undefined) {
        userData.marital_status = formData.marital_status;
      }
      if (formData.address !== undefined && formData.address?.trim()) {
        userData.address = formData.address.trim();
      }
      if (formData.ubigeo !== undefined && formData.ubigeo?.trim()) {
        userData.ubigeo = formData.ubigeo.trim();
      }
      if (formData.phone !== undefined && formData.phone?.trim()) {
        userData.phone = formData.phone.trim();
      }
      if (
        formData.emergency_contact_name !== undefined &&
        formData.emergency_contact_name?.trim()
      ) {
        userData.emergency_contact_name = formData.emergency_contact_name.trim();
      }
      if (
        formData.emergency_contact_relationship !== undefined &&
        formData.emergency_contact_relationship?.trim()
      ) {
        userData.emergency_contact_relationship = formData.emergency_contact_relationship.trim();
      }
      if (
        formData.emergency_contact_phone !== undefined &&
        formData.emergency_contact_phone?.trim()
      ) {
        userData.emergency_contact_phone = formData.emergency_contact_phone.trim();
      }
      if (formData.photo_url !== undefined && formData.photo_url?.trim()) {
        userData.photo_url = formData.photo_url.trim();
      }
      if (formData.epp_size !== undefined) {
        userData.epp_size = formData.epp_size;
      }

      await usersApi.updateUser(user.id, userData);

      Alert.alert('Éxito', 'Usuario actualizado correctamente', [
        {
          text: 'OK',
          onPress: () => {
            handleClose();
            onUserUpdated();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error updating user:', error);
      const errorMessage = error.response?.data?.message || 'Error al actualizar el usuario';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setErrors({});
    setPassword('');
    setConfirmPassword('');
    setShowPasswordFields(false);
    onClose();
  };

  const updateField = (field: keyof UpdateUserRequest, value: string | boolean | string[]) => {
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

  if (!user) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.userAvatar}>
                <Text style={styles.avatarText}>
                  {user.username
                    ? user.username.charAt(0).toUpperCase()
                    : user.name
                      ? user.name.charAt(0).toUpperCase()
                      : user.email.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.modalTitle}>Editar Usuario</Text>
            </View>
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
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 Deja los campos vacíos si no deseas modificarlos
              </Text>
            </View>

            <FormTextInput
              label="Nombre de Usuario"
              placeholder={user.username || 'johndoe'}
              value={formData.username}
              onChangeText={(text) => updateField('username', text)}
              error={errors.username}
              autoCapitalize="none"
              editable={!loading}
            />

            <FormTextInput
              label="Email"
              placeholder={user.email || 'john.doe@example.com'}
              value={formData.email}
              onChangeText={(text) => updateField('email', text)}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />

            <FormTextInput
              label="Nombre"
              placeholder={user.first_name || 'John'}
              value={formData.first_name}
              onChangeText={(text) => updateField('first_name', text)}
              editable={!loading}
            />

            <FormTextInput
              label="Apellido"
              placeholder={user.last_name || 'Doe'}
              value={formData.last_name}
              onChangeText={(text) => updateField('last_name', text)}
              editable={!loading}
            />

            {/* Password Section */}
            <View style={styles.passwordSection}>
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPasswordFields(!showPasswordFields)}
                disabled={loading}
              >
                <Text style={styles.passwordToggleText}>
                  {showPasswordFields
                    ? '🔒 Cancelar cambio de contraseña'
                    : '🔑 Cambiar contraseña'}
                </Text>
              </TouchableOpacity>

              {showPasswordFields && (
                <View style={styles.passwordFields}>
                  <FormTextInput
                    label="Nueva Contraseña"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errors.password) {
                        setErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    error={errors.password}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!loading}
                  />

                  <FormTextInput
                    label="Confirmar Contraseña"
                    placeholder="Repite la contraseña"
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (errors.confirmPassword) {
                        setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }
                    }}
                    error={errors.confirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!loading}
                  />

                  <View style={styles.passwordWarning}>
                    <Text style={styles.passwordWarningText}>
                      ⚠️ El usuario deberá usar esta nueva contraseña en su próximo inicio de sesión
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.switchContainer}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchLabel}>Usuario Activo</Text>
                <Text style={styles.switchDescription}>
                  {formData.is_active
                    ? 'El usuario puede iniciar sesión'
                    : 'El usuario no podrá iniciar sesión'}
                </Text>
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

            <View style={styles.rolesWarning}>
              <Text style={styles.rolesWarningText}>
                ⚠️ Los roles seleccionados reemplazarán todos los roles existentes del usuario
              </Text>
            </View>

            {/* Worker Profile Fields */}
            <WorkerProfileFields
              formData={formData}
              onFieldChange={(field, value) => updateField(field as keyof UpdateUserRequest, value)}
              errors={errors}
              disabled={loading}
            />

            <View style={styles.userIdContainer}>
              <Text style={styles.userIdLabel}>ID del Usuario</Text>
              <Text style={styles.userIdValue}>{user.id}</Text>
            </View>
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
      borderTopLeftRadius: theme.radii.full,
      borderTopRightRadius: theme.radii.full,
      maxHeight: '90%',
      paddingBottom: theme.space[5],
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    userAvatar: {
      width: 48,
      height: 48,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.brand.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    avatarText: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.onAction,
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
    infoBox: {
      backgroundColor: theme.color.brand.primarySoft,
      borderRadius: theme.radii.xl,
      padding: theme.space[3],
      marginBottom: theme.space[5],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    infoText: {
      fontSize: 14,
      color: theme.color.text.heading,
      lineHeight: 20,
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
    userIdContainer: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[3],
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    userIdLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    userIdValue: {
      fontSize: 13,
      color: theme.color.text.heading,
      fontFamily: 'monospace',
    },
    rolesWarning: {
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.state.warning.border,
    },
    rolesWarningText: {
      fontSize: 13,
      color: theme.color.state.warning.text,
      lineHeight: 18,
    },
    passwordSection: {
      marginBottom: theme.space[4],
    },
    passwordToggle: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      alignItems: 'center',
    },
    passwordToggleText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.brand.primary,
    },
    passwordFields: {
      marginTop: theme.space[3],
    },
    passwordWarning: {
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      marginTop: theme.space[2],
      borderWidth: 1,
      borderColor: theme.color.state.warning.border,
    },
    passwordWarningText: {
      fontSize: 13,
      color: theme.color.state.warning.text,
      lineHeight: 18,
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

export default EditUserModal;
