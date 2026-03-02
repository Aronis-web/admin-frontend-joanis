import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';
import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';
import { sitesApi } from '@/services/api/sites';
import { Site } from '@/types/sites';
import { MAIN_ROUTES } from '@/constants/routes';

type Props = NativeStackScreenProps<any, 'UploadCashReconciliationFiles'>;

type ReportType = 'ventas' | 'izipay' | 'prosegur';

interface ReportTypeOption {
  id: ReportType;
  label: string;
  description: string;
  color: string;
  icon: string;
}

export const UploadCashReconciliationFilesScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { token, currentCompany } = useAuthStore();
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null);
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [sedes, setSedes] = useState<Site[]>([]);
  const [isLoadingSedes, setIsLoadingSedes] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const reportTypes: ReportTypeOption[] = [
    {
      id: 'ventas',
      label: 'Ventas',
      description: 'Reporte de ventas del sistema',
      color: '#10B981',
      icon: '💰',
    },
    {
      id: 'izipay',
      label: 'Izipay',
      description: 'Reporte de transacciones Izipay',
      color: '#3B82F6',
      icon: '💳',
    },
    {
      id: 'prosegur',
      label: 'Prosegur',
      description: 'Reporte de recaudación Prosegur',
      color: '#F59E0B',
      icon: '🏦',
    },
  ];

  // Cargar sedes cuando se selecciona "ventas"
  useEffect(() => {
    if (selectedReportType === 'ventas' && currentCompany) {
      loadSedes();
    } else {
      setSedes([]);
      setSelectedSede('');
    }
  }, [selectedReportType, currentCompany]);

  const loadSedes = async () => {
    if (!currentCompany) {
      console.warn('⚠️ No hay empresa seleccionada');
      return;
    }

    setIsLoadingSedes(true);
    try {
      console.log('📍 Cargando sedes para empresa:', currentCompany.id);
      const response = await sitesApi.getSites({
        companyId: currentCompany.id,
        isActive: true,
        limit: 100,
      });
      setSedes(response.data);
      console.log('✅ Sedes cargadas:', response.data.length);
    } catch (error) {
      console.error('❌ Error al cargar sedes:', error);
      Alert.alert('Error', 'No se pudieron cargar las sedes');
    } finally {
      setIsLoadingSedes(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile(file);
        console.log('📄 Archivo seleccionado:', file.name);
      }
    } catch (error) {
      console.error('❌ Error al seleccionar archivo:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Por favor selecciona un archivo');
      return;
    }

    if (!selectedReportType) {
      Alert.alert('Error', 'Por favor selecciona el tipo de reporte');
      return;
    }

    // Validar sede solo para tipo "ventas"
    if (selectedReportType === 'ventas' && !selectedSede) {
      Alert.alert('Error', 'Por favor selecciona una sede');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();

      // Agregar el archivo
      formData.append('file', {
        uri: selectedFile.uri,
        type: selectedFile.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        name: selectedFile.name,
      } as any);

      // Agregar el tipo de reporte
      formData.append('tipo_reporte', selectedReportType);

      // CASO 1: VENTAS - Requiere sede_id
      if (selectedReportType === 'ventas') {
        formData.append('sede_id', selectedSede);
        console.log('📤 [VENTAS] Subiendo archivo:', selectedFile.name);
        console.log('🏢 [VENTAS] Sede seleccionada:', selectedSede);
      }
      // CASO 2: IZIPAY - NO requiere sede_id (se detecta automáticamente)
      else if (selectedReportType === 'izipay') {
        console.log('📤 [IZIPAY] Subiendo archivo:', selectedFile.name);
        console.log('💳 [IZIPAY] Las sedes se detectarán automáticamente por código de comercio');
      }
      // CASO 3: PROSEGUR - NO requiere sede_id (pendiente de implementación)
      else if (selectedReportType === 'prosegur') {
        console.log('📤 [PROSEGUR] Subiendo archivo:', selectedFile.name);
        console.log('🏦 [PROSEGUR] Procesamiento pendiente de implementación');
      }

      const response = await fetch(`${config.API_URL}/cash-reconciliation/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-App-Id': config.APP_ID,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        const data = result.data || result;

        // Construir mensaje según el tipo de reporte
        let message = '✅ Archivo procesado exitosamente\n\n';

        if (selectedReportType === 'ventas') {
          message += `📊 Total de registros: ${data.total_registros || 0}\n` +
            `✨ Registros nuevos: ${data.registros_nuevos || 0}\n` +
            `🔄 Registros duplicados: ${data.registros_duplicados || 0}\n` +
            `❌ Registros con error: ${data.registros_con_error || 0}`;
        } else if (selectedReportType === 'izipay') {
          message += `📊 Total de transacciones: ${data.total_registros || 0}\n` +
            `✨ Transacciones nuevas: ${data.registros_nuevos || 0}\n` +
            `🔄 Transacciones duplicadas: ${data.registros_duplicados || 0}\n` +
            `❌ Transacciones con error: ${data.registros_con_error || 0}\n\n`;

          if (data.sedes_procesadas && data.sedes_procesadas.length > 0) {
            message += `🏢 Sedes procesadas:\n${data.sedes_procesadas.map((s: string) => `  • ${s}`).join('\n')}`;
          }
        } else if (selectedReportType === 'prosegur') {
          message += `📊 Total de registros: ${data.total_registros || 0}\n` +
            `✨ Registros nuevos: ${data.registros_nuevos || 0}\n` +
            `🔄 Registros duplicados: ${data.registros_duplicados || 0}\n` +
            `❌ Registros con error: ${data.registros_con_error || 0}`;
        }

        Alert.alert(
          'Éxito',
          message,
          [
            {
              text: 'OK',
              onPress: () => {
                setSelectedFile(null);
                setSelectedReportType(null);
                setSelectedSede('');
              },
            },
          ]
        );
        console.log('✅ Respuesta del servidor:', result);
      } else {
        throw new Error(result.message || 'Error al procesar el archivo');
      }
    } catch (error: any) {
      console.error('❌ Error al subir archivo:', error);
      Alert.alert('Error', error.message || 'No se pudo subir el archivo');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subir Archivos</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Seleccionar Tipo de Reporte</Text>
          <View style={styles.reportTypesContainer}>
            {reportTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.reportTypeCard,
                  selectedReportType === type.id && styles.reportTypeCardSelected,
                  { borderColor: type.color },
                ]}
                onPress={() => setSelectedReportType(type.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.reportTypeIcon, { backgroundColor: type.color }]}>
                  <Text style={styles.reportTypeEmoji}>{type.icon}</Text>
                </View>
                <View style={styles.reportTypeContent}>
                  <Text style={styles.reportTypeLabel}>{type.label}</Text>
                  <Text style={styles.reportTypeDescription}>{type.description}</Text>
                </View>
                {selectedReportType === type.id && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Selector de Sede - Solo para Ventas */}
        {selectedReportType === 'ventas' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Seleccionar Sede</Text>
            {isLoadingSedes ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#10B981" size="small" />
                <Text style={styles.loadingText}>Cargando sedes...</Text>
              </View>
            ) : sedes.length > 0 ? (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedSede}
                  onValueChange={(value) => setSelectedSede(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Selecciona una sede" value="" />
                  {sedes.map((sede) => (
                    <Picker.Item
                      key={sede.id}
                      label={`${sede.name} (${sede.code})`}
                      value={sede.id}
                    />
                  ))}
                </Picker>
              </View>
            ) : (
              <View style={styles.noSedesContainer}>
                <Text style={styles.noSedesText}>
                  ⚠️ No hay sedes disponibles para esta empresa
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedReportType === 'ventas' ? '3. Seleccionar Archivo Excel' : '2. Seleccionar Archivo Excel'}
          </Text>
          <TouchableOpacity
            style={styles.selectFileButton}
            onPress={handleSelectFile}
            activeOpacity={0.7}
          >
            <Text style={styles.selectFileIcon}>📁</Text>
            <Text style={styles.selectFileText}>
              {selectedFile ? selectedFile.name : 'Seleccionar archivo .xlsx'}
            </Text>
          </TouchableOpacity>

          {selectedFile && (
            <View style={styles.fileInfo}>
              <Text style={styles.fileInfoLabel}>Archivo seleccionado:</Text>
              <Text style={styles.fileInfoValue}>{selectedFile.name}</Text>
              <Text style={styles.fileInfoSize}>
                {(selectedFile.size! / 1024).toFixed(2)} KB
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedReportType === 'ventas' ? '4. Subir y Procesar' : '3. Subir y Procesar'}
          </Text>
          <TouchableOpacity
            style={[
              styles.uploadButton,
              (!selectedFile ||
               !selectedReportType ||
               (selectedReportType === 'ventas' && !selectedSede) ||
               isUploading) &&
                styles.uploadButtonDisabled,
            ]}
            onPress={handleUpload}
            disabled={
              !selectedFile ||
              !selectedReportType ||
              (selectedReportType === 'ventas' && !selectedSede) ||
              isUploading
            }
            activeOpacity={0.7}
          >
            {isUploading ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.uploadButtonText}>Procesando...</Text>
              </>
            ) : (
              <>
                <Text style={styles.uploadButtonIcon}>📤</Text>
                <Text style={styles.uploadButtonText}>Subir y Procesar Archivo</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>ℹ️ Información</Text>
          {selectedReportType === 'ventas' && (
            <Text style={styles.infoText}>
              📊 VENTAS{'\n'}
              • Debes seleccionar una sede específica{'\n'}
              • El archivo debe contener el reporte de ventas del sistema{'\n'}
              • Se validarán campos: ID, Serie, Correlativo, Fecha, Total, Método de pago{'\n'}
              • Se excluyen automáticamente: Notas de Crédito y ventas anuladas{'\n'}
              • El sistema detectará duplicados por: sede + sale_id + fuente + fecha
            </Text>
          )}
          {selectedReportType === 'izipay' && (
            <Text style={styles.infoText}>
              💳 IZIPAY{'\n'}
              • NO requiere seleccionar sede (se detecta automáticamente){'\n'}
              • El archivo debe ser CSV dentro de Excel con delimitador ";" (punto y coma){'\n'}
              • Las sedes se asignan según el código de comercio{'\n'}
              • Solo se procesan transacciones tipo "COMPRA" con importe mayor a 0{'\n'}
              • Se excluyen: Comisiones, devoluciones y ajustes
            </Text>
          )}
          {selectedReportType === 'prosegur' && (
            <Text style={styles.infoText}>
              🏦 PROSEGUR{'\n'}
              • Funcionalidad en desarrollo{'\n'}
              • El archivo debe contener el reporte de recaudación Prosegur{'\n'}
              • Próximamente disponible
            </Text>
          )}
          {!selectedReportType && (
            <Text style={styles.infoText}>
              • Selecciona un tipo de reporte para ver información específica{'\n'}
              • El archivo debe estar en formato Excel (.xlsx){'\n'}
              • El sistema detectará automáticamente duplicados{'\n'}
              • Se validarán los datos antes de insertarlos en la base de datos{'\n'}
              • Recibirás un resumen del procesamiento al finalizar
            </Text>
          )}
        </View>

        {/* Botón para ver archivos subidos */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.viewFilesButton}
            onPress={() => navigation.navigate(MAIN_ROUTES.UPLOADED_FILES_LIST as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewFilesButtonIcon}>📋</Text>
            <Text style={styles.viewFilesButtonText}>Ver Archivos Subidos</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  reportTypesContainer: {
    gap: 12,
  },
  reportTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  reportTypeCardSelected: {
    backgroundColor: '#F0FDF4',
  },
  reportTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reportTypeEmoji: {
    fontSize: 24,
  },
  reportTypeContent: {
    flex: 1,
  },
  reportTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  reportTypeDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  selectFileIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  selectFileText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  fileInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  fileInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 4,
  },
  fileInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  fileInfoSize: {
    fontSize: 12,
    color: '#6B7280',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  uploadButtonIcon: {
    fontSize: 20,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoSection: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 20,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  noSedesContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noSedesText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
  },
  viewFilesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  viewFilesButtonIcon: {
    fontSize: 20,
  },
  viewFilesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
