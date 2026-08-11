import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { suppliersService } from '@/services/api/suppliers';
import { companiesApi } from '@/services/api/companies';
import { SupplierDebtTransaction } from '@/types/suppliers';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
              <Ionicons name="close" size={24} color={theme.color.text.inverse} />
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
              <ActivityIndicator size="large" color={theme.color.brand.accent} style={styles.loader} />
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
                      color={selectedCompanyId === company.id ? theme.color.brand.accent : theme.color.border.default}
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
                <ActivityIndicator color={theme.color.text.inverse} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: '90%',
      maxWidth: 500,
      maxHeight: '80%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.space[4],
      backgroundColor: theme.color.brand.accent,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.inverse,
    },
    closeButton: {
      padding: theme.space[1],
    },
    transactionInfo: {
      padding: theme.space[4],
      backgroundColor: theme.color.surface.subtle,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    infoLabel: {
      fontSize: 12,
      color: theme.color.text.subtle,
      marginTop: theme.space[2],
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginTop: theme.space[0.5],
    },
    amount: {
      fontSize: 18,
      color: theme.color.text.danger,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      padding: theme.space[4],
      paddingBottom: theme.space[2],
    },
    companiesList: {
      flex: 1,
      paddingHorizontal: theme.space[4],
    },
    loader: {
      marginVertical: theme.space[8],
    },
    companyItem: {
      padding: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.lg,
      marginBottom: theme.space[2],
    },
    companyItemSelected: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.brand.accentSoft,
    },
    companyInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    companyTexts: {
      flex: 1,
    },
    companyName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    companyRuc: {
      fontSize: 12,
      color: theme.color.text.subtle,
      marginTop: theme.space[0.5],
    },
    footer: {
      flexDirection: 'row',
      padding: theme.space[4],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
    cancelButton: {
      flex: 1,
      padding: theme.space[3],
      backgroundColor: theme.color.surface.muted,
      borderRadius: theme.radii.lg,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.color.text.subtle,
    },
    assignButton: {
      flex: 1,
      padding: theme.space[3],
      backgroundColor: theme.color.brand.accent,
      borderRadius: theme.radii.lg,
      alignItems: 'center',
    },
    assignButtonDisabled: {
      backgroundColor: theme.color.action.primary.backgroundDisabled,
    },
    assignButtonText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.color.text.inverse,
    },
  });

export default AssignCompanyModal;
