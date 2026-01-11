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
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { appsApi, App, GetAppsParams } from '@/services/api';
import { AppType } from '@/services/api/apps';
import { CreateAppModal } from '@/components/apps/CreateAppModal';
import { AppDetailModal } from '@/components/apps/AppDetailModal';
import { EditAppModal } from '@/components/apps/EditAppModal';
import { ScopesManagementModal } from '@/components/apps/ScopesManagementModal';
import { PermissionsManagementModal } from '@/components/apps/PermissionsManagementModal';
import { UsersManagementModal } from '@/components/apps/UsersManagementModal';
import { BottomNavigation } from '@/components/Navigation/BottomNavigation';
import { useMenuNavigation } from '@/hooks/useMenuNavigation';

interface AppsScreenProps {
  navigation: any;
}

export const AppsScreen: React.FC<AppsScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredApps, setFilteredApps] = useState<App[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showScopesModal, setShowScopesModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
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
    loadApps();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredApps(apps);
    } else {
      const filtered = apps.filter(
        (app) =>
          app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          app.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredApps(filtered);
    }
  }, [searchQuery, apps]);

  const loadApps = async (params: GetAppsParams = {}) => {
    try {
      setLoading(true);
      const response = await appsApi.getApps({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
        ...params,
      });

      setApps(response.data);
      setFilteredApps(response.data);
      setPagination(response.pagination);
    } catch (error: any) {
      console.error('Error loading apps:', error);
      const errorMessage = error.response?.data?.message || 'No se pudieron cargar las apps';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadApps();
    setRefreshing(false);
  };

  const handleAppPress = async (appId: string) => {
    try {
      const appDetails = await appsApi.getAppById(appId);
      setSelectedApp(appDetails);
      setShowDetailModal(true);
    } catch (error: any) {
      console.error('Error loading app details:', error);
      const errorMessage = error.response?.data?.message || 'No se pudo cargar la app';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleEdit = () => {
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  const handleManageScopes = () => {
    setShowDetailModal(false);
    setShowScopesModal(true);
  };

  const handleManagePermissions = () => {
    setShowDetailModal(false);
    setShowPermissionsModal(true);
  };

  const handleManageUsers = () => {
    setShowDetailModal(false);
    setShowUsersModal(true);
  };

  const handleDelete = () => {
    if (!selectedApp) return;

    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de que deseas eliminar la app "${selectedApp.name}"?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await appsApi.deleteApp(selectedApp.id);
              Alert.alert('Éxito', 'App eliminada correctamente');
              setShowDetailModal(false);
              setSelectedApp(null);
              loadApps();
            } catch (error: any) {
              console.error('Error deleting app:', error);
              const errorMessage = error.response?.data?.message || 'Error al eliminar la app';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ]
    );
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
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const getAppTypeIcon = (type: AppType): string => {
    const icons: Record<AppType, string> = {
      [AppType.SALES]: '💰',
      [AppType.POS]: '🏪',
      [AppType.ADMIN]: '⚙️',
      [AppType.INTERNAL]: '🔧',
    };
    return icons[type] || '📱';
  };

  const getAppTypeColor = (type: AppType): string => {
    const colors: Record<AppType, string> = {
      [AppType.SALES]: '#10B981',
      [AppType.POS]: '#F59E0B',
      [AppType.ADMIN]: '#667eea',
      [AppType.INTERNAL]: '#64748B',
    };
    return colors[type] || '#64748B';
  };

  const renderAppCard = (app: App) => (
    <TouchableOpacity
      key={app.id}
      style={styles.appCard}
      onPress={() => handleAppPress(app.id)}
      activeOpacity={0.7}
    >
      <View style={styles.appCardHeader}>
        <View style={styles.appIconContainer}>
          <Text style={styles.appIcon}>{getAppTypeIcon(app.appType)}</Text>
        </View>
        <View style={styles.appInfo}>
          <Text style={styles.appName}>{app.name}</Text>
          <Text style={styles.appCode}>{app.code}</Text>
        </View>
        <View
          style={[
            styles.statusIndicator,
            app.isActive ? styles.statusActive : styles.statusInactive,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              app.isActive ? styles.statusDotActive : styles.statusDotInactive,
            ]}
          />
        </View>
      </View>

      <View style={styles.appCardFooter}>
        <View
          style={[
            styles.typeBadge,
            { backgroundColor: `${getAppTypeColor(app.appType)}15` },
          ]}
        >
          <Text
            style={[
              styles.typeBadgeText,
              { color: getAppTypeColor(app.appType) },
            ]}
          >
            {app.appType}
          </Text>
        </View>
        <Text style={styles.appDate}>
          {new Date(app.createdAt).toLocaleDateString('es-ES')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>📱 Gestión de Apps</Text>
            <Text style={styles.headerSubtitle}>
              {pagination.total} {pagination.total === 1 ? 'app' : 'apps'}
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o código..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={[styles.content, isLandscape && styles.contentLandscape]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Cargando apps...</Text>
          </View>
        ) : filteredApps.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📱</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No se encontraron apps' : 'No hay apps registradas'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Intenta con otros términos de búsqueda'
                : 'Crea tu primera app para comenzar'}
            </Text>
          </View>
        ) : (
          <View style={styles.appsGrid}>
            {filteredApps.map(renderAppCard)}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <ProtectedElement requiredPermissions={['apps.manage']}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      </ProtectedElement>

      {/* Modals */}
      <CreateAppModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onAppCreated={() => {
          setShowCreateModal(false);
          loadApps();
        }}
      />

      <AppDetailModal
        visible={showDetailModal}
        app={selectedApp}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedApp(null);
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onManageScopes={handleManageScopes}
        onManagePermissions={handleManagePermissions}
        onManageUsers={handleManageUsers}
      />

      <EditAppModal
        visible={showEditModal}
        app={selectedApp}
        onClose={() => {
          setShowEditModal(false);
        }}
        onAppUpdated={() => {
          setShowEditModal(false);
          loadApps();
        }}
      />

      {/* Scopes Management Modal */}
      {selectedApp && (
        <ScopesManagementModal
          visible={showScopesModal}
          appId={selectedApp.id}
          appName={selectedApp.name}
          onClose={() => setShowScopesModal(false)}
        />
      )}

      {/* Permissions Management Modal */}
      {selectedApp && (
        <PermissionsManagementModal
          visible={showPermissionsModal}
          appId={selectedApp.id}
          appName={selectedApp.name}
          onClose={() => setShowPermissionsModal(false)}
        />
      )}

      {/* Users Management Modal */}
      {selectedApp && (
        <UsersManagementModal
          visible={showUsersModal}
          appId={selectedApp.id}
          appName={selectedApp.name}
          onClose={() => setShowUsersModal(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#1E293B',
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
  clearIcon: {
    fontSize: 16,
    color: '#94A3B8',
    paddingHorizontal: 8,
  },
  content: {
    flex: 1,
    paddingBottom: 100,
  },
  contentLandscape: {
    paddingBottom: 70,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  appsGrid: {
    padding: 16,
  },
  appCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  appCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  appIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appIcon: {
    fontSize: 24,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  appCode: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: 'monospace',
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusActive: {
    backgroundColor: '#D1FAE5',
  },
  statusInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotInactive: {
    backgroundColor: '#EF4444',
  },
  appCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  appDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
  },
});

export default AppsScreen;
