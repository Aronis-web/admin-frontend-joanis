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
import { colors, spacing, borderRadius } from '@/design-system/tokens';

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
              <Ionicons name="close" size={24} color={colors.neutral[0]} />
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
              <ActivityIndicator size="large" color={colors.accent[500]} style={styles.loader} />
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
                      color={selectedCompanyId === company.id ? colors.accent[500] : colors.neutral[300]}
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
                <ActivityIndicator color={colors.neutral[0]} />
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
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.accent[500],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.neutral[0],
  },
  closeButton: {
    padding: spacing[1],
  },
  transactionInfo: {
    padding: spacing[4],
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[2],
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    marginTop: spacing[0.5],
  },
  amount: {
    fontSize: 18,
    color: colors.danger[500],
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.neutral[800],
    padding: spacing[4],
    paddingBottom: spacing[2],
  },
  companiesList: {
    flex: 1,
    paddingHorizontal: spacing[4],
  },
  loader: {
    marginVertical: spacing[8],
  },
  companyItem: {
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.lg,
    marginBottom: spacing[2],
  },
  companyItemSelected: {
    borderColor: colors.accent[500],
    backgroundColor: colors.accent[50],
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  companyTexts: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  companyRuc: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  footer: {
    flexDirection: 'row',
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing[3],
  },
  cancelButton: {
    flex: 1,
    padding: spacing[3],
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.neutral[500],
  },
  assignButton: {
    flex: 1,
    padding: spacing[3],
    backgroundColor: colors.accent[500],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  assignButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  assignButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.neutral[0],
  },
});

export default AssignCompanyModal;
