import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { emissionPointsApi, DocumentSeries, UpdateSeriesDto } from '@/services/api/emission-points';
import logger from '@/utils/logger';

interface EditSeriesScreenProps {
  navigation: any;
  route: {
    params: {
      seriesId: string;
      emissionPointId: string;
      emissionPointName: string;
      emissionPointCode: string;
    };
  };
}

export const EditSeriesScreen: React.FC<EditSeriesScreenProps> = ({
  navigation,
  route,
}) => {
  const { seriesId, emissionPointName, emissionPointCode } = route.params;
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [loading, setLoading] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [seriesData, setSeriesData] = useState<DocumentSeries | null>(null);

  // Form state
  const [series, setSeries] = useState('');
  const [description, setDescription] = useState('');
  const [maxNumber, setMaxNumber] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    try {
      setLoadingSeries(true);
      const data = await emissionPointsApi.getSeriesById(seriesId);
      setSeriesData(data);

      // Populate form
      setSeries(data.series);
      setDescription(data.description || '');
      setMaxNumber(data.maxNumber.toString());
      setIsDefault(data.isDefault);
      setIsActive(data.isActive);
    } catch (error: any) {
      logger.error('Error cargando serie:', error);
      Alert.alert('Error', 'No se pudo cargar la serie', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } finally {
      setLoadingSeries(false);
    }
  };

  const handleSubmit = async () => {
    if (!seriesData) return;

    // Validations
    if (!series.trim()) {
      Alert.alert('Error', 'Ingresa la serie');
      return;
    }

    const maxNum = parseInt(maxNumber);

    if (isNaN(maxNum) || maxNum < seriesData.currentNumber) {
      Alert.alert(
        'Error',
        `El número máximo debe ser mayor o igual al número actual (${seriesData.currentNumber})`
      );
      return;
    }

    try {
      setLoading(true);

      const data: UpdateSeriesDto = {
        series: series.trim().toUpperCase(),
        description: description.trim() || undefined,
        maxNumber: maxNum,
        isDefault,
        isActive,
      };

      await emissionPointsApi.updateSeries(seriesId, data);

      Alert.alert('Éxito', 'Serie actualizada exitosamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      logger.error('Error actualizando serie:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar la serie');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar Serie',
      '¿Estás seguro de que deseas eliminar esta serie? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await emissionPointsApi.deleteSeries(seriesId);
              Alert.alert('Éxito', 'Serie eliminada exitosamente', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error: any) {
              logger.error('Error eliminando serie:', error);
              Alert.alert('Error', error.message || 'No se pudo eliminar la serie');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loadingSeries) {
    return (
      <ScreenLayout navigation={navigation}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Cargando serie...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  if (!seriesData) {
    return null;
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Editar Serie
            </Text>
            <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
              {emissionPointCode} - {emissionPointName}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.form, isTablet && styles.formTablet]}>
            {/* Document Type (Read-only) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Tipo de Documento</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>
                  {seriesData.documentType?.name || 'N/A'}
                </Text>
                <Text style={styles.readOnlySubtext}>
                  {seriesData.documentType?.code || ''}
                </Text>
              </View>
            </View>

            {/* Current Number (Read-only) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Número Actual</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>
                  {seriesData.series}-{seriesData.currentNumber.toString().padStart(8, '0')}
                </Text>
              </View>
              <Text style={styles.hint}>
                Este número se incrementa automáticamente con cada documento emitido
              </Text>
            </View>

            {/* Series */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Serie <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={series}
                onChangeText={setSeries}
                placeholder="Ej: F001, B001"
                autoCapitalize="characters"
                maxLength={10}
              />
              <Text style={styles.hint}>La serie se convertirá a mayúsculas automáticamente</Text>
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Descripción (Opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Descripción de la serie"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Number Range */}
            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Número Inicial</Text>
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>{seriesData.startNumber}</Text>
                </View>
                <Text style={styles.hint}>No se puede modificar</Text>
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>
                  Número Máximo <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={maxNumber}
                  onChangeText={setMaxNumber}
                  placeholder="99999999"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Switches */}
            <View style={styles.formGroup}>
              <TouchableOpacity
                style={styles.switchRow}
                onPress={() => setIsDefault(!isDefault)}
              >
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Serie por defecto</Text>
                  <Text style={styles.switchHint}>
                    Se usará automáticamente si no se especifica otra serie
                  </Text>
                </View>
                <View style={[styles.switch, isDefault && styles.switchActive]}>
                  <View style={[styles.switchThumb, isDefault && styles.switchThumbActive]} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <TouchableOpacity
                style={styles.switchRow}
                onPress={() => setIsActive(!isActive)}
              >
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Serie activa</Text>
                  <Text style={styles.switchHint}>
                    Solo las series activas pueden usarse para emitir documentos
                  </Text>
                </View>
                <View style={[styles.switch, isActive && styles.switchActive]}>
                  <View style={[styles.switchThumb, isActive && styles.switchThumbActive]} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => navigation.goBack()}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.submitButton]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Guardar Cambios</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Delete Button */}
            <TouchableOpacity
              style={[styles.deleteButton]}
              onPress={handleDelete}
              disabled={loading}
            >
              <Text style={styles.deleteButtonText}>🗑️ Eliminar Serie</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTablet: {
    padding: 24,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerTitleTablet: {
    fontSize: 32,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  headerSubtitleTablet: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTablet: {
    padding: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  readOnlyField: {
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  readOnlyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  readOnlySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  switchInfo: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  switchHint: {
    fontSize: 12,
    color: '#6B7280',
  },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1D5DB',
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: '#6366F1',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#6366F1',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
});
