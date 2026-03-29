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
} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { Site, SiteAdmin } from '@/types/sites';
import { sitesApi, usersApi, User } from '@/services/api';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';

interface ManageAdminsModalProps {
  visible: boolean;
  site: Site | null;
  onClose: () => void;
  onAdminsUpdated: () => void;
}

export const ManageAdminsModal: React.FC<ManageAdminsModalProps> = ({
  visible,
  site,
  onClose,
  onAdminsUpdated,
}) => {
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [removingAdminId, setRemovingAdminId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && site) {
      loadAvailableUsers();
    }
  }, [visible, site]);

  const loadAvailableUsers = async () => {
    try {
      setLoading(true);
      const response = await usersApi.getUsers({ limit: 100, status: 'active' });

      // Filter out users who are already admins
      const currentAdminIds = site?.admins?.map((admin) => admin.userId) || [];
      const users = response?.data || [];
      const available = users.filter((user) => !currentAdminIds.includes(user.id));

      setAvailableUsers(available);
    } catch (error: any) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'No se pudieron cargar los usuarios disponibles');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (userId: string) => {
    if (!site) {
      return;
    }

    setAddingAdmin(true);
    try {
      await sitesApi.addAdmin(site.id, { userId });
      Alert.alert('Éxito', 'Administrador agregado correctamente');
      onAdminsUpdated();
      loadAvailableUsers();
    } catch (error: any) {
      console.error('Error adding admin:', error);
      const errorMessage = error.response?.data?.message || 'Error al agregar administrador';
      Alert.alert('Error', errorMessage);
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (userId: string, userName: string) => {
    if (!site) {
      return;
    }

    Alert.alert(
      'Confirmar Eliminación',
      `¿Deseas remover a ${userName} como administrador de esta sede?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setRemovingAdminId(userId);
            try {
              await sitesApi.removeAdmin(site.id, userId);
              Alert.alert('Éxito', 'Administrador removido correctamente');
              onAdminsUpdated();
              loadAvailableUsers();
            } catch (error: any) {
              console.error('Error removing admin:', error);
              const errorMessage =
                error.response?.data?.message || 'Error al remover administrador';
              Alert.alert('Error', errorMessage);
            } finally {
              setRemovingAdminId(null);
            }
          },
        },
      ]
    );
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
            <Text style={styles.modalTitle}>Administradores de {site.name}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Current Admins */}
            <ProtectedElement requiredPermissions={['sites.admins.list']} fallback={null}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Administradores Actuales</Text>
                {site.admins && site.admins.length > 0 ? (
                  <View style={styles.adminsList}>
                    {site.admins.map((admin) => {
                      const userName =
                        admin.user?.name || admin.user?.username || admin.user?.email || 'Usuario';
                      const userEmail = admin.user?.email || '';
                      const avatarLetter = userName.charAt(0).toUpperCase();

                      return (
                        <View key={admin.id} style={styles.adminItem}>
                          <View style={styles.adminAvatar}>
                            <Text style={styles.adminAvatarText}>{avatarLetter}</Text>
                          </View>
                          <View style={styles.adminInfo}>
                            <Text style={styles.adminName}>{userName}</Text>
                            {userEmail && <Text style={styles.adminEmail}>{userEmail}</Text>}
                          </View>
                          <ProtectedElement
                            requiredPermissions={['sites.admins.remove']}
                            fallback={null}
                          >
                            <TouchableOpacity
                              style={styles.removeButton}
                              onPress={() => handleRemoveAdmin(admin.userId, userName)}
                              disabled={removingAdminId === admin.userId}
                            >
                              {removingAdminId === admin.userId ? (
                                <ActivityIndicator size="small" color={colors.danger[500]} />
                              ) : (
                                <Text style={styles.removeButtonText}>✕</Text>
                              )}
                            </TouchableOpacity>
                          </ProtectedElement>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>No hay administradores asignados</Text>
                )}
              </View>
            </ProtectedElement>

            {/* Available Users to Add */}
            <ProtectedElement requiredPermissions={['sites.admins.add']} fallback={null}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Agregar Administrador</Text>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary[500]} />
                    <Text style={styles.loadingText}>Cargando usuarios...</Text>
                  </View>
                ) : availableUsers.length > 0 ? (
                  <View style={styles.usersList}>
                    {availableUsers.map((user) => {
                      const userName = user.name || user.username || user.email || 'Usuario';
                      const avatarLetter = userName.charAt(0).toUpperCase();

                      return (
                        <TouchableOpacity
                          key={user.id}
                          style={styles.userItem}
                          onPress={() => handleAddAdmin(user.id)}
                          disabled={addingAdmin}
                        >
                          <View style={styles.userAvatar}>
                            <Text style={styles.userAvatarText}>{avatarLetter}</Text>
                          </View>
                          <View style={styles.userInfo}>
                            <Text style={styles.userName}>{userName}</Text>
                            <Text style={styles.userEmail}>{user.email}</Text>
                          </View>
                          <View style={styles.addButton}>
                            <Text style={styles.addButtonText}>+</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>No hay usuarios disponibles para agregar</Text>
                )}
              </View>
            </ProtectedElement>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.button, styles.closeActionButton]} onPress={onClose}>
              <Text style={styles.closeActionButtonText}>Cerrar</Text>
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
    paddingBottom: spacing[5],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
    flex: 1,
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
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[3],
  },
  adminsList: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[2],
  },
  adminItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  adminAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  adminAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.danger[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 18,
    color: colors.danger[500],
    fontWeight: '600',
  },
  usersList: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[2],
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 20,
    color: colors.primary[500],
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
    paddingVertical: spacing[5],
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[5],
  },
  loadingText: {
    fontSize: 14,
    color: colors.neutral[500],
    marginLeft: spacing[2],
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
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
  },
  closeActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
  },
});

export default ManageAdminsModal;
