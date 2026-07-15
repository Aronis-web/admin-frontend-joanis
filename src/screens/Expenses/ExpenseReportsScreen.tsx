import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { DatePicker } from '@/components/DatePicker';
import { expensesService } from '@/services/api';
import { formatDateToString, formatDisplayDate } from '@/utils/dateHelpers';
import {
  DashboardResponse,
  TotalExpensesSummaryResponse,
  RecurringExpensesSummaryResponse,
  SummaryByCategoryResponse,
  SummaryBySiteResponse,
  PeriodComparisonResponse,
  TrendsResponse,
  ProjectionsResponse,
  CurrencySummary,
  CategoryCurrencySummary,
  SiteCurrencySummary,
} from '@/types/expenses';
import { useAuthStore } from '@/store/auth';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

interface ExpenseReportsScreenProps {
  navigation: any;
}

type ReportView =
  | 'dashboard'
  | 'total'
  | 'recurring'
  | 'byCategory'
  | 'bySite'
  | 'comparison'
  | 'trends'
  | 'projections';

export const ExpenseReportsScreen: React.FC<ExpenseReportsScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<ReportView>('dashboard');
  const { width, height } = useWindowDimensions();
  const { currentCompany, currentSite } = useAuthStore();

  // Data states
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [totalData, setTotalData] = useState<TotalExpensesSummaryResponse | null>(null);
  const [recurringData, setRecurringData] = useState<RecurringExpensesSummaryResponse | null>(null);
  const [categoryData, setCategoryData] = useState<SummaryByCategoryResponse | null>(null);
  const [siteData, setSiteData] = useState<SummaryBySiteResponse | null>(null);
  const [comparisonData, setComparisonData] = useState<PeriodComparisonResponse | null>(null);
  const [trendsData, setTrendsData] = useState<TrendsResponse | null>(null);
  const [projectionsData, setProjectionsData] = useState<ProjectionsResponse | null>(null);

  // Filter states - Default to current month
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    return formatDateToString(new Date(date.getFullYear(), date.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return formatDateToString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  });
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  // Date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDateObj, setStartDateObj] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [endDateObj, setEndDateObj] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  });

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  // Quick date filter functions
  const setQuickDateFilter = useCallback((filter: 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear') => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (filter) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'thisWeek':
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday as first day
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - diff));
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        return;
    }

    setStartDateObj(start);
    setEndDateObj(end);
    setStartDate(formatDateToString(start));
    setEndDate(formatDateToString(end));
  }, []);

  const loadData = useCallback(
    async (view: ReportView) => {
      try {
        setLoading(true);

        const baseParams = {
          startDate,
          endDate,
          ...(selectedStatus && { status: selectedStatus }),
          ...(selectedCategoryId && { categoryId: selectedCategoryId }),
          ...(selectedSiteId && { siteId: selectedSiteId }),
        };

        switch (view) {
          case 'dashboard':
            const dashboard = await expensesService.getDashboard({ startDate, endDate });
            setDashboardData(dashboard);
            break;

          case 'total':
            const total = await expensesService.getTotalExpensesSummary(baseParams);
            setTotalData(total);
            break;

          case 'recurring':
            const recurring = await expensesService.getRecurringExpensesSummary(baseParams);
            setRecurringData(recurring);
            break;

          case 'byCategory':
            const category = await expensesService.getSummaryByCategoryAndCurrency(baseParams);
            setCategoryData(category);
            break;

          case 'bySite':
            const site = await expensesService.getSummaryBySite(baseParams);
            setSiteData(site);
            break;

          case 'comparison':
            const midYear = new Date(new Date(startDate).getFullYear(), 5, 30);
            const comparison = await expensesService.comparePeriods({
              period1Start: startDate,
              period1End: midYear.toISOString().split('T')[0],
              period2Start: new Date(midYear.getTime() + 86400000).toISOString().split('T')[0],
              period2End: endDate,
            });
            setComparisonData(comparison);
            break;

          case 'trends':
            const trends = await expensesService.getTrends({
              startDate,
              endDate,
              groupBy: 'month',
            });
            setTrendsData(trends);
            break;

          case 'projections':
            const projections = await expensesService.getExpenseProjections({ months: 6 });
            setProjectionsData(projections);
            break;
        }
      } catch (error: any) {
        console.error('Error loading data:', error);
        Alert.alert('Error', error.message || 'Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, selectedStatus, selectedCategoryId, selectedSiteId]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(activeView);
    setRefreshing(false);
  }, [activeView, loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData(activeView);
    }, [activeView, loadData])
  );

  const formatCurrency = (amountCents: number, currency: string = 'PEN') => {
    const symbol = currency === 'PEN' ? 'S/' : currency === 'USD' ? '$' : currency;
    return `${symbol} ${(amountCents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderCurrencyCard = (item: CurrencySummary, title: string, color: string) => (
    <View key={item.currency} style={[styles.currencyCard, { borderLeftColor: color }]}>
      <Text style={styles.currencyCardTitle}>{title}</Text>
      <Text style={[styles.currencyCardAmount, { color }]}>
        {formatCurrency(item.totalAmountCents, item.currency)}
      </Text>
      <Text style={styles.currencyCardSubtitle}>
        {item.expenseCount} gasto{item.expenseCount !== 1 ? 's' : ''} • {item.currency}
      </Text>
    </View>
  );

  const renderDashboard = () => {
    if (!dashboardData) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Dashboard Consolidado</Text>

        {/* Total Expenses */}
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Gastos Totales</Text>
          <View style={styles.cardGrid}>
            {dashboardData.totalExpenses.byCurrency.map((item) =>
              renderCurrencyCard(item, 'Total', theme.color.brand.accent)
            )}
          </View>
          <Text style={styles.infoText}>
            Total: {dashboardData.totalExpenses.totalExpenseCount} gastos
          </Text>
        </View>

        {/* Recurring Expenses */}
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Gastos Recurrentes</Text>
          <View style={styles.cardGrid}>
            {dashboardData.recurringExpenses.byCurrency.map((item) =>
              renderCurrencyCard(item, 'Recurrentes', theme.color.state.success.border)
            )}
          </View>
          <Text style={styles.infoText}>
            Total: {dashboardData.recurringExpenses.totalExpenseCount} gastos recurrentes
          </Text>
        </View>

        {/* By Status */}
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Por Estado</Text>
          {dashboardData.byStatus.map((item, index) => (
            <View key={index} style={styles.listItem}>
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>{item.status}</Text>
                <Text style={styles.listItemSubtitle}>{item.expenseCount} gastos</Text>
              </View>
              <Text style={styles.listItemAmount}>
                {formatCurrency(item.totalAmountCents, item.currency)}
              </Text>
            </View>
          ))}
        </View>

        {/* Top Expenses */}
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Gastos Principales</Text>
          {dashboardData.topExpenses.map((expense) => (
            <View key={expense.id} style={styles.listItem}>
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>{expense.name}</Text>
                <Text style={styles.listItemSubtitle}>
                  {expense.code} • {expense.categoryName}
                </Text>
              </View>
              <View style={styles.listItemRight}>
                <Text style={styles.listItemAmount}>
                  {formatCurrency(expense.amountCents, expense.currency)}
                </Text>
                <Text style={[styles.statusBadge, getStatusStyle(expense.status)]}>
                  {expense.status}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Overdue Expenses */}
        {dashboardData.overdueExpenses.totalExpenseCount > 0 && (
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>⚠️ Gastos Vencidos</Text>
            <View style={styles.cardGrid}>
              {dashboardData.overdueExpenses.byCurrency.map((item) =>
                renderCurrencyCard(item, 'Vencidos', theme.color.state.danger.border)
              )}
            </View>
            <Text style={styles.warningText}>
              {dashboardData.overdueExpenses.totalExpenseCount} gastos vencidos requieren atención
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderTotal = () => {
    if (!totalData) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💰 Resumen de Gastos Totales</Text>
        <View style={styles.cardGrid}>
          {totalData.byCurrency.map((item) => renderCurrencyCard(item, 'Total', theme.color.brand.accent))}
        </View>
        <Text style={styles.infoText}>Total de gastos: {totalData.totalExpenseCount}</Text>

        {/* Filters Applied */}
        <View style={styles.filtersApplied}>
          <Text style={styles.filtersTitle}>Filtros aplicados:</Text>
          <Text style={styles.filterText}>
            Período: {totalData.filters.startDate} - {totalData.filters.endDate}
          </Text>
          {totalData.filters.status && (
            <Text style={styles.filterText}>Estado: {totalData.filters.status}</Text>
          )}
          {totalData.filters.categoryId && (
            <Text style={styles.filterText}>Categoría seleccionada</Text>
          )}
        </View>
      </View>
    );
  };

  const renderRecurring = () => {
    if (!recurringData) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔄 Gastos Recurrentes</Text>
        <View style={styles.cardGrid}>
          {recurringData.byCurrency.map((item) =>
            renderCurrencyCard(item, 'Recurrentes', theme.color.state.success.border)
          )}
        </View>
        <Text style={styles.infoText}>
          Total de gastos recurrentes: {recurringData.totalExpenseCount}
        </Text>
      </View>
    );
  };

  const renderByCategory = () => {
    if (!categoryData) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📁 Gastos por Categoría</Text>
        {categoryData.categories.map((category) => (
          <View key={category.categoryId} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.categoryName}</Text>
            <View style={styles.categoryContent}>
              {category.byCurrency.map((item) => (
                <View key={item.currency} style={styles.categoryItem}>
                  <Text style={styles.categoryAmount}>
                    {formatCurrency(item.totalAmountCents, item.currency)}
                  </Text>
                  <Text style={styles.categorySubtitle}>
                    {item.expenseCount} gastos • {item.currency}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.categoryTotal}>Total: {category.totalExpenseCount} gastos</Text>
          </View>
        ))}
        <Text style={styles.infoText}>Total general: {categoryData.totalExpenseCount} gastos</Text>
      </View>
    );
  };

  const renderBySite = () => {
    if (!siteData) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Gastos por Sede</Text>
        {siteData.sites.map((site) => (
          <View key={site.siteId} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{site.siteName}</Text>
            <View style={styles.categoryContent}>
              {site.byCurrency.map((item) => (
                <View key={item.currency} style={styles.categoryItem}>
                  <Text style={styles.categoryAmount}>
                    {formatCurrency(item.totalAmountCents, item.currency)}
                  </Text>
                  <Text style={styles.categorySubtitle}>
                    {item.expenseCount} gastos • {item.currency}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.categoryTotal}>Total: {site.totalExpenseCount} gastos</Text>
          </View>
        ))}
        <Text style={styles.infoText}>Total general: {siteData.totalExpenseCount} gastos</Text>
      </View>
    );
  };

  const renderComparison = () => {
    if (!comparisonData) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Comparación de Períodos</Text>
        {comparisonData.byCurrency.map((item) => (
          <View key={item.currency} style={styles.comparisonCard}>
            <Text style={styles.comparisonCurrency}>{item.currency}</Text>

            <View style={styles.comparisonRow}>
              <View style={styles.comparisonPeriod}>
                <Text style={styles.comparisonLabel}>Período 1</Text>
                <Text style={styles.comparisonAmount}>
                  {formatCurrency(item.period1AmountCents, item.currency)}
                </Text>
                <Text style={styles.comparisonCount}>{item.period1Count} gastos</Text>
              </View>

              <View style={styles.comparisonPeriod}>
                <Text style={styles.comparisonLabel}>Período 2</Text>
                <Text style={styles.comparisonAmount}>
                  {formatCurrency(item.period2AmountCents, item.currency)}
                </Text>
                <Text style={styles.comparisonCount}>{item.period2Count} gastos</Text>
              </View>
            </View>

            <View style={styles.comparisonDifference}>
              <Text style={styles.comparisonDiffLabel}>Diferencia</Text>
              <Text
                style={[
                  styles.comparisonDiffAmount,
                  { color: item.percentageChange >= 0 ? theme.color.state.danger.border : theme.color.state.success.border },
                ]}
              >
                {item.percentageChange >= 0 ? '+' : ''}
                {item.percentageChange.toFixed(1)}%
              </Text>
              <Text style={styles.comparisonDiffValue}>
                {formatCurrency(Math.abs(item.differenceAmountCents), item.currency)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderTrends = () => {
    if (!trendsData) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 Tendencias Temporales</Text>
        {trendsData.byCurrency.map((currencyTrend) => (
          <View key={currencyTrend.currency} style={styles.trendSection}>
            <Text style={styles.trendCurrency}>{currencyTrend.currency}</Text>
            {currencyTrend.periods.map((period, index) => (
              <View key={index} style={styles.trendItem}>
                <View style={styles.trendItemHeader}>
                  <Text style={styles.trendPeriod}>{period.period}</Text>
                  <Text style={styles.trendAmount}>
                    {formatCurrency(period.totalAmountCents, currencyTrend.currency)}
                  </Text>
                </View>
                <Text style={styles.trendCount}>{period.expenseCount} gastos</Text>
                <Text style={styles.trendDates}>
                  {period.startDate} - {period.endDate}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const renderProjections = () => {
    if (!projectionsData) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔮 Proyecciones de Gastos</Text>

        <View style={styles.projectionSummary}>
          <View style={styles.projectionStat}>
            <Text style={styles.projectionLabel}>Total Proyectado</Text>
            <Text style={styles.projectionValue}>
              {formatCurrency(projectionsData.totalProjectedAmountCents, projectionsData.currency)}
            </Text>
          </View>
          <View style={styles.projectionStat}>
            <Text style={styles.projectionLabel}>Meses</Text>
            <Text style={styles.projectionValue}>{projectionsData.monthsProjected}</Text>
          </View>
          <View style={styles.projectionStat}>
            <Text style={styles.projectionLabel}>Basado en</Text>
            <Text style={styles.projectionValue}>{projectionsData.basedOnExpenseCount} gastos</Text>
          </View>
        </View>

        <Text style={styles.subsectionTitle}>Proyección Mensual</Text>
        {projectionsData.projections.map((projection, index) => (
          <View key={index} style={styles.projectionItem}>
            <View style={styles.projectionItemHeader}>
              <Text style={styles.projectionMonth}>{projection.month}</Text>
              <Text style={styles.projectionAmount}>
                {formatCurrency(projection.projectedAmountCents, projection.currency)}
              </Text>
            </View>
            <Text style={styles.projectionCount}>{projection.expectedCount} gastos esperados</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderTabButton = (view: ReportView, label: string, icon: string) => (
    <TouchableOpacity
      key={view}
      style={[styles.tabButton, activeView === view && styles.tabButtonActive]}
      onPress={() => setActiveView(view)}
    >
      <Text style={[styles.tabButtonText, activeView === view && styles.tabButtonTextActive]}>
        {icon} {label}
      </Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.accent} />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      );
    }

    switch (activeView) {
      case 'dashboard':
        return renderDashboard();
      case 'total':
        return renderTotal();
      case 'recurring':
        return renderRecurring();
      case 'byCategory':
        return renderByCategory();
      case 'bySite':
        return renderBySite();
      case 'comparison':
        return renderComparison();
      case 'trends':
        return renderTrends();
      case 'projections':
        return renderProjections();
      default:
        return null;
    }
  };

  const getStatusStyle = (status: string) => {
    const statusStyles: any = {
      ACTIVE: { backgroundColor: theme.color.state.info.background, color: theme.color.state.info.border },
      PAID: { backgroundColor: theme.color.state.success.background, color: theme.color.state.success.border },
      OVERDUE: { backgroundColor: theme.color.state.danger.background, color: theme.color.state.danger.border },
      CANCELLED: { backgroundColor: theme.color.surface.subtle, color: theme.color.text.body },
    };
    return statusStyles[status] || statusStyles.ACTIVE;
  };

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <Text style={styles.filtersTitle}>Filtros de Fecha</Text>

      {/* Quick Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickFiltersScroll}
        contentContainerStyle={styles.quickFiltersContent}
      >
        <TouchableOpacity
          style={styles.quickFilterButton}
          onPress={() => setQuickDateFilter('today')}
        >
          <Text style={styles.quickFilterText}>📅 Hoy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickFilterButton}
          onPress={() => setQuickDateFilter('thisWeek')}
        >
          <Text style={styles.quickFilterText}>📆 Esta Semana</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickFilterButton, styles.quickFilterButtonActive]}
          onPress={() => setQuickDateFilter('thisMonth')}
        >
          <Text style={[styles.quickFilterText, styles.quickFilterTextActive]}>📊 Este Mes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickFilterButton}
          onPress={() => setQuickDateFilter('lastMonth')}
        >
          <Text style={styles.quickFilterText}>⏮️ Mes Pasado</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickFilterButton}
          onPress={() => setQuickDateFilter('thisYear')}
        >
          <Text style={styles.quickFilterText}>📈 Este Año</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Date Range Selectors */}
      <View style={styles.filterRow}>
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Fecha Inicio</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={theme.color.brand.accent} />
            <Text style={styles.dateButtonText}>{formatDisplayDate(startDate)}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Fecha Fin</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowEndDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={theme.color.brand.accent} />
            <Text style={styles.dateButtonText}>{formatDisplayDate(endDate)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.applyButton} onPress={() => loadData(activeView)}>
        <Text style={styles.applyButtonText}>Aplicar Filtros</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ProtectedRoute requiredPermissions={['expenses.read']}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Reportes de Gastos</Text>
          <View style={styles.headerSpacer} />
        </View>

        {renderFilters()}

        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContent}
          >
            {renderTabButton('dashboard', 'Dashboard', '📊')}
            {renderTabButton('total', 'Total', '💰')}
            {renderTabButton('recurring', 'Recurrentes', '🔄')}
            {renderTabButton('byCategory', 'Categorías', '📁')}
            {renderTabButton('bySite', 'Sedes', '📍')}
            {renderTabButton('comparison', 'Comparar', '⚖️')}
            {renderTabButton('trends', 'Tendencias', '📈')}
            {renderTabButton('projections', 'Proyecciones', '🔮')}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {renderContent()}
        </ScrollView>

        {/* Date Pickers */}
        <DatePicker
          visible={showStartDatePicker}
          date={startDateObj}
          onConfirm={(date) => {
            setStartDateObj(date);
            setStartDate(formatDateToString(date));
            setShowStartDatePicker(false);
            // Si la fecha de inicio es mayor que la fecha de fin, ajustar la fecha de fin
            if (date > endDateObj) {
              setEndDateObj(date);
              setEndDate(formatDateToString(date));
            }
          }}
          onCancel={() => setShowStartDatePicker(false)}
          title="Fecha de Inicio"
        />

        <DatePicker
          visible={showEndDatePicker}
          date={endDateObj}
          onConfirm={(date) => {
            setEndDateObj(date);
            setEndDate(formatDateToString(date));
            setShowEndDatePicker(false);
            // Si la fecha de fin es menor que la fecha de inicio, ajustar la fecha de inicio
            if (date < startDateObj) {
              setStartDateObj(date);
              setStartDate(formatDateToString(date));
            }
          }}
          onCancel={() => setShowEndDatePicker(false)}
          title="Fecha de Fin"
        />
      </SafeAreaView>
    </ProtectedRoute>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.surface.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: theme.color.brand.accent,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  headerSpacer: {
    width: 40,
  },
  filtersContainer: {
    backgroundColor: theme.color.surface.base,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  filtersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: 12,
  },
  quickFiltersScroll: {
    marginBottom: 16,
  },
  quickFiltersContent: {
    gap: 8,
    paddingRight: 16,
  },
  quickFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.color.surface.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  quickFilterButtonActive: {
    backgroundColor: theme.color.brand.accent,
    borderColor: theme.color.brand.accent,
  },
  quickFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  quickFilterTextActive: {
    color: theme.color.text.inverse,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  filterItem: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.color.text.muted,
    marginBottom: 4,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.color.surface.base,
  },
  dateButtonText: {
    fontSize: 14,
    color: theme.color.text.heading,
    flex: 1,
  },
  applyButton: {
    backgroundColor: theme.color.brand.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyButtonText: {
    color: theme.color.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  tabsContainer: {
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
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
    backgroundColor: theme.color.surface.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  tabButtonActive: {
    backgroundColor: theme.color.brand.accent,
    borderColor: theme.color.brand.accent,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  tabButtonTextActive: {
    color: theme.color.text.inverse,
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
    color: theme.color.text.muted,
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 16,
  },
  subsection: {
    marginBottom: 20,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: 12,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  currencyCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  currencyCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: 8,
  },
  currencyCardAmount: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  currencyCardSubtitle: {
    fontSize: 12,
    color: theme.color.text.placeholder,
  },
  infoText: {
    fontSize: 14,
    color: theme.color.text.muted,
    marginTop: 8,
  },
  warningText: {
    fontSize: 14,
    color: theme.color.state.danger.border,
    fontWeight: '500',
    marginTop: 8,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: theme.color.shadow,
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
    color: theme.color.text.heading,
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: theme.color.text.muted,
  },
  listItemRight: {
    alignItems: 'flex-end',
  },
  listItemAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 4,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  filtersApplied: {
    backgroundColor: theme.color.surface.subtle,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  filterText: {
    fontSize: 13,
    color: theme.color.text.body,
    marginTop: 4,
  },
  categorySection: {
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: 12,
  },
  categoryContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  categoryItem: {
    flex: 1,
    minWidth: '45%',
  },
  categoryAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.brand.accent,
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 12,
    color: theme.color.text.muted,
  },
  categoryTotal: {
    fontSize: 13,
    color: theme.color.text.muted,
    marginTop: 8,
  },
  comparisonCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  comparisonCurrency: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 16,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  comparisonPeriod: {
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: 4,
  },
  comparisonAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 4,
  },
  comparisonCount: {
    fontSize: 12,
    color: theme.color.text.placeholder,
  },
  comparisonDifference: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  comparisonDiffLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: 4,
  },
  comparisonDiffAmount: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  comparisonDiffValue: {
    fontSize: 14,
    color: theme.color.text.muted,
  },
  trendSection: {
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  trendCurrency: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 12,
  },
  trendItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.surface.subtle,
  },
  trendItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  trendPeriod: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  trendAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.brand.accent,
  },
  trendCount: {
    fontSize: 13,
    color: theme.color.text.muted,
    marginBottom: 2,
  },
  trendDates: {
    fontSize: 12,
    color: theme.color.text.placeholder,
  },
  projectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  projectionStat: {
    alignItems: 'center',
  },
  projectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: 4,
  },
  projectionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  projectionItem: {
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  projectionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectionMonth: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  projectionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.state.success.border,
  },
  projectionCount: {
    fontSize: 13,
    color: theme.color.text.muted,
  },
});

export default ExpenseReportsScreen;
