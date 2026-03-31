/**
 * UploadedFilesListScreen.tsx
 *
 * Pantalla para listar archivos subidos de cuadre de caja.
 * Rediseñada con el sistema de diseño global.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';

// Design System Imports
import { colors } from '@/design-system/tokens/colors';
import { spacing, borderRadius } from '@/design-system/tokens/spacing';
import { shadows } from '@/design-system/tokens/shadows';
import { fontSizes, fontWeights } from '@/design-system/tokens/typography';
import { durations } from '@/design-system/tokens/animations';

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

// ============================================================================
// File Card Component
// ============================================================================

interface FileCardProps {
  file: SourceFile;
  index: number;
  onDownload: () => void;
  onRevert: () => void;
}

const FileCard: React.FC<FileCardProps> = ({ file, index, onDownload, onRevert }) => {
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: durations.normal,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: durations.normal,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getTypeInfo = (type: string) => {
    const types: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
      sales: { label: 'Ventas', color: colors.success[600], icon: 'cash-outline' },
      izipay: { label: 'Izipay', color: colors.accent[600], icon: 'card-outline' },
      prosegur: { label: 'Prosegur', color: colors.warning[600], icon: 'business-outline' },
    };
    return types[type] || { label: type, color: colors.neutral[500], icon: 'document-outline' as keyof typeof Ionicons.glyphMap };
  };

  const getStatusInfo = (status: FileStatus) => {
    const statuses: Record<FileStatus, { label: string; color: string; bgColor: string }> = {
      procesando: { label: 'Procesando', color: colors.warning[700], bgColor: colors.warning[100] },
      completado: { label: 'Completado', color: colors.success[700], bgColor: colors.success[100] },
      error: { label: 'Error', color: colors.danger[700], bgColor: colors.danger[100] },
    };
    return statuses[status];
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

  const typeInfo = getTypeInfo(file.tipo_fuente);
  const statusInfo = getStatusInfo(file.estado);

  return (
    <Animated.View
      style={[
        styles.fileCard,
        file.revertido && styles.fileCardReverted,
        { transform: [{ translateY }], opacity },
      ]}
    >
      {/* Header */}
      <View style={styles.fileHeader}>
        <View style={styles.fileHeaderBadges}>
          <View style={[styles.typeBadge, { backgroundColor: typeInfo.color }]}>
            <Ionicons name={typeInfo.icon} size={14} color={colors.neutral[0]} />
            <Text style={styles.typeBadgeText}>{typeInfo.label}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
            <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
              {statusInfo.label}
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
        <Text style={styles.fileName} numberOfLines={2}>{file.nombre_archivo}</Text>
        <View style={styles.fileDateRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.neutral[400]} />
          <Text style={styles.fileDate}>{formatDate(file.uploaded_at)}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{file.total_registros}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.success[600] }]}>
            {file.registros_nuevos}
          </Text>
          <Text style={styles.statLabel}>Nuevos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.warning[600] }]}>
            {file.registros_duplicados}
          </Text>
          <Text style={styles.statLabel}>Duplicados</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.danger[600] }]}>
            {file.registros_con_error}
          </Text>
          <Text style={styles.statLabel}>Errores</Text>
        </View>
      </View>

      {/* Revert Info */}
      {file.revertido && file.revertido_razon && (
        <View style={styles.revertInfo}>
          <Ionicons name="information-circle" size={18} color={colors.danger[600]} />
          <View style={styles.revertInfoContent}>
            <Text style={styles.revertInfoLabel}>Razón de reversión:</Text>
            <Text style={styles.revertInfoText}>{file.revertido_razon}</Text>
            {file.revertido_at && (
              <Text style={styles.revertInfoDate}>{formatDate(file.revertido_at)}</Text>
            )}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.downloadButton} onPress={onDownload} activeOpacity={0.8}>
          <Ionicons name="download-outline" size={18} color={colors.neutral[0]} />
          <Text style={styles.downloadButtonText}>Descargar</Text>
        </TouchableOpacity>

        {!file.revertido && file.estado === 'completado' && (
          <TouchableOpacity style={styles.revertButton} onPress={onRevert} activeOpacity={0.8}>
            <Ionicons name="arrow-undo-outline" size={18} color={colors.neutral[0]} />
            <Text style={styles.revertButtonText}>Revertir</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const UploadedFilesListScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();
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
  const [showFilters, setShowFilters] = useState(false);

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
            'X-App-Version': config.APP_VERSION,
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

  const handleRevertFile = (file: SourceFile) => {
    Alert.alert(
      'Revertir Archivo',
      `¿Estás seguro de revertir "${file.nombre_archivo}"?\n\nEsto eliminará ${file.registros_nuevos} registros.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
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
    if (!selectedFile || !revertReason.trim()) {
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
            'X-App-Version': config.APP_VERSION,
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
          `Archivo revertido\nRegistros eliminados: ${result.data.registros_eliminados || 0}`,
          [{ text: 'OK', onPress: () => loadFiles() }]
        );
      } else {
        throw new Error(result.message || 'Error al revertir archivo');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo revertir el archivo');
    } finally {
      setIsReverting(false);
    }
  };

  const handleDownloadFile = async (file: SourceFile) => {
    try {
      const downloadUrl = `${config.API_URL}${file.url_descarga}`;

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-App-Id': config.APP_ID,
          'X-App-Version': config.APP_VERSION,
        },
      });

      if (!response.ok) throw new Error('Error al descargar');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.nombre_archivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

      Alert.alert('Éxito', 'Archivo descargado');
    } catch (error) {
      Alert.alert('Error', 'No se pudo descargar el archivo');
    }
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterStatus('');
    setShowReverted(false);
    setPage(1);
  };

  const hasActiveFilters = filterType || filterStatus || showReverted;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.neutral[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archivos Subidos</Text>
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
        >
          <Ionicons
            name="filter"
            size={22}
            color={hasActiveFilters ? colors.neutral[0] : colors.neutral[600]}
          />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Tipo</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={filterType}
                  onValueChange={(value) => { setFilterType(value); setPage(1); }}
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
              <Text style={styles.filterLabel}>Estado</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={filterStatus}
                  onValueChange={(value) => { setFilterStatus(value); setPage(1); }}
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

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.revertedToggle}
              onPress={() => { setShowReverted(!showReverted); setPage(1); }}
            >
              <View style={[styles.checkbox, showReverted && styles.checkboxChecked]}>
                {showReverted && <Ionicons name="checkmark" size={14} color={colors.neutral[0]} />}
              </View>
              <Text style={styles.revertedToggleText}>Mostrar revertidos</Text>
            </TouchableOpacity>

            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                <Ionicons name="close-circle" size={18} color={colors.danger[600]} />
                <Text style={styles.clearFiltersText}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Results Info */}
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsText}>
          {total} archivo{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Files List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary[600]]}
          />
        }
      >
        {isLoading && page === 1 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Cargando archivos...</Text>
          </View>
        ) : files.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="folder-open-outline" size={64} color={colors.neutral[300]} />
            </View>
            <Text style={styles.emptyTitle}>Sin archivos</Text>
            <Text style={styles.emptyText}>No hay archivos que coincidan con los filtros</Text>
          </View>
        ) : (
          <>
            {files.map((file, index) => (
              <FileCard
                key={file.id}
                file={file}
                index={index}
                onDownload={() => handleDownloadFile(file)}
                onRevert={() => handleRevertFile(file)}
              />
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.paginationButton, page === 1 && styles.paginationButtonDisabled]}
                  onPress={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={page === 1 ? colors.neutral[400] : colors.neutral[0]}
                  />
                </TouchableOpacity>

                <Text style={styles.paginationInfo}>
                  {page} / {totalPages}
                </Text>

                <TouchableOpacity
                  style={[styles.paginationButton, page === totalPages && styles.paginationButtonDisabled]}
                  onPress={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={page === totalPages ? colors.neutral[400] : colors.neutral[0]}
                  />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Revert Modal */}
      <Modal
        visible={showRevertModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isReverting && setShowRevertModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="warning" size={32} color={colors.danger[600]} />
              </View>
              <Text style={styles.modalTitle}>Revertir Archivo</Text>
              <TouchableOpacity
                onPress={() => !isReverting && setShowRevertModal(false)}
                style={styles.modalCloseButton}
                disabled={isReverting}
              >
                <Ionicons name="close" size={24} color={colors.neutral[500]} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {selectedFile && (
                <View style={styles.modalFileInfo}>
                  <Text style={styles.modalFileLabel}>Archivo:</Text>
                  <Text style={styles.modalFileName}>{selectedFile.nombre_archivo}</Text>
                  <View style={styles.modalWarning}>
                    <Ionicons name="alert-circle" size={18} color={colors.danger[600]} />
                    <Text style={styles.modalWarningText}>
                      Se eliminarán {selectedFile.registros_nuevos} registros
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.modalInputLabel}>Razón de la reversión:</Text>
              <TextInput
                style={styles.modalInput}
                value={revertReason}
                onChangeText={setRevertReason}
                placeholder="Ej: Archivo incorrecto, datos duplicados..."
                placeholderTextColor={colors.neutral[400]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isReverting}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowRevertModal(false)}
                disabled={isReverting}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmButton, isReverting && styles.modalConfirmButtonDisabled]}
                onPress={handleConfirmRevert}
                disabled={isReverting}
              >
                {isReverting ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <>
                    <Ionicons name="arrow-undo" size={18} color={colors.neutral[0]} />
                    <Text style={styles.modalConfirmButtonText}>Confirmar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    ...shadows.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.primary[600],
  },
  filtersContainer: {
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  filterItem: {
    flex: 1,
  },
  filterLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.neutral[700],
    marginBottom: spacing[2],
  },
  pickerContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  picker: {
    height: 44,
    color: colors.neutral[900],
  },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[4],
  },
  revertedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  revertedToggleText: {
    fontSize: fontSizes.sm,
    color: colors.neutral[700],
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  clearFiltersText: {
    fontSize: fontSizes.sm,
    color: colors.danger[600],
    fontWeight: fontWeights.medium,
  },
  resultsInfo: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.neutral[50],
  },
  resultsText: {
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
    fontWeight: fontWeights.medium,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing[16],
    gap: spacing[4],
  },
  loadingText: {
    fontSize: fontSizes.base,
    color: colors.neutral[500],
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing[16],
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[700],
    marginBottom: spacing[2],
  },
  emptyText: {
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
  },
  fileCard: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    ...shadows.sm,
  },
  fileCardReverted: {
    backgroundColor: colors.danger[50],
    borderWidth: 1,
    borderColor: colors.danger[200],
    opacity: 0.9,
  },
  fileHeader: {
    marginBottom: spacing[3],
  },
  fileHeaderBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    gap: spacing[1],
  },
  typeBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
  },
  revertedBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    backgroundColor: colors.danger[600],
  },
  revertedBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.neutral[0],
  },
  fileInfo: {
    marginBottom: spacing[3],
  },
  fileName: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[900],
    marginBottom: spacing[2],
  },
  fileDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  fileDate: {
    fontSize: fontSizes.sm,
    color: colors.neutral[500],
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing[3],
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    marginBottom: spacing[3],
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  statLabel: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.neutral[200],
  },
  revertInfo: {
    flexDirection: 'row',
    backgroundColor: colors.danger[50],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    marginBottom: spacing[3],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.danger[200],
  },
  revertInfoContent: {
    flex: 1,
  },
  revertInfoLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.danger[700],
    marginBottom: spacing[1],
  },
  revertInfoText: {
    fontSize: fontSizes.sm,
    color: colors.danger[800],
    marginBottom: spacing[1],
  },
  revertInfoDate: {
    fontSize: fontSizes.xs,
    color: colors.danger[600],
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent[600],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.md,
    gap: spacing[2],
  },
  downloadButtonText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },
  revertButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger[600],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.md,
    gap: spacing[2],
  },
  revertButtonText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[4],
    gap: spacing[4],
  },
  paginationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: colors.neutral[200],
  },
  paginationInfo: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.neutral[600],
  },
  bottomSpacer: {
    height: spacing[8],
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.lg,
  },
  modalHeader: {
    alignItems: 'center',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.danger[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  modalTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  modalCloseButton: {
    position: 'absolute',
    top: spacing[4],
    right: spacing[4],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: spacing[5],
  },
  modalFileInfo: {
    backgroundColor: colors.neutral[50],
    padding: spacing[4],
    borderRadius: borderRadius.md,
    marginBottom: spacing[4],
  },
  modalFileLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  modalFileName: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.neutral[900],
    marginBottom: spacing[3],
  },
  modalWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  modalWarningText: {
    fontSize: fontSizes.sm,
    color: colors.danger[600],
    fontWeight: fontWeights.medium,
  },
  modalInputLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.neutral[700],
    marginBottom: spacing[2],
  },
  modalInput: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: spacing[4],
    fontSize: fontSizes.base,
    color: colors.neutral[900],
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    padding: spacing[5],
    gap: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  modalCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
  },
  modalCancelButtonText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[700],
  },
  modalConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.md,
    backgroundColor: colors.danger[600],
    gap: spacing[2],
  },
  modalConfirmButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  modalConfirmButtonText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.neutral[0],
  },
});
