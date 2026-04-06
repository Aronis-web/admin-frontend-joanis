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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateToString } from '@/utils/dateHelpers';
import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { config } from '@/utils/config';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { colors, spacing, borderRadius, shadows } from '@/design-system/tokens';

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
  const { currentCompany, currentSite, token } = useAuthStore();
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
    const formattedDate = formatDateToString(date);
    setStartDate(formattedDate);
    setShowStartDatePicker(false);
    setPage(1);
  }, []);

  const handleEndDateConfirm = useCallback((date: Date) => {
    const formattedDate = formatDateToString(date);
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
      console.log('📋 Document ID:', document.id);

      if (Platform.OS === 'web') {
        // En web, usar el endpoint directo que devuelve el blob
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
        const pdfUrl = `${apiUrl}/bizlinks/documents/${document.id}/pdf`;

        // Abrir en nueva pestaña
        window.open(pdfUrl, '_blank');
      } else {
        // En móvil, descargar usando el endpoint directo con autenticación
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
        const pdfUrl = `${apiUrl}/bizlinks/documents/${document.id}/pdf`;

        console.log('🌐 URL de descarga:', pdfUrl);

        const fileName = `${document.serieNumero}.pdf`;
        const fileUri = FileSystem.cacheDirectory + fileName;

        // Incluir headers de autenticación
        const headers: Record<string, string> = {
          'X-App-Id': config.APP_ID,
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        if (currentCompany?.id) {
          headers['X-Company-Id'] = currentCompany.id;
        }
        if (currentSite?.id) {
          headers['X-Site-Id'] = currentSite.id;
        }

        console.log('📤 Headers:', Object.keys(headers));

        const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri, {
          headers,
        });

        console.log('📦 Download result:', {
          uri: downloadResult.uri,
          status: downloadResult.status,
          headers: downloadResult.headers,
        });

        // Verificar que el archivo se descargó correctamente
        if (downloadResult.status !== 200) {
          throw new Error(`Error del servidor: ${downloadResult.status}`);
        }

        // Verificar el tamaño del archivo
        const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
        console.log('📄 File info:', fileInfo);

        if (fileInfo.exists && fileInfo.size === 0) {
          throw new Error('El archivo descargado está vacío');
        }

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
        // En móvil, descargar y compartir con autenticación
        const fileName = `${document.serieNumero}.xml`;
        const fileUri = FileSystem.cacheDirectory + fileName;

        // Incluir headers de autenticación
        const headers: Record<string, string> = {
          'X-App-Id': config.APP_ID,
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        if (currentCompany?.id) {
          headers['X-Company-Id'] = currentCompany.id;
        }
        if (currentSite?.id) {
          headers['X-Site-Id'] = currentSite.id;
        }

        const downloadResult = await FileSystem.downloadAsync(xmlUrl, fileUri, {
          headers,
        });

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
      <ScreenLayout navigation={navigation as any}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Cargando comprobantes...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[colors.primary[900], colors.primary[800]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="document-text" size={22} color={colors.neutral[0]} />
                </View>
                <Text style={[styles.title, isTablet && styles.titleTablet]}>
                  Comprobantes
                </Text>
              </View>
              <Text style={styles.subtitle}>
                Facturación electrónica SUNAT
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pagination.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Buscar por serie-número..."
                placeholderTextColor={colors.neutral[400]}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color={colors.neutral[400]} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.dateFilterButton, showDateFilters && styles.dateFilterButtonActive]}
              onPress={() => setShowDateFilters(!showDateFilters)}
            >
              <Ionicons
                name="calendar"
                size={20}
                color={showDateFilters ? colors.neutral[0] : colors.neutral[600]}
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Quick Filters - Tipo de Documento */}
        <View style={styles.quickFiltersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickFiltersContent}
          >
            {documentTypeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,
                  selectedDocumentType === option.value && styles.filterChipActive,
                ]}
                onPress={() => {
                  setSelectedDocumentType(option.value);
                  setPage(1);
                }}
              >
                <View style={[styles.filterDot, { backgroundColor: option.color }]} />
                <Text style={[
                  styles.filterChipText,
                  selectedDocumentType === option.value && styles.filterChipTextActive,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Quick Filters - Estado SUNAT */}
        <View style={styles.quickFiltersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickFiltersContent}
          >
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,
                  selectedStatus === option.value && styles.filterChipActive,
                ]}
                onPress={() => {
                  setSelectedStatus(option.value);
                  setPage(1);
                }}
              >
                <View style={[styles.filterDot, { backgroundColor: option.color }]} />
                <Text style={[
                  styles.filterChipText,
                  selectedStatus === option.value && styles.filterChipTextActive,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
                  placeholder="Seleccionar"
                  icon="calendar-outline"
                />
              </View>
              <View style={styles.datePickerWrapper}>
                <DatePickerButton
                  label="Fecha Final"
                  value={endDate}
                  onPress={() => setShowEndDatePicker(true)}
                  placeholder="Seleccionar"
                  icon="calendar-outline"
                />
              </View>
              {(startDate || endDate) && (
                <TouchableOpacity
                  style={styles.clearDateButton}
                  onPress={handleClearDateFilters}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={24} color={colors.danger[500]} />
                </TouchableOpacity>
              )}
            </View>
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
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: 16,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  // Header con gradiente
  headerGradient: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[0],
    letterSpacing: 0.3,
  },
  titleTablet: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginLeft: spacing[12],
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
  },
  searchIcon: {
    marginRight: spacing[2],
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: 15,
    color: colors.neutral[800],
  },
  searchInputTablet: {
    fontSize: 16,
    paddingVertical: spacing[3.5],
  },
  clearButton: {
    padding: spacing[1],
  },
  dateFilterButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFilterButtonActive: {
    backgroundColor: colors.accent[500],
  },
  // Quick filters
  quickFiltersContainer: {
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  quickFiltersContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing[1.5],
  },
  filterChipActive: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.neutral[600],
  },
  filterChipTextActive: {
    color: colors.neutral[0],
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  clearDateButton: {
    padding: spacing[2],
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFiltersPanel: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  dateRangePickers: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'center',
  },
  datePickerWrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4],
  },
  contentContainerTablet: {
    padding: spacing[6],
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
    overflow: 'hidden',
  },
  cardTablet: {
    borderRadius: borderRadius['2xl'],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    backgroundColor: colors.neutral[50],
  },
  cardHeaderLeft: {
    flex: 1,
    gap: spacing[2],
  },
  documentTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
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
    color: colors.neutral[800],
  },
  serieNumeroTablet: {
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardBody: {
    padding: spacing[4],
    gap: spacing[2],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: colors.neutral[500],
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
    color: colors.neutral[800],
    fontWeight: '600',
  },
  infoValueTablet: {
    fontSize: 16,
  },
  totalAmount: {
    color: colors.success[600],
    fontSize: 16,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    backgroundColor: colors.neutral[50],
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    minWidth: 40,
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  refreshButton: {
    backgroundColor: colors.primary[600],
  },
  pdfButton: {
    backgroundColor: colors.danger[500],
  },
  xmlButton: {
    backgroundColor: colors.warning[500],
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[20],
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  emptyIconTablet: {
    fontSize: 80,
  },
  emptyText: {
    fontSize: 18,
    color: colors.neutral[700],
    marginBottom: spacing[2],
    fontWeight: '600',
  },
  emptyTextTablet: {
    fontSize: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  emptySubtextTablet: {
    fontSize: 16,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    marginTop: spacing[5],
    gap: spacing[2],
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  bottomSpacer: {
    height: 100,
  },
  paginationContainer: {
    backgroundColor: colors.primary[900],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
    marginBottom: 60,
  },
  paginationInfo: {
    alignItems: 'center',
    minWidth: 100,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  paginationSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: spacing[0.5],
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    minWidth: 110,
    justifyContent: 'center',
    gap: spacing[1],
  },
  paginationButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  paginationButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
});
