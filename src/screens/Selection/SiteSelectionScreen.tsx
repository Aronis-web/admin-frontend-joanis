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
import { companiesApi, UserCompanySite } from '@/services/api';
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
  const companyName = (route.params?.companyName || currentCompany?.name || '') as string;

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
      Alert.alert('Error', 'Usuario no autenticado');
      logout();
      return;
    }

    if (!companyId) {
      Alert.alert('Error', 'No se ha seleccionado una empresa');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Cargando sedes para companyId:', companyId, 'userId:', user.id);

      // TypeScript type guard - we've already checked companyId is not empty above
      const userSites = await companiesApi.getUserSitesInCompany(companyId as string, user.id);

      console.log('📦 Respuesta de API (tipo):', typeof userSites);
      console.log('📦 Respuesta de API (es array):', Array.isArray(userSites));
      console.log('📦 Respuesta de API (raw):', JSON.stringify(userSites, null, 2));

      // Ensure userSites is an array
      const sitesArray = Array.isArray(userSites) ? userSites : [];

      console.log('📋 Sedes procesadas:', sitesArray.length, 'sedes encontradas');
      sitesArray.forEach((site, index) => {
        console.log(`  Sede ${index + 1} - ESTRUCTURA COMPLETA:`, JSON.stringify(site, null, 2));
        console.log(`  Sede ${index + 1} - KEYS:`, Object.keys(site));
      });

      if (sitesArray.length === 0) {
        Alert.alert(
          'Sin Sedes',
          'No tienes acceso a ninguna sede en esta empresa. Contacta al administrador.',
          [
            { text: 'Volver', onPress: () => navigation.replace('CompanySelection') },
            { text: 'Cerrar Sesión', onPress: logout, style: 'destructive' },
          ]
        );
        return;
      }

      setSites(sitesArray);

      // If user has only one site, auto-select it and proceed to home
      if (sitesArray.length === 1) {
        console.log('✨ Solo hay 1 sede, auto-seleccionando...');
        await handleSiteSelect(sitesArray[0]);
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
      const siteId = site.siteId || site.id || (site as any).Site?.id;
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
        rawSiteObject: site
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
      await AsyncStorage.setItem(
        config.STORAGE_KEYS.CURRENT_SITE,
        JSON.stringify(siteData)
      );

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
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('🚀 Stores actualizados - Navigation debería detectar el cambio y mostrar MainStack');

    } catch (error) {
      console.error('❌ Error selecting site:', error);
      Alert.alert('Error', 'No se pudo seleccionar la sede');
      setSelectedSiteId(null);
    }
  };

  const handleBack = () => {
    navigation.replace(COMPANY_SELECTION_ROUTE as any);
  };

  const handleLogout = () => {
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Cargando sedes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
          <Text style={styles.infoText}>
            Selecciona la sede con la que deseas trabajar
          </Text>
        </View>

        <View style={styles.sitesContainer}>
          {sites.map((userSite, index) => {
            // Handle different possible API response structures
            const siteId = userSite.siteId || userSite.id || (userSite as any).Site?.id || `site-${index}`;
            const siteName = userSite.site?.name || (userSite as any).Site?.name || (userSite as any).name || 'Sede sin nombre';
            const siteCode = userSite.site?.code || (userSite as any).Site?.code || (userSite as any).code;
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
                    {siteCode && (
                      <Text style={styles.siteCode}>Código: {siteCode}</Text>
                    )}
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
            {sites.filter(s => s.canSelect).length} de {sites.length}{' '}
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
