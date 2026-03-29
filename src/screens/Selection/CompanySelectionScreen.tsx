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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { useAuthStore } from '@/store/auth';
import { companiesApi, Company } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/utils/config';

interface CompanySelectionScreenProps {
  navigation: any;
}

export const CompanySelectionScreen: React.FC<CompanySelectionScreenProps> = ({ navigation }) => {
  const { user, logout, setCurrentCompany } = useAuthStore();
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
            <Ionicons name="business" size={48} color={colors.accent[500]} />
          </View>
          <ActivityIndicator size="large" color={colors.accent[500]} style={{ marginTop: spacing[4] }} />
          <Text style={styles.loadingText}>Cargando empresas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header con gradiente */}
      <LinearGradient
        colors={[colors.primary[900], colors.primary[800]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="business" size={28} color={colors.neutral[0]} />
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
          <Ionicons name="log-out-outline" size={20} color={colors.danger[400]} />
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
            <Ionicons name="information-circle" size={24} color={colors.info[600]} />
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
                      ? [colors.accent[500], colors.accent[600]]
                      : [colors.primary[800], colors.primary[900]]
                  }
                  style={styles.companyIconContainer}
                >
                  <Ionicons
                    name="business"
                    size={24}
                    color={colors.neutral[0]}
                  />
                </LinearGradient>
                <View style={styles.companyInfo}>
                  <Text style={[styles.companyName, isTablet && styles.companyNameTablet]}>
                    {company.alias || company.name}
                  </Text>
                  {company.ruc && (
                    <View style={styles.rucContainer}>
                      <Ionicons name="document-text-outline" size={12} color={colors.neutral[400]} />
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
                        <Ionicons name="star" size={10} color={colors.warning[600]} />
                        <Text style={styles.internalBadgeText}>Principal</Text>
                      </View>
                    )}
                  </View>
                </View>
                {selectedCompanyId === company.id ? (
                  <ActivityIndicator size="small" color={colors.accent[500]} />
                ) : (
                  <View style={styles.arrowContainer}>
                    <Ionicons name="chevron-forward" size={24} color={colors.neutral[400]} />
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
            <Ionicons name="layers-outline" size={16} color={colors.neutral[400]} />
            <Text style={styles.footerText}>
              {companies.length} {companies.length === 1 ? 'empresa disponible' : 'empresas disponibles'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[6],
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
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.neutral[0],
    marginBottom: spacing[0.5],
    letterSpacing: 0.3,
  },
  headerTitleTablet: {
    fontSize: 26,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: spacing[2],
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger[400],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  loadingIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accent[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: 16,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[5],
    paddingBottom: spacing[10],
  },
  contentContainerTablet: {
    paddingHorizontal: spacing[8],
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  infoCard: {
    backgroundColor: colors.info[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.info[100],
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.info[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.info[800],
    lineHeight: 20,
    fontWeight: '500',
  },
  companiesContainer: {
    gap: spacing[3],
  },
  companiesContainerTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
  },
  companyCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    shadowColor: colors.neutral[950],
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
    borderColor: colors.accent[500],
    backgroundColor: colors.accent[50],
    shadowColor: colors.accent[500],
    shadowOpacity: 0.15,
  },
  companyCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companyIconContainer: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[1],
    letterSpacing: 0.2,
  },
  companyNameTablet: {
    fontSize: 18,
  },
  rucContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  companyRuc: {
    fontSize: 13,
    color: colors.neutral[500],
    fontFamily: 'monospace',
  },
  companyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  statusActive: {
    backgroundColor: colors.success[100],
  },
  statusInactive: {
    backgroundColor: colors.danger[100],
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing[1.5],
  },
  statusDotActive: {
    backgroundColor: colors.success[500],
  },
  statusDotInactive: {
    backgroundColor: colors.danger[500],
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusTextActive: {
    color: colors.success[700],
  },
  statusTextInactive: {
    color: colors.danger[700],
  },
  internalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    backgroundColor: colors.warning[100],
    gap: spacing[1],
  },
  internalBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.warning[700],
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  arrowContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    marginTop: spacing[8],
    alignItems: 'center',
  },
  footerDivider: {
    width: 60,
    height: 3,
    backgroundColor: colors.neutral[200],
    borderRadius: borderRadius.full,
    marginBottom: spacing[4],
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  footerText: {
    fontSize: 13,
    color: colors.neutral[400],
    fontWeight: '500',
  },
});

export default CompanySelectionScreen;
