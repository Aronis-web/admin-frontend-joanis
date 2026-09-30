import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { usersApi, User, GetUsersParams } from '@/services/api';
import { CreateUserModal } from '@/components/users/CreateUserModal';
import { UserDetailModal } from '@/components/users/UserDetailModal';
import { EditUserModal } from '@/components/users/EditUserModal';
import { UsersBulkModal, UsersBulkMode } from '@/components/users/UsersBulkModal';
import { Pagination } from '@/design-system';
import { MAIN_ROUTES } from '@/constants/routes';
import Alert from '@/utils/alert';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';

interface UsersScreenProps {
  navigation: any;
}

export const UsersScreen: React.FC<UsersScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<UsersBulkMode | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const trimmedQuery = searchQuery.trim();
  const isSearchPending = trimmedQuery.length >= 3 && trimmedQuery !== appliedSearch;

  // Load users on mount and when page or applied search changes
  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, appliedSearch]);

  // Autocompletado: dispara la busqueda automaticamente cuando el usuario
  // escribe mas de dos letras (>=3). Se limpia al vaciar o quedar con <=2.
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length === 0) {
      if (appliedSearch !== '') {
        setAppliedSearch('');
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
      return;
    }
    if (trimmed.length < 3) return;
    if (trimmed === appliedSearch) return;

    const handle = setTimeout(() => {
      setAppliedSearch(trimmed);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

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

      const usersData = Array.isArray(response.data) ? response.data : [];
      setUsers(usersData);
      setPagination((prev) => ({
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

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setAppliedSearch('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  }, [loadUsers]);

  const handleUserPress = async (userId: string) => {
    try {
      const [userDetails, userRoles] = await Promise.all([
        usersApi.getUserById(userId),
        usersApi.getUserRoles(userId),
      ]);

      setSelectedUser({ ...userDetails, roles: userRoles });
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
  const handleRegisterBiometric = useCallback(
    (user: User) => {
      setShowDetailModal(false);
      navigation.navigate(MAIN_ROUTES.REGISTER_FACE, {
        userId: user.id,
        userName: user.username || user.first_name || user.email,
      });
    },
    [navigation]
  );

  const handleUpdateBiometric = useCallback(
    (user: User) => {
      setShowDetailModal(false);
      navigation.navigate(MAIN_ROUTES.REGISTER_FACE, {
        userId: user.id,
        userName: user.username || user.first_name || user.email,
        mode: 'update',
      });
    },
    [navigation]
  );

  const handleVerifyBiometric = useCallback(
    (user: User) => {
      setShowDetailModal(false);
      navigation.navigate(MAIN_ROUTES.VERIFY_FACE, {
        userId: user.id,
        userName: user.username || user.first_name || user.email,
      });
    },
    [navigation]
  );

  const getStatusColor = (status: string) => {
    return status === 'active' ? theme.color.state.success.border : theme.color.state.danger.border;
  };

  const getStatusText = (status: string) => {
    return status === 'active' ? 'Activo' : 'Inactivo';
  };

  const renderUserItem = (user: User) => {
    const userStatus = user.status || (user.is_active ? 'active' : 'inactive');
    const displayName =
      user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.username || user.name || user.email;
    const statusColor = getStatusColor(userStatus);

    return (
      <TouchableOpacity
        key={user.id}
        style={[styles.userCard, isTablet && styles.userCardTablet]}
        onPress={() => handleUserPress(user.id)}
        activeOpacity={0.7}
      >
        <View style={styles.userAvatar}>
          <Text style={styles.avatarText}>{(displayName || 'U').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, isTablet && styles.userNameTablet]} numberOfLines={1}>
              {displayName}
            </Text>
            {user.has_biometric && (
              <View style={styles.biometricBadge}>
                <Text style={styles.biometricBadgeText}>🔐</Text>
              </View>
            )}
          </View>
          <Text style={[styles.userEmail, isTablet && styles.userEmailTablet]} numberOfLines={1}>
            {user.email}
          </Text>
          {user.roles && Array.isArray(user.roles) && user.roles.length > 0 && (
            <Text style={styles.userRoles} numberOfLines={1}>
              {user.roles.map((role) => role.name).join(', ')}
            </Text>
          )}
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '1A' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {getStatusText(userStatus)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>Usuarios</Text>
          <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
            Gestión de accesos y roles
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, isTablet && styles.searchContainerTablet]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, isTablet && styles.searchInputTablet]}
          placeholder="Buscar por nombre, usuario o correo..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.color.text.placeholder}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
        {isSearchPending && (
          <ActivityIndicator
            size="small"
            color={theme.color.brand.accent}
            style={styles.searchLoader}
          />
        )}
      </View>

      {/* Users List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
            <Text style={styles.loadingText}>Cargando usuarios...</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              {appliedSearch
                ? 'No se encontraron usuarios con esa búsqueda'
                : 'No hay usuarios registrados'}
            </Text>
            {!appliedSearch && (
              <ProtectedElement requiredPermissions={['users.create']} fallback={null}>
                <TouchableOpacity style={styles.emptyButton} onPress={handleCreateUser}>
                  <Text style={styles.emptyButtonText}>Crear primer usuario</Text>
                </TouchableOpacity>
              </ProtectedElement>
            )}
          </View>
        ) : (
          <View style={styles.usersList}>{users.map(renderUserItem)}</View>
        )}
      </ScrollView>

      {/* Pagination Controls */}
      {!loading && pagination.totalPages > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
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

      {/* Bulk Users Modal (creacion / actualizacion masiva) */}
      <UsersBulkModal
        visible={bulkMode !== null}
        mode={bulkMode ?? 'create'}
        onClose={() => setBulkMode(null)}
        onSuccess={loadUsers}
      />

      {/* Add Button */}
      <ProtectedFAB
        actions={[
          {
            icon: 'person-add-outline',
            label: 'Crear Usuario',
            onPress: handleCreateUser,
            requiredPermissions: ['users.create'],
          },
          {
            icon: 'cloud-upload-outline',
            label: 'Creación masiva',
            onPress: () => setBulkMode('create'),
            requiredPermissions: ['users.create'],
          },
          {
            icon: 'sync-outline',
            label: 'Actualización masiva',
            onPress: () => setBulkMode('update'),
            requiredPermissions: ['users.update'],
          },
        ]}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[4],
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerTablet: {
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[5],
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButtonText: {
      fontSize: 20,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    headerTitles: {
      flex: 1,
      marginLeft: theme.space[4],
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    headerTitleTablet: {
      fontSize: 24,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    headerSubtitleTablet: {
      fontSize: 15,
    },
    headerSpacer: {
      width: 40,
    },
    // Search
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      marginHorizontal: theme.space[5],
      marginVertical: theme.space[4],
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    searchContainerTablet: {
      marginHorizontal: theme.space[8],
      paddingVertical: theme.space[3.5],
    },
    searchIcon: {
      fontSize: 20,
      marginRight: theme.space[3],
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.color.text.body,
      padding: 0,
    },
    searchInputTablet: {
      fontSize: 17,
    },
    clearButton: {
      padding: theme.space[1],
    },
    clearButtonText: {
      fontSize: 18,
      color: theme.color.text.placeholder,
    },
    searchLoader: {
      marginLeft: theme.space[2],
    },
    // List
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: theme.space[5],
      paddingBottom: 100,
    },
    contentContainerTablet: {
      paddingHorizontal: theme.space[8],
    },
    usersList: {
      gap: theme.space[3],
    },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      ...theme.shadow.sm,
    },
    userCardTablet: {
      padding: theme.space[5],
    },
    userAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.color.brand.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
    userInfo: {
      flex: 1,
    },
    userNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    userName: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 2,
    },
    userNameTablet: {
      fontSize: 18,
    },
    biometricBadge: {
      backgroundColor: theme.color.state.success.background,
      paddingHorizontal: theme.space[1.5],
      paddingVertical: 2,
      borderRadius: theme.radii.md,
    },
    biometricBadgeText: {
      fontSize: 12,
    },
    userEmail: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginBottom: 2,
    },
    userEmailTablet: {
      fontSize: 14,
    },
    userRoles: {
      fontSize: 12,
      color: theme.color.brand.accent,
      fontWeight: '600',
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1.5],
      paddingHorizontal: theme.space[2.5],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.full,
      marginLeft: theme.space[2],
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    // Loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    loadingText: {
      marginTop: theme.space[4],
      fontSize: 15,
      color: theme.color.text.muted,
    },
    // Empty
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: theme.space[4],
    },
    emptyText: {
      fontSize: 16,
      color: theme.color.text.muted,
      marginBottom: theme.space[6],
      textAlign: 'center',
    },
    emptyTextTablet: {
      fontSize: 18,
    },
    emptyButton: {
      backgroundColor: theme.color.brand.accent,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[8],
      borderRadius: theme.radii.lg,
    },
    emptyButtonText: {
      color: theme.color.text.inverse,
      fontSize: 15,
      fontWeight: '600',
    },
  });

export default UsersScreen;
