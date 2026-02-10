import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { suppliersService } from '@/services/api/suppliers';
import {
  Supplier,
  SupplierDebtTransaction,
  SupplierDebtSummaryResponse,
  TransactionType,
} from '@/types/suppliers';
import { DebtTransactionFormModal } from '@/components/Suppliers';
import { DebtTransactionCard } from '@/components/Suppliers';
import { DebtSummaryCard } from '@/components/Suppliers';
import { AssignCompanyModal } from '@/components/Suppliers';

type TabType = 'all' | 'unassigned' | 'summary';

export const SupplierDebtsScreen = ({ navigation, route }: any) => {
  const supplierId = route?.params?.supplierId;
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<SupplierDebtTransaction[]>([]);
  const [unassignedTransactions, setUnassignedTransactions] = useState<SupplierDebtTransaction[]>([]);
  const [summary, setSummary] = useState<SupplierDebtSummaryResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<SupplierDebtTransaction | null>(null);
  const [assigningTransaction, setAssigningTransaction] = useState<SupplierDebtTransaction | null>(null);

  useEffect(() => {
    loadData();
  }, [supplierId]);

  const loadData = async () => {
    if (!supplierId) return;

    try {
      setLoading(true);
      await Promise.all([
        loadSupplier(),
        loadTransactions(),
        loadUnassignedTransactions(),
        loadSummary(),
      ]);
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudo cargar la información');
    } finally {
      setLoading(false);
    }
  };

  const loadSupplier = async () => {
    try {
      const data = await suppliersService.getSupplier(supplierId);
      setSupplier(data);
    } catch (error) {
      console.error('Error loading supplier:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      const response = await suppliersService.getTransactions(supplierId);
      setTransactions(response.data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const loadUnassignedTransactions = async () => {
    try {
      const data = await suppliersService.getUnassignedTransactions(supplierId);
      setUnassignedTransactions(data || []);
    } catch (error) {
      console.error('Error loading unassigned transactions:', error);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await suppliersService.getDebtSummary(supplierId);
      setSummary(data);
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [supplierId]);

  const handleCreateTransaction = () => {
    setEditingTransaction(null);
    setShowFormModal(true);
  };

  const handleEditTransaction = (transaction: SupplierDebtTransaction) => {
    setEditingTransaction(transaction);
    setShowFormModal(true);
  };

  const handleDeleteTransaction = (transaction: SupplierDebtTransaction) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Está seguro de eliminar la transacción ${transaction.transactionNumber}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await suppliersService.deleteTransaction(supplierId, transaction.id);
              Alert.alert('Éxito', 'Transacción eliminada correctamente');
              await loadData();
            } catch (error: any) {
              console.error('Error deleting transaction:', error);
              Alert.alert('Error', error.message || 'No se pudo eliminar la transacción');
            }
          },
        },
      ]
    );
  };

  const handleAssignToCompany = (transaction: SupplierDebtTransaction) => {
    setAssigningTransaction(transaction);
    setShowAssignModal(true);
  };

  const handleFormSuccess = async () => {
    setShowFormModal(false);
    setEditingTransaction(null);
    await loadData();
  };

  const handleAssignSuccess = async () => {
    setShowAssignModal(false);
    setAssigningTransaction(null);
    await loadData();
  };

  const formatCurrency = (cents: number) => {
    const soles = cents / 100;
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(soles);
  };

  const getTransactionTypeLabel = (type: TransactionType) => {
    const labels: Record<TransactionType, string> = {
      PURCHASE: 'Compra',
      PAYMENT: 'Pago',
      ADJUSTMENT: 'Ajuste',
      CREDIT_NOTE: 'Nota de Crédito',
      DEBIT_NOTE: 'Nota de Débito',
    };
    return labels[type] || type;
  };

  const getTransactionTypeColor = (type: TransactionType) => {
    const colors: Record<TransactionType, string> = {
      PURCHASE: '#e74c3c',
      PAYMENT: '#27ae60',
      ADJUSTMENT: '#f39c12',
      CREDIT_NOTE: '#3498db',
      DEBIT_NOTE: '#e67e22',
    };
    return colors[type] || '#95a5a6';
  };

  const renderTransactionsList = (txns: SupplierDebtTransaction[]) => {
    if (txns.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#bdc3c7" />
          <Text style={styles.emptyText}>No hay transacciones</Text>
        </View>
      );
    }

    return txns.map((transaction) => (
      <DebtTransactionCard
        key={transaction.id}
        transaction={transaction}
        onEdit={() => handleEditTransaction(transaction)}
        onDelete={() => handleDeleteTransaction(transaction)}
        onAssign={!transaction.companyId ? () => handleAssignToCompany(transaction) : undefined}
        formatCurrency={formatCurrency}
        getTypeLabel={getTransactionTypeLabel}
        getTypeColor={getTransactionTypeColor}
      />
    ));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Cargando deudas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Deudas - {supplier?.commercialName}</Text>
          <Text style={styles.headerSubtitle}>Gestión de transacciones</Text>
        </View>
        <TouchableOpacity onPress={handleCreateTransaction} style={styles.addButton}>
          <Ionicons name="add-circle" size={32} color="#3498db" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            Todas ({transactions.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'unassigned' && styles.activeTab]}
          onPress={() => setActiveTab('unassigned')}
        >
          <Text style={[styles.tabText, activeTab === 'unassigned' && styles.activeTabText]}>
            Sin Asignar ({unassignedTransactions.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'summary' && styles.activeTab]}
          onPress={() => setActiveTab('summary')}
        >
          <Text style={[styles.tabText, activeTab === 'summary' && styles.activeTabText]}>
            Resumen
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'all' && renderTransactionsList(transactions)}
        {activeTab === 'unassigned' && renderTransactionsList(unassignedTransactions)}
        {activeTab === 'summary' && summary && (
          <DebtSummaryCard summary={summary} formatCurrency={formatCurrency} />
        )}
      </ScrollView>

      {/* Modals */}
      <DebtTransactionFormModal
        visible={showFormModal}
        supplierId={supplierId}
        transaction={editingTransaction}
        onClose={() => {
          setShowFormModal(false);
          setEditingTransaction(null);
        }}
        onSuccess={handleFormSuccess}
      />

      {assigningTransaction && (
        <AssignCompanyModal
          visible={showAssignModal}
          supplierId={supplierId}
          transaction={assigningTransaction}
          onClose={() => {
            setShowAssignModal(false);
            setAssigningTransaction(null);
          }}
          onSuccess={handleAssignSuccess}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  addButton: {
    padding: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3498db',
  },
  tabText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#95a5a6',
  },
});

export default SupplierDebtsScreen;
