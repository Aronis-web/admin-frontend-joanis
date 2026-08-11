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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { usePermissions } from '@/hooks/usePermissions';
import { useOnReload } from '@/hooks/useOnReload';
import { PERMISSIONS } from '@/constants/permissions';
import { apiClient, scopesApi, reportsApi } from '@/services/api';
import type { ResolvedScope, SalesProfitReport, SalesProfitRow } from '@/services/api';
import { DateRangePicker } from '@/components/DateRangePicker';
import Svg, { Line, Text as SvgText, Circle, Polyline, Path } from 'react-native-svg';
import {
  cashReconciliationApi,
  DetalleDiario,
  ResumenDiarioResponse,
  TotalesPeriodo,
} from '@/services/api/cash-reconciliation';
import { companiesApi } from '@/services/api/companies';
import { Site } from '@/types/sites';
import { useAuthStore } from '@/store/auth';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { config } from '@/utils/config';
import { authService } from '@/services/AuthService';
import { useTheme } from '@/design-system/themes';
import { useThemedStyles } from '@/design-system/themes/useThemedStyles';
import type { Theme } from '@/design-system/themes/defaultLight';
import Alert from '@/utils/alert';
import { ExternalSalesSyncModal } from '@/components/ExternalSales/ExternalSalesSyncModal';
import { IzipaySyncModal } from '@/components/IzipaySync/IzipaySyncModal';

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

interface CampaignSiteDistributionSite {
  participantId: string;
  participantType: 'INTERNAL_SITE' | 'EXTERNAL_COMPANY' | string;
  siteId?: string;
  siteName: string;
  priceProfileName?: string;
  totalPurchaseCents: number;
  totalSaleCents: number;
  marginCents: number;
  marginPercentage: number;
  totalValidatedProducts: number;
}

interface CampaignSiteDistribution {
  campaignId: string;
  campaignCode: string;
  campaignName: string;
  createdAt: string;
  totalPurchaseCents: number;
  totalSaleCents: number;
  sites: CampaignSiteDistributionSite[];
}

interface CampaignSiteDistributionResponse {
  campaigns: CampaignSiteDistribution[];
  grandTotalPurchaseCents: number;
  grandTotalSaleCents: number;
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
  const { currentCompany, currentSite, user } = useAuthStore();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [selectedFilter, setSelectedFilter] = useState<DateFilter>('today');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);

  const [purchasesSummary, setPurchasesSummary] = useState<PurchasesSummary | null>(null);
  const [purchasesGrouped, setPurchasesGrouped] = useState<PurchasesGroupedSummary | null>(null);
  const [campaignsDistribution, setCampaignsDistribution] =
    useState<CampaignSiteDistributionResponse | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [campaignsCollapsed, setCampaignsCollapsed] = useState(true);
  const [salesSummary, setSalesSummary] = useState<ResumenDiarioResponse | null>(null);
  const [salesChart, setSalesChart] = useState<ResumenDiarioResponse | null>(null);
  const [salesProfit, setSalesProfit] = useState<SalesProfitReport | null>(null);
  const [loadingSalesProfit, setLoadingSalesProfit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Sede selector states (multi-select con patrón draft + applied)
  const [sedes, setSedes] = useState<Site[]>([]);
  const [otherCompaniesGroups, setOtherCompaniesGroups] = useState<
    { companyId: string; companyName: string; sites: Site[] }[]
  >([]);
  const [selectedSedeIds, setSelectedSedeIds] = useState<string[]>([]);
  const [draftSedeIds, setDraftSedeIds] = useState<string[]>([]);
  const [loadingSedes, setLoadingSedes] = useState(false);
  const [showSedeModal, setShowSedeModal] = useState(false);
  const [salesBySedeCollapsed, setSalesBySedeCollapsed] = useState(true);
  const [showSedesWithZeroSales, setShowSedesWithZeroSales] = useState(false);

  // Lista plana de todas las sedes disponibles (empresa actual + otras empresas).
  const allAvailableSedes = useMemo<Site[]>(() => {
    const others = otherCompaniesGroups.flatMap((g) => g.sites);
    return [...sedes, ...others];
  }, [sedes, otherCompaniesGroups]);
  const allSedesSelected =
    allAvailableSedes.length > 0 && draftSedeIds.length === allAvailableSedes.length;
  const sedeKey = selectedSedeIds.slice().sort().join(',');
  // Siempre envía CSV de sedes seleccionadas (nunca vacío) para respetar permisos del usuario.
  const getSedeIdParam = useCallback((): string | undefined => {
    if (selectedSedeIds.length === 0) return undefined;
    return selectedSedeIds.length === 1 ? selectedSedeIds[0] : selectedSedeIds.join(',');
  }, [selectedSedeIds]);
  const selectedSedesLabel = useMemo(() => {
    if (allAvailableSedes.length === 0 || selectedSedeIds.length === 0) {
      return 'Sin sedes';
    }
    if (selectedSedeIds.length === allAvailableSedes.length) {
      return allAvailableSedes.length === 1
        ? allAvailableSedes[0].name
        : `Todas (${allAvailableSedes.length})`;
    }
    if (selectedSedeIds.length === 1) {
      return allAvailableSedes.find((s) => s.id === selectedSedeIds[0])?.name || '1 sede';
    }
    return `${selectedSedeIds.length} sedes`;
  }, [allAvailableSedes, selectedSedeIds]);

  // Totales agregados a partir de por_sede[].totales_periodo.
  const aggregatedSalesTotals = useMemo<TotalesPeriodo | null>(() => {
    if (!salesSummary?.por_sede?.length) return null;
    return salesSummary.por_sede.reduce<TotalesPeriodo>(
      (acc, item) => {
        const t = item.totales_periodo;
        acc.ventas_total += t.ventas_total;
        acc.ventas_efectivo += t.ventas_efectivo;
        acc.ventas_tarjeta += t.ventas_tarjeta;
        acc.ventas_cantidad += t.ventas_cantidad;
        acc.notas_credito_total += t.notas_credito_total;
        acc.notas_credito_efectivo += t.notas_credito_efectivo;
        acc.notas_credito_tarjeta += t.notas_credito_tarjeta;
        acc.notas_credito_cantidad += t.notas_credito_cantidad;
        acc.izipay_bruto += t.izipay_bruto;
        acc.izipay_comisiones += t.izipay_comisiones;
        acc.izipay_neto += t.izipay_neto;
        acc.izipay_cantidad += t.izipay_cantidad;
        acc.prosegur_depositos += t.prosegur_depositos;
        acc.prosegur_cantidad += t.prosegur_cantidad;
        acc.total_a_recibir += t.total_a_recibir;
        acc.total_comisiones += t.total_comisiones;
        acc.diferencia_total += t.diferencia_total;
        return acc;
      },
      {
        ventas_total: 0,
        ventas_efectivo: 0,
        ventas_tarjeta: 0,
        ventas_cantidad: 0,
        notas_credito_total: 0,
        notas_credito_efectivo: 0,
        notas_credito_tarjeta: 0,
        notas_credito_cantidad: 0,
        izipay_bruto: 0,
        izipay_comisiones: 0,
        izipay_neto: 0,
        izipay_cantidad: 0,
        prosegur_depositos: 0,
        prosegur_cantidad: 0,
        total_a_recibir: 0,
        total_comisiones: 0,
        diferencia_total: 0,
      }
    );
  }, [salesSummary]);

  // Detalle diario agregado entre sedes (suma de ventas y NC por fecha) para el gráfico.
  const aggregatedChartData = useMemo<DetalleDiario[]>(() => {
    const source = salesChart?.por_sede || salesSummary?.por_sede;
    if (!source || source.length === 0) return [];
    const byDate = new Map<string, DetalleDiario>();
    source.forEach((entry) => {
      entry.detalle_diario.forEach((d) => {
        const existing = byDate.get(d.fecha);
        if (!existing) {
          byDate.set(d.fecha, { ...d });
        } else {
          existing.ventas_total += d.ventas_total;
          existing.ventas_efectivo += d.ventas_efectivo;
          existing.ventas_tarjeta += d.ventas_tarjeta;
          existing.ventas_cantidad += d.ventas_cantidad;
          existing.notas_credito_total += d.notas_credito_total;
          existing.notas_credito_efectivo += d.notas_credito_efectivo;
          existing.notas_credito_tarjeta += d.notas_credito_tarjeta;
          existing.notas_credito_cantidad += d.notas_credito_cantidad;
          existing.izipay_bruto += d.izipay_bruto;
          existing.izipay_comisiones += d.izipay_comisiones;
          existing.izipay_neto += d.izipay_neto;
          existing.izipay_cantidad += d.izipay_cantidad;
          existing.prosegur_depositos += d.prosegur_depositos;
          existing.prosegur_cantidad += d.prosegur_cantidad;
          existing.total_a_recibir += d.total_a_recibir;
          existing.diferencia += d.diferencia;
        }
      });
    });
    // Fallback: si el backend no devolvió mañana, lo añadimos en cero para que hoy no quede pegado al borde.
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    if (!byDate.has(tomorrowKey)) {
      byDate.set(tomorrowKey, {
        fecha: tomorrowKey,
        ventas_total: 0,
        ventas_efectivo: 0,
        ventas_tarjeta: 0,
        ventas_cantidad: 0,
        notas_credito_total: 0,
        notas_credito_efectivo: 0,
        notas_credito_tarjeta: 0,
        notas_credito_cantidad: 0,
        izipay_bruto: 0,
        izipay_comisiones: 0,
        izipay_neto: 0,
        izipay_cantidad: 0,
        prosegur_depositos: 0,
        prosegur_cantidad: 0,
        total_a_recibir: 0,
        diferencia: 0,
      });
    }
    return Array.from(byDate.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [salesChart, salesSummary]);

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
  const canViewExternalSalesSync =
    hasPermission(PERMISSIONS.ADMIN.EXTERNAL_SALES.RUNS_READ) ||
    hasPermission(PERMISSIONS.ADMIN.EXTERNAL_SALES.SYNC) ||
    hasPermission(PERMISSIONS.ADMIN.EXTERNAL_SALES.SOURCES_WRITE);
  const [showExternalSalesSyncModal, setShowExternalSalesSyncModal] = useState(false);
  const canViewIzipaySync =
    hasPermission(PERMISSIONS.ADMIN.IZIPAY_SYNC.RUNS_READ) ||
    hasPermission(PERMISSIONS.ADMIN.IZIPAY_SYNC.SYNC);
  const [showIzipaySyncModal, setShowIzipaySyncModal] = useState(false);
  const [downloadingSedeSummary, setDownloadingSedeSummary] = useState(false);

  // Modal previo a la descarga del resumen por sede: permite incluir la
  // información opcional de campañas seleccionadas debajo del reporte.
  const [showSedeReportModal, setShowSedeReportModal] = useState(false);
  const [sedeReportIncludeCampaigns, setSedeReportIncludeCampaigns] = useState(false);
  const [sedeReportSelectedCampaignIds, setSedeReportSelectedCampaignIds] = useState<string[]>([]);

  // Load sedes when company changes
  useEffect(() => {
    if (currentCompany?.id) {
      loadSedes();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    console.log(
      '🔍 Dashboard useEffect - canViewPurchases:',
      canViewPurchases,
      'canViewSales:',
      canViewSales,
      'selectedFilter:',
      selectedFilter,
      'selectedSedeIds:',
      selectedSedeIds
    );

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
        // Gráfico (puede usar rango distinto si el período < 7 días)
        loadSalesChart();
        // Utilidad de ventas (COGS)
        loadSalesProfit();
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
            loadPurchasesGrouped(),
            loadCampaignsDistribution(),
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
        start = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate(),
          0,
          0,
          0
        );
        end = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate(),
          23,
          59,
          59
        );
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
        start = new Date(
          customStartDate.getFullYear(),
          customStartDate.getMonth(),
          customStartDate.getDate(),
          0,
          0,
          0
        );
        end = new Date(
          customEndDate.getFullYear(),
          customEndDate.getMonth(),
          customEndDate.getDate(),
          23,
          59,
          59
        );
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
      console.log('📅 Loading purchases summary:', {
        startDate,
        endDate,
        filter: selectedFilter,
        sedeId: sedeIdParam,
      });

      if (!sedeIdParam) {
        console.warn('⚠️ Sin sedes seleccionadas — omitiendo petición de compras.');
        return;
      }

      // El backend espera parámetros en camelCase (startDate/endDate).
      // Enviarlos como fecha_inicio/fecha_fin hace que los ignore y devuelva
      // siempre el acumulado del año (bug del "monto fijo ~16M" en el dashboard).
      const params: any = {
        startDate,
        endDate,
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
      if (
        selectedFilter === 'today' ||
        selectedFilter === 'yesterday' ||
        selectedFilter === 'week'
      ) {
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

      // Backend espera camelCase (startDate/endDate); ver nota en loadPurchasesSummary.
      const params: any = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        groupBy,
      };

      const sedeIdParam = getSedeIdParam();
      if (!sedeIdParam) {
        console.warn('⚠️ Sin sedes seleccionadas — omitiendo petición de compras agrupadas.');
        return;
      }
      params.sede_id = sedeIdParam;

      console.log('📊 Loading purchases grouped:', {
        startDate: params.startDate,
        endDate: params.endDate,
        groupBy: params.groupBy,
        filter: selectedFilter,
        sedeId: sedeIdParam,
      });

      const data = await apiClient.get<PurchasesGroupedSummary>(
        '/admin/purchases/summary/grouped',
        {
          params,
        }
      );

      console.log('✅ Purchases grouped loaded:', data);
      setPurchasesGrouped(data);
    } catch (err: any) {
      console.error('❌ Error loading purchases grouped:', err);
      // No mostramos error aquí para no interferir con el resumen principal
    }
  };

  const loadCampaignsDistribution = async () => {
    try {
      setLoadingCampaigns(true);
      setCampaignsError(null);
      const data = await apiClient.get<CampaignSiteDistributionResponse>(
        '/admin/campaigns/dashboard/site-distribution',
        { params: { limit: 25 } }
      );
      setCampaignsDistribution(data);
    } catch (err: any) {
      console.error('❌ Error loading campaigns distribution:', err);
      setCampaignsError(
        err.response?.data?.message || 'Error al cargar la distribución de campañas'
      );
      setCampaignsDistribution(null);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const loadSedes = async () => {
    try {
      setLoadingSedes(true);

      if (!currentCompany?.id) {
        console.warn('No hay empresa seleccionada');
        setSedes([]);
        setOtherCompaniesGroups([]);
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

      // Cargar scopes del usuario una sola vez: sirve para filtrar la empresa actual y
      // para descubrir las sedes accesibles en otras empresas.
      let userScopes: ResolvedScope[] = [];
      if (user?.id) {
        try {
          const scopesResponse = await scopesApi.getUserResolvedScopes(user.id, config.APP_ID, {
            limit: 1000,
          });
          userScopes = Array.isArray(scopesResponse)
            ? scopesResponse
            : (scopesResponse as any)?.items || [];
        } catch (scopeError) {
          console.error('Error cargando scopes del usuario:', scopeError);
        }
      }

      // Filtrar por scopes del usuario (mismo criterio que SiteSelectionScreen al hacer login).
      let permittedSites = companySites;
      if (userScopes.length > 0) {
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
      }

      // Orden alfabético por nombre (es) para la lista de la empresa actual.
      const sortedCurrent = [...permittedSites].sort((a, b) =>
        a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
      );

      console.log('✅ Sedes permitidas:', sortedCurrent.length, 'de', companySites.length);
      setSedes(sortedCurrent);
      // Por defecto seleccionar solo la sede del login (currentSite); si no está permitida, caer a la primera.
      const allIds = sortedCurrent.map((s) => s.id);
      const defaultIds =
        currentSite?.id && allIds.includes(currentSite.id)
          ? [currentSite.id]
          : allIds.length > 0
            ? [allIds[0]]
            : [];
      setSelectedSedeIds(defaultIds);
      setDraftSedeIds(defaultIds);

      // Cargar sedes de otras empresas a las que el usuario tenga acceso (solo lectura).
      const otherCompaniesInfo = new Map<
        string,
        { name: string; siteIds: Set<string>; hasCompanyLevel: boolean }
      >();
      userScopes.forEach((s) => {
        if (!s.companyId || s.companyId === currentCompany.id) return;
        const existing = otherCompaniesInfo.get(s.companyId) || {
          name: s.company?.name || s.company_name || 'Otra empresa',
          siteIds: new Set<string>(),
          hasCompanyLevel: false,
        };
        if (s.level === 'COMPANY') existing.hasCompanyLevel = true;
        if (s.level === 'SITE' && s.siteId) existing.siteIds.add(s.siteId);
        otherCompaniesInfo.set(s.companyId, existing);
      });

      const otherGroups: { companyId: string; companyName: string; sites: Site[] }[] = [];
      await Promise.all(
        Array.from(otherCompaniesInfo.entries()).map(async ([companyId, info]) => {
          try {
            const resp = await companiesApi.getCompanySites(companyId, {
              limit: 100,
              isActive: true,
            });
            const sites = resp.data || [];
            const permitted = info.hasCompanyLevel
              ? sites
              : sites.filter((s) => info.siteIds.has(s.id));
            if (permitted.length === 0) return;
            const sorted = [...permitted].sort((a, b) =>
              a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
            );
            otherGroups.push({ companyId, companyName: info.name, sites: sorted });
          } catch (e) {
            console.error(`Error cargando sedes de empresa ${companyId}:`, e);
          }
        })
      );

      otherGroups.sort((a, b) => a.companyName.localeCompare(b.companyName, 'es'));
      setOtherCompaniesGroups(otherGroups);
    } catch (error) {
      console.error('Error loading sedes:', error);
      setSedes([]);
      setOtherCompaniesGroups([]);
      setSelectedSedeIds([]);
      setDraftSedeIds([]);
    } finally {
      setLoadingSedes(false);
    }
  };

  // Helper para renderizar una sección de empresa (header + lista de sedes seleccionables).
  const renderSedeCompanySection = (opts: {
    key?: string;
    iconName: React.ComponentProps<typeof Ionicons>['name'];
    iconColor: string;
    title: string;
    sites: Site[];
    headerStyle?: object;
  }) => {
    const sectionIds = opts.sites.map((s) => s.id);
    const sectionAllSelected =
      sectionIds.length > 0 && sectionIds.every((id) => draftSedeIds.includes(id));
    return (
      <View key={opts.key}>
        <View style={[styles.sedeSectionHeader, opts.headerStyle]}>
          <Ionicons name={opts.iconName} size={14} color={opts.iconColor} />
          <Text style={styles.sedeSectionHeaderText} numberOfLines={1}>
            {opts.title}
          </Text>
          <View style={styles.sedeSectionBadge}>
            <Text style={styles.sedeSectionBadgeText}>{opts.sites.length}</Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              setDraftSedeIds((prev) =>
                sectionAllSelected
                  ? prev.filter((id) => !sectionIds.includes(id))
                  : Array.from(new Set([...prev, ...sectionIds]))
              )
            }
            style={styles.sedeSectionToggle}
            activeOpacity={0.7}
          >
            <Text style={styles.sedeSectionToggleText}>
              {sectionAllSelected ? 'Quitar todas' : 'Marcar todas'}
            </Text>
          </TouchableOpacity>
        </View>
        {opts.sites.map((sede) => {
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
                  <Text style={styles.sedeModalItemName} numberOfLines={1}>
                    {sede.name}
                  </Text>
                  {sede.code && <Text style={styles.sedeModalItemCode}>Código: {sede.code}</Text>}
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
      </View>
    );
  };

  const loadSalesSummary = async () => {
    try {
      setLoadingSales(true);
      setSalesError(null);

      const { startDate, endDate } = getDateRange(selectedFilter);
      const sedeIdParam = getSedeIdParam();
      console.log('📅 Loading sales summary:', {
        startDate,
        endDate,
        filter: selectedFilter,
        sedeId: sedeIdParam,
      });

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

  // Rango para el gráfico: si el período seleccionado es menor a 7 días,
  // expande a los últimos 7 días. Siempre extiende hasta mañana para que el punto de hoy
  // no quede pegado al borde derecho y la etiqueta no se corte.
  const getSalesChartDateRange = (): { startDate: string; endDate: string } => {
    const { startDate, endDate } = getDateRange(selectedFilter);
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const parseLocal = (s: string): Date => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y || 1970, (m || 1) - 1, d || 1);
    };
    const start = parseLocal(startDate);
    const end = parseLocal(endDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays < 7) {
      const newStart = new Date(today);
      newStart.setDate(today.getDate() - 6);
      return { startDate: formatDate(newStart), endDate: formatDate(tomorrow) };
    }
    // Si el rango llega a hoy (o más allá), agrega un día extra para que hoy no quede pegado al borde.
    if (end.getTime() >= today.getTime()) {
      return { startDate, endDate: formatDate(tomorrow) };
    }
    return { startDate, endDate };
  };

  const loadSalesChart = async () => {
    try {
      const sedeIdParam = getSedeIdParam();
      if (!sedeIdParam) return;

      const { startDate, endDate } = getSalesChartDateRange();
      const params: any = {
        fecha_inicio: startDate,
        fecha_fin: endDate,
        sede_id: sedeIdParam,
      };

      console.log('📊 Loading sales chart:', { startDate, endDate, sedeId: sedeIdParam });
      const data = await cashReconciliationApi.getResumenDiario(params);
      console.log('✅ Sales chart loaded:', data);
      setSalesChart(data);
    } catch (err: any) {
      console.error('❌ Error loading sales chart:', err);
    }
  };

  const loadSalesProfit = async () => {
    try {
      setLoadingSalesProfit(true);

      const sedeIdParam = getSedeIdParam();
      if (!sedeIdParam) {
        setSalesProfit(null);
        return;
      }

      const { startDate, endDate } = getDateRange(selectedFilter);
      const data = await reportsApi.getSalesProfit({
        from: startDate,
        to: endDate,
        siteId: sedeIdParam,
        groupBy: 'site',
      });
      setSalesProfit(data);
    } catch (err: any) {
      console.error('❌ Error loading sales profit:', err);
      setSalesProfit(null);
    } finally {
      setLoadingSalesProfit(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const promises = [];

    if (canViewPurchases) {
      promises.push(loadPurchasesSummary(), loadPurchasesGrouped(), loadCampaignsDistribution());
    }

    if (canViewSales) {
      promises.push(loadSalesSummary(), loadSalesChart(), loadSalesProfit());
    }

    await Promise.all(promises);
    setRefreshing(false);
  };

  // Botón universal de recarga: reutiliza handleRefresh manteniendo filtros
  // (fechas, sede seleccionada, etc.) sin cambiar de ruta. Incluye sedes.
  useOnReload(async () => {
    await Promise.allSettled([loadSedes(), handleRefresh()]);
  });

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
            Authorization: `Bearer ${token}`,
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
            Authorization: `Bearer ${token}`,
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

  const formatCampaignDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  // Renderiza una tabla con sedes (filas) x campañas (columnas) mostrando
  // la mercadería repartida (totalPurchaseCents). La primer columna con el
  // nombre de sede queda fija; las columnas de campañas hacen scroll horizontal.
  const renderCampaignsDistributionTable = (data: CampaignSiteDistributionResponse) => {
    const campaignsRaw = data.campaigns || [];
    if (campaignsRaw.length === 0) return null;

    // Ordenar campañas por fecha descendente (la más reciente a la izquierda).
    const campaigns = [...campaignsRaw].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // IMPORTANTE: participantId NO es estable entre campañas para la misma sede
    // (el backend crea uno nuevo por campaña). Consolidamos filas por siteId
    // (INTERNAL_SITE) o por nombre para EXTERNAL_COMPANY. Sin esto la tabla
    // salía con filas duplicadas y desalineadas.
    const siteKey = (s: CampaignSiteDistributionSite) =>
      s.siteId ? `int:${s.siteId}` : `ext:${(s.siteName || '').trim().toLowerCase()}`;

    const siteMap = new Map<
      string,
      {
        key: string;
        name: string;
        type: 'INTERNAL_SITE' | 'EXTERNAL_COMPANY' | string;
        priceProfileName?: string;
        rowTotalCents: number;
      }
    >();
    const cellIndex = new Map<string, CampaignSiteDistributionSite>();
    campaigns.forEach((c) => {
      c.sites.forEach((s) => {
        const k = siteKey(s);
        cellIndex.set(`${k}__${c.campaignId}`, s);
        const existing = siteMap.get(k);
        if (existing) {
          existing.rowTotalCents += s.totalPurchaseCents || 0;
        } else {
          siteMap.set(k, {
            key: k,
            name: s.siteName,
            type: s.participantType,
            priceProfileName: s.priceProfileName,
            rowTotalCents: s.totalPurchaseCents || 0,
          });
        }
      });
    });

    // Ordenar: sedes internas primero (por nombre), luego externas (por nombre).
    const rows = Array.from(siteMap.values()).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'INTERNAL_SITE' ? -1 : 1;
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });

    const CELL_WIDTH = isTablet ? 140 : 120;
    const SEDE_COL_WIDTH = isTablet ? 210 : 160;
    const HEADER_HEIGHT = 68;
    const BODY_ROW_HEIGHT = 60;

    return (
      <View style={styles.campaignsTableWrapper}>
        <View style={styles.campaignsTableRow}>
          {/* Columna fija: sedes */}
          <View style={{ width: SEDE_COL_WIDTH }}>
            <View
              style={[
                styles.campaignsHeaderCell,
                styles.campaignsSedeCell,
                { width: SEDE_COL_WIDTH, height: HEADER_HEIGHT },
              ]}
            >
              <Text style={styles.campaignsHeaderText}>Sede</Text>
              <Text style={styles.campaignsHeaderSubtext}>Perfil de precio</Text>
            </View>
            {rows.map((r) => (
              <View
                key={r.key}
                style={[
                  styles.campaignsBodyCell,
                  styles.campaignsSedeCell,
                  { width: SEDE_COL_WIDTH, height: BODY_ROW_HEIGHT },
                ]}
              >
                <View style={styles.campaignsSedeRow}>
                  <View
                    style={[
                      styles.campaignsTypeBadge,
                      r.type === 'INTERNAL_SITE'
                        ? styles.campaignsTypeBadgeInternal
                        : styles.campaignsTypeBadgeExternal,
                    ]}
                  >
                    <Text style={styles.campaignsTypeBadgeText}>
                      {r.type === 'INTERNAL_SITE' ? 'INT' : 'EXT'}
                    </Text>
                  </View>
                  <View style={styles.campaignsSedeTextWrap}>
                    <Text style={styles.campaignsSedeName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    {r.priceProfileName ? (
                      <Text style={styles.campaignsSedeMeta} numberOfLines={1}>
                        {r.priceProfileName}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
            {/* Total campaña */}
            <View
              style={[
                styles.campaignsBodyCell,
                styles.campaignsSedeCell,
                styles.campaignsTotalRow,
                { width: SEDE_COL_WIDTH, height: BODY_ROW_HEIGHT },
              ]}
            >
              <Text style={styles.campaignsTotalLabel}>Total campaña</Text>
            </View>
          </View>

          {/* Columnas scrollables: campañas */}
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              {/* Header row de campañas */}
              <View style={{ flexDirection: 'row', height: HEADER_HEIGHT }}>
                {campaigns.map((c) => (
                  <View
                    key={c.campaignId}
                    style={[
                      styles.campaignsHeaderCell,
                      { width: CELL_WIDTH, height: HEADER_HEIGHT },
                    ]}
                  >
                    <Text style={styles.campaignsHeaderText} numberOfLines={1}>
                      {c.campaignName || c.campaignCode}
                    </Text>
                    <Text style={styles.campaignsHeaderSubtext} numberOfLines={1}>
                      {c.campaignCode}
                    </Text>
                    <Text style={styles.campaignsHeaderDate}>
                      {formatCampaignDate(c.createdAt)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Filas por sede */}
              {rows.map((r) => (
                <View key={r.key} style={{ flexDirection: 'row', height: BODY_ROW_HEIGHT }}>
                  {campaigns.map((c) => {
                    const cell = cellIndex.get(`${r.key}__${c.campaignId}`);
                    return (
                      <View
                        key={c.campaignId}
                        style={[
                          styles.campaignsBodyCell,
                          { width: CELL_WIDTH, height: BODY_ROW_HEIGHT },
                        ]}
                      >
                        {cell && (cell.totalPurchaseCents || 0) > 0 ? (
                          <>
                            <Text style={styles.campaignsCellValue} numberOfLines={1}>
                              {formatCurrency((cell.totalPurchaseCents || 0) / 100)}
                            </Text>
                            <Text style={styles.campaignsCellMeta} numberOfLines={1}>
                              {cell.totalValidatedProducts} prod.
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.campaignsCellEmpty}>—</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}

              {/* Totales por campaña */}
              <View style={{ flexDirection: 'row', height: BODY_ROW_HEIGHT }}>
                {campaigns.map((c) => (
                  <View
                    key={c.campaignId}
                    style={[
                      styles.campaignsBodyCell,
                      styles.campaignsTotalRow,
                      { width: CELL_WIDTH, height: BODY_ROW_HEIGHT },
                    ]}
                  >
                    <Text style={styles.campaignsTotalValue} numberOfLines={1}>
                      {formatCurrency((c.totalPurchaseCents || 0) / 100)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Gran total */}
        <View style={styles.campaignsGrandTotalRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.campaignsGrandTotalLabel}>Gran total mercadería repartida</Text>
            <Text style={styles.campaignsGrandTotalHint}>
              {rows.length} {rows.length === 1 ? 'sede' : 'sedes'} · {campaigns.length}{' '}
              {campaigns.length === 1 ? 'campaña' : 'campañas'}
            </Text>
          </View>
          <Text style={styles.campaignsGrandTotalValue}>
            {formatCurrency((data.grandTotalPurchaseCents || 0) / 100)}
          </Text>
        </View>
      </View>
    );
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

  // Parsea YYYY-MM-DD como fecha LOCAL (evita el shift de UTC en zonas como PE -05:00).
  const parseLocalDate = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y || 1970, (m || 1) - 1, d || 1);
  };

  const formatDateShort = (dateStr: string): string => {
    const date = parseLocalDate(dateStr);
    const months = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  const formatDateLong = (dateStr: string): string => {
    const date = parseLocalDate(dateStr);
    const months = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
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

    const maxValue = Math.max(...data.map((d) => d.totalValidated), 1);
    const pointSpacing = Math.max(graphWidth / (data.length - 1 || 1), 40);
    const totalWidth = Math.max(
      chartWidth,
      (data.length - 1) * pointSpacing + padding.left + padding.right
    );

    // Generar puntos para la línea
    const points = data.map((item, index) => {
      const x = padding.left + index * pointSpacing;
      const y = padding.top + graphHeight - (item.totalValidated / maxValue) * graphHeight;
      return { x, y, item };
    });

    // Crear path para la línea
    const linePath = points
      .map((point, index) => {
        if (index === 0) {
          return `M ${point.x} ${point.y}`;
        }
        return `L ${point.x} ${point.y}`;
      })
      .join(' ');

    // Crear path para el área bajo la línea (gradiente)
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${padding.left} ${padding.top + graphHeight} Z`;

    return (
      <View style={styles.chartContainer}>
        <Text style={[styles.chartTitle, isTablet && styles.chartTitleTablet]}>{title}</Text>
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
            <Path d={areaPath} fill={color} fillOpacity="0.1" />

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
                  {point.item.label.length > 10
                    ? point.item.label.substring(0, 10) + '...'
                    : point.item.label}
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

  /**
   * Genera un PDF del resumen por sede con evidencia de auditoría
   * (usuario que descarga, fecha y hora). Web: usa window.print del popup;
   * nativo/Electron: usa expo-print + Sharing.
   */
  const handleDownloadSedeSummaryPdf = async () => {
    if (!salesSummary || !salesSummary.por_sede || salesSummary.por_sede.length === 0) return;
    setDownloadingSedeSummary(true);
    // Snapshot inmutable de las opciones seleccionadas en el modal (por si el
    // usuario cambia algo antes de que termine la generación del PDF).
    const includeCampaigns = sedeReportIncludeCampaigns;
    const selectedCampaigns =
      includeCampaigns && campaignsDistribution
        ? campaignsDistribution.campaigns.filter((c) =>
            sedeReportSelectedCampaignIds.includes(c.campaignId)
          )
        : [];
    try {
      const rows = [...salesSummary.por_sede].sort((a, b) => {
        const aNet = a.totales_periodo.ventas_total - a.totales_periodo.notas_credito_total;
        const bNet = b.totales_periodo.ventas_total - b.totales_periodo.notas_credito_total;
        const aZero = aNet <= 0;
        const bZero = bNet <= 0;
        if (aZero !== bZero) return aZero ? 1 : -1;
        if (!aZero) return bNet - aNet;
        return a.sede.name.localeCompare(b.sede.name, 'es', { sensitivity: 'base' });
      });
      const visibleRows = showSedesWithZeroSales
        ? rows
        : rows.filter(
            (r) => r.totales_periodo.ventas_total - r.totales_periodo.notas_credito_total > 0
          );

      const fmt = (n: number) =>
        new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n);
      const escapeHtml = (s: string) =>
        String(s ?? '').replace(/[&<>"']/g, (c) =>
          c === '&'
            ? '&amp;'
            : c === '<'
              ? '&lt;'
              : c === '>'
                ? '&gt;'
                : c === '"'
                  ? '&quot;'
                  : '&#39;'
        );

      const now = new Date();
      const downloadedAt = now.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const userLabel = user
        ? `${escapeHtml(user.name || user.username || '—')}${user.email ? ` (${escapeHtml(user.email)})` : ''}`
        : '—';
      const companyLabel = escapeHtml(currentCompany?.name || '—');
      const rangeLabel = `${formatDateShort(salesSummary.fecha_inicio)} – ${formatDateLong(salesSummary.fecha_fin)}`;

      let totalPagarSoles = 0;
      const bodyRowsHtml = visibleRows
        .map((row) => {
          const t = row.totales_periodo;
          const netas = t.ventas_total - t.notas_credito_total;
          const dif = t.diferencia_total ?? 0;
          const difClass = Math.abs(dif) < 0.005 ? 'muted' : dif < 0 ? 'negative' : 'positive';
          const isExt = isExternalSede(row.sede);
          const pagar = computeMontoAPagar(netas, isExt);
          totalPagarSoles += pagar;
          const payHint = isExt
            ? '<div class="sede-code">EXT ÷ 1.15</div>'
            : '<div class="sede-code">INT · sin dscto.</div>';
          return `
            <tr>
              <td class="sede">
                <div class="sede-name">${escapeHtml(row.sede.name)}</div>
                ${row.sede.code ? `<div class="sede-code">${escapeHtml(row.sede.code)}</div>` : ''}
              </td>
              <td class="num">${fmt(t.ventas_total)}</td>
              <td class="num negative">${fmt(t.notas_credito_total)}</td>
              <td class="num strong">${fmt(netas)}</td>
              <td class="num">${fmt(t.izipay_neto)}</td>
              <td class="num">${fmt(t.prosegur_depositos)}</td>
              <td class="num strong">${fmt(t.total_a_recibir)}</td>
              <td class="num ${difClass}">${fmt(dif)}</td>
              <td class="num strong pay">${fmt(pagar)}${payHint}</td>
            </tr>`;
        })
        .join('');

      const totalsHtml = aggregatedSalesTotals
        ? `
        <tr class="totals">
          <td class="sede">TOTAL</td>
          <td class="num">${fmt(aggregatedSalesTotals.ventas_total)}</td>
          <td class="num negative">${fmt(aggregatedSalesTotals.notas_credito_total)}</td>
          <td class="num strong">${fmt(aggregatedSalesTotals.ventas_total - aggregatedSalesTotals.notas_credito_total)}</td>
          <td class="num">${fmt(aggregatedSalesTotals.izipay_neto)}</td>
          <td class="num">${fmt(aggregatedSalesTotals.prosegur_depositos)}</td>
          <td class="num strong">${fmt(aggregatedSalesTotals.total_a_recibir)}</td>
          <td class="num">${fmt(aggregatedSalesTotals.diferencia_total ?? 0)}</td>
          <td class="num strong pay">${fmt(totalPagarSoles)}</td>
        </tr>`
        : '';

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Resumen por Sede</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 24px; }
  h1 { margin: 0 0 4px 0; font-size: 20px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 4px; }
  .audit { margin-top: 12px; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #f9fafb; font-size: 11px; color: #374151; }
  .audit b { color: #111; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
  thead th { background: #f3f4f6; color: #111; font-weight: 700; padding: 8px 6px; border-bottom: 2px solid #d1d5db; text-align: right; }
  thead th.left { text-align: left; }
  tbody td { padding: 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  td.sede { text-align: left; max-width: 220px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.strong { font-weight: 700; }
  td.negative { color: #b91c1c; }
  td.positive { color: #047857; }
  td.muted { color: #6b7280; }
  .sede-name { font-weight: 600; }
  .sede-code { font-size: 10px; color: #6b7280; margin-top: 2px; }
  tr.totals td { background: #eef2ff; font-weight: 700; border-top: 2px solid #6366f1; border-bottom: 2px solid #6366f1; }
  td.pay, th.pay { background: #f5f3ff; border-left: 2px solid #7c3aed; }
  td.num.pay { color: #6d28d9; }
  .badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; letter-spacing: 0.5px; vertical-align: middle; }
  .badge-int { background: #dbeafe; color: #1d4ed8; }
  .badge-ext { background: #fef3c7; color: #b45309; }
  h3 { color: #111; }
  .footer { margin-top: 24px; font-size: 10px; color: #6b7280; text-align: center; }
</style>
</head>
<body>
  <h1>Resumen por Sede</h1>
  <div class="meta"><b>Empresa:</b> ${companyLabel}</div>
  <div class="meta"><b>Período:</b> ${escapeHtml(rangeLabel)}</div>
  <div class="meta"><b>Filtro sedes:</b> ${showSedesWithZeroSales ? 'Incluye sedes sin ventas' : 'Sólo sedes con ventas'} · Sedes mostradas: ${visibleRows.length}</div>

  <div class="audit">
    <div><b>Evidencia de descarga</b></div>
    <div>Descargado por: <b>${userLabel}</b></div>
    <div>Fecha y hora: <b>${escapeHtml(downloadedAt)}</b></div>
    <div>Generado por el sistema en: <b>${escapeHtml(formatDateTimeGenerated(salesSummary.generado_en))}</b></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="left">Sede</th>
        <th>Ventas</th>
        <th>NC</th>
        <th>V. Netas</th>
        <th>Izipay Neto</th>
        <th>Prosegur</th>
        <th>A Recibir</th>
        <th>Diferencia</th>
        <th class="pay">Monto a pagar</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRowsHtml}
      ${totalsHtml}
    </tbody>
  </table>

  ${(() => {
    if (selectedCampaigns.length === 0) return '';
    let grandTotalRepartidoCents = 0;
    const perCampaignTables = selectedCampaigns
      .map((c) => {
        // Orden estable: sedes internas primero, luego externas, alfabético.
        const sortedSites = [...(c.sites || [])].sort((a, b) => {
          if (a.participantType !== b.participantType)
            return a.participantType === 'INTERNAL_SITE' ? -1 : 1;
          return (a.siteName || '').localeCompare(b.siteName || '', 'es', {
            sensitivity: 'base',
          });
        });
        let campaignRepartidoCents = 0;
        const rowsHtml = sortedSites
          .map((s) => {
            const repartidoSoles = (s.totalPurchaseCents || 0) / 100;
            campaignRepartidoCents += s.totalPurchaseCents || 0;
            const isExt = s.participantType === 'EXTERNAL_COMPANY';
            const badge = isExt
              ? '<span class="badge badge-ext">EXT</span>'
              : '<span class="badge badge-int">INT</span>';
            const profile = s.priceProfileName
              ? `<div class="sede-code">${escapeHtml(s.priceProfileName)}</div>`
              : '';
            return `
        <tr>
          <td class="sede">${badge}<div class="sede-name" style="display:inline-block;margin-left:6px;">${escapeHtml(s.siteName || '—')}</div>${profile}</td>
          <td class="num">${s.totalValidatedProducts ?? 0}</td>
          <td class="num strong">${fmt(repartidoSoles)}</td>
        </tr>`;
          })
          .join('');
        grandTotalRepartidoCents += campaignRepartidoCents;
        return `
  <h3 style="margin-top:20px;margin-bottom:4px;font-size:14px;">${escapeHtml(c.campaignName || c.campaignCode || '—')}</h3>
  <div class="meta"><b>Código:</b> ${escapeHtml(c.campaignCode || '—')} · <b>Fecha:</b> ${escapeHtml(formatCampaignDate(c.createdAt))} · <b>Sedes:</b> ${sortedSites.length}</div>
  <table>
    <thead>
      <tr>
        <th class="left">Sede</th>
        <th>Productos</th>
        <th>Monto repartido</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td class="sede" colspan="3"><i>Sin sedes con mercadería.</i></td></tr>'}
      <tr class="totals">
        <td class="sede">Subtotal campaña</td>
        <td class="num">—</td>
        <td class="num strong">${fmt(campaignRepartidoCents / 100)}</td>
      </tr>
    </tbody>
  </table>`;
      })
      .join('');
    return `
  <h2 style="margin-top:28px;margin-bottom:4px;font-size:16px;">📦 Campañas incluidas · detalle por sede</h2>
  <div class="meta">Mercadería repartida en cada sede para cada campaña seleccionada.</div>
  ${perCampaignTables}
  <table style="margin-top:16px;">
    <thead>
      <tr>
        <th class="left">Consolidado</th>
        <th>Campañas</th>
        <th>Monto repartido</th>
      </tr>
    </thead>
    <tbody>
      <tr class="totals">
        <td class="sede">TOTAL GENERAL</td>
        <td class="num">${selectedCampaigns.length}</td>
        <td class="num strong">${fmt(grandTotalRepartidoCents / 100)}</td>
      </tr>
    </tbody>
  </table>`;
  })()}

  <div class="footer">Reporte generado desde el panel admin — ${escapeHtml(downloadedAt)}</div>
</body>
</html>`;

      const fileName = `resumen-por-sede-${salesSummary.fecha_inicio}_${salesSummary.fecha_fin}.pdf`;

      if (Platform.OS === 'web') {
        // Web / Electron: iframe oculto → print() (evita popup blockers).
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);

        const cleanup = () => {
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch {
              /* noop */
            }
          }, 1000);
        };

        iframe.onload = () => {
          try {
            const win = iframe.contentWindow;
            if (!win) return;
            // Esperamos un tick a que el layout se estabilice.
            setTimeout(() => {
              try {
                win.focus();
                win.print();
              } catch (err) {
                console.error('Error al invocar print en iframe:', err);
              }
              cleanup();
            }, 200);
          } catch (err) {
            console.error('Error accediendo al iframe:', err);
            cleanup();
          }
        };

        // Escribimos el HTML directamente (más fiable que srcdoc en Electron).
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
        } else {
          Alert.alert('Error', 'No se pudo preparar el documento para imprimir.');
          cleanup();
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          const targetUri = `${FileSystem.cacheDirectory ?? ''}${fileName}`;
          try {
            await FileSystem.moveAsync({ from: uri, to: targetUri });
            await Sharing.shareAsync(targetUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Resumen por Sede',
              UTI: 'com.adobe.pdf',
            });
          } catch (err) {
            // Fallback: compartir el URI original si el rename falla.
            console.warn('Fallback share por rename fallido:', err);
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Resumen por Sede',
              UTI: 'com.adobe.pdf',
            });
          }
        } else {
          Alert.alert('PDF generado', `Archivo en: ${uri}`);
        }
      }
    } catch (err) {
      console.error('Error generando PDF resumen por sede:', err);
      Alert.alert('Error', 'No se pudo generar el PDF del resumen por sede.');
    } finally {
      setDownloadingSedeSummary(false);
    }
  };

  const formatDateTimeGenerated = (iso?: string): string => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  // Divisor de "Monto a pagar" para sedes EXTERNAL_COMPANY (descuento IGV).
  const EXTERNAL_PAY_DIVISOR = 1.15;

  // Identifica sedes externas. En este backend, las sedes que representan
  // empresas externas tienen como `code` el RUC de la empresa (11 dígitos
  // numéricos), mientras que las sedes internas usan códigos alfabéticos
  // (SJL, COMAS, ATE, AREQUIPA, ALMACEN, etc.). Ese es el discriminador
  // más confiable disponible desde el resumen de ventas.
  const RUC_REGEX = /^\d{11}$/;
  const isExternalSede = (sede: { id?: string; code?: string; name?: string }) => {
    return !!(sede.code && RUC_REGEX.test(sede.code));
  };

  const computeMontoAPagar = (ventasNetas: number, external: boolean) =>
    external ? ventasNetas / EXTERNAL_PAY_DIVISOR : ventasNetas;

  const renderSalesBySedeTable = () => {
    if (!salesSummary || !salesSummary.por_sede || salesSummary.por_sede.length === 0) {
      return null;
    }

    // Índice de utilidad por siteId para inyectar en cada fila de la tabla de sedes.
    const profitBySiteId = new Map<string, SalesProfitRow>();
    (salesProfit?.rows || []).forEach((r) => {
      if (r.siteId) profitBySiteId.set(r.siteId, r);
    });

    // Orden: sedes con ventas > 0 primero (desc por ventas netas), luego las de 0 ventas (alfabético).
    const rows = [...salesSummary.por_sede].sort((a, b) => {
      const aNet = a.totales_periodo.ventas_total - a.totales_periodo.notas_credito_total;
      const bNet = b.totales_periodo.ventas_total - b.totales_periodo.notas_credito_total;
      const aZero = aNet <= 0;
      const bZero = bNet <= 0;
      if (aZero !== bZero) return aZero ? 1 : -1;
      if (!aZero) return bNet - aNet;
      return a.sede.name.localeCompare(b.sede.name, 'es', { sensitivity: 'base' });
    });
    const sedesConVentas = rows.filter(
      (r) => r.totales_periodo.ventas_total - r.totales_periodo.notas_credito_total > 0
    ).length;
    const sedesSinVentas = rows.length - sedesConVentas;
    const visibleRows = showSedesWithZeroSales
      ? rows
      : rows.filter(
          (r) => r.totales_periodo.ventas_total - r.totales_periodo.notas_credito_total > 0
        );

    // Total consolidado del "Monto a pagar" respetando INT/EXT por sede.
    const totalMontoAPagar = visibleRows.reduce((acc, r) => {
      const netas = r.totales_periodo.ventas_total - r.totales_periodo.notas_credito_total;
      return acc + computeMontoAPagar(netas, isExternalSede(r.sede));
    }, 0);

    return (
      <View style={styles.sedeTableContainer}>
        <View style={styles.sedeTableHeader}>
          <TouchableOpacity
            style={styles.sedeTableHeaderText}
            onPress={() => setSalesBySedeCollapsed((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.sedeTableTitle, isTablet && styles.sedeTableTitleTablet]}>
              🏢 Resumen por Sede
            </Text>
            <Text style={styles.sedeTableSubtitle}>
              {sedesConVentas} con ventas · {rows.length - sedesConVentas} sin movimiento ·{' '}
              {formatDateShort(salesSummary.fecha_inicio)} -{' '}
              {formatDateLong(salesSummary.fecha_fin)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sedeTableDownload}
            onPress={() => {
              // Precargar selección de campañas con todas las que tengan monto > 0.
              const preselected = (campaignsDistribution?.campaigns || [])
                .filter((c) => (c.totalPurchaseCents || 0) > 0)
                .map((c) => c.campaignId);
              setSedeReportSelectedCampaignIds(preselected);
              setSedeReportIncludeCampaigns(false);
              setShowSedeReportModal(true);
            }}
            disabled={downloadingSedeSummary}
            activeOpacity={0.7}
            accessibilityLabel="Descargar resumen por sede en PDF"
          >
            {downloadingSedeSummary ? (
              <ActivityIndicator size="small" color={theme.color.brand.accent} />
            ) : (
              <Ionicons name="download-outline" size={18} color={theme.color.brand.accent} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sedeTableChevron}
            onPress={() => setSalesBySedeCollapsed((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={salesBySedeCollapsed ? 'chevron-down' : 'chevron-up'}
              size={20}
              color={theme.color.text.muted}
            />
          </TouchableOpacity>
        </View>
        {!salesBySedeCollapsed && (
          <>
            {sedesSinVentas > 0 && (
              <TouchableOpacity
                style={styles.sedeTableZeroToggle}
                onPress={() => setShowSedesWithZeroSales((v) => !v)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.sedeTableZeroCheckbox,
                    showSedesWithZeroSales && styles.sedeTableZeroCheckboxChecked,
                  ]}
                >
                  {showSedesWithZeroSales && (
                    <Ionicons name="checkmark" size={12} color={theme.color.surface.base} />
                  )}
                </View>
                <Text style={styles.sedeTableZeroLabel}>
                  Mostrar sedes sin ventas ({sedesSinVentas})
                </Text>
              </TouchableOpacity>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              style={styles.sedeTableScroll}
            >
              <View>
                <View style={[styles.sedeTableRow, styles.sedeTableHeaderRow]}>
                  <Text
                    style={[
                      styles.sedeTableCell,
                      styles.sedeTableHeaderCell,
                      styles.sedeTableCellSede,
                    ]}
                  >
                    Sede
                  </Text>
                  <Text
                    style={[
                      styles.sedeTableCell,
                      styles.sedeTableHeaderCell,
                      styles.sedeTableCellNum,
                    ]}
                  >
                    Ventas
                  </Text>
                  <Text
                    style={[
                      styles.sedeTableCell,
                      styles.sedeTableHeaderCell,
                      styles.sedeTableCellNum,
                    ]}
                  >
                    NC
                  </Text>
                  <Text
                    style={[
                      styles.sedeTableCell,
                      styles.sedeTableHeaderCell,
                      styles.sedeTableCellNum,
                    ]}
                  >
                    V. Netas
                  </Text>
                  <Text
                    style={[
                      styles.sedeTableCell,
                      styles.sedeTableHeaderCell,
                      styles.sedeTableCellNum,
                    ]}
                  >
                    Costo
                  </Text>
                  <Text
                    style={[
                      styles.sedeTableCell,
                      styles.sedeTableHeaderCell,
                      styles.sedeTableCellNum,
                    ]}
                  >
                    Utilidad
                  </Text>
                  <Text
                    style={[
                      styles.sedeTableCell,
                      styles.sedeTableHeaderCell,
                      styles.sedeTableCellNum,
                    ]}
                  >
                    Margen
                  </Text>
                  <Text
                    style={[
                      styles.sedeTableCell,
                      styles.sedeTableHeaderCell,
                      styles.sedeTableCellNum,
                    ]}
                  >
                    Izipay Neto
                  </Text>
                  <Text
                    style={[
                      styles.sedeTableCell,
                      styles.sedeTableHeaderCell,
                      styles.sedeTableCellNum,
                    ]}
                  >
                    Prosegur
                  </Text>
                  <Text
                    style={[
                      styles.sedeTableCell,
                      styles.sedeTableHeaderCell,
                      styles.sedeTableCellNum,
                    ]}
                  >
                    A Recibir
                  </Text>
                  <Text
                    style={[
                      styles.sedeTableCell,
                      styles.sedeTableHeaderCell,
                      styles.sedeTableCellNum,
                    ]}
                  >
                    Diferencia
                  </Text>
                  <Text
                    style={[
                      styles.sedeTableCell,
                      styles.sedeTableHeaderCell,
                      styles.sedeTableCellNum,
                      styles.sedeTableCellPay,
                    ]}
                  >
                    Monto a pagar
                  </Text>
                </View>
                {visibleRows.map((row, idx) => {
                  const t = row.totales_periodo;
                  const ventasNetas = t.ventas_total - t.notas_credito_total;
                  const isZero = ventasNetas <= 0;
                  const dif = t.diferencia_total;
                  const isExt = isExternalSede(row.sede);
                  const montoAPagar = computeMontoAPagar(ventasNetas, isExt);
                  const difColor =
                    Math.abs(dif) < 0.005
                      ? theme.color.text.muted
                      : dif < 0
                        ? theme.color.text.danger
                        : theme.color.state.success.text;
                  return (
                    <View
                      key={row.sede.id}
                      style={[
                        styles.sedeTableRow,
                        idx % 2 === 1 && styles.sedeTableRowAlt,
                        isZero && styles.sedeTableRowZero,
                      ]}
                    >
                      <View style={[styles.sedeTableCellSede, styles.sedeTableCellSedeContent]}>
                        <View style={styles.sedeTableNameRow}>
                          <View
                            style={[
                              styles.sedeTableStatusDot,
                              {
                                backgroundColor: isZero
                                  ? theme.color.text.muted
                                  : theme.color.state.success.text,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.sedeTableSedeName,
                              isZero && styles.sedeTableSedeNameZero,
                            ]}
                            numberOfLines={1}
                          >
                            {row.sede.name}
                          </Text>
                        </View>
                        {row.sede.code && (
                          <Text style={styles.sedeTableSedeCode} numberOfLines={1}>
                            {row.sede.code}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.sedeTableCell, styles.sedeTableCellNum]}>
                        {formatCurrency(t.ventas_total)}
                      </Text>
                      <Text
                        style={[
                          styles.sedeTableCell,
                          styles.sedeTableCellNum,
                          styles.sedeTableCellNegative,
                        ]}
                      >
                        {formatCurrency(t.notas_credito_total)}
                      </Text>
                      <Text
                        style={[
                          styles.sedeTableCell,
                          styles.sedeTableCellNum,
                          styles.sedeTableCellStrong,
                        ]}
                      >
                        {formatCurrency(ventasNetas)}
                      </Text>
                      {(() => {
                        const p = profitBySiteId.get(row.sede.id);
                        const hasZero =
                          !!p && (p.linesCostZero > 0 || (p.revenueCostZeroCents || 0) > 0);
                        return (
                          <>
                            <Text style={[styles.sedeTableCell, styles.sedeTableCellNum]}>
                              {p ? formatCurrency((p.costCents || 0) / 100) : '—'}
                            </Text>
                            <Text
                              style={[
                                styles.sedeTableCell,
                                styles.sedeTableCellNum,
                                styles.sedeTableCellStrong,
                                p && p.profitCents < 0 && { color: theme.color.text.danger },
                              ]}
                            >
                              {p ? formatCurrency((p.profitCents || 0) / 100) : '—'}
                            </Text>
                            <Text
                              style={[
                                styles.sedeTableCell,
                                styles.sedeTableCellNum,
                                hasZero && {
                                  color: theme.color.state.warning.text,
                                  fontWeight: '600',
                                },
                              ]}
                            >
                              {p == null || p.marginPct == null
                                ? '—'
                                : `${(p.marginPct * 100).toFixed(1)}%`}
                            </Text>
                          </>
                        );
                      })()}
                      <Text style={[styles.sedeTableCell, styles.sedeTableCellNum]}>
                        {formatCurrency(t.izipay_neto)}
                      </Text>
                      <Text style={[styles.sedeTableCell, styles.sedeTableCellNum]}>
                        {formatCurrency(t.prosegur_depositos)}
                      </Text>
                      <Text
                        style={[
                          styles.sedeTableCell,
                          styles.sedeTableCellNum,
                          styles.sedeTableCellStrong,
                        ]}
                      >
                        {formatCurrency(t.total_a_recibir)}
                      </Text>
                      <Text
                        style={[
                          styles.sedeTableCell,
                          styles.sedeTableCellNum,
                          { color: difColor, fontWeight: '700' },
                        ]}
                      >
                        {formatCurrency(dif)}
                      </Text>
                      <View style={[styles.sedeTableCell, styles.sedeTableCellPay]}>
                        <Text
                          style={[
                            styles.sedeTableCellNum,
                            styles.sedeTableCellPayValue,
                            isZero && { color: theme.color.text.muted, fontWeight: '600' },
                          ]}
                          numberOfLines={1}
                        >
                          {formatCurrency(montoAPagar)}
                        </Text>
                        <Text style={styles.sedeTableCellPayHint} numberOfLines={1}>
                          {isExt ? 'EXT ÷ 1.15' : 'INT · sin dscto.'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                {aggregatedSalesTotals && rows.length > 1 && (
                  <View style={[styles.sedeTableRow, styles.sedeTableTotalRow]}>
                    <View style={[styles.sedeTableCellSede, styles.sedeTableCellSedeContent]}>
                      <Text style={styles.sedeTableTotalLabel}>TOTAL</Text>
                    </View>
                    <Text
                      style={[
                        styles.sedeTableCell,
                        styles.sedeTableCellNum,
                        styles.sedeTableTotalText,
                      ]}
                    >
                      {formatCurrency(aggregatedSalesTotals.ventas_total)}
                    </Text>
                    <Text
                      style={[
                        styles.sedeTableCell,
                        styles.sedeTableCellNum,
                        styles.sedeTableTotalText,
                      ]}
                    >
                      {formatCurrency(aggregatedSalesTotals.notas_credito_total)}
                    </Text>
                    <Text
                      style={[
                        styles.sedeTableCell,
                        styles.sedeTableCellNum,
                        styles.sedeTableTotalText,
                      ]}
                    >
                      {formatCurrency(
                        aggregatedSalesTotals.ventas_total -
                          aggregatedSalesTotals.notas_credito_total
                      )}
                    </Text>
                    <Text
                      style={[
                        styles.sedeTableCell,
                        styles.sedeTableCellNum,
                        styles.sedeTableTotalText,
                      ]}
                    >
                      {salesProfit
                        ? formatCurrency((salesProfit.totals.costCents || 0) / 100)
                        : '—'}
                    </Text>
                    <Text
                      style={[
                        styles.sedeTableCell,
                        styles.sedeTableCellNum,
                        styles.sedeTableTotalText,
                      ]}
                    >
                      {salesProfit
                        ? formatCurrency((salesProfit.totals.profitCents || 0) / 100)
                        : '—'}
                    </Text>
                    <Text
                      style={[
                        styles.sedeTableCell,
                        styles.sedeTableCellNum,
                        styles.sedeTableTotalText,
                      ]}
                    >
                      {salesProfit && salesProfit.totals.marginPct != null
                        ? `${(salesProfit.totals.marginPct * 100).toFixed(1)}%`
                        : '—'}
                    </Text>
                    <Text
                      style={[
                        styles.sedeTableCell,
                        styles.sedeTableCellNum,
                        styles.sedeTableTotalText,
                      ]}
                    >
                      {formatCurrency(aggregatedSalesTotals.izipay_neto)}
                    </Text>
                    <Text
                      style={[
                        styles.sedeTableCell,
                        styles.sedeTableCellNum,
                        styles.sedeTableTotalText,
                      ]}
                    >
                      {formatCurrency(aggregatedSalesTotals.prosegur_depositos)}
                    </Text>
                    <Text
                      style={[
                        styles.sedeTableCell,
                        styles.sedeTableCellNum,
                        styles.sedeTableTotalText,
                      ]}
                    >
                      {formatCurrency(aggregatedSalesTotals.total_a_recibir)}
                    </Text>
                    <Text
                      style={[
                        styles.sedeTableCell,
                        styles.sedeTableCellNum,
                        styles.sedeTableTotalText,
                      ]}
                    >
                      {formatCurrency(aggregatedSalesTotals.diferencia_total)}
                    </Text>
                    <Text
                      style={[
                        styles.sedeTableCell,
                        styles.sedeTableCellNum,
                        styles.sedeTableCellPay,
                        styles.sedeTableTotalText,
                        styles.sedeTableCellPayValue,
                      ]}
                    >
                      {formatCurrency(totalMontoAPagar)}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
            {salesProfit && salesProfit.totals.linesCostZero > 0 && (
              <Text style={styles.salesProfitDisclaimer}>
                ⚠️ {salesProfit.totals.linesCostZero} líneas con costo 0/desconocido (
                {formatCurrency((salesProfit.totals.revenueCostZeroCents || 0) / 100)} en ingreso).
                La utilidad de esas ventas no es confiable.
              </Text>
            )}
            {loadingSalesProfit && !salesProfit && (
              <Text style={styles.salesProfitDisclaimer}>Calculando utilidad…</Text>
            )}
          </>
        )}
      </View>
    );
  };

  const renderSalesChart = () => {
    if (!aggregatedChartData || aggregatedChartData.length === 0) {
      return null;
    }

    const chartWidth = width - 32;
    const chartHeight = 220;
    const padding = { top: 20, right: 40, bottom: 56, left: 50 };
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;

    const data = aggregatedChartData;
    // Calcular ventas netas (ventas - notas de crédito) para cada día
    const ventasNetas = data.map((d) => d.ventas_total - d.notas_credito_total);
    const maxValue = Math.max(...ventasNetas, 1);
    const pointSpacing = Math.max(graphWidth / (data.length - 1 || 1), 48);
    const totalWidth = Math.max(
      chartWidth,
      (data.length - 1) * pointSpacing + padding.left + padding.right
    );

    // Generar puntos para la línea (usando ventas netas)
    const points = data.map((item, index) => {
      const ventaNeta = item.ventas_total - item.notas_credito_total;
      const x = padding.left + index * pointSpacing;
      const y = padding.top + graphHeight - (ventaNeta / maxValue) * graphHeight;
      return { x, y, item, ventaNeta };
    });

    // Crear path para la línea
    const linePath = points
      .map((point, index) => {
        if (index === 0) {
          return `M ${point.x} ${point.y}`;
        }
        return `L ${point.x} ${point.y}`;
      })
      .join(' ');

    // Crear path para el área bajo la línea
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${padding.left} ${padding.top + graphHeight} Z`;

    const chartSource = salesChart || salesSummary;
    const chartSubtitle = chartSource
      ? `${formatDateShort(chartSource.fecha_inicio)} - ${formatDateLong(chartSource.fecha_fin)}`
      : '';

    return (
      <View style={styles.chartContainer}>
        <Text style={[styles.chartTitle, isTablet && styles.chartTitleTablet]}>
          📈 Ventas Netas (Ventas - Notas de Crédito)
        </Text>
        {chartSubtitle ? <Text style={styles.chartSubtitle}>{chartSubtitle}</Text> : null}
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
            <Path d={areaPath} fill={theme.color.chart.categorical[6]} fillOpacity="0.1" />

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
                  y={padding.top + graphHeight + 18}
                  fontSize="10"
                  fill={theme.color.chart.axis}
                  textAnchor="end"
                  transform={`rotate(-45, ${point.x}, ${padding.top + graphHeight + 18})`}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.color.brand.accent]}
          />
        }
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
            {!loadingSales &&
              !salesError &&
              salesSummary !== null &&
              aggregatedSalesTotals !== null && (
                <>
                  {/* Stats Grid: Ventas - NC - Ventas Netas */}
                  <View style={[styles.statsGrid, isTablet && styles.statsGridTablet]}>
                    <View style={[styles.statCard, styles.statCardInfo]}>
                      <Text style={styles.statIcon}>💵</Text>
                      <Text style={styles.statLabel}>Ventas Brutas</Text>
                      <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                        {formatCurrency(aggregatedSalesTotals.ventas_total)}
                      </Text>
                      <Text style={styles.statSubtext}>
                        {aggregatedSalesTotals.ventas_cantidad} operaciones
                      </Text>
                    </View>

                    <View style={[styles.statCard, styles.statCardDanger]}>
                      <Text style={styles.statIcon}>📝</Text>
                      <Text style={styles.statLabel}>Notas de Crédito</Text>
                      <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                        {formatCurrency(aggregatedSalesTotals.notas_credito_total)}
                      </Text>
                      <Text style={styles.statSubtext}>
                        {aggregatedSalesTotals.notas_credito_cantidad} anulaciones
                      </Text>
                    </View>

                    <View style={[styles.statCard, styles.statCardSuccess]}>
                      <Text style={styles.statIcon}>✅</Text>
                      <Text style={styles.statLabel}>Ventas Netas</Text>
                      <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                        {formatCurrency(
                          aggregatedSalesTotals.ventas_total -
                            aggregatedSalesTotals.notas_credito_total
                        )}
                      </Text>
                      <Text style={styles.statSubtext}>Ventas - Notas de Crédito</Text>
                    </View>
                  </View>

                  {/* Tabla por sede */}
                  {renderSalesBySedeTable()}

                  {/* Chart */}
                  {renderSalesChart()}

                  {/* Stats Grid: Prosegur / Izipay / Total a recibir / Comisiones */}
                  <View style={[styles.statsGrid, isTablet && styles.statsGridTablet]}>
                    <View style={[styles.statCard, styles.statCardInfo]}>
                      <Text style={styles.statIcon}>🏦</Text>
                      <Text style={styles.statLabel}>Prosegur</Text>
                      <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                        {formatCurrency(aggregatedSalesTotals.prosegur_depositos)}
                      </Text>
                      <Text style={styles.statSubtext}>
                        {aggregatedSalesTotals.prosegur_cantidad} depósitos
                      </Text>
                    </View>

                    <View style={[styles.statCard, styles.statCardPrimary]}>
                      <Text style={styles.statIcon}>💳</Text>
                      <Text style={styles.statLabel}>Izipay Bruto</Text>
                      <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                        {formatCurrency(aggregatedSalesTotals.izipay_bruto)}
                      </Text>
                      <Text style={styles.statSubtext}>
                        {aggregatedSalesTotals.izipay_cantidad} transacciones
                      </Text>
                    </View>

                    <View style={[styles.statCard, styles.statCardSuccess]}>
                      <Text style={styles.statIcon}>💰</Text>
                      <Text style={styles.statLabel}>Total a Recibir</Text>
                      <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                        {formatCurrency(aggregatedSalesTotals.total_a_recibir)}
                      </Text>
                      <Text style={styles.statSubtext}>Prosegur + Izipay neto</Text>
                    </View>

                    <View style={[styles.statCard, styles.statCardWarning]}>
                      <Text style={styles.statIcon}>📊</Text>
                      <Text style={styles.statLabel}>Comisiones</Text>
                      <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                        {formatCurrency(aggregatedSalesTotals.total_comisiones)}
                      </Text>
                      <Text style={styles.statSubtext}>Izipay</Text>
                    </View>
                  </View>

                  {/* Empty State */}
                  {aggregatedSalesTotals.ventas_cantidad === 0 && (
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
                {renderChart(
                  purchasesGrouped?.groupedData,
                  '📈 Compras en el Período',
                  theme.color.chart.categorical[0]
                )}

                {/* Top Suppliers */}
                {purchasesSummary.topSuppliers.length > 0 && (
                  <View style={styles.suppliersSection}>
                    <Text style={[styles.suppliersTitle, isTablet && styles.suppliersTitleTablet]}>
                      🏆 Top 5 Proveedores
                    </Text>
                    <Text style={styles.suppliersSubtitle}>
                      Período: {formatDateShort(purchasesSummary.startDate)} -{' '}
                      {formatDateLong(purchasesSummary.endDate)}
                    </Text>

                    {purchasesSummary.topSuppliers.map((supplier, index) => (
                      <View key={supplier.supplierId} style={styles.supplierCard}>
                        <View style={styles.supplierRank}>
                          <Text style={styles.supplierRankText}>#{index + 1}</Text>
                        </View>
                        <View style={styles.supplierInfo}>
                          <Text
                            style={[styles.supplierName, isTablet && styles.supplierNameTablet]}
                          >
                            {supplier.supplierName}
                          </Text>
                          <View style={styles.supplierStats}>
                            <Text style={styles.supplierStat}>
                              {formatCurrency(supplier.totalValidated)}
                            </Text>
                            <Text style={styles.supplierStatSeparator}>•</Text>
                            <Text style={styles.supplierStat}>
                              {supplier.purchaseCount}{' '}
                              {supplier.purchaseCount === 1 ? 'compra' : 'compras'}
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

        {/* Campaigns Site Distribution Section */}
        {canViewPurchases && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => setCampaignsCollapsed((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={styles.collapsibleHeaderTextWrap}>
                <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                  📦 Mercadería repartida por sede
                </Text>
                <Text style={styles.collapsibleHeaderHint}>
                  Últimas 5 campañas
                  {campaignsDistribution
                    ? ` · ${formatCurrency((campaignsDistribution.grandTotalPurchaseCents || 0) / 100)}`
                    : ''}
                </Text>
              </View>
              <Ionicons
                name={campaignsCollapsed ? 'chevron-down' : 'chevron-up'}
                size={22}
                color={theme.color.text.muted}
              />
            </TouchableOpacity>

            {!campaignsCollapsed && (
              <View style={styles.collapsibleBody}>
                {loadingCampaigns && !refreshing && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.color.chart.categorical[0]} />
                    <Text style={styles.loadingText}>Cargando distribución de campañas...</Text>
                  </View>
                )}

                {campaignsError && !loadingCampaigns && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorText}>{campaignsError}</Text>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={loadCampaignsDistribution}
                    >
                      <Text style={styles.retryButtonText}>Reintentar</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!loadingCampaigns &&
                  !campaignsError &&
                  campaignsDistribution &&
                  campaignsDistribution.campaigns.length > 0 &&
                  renderCampaignsDistributionTable(campaignsDistribution)}

                {!loadingCampaigns &&
                  !campaignsError &&
                  campaignsDistribution &&
                  campaignsDistribution.campaigns.length === 0 && (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateIcon}>📭</Text>
                      <Text style={styles.emptyStateText}>No hay campañas registradas</Text>
                    </View>
                  )}
              </View>
            )}
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
            <TouchableOpacity style={styles.reportCard} onPress={() => setShowReportsModal(true)}>
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

            {/* External Sales Sync — sólo con permisos del módulo */}
            {canViewExternalSalesSync && (
              <TouchableOpacity
                style={styles.reportCard}
                onPress={() => setShowExternalSalesSyncModal(true)}
              >
                <View style={styles.reportIconContainer}>
                  <Text style={styles.reportIcon}>🔄</Text>
                </View>
                <View style={styles.reportInfo}>
                  <Text style={styles.reportTitle}>Sincronización ventas externas</Text>
                  <Text style={styles.reportDescription}>
                    Sincroniza ventas desde ERPs externos (simplefact.pe) hacia cash_sales
                  </Text>
                </View>
                <Text style={styles.reportArrow}>→</Text>
              </TouchableOpacity>
            )}

            {/* Izipay Report Sync — sólo con permisos del módulo */}
            {canViewIzipaySync && (
              <TouchableOpacity
                style={styles.reportCard}
                onPress={() => setShowIzipaySyncModal(true)}
              >
                <View style={styles.reportIconContainer}>
                  <Text style={styles.reportIcon}>💳</Text>
                </View>
                <View style={styles.reportInfo}>
                  <Text style={styles.reportTitle}>Sincronización Izipay</Text>
                  <Text style={styles.reportDescription}>
                    Importa el reporte mensual de Izipay (panel.izipay.pe) hacia conciliación
                  </Text>
                </View>
                <Text style={styles.reportArrow}>→</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* External Sales Sync Modal */}
      {canViewExternalSalesSync && (
        <ExternalSalesSyncModal
          visible={showExternalSalesSyncModal}
          onClose={() => setShowExternalSalesSyncModal(false)}
        />
      )}

      {/* Izipay Sync Modal */}
      {canViewIzipaySync && (
        <IzipaySyncModal
          visible={showIzipaySyncModal}
          onClose={() => setShowIzipaySyncModal(false)}
        />
      )}

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
              {/* Toggle global: seleccionar todas las sedes de todas las empresas */}
              <TouchableOpacity
                style={[styles.sedeModalItem, allSedesSelected && styles.sedeModalItemSelected]}
                onPress={() =>
                  setDraftSedeIds(allSedesSelected ? [] : allAvailableSedes.map((s) => s.id))
                }
                activeOpacity={0.7}
              >
                <View style={styles.sedeModalItemContent}>
                  <View style={styles.sedeModalItemIconBadge}>
                    <Ionicons
                      name="checkmark-done"
                      size={18}
                      color={allSedesSelected ? theme.color.brand.accent : theme.color.icon.muted}
                    />
                  </View>
                  <View style={styles.sedeModalItemText}>
                    <Text style={styles.sedeModalItemName}>Seleccionar todas</Text>
                    <Text style={styles.sedeModalItemCode}>
                      {allSedesSelected
                        ? `Todas seleccionadas (${allAvailableSedes.length})`
                        : `Marcar las ${allAvailableSedes.length} sedes disponibles`}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={allSedesSelected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={allSedesSelected ? theme.color.brand.accent : theme.color.icon.muted}
                />
              </TouchableOpacity>

              {/* Sección: empresa actual */}
              {sedes.length > 0 &&
                renderSedeCompanySection({
                  iconName: 'business',
                  iconColor: theme.color.brand.accent,
                  title: `Empresa actual: ${currentCompany?.name || '—'}`,
                  sites: sedes,
                })}

              {/* Secciones: otras empresas (también seleccionables) */}
              {otherCompaniesGroups.map((group) =>
                renderSedeCompanySection({
                  key: group.companyId,
                  iconName: 'business-outline',
                  iconColor: theme.color.text.muted,
                  title: group.companyName,
                  sites: group.sites,
                  headerStyle: styles.sedeSectionHeaderOther,
                })
              )}
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
                      style={[styles.reportChip, !reportSedeId && styles.reportChipActive]}
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
                      style={[styles.reportChip, !reportTipoOrigen && styles.reportChipActive]}
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
                      style={[styles.reportChip, !reportEstado && styles.reportChipActive]}
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
                  <View
                    style={[
                      styles.reportCheckbox,
                      reportIncluirDetalle && styles.reportCheckboxChecked,
                    ]}
                  >
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
                style={[
                  styles.modalApplyButton,
                  downloadingReport && styles.modalApplyButtonDisabled,
                ]}
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

      {/* Sede Summary Download Modal (opciones de campañas) */}
      <Modal
        visible={showSedeReportModal}
        transparent
        animationType="fade"
        onRequestClose={() => !downloadingSedeSummary && setShowSedeReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.reportsModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📄 Descargar Resumen por Sede</Text>
              <TouchableOpacity
                onPress={() => !downloadingSedeSummary && setShowSedeReportModal(false)}
                disabled={downloadingSedeSummary}
              >
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.reportParamSection}>
                <TouchableOpacity
                  style={styles.reportCheckboxContainer}
                  onPress={() => setSedeReportIncludeCampaigns((v) => !v)}
                >
                  <View
                    style={[
                      styles.reportCheckbox,
                      sedeReportIncludeCampaigns && styles.reportCheckboxChecked,
                    ]}
                  >
                    {sedeReportIncludeCampaigns && (
                      <Text style={styles.reportCheckboxCheck}>✓</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reportCheckboxLabel}>Incluir información de campañas</Text>
                    <Text style={styles.collapsibleHeaderHint}>
                      Añade una tabla con las campañas seleccionadas y su monto repartido debajo del
                      reporte de ventas.
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {sedeReportIncludeCampaigns && (
                <View style={styles.reportParamSection}>
                  <Text style={styles.reportParamLabel}>📦 Campañas a incluir</Text>
                  {(!campaignsDistribution || campaignsDistribution.campaigns.length === 0) && (
                    <Text style={styles.collapsibleHeaderHint}>
                      No hay campañas disponibles para el período seleccionado.
                    </Text>
                  )}
                  {campaignsDistribution && campaignsDistribution.campaigns.length > 0 && (
                    <>
                      <View style={styles.campaignSelectActions}>
                        <TouchableOpacity
                          onPress={() =>
                            setSedeReportSelectedCampaignIds(
                              campaignsDistribution.campaigns.map((c) => c.campaignId)
                            )
                          }
                        >
                          <Text style={styles.campaignSelectActionText}>Seleccionar todas</Text>
                        </TouchableOpacity>
                        <Text style={styles.campaignSelectActionSeparator}>·</Text>
                        <TouchableOpacity onPress={() => setSedeReportSelectedCampaignIds([])}>
                          <Text style={styles.campaignSelectActionText}>Ninguna</Text>
                        </TouchableOpacity>
                      </View>
                      {campaignsDistribution.campaigns.map((c) => {
                        const checked = sedeReportSelectedCampaignIds.includes(c.campaignId);
                        return (
                          <TouchableOpacity
                            key={c.campaignId}
                            style={styles.campaignCheckboxRow}
                            onPress={() =>
                              setSedeReportSelectedCampaignIds((prev) =>
                                prev.includes(c.campaignId)
                                  ? prev.filter((id) => id !== c.campaignId)
                                  : [...prev, c.campaignId]
                              )
                            }
                          >
                            <View
                              style={[
                                styles.reportCheckbox,
                                checked && styles.reportCheckboxChecked,
                              ]}
                            >
                              {checked && <Text style={styles.reportCheckboxCheck}>✓</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.campaignCheckboxTitle} numberOfLines={1}>
                                {c.campaignName || c.campaignCode}
                              </Text>
                              <Text style={styles.campaignCheckboxMeta} numberOfLines={1}>
                                {c.campaignCode} · {formatCampaignDate(c.createdAt)}
                              </Text>
                            </View>
                            <Text style={styles.campaignCheckboxAmount}>
                              {formatCurrency((c.totalPurchaseCents || 0) / 100)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowSedeReportModal(false)}
                disabled={downloadingSedeSummary}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalApplyButton,
                  downloadingSedeSummary && styles.modalApplyButtonDisabled,
                ]}
                onPress={async () => {
                  await handleDownloadSedeSummaryPdf();
                  setShowSedeReportModal(false);
                }}
                disabled={downloadingSedeSummary}
              >
                {downloadingSedeSummary ? (
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
      marginBottom: theme.space[1],
    },
    chartTitleTablet: {
      fontSize: 18,
    },
    chartSubtitle: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: theme.space[4],
    },
    // Tabla por sede
    sedeTableContainer: {
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
    sedeTableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.space[3],
    },
    sedeTableHeaderText: {
      flex: 1,
    },
    sedeTableChevron: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.color.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: theme.space[2],
    },
    sedeTableDownload: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.color.brand.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: theme.space[2],
    },
    sedeTableTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    sedeTableTitleTablet: {
      fontSize: 18,
    },
    sedeTableSubtitle: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    sedeTableScroll: {
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    sedeTableZeroToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: theme.space[2],
      paddingVertical: theme.space[1],
      paddingHorizontal: theme.space[2],
      marginBottom: theme.space[2],
      borderRadius: theme.radii.sm,
    },
    sedeTableZeroCheckbox: {
      width: 16,
      height: 16,
      borderRadius: 3,
      borderWidth: 1.5,
      borderColor: theme.color.border.default,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.surface.base,
    },
    sedeTableZeroCheckboxChecked: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    sedeTableZeroLabel: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    sedeTableRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    sedeTableHeaderRow: {
      backgroundColor: theme.color.surface.muted,
    },
    sedeTableRowAlt: {
      backgroundColor: theme.color.background.subtle,
    },
    sedeTableRowZero: {
      opacity: 0.55,
    },
    sedeTableNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    sedeTableStatusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    sedeTableSedeNameZero: {
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    sedeTableTotalRow: {
      backgroundColor: theme.color.brand.accentSoft,
      borderTopWidth: 2,
      borderTopColor: theme.color.brand.accent,
    },
    sedeTableCell: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2.5],
      fontSize: 12,
      color: theme.color.text.body,
    },
    sedeTableHeaderCell: {
      fontWeight: '700',
      fontSize: 11,
      color: theme.color.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    sedeTableCellSede: {
      width: 180,
    },
    sedeTableCellSedeContent: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2.5],
      justifyContent: 'center',
    },
    sedeTableSedeName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    sedeTableSedeCode: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    sedeTableCellNum: {
      width: 130,
      textAlign: 'right',
    },
    sedeTableCellNegative: {
      color: theme.color.text.danger,
    },
    sedeTableCellPay: {
      width: 150,
      backgroundColor: theme.color.brand.accentSoft,
      borderLeftWidth: 2,
      borderLeftColor: theme.color.brand.accent,
      justifyContent: 'center',
    },
    sedeTableCellPayValue: {
      color: theme.color.brand.accent,
      fontWeight: '700',
      textAlign: 'right',
    },
    sedeTableCellPayHint: {
      fontSize: 10,
      color: theme.color.text.muted,
      textAlign: 'right',
      marginTop: 2,
    },
    sedeTableCellStrong: {
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    sedeTableTotalLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.color.brand.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sedeTableTotalText: {
      fontWeight: '800',
      color: theme.color.brand.accent,
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
    sedeSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[4],
      backgroundColor: theme.color.surface.muted,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    sedeSectionHeaderOther: {
      marginTop: theme.space[2],
    },
    sedeSectionHeaderText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.body,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sedeSectionBadge: {
      minWidth: 22,
      paddingHorizontal: theme.space[2],
      paddingVertical: 2,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sedeSectionBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.text.muted,
    },
    sedeSectionToggle: {
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.brand.accentSoft,
    },
    sedeSectionToggleText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.color.brand.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
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
    // Collapsible section header (usada por la tabla de mercadería repartida)
    collapsibleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      marginBottom: theme.space[3],
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    collapsibleHeaderTextWrap: {
      flex: 1,
      paddingRight: theme.space[3],
    },
    collapsibleHeaderHint: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: 2,
      fontWeight: '500',
    },
    collapsibleBody: {
      marginTop: theme.space[1],
    },
    // Utilidad: aviso de líneas con costo 0
    salesProfitDisclaimer: {
      marginTop: theme.space[2],
      marginHorizontal: theme.space[3],
      fontSize: 12,
      color: theme.color.state.warning.text,
      fontStyle: 'italic',
    },
    // Campaigns × Sites distribution table
    campaignsSedeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    campaignsSedeTextWrap: {
      flex: 1,
    },
    campaignsTypeBadge: {
      paddingHorizontal: theme.space[1.5],
      paddingVertical: 2,
      borderRadius: theme.radii.sm,
      minWidth: 28,
      alignItems: 'center',
    },
    campaignsTypeBadgeInternal: {
      backgroundColor: theme.color.state.info.background,
    },
    campaignsTypeBadgeExternal: {
      backgroundColor: theme.color.state.warning.background,
    },
    campaignsTypeBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: theme.color.text.heading,
      letterSpacing: 0.5,
    },
    campaignsTableWrapper: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      overflow: 'hidden',
    },
    campaignsTableRow: {
      flexDirection: 'row',
    },
    campaignsHeaderCell: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      backgroundColor: theme.color.background.subtle,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      borderRightWidth: 1,
      borderRightColor: theme.color.border.subtle,
      justifyContent: 'center',
    },
    campaignsHeaderText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    campaignsHeaderSubtext: {
      fontSize: 10,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    campaignsHeaderDate: {
      fontSize: 10,
      color: theme.color.text.muted,
      marginTop: 2,
      fontWeight: '500',
    },
    campaignsBodyCell: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      borderRightWidth: 1,
      borderRightColor: theme.color.border.subtle,
      justifyContent: 'center',
      minHeight: 56,
    },
    campaignsSedeCell: {
      backgroundColor: theme.color.surface.base,
    },
    campaignsSedeName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    campaignsSedeMeta: {
      fontSize: 10,
      color: theme.color.text.muted,
      marginTop: 2,
      fontWeight: '500',
    },
    campaignsCellValue: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    campaignsCellMeta: {
      fontSize: 10,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    campaignsCellEmpty: {
      fontSize: 13,
      color: theme.color.text.muted,
      textAlign: 'center',
    },
    campaignsTotalRow: {
      backgroundColor: theme.color.background.subtle,
    },
    campaignsTotalLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.heading,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    campaignsTotalValue: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    campaignsPayHeaderCell: {
      backgroundColor: theme.color.brand.accentSoft,
      borderLeftWidth: 2,
      borderLeftColor: theme.color.brand.accent,
    },
    campaignsPayBodyCell: {
      backgroundColor: theme.color.brand.accentSoft,
      borderLeftWidth: 2,
      borderLeftColor: theme.color.brand.accent,
    },
    campaignsPayValue: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    campaignsGrandTotalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      backgroundColor: theme.color.brand.accentSoft,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    campaignsGrandTotalLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    campaignsGrandTotalHint: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    // Modal: selección de campañas para el PDF del resumen por sede
    campaignSelectActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginBottom: theme.space[2],
    },
    campaignSelectActionText: {
      fontSize: 12,
      color: theme.color.brand.accent,
      fontWeight: '700',
    },
    campaignSelectActionSeparator: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    campaignCheckboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[2],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      marginBottom: theme.space[2],
      gap: theme.space[3],
      backgroundColor: theme.color.surface.base,
    },
    campaignCheckboxTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    campaignCheckboxMeta: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    campaignCheckboxAmount: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginLeft: theme.space[2],
    },
    campaignsGrandTotalValue: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.color.text.heading,
    },
  });

export default DashboardScreen;
