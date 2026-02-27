import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { expensesService } from '@/services/api/expenses';
import { useAuthStore } from '@/store/auth';

interface ExpenseBulkUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ExpenseBulkUploadModal: React.FC<ExpenseBulkUploadModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { currentCompany } = useAuthStore();
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const handleDownloadFormat = async () => {
    try {
      setDownloading(true);

      if (!currentCompany?.id) {
        Alert.alert('Error', 'No hay una empresa seleccionada');
        return;
      }

      console.log('📥 Descargando formato de carga masiva...');

      // Download the format file
      const blob = await expensesService.downloadBulkUploadFormat(currentCompany.id);

      // Create a download link (works on web and mobile browsers)
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `formato_gastos_${new Date().getTime()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      Alert.alert('Éxito', 'Formato descargado correctamente');
    } catch (error: any) {
      console.error('❌ Error descargando formato:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'No se pudo descargar el formato'
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      if (result.assets && result.assets.length > 0) {
        setSelectedFile(result.assets[0]);
        console.log('📄 Archivo seleccionado:', result.assets[0].name);
      }
    } catch (error) {
      console.error('❌ Error seleccionando archivo:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const handleUpload = async () => {
    try {
      if (!selectedFile) {
        Alert.alert('Error', 'Por favor selecciona un archivo');
        return;
      }

      if (!currentCompany?.id) {
        Alert.alert('Error', 'No hay una empresa seleccionada');
        return;
      }

      setUploading(true);
      console.log('📤 Subiendo archivo:', selectedFile.name);

      // Fetch the file and convert to blob
      const response = await fetch(selectedFile.uri);
      const blob = await response.blob();
      const result = await expensesService.uploadBulkExpenses(blob, currentCompany.id);

      Alert.alert(
        'Éxito',
        result.message || 'Gastos cargados correctamente',
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedFile(null);
              onSuccess?.();
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Error subiendo archivo:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'No se pudo cargar el archivo'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Carga Masiva de Gastos</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Step 1: Download Format */}
            <View style={styles.step}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepTitle}>Descargar Formato</Text>
              </View>
              <Text style={styles.stepDescription}>
                Descarga la plantilla de Excel con el formato requerido
              </Text>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={handleDownloadFormat}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.downloadButtonText}>Descargar Formato</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Step 2: Fill Format */}
            <View style={styles.step}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepTitle}>Llenar Formato</Text>
              </View>
              <Text style={styles.stepDescription}>
                Completa el archivo Excel con los datos de los gastos
              </Text>
            </View>

            {/* Step 3: Upload File */}
            <View style={styles.step}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepTitle}>Cargar Archivo</Text>
              </View>
              <Text style={styles.stepDescription}>
                Selecciona y sube el archivo Excel completado
              </Text>

              {/* File Selection */}
              <TouchableOpacity
                style={styles.selectFileButton}
                onPress={handleSelectFile}
                disabled={uploading}
              >
                <Ionicons name="document-outline" size={20} color="#6366F1" />
                <Text style={styles.selectFileButtonText}>
                  {selectedFile ? selectedFile.name : 'Seleccionar Archivo'}
                </Text>
              </TouchableOpacity>

              {/* Upload Button */}
              {selectedFile && (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.uploadButtonText}>Subir Archivo</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
    gap: 24,
  },
  step: {
    gap: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  stepDescription: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 44,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 44,
    marginTop: 8,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginLeft: 44,
    marginTop: 8,
  },
  selectFileButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    flex: 1,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 44,
    marginTop: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
});
