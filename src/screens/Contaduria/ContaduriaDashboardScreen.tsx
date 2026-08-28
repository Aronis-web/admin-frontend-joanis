import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Line as SvgLine,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { DateRangePicker } from '@/components/DateRangePicker';
import {
  Body,
  Button,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Input,
  Text,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import {
  useSireInvoicesSummary,
  useSireInvoicesSummaryByProvider,
} from '@/hooks/api/useSireCompras';
import {
  useSireVentasInvoicesSummary,
  useSireVentasInvoicesSummaryByClient,
} from '@/hooks/api/useSireVentas';
import type {
  GetSireInvoicesSummaryParams,
  SireInvoicesSummaryResponse,
  SireProviderSortBy,
  SireSummaryByPeriodo,
  SireSummaryByTipoCpe,
} from '@/types/sireCompras';
import type {
  GetSireVentasInvoicesSummaryParams,
  SireVentasClientSortBy,
  SireVentasInvoicesSummaryResponse,
} from '@/types/sireVentas';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';

type Props = NativeStackScreenProps<any, 'ContaduriaDashboard'>;

type Currency = 'PEN' | 'USD';

/** Bloque de montos normalizado, común a compras y ventas. */
interface NormBlock {
  count: number;
  baseImponible: string;
  igv: string;
  importeTotal: string;
}

/**
 * Estructura de resumen normalizada para reutilizar los mismos componentes de
 * render entre Compras (RCE) y Ventas (RVIE).
 * `facturas` y `notasCredito` siempre en positivo (magnitud).
 */
interface NormalizedSummary {
  totals: Record<Currency, NormBlock>;
  facturas: Record<Currency, NormBlock>;
  notasCredito: Record<Currency, NormBlock>;
  byPeriodo: Array<{
    perTributario: string;
    moneda: string;
    count: number;
    baseImponible: string;
    igv: string;
    importeTotal: string;
  }>;
  byTipoCpe: Array<{ tipoCpe: string; count: number; importeTotal: string }>;
}

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'year' | 'custom';

const CPE_LABELS: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta',
  '07': 'N. Crédito',
  '08': 'N. Débito',
  '14': 'Servicios',
};

const CURRENCIES: Array<'PEN' | 'USD'> = ['PEN', 'USD'];

const CURRENCY_LABELS: Record<'PEN' | 'USD', string> = {
  PEN: 'Soles (PEN)',
  USD: 'Dólares (USD)',
};

const CURRENCY_ACCENTS: Record<'PEN' | 'USD', string> = {
  PEN: '#10B981',
  USD: '#3B82F6',
};

const MONTH_LABELS = [
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

const SORT_OPTIONS: Array<{ label: string; value: SireProviderSortBy }> = [
  { label: 'Importe', value: 'importeTotal' },
  { label: 'N.º docs', value: 'count' },
  { label: 'Proveedor', value: 'razonSocialProveedor' },
];

const CLIENT_SORT_OPTIONS: Array<{ label: string; value: SireVentasClientSortBy }> = [
  { label: 'Importe', value: 'importeTotal' },
  { label: 'N.º docs', value: 'count' },
  { label: 'Cliente', value: 'razonSocialCliente' },
];

/** Símbolo corto por moneda (USD via \u0024 para evitar el literal directo). */
const CURRENCY_SYMBOLS: Record<Currency, string> = { PEN: 'S/', USD: '\u0024' };

const DEFAULT_PROVIDER_LIMIT = 20;
const DEFAULT_CLIENT_LIMIT = 20;

const CURRENCY_KEYS: Currency[] = ['PEN', 'USD'];

const absStr = (v?: string) => String(Math.abs(Number(v ?? 0) || 0));
const subStr = (a?: string, b?: string) => String((Number(a ?? 0) || 0) - (Number(b ?? 0) || 0));

/** Normaliza el resumen de Compras (RCE) al formato común. */
const normalizeComprasSummary = (s: SireInvoicesSummaryResponse): NormalizedSummary => {
  const block = (b: {
    count: number;
    baseImponible: string;
    igv: string;
    importeTotal: string;
  }): NormBlock => ({
    count: b.count,
    baseImponible: b.baseImponible,
    igv: b.igv,
    importeTotal: b.importeTotal,
  });
  return {
    totals: { PEN: block(s.totals.PEN), USD: block(s.totals.USD) },
    facturas: { PEN: block(s.facturas.PEN), USD: block(s.facturas.USD) },
    notasCredito: { PEN: block(s.notasCredito.PEN), USD: block(s.notasCredito.USD) },
    byPeriodo: s.byPeriodo,
    byTipoCpe: s.byTipoCpe,
  };
};

/**
 * Normaliza el resumen de Ventas (RVIE) al formato común.
 * En ventas `totals` ya es neto (facturas − NC) y las NC vienen en negativo,
 * por lo que se derivan `facturas` (totals − NC) y NC en positivo.
 */
const normalizeVentasSummary = (s: SireVentasInvoicesSummaryResponse): NormalizedSummary => {
  const totalsBlock = (cur: Currency): NormBlock => ({
    count: s.totals[cur].count,
    baseImponible: s.totals[cur].baseImponible,
    igv: s.totals[cur].igv,
    importeTotal: s.totals[cur].importeTotal,
  });
  const facturasBlock = (cur: Currency): NormBlock => ({
    count: s.totals[cur].count - s.notasCredito[cur].count,
    baseImponible: subStr(s.totals[cur].baseImponible, s.notasCredito[cur].baseImponible),
    igv: subStr(s.totals[cur].igv, s.notasCredito[cur].igv),
    importeTotal: subStr(s.totals[cur].importeTotal, s.notasCredito[cur].importeTotal),
  });
  const ncBlock = (cur: Currency): NormBlock => ({
    count: s.notasCredito[cur].count,
    baseImponible: absStr(s.notasCredito[cur].baseImponible),
    igv: absStr(s.notasCredito[cur].igv),
    importeTotal: absStr(s.notasCredito[cur].importeTotal),
  });
  return {
    totals: { PEN: totalsBlock('PEN'), USD: totalsBlock('USD') },
    facturas: { PEN: facturasBlock('PEN'), USD: facturasBlock('USD') },
    notasCredito: { PEN: ncBlock('PEN'), USD: ncBlock('USD') },
    byPeriodo: s.byPeriodo,
    byTipoCpe: s.byTipoCpe,
  };
};

interface YearMonthlyPoint {
  count: number;
  importeTotal: number;
}
interface YearMonthlyData {
  months: Array<{
    month: number;
    key: string;
    label: string;
    PEN: YearMonthlyPoint;
    USD: YearMonthlyPoint;
  }>;
  maxPen: number;
  maxUsd: number;
  accPen: number;
  accUsd: number;
  totalDocsPen: number;
  totalDocsUsd: number;
}

/** Construye la serie mensual (12 meses) por moneda a partir de byPeriodo. */
const buildYearMonthly = (
  byPeriodo: Array<{ perTributario: string; moneda: string; count: number; importeTotal: string }>,
  year: number
): YearMonthlyData => {
  const empty: YearMonthlyPoint = { count: 0, importeTotal: 0 };
  const build = (cur: Currency) => {
    const map = new Map<string, YearMonthlyPoint>();
    byPeriodo
      .filter((p) => p.moneda === cur)
      .forEach((p) => {
        if (!p.perTributario || p.perTributario.length !== 6) return;
        map.set(p.perTributario, {
          count: p.count,
          importeTotal: Number(p.importeTotal) || 0,
        });
      });
    return map;
  };
  const penMap = build('PEN');
  const usdMap = build('USD');
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}${String(i + 1).padStart(2, '0')}`;
    return {
      month: i,
      key,
      label: MONTH_LABELS[i],
      PEN: penMap.get(key) ?? empty,
      USD: usdMap.get(key) ?? empty,
    };
  });
  return {
    months,
    maxPen: months.reduce((max, m) => Math.max(max, m.PEN.importeTotal), 0),
    maxUsd: months.reduce((max, m) => Math.max(max, m.USD.importeTotal), 0),
    accPen: months.reduce((sum, m) => sum + m.PEN.importeTotal, 0),
    accUsd: months.reduce((sum, m) => sum + m.USD.importeTotal, 0),
    totalDocsPen: months.reduce((sum, m) => sum + m.PEN.count, 0),
    totalDocsUsd: months.reduce((sum, m) => sum + m.USD.count, 0),
  };
};

/** Tasa de referencia USD → PEN usada solo para calcular proporciones visuales. */
const USD_TO_PEN_RATE = 3.5;

/** Convierte un importe en su moneda a PEN equivalente (solo para proporciones). */
const toPenEquivalent = (amount: number, cur: 'PEN' | 'USD') =>
  cur === 'USD' ? amount * USD_TO_PEN_RATE : amount;

const formatCurrency = (amount?: string, currency = 'PEN') => {
  if (amount === undefined || amount === null || amount === '') return '-';
  const num = Number(amount);
  if (Number.isNaN(num)) return amount;
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
};

const formatInt = (n?: number | string) => {
  if (n === undefined || n === null) return '0';
  const num = typeof n === 'string' ? Number(n) : n;
  if (Number.isNaN(num)) return String(n);
  return new Intl.NumberFormat('es-PE').format(num);
};

const formatPeriodo = (per?: string) => {
  if (!per || per.length !== 6) return per ?? '-';
  return `${per.slice(0, 4)}-${per.slice(4, 6)}`;
};

const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getDateRange = (
  filter: DateFilter,
  customStart: Date,
  customEnd: Date
): { fechaFrom: string; fechaTo: string } => {
  const now = new Date();
  let start: Date;
  let end: Date;
  switch (filter) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate());
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate());
      break;
    }
    case 'week': {
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start = new Date(now);
      start.setDate(now.getDate() - diff);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      break;
    }
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
      break;
    case 'custom':
      start = customStart;
      end = customEnd;
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  return { fechaFrom: toISODate(start), fechaTo: toISODate(end) };
};

const yearRange = (): { fechaFrom: string; fechaTo: string } => {
  const now = new Date();
  return {
    fechaFrom: toISODate(new Date(now.getFullYear(), 0, 1)),
    fechaTo: toISODate(new Date(now.getFullYear(), 11, 31)),
  };
};

export const ContaduriaDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  // ============ Filtros globales ============
  const [selectedFilter, setSelectedFilter] = useState<DateFilter>('month');
  const [customStartDate, setCustomStartDate] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [customEndDate, setCustomEndDate] = useState<Date>(() => new Date());
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);

  const dateRange = useMemo(
    () => getDateRange(selectedFilter, customStartDate, customEndDate),
    [selectedFilter, customStartDate, customEndDate]
  );

  // No enviamos `moneda` a los endpoints: el backend siempre retorna PEN y USD
  // en bloques separados. La moneda seleccionada solo se usa para el render.
  const summaryParams = useMemo<GetSireInvoicesSummaryParams>(
    () => ({
      fechaFrom: dateRange.fechaFrom,
      fechaTo: dateRange.fechaTo,
    }),
    [dateRange.fechaFrom, dateRange.fechaTo]
  );

  const yearParams = useMemo<GetSireInvoicesSummaryParams>(() => {
    const y = yearRange();
    return { fechaFrom: y.fechaFrom, fechaTo: y.fechaTo };
  }, []);

  const {
    data: summary,
    isLoading: loadingSummary,
    isFetching: fetchingSummary,
    isError: summaryError,
    error: summaryErrorObj,
    refetch: refetchSummary,
  } = useSireInvoicesSummary(summaryParams);

  const {
    data: yearSummary,
    isLoading: loadingYear,
    refetch: refetchYear,
  } = useSireInvoicesSummary(yearParams);

  // ============ Ventas (RVIE) ============
  const { hasPermission } = usePermissions();
  const canReadSales = hasPermission(PERMISSIONS.SIRE_VENTAS.INVOICES.READ);

  const salesSummaryParams = useMemo<GetSireVentasInvoicesSummaryParams>(
    () => ({ fechaFrom: dateRange.fechaFrom, fechaTo: dateRange.fechaTo }),
    [dateRange.fechaFrom, dateRange.fechaTo]
  );
  const salesYearParams = useMemo<GetSireVentasInvoicesSummaryParams>(() => {
    const y = yearRange();
    return { fechaFrom: y.fechaFrom, fechaTo: y.fechaTo };
  }, []);

  const {
    data: salesSummary,
    isLoading: loadingSalesSummary,
    isError: salesSummaryError,
    error: salesSummaryErrorObj,
    refetch: refetchSalesSummary,
  } = useSireVentasInvoicesSummary(salesSummaryParams, { enabled: canReadSales });

  const {
    data: salesYearSummary,
    isLoading: loadingSalesYear,
    refetch: refetchSalesYear,
  } = useSireVentasInvoicesSummary(salesYearParams, { enabled: canReadSales });

  // ============ Provider modal ============
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [providerPage, setProviderPage] = useState(1);
  const [providerSortBy, setProviderSortBy] = useState<SireProviderSortBy>('importeTotal');
  const [providerSearch, setProviderSearch] = useState('');
  const [pageJumpOpen, setPageJumpOpen] = useState(false);
  const [pageJumpValue, setPageJumpValue] = useState('');

  /** Filtro de moneda: por defecto ambas. */
  const [currencyFilter, setCurrencyFilter] = useState<{ PEN: boolean; USD: boolean }>({
    PEN: true,
    USD: true,
  });
  const toggleCurrency = (cur: 'PEN' | 'USD') => {
    setCurrencyFilter((prev) => {
      const next = { ...prev, [cur]: !prev[cur] };
      // Evitar quedar sin monedas seleccionadas: reactivar la otra.
      if (!next.PEN && !next.USD) return { PEN: true, USD: true };
      return next;
    });
  };

  /** Colapsable: por defecto las secciones arrancan plegadas. */
  const [sectionExpanded, setSectionExpanded] = useState(false);
  const [salesSectionExpanded, setSalesSectionExpanded] = useState(false);

  /** Ancho del gráfico anual (medido dinámicamente para el SVG). */
  const [chartLayoutWidth, setChartLayoutWidth] = useState<number | null>(null);
  const [salesChartLayoutWidth, setSalesChartLayoutWidth] = useState<number | null>(null);

  // ============ Client modal (ventas) ============
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientPage, setClientPage] = useState(1);
  const [clientSortBy, setClientSortBy] = useState<SireVentasClientSortBy>('importeTotal');
  const [clientSearch, setClientSearch] = useState('');
  const [clientPageJumpOpen, setClientPageJumpOpen] = useState(false);
  const [clientPageJumpValue, setClientPageJumpValue] = useState('');

  const providerParams = useMemo(
    () => ({
      ...summaryParams,
      sortBy: providerSortBy,
      sortDir: 'DESC' as const,
      limit: DEFAULT_PROVIDER_LIMIT,
      offset: (providerPage - 1) * DEFAULT_PROVIDER_LIMIT,
    }),
    [providerPage, providerSortBy, summaryParams]
  );

  const {
    data: providersData,
    isLoading: loadingProviders,
    isFetching: fetchingProviders,
    isError: providerError,
    refetch: refetchProviders,
  } = useSireInvoicesSummaryByProvider(providerParams, { enabled: providerModalOpen });

  const openProviderModal = useCallback(() => {
    setProviderPage(1);
    setProviderModalOpen(true);
  }, []);
  const closeProviderModal = useCallback(() => {
    setProviderModalOpen(false);
    setProviderSearch('');
  }, []);

  const providerItems = providersData?.items ?? [];
  const providerTotal = providersData?.total ?? 0;
  const providerTotalPages = Math.max(1, Math.ceil(providerTotal / DEFAULT_PROVIDER_LIMIT));

  const filteredProviderItems = useMemo(() => {
    if (!providerSearch.trim()) return providerItems;
    const q = providerSearch.trim().toLowerCase();
    return providerItems.filter(
      (i) =>
        i.razonSocialProveedor.toLowerCase().includes(q) || i.rucProveedor.toLowerCase().includes(q)
    );
  }, [providerItems, providerSearch]);

  // ============ Client modal query (ventas) ============
  const clientParams = useMemo(
    () => ({
      ...salesSummaryParams,
      sortBy: clientSortBy,
      sortDir: 'DESC' as const,
      limit: DEFAULT_CLIENT_LIMIT,
      offset: (clientPage - 1) * DEFAULT_CLIENT_LIMIT,
    }),
    [clientPage, clientSortBy, salesSummaryParams]
  );

  const {
    data: clientsData,
    isLoading: loadingClients,
    isFetching: fetchingClients,
    isError: clientError,
    refetch: refetchClients,
  } = useSireVentasInvoicesSummaryByClient(clientParams, {
    enabled: clientModalOpen && canReadSales,
  });

  const openClientModal = useCallback(() => {
    setClientPage(1);
    setClientModalOpen(true);
  }, []);
  const closeClientModal = useCallback(() => {
    setClientModalOpen(false);
    setClientSearch('');
  }, []);

  const clientItems = clientsData?.items ?? [];
  const clientTotal = clientsData?.total ?? 0;
  const clientTotalPages = Math.max(1, Math.ceil(clientTotal / DEFAULT_CLIENT_LIMIT));

  const filteredClientItems = useMemo(() => {
    if (!clientSearch.trim()) return clientItems;
    const q = clientSearch.trim().toLowerCase();
    return clientItems.filter(
      (i) =>
        i.razonSocialCliente.toLowerCase().includes(q) || i.numDocCliente.toLowerCase().includes(q)
    );
  }, [clientItems, clientSearch]);

  const openClientPageJump = useCallback(() => {
    setClientPageJumpValue(String(clientPage));
    setClientPageJumpOpen(true);
  }, [clientPage]);
  const confirmClientPageJump = useCallback(() => {
    const n = Math.max(1, Math.min(clientTotalPages, parseInt(clientPageJumpValue, 10) || 1));
    setClientPage(n);
    setClientPageJumpOpen(false);
  }, [clientPageJumpValue, clientTotalPages]);

  // Monedas con datos en el período seleccionado (respetando filtro de moneda)
  const visibleCurrencies = useMemo(
    () =>
      CURRENCIES.filter((c) => {
        if (!currencyFilter[c]) return false;
        const t = summary?.totals?.[c];
        return t ? t.count > 0 : false;
      }),
    [summary?.totals, currencyFilter]
  );

  // Monedas con datos en el año en curso (respetando filtro de moneda)
  const visibleYearCurrencies = useMemo(
    () =>
      CURRENCIES.filter((c) => {
        if (!currencyFilter[c]) return false;
        const t = yearSummary?.totals?.[c];
        return t ? t.count > 0 : false;
      }),
    [yearSummary?.totals, currencyFilter]
  );

  const hasSummaryData = visibleCurrencies.length > 0;

  // ============ Normalización + monedas visibles (ventas) ============
  const normalizedCompras = useMemo(
    () => (summary ? normalizeComprasSummary(summary) : null),
    [summary]
  );
  const normalizedVentas = useMemo(
    () => (salesSummary ? normalizeVentasSummary(salesSummary) : null),
    [salesSummary]
  );

  const salesVisibleCurrencies = useMemo(
    () =>
      CURRENCIES.filter((c) => {
        if (!currencyFilter[c]) return false;
        const t = salesSummary?.totals?.[c];
        return t ? t.count > 0 : false;
      }),
    [salesSummary?.totals, currencyFilter]
  );

  const salesVisibleYearCurrencies = useMemo(
    () =>
      CURRENCIES.filter((c) => {
        if (!currencyFilter[c]) return false;
        const t = salesYearSummary?.totals?.[c];
        return t ? t.count > 0 : false;
      }),
    [salesYearSummary?.totals, currencyFilter]
  );

  const hasSalesData = salesVisibleCurrencies.length > 0;

  const handleRefresh = useCallback(() => {
    void refetchSummary();
    void refetchYear();
    if (canReadSales) {
      void refetchSalesSummary();
      void refetchSalesYear();
    }
  }, [refetchSummary, refetchYear, refetchSalesSummary, refetchSalesYear, canReadSales]);

  const openPageJump = useCallback(() => {
    setPageJumpValue(String(providerPage));
    setPageJumpOpen(true);
  }, [providerPage]);

  const confirmPageJump = useCallback(() => {
    const n = Math.max(1, Math.min(providerTotalPages, parseInt(pageJumpValue, 10) || 1));
    setProviderPage(n);
    setPageJumpOpen(false);
  }, [pageJumpValue, providerTotalPages]);

  // ============ Date filter chip ============
  const renderFilterButton = (filter: DateFilter, label: string) => (
    <TouchableOpacity
      key={filter}
      style={[styles.filterButton, selectedFilter === filter && styles.filterButtonActive]}
      onPress={() => {
        if (filter === 'custom') {
          setShowDateRangePicker(true);
        } else {
          setSelectedFilter(filter);
        }
      }}
      activeOpacity={0.75}
    >
      <RNText
        style={[
          styles.filterButtonText,
          selectedFilter === filter && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </RNText>
    </TouchableOpacity>
  );

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
        return `${dateRange.fechaFrom} → ${dateRange.fechaTo}`;
      default:
        return 'Este Mes';
    }
  };

  // ============ KPI card ============
  const renderKpi = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    value: string,
    accent: string,
    subtitle?: string
  ) => (
    <View style={[styles.kpi, { borderLeftColor: accent }]}>
      <View style={[styles.kpiIconBox, { backgroundColor: `${accent}22` }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Caption color={theme.color.text.muted}>{label}</Caption>
      <Title size="small" style={{ marginTop: 2 }}>
        {value}
      </Title>
      {subtitle ? <Caption color={theme.color.text.muted}>{subtitle}</Caption> : null}
    </View>
  );

  // ============ Distribution row (period) ============

  const renderCpeRow = (item: SireSummaryByTipoCpe) => {
    const label = CPE_LABELS[item.tipoCpe] || `Tipo ${item.tipoCpe}`;
    return (
      <View key={item.tipoCpe} style={styles.cpeRow}>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '600' }}>{label}</Body>
          <Caption color={theme.color.text.muted}>
            Código {item.tipoCpe} · {formatInt(item.count)} docs
          </Caption>
        </View>
        <Body style={{ fontWeight: '600' }}>{formatInt(item.count)}</Body>
      </View>
    );
  };

  // ============ Yearly monthly bar chart (por moneda) ============
  const currentMonthIdx = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const yearMonthlyUnified = useMemo(
    () => buildYearMonthly(yearSummary?.byPeriodo ?? [], currentYear),
    [yearSummary?.byPeriodo, currentYear]
  );

  const salesYearMonthlyUnified = useMemo(
    () => buildYearMonthly(salesYearSummary?.byPeriodo ?? [], currentYear),
    [salesYearSummary?.byPeriodo, currentYear]
  );

  // ============ Resumen unificado (KPIs + Facturas vs NC + X por período) ============
  const renderUnifiedSummary = (data: NormalizedSummary, curs: Currency[], noun: string) => {
    if (!curs.length) {
      return (
        <EmptyState
          icon="stats-chart-outline"
          title="Sin datos"
          description="No hay comprobantes para las monedas seleccionadas."
        />
      );
    }

    // KPIs agregados
    const totalDocs = curs.reduce((s, c) => s + (data.totals[c]?.count ?? 0), 0);
    const totalFacturasDocs = curs.reduce((s, c) => s + (data.facturas?.[c]?.count ?? 0), 0);
    const totalNCDocs = curs.reduce((s, c) => s + (data.notasCredito?.[c]?.count ?? 0), 0);

    // Filas de KPI por concepto (Base, IGV, Importe) mostrando por moneda visible
    const renderCurrencyLines = (
      getAmount: (cur: 'PEN' | 'USD') => string | undefined,
      color?: string
    ) =>
      curs.map((cur) => {
        const accent = CURRENCY_ACCENTS[cur];
        return (
          <View key={cur} style={styles.kpiCurrencyLine}>
            <View style={[styles.kpiCurrencyDot, { backgroundColor: accent }]} />
            <RNText style={[styles.kpiCurrencyText, color ? { color } : null]}>
              {formatCurrency(getAmount(cur) ?? '0', cur)}
            </RNText>
          </View>
        );
      });

    // Compras por período unificado: agrupar por perTributario
    const periodMap = new Map<
      string,
      { perTributario: string; PEN?: SireSummaryByPeriodo; USD?: SireSummaryByPeriodo }
    >();
    (data.byPeriodo ?? []).forEach((p) => {
      if (p.moneda !== 'PEN' && p.moneda !== 'USD') return;
      if (!curs.includes(p.moneda)) return;
      const entry = periodMap.get(p.perTributario) ?? { perTributario: p.perTributario };
      entry[p.moneda] = p;
      periodMap.set(p.perTributario, entry);
    });
    const unifiedPeriods = Array.from(periodMap.values()).sort((a, b) =>
      b.perTributario.localeCompare(a.perTributario)
    );
    // Máximo en PEN-equivalente para escalar barras
    const maxPenEq = unifiedPeriods.reduce((max, row) => {
      const pen = Number(row.PEN?.importeTotal ?? 0);
      const usd = Number(row.USD?.importeTotal ?? 0);
      return Math.max(max, toPenEquivalent(pen, 'PEN') + toPenEquivalent(usd, 'USD'));
    }, 0);

    return (
      <>
        {/* KPIs unificados */}
        <Card style={styles.blockCard}>
          <View style={styles.blockHeader}>
            <Ionicons name="pulse-outline" size={18} color={theme.color.brand.accent} />
            <Title size="small">Resumen del período</Title>
          </View>
          <View style={styles.kpisGrid}>
            {renderKpi(
              'document-text-outline',
              'Comprobantes',
              formatInt(totalDocs),
              theme.color.brand.accent,
              `${formatInt(totalFacturasDocs)} facturas · ${formatInt(totalNCDocs)} NC`
            )}
            <View style={styles.kpiMulti}>
              <View style={styles.kpiHeader}>
                <Ionicons name="cash-outline" size={16} color="#10B981" />
                <Caption color={theme.color.text.muted}>Base imponible</Caption>
              </View>
              {renderCurrencyLines((cur) => data.totals[cur]?.baseImponible)}
            </View>
            <View style={styles.kpiMulti}>
              <View style={styles.kpiHeader}>
                <Ionicons name="calculator-outline" size={16} color="#F59E0B" />
                <Caption color={theme.color.text.muted}>IGV</Caption>
              </View>
              {renderCurrencyLines((cur) => data.totals[cur]?.igv)}
            </View>
            <View style={styles.kpiMulti}>
              <View style={styles.kpiHeader}>
                <Ionicons name="wallet-outline" size={16} color="#8B5CF6" />
                <Caption color={theme.color.text.muted}>Importe neto</Caption>
              </View>
              {renderCurrencyLines((cur) => data.totals[cur]?.importeTotal)}
            </View>
          </View>
        </Card>

        {/* Facturas vs NC unificado */}
        <Card style={styles.blockCard}>
          <View style={styles.blockHeader}>
            <Ionicons name="swap-vertical-outline" size={18} color={theme.color.brand.accent} />
            <Title size="small">Facturas vs Notas de crédito</Title>
          </View>
          <View style={styles.breakdownRow}>
            <View style={[styles.breakdownCell, { borderLeftColor: '#10B981' }]}>
              <View style={styles.breakdownHeader}>
                <Ionicons name="receipt-outline" size={16} color="#10B981" />
                <Caption color={theme.color.text.muted}>
                  Facturas · {formatInt(totalFacturasDocs)} docs
                </Caption>
              </View>
              {curs.map((cur) => {
                const b = data.facturas?.[cur];
                if (!b || b.count === 0) return null;
                const accent = CURRENCY_ACCENTS[cur];
                return (
                  <View key={`f-${cur}`} style={styles.breakdownCurrencyRow}>
                    <View style={[styles.kpiCurrencyDot, { backgroundColor: accent }]} />
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: '700' }}>
                        {formatCurrency(b.importeTotal, cur)}
                      </Body>
                      <Caption color={theme.color.text.muted}>
                        {formatInt(b.count)} docs · IGV {formatCurrency(b.igv, cur)}
                      </Caption>
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={[styles.breakdownCell, { borderLeftColor: '#EF4444' }]}>
              <View style={styles.breakdownHeader}>
                <Ionicons name="arrow-undo-outline" size={16} color="#EF4444" />
                <Caption color={theme.color.text.muted}>
                  Notas de crédito · {formatInt(totalNCDocs)} docs
                </Caption>
              </View>
              {curs.map((cur) => {
                const b = data.notasCredito?.[cur];
                if (!b || b.count === 0) return null;
                const accent = CURRENCY_ACCENTS[cur];
                return (
                  <View key={`nc-${cur}`} style={styles.breakdownCurrencyRow}>
                    <View style={[styles.kpiCurrencyDot, { backgroundColor: accent }]} />
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: '700', color: '#EF4444' }}>
                        − {formatCurrency(b.importeTotal, cur)}
                      </Body>
                      <Caption color={theme.color.text.muted}>
                        {formatInt(b.count)} docs · IGV {formatCurrency(b.igv, cur)}
                      </Caption>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </Card>

        {/* Compras por período unificado */}
        {unifiedPeriods.length ? (
          <Card style={styles.blockCard}>
            <View style={styles.blockHeader}>
              <Ionicons name="bar-chart-outline" size={18} color={theme.color.brand.accent} />
              <View style={{ flex: 1 }}>
                <Title size="small">{noun} por período</Title>
                <Caption color={theme.color.text.muted}>
                  Proporciones a tasa referencial 1 USD ≈ {USD_TO_PEN_RATE} PEN
                </Caption>
              </View>
            </View>
            <View style={{ gap: spacing[3] }}>
              {unifiedPeriods.map((row) => {
                const pen = Number(row.PEN?.importeTotal ?? 0);
                const usd = Number(row.USD?.importeTotal ?? 0);
                const totalPenEq = toPenEquivalent(pen, 'PEN') + toPenEquivalent(usd, 'USD');
                const ratio = maxPenEq > 0 ? Math.max(0, totalPenEq / maxPenEq) : 0;
                const totalDocsPeriod = (row.PEN?.count ?? 0) + (row.USD?.count ?? 0);
                const penRatio = totalPenEq > 0 ? toPenEquivalent(pen, 'PEN') / totalPenEq : 0;
                return (
                  <View key={row.perTributario} style={styles.unifiedPeriodRow}>
                    <View style={styles.unifiedPeriodHeader}>
                      <Body style={{ fontWeight: '600' }}>{formatPeriodo(row.perTributario)}</Body>
                      <Caption color={theme.color.text.muted}>
                        {formatInt(totalDocsPeriod)} docs
                      </Caption>
                    </View>
                    <View style={styles.unifiedPeriodBar}>
                      {curs.includes('PEN') && penRatio > 0 ? (
                        <View
                          style={{
                            flex: penRatio,
                            backgroundColor: CURRENCY_ACCENTS.PEN,
                            height: '100%',
                          }}
                        />
                      ) : null}
                      {curs.includes('USD') && penRatio < 1 ? (
                        <View
                          style={{
                            flex: 1 - penRatio,
                            backgroundColor: CURRENCY_ACCENTS.USD,
                            height: '100%',
                          }}
                        />
                      ) : null}
                      <View
                        style={{ flex: Math.max(0.001, 1 - ratio), backgroundColor: 'transparent' }}
                      />
                    </View>
                    <View style={styles.unifiedPeriodAmounts}>
                      {curs.includes('PEN') ? (
                        <View style={styles.unifiedAmountChip}>
                          <View
                            style={[
                              styles.kpiCurrencyDot,
                              { backgroundColor: CURRENCY_ACCENTS.PEN },
                            ]}
                          />
                          <Caption color={theme.color.text.body}>
                            {pen > 0 ? formatCurrency(String(pen), 'PEN') : '—'}
                          </Caption>
                        </View>
                      ) : null}
                      {curs.includes('USD') ? (
                        <View style={styles.unifiedAmountChip}>
                          <View
                            style={[
                              styles.kpiCurrencyDot,
                              { backgroundColor: CURRENCY_ACCENTS.USD },
                            ]}
                          />
                          <Caption color={theme.color.text.body}>
                            {usd > 0 ? formatCurrency(String(usd), 'USD') : '—'}
                          </Caption>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {/* Por tipo de comprobante */}
        {data.byTipoCpe?.length ? (
          <Card style={styles.blockCard}>
            <View style={styles.blockHeader}>
              <Ionicons name="pricetags-outline" size={18} color={theme.color.text.body} />
              <Title size="small">Por tipo de comprobante</Title>
            </View>
            <View style={{ gap: spacing[2] }}>{data.byTipoCpe.map(renderCpeRow)}</View>
          </Card>
        ) : null}
      </>
    );
  };

  const renderUnifiedMonthlyChart = (
    monthly: YearMonthlyData,
    layoutWidth: number | null,
    onLayoutWidth: (w: number) => void,
    noun: string
  ) => {
    const CHART_HEIGHT = 220;
    const PAD_TOP = 18;
    const PAD_BOTTOM = 28;
    const PAD_LEFT = 12;
    const PAD_RIGHT = 12;
    const { months, accPen, accUsd, totalDocsPen, totalDocsUsd } = monthly;
    const penAccent = CURRENCY_ACCENTS.PEN;
    const usdAccent = CURRENCY_ACCENTS.USD;
    const showPen = currencyFilter.PEN;
    const showUsd = currencyFilter.USD;

    // Máximos por moneda (cada línea se normaliza a su propio máximo para
    // que ambas curvas se lean bien aunque tengan magnitudes muy distintas)
    const maxPen = months.reduce((mx, m) => Math.max(mx, m.PEN.importeTotal), 0);
    const maxUsd = months.reduce((mx, m) => Math.max(mx, m.USD.importeTotal), 0);

    const rows = months.filter(
      (m) => m.PEN.importeTotal > 0 || m.USD.importeTotal > 0 || m.PEN.count > 0 || m.USD.count > 0
    );

    // Ancho del svg: usamos onLayout del contenedor para adaptarnos.
    const chartWidth = layoutWidth ?? 320;
    const innerW = Math.max(1, chartWidth - PAD_LEFT - PAD_RIGHT);
    const innerH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
    const stepX = months.length > 1 ? innerW / (months.length - 1) : 0;

    const buildPoints = (getVal: (idx: number) => number, max: number) =>
      months.map((m, i) => {
        const v = getVal(i);
        const ratio = max > 0 ? v / max : 0;
        const x = PAD_LEFT + i * stepX;
        const y = PAD_TOP + innerH * (1 - ratio);
        return { x, y, v, idx: i, month: m.month };
      });

    const penPoints = buildPoints((i) => months[i].PEN.importeTotal, maxPen);
    const usdPoints = buildPoints((i) => months[i].USD.importeTotal, maxUsd);

    const toLinePath = (pts: { x: number; y: number }[]) => {
      if (!pts.length) return '';
      // Curva suave con Bezier cúbicas (Catmull-Rom → Bezier).
      const parts: string[] = [`M ${pts[0].x} ${pts[0].y}`];
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i === 0 ? i : i - 1];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
        const smooth = 0.18;
        const c1x = p1.x + (p2.x - p0.x) * smooth;
        const c1y = p1.y + (p2.y - p0.y) * smooth;
        const c2x = p2.x - (p3.x - p1.x) * smooth;
        const c2y = p2.y - (p3.y - p1.y) * smooth;
        parts.push(`C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`);
      }
      return parts.join(' ');
    };

    const toAreaPath = (pts: { x: number; y: number }[]) => {
      if (!pts.length) return '';
      const line = toLinePath(pts);
      const last = pts[pts.length - 1];
      const first = pts[0];
      const baseY = PAD_TOP + innerH;
      return `${line} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
    };

    // Líneas de grilla horizontales (25%, 50%, 75%, 100%)
    const gridYs = [0.25, 0.5, 0.75, 1].map((r) => PAD_TOP + innerH * (1 - r));

    return (
      <Card key="chart-unified" style={styles.blockCard}>
        <View style={styles.blockHeader}>
          <Ionicons name="stats-chart-outline" size={18} color={theme.color.brand.accent} />
          <View style={{ flex: 1 }}>
            <Title size="small">
              {noun} por mes · {currentYear}
            </Title>
            <Caption color={theme.color.text.muted}>
              {showPen ? `Acumulado ${formatCurrency(String(accPen), 'PEN')}` : ''}
              {showPen && showUsd ? ' · ' : ''}
              {showUsd ? formatCurrency(String(accUsd), 'USD') : ''}
            </Caption>
          </View>
        </View>

        {/* Leyenda */}
        <View style={styles.legendRow}>
          {showPen ? (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: penAccent }]} />
              <Caption color={theme.color.text.muted}>Soles (PEN)</Caption>
            </View>
          ) : null}
          {showUsd ? (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: usdAccent }]} />
              <Caption color={theme.color.text.muted}>Dólares (USD)</Caption>
            </View>
          ) : null}
        </View>

        <View style={{ width: '100%' }} onLayout={(e) => onLayoutWidth(e.nativeEvent.layout.width)}>
          <Svg width={chartWidth} height={CHART_HEIGHT}>
            <Defs>
              <SvgLinearGradient id="penGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={penAccent} stopOpacity={0.35} />
                <Stop offset="1" stopColor={penAccent} stopOpacity={0} />
              </SvgLinearGradient>
              <SvgLinearGradient id="usdGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={usdAccent} stopOpacity={0.35} />
                <Stop offset="1" stopColor={usdAccent} stopOpacity={0} />
              </SvgLinearGradient>
            </Defs>

            {/* Grilla */}
            {gridYs.map((y, i) => (
              <SvgLine
                key={`grid-${i}`}
                x1={PAD_LEFT}
                x2={chartWidth - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke={theme.color.border.default}
                strokeWidth={1}
                strokeDasharray="3,4"
                opacity={0.6}
              />
            ))}

            {/* Área PEN */}
            {showPen && maxPen > 0 ? <Path d={toAreaPath(penPoints)} fill="url(#penGrad)" /> : null}
            {/* Área USD */}
            {showUsd && maxUsd > 0 ? <Path d={toAreaPath(usdPoints)} fill="url(#usdGrad)" /> : null}

            {/* Línea PEN */}
            {showPen && maxPen > 0 ? (
              <Path
                d={toLinePath(penPoints)}
                stroke={penAccent}
                strokeWidth={2.5}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {/* Línea USD */}
            {showUsd && maxUsd > 0 ? (
              <Path
                d={toLinePath(usdPoints)}
                stroke={usdAccent}
                strokeWidth={2.5}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}

            {/* Puntos + mes actual resaltado */}
            {showPen && maxPen > 0
              ? penPoints.map((p) => {
                  const isCurrent = p.month === currentMonthIdx;
                  const r = isCurrent ? 5 : 3;
                  return p.v > 0 ? (
                    <Circle
                      key={`pen-dot-${p.idx}`}
                      cx={p.x}
                      cy={p.y}
                      r={r}
                      fill={theme.color.surface.base}
                      stroke={penAccent}
                      strokeWidth={isCurrent ? 3 : 2}
                    />
                  ) : null;
                })
              : null}
            {showUsd && maxUsd > 0
              ? usdPoints.map((p) => {
                  const isCurrent = p.month === currentMonthIdx;
                  const r = isCurrent ? 5 : 3;
                  return p.v > 0 ? (
                    <Circle
                      key={`usd-dot-${p.idx}`}
                      cx={p.x}
                      cy={p.y}
                      r={r}
                      fill={theme.color.surface.base}
                      stroke={usdAccent}
                      strokeWidth={isCurrent ? 3 : 2}
                    />
                  ) : null;
                })
              : null}

            {/* Etiquetas de meses en el eje X */}
            {months.map((m, i) => {
              const x = PAD_LEFT + i * stepX;
              const y = CHART_HEIGHT - 8;
              const isCurrent = m.month === currentMonthIdx;
              return (
                <SvgText
                  key={`lbl-${m.key}`}
                  x={x}
                  y={y}
                  fontSize={10}
                  fill={isCurrent ? theme.color.brand.accent : theme.color.text.muted}
                  fontWeight={isCurrent ? 'bold' : 'normal'}
                  textAnchor="middle"
                >
                  {m.label}
                </SvgText>
              );
            })}
          </Svg>
        </View>

        {/* Tabla detalle mensual unificada */}
        <View style={styles.monthlyTable}>
          <View style={styles.monthlyHeaderRow}>
            <View style={styles.monthlyLabelCol}>
              <Caption color={theme.color.text.muted}>Mes</Caption>
            </View>
            {showPen ? (
              <View style={styles.monthlyAmountCol}>
                <Caption color={theme.color.text.muted}>Soles</Caption>
              </View>
            ) : null}
            {showUsd ? (
              <View style={styles.monthlyAmountCol}>
                <Caption color={theme.color.text.muted}>Dólares</Caption>
              </View>
            ) : null}
          </View>
          {rows.length === 0 ? (
            <View style={{ paddingVertical: spacing[3] }}>
              <Caption color={theme.color.text.muted}>Sin datos para {currentYear}</Caption>
            </View>
          ) : (
            rows.map((m) => (
              <View key={`row-${m.key}`} style={styles.monthlyRow}>
                <View style={styles.monthlyLabelCol}>
                  <Body style={{ fontWeight: '600' }}>
                    {m.label} {currentYear}
                  </Body>
                  <Caption color={theme.color.text.muted}>
                    {formatInt(m.PEN.count + m.USD.count)} docs
                  </Caption>
                </View>
                {showPen ? (
                  <View style={styles.monthlyAmountCol}>
                    <Body
                      style={{
                        fontWeight: '600',
                        color: m.PEN.importeTotal > 0 ? penAccent : theme.color.text.muted,
                      }}
                    >
                      {m.PEN.importeTotal > 0
                        ? formatCurrency(String(m.PEN.importeTotal), 'PEN')
                        : '—'}
                    </Body>
                    {m.PEN.count > 0 ? (
                      <Caption color={theme.color.text.muted}>
                        {formatInt(m.PEN.count)} docs
                      </Caption>
                    ) : null}
                  </View>
                ) : null}
                {showUsd ? (
                  <View style={styles.monthlyAmountCol}>
                    <Body
                      style={{
                        fontWeight: '600',
                        color: m.USD.importeTotal > 0 ? usdAccent : theme.color.text.muted,
                      }}
                    >
                      {m.USD.importeTotal > 0
                        ? formatCurrency(String(m.USD.importeTotal), 'USD')
                        : '—'}
                    </Body>
                    {m.USD.count > 0 ? (
                      <Caption color={theme.color.text.muted}>
                        {formatInt(m.USD.count)} docs
                      </Caption>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))
          )}
          {rows.length > 0 ? (
            <View style={[styles.monthlyRow, styles.monthlyTotalRow]}>
              <View style={styles.monthlyLabelCol}>
                <Body style={{ fontWeight: '700' }}>Total {currentYear}</Body>
                <Caption color={theme.color.text.muted}>
                  {formatInt((showPen ? totalDocsPen : 0) + (showUsd ? totalDocsUsd : 0))} docs
                </Caption>
              </View>
              {showPen ? (
                <View style={styles.monthlyAmountCol}>
                  <Body style={{ fontWeight: '700', color: penAccent }}>
                    {formatCurrency(String(accPen), 'PEN')}
                  </Body>
                </View>
              ) : null}
              {showUsd ? (
                <View style={styles.monthlyAmountCol}>
                  <Body style={{ fontWeight: '700', color: usdAccent }}>
                    {formatCurrency(String(accUsd), 'USD')}
                  </Body>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        {/* Header alineado al patrón global (gradient + badge) */}
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
                  <Ionicons name="stats-chart" size={20} color={theme.color.brand.onHeader} />
                </View>
                <RNText style={styles.title}>Dashboard Contaduría</RNText>
              </View>
              <RNText style={styles.subtitle} numberOfLines={1}>
                {getFilterLabel(selectedFilter)} · Soles y Dólares
              </RNText>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={fetchingSummary} onRefresh={handleRefresh} />}
        >
          {/* ===== Sección Compras Mapeadas Sunat =====
              Engloba: filtros de fecha + KPIs + facturas vs NC + por período +
              por tipo de CPE + gráfico anual + detalle por proveedor.
              Colapsable — por defecto plegada. */}
          <View style={styles.sectionContainer}>
            {/* Franja superior con branding + acciones + toggle */}
            <TouchableOpacity
              style={styles.sectionBanner}
              onPress={() => setSectionExpanded((v) => !v)}
              activeOpacity={0.9}
            >
              <View style={styles.sectionHeaderIcon}>
                <Ionicons name="shield-checkmark" size={24} color={theme.color.brand.onHeader} />
              </View>
              <View style={styles.sectionTitleColumn}>
                <RNText style={styles.sectionEyebrow}>Contaduría · SUNAT</RNText>
                <RNText style={styles.sectionTitleLarge}>Compras Mapeadas Sunat</RNText>
                <RNText style={styles.sectionSubtitle}>
                  Registro de compras (RCE) del período seleccionado
                </RNText>
              </View>
              <View style={styles.sectionActions}>
                <TouchableOpacity
                  style={styles.sectionAction}
                  onPress={openProviderModal}
                  activeOpacity={0.85}
                >
                  <Ionicons name="people-outline" size={16} color={theme.color.brand.onHeader} />
                  <RNText style={styles.sectionActionText}>Detalle por proveedor</RNText>
                </TouchableOpacity>
                <View style={styles.sectionChevron}>
                  <Ionicons
                    name={sectionExpanded ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color={theme.color.brand.onHeader}
                  />
                </View>
              </View>
            </TouchableOpacity>

            {sectionExpanded ? (
              /* Contenido de la sección */
              <View style={styles.sectionBody}>
                {/* Filtro de moneda */}
                <View style={styles.currencyFilterRow}>
                  <RNText style={styles.filtersLabel}>Moneda</RNText>
                  <View style={styles.currencyChips}>
                    {(['PEN', 'USD'] as const).map((cur) => {
                      const active = currencyFilter[cur];
                      const accent = CURRENCY_ACCENTS[cur];
                      return (
                        <TouchableOpacity
                          key={cur}
                          style={[
                            styles.currencyChip,
                            active && { backgroundColor: `${accent}1A`, borderColor: accent },
                          ]}
                          onPress={() => toggleCurrency(cur)}
                          activeOpacity={0.8}
                        >
                          <RNText
                            style={[
                              styles.currencyChipText,
                              active && { color: accent, fontWeight: '700' },
                            ]}
                          >
                            {cur === 'PEN' ? 'S/ Soles' : '$ Dólares'}
                          </RNText>
                          {active ? (
                            <Ionicons name="checkmark-circle" size={14} color={accent} />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Filtros de fecha */}
                <View style={styles.filtersSection}>
                  <RNText style={styles.filtersLabel}>Filtros</RNText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
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

                {loadingSummary ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={theme.color.brand.accent} />
                  </View>
                ) : summaryError ? (
                  <ErrorState
                    title="No se pudo cargar el resumen"
                    description={(summaryErrorObj as Error)?.message ?? 'Intenta nuevamente'}
                    onRetry={() => refetchSummary()}
                  />
                ) : !hasSummaryData || !normalizedCompras ? (
                  <EmptyState
                    icon="stats-chart-outline"
                    title="Sin compras"
                    description="No se registran compras en el período seleccionado."
                  />
                ) : (
                  renderUnifiedSummary(normalizedCompras, visibleCurrencies, 'Compras')
                )}

                {/* Gráfico anual mensual unificado (PEN + USD) */}
                {loadingYear ? (
                  <View style={styles.loadingBoxSmall}>
                    <ActivityIndicator size="small" color={theme.color.brand.accent} />
                  </View>
                ) : visibleYearCurrencies.length ? (
                  renderUnifiedMonthlyChart(
                    yearMonthlyUnified,
                    chartLayoutWidth,
                    setChartLayoutWidth,
                    'Compras'
                  )
                ) : null}
              </View>
            ) : null}
          </View>

          {/* ===== Sección Ventas Mapeadas por SUNAT (RVIE) ===== */}
          {canReadSales ? (
            <View style={styles.sectionContainer}>
              <TouchableOpacity
                style={[styles.sectionBanner, styles.sectionBannerSales]}
                onPress={() => setSalesSectionExpanded((v) => !v)}
                activeOpacity={0.9}
              >
                <View style={styles.sectionHeaderIcon}>
                  <Ionicons name="trending-up" size={24} color={theme.color.brand.onHeader} />
                </View>
                <View style={styles.sectionTitleColumn}>
                  <RNText style={styles.sectionEyebrow}>Contaduría · SUNAT</RNText>
                  <RNText style={styles.sectionTitleLarge}>Ventas Mapeadas por SUNAT</RNText>
                  <RNText style={styles.sectionSubtitle}>
                    Registro de ventas (RVIE) del período seleccionado
                  </RNText>
                </View>
                <View style={styles.sectionActions}>
                  <TouchableOpacity
                    style={styles.sectionAction}
                    onPress={openClientModal}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="people-outline" size={16} color={theme.color.brand.onHeader} />
                    <RNText style={styles.sectionActionText}>Detalle por cliente</RNText>
                  </TouchableOpacity>
                  <View style={styles.sectionChevron}>
                    <Ionicons
                      name={salesSectionExpanded ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color={theme.color.brand.onHeader}
                    />
                  </View>
                </View>
              </TouchableOpacity>

              {salesSectionExpanded ? (
                <View style={styles.sectionBody}>
                  <View style={styles.currencyFilterRow}>
                    <RNText style={styles.filtersLabel}>Moneda</RNText>
                    <View style={styles.currencyChips}>
                      {CURRENCY_KEYS.map((cur) => {
                        const active = currencyFilter[cur];
                        const accent = CURRENCY_ACCENTS[cur];
                        const label = `${CURRENCY_SYMBOLS[cur]} ${cur === 'PEN' ? 'Soles' : 'Dólares'}`;
                        return (
                          <TouchableOpacity
                            key={`sales-${cur}`}
                            style={[
                              styles.currencyChip,
                              active && { backgroundColor: `${accent}1A`, borderColor: accent },
                            ]}
                            onPress={() => toggleCurrency(cur)}
                            activeOpacity={0.8}
                          >
                            <RNText
                              style={[
                                styles.currencyChipText,
                                active && { color: accent, fontWeight: '700' },
                              ]}
                            >
                              {label}
                            </RNText>
                            {active ? (
                              <Ionicons name="checkmark-circle" size={14} color={accent} />
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.filtersSection}>
                    <RNText style={styles.filtersLabel}>Filtros</RNText>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
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

                  {loadingSalesSummary ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator size="large" color={theme.color.brand.accent} />
                    </View>
                  ) : salesSummaryError ? (
                    <ErrorState
                      title="No se pudo cargar el resumen"
                      description={(salesSummaryErrorObj as Error)?.message ?? 'Intenta nuevamente'}
                      onRetry={() => refetchSalesSummary()}
                    />
                  ) : !hasSalesData || !normalizedVentas ? (
                    <EmptyState
                      icon="stats-chart-outline"
                      title="Sin ventas"
                      description="No se registran ventas en el período seleccionado."
                    />
                  ) : (
                    renderUnifiedSummary(normalizedVentas, salesVisibleCurrencies, 'Ventas')
                  )}

                  {loadingSalesYear ? (
                    <View style={styles.loadingBoxSmall}>
                      <ActivityIndicator size="small" color={theme.color.brand.accent} />
                    </View>
                  ) : salesVisibleYearCurrencies.length ? (
                    renderUnifiedMonthlyChart(
                      salesYearMonthlyUnified,
                      salesChartLayoutWidth,
                      setSalesChartLayoutWidth,
                      'Ventas'
                    )
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {/* ================= Provider modal ================= */}
        <Modal
          visible={providerModalOpen}
          animationType="slide"
          transparent
          onRequestClose={closeProviderModal}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeProviderModal} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Title size="small">Compras por proveedor</Title>
                <Caption color={theme.color.text.muted}>
                  {getFilterLabel(selectedFilter)} · Soles y Dólares
                </Caption>
              </View>
              <TouchableOpacity onPress={closeProviderModal} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={theme.color.text.body} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalControls}>
              <Input
                placeholder="Filtrar por proveedor o RUC (en esta página)"
                value={providerSearch}
                onChangeText={setProviderSearch}
                leftIcon="search-outline"
                size="small"
              />
              <View style={styles.currencyRow}>
                <Caption color={theme.color.text.muted}>Ordenar por</Caption>
                <ChipGroup
                  options={SORT_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
                  selected={[providerSortBy]}
                  onChange={(sel) => {
                    setProviderSortBy((sel[0] as SireProviderSortBy) || 'importeTotal');
                    setProviderPage(1);
                  }}
                  variant="filled"
                  size="small"
                />
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalListContent}
              keyboardShouldPersistTaps="handled"
            >
              {loadingProviders ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={theme.color.brand.accent} />
                </View>
              ) : providerError ? (
                <ErrorState
                  title="No se pudo cargar el detalle"
                  description="Intenta nuevamente"
                  onRetry={() => refetchProviders()}
                />
              ) : filteredProviderItems.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title="Sin proveedores"
                  description={
                    providerSearch
                      ? 'Sin coincidencias en esta página. Prueba otra página o limpia el filtro.'
                      : 'No hay compras registradas para los filtros aplicados.'
                  }
                />
              ) : (
                <View style={{ gap: spacing[3] }}>
                  {filteredProviderItems.map((p, idx) => {
                    const rank = (providerPage - 1) * DEFAULT_PROVIDER_LIMIT + idx + 1;
                    const blocks = CURRENCIES.map((cur) => ({ cur, block: p[cur] })).filter(
                      (b) => b.block && b.block.count > 0
                    );
                    if (blocks.length === 0) return null;
                    return (
                      <Card key={p.rucProveedor} style={styles.providerCard}>
                        <View style={styles.providerHeader}>
                          <View style={styles.rankBadge}>
                            <Text style={styles.rankText}>#{rank}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Body style={{ fontWeight: '600' }} numberOfLines={2}>
                              {p.razonSocialProveedor}
                            </Body>
                            <Caption color={theme.color.text.muted}>
                              RUC {p.rucProveedor} · {formatInt(p.count)} docs en total
                            </Caption>
                          </View>
                        </View>
                        {blocks.map(({ cur, block }) => {
                          const accent = CURRENCY_ACCENTS[cur];
                          const facP = p.facturas?.[cur];
                          const ncP = p.notasCredito?.[cur];
                          return (
                            <View key={cur} style={styles.providerCurrencyBlock}>
                              <View style={styles.providerCurrencyHeader}>
                                <View
                                  style={[styles.currencyBadge, { backgroundColor: `${accent}1A` }]}
                                >
                                  <RNText style={[styles.currencyBadgeText, { color: accent }]}>
                                    {cur === 'PEN' ? 'S/' : '$'}
                                  </RNText>
                                </View>
                                <Caption color={theme.color.text.muted}>
                                  {CURRENCY_LABELS[cur]}
                                </Caption>
                              </View>
                              <View style={styles.providerRow}>
                                <View style={styles.providerCol}>
                                  <Caption color={theme.color.text.muted}>Docs</Caption>
                                  <Body style={{ fontWeight: '600' }}>
                                    {formatInt(block!.count)}
                                  </Body>
                                </View>
                                <View style={styles.providerCol}>
                                  <Caption color={theme.color.text.muted}>Base + IGV</Caption>
                                  <Body>
                                    {formatCurrency(block!.baseImponible, cur)} +{' '}
                                    {formatCurrency(block!.igv, cur)}
                                  </Body>
                                </View>
                                <View style={styles.providerCol}>
                                  <Caption color={theme.color.text.muted}>Importe neto</Caption>
                                  <Title size="small">
                                    {formatCurrency(block!.importeTotal, cur)}
                                  </Title>
                                </View>
                              </View>
                              {facP || ncP ? (
                                <View style={styles.providerBreakdownRow}>
                                  <View style={styles.providerBreakdownCell}>
                                    <View style={styles.breakdownHeader}>
                                      <Ionicons name="receipt-outline" size={12} color="#10B981" />
                                      <Caption color={theme.color.text.muted}>Facturas</Caption>
                                    </View>
                                    <Body style={{ fontWeight: '600' }}>
                                      {formatCurrency(facP?.importeTotal ?? '0', cur)}
                                    </Body>
                                    <Caption color={theme.color.text.muted}>
                                      {formatInt(facP?.count ?? 0)} docs
                                    </Caption>
                                  </View>
                                  <View style={styles.providerBreakdownCell}>
                                    <View style={styles.breakdownHeader}>
                                      <Ionicons
                                        name="arrow-undo-outline"
                                        size={12}
                                        color="#EF4444"
                                      />
                                      <Caption color={theme.color.text.muted}>NC</Caption>
                                    </View>
                                    <Body style={{ fontWeight: '600', color: '#EF4444' }}>
                                      − {formatCurrency(ncP?.importeTotal ?? '0', cur)}
                                    </Body>
                                    <Caption color={theme.color.text.muted}>
                                      {formatInt(ncP?.count ?? 0)} docs
                                    </Caption>
                                  </View>
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </Card>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Paginación fija en el pie */}
            {providerTotal > 0 ? (
              <View style={styles.paginationBar}>
                <TouchableOpacity
                  style={[styles.pagerBtn, providerPage <= 1 && styles.pagerBtnDisabled]}
                  onPress={() => setProviderPage(1)}
                  disabled={providerPage <= 1}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="play-skip-back"
                    size={16}
                    color={providerPage <= 1 ? theme.color.text.disabled : theme.color.text.body}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pagerBtn, providerPage <= 1 && styles.pagerBtnDisabled]}
                  onPress={() => setProviderPage((p) => Math.max(1, p - 1))}
                  disabled={providerPage <= 1}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={providerPage <= 1 ? theme.color.text.disabled : theme.color.text.body}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pageIndicator}
                  onPress={openPageJump}
                  activeOpacity={0.75}
                >
                  <RNText style={styles.pageIndicatorText}>
                    Página {providerPage} de {providerTotalPages}
                  </RNText>
                  <Caption color={theme.color.text.muted}>
                    {formatInt(providerTotal)} proveedores
                  </Caption>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.pagerBtn,
                    providerPage >= providerTotalPages && styles.pagerBtnDisabled,
                  ]}
                  onPress={() => setProviderPage((p) => Math.min(providerTotalPages, p + 1))}
                  disabled={providerPage >= providerTotalPages}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={
                      providerPage >= providerTotalPages
                        ? theme.color.text.disabled
                        : theme.color.text.body
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pagerBtn,
                    providerPage >= providerTotalPages && styles.pagerBtnDisabled,
                  ]}
                  onPress={() => setProviderPage(providerTotalPages)}
                  disabled={providerPage >= providerTotalPages}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="play-skip-forward"
                    size={16}
                    color={
                      providerPage >= providerTotalPages
                        ? theme.color.text.disabled
                        : theme.color.text.body
                    }
                  />
                </TouchableOpacity>

                {fetchingProviders ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.color.brand.accent}
                    style={{ marginLeft: spacing[2] }}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </Modal>

        {/* Modal salto de página */}
        <Modal
          visible={pageJumpOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPageJumpOpen(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setPageJumpOpen(false)} />
          <View style={styles.pageJumpCard}>
            <Title size="small">Ir a la página</Title>
            <Caption color={theme.color.text.muted}>
              Ingresa un número entre 1 y {providerTotalPages}
            </Caption>
            <TextInput
              value={pageJumpValue}
              onChangeText={(v) => setPageJumpValue(v.replace(/\D/g, ''))}
              keyboardType="numeric"
              autoFocus
              placeholder={String(providerPage)}
              placeholderTextColor={theme.color.text.placeholder}
              style={styles.pageJumpInput}
              maxLength={String(providerTotalPages).length + 1}
              onSubmitEditing={confirmPageJump}
              returnKeyType="go"
            />
            <View style={styles.pageJumpActions}>
              <Button
                title="Cancelar"
                variant="secondary"
                size="small"
                onPress={() => setPageJumpOpen(false)}
              />
              <Button title="Ir" variant="primary" size="small" onPress={confirmPageJump} />
            </View>
          </View>
        </Modal>

        {/* ================= Client modal (ventas) ================= */}
        <Modal
          visible={clientModalOpen}
          animationType="slide"
          transparent
          onRequestClose={closeClientModal}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeClientModal} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Title size="small">Ventas por cliente</Title>
                <Caption color={theme.color.text.muted}>
                  {getFilterLabel(selectedFilter)} · Soles y Dólares
                </Caption>
              </View>
              <TouchableOpacity onPress={closeClientModal} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={theme.color.text.body} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalControls}>
              <Input
                placeholder="Filtrar por cliente o documento (en esta página)"
                value={clientSearch}
                onChangeText={setClientSearch}
                leftIcon="search-outline"
                size="small"
              />
              <View style={styles.currencyRow}>
                <Caption color={theme.color.text.muted}>Ordenar por</Caption>
                <ChipGroup
                  options={CLIENT_SORT_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
                  selected={[clientSortBy]}
                  onChange={(sel) => {
                    setClientSortBy((sel[0] as SireVentasClientSortBy) || 'importeTotal');
                    setClientPage(1);
                  }}
                  variant="filled"
                  size="small"
                />
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalListContent}
              keyboardShouldPersistTaps="handled"
            >
              {loadingClients ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={theme.color.brand.accent} />
                </View>
              ) : clientError ? (
                <ErrorState
                  title="No se pudo cargar el detalle"
                  description="Intenta nuevamente"
                  onRetry={() => refetchClients()}
                />
              ) : filteredClientItems.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title="Sin clientes"
                  description={
                    clientSearch
                      ? 'Sin coincidencias en esta página. Prueba otra página o limpia el filtro.'
                      : 'No hay ventas registradas para los filtros aplicados.'
                  }
                />
              ) : (
                <View style={{ gap: spacing[3] }}>
                  {filteredClientItems.map((c, idx) => {
                    const rank = (clientPage - 1) * DEFAULT_CLIENT_LIMIT + idx + 1;
                    const blocks = CURRENCY_KEYS.map((cur) => ({ cur, block: c[cur] })).filter(
                      (b) => b.block && b.block.count > 0
                    );
                    if (blocks.length === 0) return null;
                    return (
                      <Card key={c.numDocCliente} style={styles.providerCard}>
                        <View style={styles.providerHeader}>
                          <View style={styles.rankBadge}>
                            <Text style={styles.rankText}>#{rank}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Body style={{ fontWeight: '600' }} numberOfLines={2}>
                              {c.razonSocialCliente}
                            </Body>
                            <Caption color={theme.color.text.muted}>
                              Doc. {c.numDocCliente} · {formatInt(c.count)} docs en total
                            </Caption>
                          </View>
                        </View>
                        {blocks.map(({ cur, block }) => {
                          const accent = CURRENCY_ACCENTS[cur];
                          return (
                            <View key={cur} style={styles.providerCurrencyBlock}>
                              <View style={styles.providerCurrencyHeader}>
                                <View
                                  style={[styles.currencyBadge, { backgroundColor: `${accent}1A` }]}
                                >
                                  <RNText style={[styles.currencyBadgeText, { color: accent }]}>
                                    {CURRENCY_SYMBOLS[cur]}
                                  </RNText>
                                </View>
                                <Caption color={theme.color.text.muted}>
                                  {CURRENCY_LABELS[cur]}
                                </Caption>
                              </View>
                              <View style={styles.providerRow}>
                                <View style={styles.providerCol}>
                                  <Caption color={theme.color.text.muted}>Docs</Caption>
                                  <Body style={{ fontWeight: '600' }}>
                                    {formatInt(block!.count)}
                                  </Body>
                                </View>
                                <View style={styles.providerCol}>
                                  <Caption color={theme.color.text.muted}>Base + IGV</Caption>
                                  <Body>
                                    {formatCurrency(block!.baseImponible, cur)} +{' '}
                                    {formatCurrency(block!.igv, cur)}
                                  </Body>
                                </View>
                                <View style={styles.providerCol}>
                                  <Caption color={theme.color.text.muted}>Importe neto</Caption>
                                  <Title size="small">
                                    {formatCurrency(block!.importeTotal, cur)}
                                  </Title>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </Card>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {clientTotal > 0 ? (
              <View style={styles.paginationBar}>
                <TouchableOpacity
                  style={[styles.pagerBtn, clientPage <= 1 && styles.pagerBtnDisabled]}
                  onPress={() => setClientPage(1)}
                  disabled={clientPage <= 1}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="play-skip-back"
                    size={16}
                    color={clientPage <= 1 ? theme.color.text.disabled : theme.color.text.body}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pagerBtn, clientPage <= 1 && styles.pagerBtnDisabled]}
                  onPress={() => setClientPage((p) => Math.max(1, p - 1))}
                  disabled={clientPage <= 1}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={clientPage <= 1 ? theme.color.text.disabled : theme.color.text.body}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pageIndicator}
                  onPress={openClientPageJump}
                  activeOpacity={0.75}
                >
                  <RNText style={styles.pageIndicatorText}>
                    Página {clientPage} de {clientTotalPages}
                  </RNText>
                  <Caption color={theme.color.text.muted}>
                    {formatInt(clientTotal)} clientes
                  </Caption>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.pagerBtn,
                    clientPage >= clientTotalPages && styles.pagerBtnDisabled,
                  ]}
                  onPress={() => setClientPage((p) => Math.min(clientTotalPages, p + 1))}
                  disabled={clientPage >= clientTotalPages}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={
                      clientPage >= clientTotalPages
                        ? theme.color.text.disabled
                        : theme.color.text.body
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pagerBtn,
                    clientPage >= clientTotalPages && styles.pagerBtnDisabled,
                  ]}
                  onPress={() => setClientPage(clientTotalPages)}
                  disabled={clientPage >= clientTotalPages}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="play-skip-forward"
                    size={16}
                    color={
                      clientPage >= clientTotalPages
                        ? theme.color.text.disabled
                        : theme.color.text.body
                    }
                  />
                </TouchableOpacity>

                {fetchingClients ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.color.brand.accent}
                    style={{ marginLeft: spacing[2] }}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </Modal>

        {/* Modal salto de página (clientes) */}
        <Modal
          visible={clientPageJumpOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setClientPageJumpOpen(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setClientPageJumpOpen(false)} />
          <View style={styles.pageJumpCard}>
            <Title size="small">Ir a la página</Title>
            <Caption color={theme.color.text.muted}>
              Ingresa un número entre 1 y {clientTotalPages}
            </Caption>
            <TextInput
              value={clientPageJumpValue}
              onChangeText={(v) => setClientPageJumpValue(v.replace(/\D/g, ''))}
              keyboardType="numeric"
              autoFocus
              placeholder={String(clientPage)}
              placeholderTextColor={theme.color.text.placeholder}
              style={styles.pageJumpInput}
              maxLength={String(clientTotalPages).length + 1}
              onSubmitEditing={confirmClientPageJump}
              returnKeyType="go"
            />
            <View style={styles.pageJumpActions}>
              <Button
                title="Cancelar"
                variant="secondary"
                size="small"
                onPress={() => setClientPageJumpOpen(false)}
              />
              <Button title="Ir" variant="primary" size="small" onPress={confirmClientPageJump} />
            </View>
          </View>
        </Modal>

        {/* Custom date range picker */}
        <DateRangePicker
          visible={showDateRangePicker}
          startDate={customStartDate}
          endDate={customEndDate}
          onConfirm={(s, e) => {
            setCustomStartDate(s);
            setCustomEndDate(e);
            setSelectedFilter('custom');
            setShowDateRangePicker(false);
          }}
          onCancel={() => setShowDateRangePicker(false)}
          title="Seleccionar rango de fechas"
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.brand.headerFrom,
    },
    headerGradient: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[5],
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
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing[3],
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
      letterSpacing: 0.3,
    },
    subtitle: {
      fontSize: 13,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      marginLeft: 48,
    },
    headerAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: theme.color.brand.headerBadge,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      marginLeft: spacing[3],
    },
    headerActionText: {
      fontSize: 12,
      color: theme.color.brand.onHeader,
      fontWeight: '600',
    },
    scrollView: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    contentContainer: {
      padding: spacing[4],
      paddingBottom: spacing[8],
      gap: spacing[3],
    },
    filtersSection: {
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: spacing[3],
    },
    filtersLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    filtersContent: {
      paddingRight: spacing[4],
    },
    filterButton: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1.5,
      borderColor: theme.color.border.subtle,
      marginRight: spacing[2],
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
    filterButtonTextActive: {
      color: theme.color.text.onAction,
    },
    currencyRow: {
      gap: spacing[1],
    },
    sectionContainer: {
      borderWidth: 2,
      borderColor: theme.color.brand.accent,
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.surface.base,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    sectionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[4],
      backgroundColor: theme.color.brand.accent,
      flexWrap: 'wrap',
    },
    sectionBannerSales: {
      backgroundColor: theme.color.action.success.background,
    },
    sectionTitleColumn: {
      flex: 1,
      minWidth: 220,
      gap: 2,
    },
    sectionEyebrow: {
      color: theme.color.brand.onHeader,
      opacity: 0.75,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    sectionTitleLarge: {
      color: theme.color.brand.onHeader,
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 28,
    },
    sectionSubtitle: {
      color: theme.color.brand.onHeader,
      opacity: 0.85,
      fontSize: 13,
    },
    sectionActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    sectionChevron: {
      width: 34,
      height: 34,
      borderRadius: borderRadius.md,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    currencyFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      flexWrap: 'wrap',
    },
    currencyChips: {
      flexDirection: 'row',
      gap: spacing[2],
      flexWrap: 'wrap',
    },
    currencyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    currencyChipText: {
      fontSize: 13,
      color: theme.color.text.body,
    },
    kpiMulti: {
      flex: 1,
      minWidth: 160,
      padding: spacing[3],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      gap: spacing[1],
    },
    kpiHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    kpiCurrencyLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    kpiCurrencyDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    kpiCurrencyText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.body,
    },
    breakdownCurrencyRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
      paddingTop: spacing[1],
    },
    unifiedPeriodRow: {
      gap: spacing[1],
    },
    unifiedPeriodHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    unifiedPeriodBar: {
      height: 10,
      borderRadius: 5,
      overflow: 'hidden',
      flexDirection: 'row',
      backgroundColor: theme.color.surface.muted,
    },
    unifiedPeriodAmounts: {
      flexDirection: 'row',
      gap: spacing[3],
      flexWrap: 'wrap',
    },
    unifiedAmountChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    chartBarStacked: {
      width: '78%',
      borderRadius: 4,
      overflow: 'hidden',
      flexDirection: 'column-reverse',
    },
    sectionHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.md,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitleText: {
      color: theme.color.brand.onHeader,
    },
    sectionSubtitleText: {
      color: theme.color.brand.onHeader,
      opacity: 0.85,
    },
    sectionAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    sectionActionText: {
      color: theme.color.brand.onHeader,
      fontWeight: '600',
      fontSize: 13,
    },
    sectionBody: {
      padding: spacing[4],
      gap: spacing[4],
    },
    loadingBox: {
      padding: spacing[5],
      alignItems: 'center',
    },
    loadingBoxSmall: {
      padding: spacing[3],
      alignItems: 'center',
    },
    kpisGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[3],
    },
    currencyBlock: {
      gap: spacing[3],
      marginTop: spacing[2],
    },
    currencyBlockHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    currencyBadge: {
      minWidth: 34,
      height: 26,
      paddingHorizontal: spacing[2],
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    currencyBadgeText: {
      fontSize: 12,
      fontWeight: '800',
    },
    providerCurrencyBlock: {
      gap: spacing[1],
      paddingTop: spacing[2],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
    },
    breakdownRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    breakdownCell: {
      flexGrow: 1,
      flexBasis: Platform.OS === 'web' ? 200 : '46%',
      padding: spacing[3],
      borderLeftWidth: 4,
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.muted,
      gap: spacing[1],
    },
    breakdownHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    providerBreakdownRow: {
      flexDirection: 'row',
      gap: spacing[2],
      paddingTop: spacing[1],
    },
    providerBreakdownCell: {
      flex: 1,
      padding: spacing[2],
      borderRadius: borderRadius.sm,
      backgroundColor: theme.color.surface.muted,
      gap: spacing[1],
    },
    providerCurrencyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    kpi: {
      flexGrow: 1,
      flexBasis: Platform.OS === 'web' ? 220 : '46%',
      padding: spacing[3],
      borderLeftWidth: 4,
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.base,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border.default,
      gap: spacing[1],
    },
    kpiIconBox: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing[1],
    },
    blockCard: {
      padding: spacing[3],
      gap: spacing[3],
    },
    blockHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    periodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    periodLabelCol: {
      width: 80,
    },
    periodBarCol: {
      flex: 1,
      height: 12,
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.surface.muted,
      overflow: 'hidden',
    },
    periodBar: {
      height: '100%',
      borderRadius: borderRadius.full,
    },
    periodValueCol: {
      minWidth: 120,
      alignItems: 'flex-end',
    },
    cpeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingVertical: spacing[1],
    },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 4,
      paddingHorizontal: spacing[1],
    },
    chartCol: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing[1],
    },
    chartBarTrack: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    chartBarTrackGrouped: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    chartBarPair: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 2,
      width: '100%',
      height: '100%',
    },
    chartBar: {
      width: '78%',
      borderTopLeftRadius: borderRadius.sm,
      borderTopRightRadius: borderRadius.sm,
      minHeight: 2,
    },
    chartBarSmall: {
      width: 8,
      borderTopLeftRadius: borderRadius.sm,
      borderTopRightRadius: borderRadius.sm,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[3],
      paddingBottom: spacing[2],
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    monthlyHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[3],
      paddingBottom: spacing[1],
    },
    monthlyAmountCol: {
      flex: 1,
      alignItems: 'flex-end',
    },
    monthlyTotalRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
      marginTop: spacing[1],
      paddingTop: spacing[2],
    },
    chartBarValue: {
      fontSize: 9,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    chartBarLabel: {
      fontSize: 11,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    chartBarLabelActive: {
      color: theme.color.brand.accent,
      fontWeight: '700',
    },
    monthlyTable: {
      gap: spacing[1],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
      paddingTop: spacing[3],
    },
    monthlyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing[1],
      gap: spacing[3],
    },
    monthlyLabelCol: {
      flex: 1,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.color.overlay.medium,
    },
    modalSheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      maxHeight: '92%',
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingTop: spacing[3],
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingBottom: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.default,
    },
    closeBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.md,
    },
    modalControls: {
      padding: spacing[4],
      gap: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.default,
    },
    modalListContent: {
      padding: spacing[4],
      paddingBottom: spacing[5],
      gap: spacing[3],
    },
    paginationBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    pagerBtn: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pagerBtnDisabled: {
      opacity: 0.4,
    },
    pageIndicator: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing[1],
      paddingHorizontal: spacing[2],
      borderRadius: borderRadius.md,
      backgroundColor: `${theme.color.brand.accent}11`,
      borderWidth: 1,
      borderColor: `${theme.color.brand.accent}33`,
    },
    pageIndicatorText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    pageJumpCard: {
      position: 'absolute',
      top: '30%',
      left: spacing[5],
      right: spacing[5],
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[4],
      gap: spacing[3],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    pageJumpInput: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
      color: theme.color.text.body,
      backgroundColor: theme.color.surface.muted,
    },
    pageJumpActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    providerCard: {
      padding: spacing[3],
      gap: spacing[2],
    },
    providerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    rankBadge: {
      minWidth: 36,
      height: 28,
      paddingHorizontal: spacing[2],
      borderRadius: borderRadius.full,
      backgroundColor: `${theme.color.brand.accent}22`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      color: theme.color.brand.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    providerRow: {
      flexDirection: 'row',
      gap: spacing[2],
      paddingTop: spacing[1],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.default,
    },
    providerCol: {
      flex: 1,
    },
  });
