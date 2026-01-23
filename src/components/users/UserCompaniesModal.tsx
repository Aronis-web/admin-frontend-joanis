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
} from 'react-native';
import { companiesApi } from '@/services/api/companies';
import { sitesApi } from '@/services/api/sites';
import { Company } from '@/types/companies';
import { Site } from '@/types/sites';
import { UserCompanyStatus } from '@/types/companies';

interface UserCompaniesModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

export const UserCompaniesModal: React.FC<UserCompaniesModalProps> = ({
  visible,
  userId,
  onClose,
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCompanies();
    }
  }, [visible, userId]);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      // Get all companies
      const response = await companiesApi.getCompanies({ limit: 100 });
      setCompanies(response.data);

      // Get companies assigned to the user
      const userCompanies = await companiesApi.getUserCompanies(userId);
      const userCompanyIds = new Set(userCompanies.map(c => c.id));
      setSelectedCompanyIds(userCompanyIds);
    } catch (error: any) {
      console.error('Error loading companies:', error);
      Alert.alert('Error', 'No se pudieron cargar las empresas');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompany = (companyId: string) => {
    setSelectedCompanyIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Get current user companies
      const currentCompanies = await companiesApi.getUserCompanies(userId);
      const currentCompanyIds = new Set(currentCompanies.map(c => c.id));

      // Add new companies
      for (const companyId of selectedCompanyIds) {
        if (!currentCompanyIds.has(companyId)) {
          await companiesApi.assignUserToCompany(companyId, {
            userId,
            isOwner: false,
            status: UserCompanyStatus.ACTIVE,
          });
        }
      }

      // Remove companies that are no longer selected
      for (const company of currentCompanies) {
        if (!selectedCompanyIds.has(company.id)) {
          await companiesApi.removeUserFromCompany(company.id, userId);
        }
      }

      Alert.alert('Éxito', 'Empresas actualizadas correctamente');
      onClose();
    } catch (error: any) {
      console.error('Error saving companies:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudieron actualizar las empresas');
    } finally {
      setSaving(false);
    }
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
            <Text style={styles.modalTitle}>Gestionar Empresas</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>Cargando empresas...</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollContent}>
              {companies.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No hay empresas disponibles</Text>
                </View>
              ) : (
                companies.map((company) => (
                  <TouchableOpacity
                    key={company.id}
                    style={styles.companyItem}
                    onPress={() => toggleCompany(company.id)}
                  >
                    <View style={styles.companyInfo}>
                      <Text style={styles.companyName}>{company.name}</Text>
                      <Text style={styles.companyRuc}>RUC: {company.ruc}</Text>
                      <Text style={styles.companyType}>{company.companyType}</Text>
                    </View>
                    <View style={[
                      styles.checkbox,
                      selectedCompanyIds.has(company.id) && styles.checkboxChecked
                    ]}>
                      {selectedCompanyIds.has(company.id) && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={saving || loading}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 28,
    color: '#64748B',
    fontWeight: '300',
  },
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
  },
  companyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  companyRuc: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 2,
  },
  companyType: {
    fontSize: 13,
    color: '#94A3B8',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    backgroundColor: '#6366F1',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
