import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { useAuthStore } from '@/store/auth';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { usersApi, User, GetUsersParams } from '@/services/api';
import { CreateUserModal } from '@/components/users/CreateUserModal';
import { UserDetailModal } from '@/components/users/UserDetailModal';
import { EditUserModal } from '@/components/users/EditUserModal';

import { useMenuNavigation } from '@/hooks/useMenuNavigation';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';

interface UsersScreenProps {
  navigation: any;
}

export const UsersScreen: React.FC<UsersScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [chatBadge] = useState(3);
  const [notificationsBadge] = useState(7);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    // Ensure users is an array before filtering
    if (!Array.isArray(users)) {
      setFilteredUsers([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(
        (user) =>
          (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const loadUsers = async (params: GetUsersParams = {}) => {
    try {
      setLoading(true);
      const response = await usersApi.getUsers({
        page: 1,
        limit: 20,
        sortBy: 'created_at',
        sortOrder: 'DESC',
        ...params,
      });

      // Ensure response.data is an array before setting
      const usersData = Array.isArray(response.data) ? response.data : [];
      console.log('UsersScreen - Loaded users:', usersData);
      if (usersData.length > 0) {
        console.log('UsersScreen - First user:', usersData[0]);
        console.log('UsersScreen - First user status:', usersData[0]?.status);
        console.log('UsersScreen - First user is_active:', usersData[0]?.is_active);
      }
      setUsers(usersData);
      setFilteredUsers(usersData);
      setPagination(response.pagination);
    } catch (error: any) {
      console.error('Error loading users:', error);
      const errorMessage = error.response?.data?.message || 'No se pudieron cargar los usuarios';
      Alert.alert('Error', errorMessage);
      // Set empty arrays on error to prevent undefined issues
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleUserPress = async (userId: string) => {
    try {
      // Fetch user details and roles separately
      const [userDetails, userRoles] = await Promise.all([
        usersApi.getUserById(userId),
        usersApi.getUserRoles(userId),
      ]);

      console.log('UsersScreen - User details from API:', userDetails);
      console.log('UsersScreen - User roles from API:', userRoles);
      console.log('UsersScreen - User details is_active:', userDetails.is_active);
      console.log('UsersScreen - User details status:', userDetails.status);

      // Merge roles into user object
      const userWithRoles = {
        ...userDetails,
        roles: userRoles,
      };

      console.log('UsersScreen - User with roles merged:', userWithRoles);
      setSelectedUser(userWithRoles);
      setShowDetailModal(true);
    } catch (error: any) {
      console.error('Error loading user details:', error);
      const errorMessage = error.response?.data?.message || 'No se pudo cargar el usuario';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleCreateUser = () => {
    setShowCreateModal(true);
  };

  const handleUserCreated = () => {
    loadUsers();
  };

  const handleEditUser = (user: User) => {
    setShowDetailModal(false);
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleUserUpdated = () => {
    loadUsers();
    setSelectedUser(null);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedUser(null);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
  };

  const handleMenuToggle = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  // Use the shared navigation hook for consistent menu navigation
  const navigateFromMenu = useMenuNavigation(navigation);

  const handleMenuSelect = (menuId: string) => {
    setIsMenuVisible(false);
    navigateFromMenu(menuId);
  };

  const handleLogout = async () => {
    setIsMenuVisible(false);
    await logout();
  };

  const handleChatPress = () => {
    console.log('Abrir chat');
  };

  const handleNotificationsPress = () => {
    console.log('Abrir notificaciones');
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? colors.success[500] : colors.danger[500];
  };

  const getStatusText = (status: string) => {
    return status === 'active' ? 'Activo' : 'Inactivo';
  };

  const renderUserItem = (user: User) => {
    // Determine status from either status field or is_active field
    const userStatus = user.status || (user.is_active ? 'active' : 'inactive');
    console.log(
      `User ${user.email} - status: ${user.status}, is_active: ${user.is_active}, computed: ${userStatus}`
    );

    return (
      <TouchableOpacity
        key={user.id}
        style={styles.userItem}
        onPress={() => handleUserPress(user.id)}
        activeOpacity={0.7}
      >
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Text style={styles.avatarText}>
              {(user.name || user.email || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user.name || user.email}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            {user.roles && Array.isArray(user.roles) && user.roles.length > 0 && (
              <Text style={styles.userRoles}>{user.roles.map((role) => role.name).join(', ')}</Text>
            )}
          </View>
        </View>
        <View style={styles.userStatus}>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(userStatus) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(userStatus) }]}>
            {getStatusText(userStatus)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gestión de Usuarios</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando usuarios...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestión de Usuarios</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar usuarios..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.neutral[400]}
          keyboardType="default"
        />
      </View>

      {/* Users List */}
      <ScrollView
        style={[styles.usersList, isLandscape && styles.usersListLandscape]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
            </Text>
          </View>
        ) : (
          filteredUsers.map(renderUserItem)
        )}
      </ScrollView>

      {/* Stats Footer */}
      <View style={styles.statsFooter}>
        <Text style={styles.statsText}>
          Total: {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Create User Modal */}
      <CreateUserModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onUserCreated={handleUserCreated}
      />

      {/* User Detail Modal */}
      <UserDetailModal
        visible={showDetailModal}
        user={selectedUser}
        onClose={handleCloseDetailModal}
        onEdit={handleEditUser}
      />

      {/* Edit User Modal */}
      <EditUserModal
        visible={showEditModal}
        user={selectedUser}
        onClose={handleCloseEditModal}
        onUserUpdated={handleUserUpdated}
      />

      {/* Add Button */}
      <ProtectedFAB
        icon="👥"
        onPress={handleCreateUser}
        requiredPermissions={['users.create']}
        hideIfNoPermission={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.neutral[500],
  },
  searchContainer: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  searchInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.neutral[800],
  },
  usersList: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingBottom: 100,
  },
  usersListLandscape: {
    paddingBottom: 70,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  userRoles: {
    fontSize: 12,
    color: colors.primary[500],
    fontWeight: '500',
  },
  userStatus: {
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  statsFooter: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  statsText: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default UsersScreen;
