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
      const userCompanies = await companiesApi.getUserCompanies(user.id);

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
          <ActivityIndicator size="large" color={colors.accent[500]} />
          <Text style={styles.loadingText}>Cargando empresas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🏢 Seleccionar Empresa</Text>
          <Text style={styles.headerSubtitle}>Hola, {user?.name || user?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>Selecciona la empresa con la que deseas trabajar</Text>
        </View>

        <View style={styles.companiesContainer}>
          {companies.map((company) => (
            <TouchableOpacity
              key={company.id}
              style={[
                styles.companyCard,
                selectedCompanyId === company.id && styles.companyCardSelected,
              ]}
              onPress={() => handleCompanySelect(company)}
              activeOpacity={0.7}
              disabled={selectedCompanyId === company.id}
            >
              <View style={styles.companyCardContent}>
                <View style={styles.companyIconContainer}>
                  <Text style={styles.companyIcon}>🏢</Text>
                </View>
                <View style={styles.companyInfo}>
                  <Text style={styles.companyName}>{company.alias || company.name}</Text>
                  {company.ruc && <Text style={styles.companyRuc}>RUC: {company.ruc}</Text>}
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
                  </View>
                </View>
                {selectedCompanyId === company.id && (
                  <View style={styles.loadingIndicator}>
                    <ActivityIndicator size="small" color={colors.accent[500]} />
                  </View>
                )}
              </View>
              <View style={styles.arrowContainer}>
                <Text style={styles.arrow}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {companies.length}{' '}
            {companies.length === 1 ? 'empresa disponible' : 'empresas disponibles'}
          </Text>
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
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  logoutButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.danger[100],
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger[600],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: 15,
    color: colors.neutral[500],
  },
  content: {
    flex: 1,
    padding: spacing[5],
  },
  infoCard: {
    backgroundColor: colors.info[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.info[200],
  },
  infoIcon: {
    fontSize: 24,
    marginRight: spacing[3],
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.info[800],
    lineHeight: 20,
  },
  companiesContainer: {
    gap: spacing[3],
  },
  companyCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
    borderWidth: 2,
    borderColor: colors.neutral[200],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  companyCardSelected: {
    borderColor: colors.accent[500],
    backgroundColor: colors.accent[50],
  },
  companyCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  companyIcon: {
    fontSize: 28,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  companyRuc: {
    fontSize: 13,
    color: colors.neutral[500],
    marginBottom: spacing[2],
    fontFamily: 'monospace',
  },
  companyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
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
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: colors.success[600],
  },
  statusTextInactive: {
    color: colors.danger[600],
  },
  loadingIndicator: {
    marginLeft: spacing[3],
  },
  arrowContainer: {
    marginTop: spacing[3],
    alignItems: 'flex-end',
  },
  arrow: {
    fontSize: 24,
    color: colors.accent[500],
  },
  footer: {
    marginTop: spacing[6],
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: colors.neutral[400],
  },
});

export default CompanySelectionScreen;
