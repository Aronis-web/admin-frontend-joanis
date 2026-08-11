import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { User } from '@/services/api/users';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { UserScopesModal } from './UserScopesModal';
import {
  DOCUMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
} from '@/constants/userProfile';

interface UserDetailModalProps {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onEdit: (user: User) => void;
  onRegisterBiometric?: (user: User) => void;
  onUpdateBiometric?: (user: User) => void;
  onVerifyBiometric?: (user: User) => void;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  visible,
  user,
  onClose,
  onEdit,
  onRegisterBiometric,
  onUpdateBiometric,
  onVerifyBiometric,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [showScopesModal, setShowScopesModal] = useState(false);

  if (!user) {
    return null;
  }

  console.log('UserDetailModal - Rendering with user:', user);
  console.log('UserDetailModal - User roles:', user.roles);
  console.log('UserDetailModal - User is_active:', user.is_active);
  console.log('UserDetailModal - User status:', user.status);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBirthDate = (dateString?: string) => {
    if (!dateString) {
      return undefined;
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDocumentTypeLabel = (type?: string) => {
    if (!type) {
      return undefined;
    }
    const option = DOCUMENT_TYPE_OPTIONS.find((opt) => opt.value === type);
    return option ? option.label : type;
  };

  const getGenderLabel = (gender?: string) => {
    if (!gender) {
      return undefined;
    }
    const option = GENDER_OPTIONS.find((opt) => opt.value === gender);
    return option ? option.label : gender;
  };

  const getMaritalStatusLabel = (status?: string) => {
    if (!status) {
      return undefined;
    }
    const option = MARITAL_STATUS_OPTIONS.find((opt) => opt.value === status);
    return option ? option.label : status;
  };

  const getStatusColor = (status: string) => {
    return status === 'active'
      ? theme.color.state.success.border
      : theme.color.state.danger.border;
  };

  const getStatusText = (status: string) => {
    return status === 'active' ? 'Activo' : 'Inactivo';
  };

  // Determine status from either status field or is_active field
  const userStatus = user.status || (user.is_active ? 'active' : 'inactive');

  const renderInfoRow = (label: string, value: string | undefined, icon?: string) => {
    if (!value) {
      return null;
    }

    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    );
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
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
              <View style={styles.headerInfo}>
                <Text style={styles.modalTitle}>{user.username || user.name || user.email}</Text>
                <View style={styles.statusBadge}>
                  <View
                    style={[styles.statusDot, { backgroundColor: getStatusColor(userStatus) }]}
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(userStatus) }]}>
                    {getStatusText(userStatus)}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Información Personal */}
            {renderSection(
              'Información Personal',
              <>
                {renderInfoRow('Nombre de Usuario', user.username)}
                {renderInfoRow('Nombre', user.first_name)}
                {renderInfoRow('Apellido', user.last_name)}
                {renderInfoRow('Nombre Completo', user.name)}
                {renderInfoRow('Email', user.email)}
                {renderInfoRow('Teléfono', user.phone)}
              </>
            )}

            {/* Worker Profile - Identification */}
            {(user.document_type || user.document_number) &&
              renderSection(
                'Identificación',
                <>
                  {renderInfoRow('Tipo de Documento', getDocumentTypeLabel(user.document_type))}
                  {renderInfoRow('Número de Documento', user.document_number)}
                </>
              )}

            {/* Worker Profile - Personal Data */}
            {(user.birth_date || user.gender || user.nationality || user.marital_status) &&
              renderSection(
                'Datos Personales',
                <>
                  {renderInfoRow('Fecha de Nacimiento', formatBirthDate(user.birth_date))}
                  {renderInfoRow('Género', getGenderLabel(user.gender))}
                  {renderInfoRow('Nacionalidad', user.nationality)}
                  {renderInfoRow('Estado Civil', getMaritalStatusLabel(user.marital_status))}
                </>
              )}

            {/* Worker Profile - Contact Information */}
            {(user.address || user.ubigeo) &&
              renderSection(
                'Información de Contacto',
                <>
                  {renderInfoRow('Dirección', user.address)}
                  {renderInfoRow('Ubigeo', user.ubigeo)}
                </>
              )}

            {/* Worker Profile - Emergency Contact */}
            {(user.emergency_contact_name ||
              user.emergency_contact_relationship ||
              user.emergency_contact_phone) &&
              renderSection(
                'Contacto de Emergencia',
                <>
                  {renderInfoRow('Nombre', user.emergency_contact_name)}
                  {renderInfoRow('Relación', user.emergency_contact_relationship)}
                  {renderInfoRow('Teléfono', user.emergency_contact_phone)}
                </>
              )}

            {/* Worker Profile - Additional Information */}
            {(user.photo_url || user.epp_size) &&
              renderSection(
                'Información Adicional',
                <>
                  {renderInfoRow('URL de Foto', user.photo_url)}
                  {renderInfoRow('Talla de EPP', user.epp_size)}
                </>
              )}

            {/* Roles */}
            {user.roles &&
              user.roles.length > 0 &&
              renderSection(
                'Roles',
                <View style={styles.tagsContainer}>
                  {user.roles.map((role) => (
                    <View key={role.id} style={styles.tag}>
                      <Text style={styles.tagText}>{role.name}</Text>
                    </View>
                  ))}
                </View>
              )}

            {/* Permisos */}
            {user.permissions &&
              user.permissions.length > 0 &&
              renderSection(
                'Permisos',
                <View style={styles.tagsContainer}>
                  {user.permissions.map((permission) => (
                    <View key={permission.key} style={[styles.tag, styles.permissionTag]}>
                      <Text style={[styles.tagText, styles.permissionTagText]}>
                        {permission.name || permission.key}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

            {/* Información del Sistema */}
            {renderSection(
              'Información del Sistema',
              <>
                {renderInfoRow('ID', user.id)}
                {renderInfoRow('Fecha de Creación', formatDate(user.createdAt))}
                {renderInfoRow('Última Actualización', formatDate(user.updatedAt))}
                {renderInfoRow(
                  'Estado Activo',
                  user.is_active !== undefined ? (user.is_active ? 'Sí' : 'No') : undefined
                )}
              </>
            )}

            {/* Biometric Section */}
            {renderSection(
              'Biometría Facial',
              <View style={styles.biometricContainer}>
                <View style={styles.biometricStatus}>
                  <Text style={styles.biometricIcon}>
                    {user.has_biometric ? '🔐' : '🔓'}
                  </Text>
                  <View style={styles.biometricInfo}>
                    <Text style={styles.biometricLabel}>Estado</Text>
                    <Text
                      style={[
                        styles.biometricValue,
                        {
                          color: user.has_biometric
                            ? theme.color.text.success
                            : theme.color.text.muted,
                        },
                      ]}
                    >
                      {user.has_biometric ? 'Registrado' : 'Sin registrar'}
                    </Text>
                  </View>
                </View>

                <View style={styles.biometricActions}>
                  {user.has_biometric ? (
                    <>
                      {onUpdateBiometric && (
                        <TouchableOpacity
                          style={[styles.biometricButton, styles.biometricUpdateButton]}
                          onPress={() => onUpdateBiometric(user)}
                        >
                          <Text style={styles.biometricButtonText}>✏️ Editar</Text>
                        </TouchableOpacity>
                      )}
                      {onVerifyBiometric && (
                        <TouchableOpacity
                          style={[styles.biometricButton, styles.biometricVerifyButton]}
                          onPress={() => onVerifyBiometric(user)}
                        >
                          <Text style={styles.biometricButtonText}>✅ Validar</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    onRegisterBiometric && (
                      <TouchableOpacity
                        style={[styles.biometricButton, styles.biometricRegisterButton]}
                        onPress={() => onRegisterBiometric(user)}
                      >
                        <Text style={styles.biometricButtonText}>📷 Registrar Biometría</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.button, styles.closeActionButton]} onPress={onClose}>
              <Text style={styles.closeActionButtonText}>Cerrar</Text>
            </TouchableOpacity>

            <ProtectedElement requiredPermissions={['users.update']}>
              <TouchableOpacity
                style={[styles.button, styles.scopesButton]}
                onPress={() => setShowScopesModal(true)}
              >
                <Text style={styles.scopesButtonText}>🎯 Scopes</Text>
              </TouchableOpacity>
            </ProtectedElement>

            <ProtectedElement requiredPermissions={['users.update']}>
              <TouchableOpacity
                style={[styles.button, styles.editButton]}
                onPress={() => onEdit(user)}
              >
                <Text style={styles.editButtonText}>✏️ Editar</Text>
              </TouchableOpacity>
            </ProtectedElement>
          </View>
        </View>
      </View>

      {/* User Scopes Modal */}
      <UserScopesModal
        visible={showScopesModal}
        userId={user.id}
        userName={user.username || user.name || user.email}
        onClose={() => setShowScopesModal(false)}
      />
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
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    userAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.color.brand.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[4],
    },
    avatarText: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.color.text.onAction,
    },
    headerInfo: {
      flex: 1,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 6,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radii.full,
      marginRight: 6,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
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
    scrollContent: {
      paddingHorizontal: theme.space[5],
      paddingTop: theme.space[5],
      maxHeight: '70%',
    },
    section: {
      marginBottom: theme.space[6],
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
    },
    sectionContent: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    infoRow: {
      marginBottom: theme.space[3],
    },
    infoLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    infoValue: {
      fontSize: 15,
      color: theme.color.text.heading,
      fontWeight: '500',
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    tag: {
      backgroundColor: theme.color.brand.primary,
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      borderRadius: theme.radii['2xl'],
    },
    tagText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    permissionTag: {
      backgroundColor: theme.color.brand.accent,
    },
    permissionTagText: {
      color: theme.color.text.onAction,
    },
    modalActions: {
      flexDirection: 'row',
      paddingHorizontal: theme.space[5],
      paddingTop: theme.space[5],
      gap: theme.space[2],
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeActionButton: {
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      flex: 0.8,
    },
    closeActionButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    secondaryButton: {
      backgroundColor: theme.color.brand.accentSoft,
      borderWidth: 1,
      borderColor: theme.color.brand.accent,
    },
    secondaryButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.brand.accent,
    },
    scopesButton: {
      backgroundColor: theme.color.brand.accent,
      borderWidth: 1,
      borderColor: theme.color.brand.accent,
    },
    scopesButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    editButton: {
      backgroundColor: theme.color.brand.primary,
    },
    editButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    biometricContainer: {
      gap: theme.space[4],
    },
    biometricStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    biometricIcon: {
      fontSize: 32,
    },
    biometricInfo: {
      flex: 1,
    },
    biometricLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.space[1],
    },
    biometricValue: {
      fontSize: 15,
      fontWeight: '600',
    },
    biometricActions: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
    biometricButton: {
      flex: 1,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    biometricRegisterButton: {
      backgroundColor: theme.color.brand.primary,
    },
    biometricUpdateButton: {
      backgroundColor: theme.color.brand.accent,
    },
    biometricVerifyButton: {
      backgroundColor: theme.color.action.success.background,
    },
    biometricButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
  });

export default UserDetailModal;
