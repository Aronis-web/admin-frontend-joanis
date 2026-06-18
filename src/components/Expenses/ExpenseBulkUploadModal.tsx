import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,

} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDocumentAsync, DocumentPickerAsset } from '@/utils/filePicker';
import { expensesService } from '@/services/api/expenses';
import { useAuthStore } from '@/store/auth';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { saveAndShareExcel } from '@/utils/fileDownload';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { currentCompany } = useAuthStore();
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPickerAsset | null>(null);

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

      const fileName = `formato_gastos_${new Date().getTime()}.xlsx`;

      await saveAndShareExcel(blob, fileName, 'Formato de Carga Masiva de Gastos');
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
      const result = await getDocumentAsync({
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

      let fileToUpload: Blob | File;

      const isWeb = typeof document !== 'undefined';

      if (isWeb) {
        console.log('📤 [Web] Preparing file upload...');
        if ((selectedFile as any).file) {
          // Use the preserved File object
          fileToUpload = (selectedFile as any).file;
          console.log('✅ Using File object');
        } else {
          // Fallback: fetch the blob from URI
          console.log('⚠️ No File object, fetching from URI...');
          const response = await fetch(selectedFile.uri);
          fileToUpload = await response.blob();
        }
      } else {
        // Mobile: Fetch the file and convert to blob
        const response = await fetch(selectedFile.uri);
        fileToUpload = await response.blob();
      }

      const result = await expensesService.uploadBulkExpenses(fileToUpload, currentCompany.id);

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
              <Ionicons name="close" size={24} color={theme.color.icon.subtle} />
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
                  <ActivityIndicator size="small" color={theme.color.text.inverse} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color={theme.color.text.inverse} />
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
                <Ionicons name="document-outline" size={20} color={theme.color.brand.accent} />
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
                    <ActivityIndicator size="small" color={theme.color.text.inverse} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={20} color={theme.color.text.inverse} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[5],
    },
    modalContainer: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      width: '100%',
      maxWidth: 500,
      maxHeight: '90%',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.default,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    closeButton: {
      padding: theme.space[1],
    },
    content: {
      padding: theme.space[5],
      gap: theme.space[6],
    },
    step: {
      gap: theme.space[3],
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    stepNumber: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.brand.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepNumberText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
    stepTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    stepDescription: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginLeft: 44,
    },
    downloadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
      backgroundColor: theme.color.action.success.background,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.lg,
      marginLeft: 44,
      marginTop: theme.space[2],
    },
    downloadButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    selectFileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      backgroundColor: theme.color.surface.muted,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      marginLeft: 44,
      marginTop: theme.space[2],
    },
    selectFileButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.color.text.muted,
      flex: 1,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
      backgroundColor: theme.color.brand.accent,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.lg,
      marginLeft: 44,
      marginTop: theme.space[2],
    },
    uploadButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    footer: {
      padding: theme.space[5],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
    },
    cancelButton: {
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.subtle,
    },
  });
