import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { suppliersService } from '@/services/api/suppliers';
import { companiesApi } from '@/services/api/companies';
import { SupplierDebtTransaction } from '@/types/suppliers';

interface AssignCompanyModalProps {
  visible: boolean;
  supplierId: string;
  transaction: SupplierDebtTransaction;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignCompanyModal: React.FC<AssignCompanyModalProps> = ({
  visible,
  supplierId,
  transaction,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  useEffect(() => {
    if (visible) {
      loadCompanies();
    }
  }, [visible]);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const response = await companiesApi.getCompanies();
      setCompanies(response.data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
      Alert.alert('Error', 'No se pudieron cargar las empresas');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedCompanyId) {
      Alert.alert('Error', 'Debe seleccionar una empresa');
      return;
    }

    try {
      setLoading(true);
      await suppliersService.assignTransactionToCompany(supplierId, transaction.id, {
        companyId: selectedCompanyId,
      });
      Alert.alert('Éxito', 'Transacción asignada correctamente');
      onSuccess();
    } catch (error: any) {
      console.error('Error assigning transaction:', error);
      Alert.alert('Error', error.message || 'No se pudo asignar la transacción');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    const soles = cents / 100;
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(soles);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Asignar a Empresa</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#2c3e50" />
            </TouchableOpacity>
          </View>

          {/* Transaction Info */}
          <View style={styles.transactionInfo}>
            <Text style={styles.infoLabel}>Transacción:</Text>
            <Text style={styles.infoValue}>{transaction.transactionNumber}</Text>
            <Text style={styles.infoLabel}>Monto:</Text>
            <Text style={[styles.infoValue, styles.amount]}>
              {formatCurrency(transaction.amountCents)}
            </Text>
            {transaction.referenceNumber && (
              <>
                <Text style={styles.infoLabel}>Referencia:</Text>
                <Text style={styles.infoValue}>{transaction.referenceNumber}</Text>
              </>
            )}
          </View>

          {/* Companies List */}
          <Text style={styles.sectionTitle}>Seleccione una empresa:</Text>
          <ScrollView style={styles.companiesList}>
            {loading ? (
              <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
            ) : (
              companies.map((company) => (
                <TouchableOpacity
                  key={company.id}
                  style={[
                    styles.companyItem,
                    selectedCompanyId === company.id && styles.companyItemSelected,
                  ]}
                  onPress={() => setSelectedCompanyId(company.id)}
                >
                  <View style={styles.companyInfo}>
                    <Ionicons
                      name={selectedCompanyId === company.id ? 'radio-button-on' : 'radio-button-off'}
                      size={24}
                      color={selectedCompanyId === company.id ? '#3498db' : '#bdc3c7'}
                    />
                    <View style={styles.companyTexts}>
                      <Text style={styles.companyName}>{company.name}</Text>
                      {company.ruc && <Text style={styles.companyRuc}>RUC: {company.ruc}</Text>}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.assignButton, (!selectedCompanyId || loading) && styles.assignButtonDisabled]}
              onPress={handleAssign}
              disabled={!selectedCompanyId || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.assignButtonText}>Asignar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#3498db',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  transactionInfo: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  infoLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 8,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 2,
  },
  amount: {
    fontSize: 18,
    color: '#e74c3c',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    padding: 16,
    paddingBottom: 8,
  },
  companiesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loader: {
    marginVertical: 32,
  },
  companyItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ecf0f1',
    borderRadius: 8,
    marginBottom: 8,
  },
  companyItemSelected: {
    borderColor: '#3498db',
    backgroundColor: '#ebf5fb',
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  companyTexts: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  companyRuc: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#ecf0f1',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7f8c8d',
  },
  assignButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#3498db',
    borderRadius: 8,
    alignItems: 'center',
  },
  assignButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  assignButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default AssignCompanyModal;
