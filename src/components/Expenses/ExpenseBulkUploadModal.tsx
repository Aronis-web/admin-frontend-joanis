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
import { colors, spacing, borderRadius } from '@/design-system/tokens';

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
              <Ionicons name="close" size={24} color={colors.neutral[500]} />
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
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color={colors.neutral[0]} />
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
                <Ionicons name="document-outline" size={20} color={colors.accent[500]} />
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
                    <ActivityIndicator size="small" color={colors.neutral[0]} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={20} color={colors.neutral[0]} />
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
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  modalContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  closeButton: {
    padding: spacing[1],
  },
  content: {
    padding: spacing[5],
    gap: spacing[6],
  },
  step: {
    gap: spacing[3],
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  stepDescription: {
    fontSize: 14,
    color: colors.neutral[500],
    marginLeft: 44,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.success[500],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.lg,
    marginLeft: 44,
    marginTop: spacing[2],
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  selectFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    marginLeft: 44,
    marginTop: spacing[2],
  },
  selectFileButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.neutral[600],
    flex: 1,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.accent[500],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.lg,
    marginLeft: 44,
    marginTop: spacing[2],
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  footer: {
    padding: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  cancelButton: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
  },
});
