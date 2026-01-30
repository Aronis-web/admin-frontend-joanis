import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { companiesApi } from '@/services/api';
import {
  Company,
  CompanyType,
  PaymentMethod,
  BankAccount,
  AccountType,
  Currency,
  CreatePaymentMethodRequest,
  CreateBankAccountRequest,
} from '@/types/companies';
import { Site, CreateSiteRequest } from '@/types/sites';
import { SiteDetailModal } from '@/components/sites/SiteDetailModal';

interface CompanyDetailScreenProps {
  navigation: any;
  route: {
    params: {
      companyId: string;
    };
  };
}

type TabType = 'info' | 'sites' | 'payments';

export const CompanyDetailScreen: React.FC<CompanyDetailScreenProps> = ({ navigation, route }) => {
  const { companyId } = route.params;
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Modals
  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false);
  const [showCreateSiteModal, setShowCreateSiteModal] = useState(false);
  const [showCreatePaymentModal, setShowCreatePaymentModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [showSiteDetailModal, setShowSiteDetailModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  // Form states
  const [companyForm, setCompanyForm] = useState({
    name: '',
    ruc: '',
    alias: '',
    companyType: CompanyType.EXTERNAL,
    isActive: true,
  });

  const [siteForm, setSiteForm] = useState({
    code: '',
    name: '',
    phone: '',
    addressLine1: '',
    district: '',
    province: '',
    department: '',
    isActive: true,
  });

  const [paymentForm, setPaymentForm] = useState({
    name: '',
    alias: '',
    methodType: 'BANK_TRANSFER',
    isActive: true,
  });

  const [accountForm, setAccountForm] = useState({
    accountNumber: '',
    accountType: AccountType.SAVINGS,
    currency: Currency.PEN,
    holderName: '',
    isActive: true,
  });

  useEffect(() => {
    loadCompanyData();
  }, [companyId]);

  useEffect(() => {
    if (activeTab === 'sites') {
      loadSites();
    } else if (activeTab === 'payments') {
      loadPaymentMethods();
    }
  }, [activeTab]);

  const loadCompanyData = async () => {
    try {
      setLoading(true);
      const data = await companiesApi.getCompanyById(companyId);
      setCompany(data);
      setCompanyForm({
        name: data.name,
        ruc: data.ruc || '',
        alias: data.alias || '',
        companyType: data.companyType,
        isActive: data.isActive,
      });
    } catch (error: any) {
      console.error('Error loading company:', error);
      Alert.alert('Error', 'No se pudo cargar la empresa');
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    try {
      const response = await companiesApi.getCompanySites(companyId, { limit: 100 });
      setSites(response.data);
    } catch (error: any) {
      console.error('Error loading sites:', error);
      Alert.alert('Error', 'No se pudieron cargar las sedes');
    }
  };

  const handleSitePress = async (site: Site) => {
    try {
      // Load full site details with admins
      const siteDetails = await companiesApi.getSiteById(site.id);
      setSelectedSite(siteDetails);
      setShowSiteDetailModal(true);
    } catch (error: any) {
      console.error('Error loading site details:', error);
      Alert.alert('Error', 'No se pudo cargar la sede');
    }
  };

  const handleSiteUpdated = () => {
    loadSites();
  };

  const handleSiteDeleted = () => {
    setShowSiteDetailModal(false);
    setSelectedSite(null);
    loadSites();
  };

  const loadPaymentMethods = async () => {
    try {
      const data = await companiesApi.getPaymentMethods(companyId);
      setPaymentMethods(data);
    } catch (error: any) {
      console.error('Error loading payment methods:', error);
      Alert.alert('Error', 'No se pudieron cargar los métodos de pago');
    }
  };

  const handleUpdateCompany = async () => {
    try {
      await companiesApi.updateCompany(companyId, {
        name: companyForm.name,
        ruc: companyForm.ruc || undefined,
        alias: companyForm.alias || undefined,
        companyType: companyForm.companyType,
        isActive: companyForm.isActive,
      });
      Alert.alert('Éxito', 'Empresa actualizada correctamente');
      setShowEditCompanyModal(false);
      loadCompanyData();
    } catch (error: any) {
      console.error('Error updating company:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar la empresa');
    }
  };

  const handleCreateSite = async () => {
    if (!siteForm.code || !siteForm.name) {
      Alert.alert('Error', 'El código y nombre son requeridos');
      return;
    }

    try {
      const siteData: CreateSiteRequest = {
        companyId,
        code: siteForm.code.toUpperCase(),
        name: siteForm.name,
        phone: siteForm.phone || undefined,
        addressLine1: siteForm.addressLine1 || undefined,
        district: siteForm.district || undefined,
        province: siteForm.province || undefined,
        department: siteForm.department || undefined,
        isActive: siteForm.isActive,
      };

      await companiesApi.createSite(siteData);
      Alert.alert('Éxito', 'Sede creada correctamente');
      setShowCreateSiteModal(false);
      resetSiteForm();
      loadSites();
    } catch (error: any) {
      console.error('Error creating site:', error);
      Alert.alert('Error', error.message || 'No se pudo crear la sede');
    }
  };

  const handleDeleteSite = (site: Site) => {
    Alert.alert('Confirmar Eliminación', `¿Estás seguro de eliminar la sede "${site.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await companiesApi.deleteSite(site.id);
            Alert.alert('Éxito', 'Sede eliminada correctamente');
            loadSites();
          } catch (error: any) {
            console.error('Error deleting site:', error);
            Alert.alert('Error', error.message || 'No se pudo eliminar la sede');
          }
        },
      },
    ]);
  };

  const handleCreatePaymentMethod = async () => {
    if (!paymentForm.name) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    try {
      const data: CreatePaymentMethodRequest = {
        name: paymentForm.name,
        alias: paymentForm.alias || undefined,
        methodType: paymentForm.methodType,
        isActive: paymentForm.isActive,
      };

      await companiesApi.createPaymentMethod(companyId, data);
      Alert.alert('Éxito', 'Método de pago creado correctamente');
      setShowCreatePaymentModal(false);
      resetPaymentForm();
      loadPaymentMethods();
    } catch (error: any) {
      console.error('Error creating payment method:', error);
      Alert.alert('Error', error.message || 'No se pudo crear el método de pago');
    }
  };

  const handleDeletePaymentMethod = (payment: PaymentMethod) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de eliminar el método de pago "${payment.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await companiesApi.deletePaymentMethod(companyId, payment.id);
              Alert.alert('Éxito', 'Método de pago eliminado correctamente');
              loadPaymentMethods();
            } catch (error: any) {
              console.error('Error deleting payment method:', error);
              Alert.alert('Error', error.message || 'No se pudo eliminar el método de pago');
            }
          },
        },
      ]
    );
  };

  const handleAddAccount = async () => {
    if (!selectedPaymentMethod || !accountForm.accountNumber || !accountForm.holderName) {
      Alert.alert('Error', 'Todos los campos son requeridos');
      return;
    }

    try {
      const data: CreateBankAccountRequest = {
        accountNumber: accountForm.accountNumber,
        accountType: accountForm.accountType,
        currency: accountForm.currency,
        holderName: accountForm.holderName,
        isActive: accountForm.isActive,
      };

      await companiesApi.addBankAccount(companyId, selectedPaymentMethod.id, data);
      Alert.alert('Éxito', 'Cuenta agregada correctamente');
      setShowAddAccountModal(false);
      resetAccountForm();
      loadPaymentMethods();
    } catch (error: any) {
      console.error('Error adding account:', error);
      Alert.alert('Error', error.message || 'No se pudo agregar la cuenta');
    }
  };

  const handleDeleteAccount = (paymentMethodId: string, account: BankAccount) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de eliminar la cuenta ${account.accountNumber}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await companiesApi.deleteBankAccount(companyId, paymentMethodId, account.id);
              Alert.alert('Éxito', 'Cuenta eliminada correctamente');
              loadPaymentMethods();
            } catch (error: any) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', error.message || 'No se pudo eliminar la cuenta');
            }
          },
        },
      ]
    );
  };

  const resetSiteForm = () => {
    setSiteForm({
      code: '',
      name: '',
      phone: '',
      addressLine1: '',
      district: '',
      province: '',
      department: '',
      isActive: true,
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      name: '',
      alias: '',
      methodType: 'BANK_TRANSFER',
      isActive: true,
    });
  };

  const resetAccountForm = () => {
    setAccountForm({
      accountNumber: '',
      accountType: AccountType.SAVINGS,
      currency: Currency.PEN,
      holderName: '',
      isActive: true,
    });
  };

  const renderInfoTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nombre:</Text>
          <Text style={styles.infoValue}>{company?.name}</Text>
        </View>
        {company?.alias && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Alias:</Text>
            <Text style={styles.infoValue}>{company.alias}</Text>
          </View>
        )}
        {company?.ruc && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>RUC:</Text>
            <Text style={styles.infoValue}>{company.ruc}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tipo:</Text>
          <Text style={styles.infoValue}>
            {company?.companyType === CompanyType.INTERNAL ? 'Interna' : 'Externa'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Estado:</Text>
          <View
            style={[
              styles.statusBadge,
              company?.isActive ? styles.statusActive : styles.statusInactive,
            ]}
          >
            <Text style={styles.statusText}>{company?.isActive ? 'Activo' : 'Inactivo'}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Creado:</Text>
          <Text style={styles.infoValue}>
            {company?.createdAt ? new Date(company.createdAt).toLocaleDateString() : '-'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.editButton} onPress={() => setShowEditCompanyModal(true)}>
        <Text style={styles.editButtonText}>✏️ Editar Empresa</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSitesTab = () => (
    <View style={styles.tabContent}>
      <FlatList
        data={sites}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.itemSubtitle}>Código: {item.code}</Text>
                {item.phone && <Text style={styles.itemSubtitle}>📞 {item.phone}</Text>}
                {item.fullAddress && <Text style={styles.itemSubtitle}>📍 {item.fullAddress}</Text>}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  item.isActive ? styles.statusActive : styles.statusInactive,
                ]}
              >
                <Text style={styles.statusText}>{item.isActive ? 'Activo' : 'Inactivo'}</Text>
              </View>
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity
                style={styles.viewDetailsButton}
                onPress={() => handleSitePress(item)}
              >
                <Text style={styles.viewDetailsButtonText}>👁️ Ver Detalles</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteSite(item)}>
                <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay sedes registradas</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateSiteModal(true)}>
        <Text style={styles.addButtonText}>+ Nueva Sede</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPaymentsTab = () => (
    <View style={styles.tabContent}>
      <FlatList
        data={paymentMethods}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                {item.alias && <Text style={styles.itemSubtitle}>Alias: {item.alias}</Text>}
                {item.methodType && (
                  <Text style={styles.itemSubtitle}>Tipo: {item.methodType}</Text>
                )}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  item.isActive ? styles.statusActive : styles.statusInactive,
                ]}
              >
                <Text style={styles.statusText}>{item.isActive ? 'Activo' : 'Inactivo'}</Text>
              </View>
            </View>

            {/* Accounts */}
            {item.accounts && item.accounts.length > 0 && (
              <View style={styles.accountsContainer}>
                <Text style={styles.accountsTitle}>Cuentas:</Text>
                {item.accounts.map((account) => (
                  <View key={account.id} style={styles.accountItem}>
                    <View style={styles.accountInfo}>
                      <Text style={styles.accountNumber}>{account.accountNumber}</Text>
                      <Text style={styles.accountDetails}>
                        {account.accountType} - {account.currency} - {account.holderName}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteAccount(item.id, account)}>
                      <Text style={styles.deleteIcon}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.itemActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setSelectedPaymentMethod(item);
                  setShowAddAccountModal(true);
                }}
              >
                <Text style={styles.actionButtonText}>+ Agregar Cuenta</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeletePaymentMethod(item)}
              >
                <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay métodos de pago registrados</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.addButton} onPress={() => setShowCreatePaymentModal(true)}>
        <Text style={styles.addButtonText}>+ Nuevo Método de Pago</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando empresa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{company?.alias || company?.name}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'info' && styles.activeTab]}
          onPress={() => setActiveTab('info')}
        >
          <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>
            📋 Información
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sites' && styles.activeTab]}
          onPress={() => setActiveTab('sites')}
        >
          <Text style={[styles.tabText, activeTab === 'sites' && styles.activeTabText]}>
            🏪 Sedes ({sites.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'payments' && styles.activeTab]}
          onPress={() => setActiveTab('payments')}
        >
          <Text style={[styles.tabText, activeTab === 'payments' && styles.activeTabText]}>
            💳 Pagos ({paymentMethods.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'info' && renderInfoTab()}
      {activeTab === 'sites' && renderSitesTab()}
      {activeTab === 'payments' && renderPaymentsTab()}

      {/* Edit Company Modal */}
      <Modal visible={showEditCompanyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Editar Empresa</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Nombre *</Text>
                <TextInput
                  style={styles.input}
                  value={companyForm.name}
                  onChangeText={(text) => setCompanyForm({ ...companyForm, name: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>RUC</Text>
                <TextInput
                  style={styles.input}
                  value={companyForm.ruc}
                  onChangeText={(text) => setCompanyForm({ ...companyForm, ruc: text })}
                  keyboardType="numeric"
                  maxLength={11}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Alias</Text>
                <TextInput
                  style={styles.input}
                  value={companyForm.alias}
                  onChangeText={(text) => setCompanyForm({ ...companyForm, alias: text })}
                  placeholder="Ej: ACME"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Tipo de Empresa</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() =>
                      setCompanyForm({ ...companyForm, companyType: CompanyType.EXTERNAL })
                    }
                  >
                    <View
                      style={[
                        styles.radio,
                        companyForm.companyType === CompanyType.EXTERNAL && styles.radioSelected,
                      ]}
                    />
                    <Text style={styles.radioLabel}>Externa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() =>
                      setCompanyForm({ ...companyForm, companyType: CompanyType.INTERNAL })
                    }
                  >
                    <View
                      style={[
                        styles.radio,
                        companyForm.companyType === CompanyType.INTERNAL && styles.radioSelected,
                      ]}
                    />
                    <Text style={styles.radioLabel}>Interna</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() =>
                    setCompanyForm({ ...companyForm, isActive: !companyForm.isActive })
                  }
                >
                  <View style={[styles.checkbox, companyForm.isActive && styles.checkboxChecked]}>
                    {companyForm.isActive && <Text style={styles.checkboxIcon}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Empresa Activa</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowEditCompanyModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleUpdateCompany}>
                  <Text style={styles.saveButtonText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Site Modal */}
      <Modal visible={showCreateSiteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nueva Sede</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Código *</Text>
                <TextInput
                  style={styles.input}
                  value={siteForm.code}
                  onChangeText={(text) => setSiteForm({ ...siteForm, code: text.toUpperCase() })}
                  placeholder="HQ, SEDE-01"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Nombre *</Text>
                <TextInput
                  style={styles.input}
                  value={siteForm.name}
                  onChangeText={(text) => setSiteForm({ ...siteForm, name: text })}
                  placeholder="Sede Principal"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Teléfono</Text>
                <TextInput
                  style={styles.input}
                  value={siteForm.phone}
                  onChangeText={(text) => setSiteForm({ ...siteForm, phone: text })}
                  placeholder="987654321"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Dirección</Text>
                <TextInput
                  style={styles.input}
                  value={siteForm.addressLine1}
                  onChangeText={(text) => setSiteForm({ ...siteForm, addressLine1: text })}
                  placeholder="Av. Principal 123"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Distrito</Text>
                <TextInput
                  style={styles.input}
                  value={siteForm.district}
                  onChangeText={(text) => setSiteForm({ ...siteForm, district: text })}
                  placeholder="Miraflores"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Provincia</Text>
                <TextInput
                  style={styles.input}
                  value={siteForm.province}
                  onChangeText={(text) => setSiteForm({ ...siteForm, province: text })}
                  placeholder="Lima"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Departamento</Text>
                <TextInput
                  style={styles.input}
                  value={siteForm.department}
                  onChangeText={(text) => setSiteForm({ ...siteForm, department: text })}
                  placeholder="Lima"
                />
              </View>

              <View style={styles.formGroup}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setSiteForm({ ...siteForm, isActive: !siteForm.isActive })}
                >
                  <View style={[styles.checkbox, siteForm.isActive && styles.checkboxChecked]}>
                    {siteForm.isActive && <Text style={styles.checkboxIcon}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Sede Activa</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowCreateSiteModal(false);
                    resetSiteForm();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleCreateSite}>
                  <Text style={styles.saveButtonText}>Crear</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Payment Method Modal */}
      <Modal visible={showCreatePaymentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nuevo Método de Pago</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Nombre *</Text>
                <TextInput
                  style={styles.input}
                  value={paymentForm.name}
                  onChangeText={(text) => setPaymentForm({ ...paymentForm, name: text })}
                  placeholder="Banco BCP"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Alias</Text>
                <TextInput
                  style={styles.input}
                  value={paymentForm.alias}
                  onChangeText={(text) => setPaymentForm({ ...paymentForm, alias: text })}
                  placeholder="BCP Principal"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Tipo</Text>
                <TextInput
                  style={styles.input}
                  value={paymentForm.methodType}
                  onChangeText={(text) => setPaymentForm({ ...paymentForm, methodType: text })}
                  placeholder="BANK_TRANSFER"
                />
              </View>

              <View style={styles.formGroup}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() =>
                    setPaymentForm({ ...paymentForm, isActive: !paymentForm.isActive })
                  }
                >
                  <View style={[styles.checkbox, paymentForm.isActive && styles.checkboxChecked]}>
                    {paymentForm.isActive && <Text style={styles.checkboxIcon}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Método Activo</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowCreatePaymentModal(false);
                    resetPaymentForm();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleCreatePaymentMethod}>
                  <Text style={styles.saveButtonText}>Crear</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Account Modal */}
      <Modal visible={showAddAccountModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Agregar Cuenta</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Número de Cuenta *</Text>
                <TextInput
                  style={styles.input}
                  value={accountForm.accountNumber}
                  onChangeText={(text) => setAccountForm({ ...accountForm, accountNumber: text })}
                  placeholder="191-1234567-0-01"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Tipo de Cuenta</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() =>
                      setAccountForm({ ...accountForm, accountType: AccountType.SAVINGS })
                    }
                  >
                    <View
                      style={[
                        styles.radio,
                        accountForm.accountType === AccountType.SAVINGS && styles.radioSelected,
                      ]}
                    />
                    <Text style={styles.radioLabel}>Ahorros</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() =>
                      setAccountForm({ ...accountForm, accountType: AccountType.CHECKING })
                    }
                  >
                    <View
                      style={[
                        styles.radio,
                        accountForm.accountType === AccountType.CHECKING && styles.radioSelected,
                      ]}
                    />
                    <Text style={styles.radioLabel}>Corriente</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Moneda</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setAccountForm({ ...accountForm, currency: Currency.PEN })}
                  >
                    <View
                      style={[
                        styles.radio,
                        accountForm.currency === Currency.PEN && styles.radioSelected,
                      ]}
                    />
                    <Text style={styles.radioLabel}>PEN (S/)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setAccountForm({ ...accountForm, currency: Currency.USD })}
                  >
                    <View
                      style={[
                        styles.radio,
                        accountForm.currency === Currency.USD && styles.radioSelected,
                      ]}
                    />
                    <Text style={styles.radioLabel}>USD ($)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Titular *</Text>
                <TextInput
                  style={styles.input}
                  value={accountForm.holderName}
                  onChangeText={(text) => setAccountForm({ ...accountForm, holderName: text })}
                  placeholder="Mi Empresa S.A.C."
                />
              </View>

              <View style={styles.formGroup}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() =>
                    setAccountForm({ ...accountForm, isActive: !accountForm.isActive })
                  }
                >
                  <View style={[styles.checkbox, accountForm.isActive && styles.checkboxChecked]}>
                    {accountForm.isActive && <Text style={styles.checkboxIcon}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Cuenta Activa</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowAddAccountModal(false);
                    resetAccountForm();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleAddAccount}>
                  <Text style={styles.saveButtonText}>Agregar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Site Detail Modal */}
      <SiteDetailModal
        visible={showSiteDetailModal}
        site={selectedSite}
        onClose={() => {
          setShowSiteDetailModal(false);
          setSelectedSite(null);
        }}
        onEdit={(site) => {
          // TODO: Implement edit site functionality
          Alert.alert('Info', 'Editar sede desde aquí próximamente');
        }}
        onSiteDeleted={handleSiteDeleted}
        onSiteUpdated={handleSiteUpdated}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
  },
  statusInactive: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  viewDetailsButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewDetailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  accountsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  accountsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
    marginBottom: 4,
  },
  accountInfo: {
    flex: 1,
  },
  accountNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  accountDetails: {
    fontSize: 12,
    color: '#666',
  },
  deleteIcon: {
    fontSize: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#DDD',
    marginRight: 8,
  },
  radioSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#DDD',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxIcon: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default CompanyDetailScreen;
