import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { sitesApi } from '@/services/api/sites';
import { cashReconciliationApi, CuadreCajaResponse } from '@/services/api/cash-reconciliation';
import { Site } from '@/types/sites';

type Props = NativeStackScreenProps<any, 'Cuadre'>;

export const CuadreScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // Data states
  const [cuadreData, setCuadreData] = useState<CuadreCajaResponse | null>(null);
  const [sedes, setSedes] = useState<Site[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSedes, setIsLoadingSedes] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter states
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<Date>(new Date());
  const [fechaFin, setFechaFin] = useState<Date>(new Date());

  // Date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Load sedes on mount
  React.useEffect(() => {
    loadSedes();
  }, []);

  const loadSedes = async () => {
    try {
      setIsLoadingSedes(true);
      const response = await sitesApi.getSites({ limit: 100 });
      setSedes(response.data || []);
    } catch (error) {
      console.error('Error loading sedes:', error);
      Alert.alert('Error', 'No se pudieron cargar las sedes');
    } finally {
      setIsLoadingSedes(false);
    }
  };

  // Format date to YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Quick filter functions
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

  // Load cuadre data
  const loadCuadre = useCallback(
    async (isRefresh: boolean = false) => {
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
        Alert.alert(
          'Error',
          error?.message || 'No se pudo cargar el cuadre de caja'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [fechaInicio, fechaFin, selectedSede]
  );

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `S/ ${amount.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Get severity color
  const getSeverityColor = (severidad: string): string => {
    switch (severidad) {
      case 'ninguna':
        return '#10B981';
      case 'baja':
        return '#F59E0B';
      case 'media':
        return '#F97316';
      case 'alta':
        return '#EF4444';
      case 'critica':
        return '#DC2626';
      default:
        return '#6B7280';
    }
  };

  // Get severity label
  const getSeverityLabel = (severidad: string): string => {
    switch (severidad) {
      case 'ninguna':
        return 'Sin Discrepancias';
      case 'baja':
        return 'Discrepancia Baja';
      case 'media':
        return 'Discrepancia Media';
      case 'alta':
        return 'Discrepancia Alta';
      case 'critica':
        return 'Discrepancia Crítica';
      default:
        return severidad;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cuadre de Caja</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadCuadre(true)} />
        }
      >
        {/* Filters Section */}
        <View style={styles.filtersContainer}>
          <Text style={styles.sectionTitle}>Filtros</Text>

          {/* Quick Filters */}
          <View style={styles.quickFiltersContainer}>
            <TouchableOpacity style={styles.quickFilterButton} onPress={setToday}>
              <Text style={styles.quickFilterText}>Hoy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickFilterButton} onPress={setYesterday}>
              <Text style={styles.quickFilterText}>Ayer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickFilterButton} onPress={setThisWeek}>
              <Text style={styles.quickFilterText}>Esta Semana</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickFilterButton} onPress={setThisMonth}>
              <Text style={styles.quickFilterText}>Este Mes</Text>
            </TouchableOpacity>
          </View>

          {/* Date Range */}
          <View style={styles.dateRangeContainer}>
            <View style={styles.datePickerWrapper}>
              <DatePickerButton
                label="Fecha Inicio"
                value={formatDate(fechaInicio)}
                onPress={() => setShowStartDatePicker(true)}
              />
            </View>
            <View style={styles.datePickerWrapper}>
              <DatePickerButton
                label="Fecha Fin"
                value={formatDate(fechaFin)}
                onPress={() => setShowEndDatePicker(true)}
              />
            </View>
          </View>

          {/* Sede Selector */}
          <View style={styles.pickerContainer}>
            <Text style={styles.label}>Sede</Text>
            <View style={styles.pickerWrapper}>
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
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.generateButtonText}>Generar Cuadre</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Results Section */}
        {cuadreData && (
          <View style={styles.resultsContainer}>
            {/* Severity Badge */}
            <View
              style={[
                styles.severityBadge,
                { backgroundColor: getSeverityColor(cuadreData.cuadre.severidad) },
              ]}
            >
              <Text style={styles.severityText}>
                {getSeverityLabel(cuadreData.cuadre.severidad)}
              </Text>
            </View>

            {/* Ventas Section */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>💰 Ventas</Text>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Efectivo:</Text>
                <Text style={styles.cardValue}>
                  {formatCurrency(cuadreData.ventas.efectivo)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Tarjeta:</Text>
                <Text style={styles.cardValue}>
                  {formatCurrency(cuadreData.ventas.tarjeta)}
                </Text>
              </View>
              <View style={[styles.cardRow, styles.cardRowTotal]}>
                <Text style={styles.cardLabelBold}>Total:</Text>
                <Text style={styles.cardValueBold}>
                  {formatCurrency(cuadreData.ventas.total)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Operaciones:</Text>
                <Text style={styles.cardValue}>
                  {cuadreData.ventas.cantidad_operaciones}
                </Text>
              </View>
            </View>

            {/* Notas de Crédito Section */}
            <View style={[styles.card, styles.notasCreditoCard]}>
              <Text style={styles.cardTitle}>📝 Notas de Crédito (Anulaciones)</Text>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Efectivo:</Text>
                <Text style={[styles.cardValue, styles.negativeValue]}>
                  {formatCurrency(cuadreData.notas_credito.efectivo)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Tarjeta:</Text>
                <Text style={[styles.cardValue, styles.negativeValue]}>
                  {formatCurrency(cuadreData.notas_credito.tarjeta)}
                </Text>
              </View>
              <View style={[styles.cardRow, styles.cardRowTotal]}>
                <Text style={styles.cardLabelBold}>Total:</Text>
                <Text style={[styles.cardValueBold, styles.negativeValue]}>
                  {formatCurrency(cuadreData.notas_credito.total)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Cantidad:</Text>
                <Text style={styles.cardValue}>
                  {cuadreData.notas_credito.cantidad}
                </Text>
              </View>
            </View>

            {/* Izipay Section */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>💳 Izipay</Text>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Bruto:</Text>
                <Text style={styles.cardValue}>
                  {formatCurrency(cuadreData.izipay.bruto)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Comisiones:</Text>
                <Text style={[styles.cardValue, styles.negativeValue]}>
                  -{formatCurrency(cuadreData.izipay.comisiones)}
                </Text>
              </View>
              <View style={[styles.cardRow, styles.cardRowTotal]}>
                <Text style={styles.cardLabelBold}>Neto:</Text>
                <Text style={styles.cardValueBold}>
                  {formatCurrency(cuadreData.izipay.neto)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Operaciones:</Text>
                <Text style={styles.cardValue}>
                  {cuadreData.izipay.cantidad_operaciones}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Matcheadas:</Text>
                <Text style={styles.cardValue}>
                  {cuadreData.izipay.transacciones_matcheadas}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>% Comisión Promedio:</Text>
                <Text style={styles.cardValue}>
                  {cuadreData.izipay.porcentaje_comision_promedio.toFixed(2)}%
                </Text>
              </View>
            </View>

            {/* Prosegur Section */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏦 Prosegur</Text>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Depósitos:</Text>
                <Text style={styles.cardValue}>
                  {formatCurrency(cuadreData.prosegur.depositos)}
                </Text>
              </View>
              <View style={[styles.cardRow, styles.cardRowTotal]}>
                <Text style={styles.cardLabelBold}>Balance:</Text>
                <Text style={styles.cardValueBold}>
                  {formatCurrency(cuadreData.prosegur.balances)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Operaciones:</Text>
                <Text style={styles.cardValue}>
                  {cuadreData.prosegur.cantidad_operaciones}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Depósitos:</Text>
                <Text style={styles.cardValue}>
                  {cuadreData.prosegur.cantidad_depositos}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Recogidas:</Text>
                <Text style={styles.cardValue}>
                  {cuadreData.prosegur.cantidad_recogidas}
                </Text>
              </View>
            </View>

            {/* Totales Section */}
            <View style={[styles.card, styles.totalesCard]}>
              <Text style={styles.cardTitle}>💵 Resumen de Totales</Text>

              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Total Ventas:</Text>
                <Text style={styles.cardValue}>
                  {formatCurrency(cuadreData.ventas.total)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Total Notas de Crédito:</Text>
                <Text style={[styles.cardValue, styles.negativeValue]}>
                  {formatCurrency(cuadreData.notas_credito.total)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Total Izipay (Bruto):</Text>
                <Text style={styles.cardValue}>
                  {formatCurrency(cuadreData.izipay.bruto)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Total Comisiones:</Text>
                <Text style={[styles.cardValue, styles.negativeValue]}>
                  -{formatCurrency(cuadreData.izipay.comisiones)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Total Prosegur:</Text>
                <Text style={styles.cardValue}>
                  {formatCurrency(cuadreData.prosegur.depositos)}
                </Text>
              </View>

              <View style={[styles.cardRow, styles.cardRowTotal]}>
                <Text style={styles.cardLabel}>Diferencia:</Text>
                <Text
                  style={[
                    styles.cardValue,
                    (cuadreData.prosegur.depositos + cuadreData.izipay.bruto - cuadreData.ventas.total + cuadreData.notas_credito.total) !== 0 && styles.warningValue,
                  ]}
                >
                  {formatCurrency(
                    cuadreData.prosegur.depositos +
                    cuadreData.izipay.bruto -
                    cuadreData.ventas.total +
                    cuadreData.notas_credito.total
                  )}
                </Text>
              </View>

              <View style={[styles.cardRow, styles.cardRowTotal]}>
                <Text style={styles.cardLabelBold}>Total a Ingresar:</Text>
                <Text style={styles.cardValueBold}>
                  {formatCurrency(cuadreData.prosegur.depositos + cuadreData.izipay.neto)}
                </Text>
              </View>
            </View>

            {/* Operaciones Section */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🔢 Operaciones</Text>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Ventas:</Text>
                <Text style={styles.cardValue}>{cuadreData.operaciones.ventas}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Izipay:</Text>
                <Text style={styles.cardValue}>{cuadreData.operaciones.izipay}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Prosegur:</Text>
                <Text style={styles.cardValue}>{cuadreData.operaciones.prosegur}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Coinciden:</Text>
                <Text
                  style={[
                    styles.cardValue,
                    cuadreData.operaciones.coinciden
                      ? styles.successValue
                      : styles.warningValue,
                  ]}
                >
                  {cuadreData.operaciones.coinciden ? '✓ Sí' : '✗ No'}
                </Text>
              </View>
            </View>

            {/* Metadata */}
            <View style={styles.metadataContainer}>
              <Text style={styles.metadataText}>
                Generado: {new Date(cuadreData.generado_en).toLocaleString('es-PE')}
              </Text>
              <Text style={styles.metadataText}>
                Periodo: {cuadreData.fecha_inicio} al {cuadreData.fecha_fin}
              </Text>
              {cuadreData.sedes.length > 0 && (
                <Text style={styles.metadataText}>
                  Sedes: {cuadreData.sedes.map((s) => s.code).join(', ')}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Empty State */}
        {!cuadreData && !isLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📊</Text>
            <Text style={styles.emptyStateText}>
              Selecciona un rango de fechas y genera el cuadre
            </Text>
          </View>
        )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#374151',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  quickFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  quickFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  datePickerWrapper: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerWrapper: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  generateButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultsContainer: {
    padding: 16,
  },
  severityBadge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  severityText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalesCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  notasCreditoCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  cardRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
    paddingTop: 12,
  },
  cardLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  cardLabelBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  cardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  cardValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  negativeValue: {
    color: '#EF4444',
  },
  warningValue: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  successValue: {
    color: '#10B981',
    fontWeight: '700',
  },
  metadataContainer: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  metadataText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});
