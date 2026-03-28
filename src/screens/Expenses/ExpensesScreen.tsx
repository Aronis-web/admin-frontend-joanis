/**
 * ExpensesScreen - Rediseñado con Design System
 *
 * Pantalla de listado de gastos profesional y moderna.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Expense, ExpenseStatus, ExpenseStatusLabels } from '@/types/expenses';
import { useExpenses, useDeleteExpense, useSearchExpensesV2, useExpensesV2 } from '@/hooks/api';
import { useAuthStore } from '@/store/auth';
import { MAIN_ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/usePermissions';
import { useScreenTracking } from '@/hooks/useScreenTracking';

// Legacy Components (to be migrated)
import { ExpenseCard } from '@/components/Expenses/ExpenseCard';
import { ReconcileAmountModal } from '@/components/Expenses/ReconcileAmountModal';
import { PaymentsModal } from '@/components/Expenses/PaymentsModal';
import { ExpenseReportModal } from '@/components/Expenses/ExpenseReportModal';
import { ExpenseBulkUploadModal } from '@/components/Expenses/ExpenseBulkUploadModal';

// Design System
import {
  colors,
  spacing,
  borderRadius,
} from '@/design-system/tokens';
import {
  Text,
  Title,
  Button,
  Chip,
  ChipGroup,
  ScreenHeader,
  ScreenContainer,
  SearchBar,
  EmptyState,
  FABGroup,
  Pagination,
  Row,
} from '@/design-system/components';

interface ExpensesScreenProps {
  navigation: any;
}

export const ExpensesScreen: React.FC<ExpensesScreenProps> = ({ navigation }) => {
  useScreenTracking('ExpensesScreen', 'ExpensesScreen');

  const [selectedStatus, setSelectedStatus] = useState<ExpenseStatus | 'ALL'>('ALL');
  const [reconcileModalVisible, setReconcileModalVisible] = useState(false);
  const [paymentsModalVisible, setPaymentsModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [bulkUploadModalVisible, setBulkUploadModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const { currentSite } = useAuthStore();
  const { hasPermission } = usePermissions();
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isUsingSearch = debouncedSearchQuery.length >= 2;

  // React Query
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

  const {
    data: searchResultsV2,
    isLoading: isSearchingV2,
    refetch: refetchSearchV2,
  } = useSearchExpensesV2(debouncedSearchQuery, {
    status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
    limit: 50,
    enabled: isUsingSearch,
  });

  const isLoading = isUsingSearch ? isSearchingV2 : isLoadingList;

  // Permissions
  const canUpdate = hasPermission('expenses.payments.update') || hasPermission('expenses.admin');
  const canDelete = hasPermission('expenses.payments.delete') || hasPermission('expenses.admin');
  const canCreatePayment = hasPermission('expenses.payments.create') || hasPermission('expenses.admin');

  // Process expenses data
  const expenses: Expense[] = useMemo(() => {
    if (isUsingSearch && searchResultsV2) {
      return (searchResultsV2 as any).expenses || (searchResultsV2 as any).results || [];
    }

    const expensesData = (expensesResponseV2 as any)?.expenses || (expensesResponseV2 as any)?.results || (expensesResponseV2 as any)?.data;
    if (!expensesData) return [];

    return expensesData.map((expense: any) => {
      if (expense.siteId && !expense.site && currentSite) {
        return { ...expense, site: currentSite };
      }
      return expense;
    });
  }, [expensesResponseV2, searchResultsV2, isUsingSearch, currentSite]);

  // Pagination
  const pagination = useMemo(() => {
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

  // Reload on focus
  useFocusEffect(
    useCallback(() => {
      if (isUsingSearch) {
        refetchSearchV2();
      } else {
        refetch();
      }
    }, [refetch, refetchSearchV2, isUsingSearch])
  );

  // Handlers
  const handleRefresh = useCallback(() => {
    setPage(1);
    refetch();
  }, [refetch]);

  const handleCreateExpense = useCallback(() => {
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE as never);
  }, [navigation]);

  const handleExpensePress = useCallback((expense: Expense) => {
    navigation.navigate(MAIN_ROUTES.EXPENSE_DETAIL as never, { expenseId: expense.id });
  }, [navigation]);

  const handleEditExpense = useCallback((expense: Expense) => {
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE as never, { expenseId: expense.id });
  }, [navigation]);

  const handleDeleteExpense = useCallback((expense: Expense) => {
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
              Alert.alert('Error', 'No se pudo eliminar el gasto');
            }
          },
        },
      ]
    );
  }, [deleteExpenseMutation]);

  const handleAddPayment = useCallback((expense: Expense) => {
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE_PAYMENT as never, { expenseId: expense.id });
  }, [navigation]);

  const handleReconcileAmount = useCallback((expense: Expense) => {
    setSelectedExpense(expense);
    setReconcileModalVisible(true);
  }, []);

  const handleViewPayments = useCallback((expense: Expense) => {
    setSelectedExpense(expense);
    setPaymentsModalVisible(true);
  }, []);

  // Status filter options
  const statusOptions = useMemo(() => [
    { label: 'Todos', value: 'ALL' },
    { label: ExpenseStatusLabels[ExpenseStatus.DRAFT], value: ExpenseStatus.DRAFT },
    { label: ExpenseStatusLabels[ExpenseStatus.ACTIVE], value: ExpenseStatus.ACTIVE },
    { label: ExpenseStatusLabels[ExpenseStatus.PAID], value: ExpenseStatus.PAID },
    { label: ExpenseStatusLabels[ExpenseStatus.OVERDUE], value: ExpenseStatus.OVERDUE },
    { label: ExpenseStatusLabels[ExpenseStatus.CANCELLED], value: ExpenseStatus.CANCELLED },
  ], []);

  // FAB actions
  const fabActions = useMemo(() => [
    {
      icon: 'add' as const,
      label: 'Nuevo Gasto',
      onPress: handleCreateExpense,
    },
    {
      icon: 'download-outline' as const,
      label: 'Descargar Reporte',
      onPress: () => setReportModalVisible(true),
    },
    {
      icon: 'cloud-upload-outline' as const,
      label: 'Carga Masiva',
      onPress: () => setBulkUploadModalVisible(true),
    },
  ], [handleCreateExpense]);

  // Render content
  const renderContent = () => {
    if (isLoading && !isRefetching) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary[900]} />
          <Text variant="bodyMedium" color="secondary" style={styles.loadingText}>
            Cargando gastos...
          </Text>
        </View>
      );
    }

    if (expenses.length === 0) {
      return (
        <EmptyState
          icon="receipt-outline"
          title="No hay gastos registrados"
          description="Presiona el botón + para crear un nuevo gasto"
          actionLabel="Crear Gasto"
          onAction={handleCreateExpense}
        />
      );
    }

    return (
      <FlatList
        data={expenses}
        renderItem={({ item }) => (
          <ExpenseCard
            expense={item}
            onPress={handleExpensePress}
            onEdit={canUpdate ? handleEditExpense : undefined}
            onDelete={canDelete ? handleDeleteExpense : undefined}
            onAddPayment={canCreatePayment ? handleAddPayment : undefined}
            onReconcileAmount={canUpdate ? handleReconcileAmount : undefined}
            onViewPayments={handleViewPayments}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary[900]}
            colors={[colors.primary[900]]}
          />
        }
        windowSize={5}
        maxToRenderPerBatch={10}
        initialNumToRender={10}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 200,
          offset: 200 * index,
          index,
        })}
        ListFooterComponent={<View style={styles.listFooter} />}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenHeader
        title="Gastos"
        onMenu={() => navigation.openDrawer?.()}
        actions={[
          {
            icon: 'filter-outline',
            onPress: () => navigation.navigate('ExpenseCategories'),
          },
        ]}
      />

      {/* Filters */}
      <View style={styles.filtersContainer}>
        {/* Search */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar por factura, descripción..."
          loading={isSearchingV2}
          onClear={() => setSearchQuery('')}
          style={styles.searchBar}
        />

        {/* Status Filter */}
        <View style={styles.chipContainer}>
          <ChipGroup
            options={statusOptions}
            selected={[selectedStatus]}
            onChange={(selected) => setSelectedStatus((selected[0] || 'ALL') as ExpenseStatus | 'ALL')}
            size="small"
          />
        </View>

        {/* Search Info */}
        {isUsingSearch && searchResultsV2 && (
          <View style={styles.searchInfo}>
            <Text variant="caption" color="secondary">
              {searchResultsV2.total} resultados encontrados
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Pagination */}
      {!isUsingSearch && pagination.total > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={setPage}
          loading={isLoading}
        />
      )}

      {/* FAB */}
      <FABGroup
        icon="add"
        openIcon="close"
        actions={fabActions}
        variant="primary"
      />

      {/* Modals */}
      {selectedExpense && (
        <ReconcileAmountModal
          visible={reconcileModalVisible}
          onClose={() => {
            setReconcileModalVisible(false);
            setSelectedExpense(null);
          }}
          expenseId={selectedExpense.id}
          expenseName={selectedExpense.name}
          estimatedAmount={
            (selectedExpense.estimatedAmountCents || selectedExpense.amountCents || 0) / 100
          }
          onSuccess={refetch}
        />
      )}

      <PaymentsModal
        visible={paymentsModalVisible}
        expenseId={selectedExpense?.id || null}
        expenseCode={selectedExpense?.code}
        onClose={() => {
          setPaymentsModalVisible(false);
          setSelectedExpense(null);
        }}
      />

      <ExpenseReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        isRecurrent={false}
      />

      <ExpenseBulkUploadModal
        visible={bulkUploadModalVisible}
        onClose={() => setBulkUploadModalVisible(false)}
        onSuccess={refetch}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },

  filtersContainer: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  searchBar: {
    marginBottom: spacing[3],
  },

  chipContainer: {
    marginBottom: spacing[2],
  },

  searchInfo: {
    paddingVertical: spacing[1],
  },

  content: {
    flex: 1,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },

  loadingText: {
    marginTop: spacing[4],
  },

  listContent: {
    padding: spacing[4],
  },

  listFooter: {
    height: spacing[20],
  },
});

export default ExpensesScreen;
