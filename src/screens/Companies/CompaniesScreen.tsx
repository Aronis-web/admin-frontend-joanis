import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { companiesApi } from '@/services/api';
import {
  Company,
  CompanyType,
  CreateCompanyRequest,
  UpdateCompanyRequest,
} from '@/types/companies';

import { useMenuNavigation } from '@/hooks/useMenuNavigation';
import { AddButton } from '@/components/Navigation/AddButton';

interface CompaniesScreenProps {
  navigation: any;
}

export const CompaniesScreen: React.FC<CompaniesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    ruc: '',
    name: '',
    alias: '',
    companyType: CompanyType.EXTERNAL,
    isActive: true,
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const response = await companiesApi.getCompanies({
        q: searchQuery,
        page: 1,
        limit: 100,
        orderBy: 'name',
        orderDir: 'ASC',
      });
      setCompanies(response.data);
    } catch (error: any) {
      console.error('Error loading companies:', error);
      Alert.alert('Error', 'No se pudieron cargar las empresas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCompanies();
  };

  const handleSearch = () => {
    loadCompanies();
  };

  const handleCreateCompany = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'El nombre de la empresa es requerido');
      return;
    }

    try {
      const createData: CreateCompanyRequest = {
        name: formData.name.trim(),
        ruc: formData.ruc.trim() || undefined,
        alias: formData.alias.trim() || undefined,
        companyType: formData.companyType,
        isActive: formData.isActive,
      };

      await companiesApi.createCompany(createData);
      Alert.alert('Éxito', 'Empresa creada correctamente');
      setShowCreateModal(false);
      resetForm();
      loadCompanies();
    } catch (error: any) {
      console.error('Error creating company:', error);
      Alert.alert('Error', error.message || 'No se pudo crear la empresa');
    }
  };

  const handleUpdateCompany = async () => {
    if (!selectedCompany) {
      return;
    }

    if (!formData.name.trim()) {
      Alert.alert('Error', 'El nombre de la empresa es requerido');
      return;
    }

    try {
      const updateData: UpdateCompanyRequest = {
        name: formData.name.trim(),
        ruc: formData.ruc.trim() || undefined,
        alias: formData.alias.trim() || undefined,
        companyType: formData.companyType,
        isActive: formData.isActive,
      };

      await companiesApi.updateCompany(selectedCompany.id, updateData);
      Alert.alert('Éxito', 'Empresa actualizada correctamente');
      setShowEditModal(false);
      resetForm();
      loadCompanies();
    } catch (error: any) {
      console.error('Error updating company:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar la empresa');
    }
  };

  const handleDeleteCompany = (company: Company) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de eliminar la empresa "${company.name}"? Esta acción eliminará todas las sedes, almacenes y áreas asociadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await companiesApi.deleteCompany(company.id);
              Alert.alert('Éxito', 'Empresa eliminada correctamente');
              loadCompanies();
            } catch (error: any) {
              console.error('Error deleting company:', error);
              Alert.alert('Error', error.message || 'No se pudo eliminar la empresa');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      ruc: company.ruc || '',
      name: company.name,
      alias: company.alias || '',
      companyType: company.companyType,
      isActive: company.isActive,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      ruc: '',
      name: '',
      alias: '',
      companyType: CompanyType.EXTERNAL,
      isActive: true,
    });
    setSelectedCompany(null);
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

  const handleViewCompanyDetail = (company: Company) => {
    // Navegar a la pantalla de detalle de empresa
    navigation.navigate('CompanyDetail', { companyId: company.id });
  };

  const renderCompanyItem = ({ item }: { item: Company }) => (
    <View style={styles.companyCard}>
      <View style={styles.companyHeader}>
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>{item.alias || item.name}</Text>
          {item.ruc && <Text style={styles.companyRuc}>RUC: {item.ruc}</Text>}
        </View>
        <View
          style={[styles.statusBadge, item.isActive ? styles.statusActive : styles.statusInactive]}
        >
          <Text style={styles.statusText}>{item.isActive ? 'Activo' : 'Inactivo'}</Text>
        </View>
      </View>

      <View style={styles.companyActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewDetailsButton]}
          onPress={() => handleViewCompanyDetail(item)}
        >
          <Text style={styles.actionButtonText}>👁️ Ver Detalles</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Text style={styles.actionButtonText}>✏️ Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteCompany(item)}
        >
          <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.companyDate}>
        Creado: {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );

  const renderModal = (
    visible: boolean,
    onClose: () => void,
    onSave: () => void,
    title: string
  ) => (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{title}</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre de la Empresa *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Ej: Mi Empresa S.A.C."
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>RUC (Opcional)</Text>
              <TextInput
                style={styles.input}
                value={formData.ruc}
                onChangeText={(text) => setFormData({ ...formData, ruc: text })}
                placeholder="Ej: 20123456789"
                keyboardType="numeric"
                maxLength={11}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Alias (Opcional)</Text>
              <TextInput
                style={styles.input}
                value={formData.alias}
                onChangeText={(text) => setFormData({ ...formData, alias: text })}
                placeholder="Ej: ACME"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Tipo de Empresa</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setFormData({ ...formData, companyType: CompanyType.EXTERNAL })}
                >
                  <View
                    style={[
                      styles.radio,
                      formData.companyType === CompanyType.EXTERNAL && styles.radioSelected,
                    ]}
                  />
                  <Text style={styles.radioLabel}>Externa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setFormData({ ...formData, companyType: CompanyType.INTERNAL })}
                >
                  <View
                    style={[
                      styles.radio,
                      formData.companyType === CompanyType.INTERNAL && styles.radioSelected,
                    ]}
                  />
                  <Text style={styles.radioLabel}>Interna</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setFormData({ ...formData, isActive: !formData.isActive })}
              >
                <View style={[styles.checkbox, formData.isActive && styles.checkboxChecked]}>
                  {formData.isActive && <Text style={styles.checkboxIcon}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Empresa Activa</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={onSave}>
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.color.brand.accent} />
        <Text style={styles.loadingText}>Cargando empresas...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Empresas</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o RUC..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Companies List */}
      <FlatList
        data={companies}
        renderItem={renderCompanyItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay empresas registradas</Text>
            <Text style={styles.emptySubtext}>Presiona "+ Nueva" para crear una</Text>
          </View>
        }
      />

      {/* Create Modal */}
      {renderModal(
        showCreateModal,
        () => {
          setShowCreateModal(false);
          resetForm();
        },
        handleCreateCompany,
        'Nueva Empresa'
      )}

      {/* Edit Modal */}
      {renderModal(
        showEditModal,
        () => {
          setShowEditModal(false);
          resetForm();
        },
        handleUpdateCompany,
        'Editar Empresa'
      )}

      {/* Add Button */}
      <AddButton
        onPress={() => {
          resetForm();
          setShowCreateModal(true);
        }}
        icon="🏛️"
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.color.background.subtle,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.color.text.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    padding: theme.space[2],
  },
  backButtonText: {
    fontSize: 24,
    color: theme.color.brand.accent,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.color.text.heading,
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.space[3],
    backgroundColor: theme.color.background.subtle,
    color: theme.color.text.heading,
  },
  searchButton: {
    marginLeft: theme.space[2],
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.color.brand.accent,
    borderRadius: theme.radii.md,
  },
  searchButtonText: {
    fontSize: 18,
  },
  listContainer: {
    padding: theme.space[4],
    paddingBottom: 100,
  },
  companyCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    marginBottom: theme.space[3],
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  companyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.space[3],
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.color.text.heading,
    marginBottom: 4,
  },
  companyRuc: {
    fontSize: 14,
    color: theme.color.text.muted,
  },
  statusBadge: {
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.lg,
  },
  statusActive: {
    backgroundColor: theme.color.state.success.background,
  },
  statusInactive: {
    backgroundColor: theme.color.state.danger.background,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  companyActions: {
    flexDirection: 'row',
    gap: theme.space[2],
    marginBottom: theme.space[2],
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  viewDetailsButton: {
    backgroundColor: theme.color.brand.accentSoft,
  },
  editButton: {
    backgroundColor: theme.color.brand.accentSoft,
  },
  deleteButton: {
    backgroundColor: theme.color.state.danger.background,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  companyDate: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: theme.space[2],
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.color.text.subtle,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.color.surface.elevated,
    borderRadius: theme.radii.xl,
    padding: theme.space[6],
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.color.text.heading,
    marginBottom: theme.space[6],
  },
  formGroup: {
    marginBottom: theme.space[5],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: theme.space[2],
  },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radii.md,
    padding: theme.space[3],
    fontSize: 16,
    backgroundColor: theme.color.background.subtle,
    color: theme.color.text.heading,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: theme.color.border.default,
    borderRadius: 4,
    marginRight: theme.space[2],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.color.brand.accent,
    borderColor: theme.color.brand.accent,
  },
  checkboxIcon: {
    color: theme.color.text.onAction,
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: theme.color.text.heading,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: theme.space[4],
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
    borderColor: theme.color.border.default,
    marginRight: theme.space[2],
  },
  radioSelected: {
    borderColor: theme.color.brand.accent,
    backgroundColor: theme.color.brand.accent,
  },
  radioLabel: {
    fontSize: 16,
    color: theme.color.text.heading,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.space[3],
    marginTop: theme.space[6],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.border.default,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.muted,
  },
  saveButton: {
    flex: 1,
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.brand.accent,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.onAction,
  },
});

export default CompaniesScreen;
