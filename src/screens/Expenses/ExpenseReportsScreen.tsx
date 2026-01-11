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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { expensesService } from '@/services/api';
import {
  ReportType,
  GeneralExpenseReport,
  ExpenseProjectionsReport,
  CashFlowReport,
  ReportByCategory,
  ReportByProject,
  ReportBySite,
  ReportBySupplier,
  ReportByType,
  ReportByMonth,
  ReportByYear,
  ProjectionPeriod,
} from '@/types/expenses';
import { useAuthStore } from '@/store/auth';

interface ExpenseReportsScreenProps {
  navigation: any;
}

type ReportTab = 'summary' | 'byCategory' | 'byProject' | 'bySite' | 'bySupplier' | 'byType' | 'byMonth' | 'byYear' | 'projections' | 'cashFlow';

export const ExpenseReportsScreen: React.FC<ExpenseReportsScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');
  const [reportData, setReportData] = useState<GeneralExpenseReport | null>(null);
  const [projectionData, setProjectionData] = useState<ExpenseProjectionsReport | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowReport | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { width, height } = useWindowDimensions();
  const { currentCompany, currentSite } = useAuthStore();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  const loadReport = useCallback(async (tab: ReportTab) => {
    try {
      setLoading(true);
      const params: any = {};
      if (currentCompany?.id) params.companyId = currentCompany.id;
      if (currentSite?.id) params.siteId = currentSite.id;

      switch (tab) {
        case 'summary':
          const summaryData = await expensesService.getSummaryReport(params);
          setReportData(summaryData);
          break;
        case 'byCategory':
          const categoryData = await expensesService.getByCategoryReport(params);
          setReportData(categoryData);
          break;
        case 'byProject':
          const projectData = await expensesService.getByProjectReport(params);
          setReportData(projectData);
          break;
        case 'bySite':
          const siteData = await expensesService.getBySiteReport(params);
          setReportData(siteData);
          break;
        case 'bySupplier':
          const supplierData = await expensesService.getBySupplierReport(params);
          setReportData(supplierData);
          break;
        case 'byType':
          const typeData = await expensesService.getByTypeReport(params);
          setReportData(typeData);
          break;
        case 'byMonth':
          const monthData = await expensesService.getByMonthReport(params);
          setReportData(monthData);
          break;
        case 'byYear':
          const yearData = await expensesService.getByYearReport(params);
          setReportData(yearData);
          break;
        case 'projections':
          const projData = await expensesService.getProjections({ ...params, monthsToProject: 12 });
          setProjectionData(projData);
          break;
        case 'cashFlow':
          const today = new Date();
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          const cfData = await expensesService.getCashFlowReport({
            startDate: startOfMonth.toISOString().split('T')[0],
            endDate: endOfMonth.toISOString().split('T')[0],
            ...params,
          });
          setCashFlowData(cfData);
          break;
      }
    } catch (error: any) {
      console.error('Error loading report:', error);
      Alert.alert('Error', error.message || 'Error al cargar el reporte');
    } finally {
      setLoading(false);
    }
  }, [currentCompany, currentSite]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReport(activeTab);
    setRefreshing(false);
  }, [activeTab, loadReport]);

  useFocusEffect(
    useCallback(() => {
      loadReport(activeTab);
    }, [activeTab, loadReport])
  );

  const formatCurrency = (amount: number, currency: string = 'PEN') => {
    return `S/ ${(amount / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderSummaryCard = (title: string, amount: number, color: string, subtitle?: string) => (
    <View style={[styles.summaryCard, { borderLeftColor: color }]}>
      <Text style={styles.summaryCardTitle}>{title}</Text>
      <Text style={[styles.summaryCardAmount, { color }]}>{formatCurrency(amount)}</Text>
      {subtitle && <Text style={styles.summaryCardSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderSummary = () => {
    if (!reportData?.summary) return null;

    const { summary } = reportData;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumen General</Text>
        <View style={styles.summaryGrid}>
          {renderSummaryCard('Total Gastos', summary.totalAmount, '#4F46E5', `${summary.totalExpenses} gastos`)}
          {renderSummaryCard('Pagado', summary.paidAmount, '#10B981', `${summary.paidCount} pagados`)}
          {renderSummaryCard('Pendiente', summary.pendingAmount, '#F59E0B', `${summary.pendingCount} pendientes`)}
          {renderSummaryCard('Vencido', summary.overdueAmount, '#EF4444', `${summary.overdueCount} vencidos`)}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Promedio</Text>
            <Text style={styles.statValue}>{formatCurrency(summary.averageAmount)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Mínimo</Text>
            <Text style={styles.statValue}>{formatCurrency(summary.minAmount)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Máximo</Text>
            <Text style={styles.statValue}>{formatCurrency(summary.maxAmount)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderByCategory = () => {
    if (!reportData?.byCategory) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gastos por Categoría</Text>
        {reportData.byCategory.map((item: ReportByCategory, index: number) => (
          <TouchableOpacity
            key={index}
            style={styles.listItem}
            onPress={() => {
              setSelectedDetail(item);
              setShowDetailModal(true);
            }}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{item.categoryName}</Text>
              <Text style={styles.listItemSubtitle}>{item.totalExpenses} gastos</Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemAmount}>{formatCurrency(item.totalAmount)}</Text>
              <Text style={styles.listItemPercentage}>{item.percentage.toFixed(1)}%</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderByProject = () => {
    if (!reportData?.byProject) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gastos por Proyecto</Text>
        {reportData.byProject.map((item: ReportByProject, index: number) => (
          <TouchableOpacity
            key={index}
            style={styles.listItem}
            onPress={() => {
              setSelectedDetail(item);
              setShowDetailModal(true);
            }}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{item.projectName}</Text>
              <Text style={styles.listItemSubtitle}>{item.totalExpenses} gastos</Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemAmount}>{formatCurrency(item.totalAmount)}</Text>
              <Text style={styles.listItemPercentage}>{item.percentage.toFixed(1)}%</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderBySite = () => {
    if (!reportData?.bySite) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gastos por Sitio</Text>
        {reportData.bySite.map((item: ReportBySite, index: number) => (
          <TouchableOpacity
            key={index}
            style={styles.listItem}
            onPress={() => {
              setSelectedDetail(item);
              setShowDetailModal(true);
            }}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{item.siteName}</Text>
              <Text style={styles.listItemSubtitle}>{item.totalExpenses} gastos</Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemAmount}>{formatCurrency(item.totalAmount)}</Text>
              <Text style={styles.listItemPercentage}>{item.percentage.toFixed(1)}%</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderBySupplier = () => {
    if (!reportData?.bySupplier) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gastos por Proveedor</Text>
        {reportData.bySupplier.map((item: ReportBySupplier, index: number) => (
          <TouchableOpacity
            key={index}
            style={styles.listItem}
            onPress={() => {
              setSelectedDetail(item);
              setShowDetailModal(true);
            }}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{item.supplierName}</Text>
              <Text style={styles.listItemSubtitle}>{item.totalExpenses} gastos</Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemAmount}>{formatCurrency(item.totalAmount)}</Text>
              <Text style={styles.listItemPercentage}>{item.percentage.toFixed(1)}%</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderByType = () => {
    if (!reportData?.byType) return null;

    const typeLabels: Record<string, string> = {
      RECURRENT: 'Recurrente',
      SEMI_RECURRENT: 'Semi-recurrente',
      UNIQUE: 'Único',
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gastos por Tipo</Text>
        {reportData.byType.map((item: ReportByType, index: number) => (
          <TouchableOpacity
            key={index}
            style={styles.listItem}
            onPress={() => {
              setSelectedDetail(item);
              setShowDetailModal(true);
            }}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{typeLabels[item.expenseType] || item.expenseType}</Text>
              <Text style={styles.listItemSubtitle}>{item.totalExpenses} gastos</Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemAmount}>{formatCurrency(item.totalAmount)}</Text>
              <Text style={styles.listItemPercentage}>{item.percentage.toFixed(1)}%</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderByMonth = () => {
    if (!reportData?.byMonth) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gastos por Mes</Text>
        {reportData.byMonth.map((item: ReportByMonth, index: number) => (
          <TouchableOpacity
            key={index}
            style={styles.listItem}
            onPress={() => {
              setSelectedDetail(item);
              setShowDetailModal(true);
            }}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{item.monthName} {item.year}</Text>
              <Text style={styles.listItemSubtitle}>{item.totalExpenses} gastos</Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemAmount}>{formatCurrency(item.totalAmount)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderByYear = () => {
    if (!reportData?.byYear) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gastos por Año</Text>
        {reportData.byYear.map((item: ReportByYear, index: number) => (
          <TouchableOpacity
            key={index}
            style={styles.listItem}
            onPress={() => {
              setSelectedDetail(item);
              setShowDetailModal(true);
            }}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{item.year}</Text>
              <Text style={styles.listItemSubtitle}>{item.totalExpenses} gastos</Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemAmount}>{formatCurrency(item.totalAmount)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderProjections = () => {
    if (!projectionData) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Proyecciones de Gastos</Text>
        <View style={styles.projectionSummary}>
          <View style={styles.projectionStat}>
            <Text style={styles.projectionStatLabel}>Total Proyectado</Text>
            <Text style={styles.projectionStatValue}>{formatCurrency(projectionData.totalProjected)}</Text>
          </View>
          <View style={styles.projectionStat}>
            <Text style={styles.projectionStatLabel}>Promedio Mensual</Text>
            <Text style={styles.projectionStatValue}>{formatCurrency(projectionData.monthlyAverage)}</Text>
          </View>
        </View>
        <View style={styles.projectionBreakdown}>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownDot, { backgroundColor: '#4F46E5' }]} />
            <Text style={styles.breakdownLabel}>Recurrentes: {formatCurrency(projectionData.recurrentTotal)}</Text>
          </View>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.breakdownLabel}>Semi-recurrentes: {formatCurrency(projectionData.semiRecurrentTotal)}</Text>
          </View>
        </View>
        <Text style={styles.subsectionTitle}>Por Mes</Text>
        {projectionData.months.map((month: any, index: number) => (
          <View key={index} style={styles.monthCard}>
            <View style={styles.monthHeader}>
              <Text style={styles.monthTitle}>{month.monthName} {month.year}</Text>
              <Text style={styles.monthTotal}>{formatCurrency(month.totalProjected)}</Text>
            </View>
            <View style={styles.monthDetails}>
              <Text style={styles.monthDetail}>Recurrentes: {formatCurrency(month.recurrentExpenses)}</Text>
              <Text style={styles.monthDetail}>Semi-recurrentes: {formatCurrency(month.semiRecurrentExpenses)}</Text>
              <Text style={styles.monthDetail}>Pagado: {formatCurrency(month.paidAmount)}</Text>
              <Text style={styles.monthDetail}>Pendiente: {formatCurrency(month.pendingAmount)}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderCashFlow = () => {
    if (!cashFlowData) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Flujo de Caja</Text>
        <View style={styles.cashFlowSummary}>
          <View style={styles.cashFlowStat}>
            <Text style={styles.cashFlowStatLabel}>Proyectado</Text>
            <Text style={[styles.cashFlowStatValue, { color: '#4F46E5' }]}>
              {formatCurrency(cashFlowData.totalProjectedOutflow)}
            </Text>
          </View>
          <View style={styles.cashFlowStat}>
            <Text style={styles.cashFlowStatLabel}>Actual</Text>
            <Text style={[styles.cashFlowStatValue, { color: '#10B981' }]}>
              {formatCurrency(cashFlowData.totalActualOutflow)}
            </Text>
          </View>
          <View style={styles.cashFlowStat}>
            <Text style={styles.cashFlowStatLabel}>Diferencia</Text>
            <Text style={[
              styles.cashFlowStatValue,
              { color: cashFlowData.totalDifference >= 0 ? '#10B981' : '#EF4444' }
            ]}>
              {formatCurrency(Math.abs(cashFlowData.totalDifference))}
            </Text>
          </View>
        </View>
        <Text style={styles.subsectionTitle}>Por Día</Text>
        {cashFlowData.dailyProjections.map((day: any, index: number) => (
          <View key={index} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayDate}>{new Date(day.date).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</Text>
              <Text style={styles.dayTotal}>{formatCurrency(day.projectedOutflow)}</Text>
            </View>
            <View style={styles.dayDetails}>
              <Text style={styles.dayDetail}>Proyectado: {formatCurrency(day.projectedOutflow)}</Text>
              <Text style={styles.dayDetail}>Actual: {formatCurrency(day.actualOutflow)}</Text>
              <Text style={[
                styles.dayDetail,
                { color: day.difference >= 0 ? '#10B981' : '#EF4444' }
              ]}>
                Diferencia: {formatCurrency(Math.abs(day.difference))}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderTabButton = (tab: ReportTab, label: string, icon: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
        {icon} {label}
      </Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Cargando reporte...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'summary':
        return renderSummary();
      case 'byCategory':
        return renderByCategory();
      case 'byProject':
        return renderByProject();
      case 'bySite':
        return renderBySite();
      case 'bySupplier':
        return renderBySupplier();
      case 'byType':
        return renderByType();
      case 'byMonth':
        return renderByMonth();
      case 'byYear':
        return renderByYear();
      case 'projections':
        return renderProjections();
      case 'cashFlow':
        return renderCashFlow();
      default:
        return null;
    }
  };

  const renderDetailModal = () => {
    if (!selectedDetail) return null;

    return (
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {Object.entries(selectedDetail).map(([key, value]) => {
                if (key === 'categoryId' || key === 'projectId' || key === 'siteId' || key === 'supplierId' || key === 'expenseType') {
                  return null;
                }
                return (
                  <View key={key} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{key}:</Text>
                    <Text style={styles.detailValue}>
                      {typeof value === 'number' && key.toLowerCase().includes('amount') ? formatCurrency(value) : String(value)}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <ProtectedRoute requiredPermissions={['expenses.read']}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Reportes de Gastos</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContent}
          >
            {renderTabButton('summary', 'Resumen', '📊')}
            {renderTabButton('byCategory', 'Categoría', '📁')}
            {renderTabButton('byProject', 'Proyecto', '🏗️')}
            {renderTabButton('bySite', 'Sitio', '📍')}
            {renderTabButton('bySupplier', 'Proveedor', '🏢')}
            {renderTabButton('byType', 'Tipo', '🏷️')}
            {renderTabButton('byMonth', 'Mes', '📅')}
            {renderTabButton('byYear', 'Año', '📆')}
            {renderTabButton('projections', 'Proyecciones', '📈')}
            {renderTabButton('cashFlow', 'Flujo', '💰')}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderContent()}
        </ScrollView>

        {renderDetailModal()}
      </SafeAreaView>
    </ProtectedRoute>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#4F46E5',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  summaryCardAmount: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryCardSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  listItemRight: {
    alignItems: 'flex-end',
  },
  listItemAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  listItemPercentage: {
    fontSize: 12,
    color: '#6B7280',
  },
  projectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  projectionStat: {
    alignItems: 'center',
  },
  projectionStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  projectionStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  projectionBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  monthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  monthTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
  },
  monthDetails: {
    gap: 4,
  },
  monthDetail: {
    fontSize: 14,
    color: '#6B7280',
  },
  cashFlowSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cashFlowStat: {
    alignItems: 'center',
  },
  cashFlowStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  cashFlowStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  dayTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
  },
  dayDetails: {
    gap: 4,
  },
  dayDetail: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
  },
});

export default ExpenseReportsScreen;
