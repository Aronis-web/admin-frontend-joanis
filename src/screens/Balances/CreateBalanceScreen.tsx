import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { balancesApi } from '@/services/api';
import { companiesApi } from '@/services/api/companies';
import { sitesApi } from '@/services/api/sites';
import { BalanceType, CreateBalanceRequest, getBalanceTypeLabel } from '@/types/balances';
import { Company, CompanyType } from '@/types/companies';
import { Site } from '@/types/sites';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { DatePicker } from '@/components/DatePicker';
import { MAIN_ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/auth';

interface CreateBalanceScreenProps {
  navigation: any;
}

export const CreateBalanceScreen: React.FC<CreateBalanceScreenProps> = ({ navigation }) => {
  const [balanceType, setBalanceType] = useState<BalanceType>(BalanceType.INTERNAL);
  const [receiverCompanyId, setReceiverCompanyId] = useState('');
  const [receiverSiteId, setReceiverSiteId] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Data loading
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingSites, setLoadingSites] = useState(false);

  // Modals
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showSiteModal, setShowSiteModal] = useState(false);

  const { width, height } = useWindowDimensions();
  const { user } = useAuthStore();

  const isTablet = width >= 768 || height >= 768;

  // Load sites on mount
  useEffect(() => {
    loadSites();
  }, []);

  // Load companies when balance type changes
  useEffect(() => {
    loadCompanies();
    // Clear selected company when switching balance type
    setReceiverCompanyId('');
  }, [balanceType]);

  const loadCompanies = async () => {
    try {
      setLoadingCompanies(true);
      // Get companies for the current user
      const companies = await companiesApi.getUserCompanies(user?.id || '');
      console.log('📋 Total companies loaded:', companies.length);
      console.log(
        '📋 Companies:',
        companies.map((c) => ({ name: c.name, type: c.companyType, active: c.isActive }))
      );

      // Filter only active companies and by type based on balance type
      const activeCompanies = companies.filter((c) => {
        if (!c.isActive) {
          return false;
        }
        // For external balances, only show external companies
        if (balanceType === BalanceType.EXTERNAL) {
          return c.companyType === CompanyType.EXTERNAL;
        }
        // For internal balances, only show internal companies
        return c.companyType === CompanyType.INTERNAL;
      });

      console.log(`✅ Filtered companies for ${balanceType}:`, activeCompanies.length);
      console.log(
        '✅ Filtered companies:',
        activeCompanies.map((c) => ({ name: c.name, type: c.companyType }))
      );

      setCompanies(activeCompanies);
    } catch (error: any) {
      console.error('Error loading companies:', error);
      Alert.alert('Error', 'No se pudieron cargar las empresas');
    } finally {
      setLoadingCompanies(false);
    }
  };

  const loadSites = async () => {
    try {
      setLoadingSites(true);
      // Get all companies for the user first
      const companies = await companiesApi.getUserCompanies(user?.id || '');
      const activeCompanies = companies.filter((c) => c.isActive);

      // Get sites for each company
      const allSites: Site[] = [];
      for (const company of activeCompanies) {
        try {
          const response = await companiesApi.getCompanySites(company.id, {
            isActive: true,
            limit: 100,
          });
          allSites.push(...response.data);
        } catch (error) {
          console.error(`Error loading sites for company ${company.id}:`, error);
        }
      }

      setSites(allSites);
    } catch (error: any) {
      console.error('Error loading sites:', error);
      Alert.alert('Error', 'No se pudieron cargar las sedes');
    } finally {
      setLoadingSites(false);
    }
  };

  const getSelectedCompanyName = () => {
    const company = companies.find((c) => c.id === receiverCompanyId);
    return company ? company.name : 'Seleccionar empresa';
  };

  const getSelectedSiteName = () => {
    const site = sites.find((s) => s.id === receiverSiteId);
    return site ? site.name : 'Seleccionar sede';
  };

  const formatDate = (date: Date | undefined): string => {
    if (!date) {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date: Date | undefined): string => {
    if (!date) {
      return 'Seleccionar fecha';
    }
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleCreate = async () => {
    // Validations
    if (!startDate) {
      Alert.alert('Error', 'La fecha de inicio es obligatoria');
      return;
    }

    if (balanceType === BalanceType.INTERNAL && !receiverSiteId.trim()) {
      Alert.alert('Error', 'Para balances internos debe seleccionar una sede receptora');
      return;
    }

    if (balanceType === BalanceType.EXTERNAL && !receiverCompanyId.trim()) {
      Alert.alert('Error', 'Para balances externos debe seleccionar una empresa receptora');
      return;
    }

    if (endDate && endDate < startDate) {
      Alert.alert('Error', 'La fecha de fin debe ser mayor o igual a la fecha de inicio');
      return;
    }

    setLoading(true);

    try {
      const data: CreateBalanceRequest = {
        balanceType,
        receiverCompanyId:
          balanceType === BalanceType.EXTERNAL ? receiverCompanyId.trim() : undefined,
        receiverSiteId: balanceType === BalanceType.INTERNAL ? receiverSiteId.trim() : undefined,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate) || undefined,
        notes: notes.trim() || undefined,
      };

      const balance = await balancesApi.createBalance(data);

      Alert.alert('Éxito', 'Balance creado exitosamente', [
        {
          text: 'OK',
          onPress: () => {
            navigation.replace(MAIN_ROUTES.BALANCE_DETAIL, { balanceId: balance.id });
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error creating balance:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo crear el balance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
              ← Volver
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>Nuevo Balance</Text>
        </View>

        {/* Form */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
        >
          <View style={[styles.formCard, isTablet && styles.formCardTablet]}>
            {/* Balance Type */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Tipo de Balance *</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    balanceType === BalanceType.INTERNAL && styles.typeButtonActive,
                  ]}
                  onPress={() => setBalanceType(BalanceType.INTERNAL)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      balanceType === BalanceType.INTERNAL && styles.typeButtonTextActive,
                    ]}
                  >
                    Interno
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    balanceType === BalanceType.EXTERNAL && styles.typeButtonActive,
                  ]}
                  onPress={() => setBalanceType(BalanceType.EXTERNAL)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      balanceType === BalanceType.EXTERNAL && styles.typeButtonTextActive,
                    ]}
                  >
                    Externo
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Receiver */}
            {balanceType === BalanceType.INTERNAL ? (
              <View style={styles.formGroup}>
                <Text style={[styles.label, isTablet && styles.labelTablet]}>Sede Receptora *</Text>
                <TouchableOpacity
                  style={[styles.selectInput, isTablet && styles.selectInputTablet]}
                  onPress={() => setShowSiteModal(true)}
                  disabled={loadingSites}
                >
                  <Text style={[styles.selectText, isTablet && styles.selectTextTablet]}>
                    {loadingSites ? 'Cargando...' : getSelectedSiteName()}
                  </Text>
                  <Text style={styles.selectArrow}>▼</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={[styles.label, isTablet && styles.labelTablet]}>
                  Empresa Receptora *
                </Text>
                <TouchableOpacity
                  style={[styles.selectInput, isTablet && styles.selectInputTablet]}
                  onPress={() => setShowCompanyModal(true)}
                  disabled={loadingCompanies}
                >
                  <Text style={[styles.selectText, isTablet && styles.selectTextTablet]}>
                    {loadingCompanies ? 'Cargando...' : getSelectedCompanyName()}
                  </Text>
                  <Text style={styles.selectArrow}>▼</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Start Date */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Fecha de Inicio *</Text>
              <TouchableOpacity
                style={[styles.dateInput, isTablet && styles.dateInputTablet]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={[styles.dateText, isTablet && styles.dateTextTablet]}>
                  {formatDisplayDate(startDate)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* End Date */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Fecha de Fin (opcional)
              </Text>
              <TouchableOpacity
                style={[styles.dateInput, isTablet && styles.dateInputTablet]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={[styles.dateText, isTablet && styles.dateTextTablet]}>
                  {formatDisplayDate(endDate)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Notas (opcional)</Text>
              <TextInput
                style={[styles.textArea, isTablet && styles.textAreaTablet]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Notas adicionales sobre el balance..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isTablet && styles.submitButtonTablet]}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.submitButtonText, isTablet && styles.submitButtonTextTablet]}>
                  Crear Balance
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Company Selection Modal */}
        <Modal
          visible={showCompanyModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCompanyModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isTablet && styles.modalTitleTablet]}>
                  Seleccionar Empresa
                </Text>
                <TouchableOpacity onPress={() => setShowCompanyModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalList}>
                {loadingCompanies ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={styles.modalLoadingText}>Cargando empresas...</Text>
                  </View>
                ) : companies.length === 0 ? (
                  <View style={styles.modalEmpty}>
                    <Text style={styles.modalEmptyText}>No hay empresas disponibles</Text>
                  </View>
                ) : (
                  companies.map((company) => (
                    <TouchableOpacity
                      key={company.id}
                      style={[
                        styles.modalItem,
                        receiverCompanyId === company.id && styles.modalItemSelected,
                      ]}
                      onPress={() => {
                        setReceiverCompanyId(company.id);
                        setShowCompanyModal(false);
                      }}
                    >
                      <View style={styles.modalItemContent}>
                        <Text
                          style={[styles.modalItemName, isTablet && styles.modalItemNameTablet]}
                        >
                          {company.name}
                        </Text>
                        <Text style={styles.modalItemType}>{company.companyType}</Text>
                        {company.ruc && (
                          <Text style={styles.modalItemType}>RUC: {company.ruc}</Text>
                        )}
                      </View>
                      {receiverCompanyId === company.id && (
                        <Text style={styles.modalItemCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Site Selection Modal */}
        <Modal
          visible={showSiteModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSiteModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isTablet && styles.modalTitleTablet]}>
                  Seleccionar Sede
                </Text>
                <TouchableOpacity onPress={() => setShowSiteModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalList}>
                {loadingSites ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={styles.modalLoadingText}>Cargando sedes...</Text>
                  </View>
                ) : sites.length === 0 ? (
                  <View style={styles.modalEmpty}>
                    <Text style={styles.modalEmptyText}>No hay sedes disponibles</Text>
                  </View>
                ) : (
                  sites.map((site) => (
                    <TouchableOpacity
                      key={site.id}
                      style={[
                        styles.modalItem,
                        receiverSiteId === site.id && styles.modalItemSelected,
                      ]}
                      onPress={() => {
                        setReceiverSiteId(site.id);
                        setShowSiteModal(false);
                      }}
                    >
                      <View style={styles.modalItemContent}>
                        <Text
                          style={[styles.modalItemName, isTablet && styles.modalItemNameTablet]}
                        >
                          {site.name}
                        </Text>
                        <Text style={styles.modalItemType}>
                          {site.fullAddress || site.addressLine1 || 'Sin dirección'}
                        </Text>
                        {site.code && <Text style={styles.modalItemType}>Código: {site.code}</Text>}
                      </View>
                      {receiverSiteId === site.id && <Text style={styles.modalItemCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Date Pickers */}
        <DatePicker
          visible={showStartDatePicker}
          date={startDate}
          onConfirm={(date) => {
            setStartDate(date);
            setShowStartDatePicker(false);
            // Si la fecha de inicio es mayor que la fecha de fin, ajustar la fecha de fin
            if (endDate && date > endDate) {
              setEndDate(date);
            }
          }}
          onCancel={() => setShowStartDatePicker(false)}
          minimumDate={new Date()}
        />

        <DatePicker
          visible={showEndDatePicker}
          date={endDate}
          onConfirm={(date) => {
            setEndDate(date);
            setShowEndDatePicker(false);
            // Si la fecha de fin es menor que la fecha de inicio, ajustar la fecha de inicio
            if (startDate && date < startDate) {
              setStartDate(date);
            }
          }}
          onCancel={() => setShowEndDatePicker(false)}
        />
      </SafeAreaView>
    </ScreenLayout>
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  backButtonTextTablet: {
    fontSize: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  scrollContentTablet: {
    padding: 32,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formCardTablet: {
    padding: 32,
    borderRadius: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  labelTablet: {
    fontSize: 16,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  inputTablet: {
    fontSize: 16,
    paddingVertical: 14,
  },
  dateInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  dateInputTablet: {
    fontSize: 16,
    paddingVertical: 14,
  },
  dateText: {
    color: '#1E293B',
  },
  dateTextTablet: {
    fontSize: 16,
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    minHeight: 100,
  },
  textAreaTablet: {
    fontSize: 16,
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonTablet: {
    paddingVertical: 16,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  submitButtonTextTablet: {
    fontSize: 18,
  },
  selectInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectInputTablet: {
    paddingVertical: 14,
  },
  selectText: {
    fontSize: 15,
    color: '#1E293B',
    flex: 1,
  },
  selectTextTablet: {
    fontSize: 16,
  },
  selectArrow: {
    fontSize: 12,
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: 300,
  },
  modalContentTablet: {
    maxHeight: '70%',
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalTitleTablet: {
    fontSize: 22,
  },
  modalClose: {
    fontSize: 28,
    color: '#64748B',
    fontWeight: '300',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalList: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  modalItemSelected: {
    backgroundColor: '#6366F1' + '08',
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  modalItemContent: {
    flex: 1,
    marginRight: 12,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
    lineHeight: 22,
  },
  modalItemNameTablet: {
    fontSize: 18,
    lineHeight: 24,
  },
  modalItemType: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  modalItemCheck: {
    fontSize: 24,
    color: '#6366F1',
    fontWeight: '700',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmpty: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  modalLoading: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
  },
});

export default CreateBalanceScreen;
