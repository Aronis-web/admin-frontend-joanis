import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { useAuthStore } from '@/store/auth';
import { companiesApi, Company } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/utils/config';
import Alert from '@/utils/alert';

interface CompanySelectionScreenProps {
  navigation: any;
}

export const CompanySelectionScreen: React.FC<CompanySelectionScreenProps> = ({ navigation }) => {
  const { user, logout, setCurrentCompany } = useAuthStore();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  useEffect(() => {
    loadUserCompanies();
  }, []);

  const loadUserCompanies = async () => {
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

    try {
      setLoading(true);
      const userCompaniesResponse = await companiesApi.getUserCompanies(user.id);

      // Handle both array and object response formats
      const userCompanies: Company[] = Array.isArray(userCompaniesResponse)
        ? userCompaniesResponse
        : (userCompaniesResponse as any)?.data || (userCompaniesResponse as any)?.items || [];

      console.log('📦 Companies loaded:', userCompanies.length);

      if (userCompanies.length === 0) {
        Alert.alert(
          'Sin Empresas',
          'No tienes acceso a ninguna empresa. Contacta al administrador.',
          [
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
          ]
        );
        return;
      }

      // Sort companies: INTERNAL first, then EXTERNAL
      const sortedCompanies = userCompanies.sort((a, b) => {
        // If both are the same type, maintain original order
        if (a.companyType === b.companyType) {
          return 0;
        }
        // INTERNAL companies come first
        if (a.companyType === 'INTERNAL') {
          return -1;
        }
        if (b.companyType === 'INTERNAL') {
          return 1;
        }
        return 0;
      });

      setCompanies(sortedCompanies);

      // If user has only one company, auto-select it and proceed to site selection
      if (userCompanies.length === 1) {
        await handleCompanySelect(userCompanies[0]);
      }
    } catch (error: any) {
      console.error('Error loading companies:', error);
      const errorMessage = error.response?.data?.message || 'No se pudieron cargar las empresas';
      Alert.alert('Error', errorMessage, [
        { text: 'Reintentar', onPress: loadUserCompanies },
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
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySelect = async (company: Company) => {
    try {
      setSelectedCompanyId(company.id);

      // Prepare company data
      const companyData = {
        id: company.id,
        name: company.name,
        alias: company.alias,
        ruc: company.ruc,
        isActive: company.isActive,
      };

      console.log('🏢 Seleccionando empresa:', companyData);

      // Save selected company to AsyncStorage
      await AsyncStorage.setItem(config.STORAGE_KEYS.CURRENT_COMPANY, JSON.stringify(companyData));

      console.log('💾 Empresa guardada en AsyncStorage');

      // Update the auth store with the selected company
      setCurrentCompany(companyData);

      console.log('✅ Empresa actualizada en store');

      // Navigate to site selection
      navigation.replace('SiteSelection', {
        companyId: company.id,
        companyName: company.alias || company.name,
      });
    } catch (error) {
      console.error('❌ Error selecting company:', error);
      Alert.alert('Error', 'No se pudo seleccionar la empresa');
      setSelectedCompanyId(null);
    }
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
            <Ionicons name="business" size={48} color={theme.color.brand.accent} />
          </View>
          <ActivityIndicator size="large" color={theme.color.brand.accent} style={{ marginTop: theme.space[4] }} />
          <Text style={styles.loadingText}>Cargando empresas...</Text>
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
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="business" size={28} color={theme.color.brand.onHeader} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Seleccionar Empresa
            </Text>
            <Text style={styles.headerSubtitle}>
              Hola, {user?.name?.split(' ')[0] || user?.email?.split('@')[0]}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={theme.color.icon.danger} />
          <Text style={styles.logoutButtonText}>Salir</Text>
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
            Selecciona la empresa con la que deseas trabajar
          </Text>
        </View>

        {/* Companies Grid */}
        <View style={[styles.companiesContainer, isTablet && styles.companiesContainerTablet]}>
          {companies.map((company, index) => (
            <TouchableOpacity
              key={company.id}
              style={[
                styles.companyCard,
                isTablet && styles.companyCardTablet,
                selectedCompanyId === company.id && styles.companyCardSelected,
              ]}
              onPress={() => handleCompanySelect(company)}
              activeOpacity={0.7}
              disabled={selectedCompanyId === company.id}
            >
              <View style={styles.companyCardContent}>
                <LinearGradient
                  colors={
                    selectedCompanyId === company.id
                      ? [theme.color.brand.avatarFrom, theme.color.brand.avatarTo]
                      : [theme.color.brand.headerTo, theme.color.brand.headerFrom]
                  }
                  style={styles.companyIconContainer}
                >
                  <Ionicons
                    name="business"
                    size={24}
                    color={theme.color.brand.onHeader}
                  />
                </LinearGradient>
                <View style={styles.companyInfo}>
                  <Text style={[styles.companyName, isTablet && styles.companyNameTablet]}>
                    {company.alias || company.name}
                  </Text>
                  {company.ruc && (
                    <View style={styles.rucContainer}>
                      <Ionicons name="document-text-outline" size={12} color={theme.color.text.placeholder} />
                      <Text style={styles.companyRuc}>RUC: {company.ruc}</Text>
                    </View>
                  )}
                  <View style={styles.companyFooter}>
                    <View
                      style={[
                        styles.statusBadge,
                        company.isActive ? styles.statusActive : styles.statusInactive,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          company.isActive ? styles.statusDotActive : styles.statusDotInactive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          company.isActive ? styles.statusTextActive : styles.statusTextInactive,
                        ]}
                      >
                        {company.isActive ? 'Activa' : 'Inactiva'}
                      </Text>
                    </View>
                    {company.companyType === 'INTERNAL' && (
                      <View style={styles.internalBadge}>
                        <Ionicons name="star" size={10} color={theme.color.state.warning.border} />
                        <Text style={styles.internalBadgeText}>Principal</Text>
                      </View>
                    )}
                  </View>
                </View>
                {selectedCompanyId === company.id ? (
                  <ActivityIndicator size="small" color={theme.color.brand.accent} />
                ) : (
                  <View style={styles.arrowContainer}>
                    <Ionicons name="chevron-forward" size={24} color={theme.color.text.placeholder} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <View style={styles.footerContent}>
            <Ionicons name="layers-outline" size={16} color={theme.color.text.placeholder} />
            <Text style={styles.footerText}>
              {companies.length} {companies.length === 1 ? 'empresa disponible' : 'empresas disponibles'}
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
    paddingVertical: theme.space[6],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[4],
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
    marginBottom: theme.space[0.5],
    letterSpacing: 0.3,
  },
  headerTitleTablet: {
    fontSize: 26,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2.5],
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.headerBadge,
    gap: theme.space[2],
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.icon.danger,
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
  companiesContainer: {
    gap: theme.space[3],
  },
  companiesContainerTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[4],
  },
  companyCard: {
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
  companyCardTablet: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
  },
  companyCardSelected: {
    borderColor: theme.color.brand.accent,
    backgroundColor: theme.color.brand.accentSoft,
    shadowColor: theme.color.brand.accent,
    shadowOpacity: 0.15,
  },
  companyCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companyIconContainer: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[4],
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[1],
    letterSpacing: 0.2,
  },
  companyNameTablet: {
    fontSize: 18,
  },
  rucContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1],
    marginBottom: theme.space[2],
  },
  companyRuc: {
    fontSize: 13,
    color: theme.color.text.muted,
    fontFamily: 'monospace',
  },
  companyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[2.5],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.full,
  },
  statusActive: {
    backgroundColor: theme.color.state.success.background,
  },
  statusInactive: {
    backgroundColor: theme.color.state.danger.background,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: theme.space[1.5],
  },
  statusDotActive: {
    backgroundColor: theme.color.state.success.border,
  },
  statusDotInactive: {
    backgroundColor: theme.color.state.danger.border,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusTextActive: {
    color: theme.color.state.success.text,
  },
  statusTextInactive: {
    color: theme.color.state.danger.text,
  },
  internalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.state.warning.background,
    gap: theme.space[1],
  },
  internalBadgeText: {
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

export default CompanySelectionScreen;
