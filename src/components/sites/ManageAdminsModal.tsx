import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Site, SiteAdmin } from '@/types/sites';
import { sitesApi, usersApi, User } from '@/services/api';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import Alert from '@/utils/alert';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
                                <ActivityIndicator size="small" color={theme.color.text.danger} />
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
                    <ActivityIndicator size="small" color={theme.color.brand.primary} />
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
      paddingBottom: theme.space[5],
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
      flex: 1,
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
    scrollContent: {
      paddingHorizontal: theme.space[6],
      paddingTop: theme.space[5],
    },
    section: {
      marginBottom: theme.space[6],
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
    },
    adminsList: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[2],
    },
    adminItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    adminAvatar: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.brand.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    adminAvatarText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    adminInfo: {
      flex: 1,
    },
    adminName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 2,
    },
    adminEmail: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    removeButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.state.danger.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    removeButtonText: {
      fontSize: 18,
      color: theme.color.text.danger,
      fontWeight: '600',
    },
    usersList: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[2],
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    userAvatar: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.action.success.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    userAvatarText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 2,
    },
    userEmail: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    addButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addButtonText: {
      fontSize: 20,
      color: theme.color.brand.primary,
      fontWeight: '600',
    },
    emptyText: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
      paddingVertical: theme.space[5],
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.space[5],
    },
    loadingText: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginLeft: theme.space[2],
    },
    modalActions: {
      flexDirection: 'row',
      paddingHorizontal: theme.space[6],
      paddingTop: theme.space[5],
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
    },
    closeActionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
  });

export default ManageAdminsModal;
