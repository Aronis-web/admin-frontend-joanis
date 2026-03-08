import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';
import { apiClient } from '@/services/api';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import Svg, { Rect, Line, Text as SvgText, Circle } from 'react-native-svg';

interface PurchasesSummary {
  startDate: string;
  endDate: string;
  totalValidatedCents: number;
  totalValidated: number;
  totalPurchases: number;
  totalProducts: number;
  topSuppliers: {
    supplierId: string;
    supplierName: string;
    totalValidatedCents: number;
    totalValidated: number;
    purchaseCount: number;
    percentage: number;
  }[];
}

interface GroupedData {
  label: string;
  periodStart: string;
  periodEnd: string;
  totalValidatedCents: number;
  totalValidated: number;
  purchaseCount: number;
  productCount: number;
}

interface PurchasesGroupedSummary {
  startDate: string;
  endDate: string;
  groupBy: string;
  totalValidatedCents: number;
  totalValidated: number;
  totalPurchases: number;
  totalProducts: number;
  groupedData: GroupedData[];
}

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'year' | 'custom';

interface DashboardScreenProps {
  navigation: any;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  useScreenTracking('DashboardScreen', 'Dashboard');

  const { hasPermission } = usePermissions();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [selectedFilter, setSelectedFilter] = useState<DateFilter>('today');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);

  const [purchasesSummary, setPurchasesSummary] = useState<PurchasesSummary | null>(null);
  const [purchasesGrouped, setPurchasesGrouped] = useState<PurchasesGroupedSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canViewPurchases = hasPermission(PERMISSIONS.DASHBOARD.PURCHASES);

  useEffect(() => {
    console.log('🔍 Dashboard useEffect - canViewPurchases:', canViewPurchases, 'selectedFilter:', selectedFilter);
    if (canViewPurchases) {
      loadPurchasesSummary();
      loadPurchasesGrouped();
    } else {
      setLoading(false);
    }
  }, [selectedFilter, canViewPurchases]);

  const getDateRange = (filter: DateFilter): { startDate: string; endDate: string } => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (filter) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
        end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Lunes como primer día
        start = new Date(now);
        start.setDate(now.getDate() - diff);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      case 'custom':
        start = new Date(customStartDate.getFullYear(), customStartDate.getMonth(), customStartDate.getDate(), 0, 0, 0);
        end = new Date(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate(), 23, 59, 59);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      startDate: formatDate(start),
      endDate: formatDate(end),
    };
  };

  const getGroupBy = (filter: DateFilter): string => {
    switch (filter) {
      case 'today':
      case 'yesterday':
        return 'WEEKLY'; // Muestra la semana completa por día
      case 'week':
        return 'WEEKLY'; // Muestra la semana por día
      case 'month':
        return 'DAILY_IN_MONTH'; // Muestra el mes por día
      case 'lastMonth':
        return 'DAILY_IN_MONTH'; // Muestra el mes pasado por día
      case 'year':
        return 'MONTHLY'; // Muestra el año por mes
      case 'custom':
        // Para custom, decidir según el rango de días
        const { startDate, endDate } = getDateRange(filter);
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 7) {
          return 'DAILY';
        } else if (diffDays <= 31) {
          return 'DAILY_IN_MONTH';
        } else if (diffDays <= 365) {
          return 'MONTHLY';
        } else {
          return 'YEARLY';
        }
      default:
        return 'DAILY';
    }
  };

  const loadPurchasesSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRange(selectedFilter);
      console.log('📅 Loading purchases summary:', { startDate, endDate, filter: selectedFilter });

      const data = await apiClient.get<PurchasesSummary>('/admin/purchases/summary/by-date', {
        params: { startDate, endDate },
      });

      console.log('✅ Purchases summary loaded:', data);
      setPurchasesSummary(data);
    } catch (err: any) {
      console.error('❌ Error loading purchases summary:', err);
      setError(err.response?.data?.message || 'Error al cargar el resumen de compras');
    } finally {
      setLoading(false);
    }
  };

  const loadPurchasesGrouped = async () => {
    try {
      const { startDate, endDate } = getDateRange(selectedFilter);
      const groupBy = getGroupBy(selectedFilter);
      console.log('📊 Loading purchases grouped:', { startDate, endDate, groupBy, filter: selectedFilter });

      const data = await apiClient.get<PurchasesGroupedSummary>('/admin/purchases/summary/grouped', {
        params: { startDate, endDate, groupBy },
      });

      console.log('✅ Purchases grouped loaded:', data);
      setPurchasesGrouped(data);
    } catch (err: any) {
      console.error('❌ Error loading purchases grouped:', err);
      // No mostramos error aquí para no interferir con el resumen principal
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPurchasesSummary(), loadPurchasesGrouped()]);
    setRefreshing(false);
  };

  const handleCustomDateApply = () => {
    setShowCustomDateModal(false);
    setSelectedFilter('custom');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount);
  };

  const formatCompactNumber = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    } else {
      return amount.toFixed(0);
    }
  };

  const formatDateShort = (dateStr: string): string => {
    const date = new Date(dateStr);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  const formatDateLong = (dateStr: string): string => {
    const date = new Date(dateStr);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getFilterLabel = (filter: DateFilter): string => {
    switch (filter) {
      case 'today':
        return 'Hoy';
      case 'yesterday':
        return 'Ayer';
      case 'week':
        return 'Esta Semana';
      case 'month':
        return 'Este Mes';
      case 'lastMonth':
        return 'Mes Pasado';
      case 'year':
        return 'Este Año';
      case 'custom':
        return 'Personalizado';
      default:
        return 'Este Mes';
    }
  };

  const renderFilterButton = (filter: DateFilter, label: string) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterButton,
        selectedFilter === filter && styles.filterButtonActive,
        isTablet && styles.filterButtonTablet,
      ]}
      onPress={() => {
        if (filter === 'custom') {
          setShowCustomDateModal(true);
        } else {
          setSelectedFilter(filter);
        }
      }}
    >
      <Text
        style={[
          styles.filterButtonText,
          selectedFilter === filter && styles.filterButtonTextActive,
          isTablet && styles.filterButtonTextTablet,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderChart = () => {
    if (!purchasesGrouped || !purchasesGrouped.groupedData || purchasesGrouped.groupedData.length === 0) {
      return null;
    }

    const chartWidth = width - 32; // padding
    const chartHeight = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;

    const data = purchasesGrouped.groupedData;
    const maxValue = Math.max(...data.map(d => d.totalValidated), 1);
    const barWidth = Math.max(graphWidth / data.length - 8, 20);

    return (
      <View style={styles.chartContainer}>
        <Text style={[styles.chartTitle, isTablet && styles.chartTitleTablet]}>
          📈 Compras en el Período
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Svg width={Math.max(chartWidth, data.length * (barWidth + 8) + padding.left + padding.right)} height={chartHeight}>
            {/* Eje Y - Líneas de referencia */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
              const y = padding.top + graphHeight * (1 - ratio);
              const value = maxValue * ratio;
              return (
                <React.Fragment key={`grid-${index}`}>
                  <Line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + Math.max(graphWidth, data.length * (barWidth + 8))}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                  <SvgText
                    x={padding.left - 5}
                    y={y + 4}
                    fontSize="10"
                    fill="#64748B"
                    textAnchor="end"
                  >
                    {formatCompactNumber(value)}
                  </SvgText>
                </React.Fragment>
              );
            })}

            {/* Barras */}
            {data.map((item, index) => {
              const barHeight = (item.totalValidated / maxValue) * graphHeight;
              const x = padding.left + index * (barWidth + 8);
              const y = padding.top + graphHeight - barHeight;

              return (
                <React.Fragment key={`bar-${index}`}>
                  {/* Barra */}
                  <Rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill="#6366F1"
                    rx="4"
                  />
                  {/* Punto en la parte superior */}
                  {item.totalValidated > 0 && (
                    <Circle
                      cx={x + barWidth / 2}
                      cy={y}
                      r="3"
                      fill="#4F46E5"
                    />
                  )}
                  {/* Label del eje X */}
                  <SvgText
                    x={x + barWidth / 2}
                    y={chartHeight - 10}
                    fontSize="9"
                    fill="#64748B"
                    textAnchor="middle"
                    transform={`rotate(-45, ${x + barWidth / 2}, ${chartHeight - 10})`}
                  >
                    {item.label.length > 10 ? item.label.substring(0, 10) + '...' : item.label}
                  </SvgText>
                </React.Fragment>
              );
            })}

            {/* Eje X */}
            <Line
              x1={padding.left}
              y1={padding.top + graphHeight}
              x2={padding.left + Math.max(graphWidth, data.length * (barWidth + 8))}
              y2={padding.top + graphHeight}
              stroke="#94A3B8"
              strokeWidth="2"
            />

            {/* Eje Y */}
            <Line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + graphHeight}
              stroke="#94A3B8"
              strokeWidth="2"
            />
          </Svg>
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>📊 Dashboard</Text>
          <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
            Resumen de información clave
          </Text>
        </View>

        {/* Purchases Summary Section */}
        {canViewPurchases && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                🛒 Compras
              </Text>
            </View>

            {/* Date Filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersContainer}
              contentContainerStyle={styles.filtersContent}
            >
              {renderFilterButton('today', 'Hoy')}
              {renderFilterButton('yesterday', 'Ayer')}
              {renderFilterButton('week', 'Esta Semana')}
              {renderFilterButton('month', 'Este Mes')}
              {renderFilterButton('lastMonth', 'Mes Pasado')}
              {renderFilterButton('year', 'Este Año')}
              {renderFilterButton('custom', '📅 Personalizado')}
            </ScrollView>

            {/* Loading State */}
            {loading && !refreshing && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.loadingText}>Cargando resumen...</Text>
              </View>
            )}

            {/* Error State */}
            {error && !loading && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadPurchasesSummary}>
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Summary Cards */}
            {!loading && !error && purchasesSummary !== null && (
              <>
                {/* Stats Grid */}
                <View style={[styles.statsGrid, isTablet && styles.statsGridTablet]}>
                  {/* Total Validated */}
                  <View style={[styles.statCard, styles.statCardPrimary]}>
                    <Text style={styles.statIcon}>💰</Text>
                    <Text style={styles.statLabel}>Total Validado</Text>
                    <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                      {formatCurrency(purchasesSummary.totalValidated)}
                    </Text>
                  </View>

                  {/* Total Purchases */}
                  <View style={[styles.statCard, styles.statCardSuccess]}>
                    <Text style={styles.statIcon}>📦</Text>
                    <Text style={styles.statLabel}>Compras</Text>
                    <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                      {purchasesSummary.totalPurchases}
                    </Text>
                  </View>

                  {/* Total Products */}
                  <View style={[styles.statCard, styles.statCardInfo]}>
                    <Text style={styles.statIcon}>🏷️</Text>
                    <Text style={styles.statLabel}>Productos</Text>
                    <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                      {purchasesSummary.totalProducts}
                    </Text>
                  </View>
                </View>

                {/* Chart */}
                {renderChart()}

                {/* Top Suppliers */}
                {purchasesSummary.topSuppliers.length > 0 && (
                  <View style={styles.suppliersSection}>
                    <Text style={[styles.suppliersTitle, isTablet && styles.suppliersTitleTablet]}>
                      🏆 Top 5 Proveedores
                    </Text>
                    <Text style={styles.suppliersSubtitle}>
                      Período: {formatDateShort(purchasesSummary.startDate)} - {formatDateLong(purchasesSummary.endDate)}
                    </Text>

                    {purchasesSummary.topSuppliers.map((supplier, index) => (
                      <View key={supplier.supplierId} style={styles.supplierCard}>
                        <View style={styles.supplierRank}>
                          <Text style={styles.supplierRankText}>#{index + 1}</Text>
                        </View>
                        <View style={styles.supplierInfo}>
                          <Text style={[styles.supplierName, isTablet && styles.supplierNameTablet]}>
                            {supplier.supplierName}
                          </Text>
                          <View style={styles.supplierStats}>
                            <Text style={styles.supplierStat}>
                              {formatCurrency(supplier.totalValidated)}
                            </Text>
                            <Text style={styles.supplierStatSeparator}>•</Text>
                            <Text style={styles.supplierStat}>
                              {supplier.purchaseCount} {supplier.purchaseCount === 1 ? 'compra' : 'compras'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.supplierPercentage}>
                          <Text style={styles.supplierPercentageText}>
                            {supplier.percentage.toFixed(1)}%
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Empty State for Suppliers */}
                {purchasesSummary.topSuppliers.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>📭</Text>
                    <Text style={styles.emptyStateText}>
                      No hay compras en el período seleccionado
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* No Permissions State */}
        {!canViewPurchases && (
          <View style={styles.noPermissionsContainer}>
            <Text style={styles.noPermissionsIcon}>🔒</Text>
            <Text style={styles.noPermissionsText}>
              No tienes permisos para ver el dashboard de compras
            </Text>
            <Text style={styles.noPermissionsHint}>
              Contacta con tu administrador para obtener acceso
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Custom Date Range Modal */}
      <Modal
        visible={showCustomDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📅 Rango Personalizado</Text>
              <TouchableOpacity onPress={() => setShowCustomDateModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.dateLabel}>Fecha de Inicio</Text>
              <DatePickerButton
                date={customStartDate}
                onPress={() => setShowStartDatePicker(true)}
              />

              <Text style={[styles.dateLabel, { marginTop: 16 }]}>Fecha de Fin</Text>
              <DatePickerButton
                date={customEndDate}
                onPress={() => setShowEndDatePicker(true)}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowCustomDateModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyButton}
                onPress={handleCustomDateApply}
              >
                <Text style={styles.modalApplyButtonText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      <DatePicker
        visible={showStartDatePicker}
        date={customStartDate}
        onConfirm={(date) => {
          setCustomStartDate(date);
          setShowStartDatePicker(false);
        }}
        onCancel={() => setShowStartDatePicker(false)}
        maximumDate={customEndDate}
        title="Fecha de Inicio"
      />

      <DatePicker
        visible={showEndDatePicker}
        date={customEndDate}
        onConfirm={(date) => {
          setCustomEndDate(date);
          setShowEndDatePicker(false);
        }}
        onCancel={() => setShowEndDatePicker(false)}
        minimumDate={customStartDate}
        title="Fecha de Fin"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  titleTablet: {
    fontSize: 34,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  subtitleTablet: {
    fontSize: 17,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionTitleTablet: {
    fontSize: 24,
  },
  filtersContainer: {
    marginBottom: 20,
  },
  filtersContent: {
    paddingRight: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  filterButtonTablet: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  filterButtonTextTablet: {
    fontSize: 16,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  errorContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 15,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 20,
  },
  statsGridTablet: {
    marginHorizontal: -8,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    margin: 6,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardPrimary: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  statCardSuccess: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statCardInfo: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  statValueTablet: {
    fontSize: 24,
  },
  suppliersSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suppliersTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  suppliersTitleTablet: {
    fontSize: 20,
  },
  suppliersSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  supplierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  supplierRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supplierRankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  supplierNameTablet: {
    fontSize: 16,
  },
  supplierStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supplierStat: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  supplierStatSeparator: {
    fontSize: 13,
    color: '#CBD5E1',
    marginHorizontal: 6,
  },
  supplierPercentage: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
  },
  supplierPercentageText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  noPermissionsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  noPermissionsIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  noPermissionsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
    marginBottom: 8,
  },
  noPermissionsHint: {
    fontSize: 14,
    color: '#B45309',
    textAlign: 'center',
  },
  // Chart styles
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  chartTitleTablet: {
    fontSize: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#64748B',
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  modalCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalApplyButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#6366F1',
  },
  modalApplyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default DashboardScreen;
