import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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
    return status === 'active' ? colors.success[500] : colors.danger[500];
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
                    <Text style={[
                      styles.biometricValue,
                      { color: user.has_biometric ? colors.success[600] : colors.neutral[500] }
                    ]}>
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: borderRadius.full,
    borderTopRightRadius: borderRadius.full,
    maxHeight: '90%',
    paddingBottom: spacing[5],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
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
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  headerInfo: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius['2xl'],
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    maxHeight: '70%',
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[3],
  },
  sectionContent: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  infoRow: {
    marginBottom: spacing[3],
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    color: colors.neutral[800],
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  tag: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: borderRadius['2xl'],
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  permissionTag: {
    backgroundColor: colors.accent[600],
  },
  permissionTagText: {
    color: colors.neutral[0],
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[2],
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeActionButton: {
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    flex: 0.8,
  },
  closeActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  secondaryButton: {
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[200],
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent[500],
  },
  scopesButton: {
    backgroundColor: colors.accent[600],
    borderWidth: 1,
    borderColor: colors.accent[700],
  },
  scopesButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  editButton: {
    backgroundColor: colors.primary[500],
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  // Biometric styles
  biometricContainer: {
    gap: spacing[4],
  },
  biometricStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
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
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[1],
  },
  biometricValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  biometricActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  biometricButton: {
    flex: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricRegisterButton: {
    backgroundColor: colors.primary[500],
  },
  biometricUpdateButton: {
    backgroundColor: colors.accent[600],
  },
  biometricVerifyButton: {
    backgroundColor: colors.success[500],
  },
  biometricButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});

export default UserDetailModal;
