import React, { useState, useEffect, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { useAuthStore } from '@/store/auth';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { usersApi, User, GetUsersParams } from '@/services/api';
import { CreateUserModal } from '@/components/users/CreateUserModal';
import { UserDetailModal } from '@/components/users/UserDetailModal';
import { EditUserModal } from '@/components/users/EditUserModal';
import { PaginationControls } from '@/components/Pagination/PaginationControls';
import { MAIN_ROUTES } from '@/constants/routes';

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
  const [appliedSearch, setAppliedSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [chatBadge] = useState(3);
  const [notificationsBadge] = useState(7);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Load users on mount and when page or search changes
  useEffect(() => {
    loadUsers();
  }, [pagination.page, appliedSearch]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params: GetUsersParams = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: 'created_at',
        sortOrder: 'DESC',
      };

      if (appliedSearch.trim()) {
        params.search = appliedSearch.trim();
      }

      const response = await usersApi.getUsers(params);

      // Ensure response.data is an array before setting
      const usersData = Array.isArray(response.data) ? response.data : [];
      console.log('UsersScreen - Loaded users:', usersData.length);
      if (usersData.length > 0) {
        console.log('UsersScreen - First user has_biometric:', usersData[0]?.has_biometric);
      }
      setUsers(usersData);
      setPagination(prev => ({
        ...prev,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      }));
    } catch (error: any) {
      console.error('Error loading users:', error);
      const errorMessage = error.response?.data?.message || 'No se pudieron cargar los usuarios';
      Alert.alert('Error', errorMessage);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, appliedSearch]);

  // Handle search submit
  const handleSearch = useCallback(() => {
    setAppliedSearch(searchQuery);
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchQuery]);

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setAppliedSearch('');
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  // Pagination handlers
  const handlePreviousPage = useCallback(() => {
    if (pagination.page > 1) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }
  }, [pagination.page]);

  const handleNextPage = useCallback(() => {
    if (pagination.page < pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  }, [pagination.page, pagination.totalPages]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  }, [loadUsers]);

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

  // Biometric action handlers
  const handleRegisterBiometric = useCallback((user: User) => {
    setShowDetailModal(false);
    navigation.navigate(MAIN_ROUTES.REGISTER_FACE, {
      userId: user.id,
      userName: user.username || user.first_name || user.email,
    });
  }, [navigation]);

  const handleUpdateBiometric = useCallback((user: User) => {
    setShowDetailModal(false);
    navigation.navigate(MAIN_ROUTES.REGISTER_FACE, {
      userId: user.id,
      userName: user.username || user.first_name || user.email,
      mode: 'update',
    });
  }, [navigation]);

  const handleVerifyBiometric = useCallback((user: User) => {
    setShowDetailModal(false);
    navigation.navigate(MAIN_ROUTES.VERIFY_FACE, {
      userId: user.id,
      userName: user.username || user.first_name || user.email,
    });
  }, [navigation]);

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
    const displayName = user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.username || user.name || user.email;

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
              {(displayName || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>{displayName}</Text>
              {user.has_biometric && (
                <View style={styles.biometricBadge}>
                  <Text style={styles.biometricBadgeText}>🔐</Text>
                </View>
              )}
            </View>
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
        <View style={styles.searchInputWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar usuarios..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            placeholderTextColor={colors.neutral[400]}
            keyboardType="default"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Applied search indicator */}
      {appliedSearch && (
        <View style={styles.searchIndicator}>
          <Text style={styles.searchIndicatorText}>
            Búsqueda: "{appliedSearch}"
          </Text>
          <TouchableOpacity onPress={handleClearSearch}>
            <Text style={styles.searchIndicatorClear}>Limpiar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Users List */}
      <ScrollView
        style={[styles.usersList, isLandscape && styles.usersListLandscape]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !refreshing ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {appliedSearch ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
            </Text>
          </View>
        ) : (
          users.map(renderUserItem)
        )}
      </ScrollView>

      {/* Pagination Controls */}
      {pagination.totalPages > 0 && (
        <PaginationControls
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          itemLabel="usuarios"
        />
      )}

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
        onRegisterBiometric={handleRegisterBiometric}
        onUpdateBiometric={handleUpdateBiometric}
        onVerifyBiometric={handleVerifyBiometric}
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
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    gap: spacing[3],
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.neutral[800],
  },
  clearButton: {
    padding: spacing[2],
  },
  clearButtonText: {
    fontSize: 16,
    color: colors.neutral[400],
  },
  searchButton: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 18,
  },
  searchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    backgroundColor: colors.primary[50],
  },
  searchIndicatorText: {
    fontSize: 13,
    color: colors.primary[700],
  },
  searchIndicatorClear: {
    fontSize: 13,
    color: colors.primary[500],
    fontWeight: '600',
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[10],
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
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  biometricBadge: {
    backgroundColor: colors.success[100],
    paddingHorizontal: spacing[1.5],
    paddingVertical: 2,
    borderRadius: borderRadius.md,
  },
  biometricBadgeText: {
    fontSize: 12,
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
});

export default UsersScreen;
