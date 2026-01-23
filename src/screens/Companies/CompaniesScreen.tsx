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
import { companiesApi } from '@/services/api';
import { Company, CompanyType, CreateCompanyRequest, UpdateCompanyRequest } from '@/types/companies';

import { useMenuNavigation } from '@/hooks/useMenuNavigation';
import { AddButton } from '@/components/Navigation/AddButton';

interface CompaniesScreenProps {
  navigation: any;
}

export const CompaniesScreen: React.FC<CompaniesScreenProps> = ({ navigation }) => {
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
    if (!selectedCompany) return;

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
        <View style={[styles.statusBadge, item.isActive ? styles.statusActive : styles.statusInactive]}>
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

  const renderModal = (visible: boolean, onClose: () => void, onSave: () => void, title: string) => (
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
                  <View style={[styles.radio, formData.companyType === CompanyType.EXTERNAL && styles.radioSelected]} />
                  <Text style={styles.radioLabel}>Externa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setFormData({ ...formData, companyType: CompanyType.INTERNAL })}
                >
                  <View style={[styles.radio, formData.companyType === CompanyType.INTERNAL && styles.radioSelected]} />
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
        <ActivityIndicator size="large" color="#007AFF" />
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9F9F9',
  },
  searchButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  searchButtonText: {
    fontSize: 18,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  companyCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  companyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  companyRuc: {
    fontSize: 14,
    color: '#666',
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
  companyActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewDetailsButton: {
    backgroundColor: '#E3F2FD',
  },
  editButton: {
    backgroundColor: '#E3F2FD',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  companyDate: {
    fontSize: 12,
    color: '#999',
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
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
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

export default CompaniesScreen;
