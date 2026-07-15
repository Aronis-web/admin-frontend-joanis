/**
 * UploadedFilesListScreen.tsx
 *
 * Pantalla para listar archivos subidos de cuadre de caja.
 * Rediseñada con el sistema de diseño global.
 */

import Alert from '@/utils/alert';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
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
import { Pagination } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
      sales: { label: 'Ventas', color: theme.color.state.success.border, icon: 'cash-outline' },
      izipay: { label: 'Izipay', color: theme.color.brand.accent, icon: 'card-outline' },
      prosegur: { label: 'Prosegur', color: theme.color.state.warning.border, icon: 'business-outline' },
    };
    return types[type] || { label: type, color: theme.color.text.subtle, icon: 'document-outline' as keyof typeof Ionicons.glyphMap };
  };

  const getStatusInfo = (status: FileStatus) => {
    const statuses: Record<FileStatus, { label: string; color: string; bgColor: string }> = {
      procesando: { label: 'Procesando', color: theme.color.state.warning.text, bgColor: theme.color.state.warning.background },
      completado: { label: 'Completado', color: theme.color.state.success.text, bgColor: theme.color.state.success.background },
      error: { label: 'Error', color: theme.color.state.danger.text, bgColor: theme.color.state.danger.background },
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
            <Ionicons name={typeInfo.icon} size={14} color={theme.color.surface.base} />
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
          <Ionicons name="calendar-outline" size={14} color={theme.color.text.placeholder} />
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
          <Text style={[styles.statValue, { color: theme.color.state.success.border }]}>
            {file.registros_nuevos}
          </Text>
          <Text style={styles.statLabel}>Nuevos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.color.state.warning.border }]}>
            {file.registros_duplicados}
          </Text>
          <Text style={styles.statLabel}>Duplicados</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.color.state.danger.border }]}>
            {file.registros_con_error}
          </Text>
          <Text style={styles.statLabel}>Errores</Text>
        </View>
      </View>

      {/* Revert Info */}
      {file.revertido && file.revertido_razon && (
        <View style={styles.revertInfo}>
          <Ionicons name="information-circle" size={18} color={theme.color.state.danger.border} />
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
          <Ionicons name="download-outline" size={18} color={theme.color.surface.base} />
          <Text style={styles.downloadButtonText}>Descargar</Text>
        </TouchableOpacity>

        {!file.revertido && file.estado === 'completado' && (
          <TouchableOpacity style={styles.revertButton} onPress={onRevert} activeOpacity={0.8}>
            <Ionicons name="arrow-undo-outline" size={18} color={theme.color.surface.base} />
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
          <Ionicons name="arrow-back" size={24} color={theme.color.text.body} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archivos Subidos</Text>
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
        >
          <Ionicons
            name="filter"
            size={22}
            color={hasActiveFilters ? theme.color.surface.base : theme.color.text.muted}
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
                {showReverted && <Ionicons name="checkmark" size={14} color={theme.color.surface.base} />}
              </View>
              <Text style={styles.revertedToggleText}>Mostrar revertidos</Text>
            </TouchableOpacity>

            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                <Ionicons name="close-circle" size={18} color={theme.color.state.danger.border} />
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
            colors={[theme.color.brand.primary]}
          />
        }
      >
        {isLoading && page === 1 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.color.brand.primary} />
            <Text style={styles.loadingText}>Cargando archivos...</Text>
          </View>
        ) : files.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="folder-open-outline" size={64} color={theme.color.border.default} />
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

          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={setPage}
          loading={isLoading}
        />
      )}

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
                <Ionicons name="warning" size={32} color={theme.color.state.danger.border} />
              </View>
              <Text style={styles.modalTitle}>Revertir Archivo</Text>
              <TouchableOpacity
                onPress={() => !isReverting && setShowRevertModal(false)}
                style={styles.modalCloseButton}
                disabled={isReverting}
              >
                <Ionicons name="close" size={24} color={theme.color.text.subtle} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {selectedFile && (
                <View style={styles.modalFileInfo}>
                  <Text style={styles.modalFileLabel}>Archivo:</Text>
                  <Text style={styles.modalFileName}>{selectedFile.nombre_archivo}</Text>
                  <View style={styles.modalWarning}>
                    <Ionicons name="alert-circle" size={18} color={theme.color.state.danger.border} />
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
                placeholderTextColor={theme.color.text.placeholder}
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
                  <ActivityIndicator size="small" color={theme.color.surface.base} />
                ) : (
                  <>
                    <Ionicons name="arrow-undo" size={18} color={theme.color.surface.base} />
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.background.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.background.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: theme.color.brand.primary,
  },
  filtersContainer: {
    backgroundColor: theme.color.surface.base,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  filterRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  filterItem: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.text.body,
    marginBottom: theme.space[2],
  },
  pickerContainer: {
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    overflow: 'hidden',
  },
  picker: {
    height: 44,
    color: theme.color.text.heading,
  },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.space[4],
  },
  revertedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: theme.radii.sm,
    borderWidth: 2,
    borderColor: theme.color.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  revertedToggleText: {
    fontSize: 14,
    color: theme.color.text.body,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1],
  },
  clearFiltersText: {
    fontSize: 14,
    color: theme.color.state.danger.border,
    fontWeight: '500',
  },
  resultsInfo: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.background.subtle,
  },
  resultsText: {
    fontSize: 14,
    color: theme.color.text.subtle,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: theme.space[16],
    gap: theme.space[4],
  },
  loadingText: {
    fontSize: 16,
    color: theme.color.text.subtle,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.space[16],
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.color.background.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.space[4],
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.body,
    marginBottom: theme.space[2],
  },
  emptyText: {
    fontSize: 14,
    color: theme.color.text.subtle,
  },
  fileCard: {
    backgroundColor: theme.color.surface.base,
    marginHorizontal: theme.space[4],
    marginTop: theme.space[3],
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    ...theme.shadow.sm,
  },
  fileCardReverted: {
    backgroundColor: theme.color.state.danger.background,
    borderWidth: 1,
    borderColor: theme.color.state.danger.border,
    opacity: 0.9,
  },
  fileHeader: {
    marginBottom: theme.space[3],
  },
  fileHeaderBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
    gap: theme.space[1],
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.surface.base,
  },
  statusBadge: {
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  revertedBadge: {
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
    backgroundColor: theme.color.state.danger.border,
  },
  revertedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.surface.base,
  },
  fileInfo: {
    marginBottom: theme.space[3],
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: theme.space[2],
  },
  fileDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1],
  },
  fileDate: {
    fontSize: 14,
    color: theme.color.text.subtle,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.md,
    marginBottom: theme.space[3],
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  statLabel: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginTop: theme.space[1],
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.color.border.subtle,
  },
  revertInfo: {
    flexDirection: 'row',
    backgroundColor: theme.color.state.danger.background,
    padding: theme.space[3],
    borderRadius: theme.radii.md,
    marginBottom: theme.space[3],
    gap: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.state.danger.border,
  },
  revertInfoContent: {
    flex: 1,
  },
  revertInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.state.danger.text,
    marginBottom: theme.space[1],
  },
  revertInfoText: {
    fontSize: 14,
    color: theme.color.state.danger.text,
    marginBottom: theme.space[1],
  },
  revertInfoDate: {
    fontSize: 12,
    color: theme.color.state.danger.border,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.brand.accent,
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.md,
    gap: theme.space[2],
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.surface.base,
  },
  revertButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.state.danger.border,
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.md,
    gap: theme.space[2],
  },
  revertButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.surface.base,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.space[4],
    gap: theme.space[4],
  },
  paginationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: theme.color.border.subtle,
  },
  paginationInfo: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.color.text.muted,
  },
  bottomSpacer: {
    height: theme.space[8],
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space[4],
  },
  modalContainer: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    width: '100%',
    maxWidth: 400,
    ...theme.shadow.lg,
  },
  modalHeader: {
    alignItems: 'center',
    padding: theme.space[5],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.color.state.danger.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.space[3],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  modalCloseButton: {
    position: 'absolute',
    top: theme.space[4],
    right: theme.space[4],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.color.background.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: theme.space[5],
  },
  modalFileInfo: {
    backgroundColor: theme.color.background.subtle,
    padding: theme.space[4],
    borderRadius: theme.radii.md,
    marginBottom: theme.space[4],
  },
  modalFileLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.subtle,
    marginBottom: theme.space[1],
  },
  modalFileName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.color.text.heading,
    marginBottom: theme.space[3],
  },
  modalWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  modalWarningText: {
    fontSize: 14,
    color: theme.color.state.danger.border,
    fontWeight: '500',
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.color.text.body,
    marginBottom: theme.space[2],
  },
  modalInput: {
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    padding: theme.space[4],
    fontSize: 16,
    color: theme.color.text.heading,
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    padding: theme.space[5],
    gap: theme.space[3],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  modalCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space[4],
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.background.muted,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text.body,
  },
  modalConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space[4],
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.state.danger.border,
    gap: theme.space[2],
  },
  modalConfirmButtonDisabled: {
    backgroundColor: theme.color.border.default,
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.surface.base,
  },
});
