import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { apiClient, scopesApi } from '@/services/api';
import type { ResolvedScope } from '@/services/api';
import { DateRangePicker } from '@/components/DateRangePicker';
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
import { useTheme } from '@/design-system/themes';
import { useThemedStyles } from '@/design-system/themes/useThemedStyles';
import type { Theme } from '@/design-system/themes/defaultLight';

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
  const { currentCompany, user } = useAuthStore();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [selectedFilter, setSelectedFilter] = useState<DateFilter>('today');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);

  const [purchasesSummary, setPurchasesSummary] = useState<PurchasesSummary | null>(null);
  const [purchasesGrouped, setPurchasesGrouped] = useState<PurchasesGroupedSummary | null>(null);
  const [salesSummary, setSalesSummary] = useState<ResumenDiarioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Sede selector states (multi-select con patrón draft + applied)
  const [sedes, setSedes] = useState<Site[]>([]);
  const [selectedSedeIds, setSelectedSedeIds] = useState<string[]>([]);
  const [draftSedeIds, setDraftSedeIds] = useState<string[]>([]);
  const [loadingSedes, setLoadingSedes] = useState(false);
  const [showSedeModal, setShowSedeModal] = useState(false);

  const allSedesSelected = sedes.length > 0 && draftSedeIds.length === sedes.length;
  const sedeKey = selectedSedeIds.slice().sort().join(',');
  // Siempre envía CSV de sedes seleccionadas (nunca vacío) para respetar permisos del usuario.
  const getSedeIdParam = useCallback((): string | undefined => {
    if (selectedSedeIds.length === 0) return undefined;
    return selectedSedeIds.length === 1 ? selectedSedeIds[0] : selectedSedeIds.join(',');
  }, [selectedSedeIds]);
  const selectedSedesLabel = useMemo(() => {
    if (sedes.length === 0 || selectedSedeIds.length === 0) {
      return 'Sin sedes';
    }
    if (selectedSedeIds.length === sedes.length) {
      return sedes.length === 1
        ? sedes[0].name
        : `Todas (${sedes.length})`;
    }
    if (selectedSedeIds.length === 1) {
      return sedes.find((s) => s.id === selectedSedeIds[0])?.name || '1 sede';
    }
    return `${selectedSedeIds.length} sedes`;
  }, [sedes, selectedSedeIds]);

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
    console.log('🔍 Dashboard useEffect - canViewPurchases:', canViewPurchases, 'canViewSales:', canViewSales, 'selectedFilter:', selectedFilter, 'selectedSedeIds:', selectedSedeIds);

    // No disparar peticiones sin sedes seleccionadas: el backend devolvería todo y violaría permisos.
    if (selectedSedeIds.length === 0) {
      setLoadingSales(false);
      setLoading(false);
      return;
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter, sedeKey, canViewPurchases, canViewSales]);

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
      const sedeIdParam = getSedeIdParam();
      console.log('📅 Loading purchases summary:', { startDate, endDate, filter: selectedFilter, sedeId: sedeIdParam });

      if (!sedeIdParam) {
        console.warn('⚠️ Sin sedes seleccionadas — omitiendo petición de compras.');
        return;
      }

      const params: any = {
        fecha_inicio: startDate,
        fecha_fin: endDate,
        sede_id: sedeIdParam,
      };

      const data = await apiClient.get<PurchasesSummary>('/admin/purchases/summary/by-date', {
        params,
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

      const params: any = {
        fecha_inicio: dateRange.startDate,
        fecha_fin: dateRange.endDate,
        groupBy,
      };

      const sedeIdParam = getSedeIdParam();
      if (!sedeIdParam) {
        console.warn('⚠️ Sin sedes seleccionadas — omitiendo petición de compras agrupadas.');
        return;
      }
      params.sede_id = sedeIdParam;

      console.log('📊 Loading purchases grouped:', {
        fecha_inicio: params.fecha_inicio,
        fecha_fin: params.fecha_fin,
        groupBy: params.groupBy,
        filter: selectedFilter,
        sedeId: sedeIdParam,
      });

      const data = await apiClient.get<PurchasesGroupedSummary>('/admin/purchases/summary/grouped', {
        params,
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
        setSelectedSedeIds([]);
        setDraftSedeIds([]);
        return;
      }

      console.log('📍 Cargando sedes para empresa:', currentCompany.id, currentCompany.name);
      const response = await companiesApi.getCompanySites(currentCompany.id, {
        limit: 100,
        isActive: true,
      });
      const companySites = response.data || [];

      // Filtrar por scopes del usuario (mismo criterio que SiteSelectionScreen al hacer login).
      let permittedSites = companySites;
      if (user?.id) {
        try {
          const scopesResponse = await scopesApi.getUserResolvedScopes(user.id, config.APP_ID, {
            limit: 1000,
          });
          const userScopes: ResolvedScope[] = Array.isArray(scopesResponse)
            ? scopesResponse
            : (scopesResponse as any)?.items || [];
          const companyScopes = userScopes.filter((s) => s.companyId === currentCompany.id);
          const hasCompanyLevel = companyScopes.some((s) => s.level === 'COMPANY');
          if (!hasCompanyLevel) {
            const permittedIds = new Set(
              companyScopes
                .filter((s) => s.level === 'SITE' && s.siteId)
                .map((s) => s.siteId as string)
            );
            permittedSites = companySites.filter((s) => permittedIds.has(s.id));
          }
        } catch (scopeError) {
          console.error('Error cargando scopes del usuario, usando sedes de empresa sin filtrar:', scopeError);
        }
      }

      console.log('✅ Sedes permitidas:', permittedSites.length, 'de', companySites.length);
      setSedes(permittedSites);
      // Por defecto todas las sedes permitidas quedan seleccionadas para respetar permisos.
      const allIds = permittedSites.map((s) => s.id);
      setSelectedSedeIds(allIds);
      setDraftSedeIds(allIds);
    } catch (error) {
      console.error('Error loading sedes:', error);
      setSedes([]);
      setSelectedSedeIds([]);
      setDraftSedeIds([]);
    } finally {
      setLoadingSedes(false);
    }
  };

  const loadSalesSummary = async () => {
    try {
      setLoadingSales(true);
      setSalesError(null);

      const { startDate, endDate } = getDateRange(selectedFilter);
      const sedeIdParam = getSedeIdParam();
      console.log('📅 Loading sales summary:', { startDate, endDate, filter: selectedFilter, sedeId: sedeIdParam });

      if (!sedeIdParam) {
        console.warn('⚠️ Sin sedes seleccionadas — omitiendo petición de ventas.');
        return;
      }

      const params: any = {
        fecha_inicio: startDate,
        fecha_fin: endDate,
        sede_id: sedeIdParam,
      };

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
        // En web, usar fetch y crear un link de descarga
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

        // Create a download link instead of opening in new tab
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `cuentas-por-cobrar-${formatDate(reportDate)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up blob URL after download
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        Alert.alert('Éxito', 'Reporte descargado correctamente');
      } else {
        // En móvil, descargar y compartir el archivo
        const timestamp = Date.now();
        const fileName = `cuentas-por-cobrar-${formatDate(reportDate)}-${timestamp}.pdf`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

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
          setShowDateRangePicker(true);
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
    color: string = theme.color.chart.categorical[0]
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
                    stroke={theme.color.chart.grid}
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                  <SvgText
                    x={padding.left - 5}
                    y={y + 4}
                    fontSize="10"
                    fill={theme.color.chart.axis}
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
                  fill={theme.color.surface.base}
                  stroke={color}
                  strokeWidth="2"
                />
                {/* Label del eje X */}
                <SvgText
                  x={point.x}
                  y={chartHeight - 10}
                  fontSize="9"
                  fill={theme.color.chart.axis}
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
              stroke={theme.color.chart.axis}
              strokeWidth="2"
            />

            {/* Eje Y */}
            <Line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + graphHeight}
              stroke={theme.color.chart.axis}
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
                    stroke={theme.color.chart.grid}
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                  <SvgText
                    x={padding.left - 5}
                    y={y + 4}
                    fontSize="10"
                    fill={theme.color.chart.axis}
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
              fill={theme.color.chart.categorical[6]}
              fillOpacity="0.1"
            />

            {/* Línea principal */}
            <Path
              d={linePath}
              stroke={theme.color.chart.categorical[6]}
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
                  fill={theme.color.surface.base}
                  stroke={theme.color.chart.categorical[6]}
                  strokeWidth="2"
                />
                <SvgText
                  x={point.x}
                  y={chartHeight - 10}
                  fontSize="9"
                  fill={theme.color.chart.axis}
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
              stroke={theme.color.chart.axis}
              strokeWidth="2"
            />

            {/* Eje Y */}
            <Line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + graphHeight}
              stroke={theme.color.chart.axis}
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
        colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerIconRow}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="stats-chart" size={22} color={theme.color.brand.onHeader} />
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
              onPress={() => {
                setDraftSedeIds(selectedSedeIds);
                setShowSedeModal(true);
              }}
              disabled={loadingSedes}
              activeOpacity={0.7}
            >
              <Ionicons name="storefront" size={16} color={theme.color.brand.onHeader} />
              <View style={styles.sedeSelectorText}>
                <Text style={styles.sedeSelectorLabel}>Sede</Text>
                <Text style={styles.sedeSelectorValue} numberOfLines={1}>
                  {selectedSedesLabel}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={14} color={theme.color.brand.onHeaderMuted} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.color.brand.accent]} />}
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
                <ActivityIndicator size="large" color={theme.color.chart.categorical[6]} />
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
                <ActivityIndicator size="large" color={theme.color.chart.categorical[0]} />
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
                {renderChart(purchasesGrouped?.groupedData, '📈 Compras en el Período', theme.color.chart.categorical[0])}

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

      {/* Date Range Picker */}
      <DateRangePicker
        visible={showDateRangePicker}
        startDate={customStartDate}
        endDate={customEndDate}
        onConfirm={(start, end) => {
          setCustomStartDate(start);
          setCustomEndDate(end);
          setShowDateRangePicker(false);
          setSelectedFilter('custom');
        }}
        onCancel={() => setShowDateRangePicker(false)}
        title="Rango Personalizado"
      />

      {/* Sede Selection Modal (multi-select con draft + applied) */}
      <Modal
        visible={showSedeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSedeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.sedeModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🏪 Seleccionar Sedes</Text>
              <TouchableOpacity onPress={() => setShowSedeModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sedeModalScroll}>
              {/* Toggle Seleccionar todos */}
              <TouchableOpacity
                style={[styles.sedeModalItem, allSedesSelected && styles.sedeModalItemSelected]}
                onPress={() => setDraftSedeIds(allSedesSelected ? [] : sedes.map((s) => s.id))}
                activeOpacity={0.7}
              >
                <View style={styles.sedeModalItemContent}>
                  <View style={styles.sedeModalItemIconBadge}>
                    <Ionicons
                      name="business"
                      size={18}
                      color={allSedesSelected ? theme.color.brand.accent : theme.color.icon.muted}
                    />
                  </View>
                  <View style={styles.sedeModalItemText}>
                    <Text style={styles.sedeModalItemName}>Seleccionar todos</Text>
                    <Text style={styles.sedeModalItemCode}>
                      {allSedesSelected ? 'Todas las sedes seleccionadas' : 'Marcar todas las sedes'}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={allSedesSelected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={allSedesSelected ? theme.color.brand.accent : theme.color.icon.muted}
                />
              </TouchableOpacity>

              {/* Lista de sedes con checkbox */}
              {sedes.map((sede) => {
                const checked = draftSedeIds.includes(sede.id);
                return (
                  <TouchableOpacity
                    key={sede.id}
                    style={[styles.sedeModalItem, checked && styles.sedeModalItemSelected]}
                    onPress={() =>
                      setDraftSedeIds((prev) =>
                        prev.includes(sede.id) ? prev.filter((id) => id !== sede.id) : [...prev, sede.id]
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.sedeModalItemContent}>
                      <View style={styles.sedeModalItemIconBadge}>
                        <Ionicons
                          name="storefront"
                          size={18}
                          color={checked ? theme.color.brand.accent : theme.color.icon.muted}
                        />
                      </View>
                      <View style={styles.sedeModalItemText}>
                        <Text style={styles.sedeModalItemName}>{sede.name}</Text>
                        {sede.code && (
                          <Text style={styles.sedeModalItemCode}>Código: {sede.code}</Text>
                        )}
                      </View>
                    </View>
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={checked ? theme.color.brand.accent : theme.color.icon.muted}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowSedeModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalApplyButton,
                  draftSedeIds.length === 0 && styles.modalApplyButtonDisabled,
                ]}
                disabled={draftSedeIds.length === 0}
                onPress={() => {
                  setSelectedSedeIds(draftSedeIds);
                  setShowSedeModal(false);
                }}
              >
                <Text style={styles.modalApplyButtonText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
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
                  <ActivityIndicator size="small" color={theme.color.text.onAction} />
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  headerGradient: {
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[4],
    paddingBottom: theme.space[5],
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.space[4],
    paddingBottom: theme.space[8],
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
    marginBottom: theme.space[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
    letterSpacing: 0.3,
  },
  titleTablet: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    marginLeft: theme.space[12],
  },
  subtitleTablet: {
    fontSize: 15,
  },
  sedeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.brand.headerBadge,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    marginLeft: theme.space[3],
    minWidth: 120,
    maxWidth: 160,
    gap: theme.space[2],
  },
  sedeSelectorText: {
    flex: 1,
  },
  sedeSelectorLabel: {
    fontSize: 9,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sedeSelectorValue: {
    fontSize: 12,
    color: theme.color.brand.onHeader,
    fontWeight: '600',
  },
  section: {
    marginBottom: theme.space[6],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[4],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  sectionTitleTablet: {
    fontSize: 20,
  },
  filtersContainer: {
    marginBottom: theme.space[4],
  },
  filtersContent: {
    paddingRight: theme.space[4],
  },
  filterButton: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2.5],
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.base,
    borderWidth: 1.5,
    borderColor: theme.color.border.subtle,
    marginRight: theme.space[2],
  },
  filterButtonTablet: {
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  filterButtonActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.text.muted,
  },
  filterButtonTextTablet: {
    fontSize: 14,
  },
  filterButtonTextActive: {
    color: theme.color.text.onAction,
  },
  loadingContainer: {
    padding: theme.space[10],
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: theme.space[3],
    fontSize: 15,
    color: theme.color.text.muted,
    fontWeight: '500',
  },
  errorContainer: {
    padding: theme.space[8],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.state.danger.background,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.state.danger.border,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: theme.space[3],
  },
  errorText: {
    fontSize: 15,
    color: theme.color.text.danger,
    textAlign: 'center',
    marginBottom: theme.space[4],
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[2.5],
    backgroundColor: theme.color.action.danger.background,
    borderRadius: theme.radii.lg,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.action.danger.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -theme.space[1.5],
    marginBottom: theme.space[5],
  },
  statsGridTablet: {
    marginHorizontal: -theme.space[2],
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    margin: theme.space[1.5],
    padding: theme.space[4],
    borderRadius: theme.radii.xl,
    alignItems: 'center',
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardPrimary: {
    backgroundColor: theme.color.brand.accentSoft,
    borderWidth: 1,
    borderColor: theme.color.brand.accentSoft,
  },
  statCardSuccess: {
    backgroundColor: theme.color.state.success.background,
    borderWidth: 1,
    borderColor: theme.color.state.success.background,
  },
  statCardInfo: {
    backgroundColor: theme.color.state.info.background,
    borderWidth: 1,
    borderColor: theme.color.state.info.background,
  },
  statIcon: {
    fontSize: 28,
    marginBottom: theme.space[2],
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.color.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.space[1],
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
    textAlign: 'center',
  },
  statValueTablet: {
    fontSize: 22,
  },
  statSubtext: {
    fontSize: 10,
    color: theme.color.text.muted,
    marginTop: theme.space[1],
    fontWeight: '500',
    textAlign: 'center',
  },
  filtersSection: {
    marginBottom: theme.space[5],
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  filtersLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[3],
  },
  filtersLabelTablet: {
    fontSize: 16,
  },
  statCardWarning: {
    backgroundColor: theme.color.state.warning.background,
    borderWidth: 1,
    borderColor: theme.color.state.warning.background,
  },
  statCardDanger: {
    backgroundColor: theme.color.state.danger.background,
    borderWidth: 1,
    borderColor: theme.color.state.danger.background,
  },
  suppliersSection: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  suppliersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[1],
  },
  suppliersTitleTablet: {
    fontSize: 18,
  },
  suppliersSubtitle: {
    fontSize: 12,
    color: theme.color.text.muted,
    marginBottom: theme.space[4],
  },
  supplierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.space[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  supplierRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.color.brand.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  supplierRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.brand.primary,
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: theme.space[1],
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
    color: theme.color.text.muted,
    fontWeight: '500',
  },
  supplierStatSeparator: {
    fontSize: 12,
    color: theme.color.border.default,
    marginHorizontal: theme.space[1.5],
  },
  supplierPercentage: {
    paddingHorizontal: theme.space[2.5],
    paddingVertical: theme.space[1],
    backgroundColor: theme.color.brand.accentSoft,
    borderRadius: theme.radii.full,
  },
  supplierPercentageText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.brand.accent,
  },
  emptyState: {
    padding: theme.space[10],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  emptyStateIcon: {
    fontSize: 56,
    marginBottom: theme.space[3],
  },
  emptyStateText: {
    fontSize: 15,
    color: theme.color.text.muted,
    textAlign: 'center',
    fontWeight: '500',
  },
  noPermissionsContainer: {
    padding: theme.space[10],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.state.warning.background,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.state.warning.background,
  },
  noPermissionsIcon: {
    fontSize: 56,
    marginBottom: theme.space[3],
  },
  noPermissionsText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.state.warning.text,
    textAlign: 'center',
    marginBottom: theme.space[2],
  },
  noPermissionsHint: {
    fontSize: 14,
    color: theme.color.state.warning.text,
    textAlign: 'center',
  },
  // Chart styles
  chartContainer: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    marginBottom: theme.space[5],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[4],
  },
  chartTitleTablet: {
    fontSize: 18,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space[4],
  },
  modalContent: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii['2xl'],
    width: '100%',
    maxWidth: 400,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.space[5],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  modalCloseButton: {
    fontSize: 22,
    color: theme.color.text.placeholder,
    fontWeight: '600',
  },
  modalBody: {
    padding: theme.space[5],
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginBottom: theme.space[2],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: theme.space[5],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
    gap: theme.space[3],
  },
  modalCancelButton: {
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[2.5],
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.surface.muted,
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  modalApplyButton: {
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[2.5],
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.primary,
  },
  modalApplyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.onAction,
  },
  sedeModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  sedeModalItemSelected: {
    backgroundColor: theme.color.brand.accentSoft,
  },
  sedeModalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sedeModalContent: {
    maxHeight: '85%',
  },
  sedeModalScroll: {
    maxHeight: 420,
  },
  sedeModalItemIcon: {
    fontSize: 22,
    marginRight: theme.space[3],
  },
  sedeModalItemIconBadge: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.space[3],
  },
  sedeModalItemText: {
    flex: 1,
  },
  sedeModalItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: theme.space[0.5],
  },
  sedeModalItemCode: {
    fontSize: 12,
    color: theme.color.text.muted,
  },
  sedeModalItemCheck: {
    fontSize: 18,
    color: theme.color.brand.accent,
    fontWeight: '700',
  },
  // Reports styles
  reportsGrid: {
    gap: theme.space[3],
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  reportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.color.state.success.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[4],
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
    color: theme.color.text.heading,
    marginBottom: theme.space[1],
  },
  reportDescription: {
    fontSize: 12,
    color: theme.color.text.muted,
    lineHeight: 18,
  },
  reportArrow: {
    fontSize: 22,
    color: theme.color.border.default,
    marginLeft: theme.space[2],
  },
  reportsModalContent: {
    maxHeight: '90%',
  },
  reportParamSection: {
    marginBottom: theme.space[5],
  },
  reportParamLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: theme.space[2],
  },
  reportDateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.color.surface.muted,
    borderRadius: theme.radii.lg,
    padding: theme.space[3.5],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  reportDateInputText: {
    fontSize: 14,
    color: theme.color.text.heading,
    fontWeight: '500',
  },
  reportDateInputIcon: {
    fontSize: 18,
  },
  reportChipsContainer: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  reportChip: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.muted,
    borderWidth: 1.5,
    borderColor: theme.color.border.subtle,
  },
  reportChipActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  reportChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.text.muted,
  },
  reportChipTextActive: {
    color: theme.color.text.onAction,
  },
  reportCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportCheckbox: {
    width: 22,
    height: 22,
    borderRadius: theme.radii.sm,
    borderWidth: 2,
    borderColor: theme.color.border.default,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  reportCheckboxChecked: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  reportCheckboxCheck: {
    fontSize: 12,
    color: theme.color.text.onAction,
    fontWeight: '700',
  },
  reportCheckboxLabel: {
    fontSize: 14,
    color: theme.color.text.body,
    fontWeight: '500',
  },
  modalApplyButtonDisabled: {
    opacity: 0.6,
  },
});

export default DashboardScreen;
