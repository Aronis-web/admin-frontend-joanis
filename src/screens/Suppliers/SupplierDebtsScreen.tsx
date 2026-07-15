import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  TextInput,
  FlatList,
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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

type TabType = 'all' | 'unassigned' | 'summary';

export const SupplierDebtsScreen = ({ navigation, route }: any) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const initialSupplierId = route?.params?.supplierId;
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(initialSupplierId || null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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
    if (selectedSupplierId) {
      loadData();
    } else {
      loadSuppliers();
    }
  }, [selectedSupplierId]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const response = await suppliersService.getSuppliers({ limit: 1000 });
      setSuppliers(response.data || []);
    } catch (error: any) {
      console.error('Error loading suppliers:', error);
      Alert.alert('Error', 'No se pudo cargar la lista de proveedores');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    if (!selectedSupplierId) return;

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
    if (!selectedSupplierId) return;
    try {
      const data = await suppliersService.getSupplier(selectedSupplierId);
      setSupplier(data);
    } catch (error) {
      console.error('Error loading supplier:', error);
    }
  };

  const loadTransactions = async () => {
    if (!selectedSupplierId) return;
    try {
      const response = await suppliersService.getTransactions(selectedSupplierId);
      setTransactions(response.data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const loadUnassignedTransactions = async () => {
    if (!selectedSupplierId) return;
    try {
      const data = await suppliersService.getUnassignedTransactions(selectedSupplierId);
      setUnassignedTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error loading unassigned transactions:', error);
    }
  };

  const loadSummary = async () => {
    if (!selectedSupplierId) return;
    try {
      const data = await suppliersService.getDebtSummary(selectedSupplierId);
      setSummary(data);
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedSupplierId) {
      await loadData();
    } else {
      await loadSuppliers();
    }
    setRefreshing(false);
  }, [selectedSupplierId]);

  const handleCreateTransaction = () => {
    setEditingTransaction(null);
    setShowFormModal(true);
  };

  const handleEditTransaction = (transaction: SupplierDebtTransaction) => {
    setEditingTransaction(transaction);
    setShowFormModal(true);
  };

  const handleDeleteTransaction = (transaction: SupplierDebtTransaction) => {
    if (!selectedSupplierId) return;
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
              await suppliersService.deleteTransaction(selectedSupplierId, transaction.id);
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
          <Ionicons name="document-text-outline" size={64} color={theme.color.icon.disabled} />
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

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.commercialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.legalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ruc?.includes(searchQuery)
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.accent} />
          <Text style={styles.loadingText}>
            {selectedSupplierId ? 'Cargando deudas...' : 'Cargando proveedores...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Si no hay proveedor seleccionado, mostrar lista de proveedores
  if (!selectedSupplierId) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.color.text.body} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Deudas de Proveedores</Text>
            <Text style={styles.headerSubtitle}>Seleccione un proveedor</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.color.text.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o RUC..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.color.text.placeholder}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={theme.color.text.placeholder} />
            </TouchableOpacity>
          )}
        </View>

        {/* Suppliers List */}
        <FlatList
          data={filteredSuppliers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.supplierCard}
              onPress={() => setSelectedSupplierId(item.id)}
            >
              <View style={styles.supplierIconContainer}>
                <Ionicons name="business" size={24} color={theme.color.brand.accent} />
              </View>
              <View style={styles.supplierInfo}>
                <Text style={styles.supplierName}>{item.commercialName}</Text>
                {item.ruc && <Text style={styles.supplierRuc}>RUC: {item.ruc}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.color.icon.disabled} />
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={64} color={theme.color.icon.disabled} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No se encontraron proveedores' : 'No hay proveedores registrados'}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setSelectedSupplierId(null)}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.color.text.body} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Deudas - {supplier?.commercialName}</Text>
          <Text style={styles.headerSubtitle}>Gestión de transacciones</Text>
        </View>
        <TouchableOpacity onPress={handleCreateTransaction} style={styles.addButton}>
          <Ionicons name="add-circle" size={32} color={theme.color.brand.accent} />
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
      {selectedSupplierId && (
        <>
          <DebtTransactionFormModal
            visible={showFormModal}
            supplierId={selectedSupplierId}
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
              supplierId={selectedSupplierId}
              transaction={assigningTransaction}
              onClose={() => {
                setShowAssignModal(false);
                setAssigningTransaction(null);
              }}
              onSuccess={handleAssignSuccess}
            />
          )}
        </>
      )}
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
  },
  loadingText: {
    marginTop: theme.space[4],
    fontSize: 16,
    color: theme.color.text.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    padding: theme.space[2],
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: theme.space[3],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.color.text.heading,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.color.text.muted,
    marginTop: 2,
  },
  addButton: {
    padding: theme.space[2],
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.space[4],
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: theme.color.brand.accent,
  },
  tabText: {
    fontSize: 14,
    color: theme.color.text.muted,
    fontWeight: '500',
  },
  activeTabText: {
    color: theme.color.brand.accent,
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
    marginTop: theme.space[4],
    fontSize: 16,
    color: theme.color.text.subtle,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    marginHorizontal: theme.space[4],
    marginVertical: theme.space[3],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  searchIcon: {
    marginRight: theme.space[2],
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.space[3],
    fontSize: 15,
    color: theme.color.text.body,
  },
  clearButton: {
    padding: theme.space[1],
  },
  supplierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    marginHorizontal: theme.space[4],
    marginBottom: theme.space[3],
    padding: theme.space[4],
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  supplierIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.color.brand.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: 4,
  },
  supplierRuc: {
    fontSize: 14,
    color: theme.color.text.muted,
  },
});

export default SupplierDebtsScreen;
