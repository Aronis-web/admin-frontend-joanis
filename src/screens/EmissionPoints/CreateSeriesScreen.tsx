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
import { useAuthStore } from '@/store/auth';
import { emissionPointsApi, DocumentType, CreateSeriesDto } from '@/services/api/emission-points';
import logger from '@/utils/logger';

interface CreateSeriesScreenProps {
  navigation: any;
  route: {
    params: {
      emissionPointId: string;
      emissionPointName: string;
      emissionPointCode: string;
    };
  };
}

export const CreateSeriesScreen: React.FC<CreateSeriesScreenProps> = ({
  navigation,
  route,
}) => {
  const { emissionPointId, emissionPointName, emissionPointCode } = route.params;
  const { currentSite, currentCompany } = useAuthStore();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [loading, setLoading] = useState(false);
  const [loadingDocumentTypes, setLoadingDocumentTypes] = useState(true);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);

  // Form state
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [series, setSeries] = useState('');
  const [description, setDescription] = useState('');
  const [startNumber, setStartNumber] = useState('1');
  const [maxNumber, setMaxNumber] = useState('99999999');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadDocumentTypes();
  }, []);

  const loadDocumentTypes = async () => {
    try {
      setLoadingDocumentTypes(true);
      const types = await emissionPointsApi.getDocumentTypes({ isActive: true });
      setDocumentTypes(types);
    } catch (error: any) {
      logger.error('Error cargando tipos de documento:', error);
      Alert.alert('Error', 'No se pudieron cargar los tipos de documento');
    } finally {
      setLoadingDocumentTypes(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentSite?.id || !currentCompany?.id) {
      Alert.alert('Error', 'No hay sede o empresa seleccionada');
      return;
    }

    // Validations
    if (!documentTypeId) {
      Alert.alert('Error', 'Selecciona un tipo de documento');
      return;
    }

    if (!series.trim()) {
      Alert.alert('Error', 'Ingresa la serie');
      return;
    }

    const startNum = parseInt(startNumber);
    const maxNum = parseInt(maxNumber);

    if (isNaN(startNum) || startNum < 1) {
      Alert.alert('Error', 'El número inicial debe ser mayor a 0');
      return;
    }

    if (isNaN(maxNum) || maxNum < startNum) {
      Alert.alert('Error', 'El número máximo debe ser mayor o igual al número inicial');
      return;
    }

    try {
      setLoading(true);

      const data: CreateSeriesDto = {
        companyId: currentCompany.id,
        siteId: currentSite.id,
        documentTypeId,
        emissionPointId,
        series: series.trim().toUpperCase(),
        description: description.trim() || undefined,
        startNumber: startNum,
        maxNumber: maxNum,
        isDefault,
        isActive,
      };

      await emissionPointsApi.createSeries(data);

      Alert.alert('Éxito', 'Serie creada exitosamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      logger.error('Error creando serie:', error);
      Alert.alert('Error', error.message || 'No se pudo crear la serie');
    } finally {
      setLoading(false);
    }
  };

  if (loadingDocumentTypes) {
    return (
      <ScreenLayout navigation={navigation}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Cargando...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Nueva Serie
            </Text>
            <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
              {emissionPointCode} - {emissionPointName}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.form, isTablet && styles.formTablet]}>
            {/* Document Type Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Tipo de Documento <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.documentTypesList}>
                {documentTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.documentTypeCard,
                      documentTypeId === type.id && styles.documentTypeCardSelected,
                    ]}
                    onPress={() => setDocumentTypeId(type.id)}
                  >
                    <Text
                      style={[
                        styles.documentTypeText,
                        documentTypeId === type.id && styles.documentTypeTextSelected,
                      ]}
                    >
                      {type.name}
                    </Text>
                    <Text
                      style={[
                        styles.documentTypeCode,
                        documentTypeId === type.id && styles.documentTypeCodeSelected,
                      ]}
                    >
                      {type.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
                <Text style={styles.label}>
                  Número Inicial <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={startNumber}
                  onChangeText={setStartNumber}
                  placeholder="1"
                  keyboardType="numeric"
                />
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
                  <Text style={styles.submitButtonText}>Crear Serie</Text>
                )}
              </TouchableOpacity>
            </View>
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
  documentTypesList: {
    gap: 8,
  },
  documentTypeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  documentTypeCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  documentTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  documentTypeTextSelected: {
    color: '#6366F1',
  },
  documentTypeCode: {
    fontSize: 14,
    color: '#6B7280',
  },
  documentTypeCodeSelected: {
    color: '#6366F1',
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
});
