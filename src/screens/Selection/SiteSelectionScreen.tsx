import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { companiesApi, scopesApi } from '@/services/api';
import type { UserCompanySite, ResolvedScope } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/utils/config';
import { ScreenProps } from '@/types/navigation';
import { AUTH_ROUTES } from '@/constants/routes';

// Ensure AUTH_ROUTES is available
const COMPANY_SELECTION_ROUTE = AUTH_ROUTES?.COMPANY_SELECTION || 'CompanySelection';

type SiteSelectionScreenProps = ScreenProps<'SiteSelection'>;

interface LegacySiteSelectionScreenProps {
  navigation: any;
  route?: {
    params?: {
      companyId?: string;
      companyName?: string;
    };
  };
}

export const SiteSelectionScreen: React.FC<SiteSelectionScreenProps> = ({ navigation, route }) => {
  const { user, logout, currentCompany, setCurrentSite } = useAuthStore();
  const { setSelectedSite } = useTenantStore();

  // Get companyId and companyName from route params or from currentCompany
  const companyId = (route.params?.companyId || currentCompany?.id || '') as string;
  const companyName = (route.params?.companyName ||
    currentCompany?.alias ||
    currentCompany?.name ||
    '') as string;

  const [sites, setSites] = useState<UserCompanySite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  useEffect(() => {
    // Validate that we have a companyId before loading sites
    if (!companyId) {
      Alert.alert(
        'Error',
        'No se ha seleccionado una empresa. Por favor, selecciona una empresa primero.',
        [{ text: 'OK', onPress: () => navigation.replace(COMPANY_SELECTION_ROUTE as any) }]
      );
      return;
    }
    loadUserSites();
  }, [companyId]);

  const loadUserSites = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Usuario no autenticado', [
        {
          text: 'OK',
          onPress: async () => {
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          },
        },
      ]);
      return;
    }

    if (!companyId) {
      Alert.alert('Error', 'No se ha seleccionado una empresa');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Cargando sedes para companyId:', companyId, 'userId:', user.id);

      // Get the appId from config
      const appId = config.APP_ID;
      console.log('🔍 AppId:', appId);

      // Get user scopes from the scopes API instead of user_company_site
      const userScopes = await scopesApi.getUserResolvedScopes(user.id, appId);

      console.log('📦 Respuesta de scopes (tipo):', typeof userScopes);
      console.log('📦 Respuesta de scopes (es array):', Array.isArray(userScopes));
      console.log('📦 Respuesta de scopes (raw):', JSON.stringify(userScopes, null, 2));

      // Filter scopes for the current company and site level
      const companySiteScopes = userScopes.filter((scope) => {
        const matchesCompany = scope.companyId === companyId;
        const hasSite = scope.siteId !== null && scope.siteId !== undefined;
        const isSiteLevel = scope.level === 'SITE';
        return matchesCompany && hasSite && isSiteLevel;
      });

      console.log(
        '📋 Scopes filtrados para la empresa:',
        companySiteScopes.length,
        'scopes encontrados'
      );

      // Convert ResolvedScope to UserCompanySite format
      const sitesArray: UserCompanySite[] = companySiteScopes.map((scope) => ({
        userId: user.id,
        siteId: scope.siteId!,
        companyId: scope.companyId || companyId,
        site: {
          id: scope.siteId!,
          name: scope.site_name || scope.site?.name || 'Sede sin nombre',
          code: (scope.site as any)?.code || '',
        },
        canSelect: true, // If user has scope, they can select it
        createdAt: new Date().toISOString(),
      }));

      console.log('📋 Sedes procesadas:', sitesArray.length, 'sedes encontradas');
      sitesArray.forEach((site, index) => {
        console.log(`  Sede ${index + 1} - ESTRUCTURA COMPLETA:`, JSON.stringify(site, null, 2));
        console.log(`  Sede ${index + 1} - KEYS:`, Object.keys(site));
      });

      // Sort sites alphabetically by name
      const sortedSites = sitesArray.sort((a, b) => {
        const nameA = (a.site?.name || '').toLowerCase();
        const nameB = (b.site?.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      if (sortedSites.length === 0) {
        Alert.alert(
          'Sin Sedes',
          'No tienes acceso a ninguna sede en esta empresa. Contacta al administrador.',
          [
            { text: 'Volver', onPress: () => navigation.replace('CompanySelection') },
            {
              text: 'Cerrar Sesión',
              onPress: async () => {
                await logout();
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              },
              style: 'destructive',
            },
          ]
        );
        return;
      }

      setSites(sortedSites);

      // If user has only one site, auto-select it and proceed to home
      if (sortedSites.length === 1) {
        console.log('✨ Solo hay 1 sede, auto-seleccionando...');
        await handleSiteSelect(sortedSites[0]);
      }
    } catch (error: any) {
      console.error('❌ Error loading sites:', error);
      console.error('Error details:', error.response?.data);
      const errorMessage = error.response?.data?.message || 'No se pudieron cargar las sedes';
      Alert.alert('Error', errorMessage, [
        { text: 'Reintentar', onPress: loadUserSites },
        { text: 'Volver', onPress: () => navigation.replace('CompanySelection') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSiteSelect = async (site: UserCompanySite) => {
    try {
      // Handle different possible API response structures
      const siteId = site.siteId || (site as any).Site?.id;
      const siteName = site.site?.name || (site as any).Site?.name || (site as any).name || '';
      const siteCode = site.site?.code || (site as any).Site?.code || (site as any).code || '';

      if (!siteId) {
        console.error('❌ No se pudo obtener el ID de la sede:', site);
        Alert.alert('Error', 'No se pudo identificar la sede seleccionada');
        return;
      }

      setSelectedSiteId(siteId);

      console.log('🏪 Iniciando selección de sede:', {
        siteId,
        siteName,
        siteCode,
        canSelect: site.canSelect,
        rawSiteObject: site,
      });

      // Prepare site data
      const siteData = {
        id: siteId,
        code: siteCode,
        name: siteName,
        companyId: companyId || site.companyId || (site as any).CompanyId || '',
      };

      console.log('📝 Datos de sede preparados:', siteData);

      // Save to AsyncStorage first
      await AsyncStorage.setItem(config.STORAGE_KEYS.CURRENT_SITE, JSON.stringify(siteData));

      console.log('💾 Sede guardada en AsyncStorage');

      // Update the auth store - this will trigger Navigation re-render
      setCurrentSite(siteData);
      console.log('✅ Auth store actualizado con sede');

      // Also update the tenant store to keep them in sync
      const tenantSiteData = {
        ...siteData,
        isActive: true, // Assume active since user can select it
      };
      await setSelectedSite(tenantSiteData);
      console.log('✅ Tenant store actualizado con sede');

      // Give stores time to update before navigation check
      await new Promise((resolve) => setTimeout(resolve, 200));

      console.log('🚀 Stores actualizados - Verificando estado de navegación...');

      // Check if we have all required data
      const authState = useAuthStore.getState();
      console.log('📊 Estado actual del auth store:', {
        isAuthenticated: authState.isAuthenticated,
        currentCompany: authState.currentCompany,
        currentSite: authState.currentSite,
      });

      // Navigate to Home screen - this should work because Navigation will detect the state change
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      console.error('❌ Error selecting site:', error);
      Alert.alert('Error', 'No se pudo seleccionar la sede');
      setSelectedSiteId(null);
    }
  };

  const handleBack = () => {
    navigation.replace(COMPANY_SELECTION_ROUTE as any);
  };

  const handleLogout = async () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
          // Navigate to login screen after logout
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Cargando sedes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🏪 Seleccionar Sede</Text>
          <Text style={styles.headerSubtitle}>{companyName}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>Selecciona la sede con la que deseas trabajar</Text>
        </View>

        <View style={styles.sitesContainer}>
          {sites.map((userSite, index) => {
            // Handle different possible API response structures
            const siteId =
              userSite.siteId || (userSite as any).Site?.id || `site-${index}`;
            const siteName =
              userSite.site?.name ||
              (userSite as any).Site?.name ||
              (userSite as any).name ||
              'Sede sin nombre';
            const siteCode =
              userSite.site?.code || (userSite as any).Site?.code || (userSite as any).code;
            const canSelect = userSite.canSelect !== undefined ? userSite.canSelect : true;

            return (
              <TouchableOpacity
                key={siteId}
                style={[
                  styles.siteCard,
                  selectedSiteId === siteId && styles.siteCardSelected,
                  !canSelect && styles.siteCardDisabled,
                ]}
                onPress={() => handleSiteSelect(userSite)}
                activeOpacity={0.7}
                disabled={selectedSiteId === siteId || !canSelect}
              >
                <View style={styles.siteCardContent}>
                  <View style={styles.siteIconContainer}>
                    <Text style={styles.siteIcon}>🏪</Text>
                  </View>
                  <View style={styles.siteInfo}>
                    <Text style={styles.siteName}>{siteName}</Text>
                    {siteCode && <Text style={styles.siteCode}>Código: {siteCode}</Text>}
                    <View style={styles.siteFooter}>
                      {!canSelect && (
                        <View style={styles.restrictedBadge}>
                          <Text style={styles.restrictedText}>🔒 Acceso Restringido</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {selectedSiteId === siteId && (
                    <View style={styles.loadingIndicator}>
                      <ActivityIndicator size="small" color="#667eea" />
                    </View>
                  )}
                </View>
                {canSelect && (
                  <View style={styles.arrowContainer}>
                    <Text style={styles.arrow}>→</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {sites.filter((s) => s.canSelect).length} de {sites.length}{' '}
            {sites.length === 1 ? 'sede disponible' : 'sedes disponibles'}
          </Text>
        </View>
      </ScrollView>
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
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 24,
    color: '#1E293B',
    fontWeight: '600',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    marginLeft: 12,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  sitesContainer: {
    gap: 12,
  },
  siteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  siteCardSelected: {
    borderColor: '#667eea',
    backgroundColor: '#F5F7FF',
  },
  siteCardDisabled: {
    opacity: 0.5,
    backgroundColor: '#F8FAFC',
  },
  siteCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  siteIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  siteIcon: {
    fontSize: 28,
  },
  siteInfo: {
    flex: 1,
  },
  siteName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  siteCode: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  siteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restrictedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  restrictedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  loadingIndicator: {
    marginLeft: 12,
  },
  arrowContainer: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  arrow: {
    fontSize: 24,
    color: '#667eea',
  },
  footer: {
    marginTop: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});

export default SiteSelectionScreen;
