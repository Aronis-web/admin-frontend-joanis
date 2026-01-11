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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { expensesService } from '@/services/api';
import { Expense, ExpenseTemplate } from '@/types/expenses';
import { ExpenseCard } from '@/components/Expenses/ExpenseCard';
import { ReconcileAmountModal } from '@/components/Expenses/ReconcileAmountModal';
import { MAIN_ROUTES } from '@/constants/routes';

interface TemplateExpensesScreenProps {
  route: {
    params: {
      templateId: string;
      templateName: string;
    };
  };
  navigation: any;
}

export const TemplateExpensesScreen: React.FC<TemplateExpensesScreenProps> = ({
  route,
  navigation,
}) => {
  const { templateId, templateName } = route.params;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reconcileModalVisible, setReconcileModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const loadExpenses = useCallback(async () => {
    try {
      const response = await expensesService.getExpenses({ templateId });
      setExpenses(response.data);
    } catch (error: any) {
      console.error('Error loading template expenses:', error);
      Alert.alert('Error', 'No se pudieron cargar los gastos de la plantilla');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [templateId]);

  useFocusEffect(
    useCallback(() => {
      console.log('📱 TemplateExpensesScreen focused - reloading expenses...');
      setLoading(true);
      loadExpenses();
    }, [loadExpenses])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadExpenses();
  };

  const handleExpensePress = (expense: Expense) => {
    navigation.navigate(MAIN_ROUTES.EXPENSE_DETAIL, { expenseId: expense.id });
  };

  const handleEditExpense = (expense: Expense) => {
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE, { expenseId: expense.id });
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
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE_PAYMENT, { expenseId: expense.id });
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Gastos Generados</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Cargando gastos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>Gastos Generados</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{templateName}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {expenses.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="receipt-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>No hay gastos generados</Text>
          <Text style={styles.emptySubtext}>
            Esta plantilla aún no ha generado gastos automáticamente
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total de Gastos:</Text>
              <Text style={styles.summaryValue}>{expenses.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Monto Total:</Text>
              <Text style={styles.summaryValue}>
                {expenses[0]?.currency || 'PEN'}{' '}
                {(
                  expenses.reduce(
                    (sum, exp) => sum + (exp.actualAmountCents || exp.amountCents || 0),
                    0
                  ) / 100
                ).toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Pagado:</Text>
              <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                {expenses[0]?.currency || 'PEN'}{' '}
                {(
                  expenses.reduce((sum, exp) => sum + (exp.totalPaidCents || 0), 0) / 100
                ).toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Pendiente:</Text>
              <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                {expenses[0]?.currency || 'PEN'}{' '}
                {(
                  expenses.reduce((sum, exp) => sum + (exp.remainingAmountCents || 0), 0) / 100
                ).toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Expenses List */}
          {expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onPress={handleExpensePress}
              onEdit={handleEditExpense}
              onDelete={handleDeleteExpense}
              onAddPayment={handleAddPayment}
              onReconcileAmount={handleReconcileAmount}
            />
          ))}
        </ScrollView>
      )}

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
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F8FAFC',
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
});

export default TemplateExpensesScreen;
