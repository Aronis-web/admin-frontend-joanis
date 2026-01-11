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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { expensesService } from '@/services/api';
import {
  ExpenseProject,
  ProjectStatus,
  ProjectStatusLabels,
  Expense,
  ExpensePayment,
  PaymentStatus,
  PaymentStatusLabels,
} from '@/types/expenses';
import { MAIN_ROUTES } from '@/constants/routes';
import { ReconcileAmountModal } from '@/components/Expenses/ReconcileAmountModal';

interface ExpenseProjectDetailScreenProps {
  route: {
    params: {
      projectId: string;
    };
  };
  navigation: any;
}

export const ExpenseProjectDetailScreen: React.FC<ExpenseProjectDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { projectId } = route.params;
  const [project, setProject] = useState<ExpenseProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [expensePayments, setExpensePayments] = useState<ExpensePayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [reconcileModalVisible, setReconcileModalVisible] = useState(false);

  const loadProject = useCallback(async () => {
    try {
      const project = await expensesService.getProject(projectId);
      setProject(project);
    } catch (error: any) {
      console.error('Error loading project:', error);
      Alert.alert('Error', 'No se pudo cargar el proyecto');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      console.log('📱 ExpenseProjectDetailScreen focused - reloading project...');
      setLoading(true);
      loadProject();
    }, [loadProject])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadProject();
  };

  const handleUpdateStatus = async (newStatus: ProjectStatus) => {
    if (!project) return;

    console.log('🔄 handleUpdateStatus called:', {
      projectId,
      currentStatus: project.status,
      newStatus,
      newStatusType: typeof newStatus,
      newStatusValue: newStatus
    });

    Alert.alert(
      'Cambiar Estado',
      `¿Estás seguro de cambiar el estado a "${ProjectStatusLabels[newStatus]}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              console.log('📤 Calling updateProject with:', {
                projectId,
                status: newStatus,
                statusType: typeof newStatus
              });

              const result = await expensesService.updateProject(projectId, { status: newStatus });

              console.log('✅ updateProject succeeded:', result);

              await loadProject();
              Alert.alert('Éxito', 'Estado actualizado correctamente');
            } catch (error: any) {
              console.error('❌ Error updating status:', error);
              console.error('❌ Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
              });
              Alert.alert('Error', 'No se pudo actualizar el estado');
            }
          },
        },
      ]
    );
  };

  const handleDeleteProject = () => {
    Alert.alert(
      'Cancelar Proyecto',
      '¿Estás seguro de cancelar este proyecto? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cancelar Proyecto',
          style: 'destructive',
          onPress: async () => {
            try {
              // Update project status to CANCELLED
              await expensesService.updateProject(projectId, { status: ProjectStatus.CANCELLED });
              Alert.alert('Éxito', 'Proyecto cancelado correctamente', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error: any) {
              console.error('Error cancelling project:', error);
              Alert.alert('Error', 'No se pudo cancelar el proyecto');
            }
          },
        },
      ]
    );
  };

  const handleAddExpense = () => {
    navigation.navigate(MAIN_ROUTES.CREATE_EXPENSE, { projectId });
  };

  const handleViewExpenses = () => {
    setShowExpensesModal(true);
  };

  const handleViewPayments = async (expense: Expense) => {
    setSelectedExpense(expense);
    setLoadingPayments(true);
    setShowPaymentsModal(true);
    try {
      // TODO: Implement getPayments method in expensesService
      // const payments = await expensesService.getPayments(expense.id);
      // setExpensePayments(payments);
      setExpensePayments([]);
      Alert.alert('Información', 'La funcionalidad de ver pagos estará disponible próximamente');
    } catch (error) {
      console.error('Error loading payments:', error);
      Alert.alert('Error', 'No se pudieron cargar los pagos');
    } finally {
      setLoadingPayments(false);
    }
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
    loadProject();
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
              loadProject();
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', 'No se pudo eliminar el gasto');
            }
          },
        },
      ]
    );
  };

  // Render expense status badge
  const renderExpenseStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
      DRAFT: { label: 'Borrador', color: '#64748B', bgColor: '#F1F5F9' },
      ACTIVE: { label: 'Activo', color: '#10B981', bgColor: '#D1FAE5' },
      PAID: { label: 'Pagado', color: '#059669', bgColor: '#A7F3D0' },
      CANCELLED: { label: 'Cancelado', color: '#DC2626', bgColor: '#FEE2E2' },
      OVERDUE: { label: 'Vencido', color: '#F59E0B', bgColor: '#FEF3C7' },
    };

    const config = statusConfig[status] || statusConfig.ACTIVE;

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bgColor }]}>
        <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  };

  // Render payment status badge
  const renderPaymentStatusBadge = (paymentStatus: string) => {
    const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
      UNPAID: { label: 'Sin Pagar', color: '#DC2626', bgColor: '#FEE2E2' },
      PARTIAL: { label: 'Parcial', color: '#F59E0B', bgColor: '#FEF3C7' },
      PAID: { label: 'Pagado', color: '#10B981', bgColor: '#D1FAE5' },
    };

    const config = statusConfig[paymentStatus] || statusConfig.UNPAID;

    return (
      <View style={[styles.paymentBadge, { backgroundColor: config.bgColor }]}>
        <Text style={[styles.paymentBadgeText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  };

  const handleViewHistory = () => {
    Alert.alert(
      'Historial del Proyecto',
      `Creado: ${project ? formatDate(project.createdAt) : 'N/A'}\n` +
      `Actualizado: ${project ? formatDate(project.updatedAt) : 'N/A'}\n` +
      `${project?.closedAt ? `Cerrado: ${formatDate(project.closedAt)}\n` : ''}` +
      `\nCreado por: ${project?.createdByUser?.name || project?.createdByUser?.email || 'N/A'}\n` +
      `${project?.closedByUser ? `Cerrado por: ${project.closedByUser.name || project.closedByUser.email}\n` : ''}` +
      `\nEstado actual: ${project ? ProjectStatusLabels[project.status] : 'N/A'}\n` +
      `Presupuesto: S/ ${project ? (project.budgetCents / 100).toFixed(2) : '0.00'}\n` +
      `Gastado: S/ ${project ? (project.spentCents / 100).toFixed(2) : '0.00'}\n` +
      `Gastos asociados: ${project?.expenses?.length || 0}`
    );
  };

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.PLANNING:
        return '#F59E0B';
      case ProjectStatus.ACTIVE:
        return '#10B981';
      case ProjectStatus.ON_HOLD:
        return '#6366F1';
      case ProjectStatus.COMPLETED:
        return '#059669';
      case ProjectStatus.CANCELLED:
        return '#EF4444';
      default:
        return '#64748B';
    }
  };

  const getBudgetProgress = () => {
    if (!project) return 0;
    const percentage = (project.spentCents / project.budgetCents) * 100;
    return Math.min(percentage, 100);
  };

  const getBudgetColor = () => {
    if (!project) return '#10B981';
    const percentage = (project.spentCents / project.budgetCents) * 100;
    if (percentage >= 100) return '#EF4444';
    if (percentage >= 80) return '#F59E0B';
    return '#10B981';
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PENDING:
        return '#F59E0B';
      case PaymentStatus.APPROVED:
        return '#10B981';
      case PaymentStatus.REJECTED:
        return '#EF4444';
      case PaymentStatus.CANCELLED:
        return '#94A3B8';
      default:
        return '#64748B';
    }
  };

  const calculatePaidAmount = (expense: Expense) => {
    if (!expensePayments || expensePayments.length === 0) return 0;
    return expensePayments.reduce((sum, payment) => sum + payment.amountCents, 0);
  };

  const renderStatusActions = () => {
    if (!project) return null;

    const availableStatuses: ProjectStatus[] = [
      ProjectStatus.PLANNING,
      ProjectStatus.ACTIVE,
      ProjectStatus.ON_HOLD,
      ProjectStatus.COMPLETED,
      ProjectStatus.CANCELLED,
    ];

    return (
      <View style={styles.statusActions}>
        <Text style={styles.statusActionsTitle}>Cambiar Estado:</Text>
        <View style={styles.statusButtons}>
          {availableStatuses.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusButton,
                project.status === status && styles.statusButtonActive,
              ]}
              onPress={() => handleUpdateStatus(status)}
              disabled={project.status === status}
            >
              <Text
                style={[
                  styles.statusButtonText,
                  project.status === status && styles.statusButtonTextActive,
                ]}
              >
                {ProjectStatusLabels[status]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle del Proyecto</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando proyecto...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle del Proyecto</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>No se encontró el proyecto</Text>
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
        <Text style={styles.headerTitle}>Detalle del Proyecto</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleViewHistory} style={styles.headerActionButton}>
            <Ionicons name="time-outline" size={24} color="#6366F1" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteProject} style={styles.headerActionButton}>
            <Ionicons name="trash-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Project Header */}
        <View style={styles.card}>
          <View style={styles.projectHeader}>
            <View style={styles.projectInfo}>
              <Text style={styles.projectCode}>{project.code}</Text>
              <Text style={styles.projectName}>{project.name}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(project.status) + '20' },
              ]}
            >
              <Text style={[styles.statusText, { color: getStatusColor(project.status) }]}>
                {ProjectStatusLabels[project.status]}
              </Text>
            </View>
          </View>

          {project.description && (
            <Text style={styles.description}>{project.description}</Text>
          )}
        </View>

        {/* Budget Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Presupuesto</Text>
          <View style={styles.budgetInfo}>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Presupuesto Total:</Text>
              <Text style={styles.budgetValue}>{formatCurrency(project.budgetCents)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Gastado:</Text>
              <Text style={styles.budgetValue}>{formatCurrency(project.spentCents)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Disponible:</Text>
              <Text style={[styles.budgetValue, { color: getBudgetColor() }]}>
                {formatCurrency(project.budgetCents - project.spentCents)}
              </Text>
            </View>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${getBudgetProgress()}%`, backgroundColor: getBudgetColor() },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{getBudgetProgress().toFixed(1)}%</Text>
          </View>
        </View>

        {/* Dates Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fechas</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={20} color="#64748B" />
            <Text style={styles.dateLabel}>Inicio:</Text>
            <Text style={styles.dateValue}>{formatDate(project.startDate)}</Text>
          </View>
          {project.endDate && (
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={20} color="#64748B" />
              <Text style={styles.dateLabel}>Fin:</Text>
              <Text style={styles.dateValue}>{formatDate(project.endDate)}</Text>
            </View>
          )}
        </View>

        {/* Site Information */}
        {project.site && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sede</Text>
            <View style={styles.siteInfo}>
              <Ionicons name="business-outline" size={20} color="#64748B" />
              <Text style={styles.siteName}>{project.site.name}</Text>
            </View>
          </View>
        )}

        {/* Metadata */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Información Adicional</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Creado por:</Text>
            <Text style={styles.metaValue}>
              {project.createdByUser?.name || project.createdByUser?.email || 'N/A'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Fecha de creación:</Text>
            <Text style={styles.metaValue}>{formatDate(project.createdAt)}</Text>
          </View>
          {project.closedAt && (
            <>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Cerrado por:</Text>
                <Text style={styles.metaValue}>
                  {project.closedByUser?.name || project.closedByUser?.email || 'N/A'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Fecha de cierre:</Text>
                <Text style={styles.metaValue}>{formatDate(project.closedAt)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Status Actions */}
        {renderStatusActions()}

        {/* Expenses Section */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Gastos del Proyecto</Text>
            <TouchableOpacity onPress={handleViewExpenses} style={styles.viewAllButton}>
              <Text style={styles.viewAllButtonText}>Ver Todos</Text>
              <Ionicons name="chevron-forward" size={16} color="#6366F1" />
            </TouchableOpacity>
          </View>
          {project.expenses && project.expenses.length > 0 ? (
            <>
              {project.expenses.slice(0, 3).map((expense) => {
                // Use fields from API response
                const displayAmount = expense.actualAmountCents || expense.amountCents || 0;
                const paidAmount = expense.totalPaidCents || 0;
                const remainingAmount = expense.remainingAmountCents || (displayAmount - paidAmount);
                const isPaid = remainingAmount === 0 && paidAmount > 0;
                const paymentProgress = displayAmount > 0 ? (paidAmount / displayAmount) * 100 : 0;

                return (
                  <View key={expense.id} style={styles.expenseItem}>
                    <View style={styles.expenseInfo}>
                      <View style={styles.expenseNameRow}>
                        <Text style={styles.expenseName}>{expense.name}</Text>
                        {renderExpenseStatusBadge(expense.status || 'ACTIVE')}
                      </View>
                      <Text style={styles.expenseCode}>{expense.code}</Text>
                      <View style={styles.expenseStatusRow}>
                        {renderPaymentStatusBadge(expense.paymentStatus || 'UNPAID')}
                      </View>
                      {/* Payment Progress Bar */}
                      {displayAmount > 0 && (
                        <View style={styles.paymentProgressContainer}>
                          <View style={styles.progressBarSmall}>
                            <View style={[styles.progressFillSmall, { width: `${Math.min(paymentProgress, 100)}%` }]} />
                          </View>
                          <View style={styles.paymentAmountsRow}>
                            <Text style={styles.paymentAmountSmall}>
                              Pagado: {expense.currency || 'PEN'} {(paidAmount / 100).toFixed(2)}
                            </Text>
                            {remainingAmount > 0 && (
                              <Text style={styles.expensePending}>
                                Pendiente: {expense.currency || 'PEN'} {(remainingAmount / 100).toFixed(2)}
                              </Text>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                    <View style={styles.expenseAmount}>
                      <Text style={styles.expenseAmountText}>
                        {expense.currency || 'PEN'} {(displayAmount / 100).toFixed(2)}
                      </Text>
                      <View style={styles.expenseActions}>
                        {!expense.actualAmountCents && (
                          <TouchableOpacity
                            onPress={() => handleReconcileAmount(expense)}
                            style={styles.actionButtonSmall}
                          >
                            <Ionicons name="receipt-outline" size={16} color="#6366F1" />
                          </TouchableOpacity>
                        )}
                        {remainingAmount > 0 && (
                          <TouchableOpacity
                            onPress={() => handleAddPayment(expense)}
                            style={styles.actionButtonSmall}
                          >
                            <Ionicons name="cash-outline" size={16} color="#10B981" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => handleViewPayments(expense)}
                          style={styles.actionButtonSmall}
                        >
                          <Ionicons name="card" size={16} color="#6366F1" />
                        </TouchableOpacity>
                        {remainingAmount > 0 && (
                          <TouchableOpacity
                            onPress={() => handleEditExpense(expense)}
                            style={styles.actionButtonSmall}
                          >
                            <Ionicons name="create-outline" size={16} color="#6366F1" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => handleDeleteExpense(expense)}
                          style={styles.actionButtonSmall}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
              {project.expenses.length > 3 && (
                <TouchableOpacity
                  onPress={handleViewExpenses}
                  style={styles.showMoreButton}
                >
                  <Text style={styles.showMoreButtonText}>
                    Ver {project.expenses.length - 3} gastos más
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.emptyExpenses}>
              <Ionicons name="receipt-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyExpensesText}>No hay gastos asociados</Text>
              <Text style={styles.emptyExpensesSubtext}>
                Presiona el botón + para agregar un gasto
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleAddExpense}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Expenses Modal */}
      <Modal
        visible={showExpensesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExpensesModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowExpensesModal(false)} style={styles.modalBackButton}>
              <Ionicons name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Gastos del Proyecto</Text>
            <View style={styles.modalHeaderRight} />
          </View>
          <ScrollView style={styles.modalContent}>
            {project?.expenses && project.expenses.length > 0 ? (
              project.expenses.map((expense) => {
                // Use fields from API response
                const displayAmount = expense.actualAmountCents || expense.amountCents || 0;
                const paidAmount = expense.totalPaidCents || 0;
                const remainingAmount = expense.remainingAmountCents || (displayAmount - paidAmount);
                const isPaid = remainingAmount === 0 && paidAmount > 0;
                const paymentProgress = displayAmount > 0 ? (paidAmount / displayAmount) * 100 : 0;

                return (
                  <View key={expense.id} style={styles.expenseDetailCard}>
                    <View style={styles.expenseDetailHeader}>
                      <View style={styles.expenseDetailInfo}>
                        <Text style={styles.expenseDetailName}>{expense.name}</Text>
                        <Text style={styles.expenseDetailCode}>{expense.code}</Text>
                        <View style={styles.expenseDetailBadges}>
                          {renderExpenseStatusBadge(expense.status || 'ACTIVE')}
                          {renderPaymentStatusBadge(expense.paymentStatus || 'UNPAID')}
                        </View>
                      </View>
                      <View style={styles.expenseDetailAmountContainer}>
                        <Text style={styles.expenseDetailAmount}>
                          {expense.currency || 'PEN'} {(displayAmount / 100).toFixed(2)}
                        </Text>
                        {paidAmount > 0 && (
                          <Text style={styles.expenseDetailPaid}>
                            Pagado: {expense.currency || 'PEN'} {(paidAmount / 100).toFixed(2)}
                          </Text>
                        )}
                        {remainingAmount > 0 && (
                          <Text style={styles.expenseDetailPending}>
                            Pendiente: {expense.currency || 'PEN'} {(remainingAmount / 100).toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </View>
                    {/* Payment Progress Bar */}
                    {displayAmount > 0 && (
                      <View style={styles.expenseDetailProgressContainer}>
                        <View style={styles.progressBarSmall}>
                          <View style={[styles.progressFillSmall, { width: `${Math.min(paymentProgress, 100)}%` }]} />
                        </View>
                        <Text style={styles.progressPercentageText}>{paymentProgress.toFixed(1)}% completado</Text>
                      </View>
                    )}
                    {expense.description && (
                      <Text style={styles.expenseDetailDescription}>{expense.description}</Text>
                    )}
                    <View style={styles.expenseDetailMeta}>
                      <View style={styles.expenseDetailMetaItem}>
                        <Ionicons name="pricetag" size={14} color="#64748B" />
                        <Text style={styles.expenseDetailMetaText}>
                          {expense.category?.name || 'Sin categoría'}
                        </Text>
                      </View>
                      {expense.dueDate && (
                        <View style={styles.expenseDetailMetaItem}>
                          <Ionicons name="calendar" size={14} color="#64748B" />
                          <Text style={styles.expenseDetailMetaText}>
                            {formatDate(expense.dueDate)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.expenseDetailActions}>
                      {!expense.actualAmountCents && (
                        <TouchableOpacity
                          onPress={() => {
                            setShowExpensesModal(false);
                            handleReconcileAmount(expense);
                          }}
                          style={styles.expenseDetailAction}
                        >
                          <Ionicons name="receipt-outline" size={18} color="#6366F1" />
                          <Text style={styles.expenseDetailActionText}>Monto Real</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => handleViewPayments(expense)}
                        style={styles.expenseDetailAction}
                      >
                        <Ionicons name="card" size={18} color="#6366F1" />
                        <Text style={styles.expenseDetailActionText}>Ver Pagos</Text>
                      </TouchableOpacity>
                      {remainingAmount > 0 && (
                        <>
                          <TouchableOpacity
                            onPress={() => {
                              setShowExpensesModal(false);
                              handleAddPayment(expense);
                            }}
                            style={styles.expenseDetailAction}
                          >
                            <Ionicons name="add-circle" size={18} color="#10B981" />
                            <Text style={styles.expenseDetailActionText}>Agregar Pago</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setShowExpensesModal(false);
                              handleEditExpense(expense);
                            }}
                            style={styles.expenseDetailAction}
                          >
                            <Ionicons name="create-outline" size={18} color="#6366F1" />
                            <Text style={styles.expenseDetailActionText}>Editar</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          setShowExpensesModal(false);
                          handleDeleteExpense(expense);
                        }}
                        style={styles.expenseDetailAction}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        <Text style={styles.expenseDetailActionText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.modalEmpty}>
                <Ionicons name="receipt-outline" size={60} color="#CBD5E1" />
                <Text style={styles.modalEmptyText}>No hay gastos asociados</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Payments Modal */}
      <Modal
        visible={showPaymentsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPaymentsModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPaymentsModal(false)} style={styles.modalBackButton}>
              <Ionicons name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Pagos del Gasto</Text>
            <View style={styles.modalHeaderRight} />
          </View>
          <ScrollView style={styles.modalContent}>
            {selectedExpense && (
              <>
                <View style={styles.paymentExpenseInfo}>
                  <Text style={styles.paymentExpenseName}>{selectedExpense.name}</Text>
                  <Text style={styles.paymentExpenseCode}>{selectedExpense.code}</Text>
                  <View style={styles.paymentExpenseAmounts}>
                    <View style={styles.paymentAmountItem}>
                      <Text style={styles.paymentAmountLabel}>Total:</Text>
                      <Text style={styles.paymentAmountValue}>
                        {selectedExpense.currency || 'PEN'} {((selectedExpense.actualAmountCents || selectedExpense.amountCents || 0) / 100).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.paymentAmountItem}>
                      <Text style={styles.paymentAmountLabel}>Pagado:</Text>
                      <Text style={[styles.paymentAmountValue, { color: '#10B981' }]}>
                        {selectedExpense.currency || 'PEN'} {(calculatePaidAmount(selectedExpense) / 100).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.paymentAmountItem}>
                      <Text style={styles.paymentAmountLabel}>Pendiente:</Text>
                      <Text style={[styles.paymentAmountValue, { color: '#F59E0B' }]}>
                        {selectedExpense.currency || 'PEN'} {(((selectedExpense.actualAmountCents || selectedExpense.amountCents || 0) - calculatePaidAmount(selectedExpense)) / 100).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>

                {loadingPayments ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={styles.modalLoadingText}>Cargando pagos...</Text>
                  </View>
                ) : expensePayments.length > 0 ? (
                  expensePayments.map((payment) => (
                    <View key={payment.id} style={styles.paymentCard}>
                      <View style={styles.paymentHeader}>
                        <View style={styles.paymentInfo}>
                          <Text style={styles.paymentCode}>{payment.code}</Text>
                          <Text style={styles.paymentDate}>{formatDate(payment.paymentDate)}</Text>
                        </View>
                        <View
                          style={[
                            styles.paymentBadge,
                            { backgroundColor: getPaymentStatusColor(payment.status) + '20' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.paymentStatusText,
                              { color: getPaymentStatusColor(payment.status) },
                            ]}
                          >
                            {PaymentStatusLabels[payment.status]}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.paymentAmountRow}>
                        <Text style={styles.paymentCardAmountLabel}>Monto:</Text>
                        <Text style={styles.paymentAmount}>
                          S/ {(payment.amountCents / 100).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.paymentMethodRow}>
                        <Ionicons name="card" size={14} color="#64748B" />
                        <Text style={styles.paymentMethodText}>
                          {payment.paymentMethod}
                          {payment.bankName && ` - ${payment.bankName}`}
                        </Text>
                      </View>
                      {payment.transactionReference && (
                        <View style={styles.paymentRefRow}>
                          <Ionicons name="document-text" size={14} color="#64748B" />
                          <Text style={styles.paymentRefText}>{payment.transactionReference}</Text>
                        </View>
                      )}
                      {payment.notes && (
                        <Text style={styles.paymentNotes}>{payment.notes}</Text>
                      )}
                    </View>
                  ))
                ) : (
                  <View style={styles.modalEmpty}>
                    <Ionicons name="card-outline" size={60} color="#CBD5E1" />
                    <Text style={styles.modalEmptyText}>No hay pagos registrados</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setShowPaymentsModal(false);
                    handleAddPayment(selectedExpense!);
                  }}
                  style={styles.addPaymentButton}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.addPaymentButtonText}>Agregar Pago</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

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

// Styles for ExpenseProjectDetailScreen - Updated 2026-01-05
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    padding: 4,
  },
  headerRight: {
    width: 32,
  },
  deleteButton: {
    padding: 4,
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
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  projectInfo: {
    flex: 1,
  },
  projectCode: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  projectName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  budgetInfo: {
    marginBottom: 12,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  budgetValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    minWidth: 45,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  siteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  siteName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  statusActions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusActionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  // Expense Items
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  expenseName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  expenseCode: {
    fontSize: 12,
    color: '#64748B',
  },
  expenseStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  expensePending: {
    fontSize: 11,
    fontWeight: '500',
    color: '#DC2626',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  expenseAmount: {
    alignItems: 'flex-end',
    gap: 8,
  },
  expenseAmountText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  expenseActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  actionButtonSmall: {
    padding: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  paymentProgressContainer: {
    marginTop: 8,
  },
  progressBarSmall: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFillSmall: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  paymentAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentAmountSmall: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '500',
  },
  paymentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
  },
  paymentsButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
  },
  showMoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  showMoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  emptyExpenses: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyExpensesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  emptyExpensesSubtext: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  // Modal Styles
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalBackButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  modalHeaderRight: {
    width: 32,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  modalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalEmptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  // Expense Detail Card
  expenseDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expenseDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  expenseDetailInfo: {
    flex: 1,
  },
  expenseDetailName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  expenseDetailCode: {
    fontSize: 12,
    color: '#64748B',
  },
  expenseDetailBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  expenseDetailAmountContainer: {
    alignItems: 'flex-end',
  },
  expenseDetailAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  expenseDetailPaid: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 2,
  },
  expenseDetailPending: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 2,
  },
  expenseDetailDescription: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 20,
  },
  expenseDetailMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  expenseDetailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expenseDetailMetaText: {
    fontSize: 13,
    color: '#64748B',
  },
  expenseDetailProgressContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  progressPercentageText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 4,
  },
  expenseDetailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  expenseDetailAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expenseDetailActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  // Payment Expense Info
  paymentExpenseInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentExpenseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  paymentExpenseCode: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  paymentExpenseAmounts: {
    gap: 8,
  },
  paymentAmountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentAmountLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  paymentAmountValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  // Payment Card
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 12,
    color: '#64748B',
  },
  paymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  paymentAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentCardAmountLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  paymentMethodText: {
    fontSize: 13,
    color: '#475569',
  },
  paymentRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  paymentRefText: {
    fontSize: 13,
    color: '#475569',
  },
  paymentNotes: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  addPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addPaymentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ExpenseProjectDetailScreen;
