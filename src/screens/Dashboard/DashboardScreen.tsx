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
import Svg, { Line, Text as SvgText, Circle, Polyline, Path } from 'react-native-svg';
import { cashReconciliationApi, ResumenDiarioResponse } from '@/services/api/cash-reconciliation';
import { companiesApi } from '@/services/api/companies';
import { Site } from '@/types/sites';
import { useAuthStore } from '@/store/auth';

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
  const { currentCompany } = useAuthStore();

  const [selectedFilter, setSelectedFilter] = useState<DateFilter>('today');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);

  const [purchasesSummary, setPurchasesSummary] = useState<PurchasesSummary | null>(null);
  const [purchasesGrouped, setPurchasesGrouped] = useState<PurchasesGroupedSummary | null>(null);
  const [salesSummary, setSalesSummary] = useState<ResumenDiarioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Sede selector states
  const [sedes, setSedes] = useState<Site[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');
  const [loadingSedes, setLoadingSedes] = useState(false);
  const [showSedeModal, setShowSedeModal] = useState(false);

  const canViewPurchases = hasPermission(PERMISSIONS.DASHBOARD.PURCHASES);
  const canViewSales = hasPermission(PERMISSIONS.DASHBOARD.PURCHASES); // Usar el mismo permiso por ahora

  // Load sedes when company changes
  useEffect(() => {
    if (currentCompany?.id) {
      loadSedes();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    console.log('🔍 Dashboard useEffect - canViewPurchases:', canViewPurchases, 'canViewSales:', canViewSales, 'selectedFilter:', selectedFilter, 'selectedSedeId:', selectedSedeId);
    if (canViewPurchases) {
      loadPurchasesSummary();
      loadPurchasesGrouped();
    } else {
      setLoading(false);
    }

    if (canViewSales) {
      loadSalesSummary();
    } else {
      setLoadingSales(false);
    }
  }, [selectedFilter, selectedSedeId, canViewPurchases, canViewSales]);

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
      case 'week':
        return 'DAILY'; // Muestra los últimos 7 días
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
      // Para la gráfica, siempre usar los últimos 7 días si es hoy, ayer o semana
      let dateRange;
      if (selectedFilter === 'today' || selectedFilter === 'yesterday' || selectedFilter === 'week') {
        // Últimos 7 días
        const now = new Date();
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);

        const formatDate = (date: Date): string => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        dateRange = {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        };
      } else {
        dateRange = getDateRange(selectedFilter);
      }

      const groupBy = getGroupBy(selectedFilter);
      console.log('📊 Loading purchases grouped:', { ...dateRange, groupBy, filter: selectedFilter });

      const data = await apiClient.get<PurchasesGroupedSummary>('/admin/purchases/summary/grouped', {
        params: { ...dateRange, groupBy },
      });

      console.log('✅ Purchases grouped loaded:', data);
      setPurchasesGrouped(data);
    } catch (err: any) {
      console.error('❌ Error loading purchases grouped:', err);
      // No mostramos error aquí para no interferir con el resumen principal
    }
  };

  const loadSedes = async () => {
    try {
      setLoadingSedes(true);

      if (!currentCompany?.id) {
        console.warn('No hay empresa seleccionada');
        setSedes([]);
        return;
      }

      console.log('📍 Cargando sedes para empresa:', currentCompany.id, currentCompany.name);
      const response = await companiesApi.getCompanySites(currentCompany.id, {
        limit: 100,
        isActive: true,
      });

      console.log('✅ Sedes cargadas:', response.data?.length || 0);
      setSedes(response.data || []);
    } catch (error) {
      console.error('Error loading sedes:', error);
      setSedes([]);
    } finally {
      setLoadingSedes(false);
    }
  };

  const loadSalesSummary = async () => {
    try {
      setLoadingSales(true);
      setSalesError(null);

      const { startDate, endDate } = getDateRange(selectedFilter);
      console.log('📅 Loading sales summary:', { startDate, endDate, filter: selectedFilter, sedeId: selectedSedeId });

      const params: any = {
        fecha_inicio: startDate,
        fecha_fin: endDate,
      };

      if (selectedSedeId) {
        params.sede_id = selectedSedeId;
      }

      const data = await cashReconciliationApi.getResumenDiario(params);

      console.log('✅ Sales summary loaded:', data);
      setSalesSummary(data);
    } catch (err: any) {
      console.error('❌ Error loading sales summary:', err);
      setSalesError(err.response?.data?.message || 'Error al cargar el resumen de ventas');
    } finally {
      setLoadingSales(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const promises = [];

    if (canViewPurchases) {
      promises.push(loadPurchasesSummary(), loadPurchasesGrouped());
    }

    if (canViewSales) {
      promises.push(loadSalesSummary());
    }

    await Promise.all(promises);
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

  const renderChart = (
    data: GroupedData[] | undefined,
    title: string,
    color: string = '#6366F1'
  ) => {
    if (!data || data.length === 0) {
      return null;
    }

    const chartWidth = width - 32; // padding
    const chartHeight = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;

    const maxValue = Math.max(...data.map(d => d.totalValidated), 1);
    const pointSpacing = Math.max(graphWidth / (data.length - 1 || 1), 40);
    const totalWidth = Math.max(chartWidth, (data.length - 1) * pointSpacing + padding.left + padding.right);

    // Generar puntos para la línea
    const points = data.map((item, index) => {
      const x = padding.left + index * pointSpacing;
      const y = padding.top + graphHeight - (item.totalValidated / maxValue) * graphHeight;
      return { x, y, item };
    });

    // Crear path para la línea
    const linePath = points.map((point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }
      return `L ${point.x} ${point.y}`;
    }).join(' ');

    // Crear path para el área bajo la línea (gradiente)
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${padding.left} ${padding.top + graphHeight} Z`;

    return (
      <View style={styles.chartContainer}>
        <Text style={[styles.chartTitle, isTablet && styles.chartTitleTablet]}>
          {title}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Svg width={totalWidth} height={chartHeight}>
            {/* Eje Y - Líneas de referencia */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
              const y = padding.top + graphHeight * (1 - ratio);
              const value = maxValue * ratio;
              return (
                <React.Fragment key={`grid-${index}`}>
                  <Line
                    x1={padding.left}
                    y1={y}
                    x2={totalWidth - padding.right}
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

            {/* Área bajo la línea (gradiente suave) */}
            <Path
              d={areaPath}
              fill={color}
              fillOpacity="0.1"
            />

            {/* Línea principal */}
            <Path
              d={linePath}
              stroke={color}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Puntos en cada dato */}
            {points.map((point, index) => (
              <React.Fragment key={`point-${index}`}>
                {/* Círculo exterior (borde blanco) */}
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r="5"
                  fill="#FFFFFF"
                  stroke={color}
                  strokeWidth="2"
                />
                {/* Label del eje X */}
                <SvgText
                  x={point.x}
                  y={chartHeight - 10}
                  fontSize="9"
                  fill="#64748B"
                  textAnchor="middle"
                  transform={`rotate(-45, ${point.x}, ${chartHeight - 10})`}
                >
                  {point.item.label.length > 10 ? point.item.label.substring(0, 10) + '...' : point.item.label}
                </SvgText>
              </React.Fragment>
            ))}

            {/* Eje X */}
            <Line
              x1={padding.left}
              y1={padding.top + graphHeight}
              x2={totalWidth - padding.right}
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

  const renderSalesChart = () => {
    if (!salesSummary || !salesSummary.detalle_diario || salesSummary.detalle_diario.length === 0) {
      return null;
    }

    const chartWidth = width - 32;
    const chartHeight = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;

    const data = salesSummary.detalle_diario;
    // Calcular ventas netas (ventas - notas de crédito) para cada día
    const ventasNetas = data.map(d => d.ventas_total - d.notas_credito_total);
    const maxValue = Math.max(...ventasNetas, 1);
    const pointSpacing = Math.max(graphWidth / (data.length - 1 || 1), 40);
    const totalWidth = Math.max(chartWidth, (data.length - 1) * pointSpacing + padding.left + padding.right);

    // Generar puntos para la línea (usando ventas netas)
    const points = data.map((item, index) => {
      const ventaNeta = item.ventas_total - item.notas_credito_total;
      const x = padding.left + index * pointSpacing;
      const y = padding.top + graphHeight - (ventaNeta / maxValue) * graphHeight;
      return { x, y, item, ventaNeta };
    });

    // Crear path para la línea
    const linePath = points.map((point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }
      return `L ${point.x} ${point.y}`;
    }).join(' ');

    // Crear path para el área bajo la línea
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${padding.left} ${padding.top + graphHeight} Z`;

    return (
      <View style={styles.chartContainer}>
        <Text style={[styles.chartTitle, isTablet && styles.chartTitleTablet]}>
          📈 Ventas Netas en el Período (Ventas - Notas de Crédito)
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Svg width={totalWidth} height={chartHeight}>
            {/* Eje Y - Líneas de referencia */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
              const y = padding.top + graphHeight * (1 - ratio);
              const value = maxValue * ratio;
              return (
                <React.Fragment key={`grid-${index}`}>
                  <Line
                    x1={padding.left}
                    y1={y}
                    x2={totalWidth - padding.right}
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

            {/* Área bajo la línea */}
            <Path
              d={areaPath}
              fill="#10B981"
              fillOpacity="0.1"
            />

            {/* Línea principal */}
            <Path
              d={linePath}
              stroke="#10B981"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Puntos en cada dato */}
            {points.map((point, index) => (
              <React.Fragment key={`point-${index}`}>
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r="5"
                  fill="#FFFFFF"
                  stroke="#10B981"
                  strokeWidth="2"
                />
                <SvgText
                  x={point.x}
                  y={chartHeight - 10}
                  fontSize="9"
                  fill="#64748B"
                  textAnchor="middle"
                  transform={`rotate(-45, ${point.x}, ${chartHeight - 10})`}
                >
                  {formatDateShort(point.item.fecha)}
                </SvgText>
              </React.Fragment>
            ))}

            {/* Eje X */}
            <Line
              x1={padding.left}
              y1={padding.top + graphHeight}
              x2={totalWidth - padding.right}
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
          <View style={styles.headerTop}>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.title, isTablet && styles.titleTablet]}>📊 Dashboard</Text>
              <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
                Resumen de información clave
              </Text>
            </View>

            {/* Sede Selector - Discreto */}
            {sedes.length > 0 && (
              <TouchableOpacity
                style={styles.sedeSelector}
                onPress={() => setShowSedeModal(true)}
                disabled={loadingSedes}
              >
                <Text style={styles.sedeSelectorIcon}>🏪</Text>
                <View style={styles.sedeSelectorText}>
                  <Text style={styles.sedeSelectorLabel}>Sede</Text>
                  <Text style={styles.sedeSelectorValue}>
                    {selectedSedeId
                      ? sedes.find(s => s.id === selectedSedeId)?.name || 'Todas'
                      : 'Todas'}
                  </Text>
                </View>
                <Text style={styles.sedeSelectorArrow}>▼</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Date Filters - Ahora arriba de todo */}
        {(canViewPurchases || canViewSales) && (
          <View style={styles.filtersSection}>
            <Text style={[styles.filtersLabel, isTablet && styles.filtersLabelTablet]}>
              📅 Período de Análisis
            </Text>
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
          </View>
        )}

        {/* Sales Summary Section */}
        {canViewSales && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                💰 Ventas
              </Text>
            </View>

            {/* Loading State */}
            {loadingSales && !refreshing && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Cargando resumen de ventas...</Text>
              </View>
            )}

            {/* Error State */}
            {salesError && !loadingSales && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{salesError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadSalesSummary}>
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Summary Cards */}
            {!loadingSales && !salesError && salesSummary !== null && (
              <>
                {/* Stats Grid */}
                <View style={[styles.statsGrid, isTablet && styles.statsGridTablet]}>
                  {/* Total Ventas Brutas */}
                  <View style={[styles.statCard, styles.statCardInfo]}>
                    <Text style={styles.statIcon}>💵</Text>
                    <Text style={styles.statLabel}>Ventas Brutas</Text>
                    <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                      {formatCurrency(salesSummary.totales_periodo.ventas_total)}
                    </Text>
                    <Text style={styles.statSubtext}>
                      {salesSummary.totales_periodo.ventas_cantidad} operaciones
                    </Text>
                  </View>

                  {/* Notas de Crédito */}
                  <View style={[styles.statCard, styles.statCardDanger]}>
                    <Text style={styles.statIcon}>📝</Text>
                    <Text style={styles.statLabel}>Notas de Crédito</Text>
                    <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                      {formatCurrency(salesSummary.totales_periodo.notas_credito_total)}
                    </Text>
                    <Text style={styles.statSubtext}>
                      {salesSummary.totales_periodo.notas_credito_cantidad} anulaciones
                    </Text>
                  </View>

                  {/* Ventas Netas (Ventas - Notas de Crédito) */}
                  <View style={[styles.statCard, styles.statCardSuccess]}>
                    <Text style={styles.statIcon}>✅</Text>
                    <Text style={styles.statLabel}>Ventas Netas</Text>
                    <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                      {formatCurrency(salesSummary.totales_periodo.ventas_total - salesSummary.totales_periodo.notas_credito_total)}
                    </Text>
                    <Text style={styles.statSubtext}>
                      Ventas - Notas de Crédito
                    </Text>
                  </View>

                  {/* Total Prosegur */}
                  <View style={[styles.statCard, styles.statCardInfo]}>
                    <Text style={styles.statIcon}>🏦</Text>
                    <Text style={styles.statLabel}>Prosegur</Text>
                    <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                      {formatCurrency(salesSummary.totales_periodo.prosegur_depositos)}
                    </Text>
                    <Text style={styles.statSubtext}>
                      {salesSummary.totales_periodo.prosegur_cantidad} depósitos
                    </Text>
                  </View>

                  {/* Total Izipay Bruto */}
                  <View style={[styles.statCard, styles.statCardPrimary]}>
                    <Text style={styles.statIcon}>💳</Text>
                    <Text style={styles.statLabel}>Izipay Bruto</Text>
                    <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                      {formatCurrency(salesSummary.totales_periodo.izipay_bruto)}
                    </Text>
                    <Text style={styles.statSubtext}>
                      {salesSummary.totales_periodo.izipay_cantidad} transacciones
                    </Text>
                  </View>

                  {/* Total a Recibir */}
                  <View style={[styles.statCard, styles.statCardSuccess]}>
                    <Text style={styles.statIcon}>💰</Text>
                    <Text style={styles.statLabel}>Total a Recibir</Text>
                    <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                      {formatCurrency(salesSummary.totales_periodo.total_a_recibir)}
                    </Text>
                    <Text style={styles.statSubtext}>
                      Prosegur + Izipay neto
                    </Text>
                  </View>

                  {/* Comisiones */}
                  <View style={[styles.statCard, styles.statCardWarning]}>
                    <Text style={styles.statIcon}>📊</Text>
                    <Text style={styles.statLabel}>Comisiones</Text>
                    <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                      {formatCurrency(salesSummary.totales_periodo.total_comisiones)}
                    </Text>
                    <Text style={styles.statSubtext}>
                      Izipay
                    </Text>
                  </View>
                </View>

                {/* Chart */}
                {renderSalesChart()}

                {/* Empty State */}
                {salesSummary.detalle_diario.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>📭</Text>
                    <Text style={styles.emptyStateText}>
                      No hay ventas en el período seleccionado
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Purchases Summary Section */}
        {canViewPurchases && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                🛒 Compras
              </Text>
            </View>

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
                {renderChart(purchasesGrouped?.groupedData, '📈 Compras en el Período', '#6366F1')}

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

      {/* Sede Selection Modal */}
      <Modal
        visible={showSedeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSedeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🏪 Seleccionar Sede</Text>
              <TouchableOpacity onPress={() => setShowSedeModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Opción "Todas las sedes" */}
              <TouchableOpacity
                style={[
                  styles.sedeModalItem,
                  !selectedSedeId && styles.sedeModalItemSelected,
                ]}
                onPress={() => {
                  setSelectedSedeId('');
                  setShowSedeModal(false);
                }}
              >
                <View style={styles.sedeModalItemContent}>
                  <Text style={styles.sedeModalItemIcon}>🏢</Text>
                  <View style={styles.sedeModalItemText}>
                    <Text style={styles.sedeModalItemName}>Todas las Sedes</Text>
                    <Text style={styles.sedeModalItemCode}>Ver datos consolidados</Text>
                  </View>
                </View>
                {!selectedSedeId && <Text style={styles.sedeModalItemCheck}>✓</Text>}
              </TouchableOpacity>

              {/* Lista de sedes */}
              {sedes.map((sede) => (
                <TouchableOpacity
                  key={sede.id}
                  style={[
                    styles.sedeModalItem,
                    selectedSedeId === sede.id && styles.sedeModalItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedSedeId(sede.id);
                    setShowSedeModal(false);
                  }}
                >
                  <View style={styles.sedeModalItemContent}>
                    <Text style={styles.sedeModalItemIcon}>🏪</Text>
                    <View style={styles.sedeModalItemText}>
                      <Text style={styles.sedeModalItemName}>{sede.name}</Text>
                      {sede.code && (
                        <Text style={styles.sedeModalItemCode}>Código: {sede.code}</Text>
                      )}
                    </View>
                  </View>
                  {selectedSedeId === sede.id && (
                    <Text style={styles.sedeModalItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleContainer: {
    flex: 1,
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
  sedeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginLeft: 12,
    minWidth: 140,
  },
  sedeSelectorIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  sedeSelectorText: {
    flex: 1,
  },
  sedeSelectorLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sedeSelectorValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  sedeSelectorArrow: {
    fontSize: 10,
    color: '#94A3B8',
    marginLeft: 4,
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
  statSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  filtersSection: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filtersLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  filtersLabelTablet: {
    fontSize: 18,
  },
  statCardWarning: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statCardDanger: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
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
  sedeModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sedeModalItemSelected: {
    backgroundColor: '#F0F9FF',
  },
  sedeModalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sedeModalItemIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  sedeModalItemText: {
    flex: 1,
  },
  sedeModalItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  sedeModalItemCode: {
    fontSize: 12,
    color: '#64748B',
  },
  sedeModalItemCheck: {
    fontSize: 20,
    color: '#3B82F6',
    fontWeight: '700',
  },
});

export default DashboardScreen;
