import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { sitesService } from '@/services/api';
import { Expense, ExpenseStatus, ExpenseStatusLabels } from '@/types/expenses';
import { useExpenses, useDeleteExpense, useSearchExpensesV2, useExpensesV2 } from '@/hooks/api';
import { useAuthStore } from '@/store/auth';
import { MAIN_ROUTES } from '@/constants/routes';
import { AddButton } from '@/components/Navigation/AddButton';
import { ExpenseCard } from '@/components/Expenses/ExpenseCard';
import { ReconcileAmountModal } from '@/components/Expenses/ReconcileAmountModal';
import { PaymentsModal } from '@/components/Expenses/PaymentsModal';
import { ExpenseReportModal } from '@/components/Expenses/ExpenseReportModal';
import { ExpenseBulkUploadModal } from '@/components/Expenses/ExpenseBulkUploadModal';
import { ExpensesFAB } from '@/components/Expenses/ExpensesFAB';
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
  const [bulkUploadModalVisible, setBulkUploadModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

  // ✅ Búsqueda V2
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const { currentCompany, currentSite } = useAuthStore();
  const { hasPermission } = usePermissions();
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  // ✅ Debounce search query (800ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 800);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ✅ Determinar si usar búsqueda V2 o listado paginado
  const isUsingSearch = debouncedSearchQuery.length >= 2;

  // ✅ React Query: Listado paginado V2 (cuando NO hay búsqueda)
  const {
    data: expensesResponseV2,
    isLoading: isLoadingList,
    isRefetching,
    refetch,
  } = useExpensesV2({
    page,
    limit,
    status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
  });

  const deleteExpenseMutation = useDeleteExpense();

  // ✅ React Query: Búsqueda V2 optimizada
  const {
    data: searchResultsV2,
    isLoading: isSearchingV2,
    refetch: refetchSearchV2,
  } = useSearchExpensesV2(debouncedSearchQuery, {
    status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
    limit: 50,
    enabled: isUsingSearch,
  });

  // ✅ Determinar qué datos y estado de carga usar
  const isLoading = isUsingSearch ? isSearchingV2 : isLoadingList;

  // Check permissions
  const canUpdate = hasPermission('expenses.payments.update') || hasPermission('expenses.admin');
  const canDelete = hasPermission('expenses.payments.delete') || hasPermission('expenses.admin');
  const canCreatePayment =
    hasPermission('expenses.payments.create') || hasPermission('expenses.admin');

  // Enrich expenses with site data
  const expenses: Expense[] = useMemo(() => {
    // ✅ Si hay búsqueda activa, usar resultados V2
    if (isUsingSearch && searchResultsV2) {
      return (searchResultsV2 as any).expenses || (searchResultsV2 as any).results || [];
    }

    // ✅ Si no hay búsqueda, usar listado paginado V2
    // Backend retorna "expenses" directamente en el objeto
    const expensesData = (expensesResponseV2 as any)?.expenses || (expensesResponseV2 as any)?.results || (expensesResponseV2 as any)?.data;
    if (!expensesData) return [];

    // Map expenses to include site object if only siteId is present
    return expensesData.map((expense: any) => {
      // If expense has siteId but no site object, add the current site
      if (expense.siteId && !expense.site && currentSite) {
        return {
          ...expense,
          site: currentSite,
        };
      }
      return expense;
    });
  }, [expensesResponseV2, searchResultsV2, isUsingSearch, currentSite]);

  // Calculate pagination
  const pagination = useMemo(() => {
    // Backend puede retornar meta o directamente en el objeto
    const meta = expensesResponseV2?.meta || expensesResponseV2;
    if (!meta || !meta.total) {
      return { page: 1, limit: 50, total: 0, totalPages: 0 };
    }
    return {
      page: meta.page || 1,
      limit: meta.limit || 50,
      total: meta.total || 0,
      totalPages: meta.totalPages || 0,
    };
  }, [expensesResponseV2]);

  // Auto-reload expenses when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (isUsingSearch) {
        refetchSearchV2();
      } else {
        refetch();
      }
    }, [refetch, refetchSearchV2, isUsingSearch])
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

  const handleOpenBulkUploadModal = useCallback(() => {
    setBulkUploadModalVisible(true);
  }, []);

  const handleBulkUploadSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

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
        case ExpenseStatus.DRAFT:
          return '#94A3B8';
        case ExpenseStatus.ACTIVE:
          return '#F59E0B';
        case ExpenseStatus.PAID:
          return '#10B981';
        case ExpenseStatus.CANCELLED:
          return '#EF4444';
        case ExpenseStatus.OVERDUE:
          return '#DC2626';
        default:
          return '#6B7280';
      }
    };

    return [
      { value: 'ALL', label: 'Todos', color: '#6366F1' },
      { value: ExpenseStatus.DRAFT, label: ExpenseStatusLabels[ExpenseStatus.DRAFT], color: getStatusColor(ExpenseStatus.DRAFT) },
      { value: ExpenseStatus.ACTIVE, label: ExpenseStatusLabels[ExpenseStatus.ACTIVE], color: getStatusColor(ExpenseStatus.ACTIVE) },
      { value: ExpenseStatus.PAID, label: ExpenseStatusLabels[ExpenseStatus.PAID], color: getStatusColor(ExpenseStatus.PAID) },
      { value: ExpenseStatus.OVERDUE, label: ExpenseStatusLabels[ExpenseStatus.OVERDUE], color: getStatusColor(ExpenseStatus.OVERDUE) },
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
          {expenses.map((expense: Expense) => (
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
        {/* ✅ Solo mostrar paginación si NO hay búsqueda activa */}
        {!isUsingSearch && pagination.total > 0 && (
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

        {/* ✅ Barra de búsqueda V2 */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por factura, descripción, proveedor..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
          />
          {isSearchingV2 && (
            <ActivityIndicator size="small" color="#6366F1" style={styles.searchLoader} />
          )}
          {searchQuery.length > 0 && !isSearchingV2 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* ✅ Indicador de búsqueda V2 optimizada */}
        {isUsingSearch && searchResultsV2 && (
          <View style={styles.searchInfoBanner}>
            <Text style={styles.searchInfoText}>
              {searchResultsV2.cached ? '⚡ Búsqueda desde caché' : '🔍 Búsqueda optimizada'}
              {' • '}
              {searchResultsV2.total} resultados
              {searchResultsV2.searchTime && ` • ${searchResultsV2.searchTime}ms`}
            </Text>
          </View>
        )}

        {/* ✅ Indicador de listado V2 con caché */}
        {!isUsingSearch && expensesResponseV2 && (
          <View style={styles.searchInfoBanner}>
            <Text style={styles.searchInfoText}>
              {expensesResponseV2.cached ? '⚡ Datos desde caché' : '📊 Listado optimizado'}
              {expensesResponseV2.searchTime && ` • ${expensesResponseV2.searchTime}ms`}
            </Text>
          </View>
        )}

        {renderContent()}

        {/* Floating Action Button with animations */}
        <ExpensesFAB
          onCreateExpense={handleCreateExpense}
          onDownloadReport={handleOpenReportModal}
          onBulkUpload={handleOpenBulkUploadModal}
        />
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

      {/* Bulk Upload Modal */}
      <ExpenseBulkUploadModal
        visible={bulkUploadModalVisible}
        onClose={() => setBulkUploadModalVisible(false)}
        onSuccess={handleBulkUploadSuccess}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    paddingVertical: 0,
  },
  searchLoader: {
    marginLeft: 8,
  },
  searchInfoBanner: {
    backgroundColor: '#EEF2FF',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  searchInfoText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
    textAlign: 'center',
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
});

export default ExpensesScreen;
