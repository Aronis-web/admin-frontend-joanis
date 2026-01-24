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
                                <ActivityIndicator size="small" color="#EF4444" />
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
                    <ActivityIndicator size="small" color="#3B82F6" />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
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
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  adminsList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 8,
  },
  adminItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  adminAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adminAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 18,
    color: '#EF4444',
    fontWeight: '600',
  },
  usersList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 20,
    color: '#3B82F6',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 20,
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
  },
  closeActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
});

export default ManageAdminsModal;
