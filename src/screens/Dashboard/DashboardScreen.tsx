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
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { config } from '@/utils/config';
import { authService } from '@/services/AuthService';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

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

  // Reports states
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [showReportDatePicker, setShowReportDatePicker] = useState(false);
  const [reportSedeId, setReportSedeId] = useState<string>('');
  const [reportTipoOrigen, setReportTipoOrigen] = useState<string>('');
  const [reportEstado, setReportEstado] = useState<string>('');
  const [reportIncluirDetalle, setReportIncluirDetalle] = useState<boolean>(true);
  const [downloadingReport, setDownloadingReport] = useState(false);

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

    // ✅ OPTIMIZACIÓN: Carga secuencial priorizada
    const loadDataSequentially = async () => {
      // Fase 1: Datos críticos (ventas) - Cargar primero
      if (canViewSales) {
        setLoadingSales(true);
        await loadSalesSummary();
        setLoadingSales(false);
      } else {
        setLoadingSales(false);
      }

      // Fase 2: Datos secundarios (compras) - Cargar después con delay
      if (canViewPurchases) {
        // Delay de 300ms para no saturar la red
        setTimeout(async () => {
          setLoading(true);
          await Promise.all([
            loadPurchasesSummary(),
            loadPurchasesGrouped()
          ]);
          setLoading(false);
        }, 300);
      } else {
        setLoading(false);
      }
    };

    loadDataSequentially();
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

  const downloadAccountsReceivableReport = async () => {
    try {
      setDownloadingReport(true);

      // Obtener token de autenticación
      const token = authService.getAccessToken();
      if (!token) {
        Alert.alert('Error', 'No hay sesión activa');
        return;
      }

      // Formatear fecha
      const formatDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Construir parámetros de query
      const params = new URLSearchParams({
        fecha: formatDate(reportDate),
      });

      if (reportSedeId) {
        params.append('sede_id', reportSedeId);
      }

      if (reportTipoOrigen) {
        params.append('tipo_origen', reportTipoOrigen);
      }

      if (reportEstado) {
        params.append('estado', reportEstado);
      }

      params.append('incluir_detalle', reportIncluirDetalle.toString());

      const url = `${config.API_URL}/accounts-receivable/reports/daily/pdf?${params.toString()}`;

      if (Platform.OS === 'web') {
        // En web, usar fetch y crear un blob URL
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-App-Id': config.APP_ID,
            'X-App-Version': config.APP_VERSION,
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        Alert.alert('Éxito', 'Reporte descargado correctamente');
      } else {
        // En móvil, descargar y compartir el archivo
        const timestamp = Date.now();
        const fileName = `cuentas-por-cobrar-${formatDate(reportDate)}-${timestamp}.pdf`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
          headers: {
            'X-App-Id': config.APP_ID,
            'Authorization': `Bearer ${token}`,
          },
        });

        if (downloadResult.status === 200) {
          // Compartir el archivo descargado
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Cuentas por Cobrar',
            UTI: 'com.adobe.pdf',
          });
          Alert.alert('Éxito', 'Reporte descargado correctamente');
        } else {
          throw new Error('Error al descargar el reporte');
        }
      }

      setShowReportsModal(false);
    } catch (error) {
      console.error('Error downloading report:', error);
      Alert.alert('Error', 'No se pudo descargar el reporte');
    } finally {
      setDownloadingReport(false);
    }
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
      {/* Header con gradiente */}
      <LinearGradient
        colors={[colors.primary[900], colors.primary[800]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerIconRow}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="stats-chart" size={22} color={colors.neutral[0]} />
              </View>
              <Text style={[styles.title, isTablet && styles.titleTablet]}>Dashboard</Text>
            </View>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              Resumen de información clave
            </Text>
          </View>

          {/* Sede Selector */}
          {sedes.length > 0 && (
            <TouchableOpacity
              style={styles.sedeSelector}
              onPress={() => setShowSedeModal(true)}
              disabled={loadingSedes}
              activeOpacity={0.7}
            >
              <Ionicons name="storefront" size={16} color={colors.neutral[0]} />
              <View style={styles.sedeSelectorText}>
                <Text style={styles.sedeSelectorLabel}>Sede</Text>
                <Text style={styles.sedeSelectorValue} numberOfLines={1}>
                  {selectedSedeId
                    ? sedes.find(s => s.id === selectedSedeId)?.name || 'Todas'
                    : 'Todas'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.accent[500]]} />}
      >

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

        {/* Reports Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              📊 Reportes
            </Text>
          </View>

          <View style={styles.reportsGrid}>
            {/* Cuentas por Cobrar Report */}
            <TouchableOpacity
              style={styles.reportCard}
              onPress={() => setShowReportsModal(true)}
            >
              <View style={styles.reportIconContainer}>
                <Text style={styles.reportIcon}>💰</Text>
              </View>
              <View style={styles.reportInfo}>
                <Text style={styles.reportTitle}>Cuentas por Cobrar</Text>
                <Text style={styles.reportDescription}>
                  Reporte diario con detalle por sede, deudor y tipo
                </Text>
              </View>
              <Text style={styles.reportArrow}>→</Text>
            </TouchableOpacity>
          </View>
        </View>
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
              <TouchableOpacity
                style={styles.reportDateInput}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.reportDateInputText}>
                  {customStartDate.toLocaleDateString('es-PE', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.reportDateInputIcon}>📅</Text>
              </TouchableOpacity>

              <Text style={[styles.dateLabel, { marginTop: 16 }]}>Fecha de Fin</Text>
              <TouchableOpacity
                style={styles.reportDateInput}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={styles.reportDateInputText}>
                  {customEndDate.toLocaleDateString('es-PE', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.reportDateInputIcon}>📅</Text>
              </TouchableOpacity>
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
          // Si la fecha de inicio es mayor que la fecha de fin, ajustar la fecha de fin
          if (date > customEndDate) {
            setCustomEndDate(date);
          }
        }}
        onCancel={() => setShowStartDatePicker(false)}
        title="Fecha de Inicio"
      />

      <DatePicker
        visible={showEndDatePicker}
        date={customEndDate}
        onConfirm={(date) => {
          setCustomEndDate(date);
          setShowEndDatePicker(false);
          // Si la fecha de fin es menor que la fecha de inicio, ajustar la fecha de inicio
          if (date < customStartDate) {
            setCustomStartDate(date);
          }
        }}
        onCancel={() => setShowEndDatePicker(false)}
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

      {/* Reports Configuration Modal */}
      <Modal
        visible={showReportsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.reportsModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>💰 Cuentas por Cobrar</Text>
              <TouchableOpacity onPress={() => setShowReportsModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Fecha */}
              <View style={styles.reportParamSection}>
                <Text style={styles.reportParamLabel}>📅 Fecha del Reporte</Text>
                <TouchableOpacity
                  style={styles.reportDateInput}
                  onPress={() => setShowReportDatePicker(true)}
                >
                  <Text style={styles.reportDateInputText}>
                    {reportDate.toLocaleDateString('es-PE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.reportDateInputIcon}>📅</Text>
                </TouchableOpacity>
              </View>

              {/* Sede */}
              <View style={styles.reportParamSection}>
                <Text style={styles.reportParamLabel}>🏪 Sede (Opcional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.reportChipsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.reportChip,
                        !reportSedeId && styles.reportChipActive,
                      ]}
                      onPress={() => setReportSedeId('')}
                    >
                      <Text
                        style={[
                          styles.reportChipText,
                          !reportSedeId && styles.reportChipTextActive,
                        ]}
                      >
                        Todas
                      </Text>
                    </TouchableOpacity>
                    {sedes.map((sede) => (
                      <TouchableOpacity
                        key={sede.id}
                        style={[
                          styles.reportChip,
                          reportSedeId === sede.id && styles.reportChipActive,
                        ]}
                        onPress={() => setReportSedeId(sede.id)}
                      >
                        <Text
                          style={[
                            styles.reportChipText,
                            reportSedeId === sede.id && styles.reportChipTextActive,
                          ]}
                        >
                          {sede.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Tipo de Origen */}
              <View style={styles.reportParamSection}>
                <Text style={styles.reportParamLabel}>📦 Tipo de Origen (Opcional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.reportChipsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.reportChip,
                        !reportTipoOrigen && styles.reportChipActive,
                      ]}
                      onPress={() => setReportTipoOrigen('')}
                    >
                      <Text
                        style={[
                          styles.reportChipText,
                          !reportTipoOrigen && styles.reportChipTextActive,
                        ]}
                      >
                        Todos
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.reportChip,
                        reportTipoOrigen === 'SALE' && styles.reportChipActive,
                      ]}
                      onPress={() => setReportTipoOrigen('SALE')}
                    >
                      <Text
                        style={[
                          styles.reportChipText,
                          reportTipoOrigen === 'SALE' && styles.reportChipTextActive,
                        ]}
                      >
                        Ventas
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.reportChip,
                        reportTipoOrigen === 'CAMPAIGN_DELIVERY' && styles.reportChipActive,
                      ]}
                      onPress={() => setReportTipoOrigen('CAMPAIGN_DELIVERY')}
                    >
                      <Text
                        style={[
                          styles.reportChipText,
                          reportTipoOrigen === 'CAMPAIGN_DELIVERY' && styles.reportChipTextActive,
                        ]}
                      >
                        Campañas
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>

              {/* Estado */}
              <View style={styles.reportParamSection}>
                <Text style={styles.reportParamLabel}>📊 Estado (Opcional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.reportChipsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.reportChip,
                        !reportEstado && styles.reportChipActive,
                      ]}
                      onPress={() => setReportEstado('')}
                    >
                      <Text
                        style={[
                          styles.reportChipText,
                          !reportEstado && styles.reportChipTextActive,
                        ]}
                      >
                        Todos
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.reportChip,
                        reportEstado === 'PENDING' && styles.reportChipActive,
                      ]}
                      onPress={() => setReportEstado('PENDING')}
                    >
                      <Text
                        style={[
                          styles.reportChipText,
                          reportEstado === 'PENDING' && styles.reportChipTextActive,
                        ]}
                      >
                        Pendiente
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.reportChip,
                        reportEstado === 'OVERDUE' && styles.reportChipActive,
                      ]}
                      onPress={() => setReportEstado('OVERDUE')}
                    >
                      <Text
                        style={[
                          styles.reportChipText,
                          reportEstado === 'OVERDUE' && styles.reportChipTextActive,
                        ]}
                      >
                        Vencida
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>

              {/* Incluir Detalle */}
              <View style={styles.reportParamSection}>
                <TouchableOpacity
                  style={styles.reportCheckboxContainer}
                  onPress={() => setReportIncluirDetalle(!reportIncluirDetalle)}
                >
                  <View style={[styles.reportCheckbox, reportIncluirDetalle && styles.reportCheckboxChecked]}>
                    {reportIncluirDetalle && <Text style={styles.reportCheckboxCheck}>✓</Text>}
                  </View>
                  <Text style={styles.reportCheckboxLabel}>Incluir detalle completo</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowReportsModal(false)}
                disabled={downloadingReport}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalApplyButton, downloadingReport && styles.modalApplyButtonDisabled]}
                onPress={downloadAccountsReceivableReport}
                disabled={downloadingReport}
              >
                {downloadingReport ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalApplyButtonText}>📄 Descargar PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Date Picker */}
      {showReportDatePicker && (
        <DateTimePicker
          value={reportDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowReportDatePicker(false);
            if (selectedDate) {
              setReportDate(selectedDate);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  headerGradient: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[0],
    letterSpacing: 0.3,
  },
  titleTablet: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginLeft: spacing[12],
  },
  subtitleTablet: {
    fontSize: 15,
  },
  sedeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginLeft: spacing[3],
    minWidth: 120,
    maxWidth: 160,
    gap: spacing[2],
  },
  sedeSelectorText: {
    flex: 1,
  },
  sedeSelectorLabel: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sedeSelectorValue: {
    fontSize: 12,
    color: colors.neutral[0],
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  sectionTitleTablet: {
    fontSize: 20,
  },
  filtersContainer: {
    marginBottom: spacing[4],
  },
  filtersContent: {
    paddingRight: spacing[4],
  },
  filterButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.primary,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    marginRight: spacing[2],
  },
  filterButtonTablet: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  filterButtonActive: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  filterButtonTextTablet: {
    fontSize: 14,
  },
  filterButtonTextActive: {
    color: colors.neutral[0],
  },
  loadingContainer: {
    padding: spacing[10],
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: 15,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  errorContainer: {
    padding: spacing[8],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger[50],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.danger[100],
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing[3],
  },
  errorText: {
    fontSize: 15,
    color: colors.danger[600],
    textAlign: 'center',
    marginBottom: spacing[4],
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    backgroundColor: colors.danger[600],
    borderRadius: borderRadius.lg,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing[1.5],
    marginBottom: spacing[5],
  },
  statsGridTablet: {
    marginHorizontal: -spacing[2],
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    margin: spacing[1.5],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardPrimary: {
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  statCardSuccess: {
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[100],
  },
  statCardInfo: {
    backgroundColor: colors.info[50],
    borderWidth: 1,
    borderColor: colors.info[100],
  },
  statIcon: {
    fontSize: 28,
    marginBottom: spacing[2],
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[1],
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
    textAlign: 'center',
  },
  statValueTablet: {
    fontSize: 22,
  },
  statSubtext: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: spacing[1],
    fontWeight: '500',
    textAlign: 'center',
  },
  filtersSection: {
    marginBottom: spacing[5],
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  filtersLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[3],
  },
  filtersLabelTablet: {
    fontSize: 16,
  },
  statCardWarning: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[100],
  },
  statCardDanger: {
    backgroundColor: colors.danger[50],
    borderWidth: 1,
    borderColor: colors.danger[100],
  },
  suppliersSection: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  suppliersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  suppliersTitleTablet: {
    fontSize: 18,
  },
  suppliersSubtitle: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: spacing[4],
  },
  supplierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  supplierRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  supplierRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary[700],
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  supplierNameTablet: {
    fontSize: 15,
  },
  supplierStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supplierStat: {
    fontSize: 12,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  supplierStatSeparator: {
    fontSize: 12,
    color: colors.neutral[300],
    marginHorizontal: spacing[1.5],
  },
  supplierPercentage: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    backgroundColor: colors.accent[50],
    borderRadius: borderRadius.full,
  },
  supplierPercentageText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent[700],
  },
  emptyState: {
    padding: spacing[10],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  emptyStateIcon: {
    fontSize: 56,
    marginBottom: spacing[3],
  },
  emptyStateText: {
    fontSize: 15,
    color: colors.neutral[500],
    textAlign: 'center',
    fontWeight: '500',
  },
  noPermissionsContainer: {
    padding: spacing[10],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.warning[100],
  },
  noPermissionsIcon: {
    fontSize: 56,
    marginBottom: spacing[3],
  },
  noPermissionsText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.warning[800],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  noPermissionsHint: {
    fontSize: 14,
    color: colors.warning[700],
    textAlign: 'center',
  },
  // Chart styles
  chartContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[4],
  },
  chartTitleTablet: {
    fontSize: 18,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    width: '100%',
    maxWidth: 400,
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  modalCloseButton: {
    fontSize: 22,
    color: colors.neutral[400],
    fontWeight: '600',
  },
  modalBody: {
    padding: spacing[5],
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[2],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    gap: spacing[3],
  },
  modalCancelButton: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  modalApplyButton: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[900],
  },
  modalApplyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  sedeModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  sedeModalItemSelected: {
    backgroundColor: colors.accent[50],
  },
  sedeModalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sedeModalItemIcon: {
    fontSize: 22,
    marginRight: spacing[3],
  },
  sedeModalItemText: {
    flex: 1,
  },
  sedeModalItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[0.5],
  },
  sedeModalItemCode: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  sedeModalItemCheck: {
    fontSize: 18,
    color: colors.accent[600],
    fontWeight: '700',
  },
  // Reports styles
  reportsGrid: {
    gap: spacing[3],
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  reportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.success[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  reportIcon: {
    fontSize: 24,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  reportDescription: {
    fontSize: 12,
    color: colors.neutral[500],
    lineHeight: 18,
  },
  reportArrow: {
    fontSize: 22,
    color: colors.neutral[300],
    marginLeft: spacing[2],
  },
  reportsModalContent: {
    maxHeight: '90%',
  },
  reportParamSection: {
    marginBottom: spacing[5],
  },
  reportParamLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: spacing[2],
  },
  reportDateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
    padding: spacing[3.5],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  reportDateInputText: {
    fontSize: 14,
    color: colors.neutral[800],
    fontWeight: '500',
  },
  reportDateInputIcon: {
    fontSize: 18,
  },
  reportChipsContainer: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  reportChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[50],
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
  },
  reportChipActive: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  reportChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  reportChipTextActive: {
    color: colors.neutral[0],
  },
  reportCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportCheckbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  reportCheckboxChecked: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  reportCheckboxCheck: {
    fontSize: 12,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  reportCheckboxLabel: {
    fontSize: 14,
    color: colors.neutral[600],
    fontWeight: '500',
  },
  modalApplyButtonDisabled: {
    opacity: 0.6,
  },
});

export default DashboardScreen;
