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
import { Picker } from '@react-native-picker/picker';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { sitesApi } from '@/services/api/sites';
import { cashReconciliationApi, CuadreCajaResponse } from '@/services/api/cash-reconciliation';
import { Site } from '@/types/sites';
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

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSedes, setIsLoadingSedes] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  // Filter states
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<Date>(new Date());
  const [fechaFin, setFechaFin] = useState<Date>(new Date());

  // Date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

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
      const response = await sitesApi.getSites({ limit: 100 });
      setSedes(response.data || []);
    } catch (error) {
      console.error('Error loading sedes:', error);
    } finally {
      setIsLoadingSedes(false);
    }
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

      const params = {
        fecha_inicio: formatDate(fechaInicio),
        fecha_fin: formatDate(fechaFin),
        ...(selectedSede && { sede_id: selectedSede }),
      };

      const data = await cashReconciliationApi.getCuadreCaja(params);
      setCuadreData(data as CuadreCajaResponse);
    } catch (error: any) {
      console.error('Error loading cuadre:', error);
      Alert.alert('Error', error?.message || 'No se pudo cargar el cuadre de caja');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fechaInicio, fechaFin, selectedSede]);

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

      if (selectedSede) {
        params.append('sede_id', selectedSede);
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
        window.open(blobUrl, '_blank');
        Alert.alert('Éxito', 'PDF descargado correctamente');
      } else {
        const timestamp = Date.now();
        const fileName = `cuadre-caja-${formatDate(fechaInicio)}-${formatDate(fechaFin)}-${timestamp}.pdf`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

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

  const diferencia = cuadreData
    ? cuadreData.izipay.bruto + cuadreData.prosegur.depositos + (cuadreData.notas_credito.total * -1) - cuadreData.ventas.total
    : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.neutral[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cuadre de Caja</Text>
        <View style={styles.placeholder} />
      </View>

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

            {/* Date Range */}
            <View style={styles.dateRangeContainer}>
              <View style={styles.datePickerWrapper}>
                <Text style={styles.dateLabel}>Desde</Text>
                <DatePickerButton
                  label=""
                  value={formatDisplayDate(fechaInicio)}
                  onPress={() => setShowStartDatePicker(true)}
                />
              </View>
              <View style={styles.datePickerWrapper}>
                <Text style={styles.dateLabel}>Hasta</Text>
                <DatePickerButton
                  label=""
                  value={formatDisplayDate(fechaFin)}
                  onPress={() => setShowEndDatePicker(true)}
                />
              </View>
            </View>

            {/* Sede Selector */}
            <View style={styles.sedeContainer}>
              <Text style={styles.sedeLabel}>Sede</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedSede}
                  onValueChange={setSelectedSede}
                  style={styles.picker}
                  enabled={!isLoadingSedes}
                >
                  <Picker.Item label="Todas las sedes" value="" />
                  {sedes.map((sede) => (
                    <Picker.Item
                      key={sede.id}
                      label={`${sede.code} - ${sede.name}`}
                      value={sede.id}
                    />
                  ))}
                </Picker>
              </View>
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
            {/* Severity Badge */}
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

            {/* Izipay Card */}
            <DataCard title="Izipay" icon="card-outline" iconColor={colors.accent[600]} delay={400}>
              <DataRow label="Bruto" value={formatCurrency(cuadreData.izipay.bruto)} />
              <DataRow label="Comisiones" value={`-${formatCurrency(cuadreData.izipay.comisiones)}`} valueColor={colors.danger[600]} />
              <DataRow label="Neto" value={formatCurrency(cuadreData.izipay.neto)} isBold isTotal />
              <DataRow label="Operaciones" value={cuadreData.izipay.cantidad_operaciones.toString()} />
              <DataRow label="Matcheadas" value={cuadreData.izipay.transacciones_matcheadas.toString()} />
              <DataRow label="% Comisión Prom." value={`${cuadreData.izipay.porcentaje_comision_promedio.toFixed(2)}%`} />
            </DataCard>

            {/* Prosegur Card */}
            <DataCard title="Prosegur" icon="business-outline" iconColor={colors.warning[600]} delay={500}>
              <DataRow label="Depósitos" value={formatCurrency(cuadreData.prosegur.depositos)} />
              <DataRow label="Balance" value={formatCurrency(cuadreData.prosegur.balances)} isBold isTotal />
              <DataRow label="Operaciones" value={cuadreData.prosegur.cantidad_operaciones.toString()} />
              <DataRow label="Depósitos (#)" value={cuadreData.prosegur.cantidad_depositos.toString()} />
              <DataRow label="Recogidas" value={cuadreData.prosegur.cantidad_recogidas.toString()} />
            </DataCard>

            {/* Resumen Card */}
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
            </DataCard>

            {/* Operaciones Card */}
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

      {/* Date Pickers */}
      <DatePicker
        visible={showStartDatePicker}
        date={fechaInicio}
        onConfirm={(date) => {
          setFechaInicio(date);
          setShowStartDatePicker(false);
        }}
        onCancel={() => setShowStartDatePicker(false)}
      />

      <DatePicker
        visible={showEndDatePicker}
        date={fechaFin}
        onConfirm={(date) => {
          setFechaFin(date);
          setShowEndDatePicker(false);
        }}
        onCancel={() => setShowEndDatePicker(false)}
      />
    </View>
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
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  datePickerWrapper: {
    flex: 1,
  },
  dateLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.neutral[600],
    marginBottom: spacing[2],
  },
  sedeContainer: {
    marginBottom: spacing[4],
  },
  sedeLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.neutral[600],
    marginBottom: spacing[2],
  },
  pickerContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: colors.neutral[900],
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
});
