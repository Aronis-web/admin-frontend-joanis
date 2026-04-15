/**
 * CuadreScreen.tsx
 *
 * Pantalla principal de Cuadre de Caja.
 * Rediseñada con el sistema de diseño global.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DateRangePicker } from '@/components/DateRangePicker';
import { sitesApi } from '@/services/api/sites';
import { companiesApi } from '@/services/api/companies';
import { cashReconciliationApi, CuadreCajaResponse, IngresosBancarios } from '@/services/api/cash-reconciliation';
import { treasuryApi } from '@/services/api/treasury';
import { Site } from '@/types/sites';
import { CompanyType } from '@/types/companies';
import { BankAccount } from '@/types/treasury';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { config } from '@/utils/config';
import { authService } from '@/services/AuthService';

// Design System Imports
import { colors } from '@/design-system/tokens/colors';
import { spacing, borderRadius } from '@/design-system/tokens/spacing';
import { shadows } from '@/design-system/tokens/shadows';
import { fontSizes, fontWeights } from '@/design-system/tokens/typography';
import { durations } from '@/design-system/tokens/animations';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

type Props = NativeStackScreenProps<any, 'Cuadre'>;

// ============================================================================
// Animated Card Component
// ============================================================================

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({ children, delay = 0, style }) => {
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: durations.normal,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: durations.normal,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ transform: [{ translateY }], opacity }, style]}>
      {children}
    </Animated.View>
  );
};

// ============================================================================
// Data Card Component
// ============================================================================

interface DataCardProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  children: React.ReactNode;
  delay?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const DataCard: React.FC<DataCardProps> = ({
  title,
  icon,
  iconColor,
  children,
  delay = 0,
  variant = 'default',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return { backgroundColor: colors.success[50], borderColor: colors.success[300] };
      case 'warning':
        return { backgroundColor: colors.warning[50], borderColor: colors.warning[300] };
      case 'danger':
        return { backgroundColor: colors.danger[50], borderColor: colors.danger[300] };
      default:
        return { backgroundColor: colors.neutral[0], borderColor: 'transparent' };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <AnimatedCard delay={delay}>
      <View style={[styles.dataCard, { backgroundColor: variantStyles.backgroundColor, borderColor: variantStyles.borderColor, borderWidth: variant !== 'default' ? 1 : 0 }]}>
        <View style={styles.dataCardHeader}>
          <View style={[styles.dataCardIcon, { backgroundColor: iconColor + '20' }]}>
            <Ionicons name={icon} size={20} color={iconColor} />
          </View>
          <Text style={styles.dataCardTitle}>{title}</Text>
        </View>
        {children}
      </View>
    </AnimatedCard>
  );
};

// ============================================================================
// Data Row Component
// ============================================================================

interface DataRowProps {
  label: string;
  value: string;
  valueColor?: string;
  isBold?: boolean;
  isTotal?: boolean;
}

const DataRow: React.FC<DataRowProps> = ({ label, value, valueColor, isBold, isTotal }) => (
  <View style={[styles.dataRow, isTotal && styles.dataRowTotal]}>
    <Text style={[styles.dataLabel, isBold && styles.dataLabelBold]}>{label}</Text>
    <Text style={[styles.dataValue, isBold && styles.dataValueBold, valueColor && { color: valueColor }]}>
      {value}
    </Text>
  </View>
);

// ============================================================================
// Quick Filter Button Component
// ============================================================================

interface QuickFilterButtonProps {
  label: string;
  onPress: () => void;
}

const QuickFilterButton: React.FC<QuickFilterButtonProps> = ({ label, onPress }) => (
  <TouchableOpacity style={styles.quickFilterButton} onPress={onPress} activeOpacity={0.7}>
    <Text style={styles.quickFilterText}>{label}</Text>
  </TouchableOpacity>
);

// ============================================================================
// Main Component
// ============================================================================

export const CuadreScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // Data states
  const [cuadreData, setCuadreData] = useState<CuadreCajaResponse | null>(null);
  const [sedes, setSedes] = useState<Site[]>([]);
  const [companyTypeMap, setCompanyTypeMap] = useState<Map<string, CompanyType>>(new Map());

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSedes, setIsLoadingSedes] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  // Filter states
  const [fechaInicio, setFechaInicio] = useState<Date>(new Date());
  const [fechaFin, setFechaFin] = useState<Date>(new Date());

  // Sede selection states
  const [showInternas, setShowInternas] = useState(true);
  const [showExternas, setShowExternas] = useState(true);
  const [sedesExpanded, setSedesExpanded] = useState(false);
  const [selectedSedeIds, setSelectedSedeIds] = useState<Set<string>>(new Set());

  // Date picker state
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);

  // Bank accounts states
  const [includeBankInfo, setIncludeBankInfo] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountIds, setSelectedBankAccountIds] = useState<Set<string>>(new Set());
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState(false);
  const [bankAccountsExpanded, setBankAccountsExpanded] = useState(false);

  // Bank date states (separate from sales dates)
  const [bankFechaInicio, setBankFechaInicio] = useState<Date>(new Date());
  const [bankFechaFin, setBankFechaFin] = useState<Date>(new Date());
  const [showBankDateRangePicker, setShowBankDateRangePicker] = useState(false);

  // Animation
  const headerScale = useRef(new Animated.Value(0.95)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerScale, { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.timing(headerOpacity, { toValue: 1, duration: durations.normal, useNativeDriver: true }),
    ]).start();

    loadSedes();
  }, []);

  const loadSedes = async () => {
    try {
      setIsLoadingSedes(true);

      // Load sedes and companies in parallel
      const [sedesResponse, companiesResponse] = await Promise.all([
        sitesApi.getSites({ limit: 100 }),
        companiesApi.getCompanies({ limit: 100 }),
      ]);

      const loadedSedes = sedesResponse.data || [];
      const companies = companiesResponse.data || [];

      // Create a map of companyId -> companyType
      const typeMap = new Map<string, CompanyType>();
      companies.forEach((company) => {
        typeMap.set(company.id, company.companyType);
      });

      setCompanyTypeMap(typeMap);
      setSedes(loadedSedes);
      // Select all sedes by default
      setSelectedSedeIds(new Set(loadedSedes.map((s) => s.id)));
    } catch (error) {
      console.error('Error loading sedes:', error);
    } finally {
      setIsLoadingSedes(false);
    }
  };

  // Filter sedes by company type using the companyTypeMap
  const sedesInternas = sedes.filter((s) => {
    const companyType = companyTypeMap.get(s.companyId);
    // If no company type found, treat as internal by default
    return !companyType || companyType === CompanyType.INTERNAL;
  });
  const sedesExternas = sedes.filter((s) => {
    const companyType = companyTypeMap.get(s.companyId);
    return companyType === CompanyType.EXTERNAL;
  });

  // Helper function to check if a sede is external
  const isSedeExternal = (sede: Site): boolean => {
    const companyType = companyTypeMap.get(sede.companyId);
    return companyType === CompanyType.EXTERNAL;
  };

  // Compute visible sedes based on toggle selection
  const visibleSedes = showInternas && showExternas
    ? sedes
    : showInternas
      ? sedesInternas
      : showExternas
        ? sedesExternas
        : [];

  // Check if all visible sedes are selected
  const allVisibleSelected = visibleSedes.length > 0 && visibleSedes.every((s) => selectedSedeIds.has(s.id));

  // Toggle individual sede selection
  const toggleSedeSelection = (sedeId: string) => {
    setSelectedSedeIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sedeId)) {
        newSet.delete(sedeId);
      } else {
        newSet.add(sedeId);
      }
      return newSet;
    });
  };

  // Toggle all visible sedes
  const toggleAllVisible = () => {
    setSelectedSedeIds((prev) => {
      const newSet = new Set(prev);
      if (allVisibleSelected) {
        // Deselect all visible
        visibleSedes.forEach((s) => newSet.delete(s.id));
      } else {
        // Select all visible
        visibleSedes.forEach((s) => newSet.add(s.id));
      }
      return newSet;
    });
  };

  // Toggle type visibility and auto-select/deselect
  const handleToggleInternas = () => {
    if (showInternas) {
      // Deselecting - remove all internas from selection
      setSelectedSedeIds((prev) => {
        const newSet = new Set(prev);
        sedesInternas.forEach((s) => newSet.delete(s.id));
        return newSet;
      });
    } else {
      // Selecting - add all internas to selection
      setSelectedSedeIds((prev) => {
        const newSet = new Set(prev);
        sedesInternas.forEach((s) => newSet.add(s.id));
        return newSet;
      });
    }
    setShowInternas(!showInternas);
  };

  const handleToggleExternas = () => {
    if (showExternas) {
      // Deselecting - remove all externas from selection
      setSelectedSedeIds((prev) => {
        const newSet = new Set(prev);
        sedesExternas.forEach((s) => newSet.delete(s.id));
        return newSet;
      });
    } else {
      // Selecting - add all externas to selection
      setSelectedSedeIds((prev) => {
        const newSet = new Set(prev);
        sedesExternas.forEach((s) => newSet.add(s.id));
        return newSet;
      });
    }
    setShowExternas(!showExternas);
  };

  // ==================== Bank Accounts Functions ====================

  const loadBankAccounts = async () => {
    console.log('🏦 [CuadreScreen] Starting to load bank accounts...');
    try {
      setIsLoadingBankAccounts(true);
      console.log('🏦 [CuadreScreen] Calling treasuryApi.getActiveBankAccounts()...');

      const accounts = await treasuryApi.getActiveBankAccounts();

      console.log('🏦 [CuadreScreen] Received accounts:', accounts);
      console.log('🏦 [CuadreScreen] Accounts count:', accounts?.length || 0);
      console.log('🏦 [CuadreScreen] Accounts type:', typeof accounts);
      console.log('🏦 [CuadreScreen] Is array:', Array.isArray(accounts));

      if (accounts && accounts.length > 0) {
        console.log('🏦 [CuadreScreen] First account sample:', JSON.stringify(accounts[0], null, 2));
      }

      setBankAccounts(accounts || []);
      // Select all accounts by default
      const accountIds = (accounts || []).map((a: any) => a.id);
      console.log('🏦 [CuadreScreen] Account IDs:', accountIds);
      setSelectedBankAccountIds(new Set(accountIds));
      console.log('🏦 [CuadreScreen] Bank accounts loaded successfully!');
    } catch (error: any) {
      console.error('🏦 [CuadreScreen] Error loading bank accounts:', error);
      console.error('🏦 [CuadreScreen] Error message:', error?.message);
      console.error('🏦 [CuadreScreen] Error response:', error?.response?.data);
      Alert.alert('Error', 'No se pudieron cargar las cuentas bancarias');
    } finally {
      setIsLoadingBankAccounts(false);
      console.log('🏦 [CuadreScreen] Loading finished');
    }
  };

  const handleToggleIncludeBankInfo = () => {
    const newValue = !includeBankInfo;
    setIncludeBankInfo(newValue);

    if (newValue && bankAccounts.length === 0) {
      // Load bank accounts when enabling for the first time
      loadBankAccounts();
    }
  };

  const toggleBankAccountSelection = (accountId: string) => {
    setSelectedBankAccountIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  const allBankAccountsSelected = bankAccounts.length > 0 && bankAccounts.every((a) => selectedBankAccountIds.has(a.id));

  const toggleAllBankAccounts = () => {
    setSelectedBankAccountIds((prev) => {
      const newSet = new Set(prev);
      if (allBankAccountsSelected) {
        // Deselect all
        bankAccounts.forEach((a) => newSet.delete(a.id));
      } else {
        // Select all
        bankAccounts.forEach((a) => newSet.add(a.id));
      }
      return newSet;
    });
  };

  // Group bank accounts by currency
  const bankAccountsByCurrency = bankAccounts.reduce((acc, account) => {
    const currency = account.currency || 'OTRO';
    if (!acc[currency]) {
      acc[currency] = [];
    }
    acc[currency].push(account);
    return acc;
  }, {} as Record<string, BankAccount[]>);

  // Bank date quick filters
  const setBankToday = () => {
    const today = new Date();
    setBankFechaInicio(today);
    setBankFechaFin(today);
  };

  const setBankYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setBankFechaInicio(yesterday);
    setBankFechaFin(yesterday);
  };

  const setBankThisWeek = () => {
    const today = new Date();
    const firstDay = new Date(today);
    firstDay.setDate(today.getDate() - today.getDay());
    setBankFechaInicio(firstDay);
    setBankFechaFin(today);
  };

  const setBankThisMonth = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setBankFechaInicio(firstDay);
    setBankFechaFin(today);
  };

  const setBankSameAsSales = () => {
    setBankFechaInicio(new Date(fechaInicio));
    setBankFechaFin(new Date(fechaFin));
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Quick filters
  const setToday = () => {
    const today = new Date();
    setFechaInicio(today);
    setFechaFin(today);
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setFechaInicio(yesterday);
    setFechaFin(yesterday);
  };

  const setThisWeek = () => {
    const today = new Date();
    const firstDay = new Date(today);
    firstDay.setDate(today.getDate() - today.getDay());
    setFechaInicio(firstDay);
    setFechaFin(today);
  };

  const setThisMonth = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setFechaInicio(firstDay);
    setFechaFin(today);
  };

  const loadCuadre = useCallback(async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // Convert Set to array of selected sede IDs
      const sedeIdsArray = Array.from(selectedSedeIds);

      // Validate at least one sede is selected
      if (sedeIdsArray.length === 0) {
        Alert.alert('Error', 'Debes seleccionar al menos una sede');
        return;
      }

      const params: any = {
        fecha_inicio: formatDate(fechaInicio),
        fecha_fin: formatDate(fechaFin),
      };

      // Only add sede filter if not all sedes are selected
      if (sedeIdsArray.length < sedes.length) {
        if (sedeIdsArray.length === 1) {
          // Single sede - use sede_id
          params.sede_id = sedeIdsArray[0];
        } else {
          // Multiple sedes - use sede_ids as comma-separated string
          params.sede_ids = sedeIdsArray.join(',');
        }
      }
      // If all sedes selected, don't send filter (backend returns all)

      // Add bank account IDs and bank dates if bank info is included
      if (includeBankInfo && selectedBankAccountIds.size > 0) {
        const bankAccountIdsArray = Array.from(selectedBankAccountIds);
        params.bank_account_ids = bankAccountIdsArray.join(',');
        params.bank_fecha_inicio = formatDate(bankFechaInicio);
        params.bank_fecha_fin = formatDate(bankFechaFin);
        console.log('📊 [Cuadre] Cuentas bancarias seleccionadas:', bankAccountIdsArray.length, 'de', bankAccounts.length);
        console.log('📊 [Cuadre] Fechas bancarias:', params.bank_fecha_inicio, 'al', params.bank_fecha_fin);
      }

      console.log('📊 [Cuadre] Enviando petición con params:', JSON.stringify(params, null, 2));
      console.log('📊 [Cuadre] Sedes seleccionadas:', sedeIdsArray.length, 'de', sedes.length);

      const data = await cashReconciliationApi.getCuadreCaja(params);
      setCuadreData(data as CuadreCajaResponse);
    } catch (error: any) {
      console.error('Error loading cuadre:', error);
      Alert.alert('Error', error?.message || 'No se pudo cargar el cuadre de caja');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fechaInicio, fechaFin, selectedSedeIds, sedes.length, includeBankInfo, selectedBankAccountIds, bankAccounts.length, bankFechaInicio, bankFechaFin]);

  const formatCurrency = (amount: number): string => {
    return `S/ ${amount.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const generatePDF = async () => {
    if (!cuadreData) {
      Alert.alert('Error', 'No hay datos para generar el PDF');
      return;
    }

    setIsDownloadingPDF(true);

    try {
      const token = authService.getAccessToken();
      if (!token) {
        Alert.alert('Error', 'No hay sesión activa');
        return;
      }

      const params = new URLSearchParams({
        fecha_inicio: formatDate(fechaInicio),
        fecha_fin: formatDate(fechaFin),
      });

      // Add sede filter if specific sedes are selected (not all)
      const sedeIdsArray = Array.from(selectedSedeIds);
      if (sedeIdsArray.length > 0 && sedeIdsArray.length < sedes.length) {
        if (sedeIdsArray.length === 1) {
          // Single sede - use sede_id
          params.append('sede_id', sedeIdsArray[0]);
        } else {
          // Multiple sedes - use sede_ids as comma-separated string
          params.append('sede_ids', sedeIdsArray.join(','));
        }
      }
      // If all sedes selected, don't send filter (backend returns all)

      // Add bank account IDs and bank dates if bank info is included
      if (includeBankInfo && selectedBankAccountIds.size > 0) {
        const bankAccountIdsArray = Array.from(selectedBankAccountIds);
        params.append('bank_account_ids', bankAccountIdsArray.join(','));
        params.append('bank_fecha_inicio', formatDate(bankFechaInicio));
        params.append('bank_fecha_fin', formatDate(bankFechaFin));
      }

      const url = `${config.API_URL}/cash-reconciliation/cuadre-caja/pdf?${params.toString()}`;

      if (Platform.OS === 'web') {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-App-Id': config.APP_ID,
            'X-App-Version': config.APP_VERSION,
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Create a download link instead of opening in new tab
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `cuadre-caja-${formatDate(fechaInicio)}-${formatDate(fechaFin)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up blob URL after download
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        Alert.alert('Éxito', 'PDF descargado correctamente');
      } else {
        const timestamp = Date.now();
        const fileName = `cuadre-caja-${formatDate(fechaInicio)}-${formatDate(fechaFin)}-${timestamp}.pdf`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

        const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
          headers: {
            'X-App-Id': config.APP_ID,
            'Authorization': `Bearer ${token}`,
          },
        });

        if (downloadResult.status === 200) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Cuadre de Caja',
            UTI: 'com.adobe.pdf',
          });
          Alert.alert('Éxito', 'PDF descargado correctamente');
        } else {
          throw new Error('Error al descargar el PDF');
        }
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', 'No se pudo descargar el PDF');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const getSeverityInfo = (severidad: string) => {
    const severities: Record<string, { label: string; color: string; bgColor: string; icon: keyof typeof Ionicons.glyphMap }> = {
      ninguna: { label: 'Sin Discrepancias', color: colors.success[700], bgColor: colors.success[100], icon: 'checkmark-circle' },
      baja: { label: 'Discrepancia Baja', color: colors.warning[700], bgColor: colors.warning[100], icon: 'alert-circle' },
      media: { label: 'Discrepancia Media', color: colors.warning[800], bgColor: colors.warning[200], icon: 'alert-circle' },
      alta: { label: 'Discrepancia Alta', color: colors.danger[700], bgColor: colors.danger[100], icon: 'warning' },
      critica: { label: 'Discrepancia Crítica', color: colors.danger[800], bgColor: colors.danger[200], icon: 'warning' },
    };
    return severities[severidad] || { label: severidad, color: colors.neutral[600], bgColor: colors.neutral[100], icon: 'help-circle' as keyof typeof Ionicons.glyphMap };
  };

  // Determine if we're showing only external sedes (no Izipay/Prosegur data)
  const isOnlyExternas = showExternas && !showInternas;

  const diferencia = cuadreData
    ? cuadreData.izipay.bruto + cuadreData.prosegur.depositos + (cuadreData.notas_credito.total * -1) - cuadreData.ventas.total
    : 0;

  // Estimated payment for external sedes (Ventas neto - comisión franquicia)
  const estimacionPago = cuadreData
    ? (cuadreData.ventas.total - cuadreData.notas_credito.total) / 1.15
    : 0;

  return (
    <ScreenLayout navigation={navigation}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[colors.primary[900], colors.primary[800]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonGradient}>
              <Ionicons name="arrow-back" size={24} color={colors.neutral[0]} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="calculator-outline" size={22} color={colors.neutral[0]} />
                </View>
                <Text style={styles.titleGradient}>Cuadre de Caja</Text>
              </View>
              <Text style={styles.subtitleGradient}>Conciliación de ventas y pagos</Text>
            </View>
          </View>
        </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => cuadreData && loadCuadre(true)}
            colors={[colors.primary[600]]}
          />
        }
      >
        {/* Filters Section */}
        <AnimatedCard delay={0}>
          <View style={styles.filtersCard}>
            <View style={styles.filtersHeader}>
              <Ionicons name="filter" size={20} color={colors.primary[600]} />
              <Text style={styles.filtersTitle}>Filtros</Text>
            </View>

            {/* Quick Filters */}
            <View style={styles.quickFiltersContainer}>
              <QuickFilterButton label="Hoy" onPress={setToday} />
              <QuickFilterButton label="Ayer" onPress={setYesterday} />
              <QuickFilterButton label="Esta Semana" onPress={setThisWeek} />
              <QuickFilterButton label="Este Mes" onPress={setThisMonth} />
            </View>

            {/* Date Range - Unified Selector */}
            <View style={styles.dateRangeContainer}>
              <TouchableOpacity
                style={styles.dateRangeButton}
                onPress={() => setShowDateRangePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={22} color={colors.primary[600]} />
                <View style={styles.dateRangeTextContainer}>
                  <Text style={styles.dateRangeLabel}>Periodo</Text>
                  <Text style={styles.dateRangeValue}>
                    {formatDisplayDate(fechaInicio)} — {formatDisplayDate(fechaFin)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
              </TouchableOpacity>
            </View>

            {/* Sede Selector */}
            <View style={styles.sedeContainer}>
              <Text style={styles.sedeLabel}>Sedes</Text>

              {/* Toggle Buttons Row */}
              <View style={styles.sedeToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.sedeToggleButton,
                    showInternas && styles.sedeToggleButtonActive,
                  ]}
                  onPress={handleToggleInternas}
                  activeOpacity={0.7}
                >
                  <View style={[styles.sedeToggleCheck, showInternas && styles.sedeToggleCheckActive]}>
                    {showInternas && <Ionicons name="checkmark" size={14} color={colors.neutral[0]} />}
                  </View>
                  <View style={styles.sedeToggleContent}>
                    <Ionicons name="business" size={18} color={showInternas ? colors.primary[600] : colors.neutral[400]} />
                    <Text style={[styles.sedeToggleText, showInternas && styles.sedeToggleTextActive]}>
                      Sedes Internas
                    </Text>
                  </View>
                  <Text style={styles.sedeToggleCount}>({sedesInternas.length})</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sedeToggleButton,
                    showExternas && styles.sedeToggleButtonActive,
                  ]}
                  onPress={handleToggleExternas}
                  activeOpacity={0.7}
                >
                  <View style={[styles.sedeToggleCheck, showExternas && styles.sedeToggleCheckActive]}>
                    {showExternas && <Ionicons name="checkmark" size={14} color={colors.neutral[0]} />}
                  </View>
                  <View style={styles.sedeToggleContent}>
                    <Ionicons name="storefront" size={18} color={showExternas ? colors.accent[600] : colors.neutral[400]} />
                    <Text style={[styles.sedeToggleText, showExternas && styles.sedeToggleTextActive]}>
                      Sedes Externas
                    </Text>
                  </View>
                  <Text style={styles.sedeToggleCount}>({sedesExternas.length})</Text>
                </TouchableOpacity>
              </View>

              {/* Unified Collapsible Sedes List */}
              {(showInternas || showExternas) && visibleSedes.length > 0 && (
                <View style={styles.sedeListContainer}>
                  <TouchableOpacity
                    style={styles.sedeListHeader}
                    onPress={() => setSedesExpanded(!sedesExpanded)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sedeListHeaderLeft}>
                      <Ionicons
                        name={sedesExpanded ? 'chevron-down' : 'chevron-forward'}
                        size={18}
                        color={colors.primary[600]}
                      />
                      <Text style={styles.sedeListHeaderText}>
                        {showInternas && showExternas
                          ? 'Todas las Sedes'
                          : showInternas
                            ? 'Sedes Internas'
                            : 'Sedes Externas'}
                      </Text>
                      <Text style={styles.sedeListHeaderCount}>({visibleSedes.length})</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.selectAllButton}
                      onPress={toggleAllVisible}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, allVisibleSelected && styles.checkboxChecked]}>
                        {allVisibleSelected && <Ionicons name="checkmark" size={12} color={colors.neutral[0]} />}
                      </View>
                      <Text style={styles.selectAllText}>Todas</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {sedesExpanded && (
                    <View style={styles.sedeListItems}>
                      {visibleSedes.map((sede) => {
                        const isExternal = isSedeExternal(sede);
                        return (
                          <TouchableOpacity
                            key={sede.id}
                            style={styles.sedeListItem}
                            onPress={() => toggleSedeSelection(sede.id)}
                            activeOpacity={0.7}
                          >
                            <View style={[
                              styles.checkbox,
                              isExternal && styles.checkboxExternas,
                              selectedSedeIds.has(sede.id) && (isExternal ? styles.checkboxExternasChecked : styles.checkboxChecked)
                            ]}>
                              {selectedSedeIds.has(sede.id) && <Ionicons name="checkmark" size={12} color={colors.neutral[0]} />}
                            </View>
                            <View style={styles.sedeListItemInfo}>
                              <View style={styles.sedeListItemHeader}>
                                <Text style={styles.sedeListItemCode}>{sede.code}</Text>
                                {showInternas && showExternas && (
                                  <View style={[
                                    styles.sedeTypeBadge,
                                    isExternal ? styles.sedeTypeBadgeExternal : styles.sedeTypeBadgeInternal
                                  ]}>
                                    <Text style={[
                                      styles.sedeTypeBadgeText,
                                      isExternal ? styles.sedeTypeBadgeTextExternal : styles.sedeTypeBadgeTextInternal
                                    ]}>
                                      {isExternal ? 'EXT' : 'INT'}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.sedeListItemName}>{sede.name}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Selected count summary */}
              <View style={styles.selectedSummary}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success[600]} />
                <Text style={styles.selectedSummaryText}>
                  {selectedSedeIds.size} de {sedes.length} sedes seleccionadas
                </Text>
              </View>
            </View>

            {/* Bank Accounts Section */}
            <View style={styles.bankAccountsSection}>
              <Text style={styles.sedeLabel}>Información Bancaria</Text>

              {/* Debug info - remove later */}
              {__DEV__ && (
                <Text style={{ fontSize: 10, color: 'gray', marginBottom: 4 }}>
                  Debug: includeBankInfo={String(includeBankInfo)}, accounts={bankAccounts.length}, loading={String(isLoadingBankAccounts)}, expanded={String(bankAccountsExpanded)}
                </Text>
              )}

              {/* Toggle Include Bank Info */}
              <TouchableOpacity
                style={[
                  styles.bankToggleButton,
                  includeBankInfo && styles.bankToggleButtonActive,
                ]}
                onPress={handleToggleIncludeBankInfo}
                activeOpacity={0.7}
              >
                <View style={[styles.sedeToggleCheck, includeBankInfo && styles.bankToggleCheckActive]}>
                  {includeBankInfo && <Ionicons name="checkmark" size={14} color={colors.neutral[0]} />}
                </View>
                <View style={styles.sedeToggleContent}>
                  <Ionicons name="wallet-outline" size={18} color={includeBankInfo ? colors.info[600] : colors.neutral[400]} />
                  <Text style={[styles.sedeToggleText, includeBankInfo && styles.sedeToggleTextActive]}>
                    Incluir información de bancos
                  </Text>
                </View>
                {isLoadingBankAccounts && (
                  <ActivityIndicator size="small" color={colors.info[600]} />
                )}
              </TouchableOpacity>

              {/* Bank Date Range - Only show when includeBankInfo is true */}
              {includeBankInfo && (
                <View style={styles.bankDateSection}>
                  <Text style={styles.bankDateLabel}>Período de Transacciones Bancarias</Text>

                  {/* Quick Filters for Bank Dates */}
                  <View style={styles.bankQuickFiltersContainer}>
                    <TouchableOpacity style={styles.bankQuickFilterButton} onPress={setBankSameAsSales} activeOpacity={0.7}>
                      <Ionicons name="sync-outline" size={14} color={colors.info[600]} />
                      <Text style={styles.bankQuickFilterText}>Igual a Ventas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.bankQuickFilterButton} onPress={setBankToday} activeOpacity={0.7}>
                      <Text style={styles.bankQuickFilterText}>Hoy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.bankQuickFilterButton} onPress={setBankYesterday} activeOpacity={0.7}>
                      <Text style={styles.bankQuickFilterText}>Ayer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.bankQuickFilterButton} onPress={setBankThisWeek} activeOpacity={0.7}>
                      <Text style={styles.bankQuickFilterText}>Semana</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.bankQuickFilterButton} onPress={setBankThisMonth} activeOpacity={0.7}>
                      <Text style={styles.bankQuickFilterText}>Mes</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Bank Date Range Selector */}
                  <TouchableOpacity
                    style={styles.bankDateRangeButton}
                    onPress={() => setShowBankDateRangePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.info[600]} />
                    <View style={styles.dateRangeTextContainer}>
                      <Text style={[styles.dateRangeLabel, { color: colors.info[600] }]}>Período Bancos</Text>
                      <Text style={styles.dateRangeValue}>
                        {formatDisplayDate(bankFechaInicio)} — {formatDisplayDate(bankFechaFin)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.neutral[400]} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Bank Accounts Selector - Only show when includeBankInfo is true */}
              {includeBankInfo && bankAccounts.length > 0 && (
                <View style={styles.bankAccountsListContainer}>
                  {__DEV__ && (
                    <Text style={{ fontSize: 10, color: 'blue', padding: 4 }}>
                      ✓ Lista visible - {bankAccounts.length} cuentas - Currencies: {Object.keys(bankAccountsByCurrency).join(', ')}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.sedeListHeader}
                    onPress={() => setBankAccountsExpanded(!bankAccountsExpanded)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sedeListHeaderLeft}>
                      <Ionicons
                        name={bankAccountsExpanded ? 'chevron-down' : 'chevron-forward'}
                        size={18}
                        color={colors.info[600]}
                      />
                      <Text style={[styles.sedeListHeaderText, { color: colors.info[700] }]}>
                        Cuentas Bancarias
                      </Text>
                      <Text style={styles.sedeListHeaderCount}>({bankAccounts.length})</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.selectAllButton}
                      onPress={toggleAllBankAccounts}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, styles.checkboxBank, allBankAccountsSelected && styles.checkboxBankChecked]}>
                        {allBankAccountsSelected && <Ionicons name="checkmark" size={12} color={colors.neutral[0]} />}
                      </View>
                      <Text style={styles.selectAllText}>Todas</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {bankAccountsExpanded && (
                    <View style={styles.sedeListItems}>
                      {Object.entries(bankAccountsByCurrency).map(([currency, accounts]) => (
                        <View key={currency}>
                          {/* Currency Header */}
                          <View style={styles.currencyHeader}>
                            <Text style={styles.currencyHeaderText}>
                              {currency === 'PEN' ? '🇵🇪 Soles (PEN)' : currency === 'USD' ? '🇺🇸 Dólares (USD)' : currency}
                            </Text>
                          </View>
                          {/* Accounts in this currency */}
                          {accounts.map((account) => (
                            <TouchableOpacity
                              key={account.id}
                              style={styles.bankAccountItem}
                              onPress={() => toggleBankAccountSelection(account.id)}
                              activeOpacity={0.7}
                            >
                              <View style={[
                                styles.checkbox,
                                styles.checkboxBank,
                                selectedBankAccountIds.has(account.id) && styles.checkboxBankChecked
                              ]}>
                                {selectedBankAccountIds.has(account.id) && <Ionicons name="checkmark" size={12} color={colors.neutral[0]} />}
                              </View>
                              <View style={styles.bankAccountItemInfo}>
                                <View style={styles.bankAccountItemHeader}>
                                  <Text style={styles.bankAccountBankName}>{account.bank?.shortName || 'Banco'}</Text>
                                  <View style={styles.bankAccountCurrencyBadge}>
                                    <Text style={styles.bankAccountCurrencyText}>{account.currency}</Text>
                                  </View>
                                </View>
                                <Text style={styles.bankAccountAlias}>{account.alias}</Text>
                                <Text style={styles.bankAccountNumber}>{account.accountNumber}</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Selected bank accounts summary */}
              {includeBankInfo && bankAccounts.length > 0 && (
                <View style={[styles.selectedSummary, { backgroundColor: colors.info[50] }]}>
                  <Ionicons name="wallet" size={16} color={colors.info[600]} />
                  <Text style={[styles.selectedSummaryText, { color: colors.info[700] }]}>
                    {selectedBankAccountIds.size} de {bankAccounts.length} cuentas seleccionadas
                  </Text>
                </View>
              )}

              {/* Loading state */}
              {includeBankInfo && isLoadingBankAccounts && (
                <View style={styles.loadingBankAccounts}>
                  <ActivityIndicator size="small" color={colors.info[600]} />
                  <Text style={styles.loadingBankAccountsText}>Cargando cuentas bancarias...</Text>
                </View>
              )}

              {/* No accounts message */}
              {includeBankInfo && !isLoadingBankAccounts && bankAccounts.length === 0 && (
                <View style={styles.noBankAccountsMessage}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.warning[600]} />
                  <Text style={styles.noBankAccountsText}>No hay cuentas bancarias disponibles</Text>
                </View>
              )}
            </View>

            {/* Generate Button */}
            <TouchableOpacity
              style={[styles.generateButton, isLoading && styles.generateButtonDisabled]}
              onPress={() => loadCuadre(false)}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.neutral[0]} size="small" />
              ) : (
                <>
                  <Ionicons name="analytics" size={22} color={colors.neutral[0]} />
                  <Text style={styles.generateButtonText}>Generar Cuadre</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </AnimatedCard>

        {/* Results Section */}
        {cuadreData && (
          <>
            {/* Severity Badge - Only for internal sedes */}
            {!isOnlyExternas && (
              <AnimatedCard delay={100}>
                <View style={[styles.severityBadge, { backgroundColor: getSeverityInfo(cuadreData.cuadre.severidad).bgColor }]}>
                  <Ionicons
                    name={getSeverityInfo(cuadreData.cuadre.severidad).icon}
                    size={24}
                    color={getSeverityInfo(cuadreData.cuadre.severidad).color}
                  />
                  <Text style={[styles.severityText, { color: getSeverityInfo(cuadreData.cuadre.severidad).color }]}>
                    {getSeverityInfo(cuadreData.cuadre.severidad).label}
                  </Text>
                </View>
              </AnimatedCard>
            )}

            {/* Ventas Card */}
            <DataCard title="Ventas" icon="cash-outline" iconColor={colors.success[600]} delay={200}>
              <DataRow label="Efectivo" value={formatCurrency(cuadreData.ventas.efectivo)} />
              <DataRow label="Tarjeta" value={formatCurrency(cuadreData.ventas.tarjeta)} />
              <DataRow label="Total" value={formatCurrency(cuadreData.ventas.total)} isBold isTotal />
              <DataRow label="Operaciones" value={cuadreData.ventas.cantidad_operaciones.toString()} />
            </DataCard>

            {/* Notas de Crédito Card */}
            <DataCard title="Notas de Crédito" icon="document-text-outline" iconColor={colors.danger[600]} delay={300} variant="danger">
              <DataRow label="Efectivo" value={formatCurrency(cuadreData.notas_credito.efectivo)} valueColor={colors.danger[600]} />
              <DataRow label="Tarjeta" value={formatCurrency(cuadreData.notas_credito.tarjeta)} valueColor={colors.danger[600]} />
              <DataRow label="Total" value={formatCurrency(cuadreData.notas_credito.total)} isBold isTotal valueColor={colors.danger[600]} />
              <DataRow label="Cantidad" value={cuadreData.notas_credito.cantidad.toString()} />
            </DataCard>

            {/* Izipay Card - Only for internal sedes */}
            {!isOnlyExternas && (
              <DataCard title="Izipay" icon="card-outline" iconColor={colors.accent[600]} delay={400}>
                <DataRow label="Bruto" value={formatCurrency(cuadreData.izipay.bruto)} />
                <DataRow label="Comisiones" value={`-${formatCurrency(cuadreData.izipay.comisiones)}`} valueColor={colors.danger[600]} />
                <DataRow label="Neto" value={formatCurrency(cuadreData.izipay.neto)} isBold isTotal />
                <DataRow label="Operaciones" value={cuadreData.izipay.cantidad_operaciones.toString()} />
                <DataRow label="Matcheadas" value={cuadreData.izipay.transacciones_matcheadas.toString()} />
                <DataRow label="% Comisión Prom." value={`${cuadreData.izipay.porcentaje_comision_promedio.toFixed(2)}%`} />
              </DataCard>
            )}

            {/* Prosegur Card - Only for internal sedes */}
            {!isOnlyExternas && (
              <DataCard title="Prosegur" icon="business-outline" iconColor={colors.warning[600]} delay={500}>
                <DataRow label="Depósitos" value={formatCurrency(cuadreData.prosegur.depositos)} />
                <DataRow label="Balance" value={formatCurrency(cuadreData.prosegur.balances)} isBold isTotal />
                <DataRow label="Operaciones" value={cuadreData.prosegur.cantidad_operaciones.toString()} />
                <DataRow label="Depósitos (#)" value={cuadreData.prosegur.cantidad_depositos.toString()} />
                <DataRow label="Recogidas" value={cuadreData.prosegur.cantidad_recogidas.toString()} />
              </DataCard>
            )}

            {/* Ingresos Bancarios Card - Only when bank info is included (simplified - only total) */}
            {cuadreData.ingresos_bancarios && (
              <DataCard title="Ingresos Bancarios" icon="wallet-outline" iconColor={colors.info[600]} delay={550} variant="default">
                <DataRow
                  label="Total Ingresos"
                  value={formatCurrency(cuadreData.ingresos_bancarios.total_ingresos)}
                  valueColor={colors.success[600]}
                  isBold
                  isTotal
                />
                <DataRow label="Transacciones" value={cuadreData.ingresos_bancarios.cantidad_transacciones.toString()} />
              </DataCard>
            )}

            {/* Estimación de Pago Card - Only for external sedes */}
            {isOnlyExternas && (
              <DataCard title="Estimación de Pago" icon="wallet-outline" iconColor={colors.success[600]} delay={400} variant="success">
                <DataRow label="Total Ventas" value={formatCurrency(cuadreData.ventas.total)} />
                <DataRow label="Notas de Crédito" value={`-${formatCurrency(cuadreData.notas_credito.total)}`} valueColor={colors.danger[600]} />
                <DataRow label="Ventas Netas" value={formatCurrency(cuadreData.ventas.total - cuadreData.notas_credito.total)} isBold />
                <DataRow label="Comisión Franquicia (15%)" value={`-${formatCurrency((cuadreData.ventas.total - cuadreData.notas_credito.total) - estimacionPago)}`} valueColor={colors.neutral[500]} />
                <DataRow
                  label="Estimación a Pagar"
                  value={formatCurrency(estimacionPago)}
                  isBold
                  isTotal
                  valueColor={colors.success[700]}
                />
              </DataCard>
            )}

            {/* Resumen Card - Different content for internal vs external */}
            {!isOnlyExternas ? (
              <DataCard title="Resumen de Totales" icon="calculator-outline" iconColor={colors.info[600]} delay={600} variant="success">
                <DataRow label="Total Ventas" value={formatCurrency(cuadreData.ventas.total)} />
                <DataRow label="Notas de Crédito" value={formatCurrency(cuadreData.notas_credito.total)} valueColor={colors.danger[600]} />
                <DataRow label="Izipay (Bruto)" value={formatCurrency(cuadreData.izipay.bruto)} />
                <DataRow label="Comisiones" value={`-${formatCurrency(cuadreData.izipay.comisiones)}`} valueColor={colors.danger[600]} />
                <DataRow label="Prosegur" value={formatCurrency(cuadreData.prosegur.depositos)} />
                <DataRow
                  label="Diferencia"
                  value={formatCurrency(diferencia)}
                  isBold
                  isTotal
                  valueColor={diferencia !== 0 ? colors.warning[600] : colors.success[600]}
                />
                <DataRow
                  label="Total a Ingresar"
                  value={formatCurrency(cuadreData.prosegur.depositos + cuadreData.izipay.neto)}
                  isBold
                  isTotal
                />
                {/* Bank income comparison - only when bank info is included */}
                {cuadreData.ingresos_bancarios && (
                  <>
                    <DataRow
                      label="Total de Ingresos (Bancos)"
                      value={formatCurrency(cuadreData.ingresos_bancarios.total_ingresos)}
                      valueColor={colors.info[600]}
                    />
                    <DataRow
                      label="Diferencia con Bancos"
                      value={formatCurrency((cuadreData.prosegur.depositos + cuadreData.izipay.neto) - cuadreData.ingresos_bancarios.total_ingresos)}
                      isBold
                      isTotal
                      valueColor={
                        (cuadreData.prosegur.depositos + cuadreData.izipay.neto) - cuadreData.ingresos_bancarios.total_ingresos === 0
                          ? colors.success[600]
                          : colors.warning[600]
                      }
                    />
                  </>
                )}
              </DataCard>
            ) : (
              <DataCard title="Resumen Sedes Externas" icon="calculator-outline" iconColor={colors.info[600]} delay={500} variant="success">
                <DataRow label="Total Ventas" value={formatCurrency(cuadreData.ventas.total)} />
                <DataRow label="Notas de Crédito" value={`-${formatCurrency(cuadreData.notas_credito.total)}`} valueColor={colors.danger[600]} />
                <DataRow label="Ventas Netas" value={formatCurrency(cuadreData.ventas.total - cuadreData.notas_credito.total)} isBold />
                <DataRow
                  label="Estimación a Pagar"
                  value={formatCurrency(estimacionPago)}
                  isBold
                  isTotal
                  valueColor={colors.success[700]}
                />
              </DataCard>
            )}

            {/* Operaciones Card - Only for internal sedes */}
            {!isOnlyExternas && (
              <DataCard title="Operaciones" icon="git-compare-outline" iconColor={colors.primary[600]} delay={700}>
                <DataRow label="Ventas" value={cuadreData.operaciones.ventas.toString()} />
                <DataRow label="Izipay" value={cuadreData.operaciones.izipay.toString()} />
                <DataRow label="Prosegur" value={cuadreData.operaciones.prosegur.toString()} />
                <DataRow
                  label="Coinciden"
                  value={cuadreData.operaciones.coinciden ? '✓ Sí' : '✗ No'}
                  valueColor={cuadreData.operaciones.coinciden ? colors.success[600] : colors.warning[600]}
                  isBold
                />
              </DataCard>
            )}

            {/* Metadata */}
            <AnimatedCard delay={800}>
              <View style={styles.metadataContainer}>
                <View style={styles.metadataRow}>
                  <Ionicons name="time-outline" size={16} color={colors.neutral[500]} />
                  <Text style={styles.metadataText}>
                    Generado: {new Date(cuadreData.generado_en).toLocaleString('es-PE')}
                  </Text>
                </View>
                <View style={styles.metadataRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.neutral[500]} />
                  <Text style={styles.metadataText}>
                    Periodo: {cuadreData.fecha_inicio} al {cuadreData.fecha_fin}
                  </Text>
                </View>
                {cuadreData.sedes.length > 0 && (
                  <View style={styles.metadataRow}>
                    <Ionicons name="location-outline" size={16} color={colors.neutral[500]} />
                    <Text style={styles.metadataText}>
                      Sedes: {cuadreData.sedes.map((s) => s.code).join(', ')}
                    </Text>
                  </View>
                )}
              </View>
            </AnimatedCard>

            {/* PDF Download Button */}
            <AnimatedCard delay={900}>
              <TouchableOpacity
                style={[styles.pdfButton, isDownloadingPDF && styles.pdfButtonDisabled]}
                onPress={generatePDF}
                disabled={isDownloadingPDF}
                activeOpacity={0.8}
              >
                {isDownloadingPDF ? (
                  <ActivityIndicator color={colors.neutral[0]} size="small" />
                ) : (
                  <>
                    <Ionicons name="document-text" size={24} color={colors.neutral[0]} />
                    <Text style={styles.pdfButtonText}>Descargar PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            </AnimatedCard>

            {/* Bank Accounts Detail - After PDF button */}
            {cuadreData.ingresos_bancarios && cuadreData.ingresos_bancarios.detalle_por_cuenta.length > 0 && (
              <AnimatedCard delay={950}>
                <View style={styles.bankAccountsDetailContainer}>
                  <View style={styles.bankAccountsDetailHeader}>
                    <Ionicons name="wallet-outline" size={20} color={colors.info[600]} />
                    <Text style={styles.bankAccountsDetailTitle}>Detalle por Cuenta Bancaria</Text>
                  </View>
                  {cuadreData.ingresos_bancarios.detalle_por_cuenta.map((cuenta) => (
                    <View key={cuenta.cuenta_id} style={styles.bankAccountDetailCard}>
                      <View style={styles.bankAccountDetailHeader}>
                        <View style={styles.bankAccountDetailBadge}>
                          <Text style={styles.bankAccountDetailBadgeText}>{cuenta.banco}</Text>
                        </View>
                        <Text style={styles.bankAccountDetailCurrency}>{cuenta.moneda}</Text>
                      </View>
                      <Text style={styles.bankAccountDetailAlias}>{cuenta.cuenta_alias}</Text>
                      <Text style={styles.bankAccountDetailNumber}>{cuenta.numero_cuenta}</Text>
                      <View style={styles.bankAccountDetailRow}>
                        <View style={styles.bankAccountDetailItem}>
                          <Text style={styles.bankAccountDetailLabel}>Ingresos</Text>
                          <Text style={[styles.bankAccountDetailValue, { color: colors.success[600] }]}>
                            {formatCurrency(cuenta.total_ingresos)}
                          </Text>
                          <Text style={styles.bankAccountDetailCount}>({cuenta.cantidad_ingresos})</Text>
                        </View>
                        <View style={styles.bankAccountDetailItem}>
                          <Text style={styles.bankAccountDetailLabel}>Egresos</Text>
                          <Text style={[styles.bankAccountDetailValue, { color: colors.danger[600] }]}>
                            {formatCurrency(cuenta.total_egresos)}
                          </Text>
                          <Text style={styles.bankAccountDetailCount}>({cuenta.cantidad_egresos})</Text>
                        </View>
                        <View style={styles.bankAccountDetailItem}>
                          <Text style={styles.bankAccountDetailLabel}>Balance</Text>
                          <Text style={[styles.bankAccountDetailValue, { color: cuenta.balance_neto >= 0 ? colors.success[700] : colors.danger[700], fontWeight: '700' }]}>
                            {formatCurrency(cuenta.balance_neto)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </AnimatedCard>
            )}
          </>
        )}

        {/* Empty State */}
        {!cuadreData && !isLoading && (
          <AnimatedCard delay={100}>
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="analytics-outline" size={64} color={colors.neutral[300]} />
              </View>
              <Text style={styles.emptyTitle}>Sin datos</Text>
              <Text style={styles.emptyText}>
                Selecciona un rango de fechas y genera el cuadre
              </Text>
            </View>
          </AnimatedCard>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Date Range Picker */}
      <DateRangePicker
        visible={showDateRangePicker}
        startDate={fechaInicio}
        endDate={fechaFin}
        onConfirm={(start, end) => {
          setFechaInicio(start);
          setFechaFin(end);
          setShowDateRangePicker(false);
        }}
        onCancel={() => setShowDateRangePicker(false)}
      />

      {/* Bank Date Range Picker */}
      <DateRangePicker
        visible={showBankDateRangePicker}
        startDate={bankFechaInicio}
        endDate={bankFechaFin}
        onConfirm={(start, end) => {
          setBankFechaInicio(start);
          setBankFechaFin(end);
          setShowBankDateRangePicker(false);
        }}
        onCancel={() => setShowBankDateRangePicker(false)}
      />
      </View>
    </ScreenLayout>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  // Header con gradiente
  headerGradient: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
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
  titleGradient: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[0],
    letterSpacing: 0.3,
  },
  subtitleGradient: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginLeft: spacing[12],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    ...shadows.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },

  // Filters Card
  filtersCard: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    ...shadows.sm,
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  filtersTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[900],
  },
  quickFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  quickFilterButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  quickFilterText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.primary[700],
  },
  dateRangeContainer: {
    marginBottom: spacing[4],
  },
  dateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  dateRangeTextContainer: {
    flex: 1,
  },
  dateRangeLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.primary[600],
    marginBottom: 2,
  },
  dateRangeValue: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[900],
  },
  sedeContainer: {
    marginBottom: spacing[4],
  },
  sedeLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.neutral[600],
    marginBottom: spacing[3],
  },

  // Sede Toggle Buttons
  sedeToggleRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  sedeToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    gap: spacing[2],
  },
  sedeToggleButtonActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  sedeToggleCheck: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sedeToggleCheckActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  sedeToggleContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  sedeToggleText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.neutral[500],
  },
  sedeToggleTextActive: {
    color: colors.neutral[800],
  },
  sedeToggleCount: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.neutral[400],
  },

  // Sede List Container
  sedeListContainer: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    marginBottom: spacing[3],
    overflow: 'hidden',
  },
  sedeListContainerExternas: {
    backgroundColor: colors.accent[50],
    borderColor: colors.accent[200],
  },
  sedeListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    backgroundColor: 'transparent',
  },
  sedeListHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  sedeListHeaderText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary[700],
  },
  sedeListHeaderCount: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.neutral[500],
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  selectAllText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.neutral[600],
  },

  // Checkbox
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary[400],
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  checkboxExternas: {
    borderColor: colors.accent[400],
  },
  checkboxExternasChecked: {
    backgroundColor: colors.accent[600],
    borderColor: colors.accent[600],
  },

  // Sede List Items
  sedeListItems: {
    borderTopWidth: 1,
    borderTopColor: colors.primary[200],
    backgroundColor: colors.neutral[0],
  },
  sedeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  sedeListItemInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing[1],
  },
  sedeListItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  sedeListItemCode: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.neutral[800],
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  sedeListItemName: {
    fontSize: fontSizes.sm,
    color: colors.neutral[600],
  },
  sedeTypeBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  sedeTypeBadgeInternal: {
    backgroundColor: colors.primary[100],
  },
  sedeTypeBadgeExternal: {
    backgroundColor: colors.accent[100],
  },
  sedeTypeBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  sedeTypeBadgeTextInternal: {
    color: colors.primary[700],
  },
  sedeTypeBadgeTextExternal: {
    color: colors.accent[700],
  },

  // Selected Summary
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.md,
  },
  selectedSummaryText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.success[700],
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
    ...shadows.md,
  },
  generateButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  generateButtonText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },

  // Severity Badge
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
  },
  severityText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
  },

  // Data Card
  dataCard: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    ...shadows.sm,
  },
  dataCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
    gap: spacing[3],
  },
  dataCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataCardTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[900],
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  dataRowTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    marginTop: spacing[2],
    paddingTop: spacing[3],
  },
  dataLabel: {
    fontSize: fontSizes.sm,
    color: colors.neutral[600],
  },
  dataLabelBold: {
    fontWeight: fontWeights.semibold,
    color: colors.neutral[800],
  },
  dataValue: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.neutral[900],
  },
  dataValueBold: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
  },

  // Metadata
  metadataContainer: {
    backgroundColor: colors.neutral[50],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[2],
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  metadataText: {
    fontSize: fontSizes.sm,
    color: colors.neutral[600],
  },

  // PDF Button
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent[600],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    gap: spacing[3],
    ...shadows.md,
  },
  pdfButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  pdfButtonText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[16],
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[700],
    marginBottom: spacing[2],
  },
  emptyText: {
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
    textAlign: 'center',
  },

  bottomSpacer: {
    height: spacing[8],
  },

  // ==================== Bank Accounts Styles ====================

  bankAccountsSection: {
    marginBottom: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  bankToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  bankToggleButtonActive: {
    backgroundColor: colors.info[50],
    borderColor: colors.info[300],
  },
  bankToggleCheckActive: {
    backgroundColor: colors.info[600],
    borderColor: colors.info[600],
  },
  bankDateSection: {
    marginBottom: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.info[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.info[200],
  },
  bankDateLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.info[700],
    marginBottom: spacing[2],
  },
  bankQuickFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  bankQuickFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    backgroundColor: colors.info[100],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.info[300],
    gap: spacing[1],
  },
  bankQuickFilterText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.info[700],
  },
  bankDateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.info[300],
    paddingVertical: spacing[2] + 2,
    paddingHorizontal: spacing[3],
    gap: spacing[2],
  },
  bankAccountsListContainer: {
    backgroundColor: colors.info[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.info[200],
    marginBottom: spacing[3],
    overflow: 'hidden',
  },
  checkboxBank: {
    borderColor: colors.info[400],
  },
  checkboxBankChecked: {
    backgroundColor: colors.info[600],
    borderColor: colors.info[600],
  },
  currencyHeader: {
    backgroundColor: colors.info[100],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.info[200],
  },
  currencyHeaderText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.info[700],
    textTransform: 'uppercase',
  },
  bankAccountItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    backgroundColor: colors.neutral[0],
  },
  bankAccountItemInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing[1],
  },
  bankAccountItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  bankAccountBankName: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.info[700],
    backgroundColor: colors.info[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  bankAccountCurrencyBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  bankAccountCurrencyText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.neutral[600],
  },
  bankAccountAlias: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.neutral[800],
  },
  bankAccountNumber: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  loadingBankAccounts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    backgroundColor: colors.info[50],
    borderRadius: borderRadius.md,
  },
  loadingBankAccountsText: {
    fontSize: fontSizes.sm,
    color: colors.info[600],
  },
  noBankAccountsMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.md,
  },
  noBankAccountsText: {
    fontSize: fontSizes.sm,
    color: colors.warning[700],
  },

  // ==================== Bank Accounts Detail (Results) Styles ====================

  bankAccountsDetailContainer: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    ...shadows.sm,
  },
  bankAccountsDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  bankAccountsDetailSection: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  bankAccountsDetailTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.info[700],
  },
  bankAccountDetailCard: {
    backgroundColor: colors.info[50],
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.info[200],
  },
  bankAccountDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  bankAccountDetailBadge: {
    backgroundColor: colors.info[600],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  bankAccountDetailBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.neutral[0],
  },
  bankAccountDetailCurrency: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.neutral[500],
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  bankAccountDetailAlias: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[800],
  },
  bankAccountDetailNumber: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: spacing[2],
  },
  bankAccountDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[2],
  },
  bankAccountDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  bankAccountDetailLabel: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  bankAccountDetailValue: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  bankAccountDetailCount: {
    fontSize: fontSizes.xs,
    color: colors.neutral[400],
  },
});
