/**
 * CuadreScreen.tsx
 *
 * Pantalla principal de Cuadre de Caja.
 * RediseÃ±ada con el sistema de diseÃ±o global.
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
import { DatePicker } from '@/components/DatePicker';
import { sitesApi } from '@/services/api/sites';
import { companiesApi } from '@/services/api/companies';
import { cashReconciliationApi, CuadreCajaResponse } from '@/services/api/cash-reconciliation';
import { treasuryApi } from '@/services/api/treasury';
import { Site } from '@/types/sites';
import { CompanyType } from '@/types/companies';
import { BankAccount, AutoMatchingTransaction } from '@/types/treasury';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { config } from '@/utils/config';
import { authService } from '@/services/AuthService';

// Design System Imports
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
// Helper Component Types
// ============================================================================

interface DataCardProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  children: React.ReactNode;
  delay?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

interface DataRowProps {
  label: string;
  value: string;
  valueColor?: string;
  isBold?: boolean;
  isTotal?: boolean;
}

interface QuickFilterButtonProps {
  label: string;
  onPress: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export const CuadreScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  // ============================================================================
  // Helper Components (closures over `styles` and `theme`)
  // ============================================================================

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
          return { backgroundColor: theme.color.state.success.background, borderColor: theme.color.state.success.border };
        case 'warning':
          return { backgroundColor: theme.color.state.warning.background, borderColor: theme.color.state.warning.border };
        case 'danger':
          return { backgroundColor: theme.color.state.danger.background, borderColor: theme.color.state.danger.border };
        default:
          return { backgroundColor: theme.color.surface.base, borderColor: 'transparent' };
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

  const DataRow: React.FC<DataRowProps> = ({ label, value, valueColor, isBold, isTotal }) => (
    <View style={[styles.dataRow, isTotal && styles.dataRowTotal]}>
      <Text style={[styles.dataLabel, isBold && styles.dataLabelBold]}>{label}</Text>
      <Text style={[styles.dataValue, isBold && styles.dataValueBold, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );

  const QuickFilterButton: React.FC<QuickFilterButtonProps> = ({ label, onPress }) => (
    <TouchableOpacity style={styles.quickFilterButton} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.quickFilterText}>{label}</Text>
    </TouchableOpacity>
  );

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

  // AutoMatching bank info (optional and independent from normal bank info)
  const [includeAutoMatchingBankInfo, setIncludeAutoMatchingBankInfo] = useState(false);
  const [autoMatchingDate, setAutoMatchingDate] = useState<Date>(new Date());
  const [showAutoMatchingDatePicker, setShowAutoMatchingDatePicker] = useState(false);
  const [isLoadingAutoMatching, setIsLoadingAutoMatching] = useState(false);
  const [autoMatchingTransactions, setAutoMatchingTransactions] = useState<AutoMatchingTransaction[]>([]);
  const [autoMatchingTotalIngresos, setAutoMatchingTotalIngresos] = useState(0);

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
    console.log('ðŸ¦ [CuadreScreen] Starting to load bank accounts...');
    try {
      setIsLoadingBankAccounts(true);
      console.log('ðŸ¦ [CuadreScreen] Calling treasuryApi.getActiveBankAccounts()...');

      const accounts = await treasuryApi.getActiveBankAccounts();

      console.log('ðŸ¦ [CuadreScreen] Received accounts:', accounts);
      console.log('ðŸ¦ [CuadreScreen] Accounts count:', accounts?.length || 0);
      console.log('ðŸ¦ [CuadreScreen] Accounts type:', typeof accounts);
      console.log('ðŸ¦ [CuadreScreen] Is array:', Array.isArray(accounts));

      if (accounts && accounts.length > 0) {
        console.log('ðŸ¦ [CuadreScreen] First account sample:', JSON.stringify(accounts[0], null, 2));
      }

      setBankAccounts(accounts || []);
      // Select all accounts by default
      const accountIds = (accounts || []).map((a: any) => a.id);
      console.log('ðŸ¦ [CuadreScreen] Account IDs:', accountIds);
      setSelectedBankAccountIds(new Set(accountIds));
      console.log('ðŸ¦ [CuadreScreen] Bank accounts loaded successfully!');
    } catch (error: any) {
      console.error('ðŸ¦ [CuadreScreen] Error loading bank accounts:', error);
      console.error('ðŸ¦ [CuadreScreen] Error message:', error?.message);
      console.error('ðŸ¦ [CuadreScreen] Error response:', error?.response?.data);
      Alert.alert('Error', 'No se pudieron cargar las cuentas bancarias');
    } finally {
      setIsLoadingBankAccounts(false);
      console.log('ðŸ¦ [CuadreScreen] Loading finished');
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

  const handleToggleIncludeAutoMatchingBankInfo = () => {
    const newValue = !includeAutoMatchingBankInfo;
    setIncludeAutoMatchingBankInfo(newValue);

    if (!newValue) {
      setAutoMatchingTransactions([]);
      setAutoMatchingTotalIngresos(0);
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

  const loadAutoMatchingBankInfo = async (sedeIdsArray: string[]) => {
    if (!includeAutoMatchingBankInfo) {
      setAutoMatchingTransactions([]);
      setAutoMatchingTotalIngresos(0);
      return;
    }

    try {
      setIsLoadingAutoMatching(true);

      const selectedDate = formatDate(autoMatchingDate);
      const response = await treasuryApi.getTransactionsByDateSites({
        startDate: selectedDate,
        endDate: selectedDate,
        siteIds: sedeIdsArray,
      });

      const transactions = response?.data || [];
      const totalIngresos = transactions
        .filter((tx) => tx.direction === 'INGRESO')
        .reduce((acc, tx) => acc + (tx.amountCents || 0) / 100, 0);

      setAutoMatchingTransactions(transactions);
      setAutoMatchingTotalIngresos(totalIngresos);
    } catch (error: any) {
      console.error('Error loading automatching bank info:', error);
      Alert.alert('Error', error?.message || 'No se pudo cargar la informaciÃ³n bancaria por automatching');
      setAutoMatchingTransactions([]);
      setAutoMatchingTotalIngresos(0);
    } finally {
      setIsLoadingAutoMatching(false);
    }
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
        console.log('ðŸ“Š [Cuadre] Cuentas bancarias seleccionadas:', bankAccountIdsArray.length, 'de', bankAccounts.length);
        console.log('ðŸ“Š [Cuadre] Fechas bancarias:', params.bank_fecha_inicio, 'al', params.bank_fecha_fin);
      }

      console.log('ðŸ“Š [Cuadre] Enviando peticiÃ³n con params:', JSON.stringify(params, null, 2));
      console.log('ðŸ“Š [Cuadre] Sedes seleccionadas:', sedeIdsArray.length, 'de', sedes.length);

      const data = await cashReconciliationApi.getCuadreCaja(params);
      setCuadreData(data as CuadreCajaResponse);

      // Optional automatching bank info (independent endpoint and date selector)
      await loadAutoMatchingBankInfo(sedeIdsArray);
    } catch (error: any) {
      console.error('Error loading cuadre:', error);
      Alert.alert('Error', error?.message || 'No se pudo cargar el cuadre de caja');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [
    fechaInicio,
    fechaFin,
    selectedSedeIds,
    sedes.length,
    includeBankInfo,
    selectedBankAccountIds,
    bankAccounts.length,
    bankFechaInicio,
    bankFechaFin,
    includeAutoMatchingBankInfo,
    autoMatchingDate,
  ]);

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
        Alert.alert('Error', 'No hay sesiÃ³n activa');
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
        Alert.alert('Ã‰xito', 'PDF descargado correctamente');
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
          Alert.alert('Ã‰xito', 'PDF descargado correctamente');
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
      ninguna: { label: 'Sin Discrepancias', color: theme.color.state.success.text, bgColor: theme.color.state.success.background, icon: 'checkmark-circle' },
      baja: { label: 'Discrepancia Baja', color: theme.color.state.warning.text, bgColor: theme.color.state.warning.background, icon: 'alert-circle' },
      media: { label: 'Discrepancia Media', color: theme.color.state.warning.text, bgColor: theme.color.state.warning.background, icon: 'alert-circle' },
      alta: { label: 'Discrepancia Alta', color: theme.color.state.danger.text, bgColor: theme.color.state.danger.background, icon: 'warning' },
      critica: { label: 'Discrepancia CrÃ­tica', color: theme.color.state.danger.text, bgColor: theme.color.state.danger.background, icon: 'warning' },
    };
    return severities[severidad] || { label: severidad, color: theme.color.text.muted, bgColor: theme.color.background.muted, icon: 'help-circle' as keyof typeof Ionicons.glyphMap };
  };

  // Determine if we're showing only external sedes (no Izipay/Prosegur data)
  const isOnlyExternas = showExternas && !showInternas;

  const diferencia = cuadreData
    ? cuadreData.izipay.bruto + cuadreData.prosegur.depositos + (cuadreData.notas_credito.total * -1) - cuadreData.ventas.total
    : 0;

  // Estimated payment for external sedes (Ventas neto - comisiÃ³n franquicia)
  const estimacionPago = cuadreData
    ? (cuadreData.ventas.total - cuadreData.notas_credito.total) / 1.15
    : 0;

  return (
    <ScreenLayout navigation={navigation as any}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonGradient}>
              <Ionicons name="arrow-back" size={24} color={theme.color.brand.onHeader} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="calculator-outline" size={22} color={theme.color.brand.onHeader} />
                </View>
                <Text style={styles.titleGradient}>Cuadre de Caja</Text>
              </View>
              <Text style={styles.subtitleGradient}>ConciliaciÃ³n de ventas y pagos</Text>
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
            colors={[theme.color.brand.primary]}
          />
        }
      >
        {/* Filters Section */}
        <AnimatedCard delay={0}>
          <View style={styles.filtersCard}>
            <View style={styles.filtersHeader}>
              <Ionicons name="filter" size={20} color={theme.color.brand.primary} />
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
                <Ionicons name="calendar-outline" size={22} color={theme.color.brand.primary} />
                <View style={styles.dateRangeTextContainer}>
                  <Text style={styles.dateRangeLabel}>Periodo</Text>
                  <Text style={styles.dateRangeValue}>
                    {formatDisplayDate(fechaInicio)} â€” {formatDisplayDate(fechaFin)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.color.icon.disabled} />
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
                    {showInternas && <Ionicons name="checkmark" size={14} color={theme.color.brand.onHeader} />}
                  </View>
                  <View style={styles.sedeToggleContent}>
                    <Ionicons name="business" size={18} color={showInternas ? theme.color.brand.primary : theme.color.icon.disabled} />
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
                    {showExternas && <Ionicons name="checkmark" size={14} color={theme.color.brand.onHeader} />}
                  </View>
                  <View style={styles.sedeToggleContent}>
                    <Ionicons name="storefront" size={18} color={showExternas ? theme.color.brand.accent : theme.color.icon.disabled} />
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
                        color={theme.color.brand.primary}
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
                        {allVisibleSelected && <Ionicons name="checkmark" size={12} color={theme.color.brand.onHeader} />}
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
                              {selectedSedeIds.has(sede.id) && <Ionicons name="checkmark" size={12} color={theme.color.brand.onHeader} />}
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
                <Ionicons name="checkmark-circle" size={16} color={theme.color.icon.success} />
                <Text style={styles.selectedSummaryText}>
                  {selectedSedeIds.size} de {sedes.length} sedes seleccionadas
                </Text>
              </View>
            </View>

            {/* Bank Accounts Section */}
            <View style={styles.bankAccountsSection}>
              <Text style={styles.sedeLabel}>InformaciÃ³n Bancaria</Text>

              {/* Optional automatching bank info */}
              <TouchableOpacity
                style={[
                  styles.bankToggleButton,
                  includeAutoMatchingBankInfo && styles.bankToggleButtonActive,
                ]}
                onPress={handleToggleIncludeAutoMatchingBankInfo}
                activeOpacity={0.7}
              >
                <View style={[styles.sedeToggleCheck, includeAutoMatchingBankInfo && styles.bankToggleCheckActive]}>
                  {includeAutoMatchingBankInfo && <Ionicons name="checkmark" size={14} color={theme.color.brand.onHeader} />}
                </View>
                <View style={styles.sedeToggleContent}>
                  <Ionicons name="git-compare-outline" size={18} color={includeAutoMatchingBankInfo ? theme.color.state.info.border : theme.color.icon.disabled} />
                  <Text style={[styles.sedeToggleText, includeAutoMatchingBankInfo && styles.sedeToggleTextActive]}>
                    Incluir informaciÃ³n de bancos (AutoMatching)
                  </Text>
                </View>
                {isLoadingAutoMatching && (
                  <ActivityIndicator size="small" color={theme.color.state.info.border} />
                )}
              </TouchableOpacity>

              {includeAutoMatchingBankInfo && (
                <View style={styles.bankDateSection}>
                  <Text style={styles.bankDateLabel}>Fecha AutoMatching</Text>
                  <TouchableOpacity
                    style={styles.bankDateRangeButton}
                    onPress={() => setShowAutoMatchingDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="calendar-outline" size={20} color={theme.color.state.info.border} />
                    <View style={styles.dateRangeTextContainer}>
                      <Text style={[styles.dateRangeLabel, { color: theme.color.state.info.border }]}>Fecha</Text>
                      <Text style={styles.dateRangeValue}>{formatDisplayDate(autoMatchingDate)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.color.icon.disabled} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Debug info - remove later */}
              {__DEV__ && (
                <Text style={{ fontSize: 10, color: theme.color.text.subtle, marginBottom: 4 }}>
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
                  {includeBankInfo && <Ionicons name="checkmark" size={14} color={theme.color.brand.onHeader} />}
                </View>
                <View style={styles.sedeToggleContent}>
                  <Ionicons name="wallet-outline" size={18} color={includeBankInfo ? theme.color.state.info.border : theme.color.icon.disabled} />
                  <Text style={[styles.sedeToggleText, includeBankInfo && styles.sedeToggleTextActive]}>
                    Incluir informaciÃ³n de bancos
                  </Text>
                </View>
                {isLoadingBankAccounts && (
                  <ActivityIndicator size="small" color={theme.color.state.info.border} />
                )}
              </TouchableOpacity>

              {/* Bank Date Range - Only show when includeBankInfo is true */}
              {includeBankInfo && (
                <View style={styles.bankDateSection}>
                  <Text style={styles.bankDateLabel}>PerÃ­odo de Transacciones Bancarias</Text>

                  {/* Quick Filters for Bank Dates */}
                  <View style={styles.bankQuickFiltersContainer}>
                    <TouchableOpacity style={styles.bankQuickFilterButton} onPress={setBankSameAsSales} activeOpacity={0.7}>
                      <Ionicons name="sync-outline" size={14} color={theme.color.state.info.border} />
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
                    <Ionicons name="calendar-outline" size={20} color={theme.color.state.info.border} />
                    <View style={styles.dateRangeTextContainer}>
                      <Text style={[styles.dateRangeLabel, { color: theme.color.state.info.border }]}>PerÃ­odo Bancos</Text>
                      <Text style={styles.dateRangeValue}>
                        {formatDisplayDate(bankFechaInicio)} â€” {formatDisplayDate(bankFechaFin)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.color.icon.disabled} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Bank Accounts Selector - Only show when includeBankInfo is true */}
              {includeBankInfo && bankAccounts.length > 0 && (
                <View style={styles.bankAccountsListContainer}>
                  {__DEV__ && (
                    <Text style={{ fontSize: 10, color: theme.color.text.link, padding: 4 }}>
                      âœ“ Lista visible - {bankAccounts.length} cuentas - Currencies: {Object.keys(bankAccountsByCurrency).join(', ')}
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
                        color={theme.color.state.info.border}
                      />
                      <Text style={[styles.sedeListHeaderText, { color: theme.color.state.info.text }]}>
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
                        {allBankAccountsSelected && <Ionicons name="checkmark" size={12} color={theme.color.brand.onHeader} />}
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
                              {currency === 'PEN' ? 'ðŸ‡µðŸ‡ª Soles (PEN)' : currency === 'USD' ? 'ðŸ‡ºðŸ‡¸ DÃ³lares (USD)' : currency}
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
                                {selectedBankAccountIds.has(account.id) && <Ionicons name="checkmark" size={12} color={theme.color.brand.onHeader} />}
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
                <View style={[styles.selectedSummary, { backgroundColor: theme.color.state.info.background }]}>
                  <Ionicons name="wallet" size={16} color={theme.color.state.info.border} />
                  <Text style={[styles.selectedSummaryText, { color: theme.color.state.info.text }]}>
                    {selectedBankAccountIds.size} de {bankAccounts.length} cuentas seleccionadas
                  </Text>
                </View>
              )}

              {/* Loading state */}
              {includeBankInfo && isLoadingBankAccounts && (
                <View style={styles.loadingBankAccounts}>
                  <ActivityIndicator size="small" color={theme.color.state.info.border} />
                  <Text style={styles.loadingBankAccountsText}>Cargando cuentas bancarias...</Text>
                </View>
              )}

              {/* No accounts message */}
              {includeBankInfo && !isLoadingBankAccounts && bankAccounts.length === 0 && (
                <View style={styles.noBankAccountsMessage}>
                  <Ionicons name="information-circle-outline" size={20} color={theme.color.icon.warning} />
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
                <ActivityIndicator color={theme.color.brand.onHeader} size="small" />
              ) : (
                <>
                  <Ionicons name="analytics" size={22} color={theme.color.brand.onHeader} />
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
            <DataCard title="Ventas" icon="cash-outline" iconColor={theme.color.icon.success} delay={200}>
              <DataRow label="Efectivo" value={formatCurrency(cuadreData.ventas.efectivo)} />
              <DataRow label="Tarjeta" value={formatCurrency(cuadreData.ventas.tarjeta)} />
              <DataRow label="Total" value={formatCurrency(cuadreData.ventas.total)} isBold isTotal />
              <DataRow label="Operaciones" value={cuadreData.ventas.cantidad_operaciones.toString()} />
            </DataCard>

            {/* Notas de CrÃ©dito Card */}
            <DataCard title="Notas de CrÃ©dito" icon="document-text-outline" iconColor={theme.color.icon.danger} delay={300} variant="danger">
              <DataRow label="Efectivo" value={formatCurrency(cuadreData.notas_credito.efectivo)} valueColor={theme.color.icon.danger} />
              <DataRow label="Tarjeta" value={formatCurrency(cuadreData.notas_credito.tarjeta)} valueColor={theme.color.icon.danger} />
              <DataRow label="Total" value={formatCurrency(cuadreData.notas_credito.total)} isBold isTotal valueColor={theme.color.icon.danger} />
              <DataRow label="Cantidad" value={cuadreData.notas_credito.cantidad.toString()} />
            </DataCard>

            {/* Izipay Card - Only for internal sedes */}
            {!isOnlyExternas && (
              <DataCard title="Izipay" icon="card-outline" iconColor={theme.color.brand.accent} delay={400}>
                <DataRow label="Bruto" value={formatCurrency(cuadreData.izipay.bruto)} />
                <DataRow label="Comisiones" value={`-${formatCurrency(cuadreData.izipay.comisiones)}`} valueColor={theme.color.icon.danger} />
                <DataRow label="Neto" value={formatCurrency(cuadreData.izipay.neto)} isBold isTotal />
                <DataRow label="Operaciones" value={cuadreData.izipay.cantidad_operaciones.toString()} />
                <DataRow label="Matcheadas" value={cuadreData.izipay.transacciones_matcheadas.toString()} />
                <DataRow label="% ComisiÃ³n Prom." value={`${cuadreData.izipay.porcentaje_comision_promedio.toFixed(2)}%`} />
              </DataCard>
            )}

            {/* Prosegur Card - Only for internal sedes */}
            {!isOnlyExternas && (
              <DataCard title="Prosegur" icon="business-outline" iconColor={theme.color.icon.warning} delay={500}>
                <DataRow label="DepÃ³sitos" value={formatCurrency(cuadreData.prosegur.depositos)} />
                <DataRow label="Balance" value={formatCurrency(cuadreData.prosegur.balances)} isBold isTotal />
                <DataRow label="Operaciones" value={cuadreData.prosegur.cantidad_operaciones.toString()} />
                <DataRow label="DepÃ³sitos (#)" value={cuadreData.prosegur.cantidad_depositos.toString()} />
                <DataRow label="Recogidas" value={cuadreData.prosegur.cantidad_recogidas.toString()} />
              </DataCard>
            )}

            {/* Ingresos Bancarios Card - Only when bank info is included (normal) */}
            {cuadreData.ingresos_bancarios && (
              <DataCard title="Ingresos Bancarios" icon="wallet-outline" iconColor={theme.color.state.info.border} delay={550} variant="default">
                <DataRow
                  label="Total Ingresos"
                  value={formatCurrency(cuadreData.ingresos_bancarios.total_ingresos)}
                  valueColor={theme.color.icon.success}
                  isBold
                  isTotal
                />
                <DataRow label="Transacciones" value={cuadreData.ingresos_bancarios.cantidad_transacciones.toString()} />
              </DataCard>
            )}

            {/* Ingresos Bancarios AutoMatching Card - Optional */}
            {includeAutoMatchingBankInfo && (
              <DataCard title="Ingresos Bancarios (AutoMatching)" icon="git-compare-outline" iconColor={theme.color.state.info.border} delay={575} variant="default">
                <DataRow
                  label="Total Ingresos"
                  value={formatCurrency(autoMatchingTotalIngresos)}
                  valueColor={theme.color.icon.success}
                  isBold
                  isTotal
                />
                <DataRow label="Transacciones" value={autoMatchingTransactions.length.toString()} />
                <DataRow label="Fecha" value={formatDisplayDate(autoMatchingDate)} />
              </DataCard>
            )}

            {/* EstimaciÃ³n de Pago Card - Only for external sedes */}
            {isOnlyExternas && (
              <DataCard title="EstimaciÃ³n de Pago" icon="wallet-outline" iconColor={theme.color.icon.success} delay={400} variant="success">
                <DataRow label="Total Ventas" value={formatCurrency(cuadreData.ventas.total)} />
                <DataRow label="Notas de CrÃ©dito" value={`-${formatCurrency(cuadreData.notas_credito.total)}`} valueColor={theme.color.icon.danger} />
                <DataRow label="Ventas Netas" value={formatCurrency(cuadreData.ventas.total - cuadreData.notas_credito.total)} isBold />
                <DataRow label="ComisiÃ³n Franquicia (15%)" value={`-${formatCurrency((cuadreData.ventas.total - cuadreData.notas_credito.total) - estimacionPago)}`} valueColor={theme.color.text.muted} />
                <DataRow
                  label="EstimaciÃ³n a Pagar"
                  value={formatCurrency(estimacionPago)}
                  isBold
                  isTotal
                  valueColor={theme.color.state.success.text}
                />
              </DataCard>
            )}

            {/* Resumen Card - Different content for internal vs external */}
            {!isOnlyExternas ? (
              <DataCard title="Resumen de Totales" icon="calculator-outline" iconColor={theme.color.state.info.border} delay={600} variant="success">
                <DataRow label="Total Ventas" value={formatCurrency(cuadreData.ventas.total)} />
                <DataRow label="Notas de CrÃ©dito" value={formatCurrency(cuadreData.notas_credito.total)} valueColor={theme.color.icon.danger} />
                <DataRow label="Izipay (Bruto)" value={formatCurrency(cuadreData.izipay.bruto)} />
                <DataRow label="Comisiones" value={`-${formatCurrency(cuadreData.izipay.comisiones)}`} valueColor={theme.color.icon.danger} />
                <DataRow label="Prosegur" value={formatCurrency(cuadreData.prosegur.depositos)} />
                <DataRow
                  label="Diferencia"
                  value={formatCurrency(diferencia)}
                  isBold
                  isTotal
                  valueColor={diferencia !== 0 ? theme.color.icon.warning : theme.color.icon.success}
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
                      valueColor={theme.color.state.info.border}
                    />
                    <DataRow
                      label="Diferencia con Bancos"
                      value={formatCurrency((cuadreData.prosegur.depositos + cuadreData.izipay.neto) - cuadreData.ingresos_bancarios.total_ingresos)}
                      isBold
                      isTotal
                      valueColor={
                        (cuadreData.prosegur.depositos + cuadreData.izipay.neto) - cuadreData.ingresos_bancarios.total_ingresos === 0
                          ? theme.color.icon.success
                          : theme.color.icon.warning
                      }
                    />
                  </>
                )}

                {/* AutoMatching comparison - optional */}
                {includeAutoMatchingBankInfo && (
                  <>
                    <DataRow
                      label="Total de Ingresos (AutoMatching)"
                      value={formatCurrency(autoMatchingTotalIngresos)}
                      valueColor={theme.color.state.info.border}
                    />
                    <DataRow
                      label="Diferencia con AutoMatching"
                      value={formatCurrency((cuadreData.prosegur.depositos + cuadreData.izipay.neto) - autoMatchingTotalIngresos)}
                      isBold
                      isTotal
                      valueColor={
                        (cuadreData.prosegur.depositos + cuadreData.izipay.neto) - autoMatchingTotalIngresos === 0
                          ? theme.color.icon.success
                          : theme.color.icon.warning
                      }
                    />
                  </>
                )}
              </DataCard>
            ) : (
              <DataCard title="Resumen Sedes Externas" icon="calculator-outline" iconColor={theme.color.state.info.border} delay={500} variant="success">
                <DataRow label="Total Ventas" value={formatCurrency(cuadreData.ventas.total)} />
                <DataRow label="Notas de CrÃ©dito" value={`-${formatCurrency(cuadreData.notas_credito.total)}`} valueColor={theme.color.icon.danger} />
                <DataRow label="Ventas Netas" value={formatCurrency(cuadreData.ventas.total - cuadreData.notas_credito.total)} isBold />
                <DataRow
                  label="EstimaciÃ³n a Pagar"
                  value={formatCurrency(estimacionPago)}
                  isBold
                  isTotal
                  valueColor={theme.color.state.success.text}
                />
              </DataCard>
            )}

            {/* Operaciones Card - Only for internal sedes */}
            {!isOnlyExternas && (
              <DataCard title="Operaciones" icon="git-compare-outline" iconColor={theme.color.brand.primary} delay={700}>
                <DataRow label="Ventas" value={cuadreData.operaciones.ventas.toString()} />
                <DataRow label="Izipay" value={cuadreData.operaciones.izipay.toString()} />
                <DataRow label="Prosegur" value={cuadreData.operaciones.prosegur.toString()} />
                <DataRow
                  label="Coinciden"
                  value={cuadreData.operaciones.coinciden ? 'âœ“ SÃ­' : 'âœ— No'}
                  valueColor={cuadreData.operaciones.coinciden ? theme.color.icon.success : theme.color.icon.warning}
                  isBold
                />
              </DataCard>
            )}

            {/* Metadata */}
            <AnimatedCard delay={800}>
              <View style={styles.metadataContainer}>
                <View style={styles.metadataRow}>
                  <Ionicons name="time-outline" size={16} color={theme.color.text.muted} />
                  <Text style={styles.metadataText}>
                    Generado: {new Date(cuadreData.generado_en).toLocaleString('es-PE')}
                  </Text>
                </View>
                <View style={styles.metadataRow}>
                  <Ionicons name="calendar-outline" size={16} color={theme.color.text.muted} />
                  <Text style={styles.metadataText}>
                    Periodo: {cuadreData.fecha_inicio} al {cuadreData.fecha_fin}
                  </Text>
                </View>
                {cuadreData.sedes.length > 0 && (
                  <View style={styles.metadataRow}>
                    <Ionicons name="location-outline" size={16} color={theme.color.text.muted} />
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
                  <ActivityIndicator color={theme.color.brand.onHeader} size="small" />
                ) : (
                  <>
                    <Ionicons name="document-text" size={24} color={theme.color.brand.onHeader} />
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
                    <Ionicons name="wallet-outline" size={20} color={theme.color.state.info.border} />
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
                          <Text style={[styles.bankAccountDetailValue, { color: theme.color.icon.success }]}>
                            {formatCurrency(cuenta.total_ingresos)}
                          </Text>
                          <Text style={styles.bankAccountDetailCount}>({cuenta.cantidad_ingresos})</Text>
                        </View>
                        <View style={styles.bankAccountDetailItem}>
                          <Text style={styles.bankAccountDetailLabel}>Egresos</Text>
                          <Text style={[styles.bankAccountDetailValue, { color: theme.color.icon.danger }]}>
                            {formatCurrency(cuenta.total_egresos)}
                          </Text>
                          <Text style={styles.bankAccountDetailCount}>({cuenta.cantidad_egresos})</Text>
                        </View>
                        <View style={styles.bankAccountDetailItem}>
                          <Text style={styles.bankAccountDetailLabel}>Balance</Text>
                          <Text style={[styles.bankAccountDetailValue, { color: cuenta.balance_neto >= 0 ? theme.color.state.success.text : theme.color.state.danger.text, fontWeight: '700' }]}>
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
                <Ionicons name="analytics-outline" size={64} color={theme.color.icon.disabled} />
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

      {/* AutoMatching single date picker */}
      <DatePicker
        visible={showAutoMatchingDatePicker}
        date={autoMatchingDate}
        onConfirm={(date) => {
          setAutoMatchingDate(date);
          setShowAutoMatchingDatePicker(false);
        }}
        onCancel={() => setShowAutoMatchingDatePicker(false)}
        title="Seleccionar fecha para AutoMatching"
      />
      </View>
    </ScreenLayout>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.muted,
  },
  // Header con gradiente
  headerGradient: {
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[4],
    paddingBottom: theme.space[4],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
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
  titleGradient: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
    letterSpacing: 0.3,
  },
  subtitleGradient: {
    fontSize: 14,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    marginLeft: theme.space[12],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.surface.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },

  // Filters Card
  filtersCard: {
    backgroundColor: theme.color.surface.base,
    marginHorizontal: theme.space[4],
    marginTop: theme.space[4],
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    ...theme.shadow.sm,
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[4],
    gap: theme.space[2],
  },
  filtersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  quickFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    marginBottom: theme.space[4],
  },
  quickFilterButton: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    backgroundColor: theme.color.brand.primarySoft,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  quickFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.brand.primary,
  },
  dateRangeContainer: {
    marginBottom: theme.space[4],
  },
  dateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.brand.primarySoft,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[4],
    gap: theme.space[3],
  },
  dateRangeTextContainer: {
    flex: 1,
  },
  dateRangeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.color.brand.primary,
    marginBottom: 2,
  },
  dateRangeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  sedeContainer: {
    marginBottom: theme.space[4],
  },
  sedeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.text.muted,
    marginBottom: theme.space[3],
  },

  // Sede Toggle Buttons
  sedeToggleRow: {
    flexDirection: 'row',
    gap: theme.space[3],
    marginBottom: theme.space[3],
  },
  sedeToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: theme.color.border.subtle,
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[3],
    gap: theme.space[2],
  },
  sedeToggleButtonActive: {
    backgroundColor: theme.color.brand.primarySoft,
    borderColor: theme.color.border.default,
  },
  sedeToggleCheck: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.color.border.default,
    backgroundColor: theme.color.surface.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sedeToggleCheckActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  sedeToggleContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  sedeToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.text.subtle,
  },
  sedeToggleTextActive: {
    color: theme.color.text.heading,
  },
  sedeToggleCount: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.color.text.disabled,
  },

  // Sede List Container
  sedeListContainer: {
    backgroundColor: theme.color.brand.primarySoft,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    marginBottom: theme.space[3],
    overflow: 'hidden',
  },
  sedeListContainerExternas: {
    backgroundColor: theme.color.brand.accentSoft,
    borderColor: theme.color.brand.accentSoft,
  },
  sedeListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[3],
    backgroundColor: 'transparent',
  },
  sedeListHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  sedeListHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.brand.primary,
  },
  sedeListHeaderCount: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.color.text.subtle,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    paddingVertical: theme.space[1],
    paddingHorizontal: theme.space[2],
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.color.text.muted,
  },

  // Checkbox
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.color.border.default,
    backgroundColor: theme.color.surface.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  checkboxExternas: {
    borderColor: theme.color.brand.accent,
  },
  checkboxExternasChecked: {
    backgroundColor: theme.color.brand.accent,
    borderColor: theme.color.brand.accent,
  },

  // Sede List Items
  sedeListItems: {
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
    backgroundColor: theme.color.surface.base,
  },
  sedeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[3],
    gap: theme.space[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.background.muted,
  },
  sedeListItemInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: theme.space[1],
  },
  sedeListItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  sedeListItemCode: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.text.heading,
    backgroundColor: theme.color.background.muted,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
  },
  sedeListItemName: {
    fontSize: 14,
    color: theme.color.text.muted,
  },
  sedeTypeBadge: {
    paddingHorizontal: theme.space[2],
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
  },
  sedeTypeBadgeInternal: {
    backgroundColor: theme.color.brand.primarySoft,
  },
  sedeTypeBadgeExternal: {
    backgroundColor: theme.color.brand.accentSoft,
  },
  sedeTypeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sedeTypeBadgeTextInternal: {
    color: theme.color.brand.primary,
  },
  sedeTypeBadgeTextExternal: {
    color: theme.color.brand.accent,
  },

  // Selected Summary
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[2],
    paddingVertical: theme.space[2],
    backgroundColor: theme.color.state.success.background,
    borderRadius: theme.radii.md,
  },
  selectedSummaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.state.success.text,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.brand.primary,
    paddingVertical: theme.space[4],
    borderRadius: theme.radii.lg,
    gap: theme.space[3],
    ...theme.shadow.md,
  },
  generateButtonDisabled: {
    backgroundColor: theme.color.border.default,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.brand.onHeader,
  },

  // Severity Badge
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: theme.space[4],
    marginTop: theme.space[4],
    paddingVertical: theme.space[4],
    paddingHorizontal: theme.space[5],
    borderRadius: theme.radii.lg,
    gap: theme.space[3],
  },
  severityText: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Data Card
  dataCard: {
    backgroundColor: theme.color.surface.base,
    marginHorizontal: theme.space[4],
    marginTop: theme.space[4],
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    ...theme.shadow.sm,
  },
  dataCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[4],
    gap: theme.space[3],
  },
  dataCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.space[2],
  },
  dataRowTotal: {
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
    marginTop: theme.space[2],
    paddingTop: theme.space[3],
  },
  dataLabel: {
    fontSize: 14,
    color: theme.color.text.muted,
  },
  dataLabelBold: {
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.text.heading,
  },
  dataValueBold: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Metadata
  metadataContainer: {
    backgroundColor: theme.color.background.subtle,
    marginHorizontal: theme.space[4],
    marginTop: theme.space[4],
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    gap: theme.space[2],
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  metadataText: {
    fontSize: 14,
    color: theme.color.text.muted,
  },

  // PDF Button
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.brand.accent,
    marginHorizontal: theme.space[4],
    marginTop: theme.space[4],
    paddingVertical: theme.space[4],
    borderRadius: theme.radii.lg,
    gap: theme.space[3],
    ...theme.shadow.md,
  },
  pdfButtonDisabled: {
    backgroundColor: theme.color.border.default,
  },
  pdfButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.brand.onHeader,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.space[16],
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.color.background.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.space[4],
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: theme.space[2],
  },
  emptyText: {
    fontSize: 14,
    color: theme.color.text.subtle,
    textAlign: 'center',
  },

  bottomSpacer: {
    height: theme.space[8],
  },

  // ==================== Bank Accounts Styles ====================

  bankAccountsSection: {
    marginBottom: theme.space[4],
    paddingTop: theme.space[4],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  bankToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: theme.color.border.subtle,
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[3],
    gap: theme.space[2],
    marginBottom: theme.space[3],
  },
  bankToggleButtonActive: {
    backgroundColor: theme.color.state.info.background,
    borderColor: theme.color.state.info.border,
  },
  bankToggleCheckActive: {
    backgroundColor: theme.color.state.info.border,
    borderColor: theme.color.state.info.border,
  },
  bankDateSection: {
    marginBottom: theme.space[3],
    padding: theme.space[3],
    backgroundColor: theme.color.state.info.background,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.state.info.border,
  },
  bankDateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.state.info.text,
    marginBottom: theme.space[2],
  },
  bankQuickFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    marginBottom: theme.space[3],
  },
  bankQuickFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1] + 2,
    backgroundColor: theme.color.state.info.background,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.color.state.info.border,
    gap: theme.space[1],
  },
  bankQuickFilterText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.color.state.info.text,
  },
  bankDateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.state.info.border,
    paddingVertical: theme.space[2] + 2,
    paddingHorizontal: theme.space[3],
    gap: theme.space[2],
  },
  bankAccountsListContainer: {
    backgroundColor: theme.color.state.info.background,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.state.info.border,
    marginBottom: theme.space[3],
    overflow: 'hidden',
  },
  checkboxBank: {
    borderColor: theme.color.state.info.border,
  },
  checkboxBankChecked: {
    backgroundColor: theme.color.state.info.border,
    borderColor: theme.color.state.info.border,
  },
  currencyHeader: {
    backgroundColor: theme.color.state.info.background,
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.state.info.border,
  },
  currencyHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.state.info.text,
    textTransform: 'uppercase',
  },
  bankAccountItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[3],
    gap: theme.space[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.background.muted,
    backgroundColor: theme.color.surface.base,
  },
  bankAccountItemInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: theme.space[1],
  },
  bankAccountItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  bankAccountBankName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.state.info.text,
    backgroundColor: theme.color.state.info.background,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
  },
  bankAccountCurrencyBadge: {
    backgroundColor: theme.color.border.subtle,
    paddingHorizontal: theme.space[2],
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
  },
  bankAccountCurrencyText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.text.muted,
  },
  bankAccountAlias: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.text.heading,
  },
  bankAccountNumber: {
    fontSize: 12,
    color: theme.color.text.subtle,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  loadingBankAccounts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[2],
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.state.info.background,
    borderRadius: theme.radii.md,
  },
  loadingBankAccountsText: {
    fontSize: 14,
    color: theme.color.state.info.text,
  },
  noBankAccountsMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[2],
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.state.warning.background,
    borderRadius: theme.radii.md,
  },
  noBankAccountsText: {
    fontSize: 14,
    color: theme.color.state.warning.text,
  },

  // ==================== Bank Accounts Detail (Results) Styles ====================

  bankAccountsDetailContainer: {
    backgroundColor: theme.color.surface.base,
    marginHorizontal: theme.space[4],
    marginTop: theme.space[4],
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    ...theme.shadow.sm,
  },
  bankAccountsDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[4],
    gap: theme.space[2],
  },
  bankAccountsDetailSection: {
    marginTop: theme.space[4],
    paddingTop: theme.space[4],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  bankAccountsDetailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.state.info.text,
  },
  bankAccountDetailCard: {
    backgroundColor: theme.color.state.info.background,
    borderRadius: theme.radii.md,
    padding: theme.space[3],
    marginBottom: theme.space[2],
    borderWidth: 1,
    borderColor: theme.color.state.info.border,
  },
  bankAccountDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space[2],
  },
  bankAccountDetailBadge: {
    backgroundColor: theme.color.state.info.border,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
  },
  bankAccountDetailBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
  },
  bankAccountDetailCurrency: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.text.subtle,
    backgroundColor: theme.color.border.subtle,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
  },
  bankAccountDetailAlias: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.heading,
  },
  bankAccountDetailNumber: {
    fontSize: 12,
    color: theme.color.text.subtle,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: theme.space[2],
  },
  bankAccountDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.space[2],
  },
  bankAccountDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  bankAccountDetailLabel: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginBottom: theme.space[1],
  },
  bankAccountDetailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  bankAccountDetailCount: {
    fontSize: 12,
    color: theme.color.text.disabled,
  },
});
