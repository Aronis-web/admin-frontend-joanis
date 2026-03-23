import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';

type Props = NativeStackScreenProps<any, 'UploadedFilesList'>;

type FileStatus = 'procesando' | 'completado' | 'error';
type FileType = 'sales' | 'izipay' | 'prosegur' | '';

interface SourceFile {
  id: string;
  nombre_archivo: string;
  ruta_archivo: string;
  url_descarga: string;
  tipo_fuente: string;
  estado: FileStatus;
  revertido: boolean;
  revertido_at?: string;
  revertido_by?: string;
  revertido_razon?: string;
  total_registros: number;
  registros_nuevos: number;
  registros_duplicados: number;
  registros_con_error: number;
  uploaded_at: string;
  uploaded_by?: string;
}

interface FilesResponse {
  success: boolean;
  data: {
    files: SourceFile[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const UploadedFilesListScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuthStore();
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filtros
  const [filterType, setFilterType] = useState<FileType>('');
  const [filterStatus, setFilterStatus] = useState<FileStatus | ''>('');
  const [showReverted, setShowReverted] = useState(false);

  // Modal de reversión
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SourceFile | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [isReverting, setIsReverting] = useState(false);

  const limit = 20;

  useEffect(() => {
    loadFiles();
  }, [page, filterType, filterStatus, showReverted]);

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filterType) params.append('tipo_fuente', filterType);
      if (filterStatus) params.append('estado', filterStatus);
      if (showReverted) params.append('incluir_revertidos', 'true');

      const response = await fetch(
        `${config.API_URL}/cash-reconciliation/source-files?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-App-Id': config.APP_ID,
          },
        }
      );

      const result: FilesResponse = await response.json();

      if (response.ok && result.success) {
        setFiles(result.data.files);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
      } else {
        throw new Error('Error al cargar archivos');
      }
    } catch (error) {
      console.error('❌ Error al cargar archivos:', error);
      Alert.alert('Error', 'No se pudieron cargar los archivos');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setPage(1);
    loadFiles();
  }, [filterType, filterStatus, showReverted]);

  const handleRevertFile = async (file: SourceFile) => {
    Alert.alert(
      'Revertir Archivo',
      `¿Estás seguro de revertir "${file.nombre_archivo}"?\n\nEsto eliminará ${file.registros_nuevos} registros de la base de datos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revertir',
          style: 'destructive',
          onPress: () => {
            setSelectedFile(file);
            setRevertReason('');
            setShowRevertModal(true);
          },
        },
      ]
    );
  };

  const handleConfirmRevert = async () => {
    if (!selectedFile) return;

    if (!revertReason.trim()) {
      Alert.alert('Error', 'Por favor indica la razón de la reversión');
      return;
    }

    setIsReverting(true);
    try {
      const response = await fetch(
        `${config.API_URL}/cash-reconciliation/source-files/${selectedFile.id}/revert`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-App-Id': config.APP_ID,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ razon: revertReason.trim() }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setShowRevertModal(false);
        setSelectedFile(null);
        setRevertReason('');
        Alert.alert(
          'Éxito',
          `Archivo revertido exitosamente\n\n` +
            `Registros eliminados: ${result.data.registros_eliminados || 0}`,
          [{ text: 'OK', onPress: () => loadFiles() }]
        );
      } else {
        throw new Error(result.message || 'Error al revertir archivo');
      }
    } catch (error: any) {
      console.error('❌ Error al revertir archivo:', error);
      Alert.alert('Error', error.message || 'No se pudo revertir el archivo');
    } finally {
      setIsReverting(false);
    }
  };

  const handleDownloadFile = async (file: SourceFile) => {
    try {
      // Construir URL con headers como query params para Linking
      // O usar fetch para descargar y luego abrir
      const downloadUrl = `${config.API_URL}${file.url_descarga}`;

      console.log('📥 Descargando archivo:', file.nombre_archivo);

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-App-Id': config.APP_ID,
        },
      });

      if (!response.ok) {
        throw new Error('Error al descargar el archivo');
      }

      // Obtener el blob del archivo
      const blob = await response.blob();

      // Crear URL temporal del blob
      const blobUrl = URL.createObjectURL(blob);

      // Abrir en nueva ventana/tab (para web) o descargar
      const supported = await Linking.canOpenURL(blobUrl);
      if (supported) {
        await Linking.openURL(blobUrl);
      } else {
        // Fallback: crear elemento <a> para descargar
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = file.nombre_archivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Limpiar URL temporal después de un tiempo
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      }

      console.log('✅ Archivo descargado exitosamente');
    } catch (error) {
      console.error('❌ Error al descargar archivo:', error);
      Alert.alert('Error', 'No se pudo descargar el archivo');
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sales: 'Ventas',
      izipay: 'Izipay',
      prosegur: 'Prosegur',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      sales: '#10B981',
      izipay: '#3B82F6',
      prosegur: '#F59E0B',
    };
    return colors[type] || '#6B7280';
  };

  const getStatusLabel = (status: FileStatus) => {
    const labels: Record<FileStatus, string> = {
      procesando: 'Procesando',
      completado: 'Completado',
      error: 'Error',
    };
    return labels[status];
  };

  const getStatusColor = (status: FileStatus) => {
    const colors: Record<FileStatus, string> = {
      procesando: '#F59E0B',
      completado: '#10B981',
      error: '#EF4444',
    };
    return colors[status];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderFileCard = (file: SourceFile) => (
    <View
      key={file.id}
      style={[
        styles.fileCard,
        file.revertido && styles.fileCardReverted,
      ]}
    >
      {/* Header */}
      <View style={styles.fileHeader}>
        <View style={styles.fileHeaderLeft}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: getTypeColor(file.tipo_fuente) },
            ]}
          >
            <Text style={styles.typeBadgeText}>
              {getTypeLabel(file.tipo_fuente)}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(file.estado) },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {getStatusLabel(file.estado)}
            </Text>
          </View>
          {file.revertido && (
            <View style={styles.revertedBadge}>
              <Text style={styles.revertedBadgeText}>REVERTIDO</Text>
            </View>
          )}
        </View>
      </View>

      {/* File Info */}
      <View style={styles.fileInfo}>
        <Text style={styles.fileName}>{file.nombre_archivo}</Text>
        <Text style={styles.fileDate}>
          📅 {formatDate(file.uploaded_at)}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{file.total_registros}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Nuevos</Text>
          <Text style={[styles.statValue, { color: '#10B981' }]}>
            {file.registros_nuevos}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Duplicados</Text>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>
            {file.registros_duplicados}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Errores</Text>
          <Text style={[styles.statValue, { color: '#EF4444' }]}>
            {file.registros_con_error}
          </Text>
        </View>
      </View>

      {/* Revert Info */}
      {file.revertido && file.revertido_razon && (
        <View style={styles.revertInfo}>
          <Text style={styles.revertInfoLabel}>Razón de reversión:</Text>
          <Text style={styles.revertInfoText}>{file.revertido_razon}</Text>
          {file.revertido_at && (
            <Text style={styles.revertInfoDate}>
              {formatDate(file.revertido_at)}
            </Text>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => handleDownloadFile(file)}
        >
          <Text style={styles.downloadButtonText}>⬇️ Descargar</Text>
        </TouchableOpacity>

        {!file.revertido && file.estado === 'completado' && (
          <TouchableOpacity
            style={styles.revertButton}
            onPress={() => handleRevertFile(file)}
          >
            <Text style={styles.revertButtonText}>↩️ Revertir</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archivos Subidos</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Modal de Reversión */}
      <Modal
        visible={showRevertModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isReverting) {
            setShowRevertModal(false);
            setSelectedFile(null);
            setRevertReason('');
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Razón de Reversión</Text>
              <TouchableOpacity
                onPress={() => {
                  if (!isReverting) {
                    setShowRevertModal(false);
                    setSelectedFile(null);
                    setRevertReason('');
                  }
                }}
                style={styles.modalCloseButton}
                disabled={isReverting}
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <View style={styles.modalContent}>
              {selectedFile && (
                <View style={styles.modalFileInfo}>
                  <Text style={styles.modalFileLabel}>Archivo:</Text>
                  <Text style={styles.modalFileName}>{selectedFile.nombre_archivo}</Text>
                  <Text style={styles.modalFileWarning}>
                    ⚠️ Se eliminarán {selectedFile.registros_nuevos} registros
                  </Text>
                </View>
              )}

              <Text style={styles.modalInputLabel}>
                Por favor indica la razón de la reversión:
              </Text>
              <TextInput
                style={styles.modalInput}
                value={revertReason}
                onChangeText={setRevertReason}
                placeholder="Ej: Archivo incorrecto, datos duplicados, etc."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isReverting}
              />
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowRevertModal(false);
                  setSelectedFile(null);
                  setRevertReason('');
                }}
                disabled={isReverting}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalConfirmButton,
                  isReverting && styles.modalButtonDisabled,
                ]}
                onPress={handleConfirmRevert}
                disabled={isReverting}
              >
                {isReverting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>Confirmar Reversión</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Tipo:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filterType}
                onValueChange={(value) => {
                  setFilterType(value);
                  setPage(1);
                }}
                style={styles.picker}
              >
                <Picker.Item label="Todos" value="" />
                <Picker.Item label="Ventas" value="sales" />
                <Picker.Item label="Izipay" value="izipay" />
                <Picker.Item label="Prosegur" value="prosegur" />
              </Picker>
            </View>
          </View>

          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Estado:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filterStatus}
                onValueChange={(value) => {
                  setFilterStatus(value);
                  setPage(1);
                }}
                style={styles.picker}
              >
                <Picker.Item label="Todos" value="" />
                <Picker.Item label="Completado" value="completado" />
                <Picker.Item label="Procesando" value="procesando" />
                <Picker.Item label="Error" value="error" />
              </Picker>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.revertedToggle}
          onPress={() => {
            setShowReverted(!showReverted);
            setPage(1);
          }}
        >
          <View
            style={[
              styles.checkbox,
              showReverted && styles.checkboxChecked,
            ]}
          >
            {showReverted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.revertedToggleText}>
            Mostrar archivos revertidos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results Info */}
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsText}>
          {total} archivo{total !== 1 ? 's' : ''} encontrado
          {total !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Files List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading && page === 1 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Cargando archivos...</Text>
          </View>
        ) : files.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyText}>No hay archivos subidos</Text>
          </View>
        ) : (
          <>
            {files.map(renderFileCard)}

            {/* Pagination */}
            {totalPages > 1 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    page === 1 && styles.paginationButtonDisabled,
                  ]}
                  onPress={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <Text
                    style={[
                      styles.paginationButtonText,
                      page === 1 && styles.paginationButtonTextDisabled,
                    ]}
                  >
                    ← Anterior
                  </Text>
                </TouchableOpacity>

                <Text style={styles.paginationInfo}>
                  Página {page} de {totalPages}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    page === totalPages && styles.paginationButtonDisabled,
                  ]}
                  onPress={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  <Text
                    style={[
                      styles.paginationButtonText,
                      page === totalPages && styles.paginationButtonTextDisabled,
                    ]}
                  >
                    Siguiente →
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
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
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  filterItem: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
  },
  picker: {
    height: 40,
    color: '#1F2937',
  },
  revertedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  revertedToggleText: {
    fontSize: 14,
    color: '#374151',
  },
  resultsInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  resultsText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  fileCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fileCardReverted: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    opacity: 0.8,
  },
  fileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fileHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  revertedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#DC2626',
  },
  revertedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fileInfo: {
    marginBottom: 12,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  fileDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  revertInfo: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  revertInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 4,
  },
  revertInfoText: {
    fontSize: 13,
    color: '#7F1D1D',
    marginBottom: 4,
  },
  revertInfoDate: {
    fontSize: 11,
    color: '#991B1B',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  downloadButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  revertButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  revertButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginTop: 8,
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  paginationButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {
    color: '#9CA3AF',
  },
  paginationInfo: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  modalFileInfo: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  modalFileLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 4,
  },
  modalFileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7F1D1D',
    marginBottom: 8,
  },
  modalFileWarning: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalCancelButton: {
    backgroundColor: '#F3F4F6',
  },
  modalCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  modalConfirmButton: {
    backgroundColor: '#EF4444',
  },
  modalConfirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
});
