import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { expensesService, sitesService } from '@/services/api';
import {
  Expense,
  ExpenseStatus,
  ExpenseStatusLabels,
} from '@/types/expenses';
import { useAuthStore } from '@/store/auth';
import { MAIN_ROUTES } from '@/constants/routes';
import { AddButton } from '@/components/Navigation/AddButton';
import { ExpenseCard } from '@/components/Expenses/ExpenseCard';
import { ReconcileAmountModal } from '@/components/Expenses/ReconcileAmountModal';
import { usePermissions } from '@/hooks/usePermissions';

interface ExpensesScreenProps {
  navigation: any;
}

export const ExpensesScreen: React.FC<ExpensesScreenProps> = ({ navigation }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ExpenseStatus | 'ALL'>('ALL');
  const [reconcileModalVisible, setReconcileModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const { currentCompany, currentSite } = useAuthStore();
  const { hasPermission } = usePermissions();
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  // Check permissions
  const canUpdate = hasPermission('expenses.payments.update') || hasPermission('expenses.admin');
  const canDelete = hasPermission('expenses.payments.delete') || hasPermission('expenses.admin');
  const canCreatePayment = hasPermission('expenses.payments.create') || hasPermission('expenses.admin');

  const loadExpenses = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedStatus !== 'ALL') params.status = selectedStatus;

      // Load expenses and sites in parallel
      const [expensesResponse, sitesResponse] = await Promise.all([
        expensesService.getExpenses(params),
        sitesService.getSites({ page: 1, limit: 100 }),
      ]);

      console.log('📊 Expenses loaded:', expensesResponse.data.length);
      console.log('🏢 Sites loaded:', sitesResponse.data.length);
      console.log('📝 First expense siteId:', expensesResponse.data[0]?.siteId);
      console.log('🏢 First site:', sitesResponse.data[0]);

      // Create a map of sites by ID for quick lookup
      const sitesMap = new Map(
        sitesResponse.data.map((site: any) => [site.id, site])
      );

      // Enrich expenses with site objects
      const enrichedExpenses = expensesResponse.data.map((expense: any) => ({
        ...expense,
        site: expense.siteId ? sitesMap.get(expense.siteId) : undefined,
      }));

      console.log('✅ First enriched expense site:', enrichedExpenses[0]?.site);

      setExpenses(enrichedExpenses);
    } catch (error: any) {
      console.error('Error loading expenses:', error);
      Alert.alert('Error', 'No se pudieron cargar los gastos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus]);

  // Auto-reload expenses when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 ExpensesScreen focused - reloading expenses...');
      setLoading(true);
      loadExpenses();
    }, [loadExpenses])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadExpenses();
  };

  const handleCreateExpense = () => {
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE as never);
  };

  const handleExpensePress = (expense: Expense) => {
    navigation.navigate(MAIN_ROUTES.EXPENSE_DETAIL as never, { expenseId: expense.id });
  };

  const handleChangeStatus = (expense: Expense) => {
    navigation.navigate(MAIN_ROUTES.EXPENSE_DETAIL as never, {
      expenseId: expense.id,
      action: 'change_status',
    });
  };

  const handleEditExpense = (expense: Expense) => {
    // Navigate to edit expense screen
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE as never, { expenseId: expense.id });
  };

  const handleDeleteExpense = (expense: Expense) => {
    Alert.alert(
      'Eliminar Gasto',
      `¿Estás seguro de que deseas eliminar el gasto "${expense.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await expensesService.deleteExpense(expense.id);
              Alert.alert('Éxito', 'Gasto eliminado correctamente');
              loadExpenses();
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', 'No se pudo eliminar el gasto');
            }
          },
        },
      ]
    );
  };

  const handleAddPayment = (expense: Expense) => {
    // Navigate to create payment screen
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE_PAYMENT as never, { expenseId: expense.id });
  };

  const handleReconcileAmount = (expense: Expense) => {
    setSelectedExpense(expense);
    setReconcileModalVisible(true);
  };

  const handleCloseReconcileModal = () => {
    setReconcileModalVisible(false);
    setSelectedExpense(null);
  };

  const handleReconcileSuccess = () => {
    loadExpenses();
  };

  const renderStatusFilter = () => {
    const statuses: Array<ExpenseStatus | 'ALL'> = [
      'ALL',
      ExpenseStatus.PENDING,
      ExpenseStatus.APPROVED,
      ExpenseStatus.PAID,
      ExpenseStatus.CANCELLED,
    ];

    return (
      <View style={styles.filterWrapper}>
        <Text style={styles.filterLabel}>Estado:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {statuses.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                isTablet && styles.filterButtonTablet,
                selectedStatus === status && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  isTablet && styles.filterButtonTextTablet,
                  selectedStatus === status && styles.filterButtonTextActive,
                ]}
              >
                {status === 'ALL' ? 'Todos' : ExpenseStatusLabels[status]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando gastos...</Text>
        </View>
      );
    }

    if (expenses.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No hay gastos registrados</Text>
          <Text style={styles.emptySubtext}>
            Presiona el botón + para crear un nuevo gasto
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {expenses.map((expense) => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            onPress={handleExpensePress}
            onEdit={canUpdate ? handleEditExpense : undefined}
            onDelete={canDelete ? handleDeleteExpense : undefined}
            onAddPayment={canCreatePayment ? handleAddPayment : undefined}
            onReconcileAmount={canUpdate ? handleReconcileAmount : undefined}
          />
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gastos</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('ExpenseCategories')}
          style={styles.categoriesButton}
        >
          <Text style={styles.categoriesButtonText}>Categorías</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
        {renderStatusFilter()}
        {renderContent()}
        <AddButton onPress={handleCreateExpense} />
      </View>

      {/* Reconcile Amount Modal */}
      {selectedExpense && (
        <ReconcileAmountModal
          visible={reconcileModalVisible}
          onClose={handleCloseReconcileModal}
          expenseId={selectedExpense.id}
          expenseName={selectedExpense.name}
          estimatedAmount={(selectedExpense.estimatedAmountCents || selectedExpense.amountCents || 0) / 100}
          onSuccess={handleReconcileSuccess}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  filterWrapper: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  filterContent: {
    paddingRight: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterButtonTablet: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterButtonTextTablet: {
    fontSize: 14,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  categoriesButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  categoriesButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
});

export default ExpensesScreen;
