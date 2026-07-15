import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import {
  BalanceOperation,
  getOperationTypeLabel,
  getOperationTypeColor,
  getPaymentMethodLabel,
  formatCentsToCurrency,
} from '@/types/balances';
import { ImageViewerModal } from '@/components/Expenses/ImageViewerModal';
import { config } from '@/utils/config';
import { filesApi, BalanceOperationFile } from '@/services/api/files';
import { balancesApi } from '@/services/api';
import Alert from '@/utils/alert';

interface BalanceOperationDetailModalProps {
  visible: boolean;
  operation: BalanceOperation | null;
  onClose: () => void;
  onEdit?: (operation: BalanceOperation) => void;
  onDelete?: (operation: BalanceOperation) => void;
  onOperationUpdated?: () => void;
}

export const BalanceOperationDetailModal: React.FC<BalanceOperationDetailModalProps> = ({
  visible,
  operation,
  onClose,
  onEdit,
  onDelete,
  onOperationUpdated,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null); // Changed: use fileId instead of URL
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [files, setFiles] = useState<BalanceOperationFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Load files when modal opens
  useEffect(() => {
    if (visible && operation) {
      loadFiles();
    }
  }, [visible, operation?.id]);

  const loadFiles = async () => {
    if (!operation) {
      return;
    }

    console.log('📥 Loading files for operation:', operation.id);
    setLoadingFiles(true);

    try {
      const fetchedFiles = await filesApi.getBalanceOperationFiles(operation.id);
      console.log('✅ Files loaded:', fetchedFiles);
      // NOTE: No longer pre-fetching signed URLs - they will be generated on-demand when user clicks
      // This prevents signed URL expiration issues when user stays on screen for long periods
      setFiles(fetchedFiles || []);
    } catch (error) {
      console.error('❌ Error loading files:', error);
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  if (!operation) {
    return null;
  }

  console.log('📋 BalanceOperationDetailModal - Operation:', {
    id: operation.id,
    hasFiles: !!operation.files,
    filesCount: operation.files?.length || 0,
    files: operation.files,
    loadedFiles: files.length,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Changed: Now receives filePath (fileId) instead of pre-generated URL
  const handleViewImage = (filePath: string, fileName: string) => {
    console.log('🖼️ Opening image viewer with fileId:', filePath);
    setSelectedFileId(filePath); // Store fileId, not URL - ImageViewerModal will generate fresh signed URL
    setSelectedFileName(fileName);
    setImageViewerVisible(true);
  };

  // Changed: Generate fresh signed URL on-demand when downloading
  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      console.log('📥 Generating fresh signed URL for download:', filePath);
      // Generate fresh signed URL on-demand to avoid expiration issues
      const freshSignedUrl = await filesApi.getPrivateFileUrl(filePath);
      console.log('✅ Fresh signed URL generated for download');

      // For web, open in new tab
      if (Platform.OS === 'web') {
        window.open(freshSignedUrl, '_blank');
        return;
      }

      // For mobile, try to open with system handler
      const supported = await Linking.canOpenURL(freshSignedUrl);
      if (supported) {
        await Linking.openURL(freshSignedUrl);
      } else {
        Alert.alert('Error', 'No se puede abrir este tipo de archivo');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      Alert.alert('Error', 'No se pudo descargar el archivo');
    }
  };

  const isImageFile = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return '📷';
    }
    if (mimeType.includes('pdf')) {
      return '📄';
    }
    if (mimeType.includes('word') || mimeType.includes('document')) {
      return '📝';
    }
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return '📊';
    }
    return '📎';
  };

  const handleEdit = () => {
    if (operation && onEdit) {
      onEdit(operation);
      // Don't close here - let the parent handle the modal transitions
    }
  };

  const handleDelete = () => {
    if (!operation) {
      return;
    }

    Alert.alert(
      'Eliminar Operación',
      '¿Estás seguro de que deseas eliminar esta operación? Esta acción no se puede deshacer.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await balancesApi.deleteBalanceOperation(operation.balanceId, operation.id);
              Alert.alert('Éxito', 'Operación eliminada correctamente');
              if (onOperationUpdated) {
                onOperationUpdated();
              }
              onClose();
            } catch (error: any) {
              console.error('Error deleting operation:', error);
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo eliminar la operación'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle de Operación</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color={theme.color.icon.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Operation Type Badge */}
              <View style={styles.section}>
                <View
                  style={[
                    styles.operationTypeBadge,
                    { backgroundColor: getOperationTypeColor(operation.operationType) },
                  ]}
                >
                  <Text style={styles.operationTypeBadgeText}>
                    {getOperationTypeLabel(operation.operationType)}
                  </Text>
                </View>
              </View>

              {/* Amount */}
              <View style={styles.section}>
                <Text style={styles.amountLabel}>Monto</Text>
                <Text style={styles.amountValue}>
                  {formatCentsToCurrency(operation.amountCents, operation.currency)}
                </Text>
              </View>

              {/* Operation Date */}
              <View style={styles.section}>
                <Text style={styles.label}>Fecha de Operación</Text>
                <Text style={styles.value}>{formatDate(operation.operationDate)}</Text>
              </View>

              {/* Payment Method */}
              {operation.paymentMethod && (
                <View style={styles.section}>
                  <Text style={styles.label}>Método de Pago</Text>
                  <View style={styles.paymentMethodBadge}>
                    <Text style={styles.paymentMethodText}>
                      {getPaymentMethodLabel(operation.paymentMethod)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Balance Info */}
              <View style={styles.section}>
                <Text style={styles.label}>Balance</Text>
                <Text style={styles.value}>{operation.balance?.code || operation.balanceId}</Text>
                {operation.balance?.receiverCompany && (
                  <Text style={styles.subValue}>🏭 {operation.balance.receiverCompany.name}</Text>
                )}
                {operation.balance?.receiverSite && (
                  <Text style={styles.subValue}>🏢 {operation.balance.receiverSite.name}</Text>
                )}
              </View>

              {/* Emitter Info */}
              {(operation.emitterCompany || operation.emitterSite) && (
                <View style={styles.section}>
                  <Text style={styles.label}>Emisor</Text>
                  {operation.emitterCompany && (
                    <Text style={styles.value}>🏭 {operation.emitterCompany.name}</Text>
                  )}
                  {operation.emitterSite && (
                    <Text style={styles.value}>🏢 {operation.emitterSite.name}</Text>
                  )}
                </View>
              )}

              {/* Description */}
              {operation.description && (
                <View style={styles.section}>
                  <Text style={styles.label}>Descripción</Text>
                  <Text style={styles.value}>{operation.description}</Text>
                </View>
              )}

              {/* Reference */}
              {operation.reference && (
                <View style={styles.section}>
                  <Text style={styles.label}>Referencia</Text>
                  <Text style={styles.value}>{operation.reference}</Text>
                </View>
              )}

              {/* Notes */}
              {operation.notes && (
                <View style={styles.section}>
                  <Text style={styles.label}>Notas</Text>
                  <Text style={styles.value}>{operation.notes}</Text>
                </View>
              )}

              {/* Files */}
              {loadingFiles ? (
                <View style={styles.section}>
                  <Text style={styles.label}>Archivos Adjuntos</Text>
                  <View style={styles.loadingFilesContainer}>
                    <ActivityIndicator size="small" color={theme.color.brand.primary} />
                    <Text style={styles.loadingFilesText}>Cargando archivos...</Text>
                  </View>
                </View>
              ) : files.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.label}>Archivos Adjuntos ({files.length})</Text>
                  <View style={styles.filesContainer}>
                    {files.map((file) => {
                      const isImage = isImageFile(file.mimeType);

                      console.log('📎 Rendering file:', {
                        fileName: file.originalName,
                        mimeType: file.mimeType,
                        isImage,
                        filePath: file.filePath, // Using filePath for on-demand signed URL generation
                      });

                      return (
                        <TouchableOpacity
                          key={file.id}
                          style={styles.fileCard}
                          onPress={() => {
                            // Pass filePath instead of pre-generated URL
                            // Signed URL will be generated on-demand to avoid expiration issues
                            if (isImage) {
                              handleViewImage(file.filePath, file.originalName);
                            } else {
                              handleDownloadFile(file.filePath, file.originalName);
                            }
                          }}
                        >
                          <View style={styles.fileIconContainer}>
                            <Text style={styles.fileIcon}>{getFileIcon(file.mimeType)}</Text>
                          </View>
                          <View style={styles.fileInfo}>
                            <Text style={styles.fileName} numberOfLines={2}>
                              {file.originalName}
                            </Text>
                            <Text style={styles.fileSize}>
                              {(Number(file.fileSize) / 1024).toFixed(2)} KB
                            </Text>
                            {file.description && (
                              <Text style={styles.fileDescription} numberOfLines={1}>
                                {file.description}
                              </Text>
                            )}
                          </View>
                          <View style={styles.fileAction}>
                            {isImage ? (
                              <Ionicons name="eye" size={24} color={theme.color.brand.primary} />
                            ) : (
                              <Ionicons name="download" size={24} color={theme.color.brand.primary} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Metadata */}
              <View style={styles.metadataSection}>
                <Text style={styles.metadataLabel}>Información del Sistema</Text>
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataKey}>ID:</Text>
                  <Text style={styles.metadataValue}>{operation.id}</Text>
                </View>
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataKey}>Creado:</Text>
                  <Text style={styles.metadataValue}>{formatDateTime(operation.createdAt)}</Text>
                </View>
                {operation.updatedAt && operation.updatedAt !== operation.createdAt && (
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataKey}>Actualizado:</Text>
                    <Text style={styles.metadataValue}>{formatDateTime(operation.updatedAt)}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
                <Ionicons name="pencil" size={20} color={theme.color.text.inverse} />
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Ionicons name="trash" size={20} color={theme.color.text.inverse} />
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.footerSecondary}>
              <TouchableOpacity style={styles.closeFooterButton} onPress={onClose}>
                <Text style={styles.closeFooterButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Viewer Modal - Using fileId for on-demand signed URL generation */}
      <ImageViewerModal
        visible={imageViewerVisible}
        fileId={selectedFileId}
        fileName={selectedFileName}
        onClose={() => {
          setImageViewerVisible(false);
          setSelectedFileId(null);
          setSelectedFileName('');
        }}
      />
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: theme.radii['2xl'],
      borderTopRightRadius: theme.radii['2xl'],
      maxHeight: '90%',
      paddingBottom: Platform.OS === 'ios' ? theme.space[5] : 0,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.default,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    closeButton: {
      padding: theme.space[1],
    },
    section: {
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    operationTypeBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.xl,
    },
    operationTypeBadgeText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
    amountLabel: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginBottom: theme.space[1],
    },
    amountValue: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.subtle,
      marginBottom: theme.space[2],
    },
    value: {
      fontSize: 16,
      color: theme.color.text.heading,
      lineHeight: 24,
    },
    subValue: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginTop: theme.space[1],
    },
    paymentMethodBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.brand.accentSoft,
      borderWidth: 1,
      borderColor: theme.color.brand.accent,
    },
    paymentMethodText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.brand.accent,
    },
    filesContainer: {
      marginTop: theme.space[2],
      gap: theme.space[3],
    },
    fileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.space[3],
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    fileIconContainer: {
      width: 48,
      height: 48,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.base,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    fileIcon: {
      fontSize: 24,
    },
    fileInfo: {
      flex: 1,
      marginRight: theme.space[3],
    },
    fileName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[0.5],
    },
    fileSize: {
      fontSize: 12,
      color: theme.color.text.subtle,
    },
    fileDescription: {
      fontSize: 12,
      color: theme.color.text.placeholder,
      marginTop: theme.space[0.5],
    },
    fileAction: {
      padding: theme.space[1],
    },
    metadataSection: {
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[4],
      backgroundColor: theme.color.background.subtle,
    },
    metadataLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.placeholder,
      marginBottom: theme.space[3],
      textTransform: 'uppercase',
    },
    metadataRow: {
      flexDirection: 'row',
      marginBottom: theme.space[2],
    },
    metadataKey: {
      fontSize: 13,
      color: theme.color.text.subtle,
      width: 100,
    },
    metadataValue: {
      flex: 1,
      fontSize: 13,
      color: theme.color.text.heading,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: theme.space[6],
      paddingTop: theme.space[4],
      paddingBottom: theme.space[2],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
      gap: theme.space[3],
    },
    footerSecondary: {
      paddingHorizontal: theme.space[6],
      paddingBottom: theme.space[4],
    },
    editButton: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.color.brand.accent,
      paddingVertical: theme.space[3.5],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
    },
    editButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    deleteButton: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.color.action.danger.background,
      paddingVertical: theme.space[3.5],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    closeFooterButton: {
      backgroundColor: theme.color.surface.muted,
      paddingVertical: theme.space[3.5],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    closeFooterButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.subtle,
    },
    loadingFilesContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[3],
    },
    loadingFilesText: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginLeft: theme.space[3],
    },
  });
