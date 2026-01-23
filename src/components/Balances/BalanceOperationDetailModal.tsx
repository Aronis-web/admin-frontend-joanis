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
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
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
    if (!operation) return;

    console.log('📥 Loading files for operation:', operation.id);
    setLoadingFiles(true);

    try {
      const fetchedFiles = await filesApi.getBalanceOperationFiles(operation.id);
      console.log('✅ Files loaded:', fetchedFiles);
      setFiles(fetchedFiles || []);
    } catch (error) {
      console.error('❌ Error loading files:', error);
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  if (!operation) return null;

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

  const handleViewImage = (fileUrl: string, fileName: string) => {
    setSelectedImageUrl(fileUrl);
    setSelectedFileName(fileName);
    setImageViewerVisible(true);
  };

  const handleDownloadFile = async (fileUrl: string, fileName: string) => {
    try {
      // For web, open in new tab
      if (Platform.OS === 'web') {
        window.open(fileUrl, '_blank');
        return;
      }

      // For mobile, try to open with system handler
      const supported = await Linking.canOpenURL(fileUrl);
      if (supported) {
        await Linking.openURL(fileUrl);
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
    if (mimeType.startsWith('image/')) return '📷';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    return '📎';
  };

  const handleEdit = () => {
    if (operation && onEdit) {
      onEdit(operation);
      // Don't close here - let the parent handle the modal transitions
    }
  };

  const handleDelete = () => {
    if (!operation) return;

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
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
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
                <Text style={styles.value}>
                  {operation.balance?.code || operation.balanceId}
                </Text>
                {operation.balance?.receiverCompany && (
                  <Text style={styles.subValue}>
                    🏭 {operation.balance.receiverCompany.name}
                  </Text>
                )}
                {operation.balance?.receiverSite && (
                  <Text style={styles.subValue}>
                    🏢 {operation.balance.receiverSite.name}
                  </Text>
                )}
              </View>

              {/* Emitter Info */}
              {(operation.emitterCompany || operation.emitterSite) && (
                <View style={styles.section}>
                  <Text style={styles.label}>Emisor</Text>
                  {operation.emitterCompany && (
                    <Text style={styles.value}>
                      🏭 {operation.emitterCompany.name}
                    </Text>
                  )}
                  {operation.emitterSite && (
                    <Text style={styles.value}>
                      🏢 {operation.emitterSite.name}
                    </Text>
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
                      // Use signedUrl if available, otherwise construct URL
                      const fileUrl = file.signedUrl || `${config.API_URL}/balance-files/${file.id}`;

                      console.log('📎 Rendering file:', {
                        fileName: file.originalName,
                        mimeType: file.mimeType,
                        isImage,
                        fileUrl,
                        hasSignedUrl: !!file.signedUrl,
                      });

                      return (
                        <TouchableOpacity
                          key={file.id}
                          style={styles.fileCard}
                          onPress={() => {
                            if (isImage) {
                              handleViewImage(fileUrl, file.originalName);
                            } else {
                              handleDownloadFile(fileUrl, file.originalName);
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

      {/* Image Viewer Modal */}
      <ImageViewerModal
        visible={imageViewerVisible}
        imageUrl={selectedImageUrl}
        fileName={selectedFileName}
        onClose={() => {
          setImageViewerVisible(false);
          setSelectedImageUrl(null);
          setSelectedFileName('');
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    padding: 4,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  operationTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  operationTypeBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  amountLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E293B',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: '#1E293B',
    lineHeight: 24,
  },
  subValue: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  paymentMethodBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  filesContainer: {
    marginTop: 8,
    gap: 12,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileIcon: {
    fontSize: 24,
  },
  fileInfo: {
    flex: 1,
    marginRight: 12,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#64748B',
  },
  fileDescription: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  fileAction: {
    padding: 4,
  },
  metadataSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#F8FAFC',
  },
  metadataLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  metadataRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  metadataKey: {
    fontSize: 13,
    color: '#64748B',
    width: 100,
  },
  metadataValue: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  footerSecondary: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeFooterButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeFooterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  loadingFilesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadingFilesText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 12,
  },
});
