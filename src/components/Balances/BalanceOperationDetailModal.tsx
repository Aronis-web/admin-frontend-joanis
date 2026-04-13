import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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
                <Ionicons name="close" size={28} color="#64748B" />
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
                    <ActivityIndicator size="small" color="#6366F1" />
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
                              <Ionicons name="eye" size={24} color="#6366F1" />
                            ) : (
                              <Ionicons name="download" size={24} color="#6366F1" />
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
                <Ionicons name="pencil" size={20} color="#FFFFFF" />
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Ionicons name="trash" size={20} color="#FFFFFF" />
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? spacing[5] : 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  closeButton: {
    padding: spacing[1],
  },
  section: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  operationTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.xl,
  },
  operationTypeBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  amountLabel: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[2],
  },
  value: {
    fontSize: 16,
    color: colors.neutral[800],
    lineHeight: 24,
  },
  subValue: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  paymentMethodBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[500],
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent[500],
  },
  filesContainer: {
    marginTop: spacing[2],
    gap: spacing[3],
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  fileIcon: {
    fontSize: 24,
  },
  fileInfo: {
    flex: 1,
    marginRight: spacing[3],
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[0.5],
  },
  fileSize: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  fileDescription: {
    fontSize: 12,
    color: colors.neutral[400],
    marginTop: spacing[0.5],
  },
  fileAction: {
    padding: spacing[1],
  },
  metadataSection: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    backgroundColor: colors.background.secondary,
  },
  metadataLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[400],
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  metadataRow: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  metadataKey: {
    fontSize: 13,
    color: colors.neutral[500],
    width: 100,
  },
  metadataValue: {
    flex: 1,
    fontSize: 13,
    color: colors.neutral[800],
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing[3],
  },
  footerSecondary: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.accent[500],
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.danger[500],
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  closeFooterButton: {
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  closeFooterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  loadingFilesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  loadingFilesText: {
    fontSize: 14,
    color: colors.neutral[500],
    marginLeft: spacing[3],
  },
});
