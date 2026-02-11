import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBizlinksDocuments } from '../../hooks/useBizlinks';
import {
  BizlinksDocument,
  BizlinksDocumentType,
  BizlinksStatusSunat,
  GetBizlinksDocumentsParams,
} from '../../types/bizlinks';
import { useAuthStore } from '../../store/auth';
import { BizlinksDocumentsFAB } from '@/components/Bizlinks';
import { StatusFilter, StatusOption } from '@/components/common/StatusFilter';
import { SearchBar } from '@/components/common/SearchBar';
import { useDebounce } from '@/hooks/useDebounce';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

type Props = NativeStackScreenProps<any, 'BizlinksDocuments'>;

// Mapeo de tipos de documento
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta',
  '07': 'N. Crédito',
  '08': 'N. Débito',
  '09': 'Guía Remisión',
  '31': 'G.R. Transportista',
  '20': 'Retención',
  '40': 'Percepción',
};

const DOCUMENT_TYPE_COLORS: Record<string, string> = {
  '01': '#3B82F6', // Azul - Factura
  '03': '#10B981', // Verde - Boleta
  '07': '#F59E0B', // Amarillo - NC
  '08': '#EF4444', // Rojo - ND
  '09': '#8B5CF6', // Púrpura - GR
  '31': '#6366F1', // Índigo - GRT
  '20': '#EC4899', // Rosa - Retención
  '40': '#14B8A6', // Teal - Percepción
};

const STATUS_SUNAT_COLORS: Record<string, string> = {
  PENDIENTE_ENVIO: '#94A3B8',
  PENDIENTE_RESPUESTA: '#F59E0B',
  ACEPTADO: '#10B981',
  RECHAZADO: '#EF4444',
  ANULADO: '#64748B',
};

export const BizlinksDocumentsScreen: React.FC<Props> = ({ navigation }) => {
  const { currentCompany, currentSite } = useAuthStore();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  // Estados
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [documents, setDocuments] = useState<BizlinksDocument[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshingDocId, setRefreshingDocId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // Filtros de fecha
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showDateFilters, setShowDateFilters] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const {
    getDocuments,
    refreshDocumentStatus,
    downloadArtifacts,
  } = useBizlinksDocuments();

  // Cargar documentos
  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const params: GetBizlinksDocumentsParams = {
        page,
        limit: 20,
        companyId: currentCompany?.id,
        siteId: currentSite?.id,
      };

      if (selectedDocumentType !== 'ALL') {
        params.documentType = selectedDocumentType as BizlinksDocumentType;
      }

      if (selectedStatus !== 'ALL') {
        params.statusSunat = selectedStatus as BizlinksStatusSunat;
      }

      if (debouncedSearchTerm) {
        params.serieNumero = debouncedSearchTerm;
      }

      if (startDate) {
        params.startDate = startDate;
      }

      if (endDate) {
        params.endDate = endDate;
      }

      const data = await getDocuments(params);

      // Asumiendo que la API retorna un array o un objeto con data
      if (Array.isArray(data)) {
        setDocuments(data);
        setPagination({
          page: 1,
          limit: 20,
          total: data.length,
          totalPages: 1,
        });
      } else if (data.data) {
        setDocuments(data.data);
        setPagination({
          page: data.page || 1,
          limit: data.limit || 20,
          total: data.total || 0,
          totalPages: Math.ceil((data.total || 0) / (data.limit || 20)),
        });
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Error', 'No se pudieron cargar los documentos');
    } finally {
      setLoading(false);
    }
  }, [page, selectedDocumentType, selectedStatus, debouncedSearchTerm, startDate, endDate, currentCompany, currentSite]);

  // Auto-reload cuando cambian los filtros
  useEffect(() => {
    loadDocuments();
  }, [page, selectedDocumentType, selectedStatus, debouncedSearchTerm, startDate, endDate]);

  // Auto-reload cuando la pantalla obtiene foco
  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [loadDocuments])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await loadDocuments();
    setRefreshing(false);
  }, [loadDocuments]);

  const handlePreviousPage = useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    }
  }, [page]);

  const handleNextPage = useCallback(() => {
    if (page < pagination.totalPages) {
      setPage(page + 1);
    }
  }, [page, pagination.totalPages]);

  const handleClearDateFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setPage(1);
  }, []);

  const handleStartDateConfirm = useCallback((date: Date) => {
    const formattedDate = date.toISOString().split('T')[0];
    setStartDate(formattedDate);
    setShowStartDatePicker(false);
    setPage(1);
  }, []);

  const handleEndDateConfirm = useCallback((date: Date) => {
    const formattedDate = date.toISOString().split('T')[0];
    setEndDate(formattedDate);
    setShowEndDatePicker(false);
    setPage(1);
  }, []);

  const handleRefreshDocument = async (document: BizlinksDocument) => {
    setRefreshingDocId(document.id);
    try {
      const updated = await refreshDocumentStatus(document.id);
      Alert.alert(
        'Estado actualizado',
        `Estado SUNAT: ${updated.statusSunat}\n${updated.messageSunat?.mensaje || ''}`
      );
      loadDocuments();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setRefreshingDocId(null);
    }
  };

  const handleDownloadPDF = async (document: BizlinksDocument, event: any) => {
    event.stopPropagation();
    setDownloadingDocId(document.id);

    try {
      console.log('📥 Descargando PDF para:', document.serieNumero);

      if (Platform.OS === 'web') {
        // En web, usar el endpoint directo que devuelve el blob
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
        const pdfUrl = `${apiUrl}/bizlinks/documents/${document.id}/pdf`;

        // Abrir en nueva pestaña
        window.open(pdfUrl, '_blank');
      } else {
        // En móvil, descargar usando el endpoint directo
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
        const pdfUrl = `${apiUrl}/bizlinks/documents/${document.id}/pdf`;

        const fileName = `${document.serieNumero}.pdf`;
        const fileUri = FileSystem.documentDirectory + fileName;

        const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Comprobante ${document.serieNumero}`,
          });
        } else {
          Alert.alert('Éxito', `PDF guardado en: ${downloadResult.uri}`);
        }
      }

      console.log('✅ PDF descargado exitosamente');
    } catch (error: any) {
      console.error('❌ Error al descargar PDF:', error);
      Alert.alert('Error', error.message || 'Error al descargar PDF');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleDownloadXML = async (document: BizlinksDocument, event: any) => {
    event.stopPropagation();
    setDownloadingDocId(document.id);

    try {
      console.log('📥 Descargando XML para:', document.serieNumero);

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
      const xmlUrl = `${apiUrl}/bizlinks/documents/${document.id}/xml`;

      if (Platform.OS === 'web') {
        // En web, abrir en nueva pestaña
        window.open(xmlUrl, '_blank');
      } else {
        // En móvil, descargar y compartir
        const fileName = `${document.serieNumero}.xml`;
        const fileUri = FileSystem.documentDirectory + fileName;

        const downloadResult = await FileSystem.downloadAsync(xmlUrl, fileUri);

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/xml',
            dialogTitle: `XML ${document.serieNumero}`,
          });
        } else {
          Alert.alert('Éxito', `XML guardado en: ${downloadResult.uri}`);
        }
      }

      console.log('✅ XML descargado exitosamente');
    } catch (error: any) {
      console.error('❌ Error al descargar XML:', error);
      Alert.alert('Error', error.message || 'Error al descargar XML');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleDocumentPress = (document: BizlinksDocument) => {
    navigation.navigate('BizlinksDocumentDetail', { documentId: document.id });
  };

  const handleDocumentTypeSelect = (documentType: BizlinksDocumentType) => {
    console.log('📄 Tipo de documento seleccionado:', documentType);

    // Navegar a la pantalla de selección de serie
    navigation.navigate('BizlinksSelectSeries', {
      documentType,
      companyId: currentCompany?.id,
      siteId: currentSite?.id,
    });
  };

  // Opciones de filtro por tipo de documento
  const documentTypeOptions: StatusOption[] = useMemo(() => [
    { value: 'ALL', label: 'Todos', color: '#6366F1' },
    { value: '01', label: 'Facturas', color: DOCUMENT_TYPE_COLORS['01'] },
    { value: '03', label: 'Boletas', color: DOCUMENT_TYPE_COLORS['03'] },
    { value: '07', label: 'N. Crédito', color: DOCUMENT_TYPE_COLORS['07'] },
    { value: '08', label: 'N. Débito', color: DOCUMENT_TYPE_COLORS['08'] },
    { value: '09', label: 'Guías', color: DOCUMENT_TYPE_COLORS['09'] },
  ], []);

  // Opciones de filtro por estado SUNAT
  const statusOptions: StatusOption[] = useMemo(() => [
    { value: 'ALL', label: 'Todos', color: '#6366F1' },
    { value: 'PENDIENTE_ENVIO', label: 'Pendiente', color: STATUS_SUNAT_COLORS.PENDIENTE_ENVIO },
    { value: 'ACEPTADO', label: 'Aceptado', color: STATUS_SUNAT_COLORS.ACEPTADO },
    { value: 'RECHAZADO', label: 'Rechazado', color: STATUS_SUNAT_COLORS.RECHAZADO },
    { value: 'ANULADO', label: 'Anulado', color: STATUS_SUNAT_COLORS.ANULADO },
  ], []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'S/ 0.00';
    return `S/ ${amount.toFixed(2)}`;
  };

  const renderDocumentCard = (document: BizlinksDocument) => {
    const isRefreshing = refreshingDocId === document.id;
    const isDownloading = downloadingDocId === document.id;
    const documentTypeColor = DOCUMENT_TYPE_COLORS[document.documentType] || '#6B7280';
    const statusColor = STATUS_SUNAT_COLORS[document.statusSunat || 'PENDIENTE_ENVIO'] || '#94A3B8';

    return (
      <TouchableOpacity
        key={document.id}
        style={[styles.card, isTablet && styles.cardTablet]}
        onPress={() => handleDocumentPress(document)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.documentTypeBadge, { backgroundColor: documentTypeColor + '20', borderColor: documentTypeColor }]}>
              <Text style={[styles.documentTypeText, { color: documentTypeColor }]}>
                {DOCUMENT_TYPE_LABELS[document.documentType] || document.documentType}
              </Text>
            </View>
            <Text style={[styles.serieNumero, isTablet && styles.serieNumeroTablet]}>
              {document.serieNumero}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {document.statusSunat || 'Pendiente'}
            </Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Cliente:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
              {document.razonSocialAdquiriente}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>RUC/DNI:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {document.numeroDocumentoAdquiriente}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Total:</Text>
            <Text style={[styles.infoValue, styles.totalAmount, isTablet && styles.infoValueTablet]}>
              {formatCurrency(document.totalVenta)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Fecha:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {formatDate(document.fechaEmision)}
            </Text>
          </View>
        </View>

        {/* Footer - Actions */}
        <View style={styles.cardFooter}>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.refreshButton, isRefreshing && styles.actionButtonDisabled]}
              onPress={(e) => {
                e.stopPropagation();
                handleRefreshDocument(document);
              }}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.pdfButton, isDownloading && styles.actionButtonDisabled]}
              onPress={(e) => handleDownloadPDF(document, e)}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="document-text" size={16} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>PDF</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.xmlButton]}
              onPress={(e) => handleDownloadXML(document, e)}
            >
              <Ionicons name="code-slash" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>XML</Text>
            </TouchableOpacity>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando comprobantes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <View>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>
            Comprobantes Electrónicos
          </Text>
          <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
            Gestión de facturación electrónica SUNAT
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Buscar por serie-número..."
          onClear={() => setSearchTerm('')}
        />
      </View>

      {/* Filtro por Tipo de Documento */}
      <StatusFilter
        statuses={documentTypeOptions}
        selectedStatus={selectedDocumentType}
        onStatusChange={(status) => {
          setSelectedDocumentType(status);
          setPage(1);
        }}
        style={styles.statusFilter}
      />

      {/* Filtro por Estado SUNAT */}
      <StatusFilter
        statuses={statusOptions}
        selectedStatus={selectedStatus}
        onStatusChange={(status) => {
          setSelectedStatus(status);
          setPage(1);
        }}
        style={styles.statusFilter}
      />

      {/* Date Filters Toggle */}
      <View style={styles.dateFilterToggleContainer}>
        <TouchableOpacity
          style={styles.dateFilterToggle}
          onPress={() => setShowDateFilters(!showDateFilters)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showDateFilters ? 'calendar' : 'calendar-outline'}
            size={20}
            color="#6366F1"
          />
          <Text style={styles.dateFilterToggleText}>
            {showDateFilters ? 'Ocultar Filtros de Fecha' : 'Filtrar por Fecha'}
          </Text>
          <Ionicons
            name={showDateFilters ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#6366F1"
          />
        </TouchableOpacity>
        {(startDate || endDate) && (
          <TouchableOpacity
            style={styles.clearDateButton}
            onPress={handleClearDateFilters}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={20} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* Date Filters Panel */}
      {showDateFilters && (
        <View style={styles.dateFiltersPanel}>
          <View style={styles.dateRangePickers}>
            <View style={styles.datePickerWrapper}>
              <DatePickerButton
                label="Fecha Inicial"
                value={startDate}
                onPress={() => setShowStartDatePicker(true)}
                placeholder="Seleccionar fecha inicial"
                icon="calendar-outline"
              />
            </View>
            <View style={styles.datePickerWrapper}>
              <DatePickerButton
                label="Fecha Final"
                value={endDate}
                onPress={() => setShowEndDatePicker(true)}
                placeholder="Seleccionar fecha final"
                icon="calendar-outline"
              />
            </View>
          </View>

          {(startDate || endDate) && (
            <View style={styles.activeFiltersInfo}>
              <Ionicons name="information-circle" size={16} color="#6366F1" />
              <Text style={styles.activeFiltersText}>
                {startDate && endDate
                  ? `Mostrando desde ${startDate} hasta ${endDate}`
                  : startDate
                  ? `Mostrando desde ${startDate}`
                  : `Mostrando hasta ${endDate}`}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Documents List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {documents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyIcon, isTablet && styles.emptyIconTablet]}>📄</Text>
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No hay comprobantes registrados
            </Text>
            <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
              Emite tu primer comprobante electrónico
            </Text>
          </View>
        ) : (
          documents.map(renderDocumentCard)
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Pagination */}
      {pagination.total > 0 && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[
              styles.paginationButton,
              pagination.page === 1 && styles.paginationButtonDisabled,
            ]}
            onPress={handlePreviousPage}
            disabled={pagination.page === 1}
          >
            <Text
              style={[
                styles.paginationButtonText,
                pagination.page === 1 && styles.paginationButtonTextDisabled,
              ]}
            >
              ← Anterior
            </Text>
          </TouchableOpacity>

          <View style={styles.paginationInfo}>
            <Text style={styles.paginationText}>
              Pág. {pagination.page}/{pagination.totalPages}
            </Text>
            <Text style={styles.paginationSubtext}>
              {documents.length} de {pagination.total}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.paginationButton,
              pagination.page >= pagination.totalPages && styles.paginationButtonDisabled,
            ]}
            onPress={handleNextPage}
            disabled={pagination.page >= pagination.totalPages}
          >
            <Text
              style={[
                styles.paginationButtonText,
                pagination.page >= pagination.totalPages && styles.paginationButtonTextDisabled,
              ]}
            >
              Siguiente →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Action Button with Document Type Selection */}
      <BizlinksDocumentsFAB onDocumentTypeSelect={handleDocumentTypeSelect} />

      {/* Date Pickers */}
      <DatePicker
        visible={showStartDatePicker}
        date={startDate ? new Date(startDate) : new Date()}
        onConfirm={handleStartDateConfirm}
        onCancel={() => setShowStartDatePicker(false)}
        title="Seleccionar Fecha Inicial"
      />

      <DatePicker
        visible={showEndDatePicker}
        date={endDate ? new Date(endDate) : new Date()}
        onConfirm={handleEndDateConfirm}
        onCancel={() => setShowEndDatePicker(false)}
        title="Seleccionar Fecha Final"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  titleTablet: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  subtitleTablet: {
    fontSize: 16,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  statusFilter: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dateFilterToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dateFilterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dateFilterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  clearDateButton: {
    padding: 4,
  },
  dateFiltersPanel: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dateRangePickers: {
    flexDirection: 'row',
    gap: 12,
  },
  datePickerWrapper: {
    flex: 1,
  },
  activeFiltersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  activeFiltersText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  contentContainerTablet: {
    padding: 32,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTablet: {
    padding: 24,
    borderRadius: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 8,
  },
  documentTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  documentTypeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  serieNumero: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  serieNumeroTablet: {
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardBody: {
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    width: 80,
  },
  infoLabelTablet: {
    fontSize: 15,
    width: 100,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  infoValueTablet: {
    fontSize: 16,
  },
  totalAmount: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 40,
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  refreshButton: {
    backgroundColor: '#6366F1',
  },
  pdfButton: {
    backgroundColor: '#EF4444',
  },
  xmlButton: {
    backgroundColor: '#F59E0B',
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyIconTablet: {
    fontSize: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '600',
  },
  emptyTextTablet: {
    fontSize: 18,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
  },
  emptySubtextTablet: {
    fontSize: 16,
  },
  bottomSpacer: {
    height: 100,
  },
  paginationContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 60,
  },
  paginationInfo: {
    alignItems: 'center',
    minWidth: 100,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  paginationButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    minWidth: 110,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {
    color: '#94A3B8',
  },
});
