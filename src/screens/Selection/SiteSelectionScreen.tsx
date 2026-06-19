import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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

export const SiteSelectionScreen: React.FC<any> = ({ navigation, route }: SiteSelectionScreenProps) => {
  const { user, logout, currentCompany, setCurrentSite } = useAuthStore();
  const { setSelectedSite } = useTenantStore();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Get companyId and companyName from route params or from currentCompany
  const companyId = (route?.params?.companyId || currentCompany?.id || '') as string;
  const companyName = (route?.params?.companyName ||
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
      // Usamos un límite alto para asegurar que se traigan todas las sedes disponibles
      const userScopesResponse = await scopesApi.getUserResolvedScopes(user.id, appId, { limit: 1000 });

      console.log('📦 Respuesta de scopes (tipo):', typeof userScopesResponse);
      console.log('📦 Respuesta de scopes (es array):', Array.isArray(userScopesResponse));
      console.log('📦 Respuesta de scopes (raw):', JSON.stringify(userScopesResponse, null, 2));

      // Handle both array and paginated response formats
      const userScopes: ResolvedScope[] = Array.isArray(userScopesResponse)
        ? userScopesResponse
        : (userScopesResponse as any)?.items || [];

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
          name: scope.site?.name || (scope as any).site_name || 'Sede sin nombre',
          code: (scope.site as any)?.code || (scope as any).code || '',
        },
        canSelect: true, // If user has scope, they can select it
        createdAt: new Date().toISOString(),
      }));

      console.log('📋 Sedes procesadas:', sitesArray.length, 'sedes encontradas');
      sitesArray.forEach((site, index) => {
        console.log(`  Sede ${index + 1} - ESTRUCTURA COMPLETA:`, JSON.stringify(site, null, 2));
        console.log(`  Sede ${index + 1} - KEYS:`, site ? Object.keys(site) : 'undefined');
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
          <View style={styles.loadingIconContainer}>
            <Ionicons name="storefront" size={48} color={theme.color.brand.accent} />
          </View>
          <ActivityIndicator size="large" color={theme.color.brand.accent} style={{ marginTop: theme.space[4] }} />
          <Text style={styles.loadingText}>Cargando sedes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header con gradiente */}
      <LinearGradient
        colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={theme.color.brand.onHeader} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="storefront" size={24} color={theme.color.brand.onHeader} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Seleccionar Sede
            </Text>
            <View style={styles.companyBadge}>
              <Ionicons name="business-outline" size={12} color={theme.color.brand.onHeaderMuted} />
              <Text style={styles.headerSubtitle}>{companyName}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={theme.color.icon.danger} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="information-circle" size={24} color={theme.color.state.info.border} />
          </View>
          <Text style={styles.infoText}>
            Selecciona la sede con la que deseas trabajar
          </Text>
        </View>

        {/* Sites Grid */}
        <View style={[styles.sitesContainer, isTablet && styles.sitesContainerTablet]}>
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
                  isTablet && styles.siteCardTablet,
                  selectedSiteId === siteId && styles.siteCardSelected,
                  !canSelect && styles.siteCardDisabled,
                ]}
                onPress={() => handleSiteSelect(userSite)}
                activeOpacity={0.7}
                disabled={selectedSiteId === siteId || !canSelect}
              >
                <View style={styles.siteCardContent}>
                  <LinearGradient
                    colors={
                      !canSelect
                        ? [theme.color.border.strong, theme.color.text.muted]
                        : selectedSiteId === siteId
                          ? [theme.color.brand.avatarFrom, theme.color.brand.avatarTo]
                          : [theme.color.state.success.border, theme.color.state.success.text]
                    }
                    style={styles.siteIconContainer}
                  >
                    <Ionicons
                      name={canSelect ? 'storefront' : 'lock-closed'}
                      size={22}
                      color={theme.color.brand.onHeader}
                    />
                  </LinearGradient>
                  <View style={styles.siteInfo}>
                    <Text style={[styles.siteName, isTablet && styles.siteNameTablet, !canSelect && styles.siteNameDisabled]}>
                      {siteName}
                    </Text>
                    {siteCode && (
                      <View style={styles.codeContainer}>
                        <Ionicons name="pricetag-outline" size={12} color={theme.color.text.placeholder} />
                        <Text style={styles.siteCode}>{siteCode}</Text>
                      </View>
                    )}
                    {!canSelect && (
                      <View style={styles.restrictedBadge}>
                        <Ionicons name="lock-closed" size={10} color={theme.color.state.warning.text} />
                        <Text style={styles.restrictedText}>Acceso Restringido</Text>
                      </View>
                    )}
                  </View>
                  {selectedSiteId === siteId ? (
                    <ActivityIndicator size="small" color={theme.color.brand.accent} />
                  ) : canSelect ? (
                    <View style={styles.arrowContainer}>
                      <Ionicons name="chevron-forward" size={24} color={theme.color.text.placeholder} />
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <View style={styles.footerContent}>
            <Ionicons name="location-outline" size={16} color={theme.color.text.placeholder} />
            <Text style={styles.footerText}>
              {sites.filter((s) => s.canSelect !== false).length} de {sites.length}{' '}
              {sites.length === 1 ? 'sede disponible' : 'sedes disponibles'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  header: {
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[5],
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
    marginBottom: theme.space[0.5],
    letterSpacing: 0.3,
  },
  headerTitleTablet: {
    fontSize: 24,
  },
  companyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1],
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.color.background.subtle,
  },
  loadingIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.color.brand.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.space[4],
    fontSize: 16,
    color: theme.color.text.muted,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.space[5],
    paddingBottom: theme.space[10],
  },
  contentContainerTablet: {
    paddingHorizontal: theme.space[8],
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  infoCard: {
    backgroundColor: theme.color.state.info.background,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    marginBottom: theme.space[6],
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.state.info.background,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.state.info.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: theme.color.state.info.text,
    lineHeight: 20,
    fontWeight: '500',
  },
  sitesContainer: {
    gap: theme.space[3],
  },
  sitesContainerTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[4],
  },
  siteCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii['2xl'],
    padding: theme.space[4],
    borderWidth: 1.5,
    borderColor: theme.color.border.subtle,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  siteCardTablet: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
  },
  siteCardSelected: {
    borderColor: theme.color.brand.accent,
    backgroundColor: theme.color.brand.accentSoft,
    shadowColor: theme.color.brand.accent,
    shadowOpacity: 0.15,
  },
  siteCardDisabled: {
    opacity: 0.7,
    backgroundColor: theme.color.surface.subtle,
  },
  siteCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  siteIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[4],
  },
  siteInfo: {
    flex: 1,
  },
  siteName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[1],
    letterSpacing: 0.2,
  },
  siteNameTablet: {
    fontSize: 18,
  },
  siteNameDisabled: {
    color: theme.color.text.muted,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1],
    marginBottom: theme.space[1],
  },
  siteCode: {
    fontSize: 13,
    color: theme.color.text.muted,
    fontFamily: 'monospace',
  },
  restrictedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.state.warning.background,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.full,
    gap: theme.space[1],
    alignSelf: 'flex-start',
    marginTop: theme.space[1],
  },
  restrictedText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.color.state.warning.text,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  arrowContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.color.surface.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    marginTop: theme.space[8],
    alignItems: 'center',
  },
  footerDivider: {
    width: 60,
    height: 3,
    backgroundColor: theme.color.border.subtle,
    borderRadius: theme.radii.full,
    marginBottom: theme.space[4],
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  footerText: {
    fontSize: 13,
    color: theme.color.text.placeholder,
    fontWeight: '500',
  },
});

export default SiteSelectionScreen;
