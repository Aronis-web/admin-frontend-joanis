import React, { useState, useCallback, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { sitesService } from '@/services/api';
import { Expense, ExpenseStatus, ExpenseStatusLabels } from '@/types/expenses';
import { useExpenses, useDeleteExpense } from '@/hooks/api';
import { useAuthStore } from '@/store/auth';
import { MAIN_ROUTES } from '@/constants/routes';
import { AddButton } from '@/components/Navigation/AddButton';
import { ExpenseCard } from '@/components/Expenses/ExpenseCard';
import { ReconcileAmountModal } from '@/components/Expenses/ReconcileAmountModal';
import { PaymentsModal } from '@/components/Expenses/PaymentsModal';
import { ExpenseReportModal } from '@/components/Expenses/ExpenseReportModal';
import { usePermissions } from '@/hooks/usePermissions';
import { StatusFilter, StatusOption } from '@/components/common/StatusFilter';
import { useScreenTracking } from '@/hooks/useScreenTracking';

interface ExpensesScreenProps {
  navigation: any;
}

export const ExpensesScreen: React.FC<ExpensesScreenProps> = ({ navigation }) => {
  // Screen tracking
  useScreenTracking('ExpensesScreen', 'ExpensesScreen');

  const [selectedStatus, setSelectedStatus] = useState<ExpenseStatus | 'ALL'>('ALL');
  const [reconcileModalVisible, setReconcileModalVisible] = useState(false);
  const [paymentsModalVisible, setPaymentsModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { currentCompany, currentSite } = useAuthStore();
  const { hasPermission } = usePermissions();
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  // Build query params
  const queryParams = useMemo(() => {
    const params: any = {
      page,
      limit,
      sortBy: 'expenseDate',
      sortOrder: 'DESC',
    };
    if (selectedStatus !== 'ALL') {
      params.status = selectedStatus;
    }
    return params;
  }, [page, limit, selectedStatus]);

  // React Query hooks
  const { data, isLoading, isRefetching, refetch } = useExpenses(queryParams);
  const deleteExpenseMutation = useDeleteExpense();

  // Check permissions
  const canUpdate = hasPermission('expenses.payments.update') || hasPermission('expenses.admin');
  const canDelete = hasPermission('expenses.payments.delete') || hasPermission('expenses.admin');
  const canCreatePayment =
    hasPermission('expenses.payments.create') || hasPermission('expenses.admin');

  // Enrich expenses with site data
  const expenses = useMemo(() => {
    if (!data?.data) return [];
    // Sites are already included in the expense data from the API
    return data.data;
  }, [data]);

  // Calculate pagination
  const pagination = useMemo(() => {
    if (!data?.meta) {
      return { page: 1, limit: 20, total: 0, totalPages: 0 };
    }
    return {
      page: data.meta.page,
      limit: data.meta.limit,
      total: data.meta.total,
      totalPages: data.meta.totalPages,
    };
  }, [data]);

  // Auto-reload expenses when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleRefresh = useCallback(() => {
    setPage(1);
    refetch();
  }, [refetch]);

  const handlePreviousPage = useCallback(() => {
    if (pagination.page > 1) {
      setPage(pagination.page - 1);
    }
  }, [pagination.page]);

  const handleNextPage = useCallback(() => {
    if (pagination.page < pagination.totalPages) {
      setPage(pagination.page + 1);
    }
  }, [pagination.page, pagination.totalPages]);

  const handleCreateExpense = useCallback(() => {
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE as never);
  }, [navigation]);

  const handleOpenReportModal = useCallback(() => {
    setReportModalVisible(true);
  }, []);

  const handleExpensePress = useCallback(
    (expense: Expense) => {
      navigation.navigate(MAIN_ROUTES.EXPENSE_DETAIL as never, { expenseId: expense.id });
    },
    [navigation]
  );

  const handleChangeStatus = useCallback(
    (expense: Expense) => {
      navigation.navigate(MAIN_ROUTES.EXPENSE_DETAIL as never, {
        expenseId: expense.id,
        action: 'change_status',
      });
    },
    [navigation]
  );

  const handleEditExpense = useCallback(
    (expense: Expense) => {
      // Navigate to edit expense screen
      navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE as never, { expenseId: expense.id });
    },
    [navigation]
  );

  const handleDeleteExpense = useCallback(
    (expense: Expense) => {
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
                await deleteExpenseMutation.mutateAsync(expense.id);
                Alert.alert('Éxito', 'Gasto eliminado correctamente');
              } catch (error) {
                console.error('Error deleting expense:', error);
                Alert.alert('Error', 'No se pudo eliminar el gasto');
              }
            },
          },
        ]
      );
    },
    [deleteExpenseMutation]
  );

  const handleAddPayment = useCallback(
    (expense: Expense) => {
      // Navigate to create payment screen
      navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE_PAYMENT as never, { expenseId: expense.id });
    },
    [navigation]
  );

  const handleReconcileAmount = useCallback((expense: Expense) => {
    setSelectedExpense(expense);
    setReconcileModalVisible(true);
  }, []);

  const handleCloseReconcileModal = useCallback(() => {
    setReconcileModalVisible(false);
    setSelectedExpense(null);
  }, []);

  const handleReconcileSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleViewPayments = useCallback((expense: Expense) => {
    // Open payments modal instead of navigating
    setSelectedExpense(expense);
    setPaymentsModalVisible(true);
  }, []);

  // Status filter options using new StatusFilter component
  const statusOptions: StatusOption[] = useMemo(() => {
    const getStatusColor = (status: ExpenseStatus | 'ALL'): string => {
      if (status === 'ALL') return '#6366F1';
      switch (status) {
        case ExpenseStatus.PENDING:
          return '#F59E0B';
        case ExpenseStatus.APPROVED:
          return '#10B981';
        case ExpenseStatus.PAID:
          return '#3B82F6';
        case ExpenseStatus.CANCELLED:
          return '#EF4444';
        default:
          return '#6B7280';
      }
    };

    return [
      { value: 'ALL', label: 'Todos', color: '#6366F1' },
      { value: ExpenseStatus.PENDING, label: ExpenseStatusLabels[ExpenseStatus.PENDING], color: getStatusColor(ExpenseStatus.PENDING) },
      { value: ExpenseStatus.APPROVED, label: ExpenseStatusLabels[ExpenseStatus.APPROVED], color: getStatusColor(ExpenseStatus.APPROVED) },
      { value: ExpenseStatus.PAID, label: ExpenseStatusLabels[ExpenseStatus.PAID], color: getStatusColor(ExpenseStatus.PAID) },
      { value: ExpenseStatus.CANCELLED, label: ExpenseStatusLabels[ExpenseStatus.CANCELLED], color: getStatusColor(ExpenseStatus.CANCELLED) },
    ];
  }, []);

  const renderContent = () => {
    if (isLoading && !isRefetching) {
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
          <Text style={styles.emptySubtext}>Presiona el botón + para crear un nuevo gasto</Text>
        </View>
      );
    }

    return (
      <>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
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
              onViewPayments={handleViewPayments}
            />
          ))}
        </ScrollView>
        {pagination.total > 0 && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[
                styles.paginationButton,
                pagination.page === 1 && styles.paginationButtonDisabled,
              ]}
              onPress={handlePreviousPage}
              disabled={pagination.page === 1}
            >
              <Text
                style={[
                  styles.paginationButtonText,
                  pagination.page === 1 && styles.paginationButtonTextDisabled,
                ]}
              >
                ← Anterior
              </Text>
            </TouchableOpacity>

            <View style={styles.paginationInfo}>
              <Text style={styles.paginationText}>
                Pág. {pagination.page}/{pagination.totalPages}
              </Text>
              <Text style={styles.paginationSubtext}>
                {expenses.length} de {pagination.total}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.paginationButton,
                pagination.page >= pagination.totalPages && styles.paginationButtonDisabled,
              ]}
              onPress={handleNextPage}
              disabled={pagination.page >= pagination.totalPages}
            >
              <Text
                style={[
                  styles.paginationButtonText,
                  pagination.page >= pagination.totalPages && styles.paginationButtonTextDisabled,
                ]}
              >
                Siguiente →
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </>
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
        <StatusFilter
          statuses={statusOptions}
          selectedStatus={selectedStatus}
          onStatusChange={(status) => setSelectedStatus(status as ExpenseStatus | 'ALL')}
          style={styles.statusFilter}
        />
        {renderContent()}

        {/* Download Report Button - Above Add Button */}
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={handleOpenReportModal}
          activeOpacity={0.9}
        >
          <Ionicons name="download" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <AddButton onPress={handleCreateExpense} />
      </View>

      {/* Reconcile Amount Modal */}
      {selectedExpense && (
        <ReconcileAmountModal
          visible={reconcileModalVisible}
          onClose={handleCloseReconcileModal}
          expenseId={selectedExpense.id}
          expenseName={selectedExpense.name}
          estimatedAmount={
            (selectedExpense.estimatedAmountCents || selectedExpense.amountCents || 0) / 100
          }
          onSuccess={handleReconcileSuccess}
        />
      )}

      {/* Payments Modal */}
      <PaymentsModal
        visible={paymentsModalVisible}
        expenseId={selectedExpense?.id || null}
        expenseCode={selectedExpense?.code}
        onClose={() => {
          setPaymentsModalVisible(false);
          setSelectedExpense(null);
        }}
      />

      {/* Report Modal */}
      <ExpenseReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        isRecurrent={false}
      />
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
  statusFilter: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
  paginationContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 60,
  },
  paginationInfo: {
    alignItems: 'center',
    minWidth: 100,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  paginationButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    minWidth: 110,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {
    color: '#94A3B8',
  },
  downloadButton: {
    position: 'absolute',
    bottom: 160, // Above the Add button (90px) + 70px spacing
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    zIndex: 9997,
  },
});

export default ExpensesScreen;
