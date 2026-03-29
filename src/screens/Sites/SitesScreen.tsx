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
import { sitesApi, Site, GetSitesParams } from '@/services/api';
import { CreateSiteModal } from '@/components/sites/CreateSiteModal';
import { SiteDetailModal } from '@/components/sites/SiteDetailModal';
import { EditSiteModal } from '@/components/sites/EditSiteModal';

import { useMenuNavigation } from '@/hooks/useMenuNavigation';

interface SitesScreenProps {
  navigation: any;
  route?: {
    params?: {
      companyId?: string;
      companyName?: string;
    };
  };
}

export const SitesScreen: React.FC<SitesScreenProps> = ({ navigation, route }) => {
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
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Get company filter from route params
  const companyId = route?.params?.companyId;
  const companyName = route?.params?.companyName;

  useEffect(() => {
    loadSites();
  }, [companyId]);

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
        companyId: companyId, // Filter by company if provided
        ...params,
      });

      setSites(response.data);
      setFilteredSites(response.data);
      setPagination({
        page: response.meta.page,
        limit: response.meta.limit,
        total: response.meta.total,
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

  const getStatusColor = (isActive: boolean) => {
    return isActive ? colors.success[500] : colors.danger[500];
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
          {site.phone && <Text style={styles.sitePhone}>📞 {site.phone}</Text>}
        </View>
      </View>
      <View style={styles.siteStatus}>
        <View
          style={[styles.statusIndicator, { backgroundColor: getStatusColor(site.isActive) }]}
        />
        <Text style={[styles.statusText, { color: getStatusColor(site.isActive) }]}>
          {getStatusText(site.isActive)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Si no hay companyId, mostrar mensaje de error
  if (!companyId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gestión de Sedes</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateIcon}>🏭</Text>
          <Text style={styles.emptyStateTitle}>Empresa no seleccionada</Text>
          <Text style={styles.emptyStateMessage}>
            Las sedes deben crearse dentro de una empresa.
          </Text>
          <Text style={styles.emptyStateMessage}>
            Por favor, ve a "Empresas y Sedes" y selecciona una empresa primero.
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => navigation.navigate('Companies')}
          >
            <Text style={styles.emptyStateButtonText}>Ir a Empresas</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Gestión de Sedes</Text>
            {companyName && <Text style={styles.headerSubtitle}>🏭 {companyName}</Text>}
          </View>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando sedes...</Text>
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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Gestión de Sedes</Text>
          {companyName && <Text style={styles.headerSubtitle}>🏭 {companyName}</Text>}
        </View>
        <ProtectedElement
          requiredPermissions={['sites.create']}
          fallback={<View style={styles.placeholder} />}
        >
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
          placeholderTextColor={colors.neutral[400]}
        />
      </View>

      {/* Sites List */}
      <ScrollView
        style={[styles.sitesList, isLandscape && styles.sitesListLandscape]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
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

      {/* Create Site Modal */}
      <CreateSiteModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSiteCreated={handleSiteCreated}
        companyId={companyId} // Pass companyId from route params
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
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 24,
    color: colors.neutral[0],
    fontWeight: '600',
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
  sitesList: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingBottom: 100,
  },
  sitesListLandscape: {
    paddingBottom: 70,
  },
  siteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: colors.neutral[950],
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
    backgroundColor: colors.accent[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
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
    color: colors.neutral[800],
    flex: 1,
  },
  codeContainer: {
    backgroundColor: colors.accent[50],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.md,
    marginLeft: spacing[2],
  },
  siteCode: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[500],
  },
  siteAddress: {
    fontSize: 13,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  sitePhone: {
    fontSize: 13,
    color: colors.neutral[500],
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
    color: colors.neutral[500],
    textAlign: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
    marginBottom: spacing[2],
    lineHeight: 20,
  },
  emptyStateButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    marginTop: spacing[4],
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
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

export default SitesScreen;
