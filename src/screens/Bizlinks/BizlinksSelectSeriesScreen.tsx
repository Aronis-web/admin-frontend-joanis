import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BizlinksDocumentType } from '@/types/bizlinks';
import { billingApi, DocumentSeries } from '@/services/api';

type Props = NativeStackScreenProps<any, 'BizlinksSelectSeries'>;

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  '01': 'Factura Electrónica',
  '03': 'Boleta de Venta',
  '07': 'Nota de Crédito',
  '08': 'Nota de Débito',
  '09': 'Guía de Remisión',
};

const DOCUMENT_TYPE_COLORS: Record<string, string> = {
  '01': '#3B82F6',
  '03': '#10B981',
  '07': '#F59E0B',
  '08': '#EF4444',
  '09': '#8B5CF6',
};

export const BizlinksSelectSeriesScreen: React.FC<Props> = ({ navigation, route }) => {
  const { documentType, companyId, siteId } = route.params || {};
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [series, setSeries] = useState<DocumentSeries[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSeries();
  }, [documentType]);

  const loadSeries = async () => {
    try {
      setLoading(true);

      // Obtener todas las series del tipo de documento
      const allSeries = await billingApi.getDocumentSeries({
        isActive: true,
      });

      // Filtrar por tipo de documento y que tengan números disponibles
      const availableSeries = allSeries.filter(
        (s) =>
          s.isActive &&
          s.documentType?.code === documentType &&
          s.currentNumber < s.maxNumber
      );

      if (availableSeries.length === 0) {
        Alert.alert(
          'Sin Series Disponibles',
          `No hay series activas con números disponibles para ${DOCUMENT_TYPE_LABELS[documentType]}.\n\nPor favor, crea una nueva serie en Configuración > Series y Correlativos.`,
          [
            {
              text: 'Ir a Configuración',
              onPress: () => {
                navigation.navigate('DocumentSeries');
              },
            },
            {
              text: 'Volver',
              onPress: () => navigation.goBack(),
              style: 'cancel',
            },
          ]
        );
      }

      setSeries(availableSeries);
    } catch (error: any) {
      console.error('Error loading series:', error);
      Alert.alert('Error', 'No se pudieron cargar las series disponibles');
    } finally {
      setLoading(false);
    }
  };

  const handleSeriesSelect = (selectedSeries: DocumentSeries) => {
    console.log('📋 Serie seleccionada:', selectedSeries);

    // Construir el formato completo: SERIE-NUMERO (ej: BP01-00000124)
    const nextNumber = selectedSeries.currentNumber + 1;
    const formattedNumber = nextNumber.toString().padStart(8, '0');
    const fullSerieNumero = `${selectedSeries.series}-${formattedNumber}`;

    console.log('📋 Serie completa:', fullSerieNumero);

    // Navegar a la pantalla de emisión correspondiente según el tipo de documento
    switch (documentType) {
      case BizlinksDocumentType.FACTURA:
        navigation.navigate('BizlinksEmitirFactura', {
          seriesId: selectedSeries.id,
          series: fullSerieNumero,
          documentType,
        });
        break;

      case BizlinksDocumentType.BOLETA:
        navigation.navigate('BizlinksEmitirBoleta', {
          seriesId: selectedSeries.id,
          series: fullSerieNumero,
          documentType,
        });
        break;

      case BizlinksDocumentType.NOTA_CREDITO:
        navigation.navigate('BizlinksEmitirNotaCredito', {
          seriesId: selectedSeries.id,
          series: fullSerieNumero,
          documentType,
        });
        break;

      case BizlinksDocumentType.NOTA_DEBITO:
        navigation.navigate('BizlinksEmitirNotaDebito', {
          seriesId: selectedSeries.id,
          series: fullSerieNumero,
          documentType,
        });
        break;

      case BizlinksDocumentType.GUIA_REMISION_REMITENTE:
        navigation.navigate('BizlinksEmitirGuiaRemision', {
          seriesId: selectedSeries.id,
          series: fullSerieNumero,
          documentType,
        });
        break;

      default:
        Alert.alert('Error', 'Tipo de documento no soportado');
    }
  };

  const documentTypeColor = DOCUMENT_TYPE_COLORS[documentType] || '#6366F1';

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={documentTypeColor} />
          <Text style={styles.loadingText}>Cargando series disponibles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>Seleccionar Serie</Text>
          <View
            style={[
              styles.documentTypeBadge,
              { backgroundColor: documentTypeColor + '20', borderColor: documentTypeColor },
            ]}
          >
            <Text style={[styles.documentTypeText, { color: documentTypeColor }]}>
              {DOCUMENT_TYPE_LABELS[documentType]}
            </Text>
          </View>
        </View>
      </View>

      {/* Series List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {series.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#CBD5E1" />
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No hay series disponibles
            </Text>
            <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
              Crea una nueva serie en Configuración
            </Text>
            <TouchableOpacity
              style={[styles.configButton, isTablet && styles.configButtonTablet]}
              onPress={() => navigation.navigate('DocumentSeries')}
            >
              <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
              <Text style={styles.configButtonText}>Ir a Configuración</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.instructionText, isTablet && styles.instructionTextTablet]}>
              Selecciona la serie que deseas utilizar para emitir el comprobante:
            </Text>

            {series.map((seriesItem) => (
              <TouchableOpacity
                key={seriesItem.id}
                style={[styles.seriesCard, isTablet && styles.seriesCardTablet]}
                onPress={() => handleSeriesSelect(seriesItem)}
                activeOpacity={0.7}
              >
                <View style={styles.seriesHeader}>
                  <View
                    style={[
                      styles.seriesIcon,
                      { backgroundColor: documentTypeColor + '20' },
                    ]}
                  >
                    <Text style={[styles.seriesIconText, { color: documentTypeColor }]}>
                      {seriesItem.series}
                    </Text>
                  </View>
                  <View style={styles.seriesInfo}>
                    <Text style={[styles.seriesName, isTablet && styles.seriesNameTablet]}>
                      Serie {seriesItem.series}
                    </Text>
                    <Text style={[styles.seriesDescription, isTablet && styles.seriesDescriptionTablet]}>
                      {seriesItem.description || 'Sin descripción'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#CBD5E1" />
                </View>

                <View style={styles.seriesStats}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                      Número Actual
                    </Text>
                    <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                      {seriesItem.currentNumber.toString().padStart(8, '0')}
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                      Disponibles
                    </Text>
                    <Text
                      style={[
                        styles.statValue,
                        styles.statValueAvailable,
                        isTablet && styles.statValueTablet,
                      ]}
                    >
                      {seriesItem.maxNumber - seriesItem.currentNumber}
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                      Máximo
                    </Text>
                    <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>
                      {seriesItem.maxNumber.toString().padStart(8, '0')}
                    </Text>
                  </View>
                </View>

                {(seriesItem.maxNumber - seriesItem.currentNumber) < 100 && (
                  <View style={styles.warningBanner}>
                    <Ionicons name="warning" size={16} color="#F59E0B" />
                    <Text style={styles.warningText}>
                      Quedan pocos números disponibles ({seriesItem.maxNumber - seriesItem.currentNumber})
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  headerTablet: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 24,
  },
  documentTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  documentTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  instructionText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
    lineHeight: 20,
  },
  instructionTextTablet: {
    fontSize: 16,
    lineHeight: 24,
  },
  seriesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  seriesCardTablet: {
    padding: 24,
    borderRadius: 20,
  },
  seriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  seriesIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seriesIconText: {
    fontSize: 18,
    fontWeight: '700',
  },
  seriesInfo: {
    flex: 1,
  },
  seriesName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  seriesNameTablet: {
    fontSize: 18,
  },
  seriesDescription: {
    fontSize: 13,
    color: '#64748B',
  },
  seriesDescriptionTablet: {
    fontSize: 14,
  },
  seriesStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabelTablet: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  statValueTablet: {
    fontSize: 18,
  },
  statValueAvailable: {
    color: '#10B981',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyTextTablet: {
    fontSize: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 24,
  },
  emptySubtextTablet: {
    fontSize: 16,
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  configButtonTablet: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  configButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
