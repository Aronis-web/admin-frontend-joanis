import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { User } from '@/services/api/users';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { UserScopesModal } from './UserScopesModal';

interface UserDetailModalProps {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onEdit: (user: User) => void;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  visible,
  user,
  onClose,
  onEdit,
}) => {
  const [showScopesModal, setShowScopesModal] = useState(false);

  if (!user) return null;

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

  const getStatusColor = (status: string) => {
    return status === 'active' ? '#10B981' : '#EF4444';
  };

  const getStatusText = (status: string) => {
    return status === 'active' ? 'Activo' : 'Inactivo';
  };

  // Determine status from either status field or is_active field
  const userStatus = user.status || (user.is_active ? 'active' : 'inactive');

  const renderInfoRow = (label: string, value: string | undefined, icon?: string) => {
    if (!value) return null;

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
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.userAvatar}>
                <Text style={styles.avatarText}>
                  {user.username ? user.username.charAt(0).toUpperCase() :
                   user.name ? user.name.charAt(0).toUpperCase() :
                   user.email.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.modalTitle}>
                  {user.username || user.name || user.email}
                </Text>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(userStatus) }]} />
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
          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Información Personal */}
            {renderSection('Información Personal', (
              <>
                {renderInfoRow('Nombre de Usuario', user.username)}
                {renderInfoRow('Nombre', user.first_name)}
                {renderInfoRow('Apellido', user.last_name)}
                {renderInfoRow('Nombre Completo', user.name)}
                {renderInfoRow('Email', user.email)}
                {renderInfoRow('Teléfono', user.phone)}
              </>
            ))}

            {/* Roles */}
            {user.roles && user.roles.length > 0 && renderSection('Roles', (
              <View style={styles.tagsContainer}>
                {user.roles.map((role) => (
                  <View key={role.id} style={styles.tag}>
                    <Text style={styles.tagText}>{role.name}</Text>
                  </View>
                ))}
              </View>
            ))}

            {/* Permisos */}
            {user.permissions && user.permissions.length > 0 && renderSection('Permisos', (
              <View style={styles.tagsContainer}>
                {user.permissions.map((permission) => (
                  <View key={permission.key} style={[styles.tag, styles.permissionTag]}>
                    <Text style={[styles.tagText, styles.permissionTagText]}>
                      {permission.name || permission.key}
                    </Text>
                  </View>
                ))}
              </View>
            ))}

            {/* Información del Sistema */}
            {renderSection('Información del Sistema', (
              <>
                {renderInfoRow('ID', user.id)}
                {renderInfoRow('Fecha de Creación', formatDate(user.createdAt))}
                {renderInfoRow('Última Actualización', formatDate(user.updatedAt))}
                {renderInfoRow('Estado Activo', user.is_active !== undefined ? (user.is_active ? 'Sí' : 'No') : undefined)}
              </>
            ))}
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.button, styles.closeActionButton]}
              onPress={onClose}
            >
              <Text style={styles.closeActionButtonText}>Cerrar</Text>
            </TouchableOpacity>

            <ProtectedElement requiredPermissions={['users.update']}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => setShowScopesModal(true)}
              >
                <Text style={styles.secondaryButtonText}>🎯 Gestionar Scopes</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  permissionTag: {
    backgroundColor: '#8B5CF6',
  },
  permissionTagText: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeActionButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flex: 0.8,
  },
  closeActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  secondaryButton: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default UserDetailModal;
