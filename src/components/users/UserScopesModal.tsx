import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { companiesApi } from '@/services/api/companies';
import { Company, UserCompany, UserCompanySite, UserCompanyStatus } from '@/types/companies';
import { UserSitesManagementModal } from './UserSitesManagementModal';

interface UserScopesModalProps {
  visible: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
}

/**
 * UserScopesModal
 *
 * Gestiona los scopes (alcances) de un usuario:
 * - Asignación a empresas
 * - Asignación a sedes dentro de cada empresa
 *
 * Según la documentación:
 * 1. Primero se asigna el usuario a una empresa (POST /companies/:id/users)
 * 2. Luego se asignan las sedes (POST /companies/:id/sites/assign)
 *
 * La gestión de Apps y Roles se hace desde el módulo de Apps, NO desde aquí.
 */
export const UserScopesModal: React.FC<UserScopesModalProps> = ({
  visible,
  userId,
  userName,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [userCompanies, setUserCompanies] = useState<UserCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isOwner, setIsOwner] = useState(false);
  const [showAssignCompany, setShowAssignCompany] = useState(false);

  // Sites management modal
  const [showSitesModal, setShowSitesModal] = useState(false);
  const [selectedCompanyForSites, setSelectedCompanyForSites] = useState<string>('');
  const [selectedCompanyNameForSites, setSelectedCompanyNameForSites] = useState<string>('');

  // Load data when modal opens
  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCompanies(),
        loadUserCompanies(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudo cargar la información');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await companiesApi.getCompanies({ isActive: true, limit: 100 });
      setCompanies(response.data);
    } catch (error) {
      console.error('Error loading companies:', error);
      throw error;
    }
  };

  const loadUserCompanies = async () => {
    try {
      // Get all companies and filter by user
      const allCompanies = await companiesApi.getCompanies({ limit: 100 });
      const userComps: UserCompany[] = [];

      for (const company of allCompanies.data) {
        try {
          const companyUsers = await companiesApi.getCompanyUsers(company.id);
          const userInCompany = companyUsers.data.find(uc => uc.userId === userId);
          if (userInCompany) {
            userComps.push(userInCompany);
          }
        } catch (error) {
          // Company might not have users endpoint accessible
          console.log(`Could not load users for company ${company.id}`);
        }
      }

      setUserCompanies(userComps);
    } catch (error) {
      console.error('Error loading user companies:', error);
      throw error;
    }
  };

  const handleAssignToCompany = async () => {
    if (!selectedCompanyId) {
      Alert.alert('Error', 'Selecciona una empresa');
      return;
    }

    setLoading(true);
    try {
      await companiesApi.assignUserToCompany(selectedCompanyId, {
        userId,
        isOwner,
        status: UserCompanyStatus.ACTIVE,
      });

      Alert.alert('Éxito', 'Usuario asignado a la empresa correctamente');
      setShowAssignCompany(false);
      setSelectedCompanyId('');
      setIsOwner(false);
      await loadUserCompanies();
    } catch (error: any) {
      console.error('Error assigning user to company:', error);
      Alert.alert('Error', error.message || 'No se pudo asignar el usuario a la empresa');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromCompany = async (companyId: string, companyName: string) => {
    Alert.alert(
      'Confirmar',
      `¿Estás seguro de que deseas remover a ${userName} de la empresa ${companyName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await companiesApi.removeUserFromCompany(companyId, userId);
              Alert.alert('Éxito', 'Usuario removido de la empresa');
              await loadUserCompanies();
            } catch (error: any) {
              console.error('Error removing user from company:', error);
              Alert.alert('Error', error.message || 'No se pudo remover el usuario');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleManageSites = (companyId: string, companyName: string) => {
    setSelectedCompanyForSites(companyId);
    setSelectedCompanyNameForSites(companyName);
    setShowSitesModal(true);
  };

  const getCompanyName = (companyId: string): string => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || companyId;
  };

  const renderCompanyCard = (userCompany: UserCompany) => {
    const company = companies.find(c => c.id === userCompany.companyId);

    return (
      <View key={userCompany.companyId} style={styles.companyCard}>
        <View style={styles.companyHeader}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>
              {company?.name || 'Empresa'}
            </Text>
            <Text style={styles.companyRuc}>
              RUC: {company?.ruc || 'N/A'}
            </Text>
          </View>
          {userCompany.isOwner && (
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerBadgeText}>👑 Owner</Text>
            </View>
          )}
        </View>

        <View style={styles.companyDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estado:</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: userCompany.status === 'ACTIVE' ? '#10B98120' : '#EF444420' }
            ]}>
              <Text style={[
                styles.statusText,
                { color: userCompany.status === 'ACTIVE' ? '#10B981' : '#EF4444' }
              ]}>
                {userCompany.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.companyActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleManageSites(userCompany.companyId, company?.name || 'Empresa')}
          >
            <Text style={styles.actionButtonText}>📍 Gestionar Sedes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.removeButton]}
            onPress={() => handleRemoveFromCompany(userCompany.companyId, company?.name || 'Empresa')}
          >
            <Text style={styles.removeButtonText}>🗑️ Remover</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>🎯 Gestión de Scopes</Text>
              <Text style={styles.modalSubtitle}>
                Usuario: {userName}
              </Text>
              <Text style={styles.helpText}>
                Asigna empresas y sedes a las que el usuario tiene acceso
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading && userCompanies.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Cargando información...</Text>
              </View>
            ) : (
              <>
                {/* User Companies List */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Empresas Asignadas</Text>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => setShowAssignCompany(!showAssignCompany)}
                    >
                      <Text style={styles.addButtonText}>
                        {showAssignCompany ? '✕ Cancelar' : '+ Asignar Empresa'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Assign Company Form */}
                  {showAssignCompany && (
                    <View style={styles.assignForm}>
                      <Text style={styles.label}>Seleccionar Empresa</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={selectedCompanyId}
                          onValueChange={setSelectedCompanyId}
                          style={styles.picker}
                        >
                          <Picker.Item label="Selecciona una empresa..." value="" />
                          {companies
                            .filter(c => !userCompanies.some(uc => uc.companyId === c.id))
                            .map(company => (
                              <Picker.Item
                                key={company.id}
                                label={`${company.name} (${company.ruc})`}
                                value={company.id}
                              />
                            ))}
                        </Picker>
                      </View>

                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>¿Es propietario de la empresa?</Text>
                        <Switch
                          value={isOwner}
                          onValueChange={setIsOwner}
                          trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
                          thumbColor={isOwner ? '#FFFFFF' : '#94A3B8'}
                        />
                      </View>

                      <TouchableOpacity
                        style={styles.submitButton}
                        onPress={handleAssignToCompany}
                        disabled={loading || !selectedCompanyId}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.submitButtonText}>Asignar a Empresa</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Companies List */}
                  {userCompanies.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateIcon}>🏢</Text>
                      <Text style={styles.emptyStateText}>
                        Este usuario no está asignado a ninguna empresa
                      </Text>
                      <Text style={styles.emptyStateSubtext}>
                        Asigna una empresa para comenzar
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.companiesList}>
                      {userCompanies.map(renderCompanyCard)}
                    </View>
                  )}
                </View>

                {/* Info Section */}
                <View style={styles.infoSection}>
                  <Text style={styles.infoTitle}>ℹ️ Información sobre Scopes</Text>
                  <Text style={styles.infoText}>
                    • <Text style={styles.infoBold}>Empresa:</Text> Asigna al usuario a una empresa para que pueda acceder a sus datos.
                  </Text>
                  <Text style={styles.infoText}>
                    • <Text style={styles.infoBold}>Sedes:</Text> Dentro de cada empresa, puedes asignar sedes específicas.
                  </Text>
                  <Text style={styles.infoText}>
                    • <Text style={styles.infoBold}>Apps y Roles:</Text> Se gestionan desde el módulo de Apps, no desde aquí.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeFooterButton} onPress={onClose}>
              <Text style={styles.closeFooterButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Sites Management Modal */}
      <UserSitesManagementModal
        visible={showSitesModal}
        userId={userId}
        userName={userName}
        companyId={selectedCompanyForSites}
        companyName={selectedCompanyNameForSites}
        onClose={() => {
          setShowSitesModal(false);
          loadUserCompanies(); // Reload to show updated sites
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 600,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  addButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  assignForm: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 16,
  },
  picker: {
    height: 50,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#10B981',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  companiesList: {
    gap: 12,
  },
  companyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
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
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  companyRuc: {
    fontSize: 14,
    color: '#6B7280',
  },
  ownerBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ownerBadgeText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  companyDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  companyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#EF4444',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  infoSection: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 8,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  closeFooterButton: {
    backgroundColor: '#6B7280',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
