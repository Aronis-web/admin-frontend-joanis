import React, { useState } from 'react';
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
import { API_BASE_URL } from '@/config/api';
import { useAuthStore } from '@/store/auth';

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
  const { token } = useAuthStore();
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null);
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

      console.log('📤 Subiendo archivo:', selectedFile.name);
      console.log('📋 Tipo de reporte:', selectedReportType);

      const response = await fetch(`${API_BASE_URL}/cash-reconciliation/analyze-structure`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Éxito',
          'Archivo analizado correctamente. Revisa la consola del servidor para ver los detalles.',
          [
            {
              text: 'OK',
              onPress: () => {
                setSelectedFile(null);
                setSelectedReportType(null);
              },
            },
          ]
        );
        console.log('✅ Respuesta del servidor:', data);
      } else {
        throw new Error(data.message || 'Error al analizar el archivo');
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Seleccionar Archivo Excel</Text>
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
          <Text style={styles.sectionTitle}>3. Subir y Analizar</Text>
          <TouchableOpacity
            style={[
              styles.uploadButton,
              (!selectedFile || !selectedReportType || isUploading) &&
                styles.uploadButtonDisabled,
            ]}
            onPress={handleUpload}
            disabled={!selectedFile || !selectedReportType || isUploading}
            activeOpacity={0.7}
          >
            {isUploading ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.uploadButtonText}>Analizando...</Text>
              </>
            ) : (
              <>
                <Text style={styles.uploadButtonIcon}>📤</Text>
                <Text style={styles.uploadButtonText}>Subir y Analizar Archivo</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>ℹ️ Información</Text>
          <Text style={styles.infoText}>
            • El archivo debe estar en formato Excel (.xlsx){'\n'}
            • El análisis mostrará la estructura del archivo en la consola del servidor{'\n'}
            • Se detectarán automáticamente las columnas y tipos de datos{'\n'}
            • Revisa la consola del servidor para ver los resultados del análisis
          </Text>
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
});
