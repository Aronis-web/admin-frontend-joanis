import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDocumentAsync, DocumentPickerAsset } from '@/utils/filePicker';
import { usersApi, BulkUsersResult, BulkUserRowResult } from '@/services/api';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { saveAndShareExcel } from '@/utils/fileDownload';
import Alert from '@/utils/alert';
import logger from '@/utils/logger';

export type UsersBulkMode = 'create' | 'update';

interface UsersBulkModalProps {
  visible: boolean;
  mode: UsersBulkMode;
  onClose: () => void;
  onSuccess?: () => void;
}

const XLSX_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

const COPY: Record<
  UsersBulkMode,
  {
    title: string;
    description: string;
    downloadLabel: string;
    uploadLabel: string;
    successMessage: string;
    templateFilename: string;
  }
> = {
  create: {
    title: 'Creación Masiva de Usuarios',
    description:
      'Descarga la plantilla, complétala con los datos de los nuevos usuarios (incluye contraseña de correo corporativo) y súbela.',
    downloadLabel: 'Descargar plantilla de creación',
    uploadLabel: 'Subir plantilla y crear usuarios',
    successMessage: 'Usuarios creados en lote',
    templateFilename: 'plantilla_creacion_usuarios',
  },
  update: {
    title: 'Actualización Masiva de Usuarios',
    description:
      'Descarga la plantilla precargada con los usuarios existentes, edítala y súbela. La actualización se hace por id.',
    downloadLabel: 'Descargar plantilla de edición',
    uploadLabel: 'Subir plantilla y actualizar usuarios',
    successMessage: 'Usuarios actualizados en lote',
    templateFilename: 'plantilla_edicion_usuarios',
  },
};

export const UsersBulkModal: React.FC<UsersBulkModalProps> = ({
  visible,
  mode,
  onClose,
  onSuccess,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPickerAsset | null>(null);
  const [result, setResult] = useState<BulkUsersResult | null>(null);

  const copy = COPY[mode];

  const resetState = () => {
    setSelectedFile(null);
    setResult(null);
  };

  const handleClose = () => {
    if (downloading || uploading) return;
    resetState();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      setDownloading(true);
      const blob =
        mode === 'create'
          ? await usersApi.downloadBulkCreateTemplate()
          : await usersApi.downloadBulkUpdateTemplate();

      const filename = `${copy.templateFilename}_${Date.now()}.xlsx`;
      await saveAndShareExcel(blob, filename, copy.downloadLabel);
    } catch (error: any) {
      logger.error('Error descargando plantilla de usuarios:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || error?.message || 'No se pudo descargar la plantilla'
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      const picked = await getDocumentAsync({
        type: XLSX_MIME_TYPES,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.length) return;
      setSelectedFile(picked.assets[0]);
      setResult(null);
    } catch (error) {
      logger.error('Error seleccionando archivo:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const buildFileForUpload = async (asset: DocumentPickerAsset): Promise<Blob | File> => {
    const isWeb = typeof document !== 'undefined';
    if (isWeb && (asset as any).file) {
      return (asset as any).file as File;
    }
    const response = await fetch(asset.uri);
    return response.blob();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Selecciona un archivo xlsx');
      return;
    }
    try {
      setUploading(true);
      const file = await buildFileForUpload(selectedFile);
      const response =
        mode === 'create'
          ? await usersApi.bulkCreateUsers(file)
          : await usersApi.bulkUpdateUsers(file);

      setResult(response);
      if (response.failed === 0) {
        Alert.alert(
          copy.successMessage,
          `Total: ${response.total} · OK: ${response.ok} · Fallidos: ${response.failed}`
        );
      }
      onSuccess?.();
    } catch (error: any) {
      logger.error('Error subiendo archivo de usuarios:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || error?.message || 'No se pudo procesar el archivo'
      );
    } finally {
      setUploading(false);
    }
  };

  const renderRowResult = (row: BulkUserRowResult, index: number) => {
    const isOk = row.status === 'ok';
    const mailboxColor =
      row.mailbox === 'provisioned'
        ? theme.color.state.success.border
        : row.mailbox === 'failed'
          ? theme.color.state.danger.border
          : theme.color.text.muted;
    return (
      <View key={`${row.row}-${index}`} style={styles.resultRow}>
        <View style={styles.resultRowHeader}>
          <View
            style={[
              styles.resultBadge,
              {
                backgroundColor: isOk
                  ? theme.color.state.success.background
                  : theme.color.state.danger.background,
              },
            ]}
          >
            <Text
              style={[
                styles.resultBadgeText,
                {
                  color: isOk ? theme.color.state.success.border : theme.color.state.danger.border,
                },
              ]}
            >
              Fila {row.row} · {isOk ? 'OK' : 'ERROR'}
            </Text>
          </View>
          {row.mailbox && (
            <Text style={[styles.mailboxTag, { color: mailboxColor }]}>buzón: {row.mailbox}</Text>
          )}
        </View>
        {(row.email || row.username) && (
          <Text style={styles.resultRowIdentity} numberOfLines={1}>
            {row.email || row.username}
          </Text>
        )}
        {!isOk && (row.error || row.message) && (
          <Text style={styles.resultRowError} numberOfLines={3}>
            {row.error || row.message}
          </Text>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{copy.title}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              disabled={downloading || uploading}
            >
              <Ionicons name="close" size={24} color={theme.color.icon.subtle} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.description}>{copy.description}</Text>

            {/* Step 1 - Download */}
            <View style={styles.step}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepTitle}>{copy.downloadLabel}</Text>
              </View>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={handleDownloadTemplate}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color={theme.color.text.inverse} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color={theme.color.text.inverse} />
                    <Text style={styles.downloadButtonText}>Descargar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Step 2 - Upload */}
            <View style={styles.step}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepTitle}>{copy.uploadLabel}</Text>
              </View>

              <TouchableOpacity
                style={styles.selectFileButton}
                onPress={handleSelectFile}
                disabled={uploading}
              >
                <Ionicons name="document-outline" size={20} color={theme.color.brand.accent} />
                <Text style={styles.selectFileButtonText} numberOfLines={1}>
                  {selectedFile ? selectedFile.name : 'Seleccionar archivo xlsx'}
                </Text>
              </TouchableOpacity>

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
                      <Ionicons
                        name="cloud-upload-outline"
                        size={20}
                        color={theme.color.text.inverse}
                      />
                      <Text style={styles.uploadButtonText}>
                        {mode === 'create' ? 'Crear usuarios' : 'Actualizar usuarios'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Results */}
            {result && (
              <View style={styles.resultContainer}>
                <Text style={styles.resultSummary}>
                  Total: <Text style={styles.resultBold}>{result.total}</Text> · OK:{' '}
                  <Text style={[styles.resultBold, { color: theme.color.state.success.border }]}>
                    {result.ok}
                  </Text>{' '}
                  · Fallidos:{' '}
                  <Text style={[styles.resultBold, { color: theme.color.state.danger.border }]}>
                    {result.failed}
                  </Text>
                </Text>
                {result.results?.map(renderRowResult)}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={downloading || uploading}
            >
              <Text style={styles.cancelButtonText}>Cerrar</Text>
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
      maxWidth: 560,
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
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      flex: 1,
      marginRight: theme.space[3],
    },
    closeButton: {
      padding: theme.space[1],
    },
    content: {
      padding: theme.space[5],
      gap: theme.space[5],
    },
    description: {
      fontSize: 14,
      color: theme.color.text.muted,
      lineHeight: 20,
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
      width: 28,
      height: 28,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.brand.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepNumberText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
    stepTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      flex: 1,
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
    },
    uploadButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    resultContainer: {
      gap: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      paddingTop: theme.space[4],
    },
    resultSummary: {
      fontSize: 14,
      color: theme.color.text.heading,
    },
    resultBold: {
      fontWeight: '700',
    },
    resultRow: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      gap: theme.space[1.5],
    },
    resultRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    resultBadge: {
      paddingHorizontal: theme.space[2],
      paddingVertical: 2,
      borderRadius: theme.radii.sm,
    },
    resultBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    mailboxTag: {
      fontSize: 12,
      fontWeight: '500',
    },
    resultRowIdentity: {
      fontSize: 13,
      color: theme.color.text.heading,
    },
    resultRowError: {
      fontSize: 12,
      color: theme.color.state.danger.border,
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

export default UsersBulkModal;
