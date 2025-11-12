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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { sitesApi, Site, GetSitesParams } from '@/services/api';
import { CreateSiteModal } from '@/components/sites/CreateSiteModal';
import { SiteDetailModal } from '@/components/sites/SiteDetailModal';
import { EditSiteModal } from '@/components/sites/EditSiteModal';
import { BottomNavigation } from '@/components/Navigation/BottomNavigation';
import { MainMenu } from '@/components/Menu/MainMenu';

interface SitesScreenProps {
  navigation: any;
}

export const SitesScreen: React.FC<SitesScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSites, setFilteredSites] = useState<Site[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [chatBadge] = useState(3);
  const [notificationsBadge] = useState(7);

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    if (!sites) {
      setFilteredSites([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setFilteredSites(sites);
    } else {
      const filtered = sites.filter(
        (site) =>
          site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          site.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (site.fullAddress && site.fullAddress.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredSites(filtered);
    }
  }, [searchQuery, sites]);

  const loadSites = async (params: GetSitesParams = {}) => {
    try {
      setLoading(true);
      const response = await sitesApi.getSites({
        page: 1,
        limit: 20,
        orderBy: 'name',
        orderDir: 'ASC',
        ...params,
      });

      setSites(response.data);
      setFilteredSites(response.data);
      setPagination({
        page: response.page,
        limit: response.limit,
        total: response.total,
      });
    } catch (error: any) {
      console.error('Error loading sites:', error);
      const errorMessage = error.response?.data?.message || 'No se pudieron cargar las sedes';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSites();
    setRefreshing(false);
  };

  const handleSitePress = async (siteId: string) => {
    try {
      const siteDetails = await sitesApi.getSiteById(siteId);
      setSelectedSite(siteDetails);
      setShowDetailModal(true);
    } catch (error: any) {
      console.error('Error loading site details:', error);
      const errorMessage = error.response?.data?.message || 'No se pudo cargar la sede';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleSiteUpdated = async () => {
    // Reload the site details to show updated admins
    if (selectedSite) {
      try {
        const updatedSite = await sitesApi.getSiteById(selectedSite.id);
        setSelectedSite(updatedSite);
      } catch (error: any) {
        console.error('Error reloading site:', error);
      }
    }
    loadSites();
  };

  const handleCreateSite = () => {
    setShowCreateModal(true);
  };

  const handleSiteCreated = () => {
    loadSites();
  };

  const handleEditSite = (site: Site) => {
    setShowDetailModal(false);
    setSelectedSite(site);
    setShowEditModal(true);
  };

  const handleSiteEditUpdated = () => {
    loadSites();
    setSelectedSite(null);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedSite(null);
  };

  const handleSiteDeleted = () => {
    loadSites();
    setSelectedSite(null);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedSite(null);
  };

  const handleMenuToggle = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleMenuSelect = (menuId: string) => {
    setIsMenuVisible(false);
    switch (menuId) {
      case 'roles-permisos':
        navigation.navigate('RolesPermissions');
        break;
      case 'usuarios':
        navigation.navigate('Users');
        break;
      case 'gestion-apps':
        navigation.navigate('Apps');
        break;
      case 'sedes':
        // Ya estamos en sedes
        break;
      case 'debug-permissions':
        navigation.navigate('PermissionsDebug');
        break;
      default:
        break;
    }
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

  const getStatusColor = (isActive: boolean) => {
    return isActive ? '#10B981' : '#EF4444';
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? 'Activo' : 'Inactivo';
  };

  const renderSiteItem = (site: Site) => (
    <TouchableOpacity
      key={site.id}
      style={styles.siteItem}
      onPress={() => handleSitePress(site.id)}
      activeOpacity={0.7}
    >
      <View style={styles.siteInfo}>
        <View style={styles.siteIcon}>
          <Text style={styles.iconText}>🏢</Text>
        </View>
        <View style={styles.siteDetails}>
          <View style={styles.siteHeader}>
            <Text style={styles.siteName}>{site.name}</Text>
            <View style={styles.codeContainer}>
              <Text style={styles.siteCode}>{site.code}</Text>
            </View>
          </View>
          {site.fullAddress && (
            <Text style={styles.siteAddress} numberOfLines={1}>
              📍 {site.fullAddress}
            </Text>
          )}
          {site.phone && (
            <Text style={styles.sitePhone}>📞 {site.phone}</Text>
          )}
        </View>
      </View>
      <View style={styles.siteStatus}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(site.isActive) }]} />
        <Text style={[styles.statusText, { color: getStatusColor(site.isActive) }]}>
          {getStatusText(site.isActive)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gestión de Sedes</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando sedes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestión de Sedes</Text>
        <ProtectedElement requiredPermissions={['sites.create']} fallback={<View style={styles.placeholder} />}>
          <TouchableOpacity onPress={handleCreateSite} style={styles.addButton}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </ProtectedElement>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar sedes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* Sites List */}
      <ScrollView
        style={styles.sitesList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredSites.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No se encontraron sedes' : 'No hay sedes registradas'}
            </Text>
          </View>
        ) : (
          filteredSites.map(renderSiteItem)
        )}
      </ScrollView>

      {/* Stats Footer */}
      <View style={styles.statsFooter}>
        <Text style={styles.statsText}>
          Total: {filteredSites.length} sede{filteredSites.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Bottom Navigation */}
      <BottomNavigation
        onChatPress={handleChatPress}
        onNotificationsPress={handleNotificationsPress}
        onMenuPress={handleMenuToggle}
        chatBadge={chatBadge}
        notificationsBadge={notificationsBadge}
      />

      {/* Main Menu */}
      <MainMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onMenuSelect={handleMenuSelect}
        onLogout={handleLogout}
      />

      {/* Create Site Modal */}
      <CreateSiteModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSiteCreated={handleSiteCreated}
      />

      {/* Site Detail Modal */}
      <SiteDetailModal
        visible={showDetailModal}
        site={selectedSite}
        onClose={handleCloseDetailModal}
        onEdit={handleEditSite}
        onSiteDeleted={handleSiteDeleted}
        onSiteUpdated={handleSiteUpdated}
      />

      {/* Edit Site Modal */}
      <EditSiteModal
        visible={showEditModal}
        site={selectedSite}
        onClose={handleCloseEditModal}
        onSiteUpdated={handleSiteEditUpdated}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  sitesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  siteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  siteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  siteIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 24,
  },
  siteDetails: {
    flex: 1,
  },
  siteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  codeContainer: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  siteCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  siteAddress: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  sitePhone: {
    fontSize: 13,
    color: '#64748B',
  },
  siteStatus: {
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
    color: '#64748B',
    textAlign: 'center',
  },
  statsFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  statsText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default SitesScreen;
