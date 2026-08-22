import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Alert from '@/utils/alert';
import { saveAndShareFile } from '@/utils/fileDownload';

import { DatePicker, DatePickerButton } from '@/components/DatePicker';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { PleSunatReportModal } from '@/components/Bizlinks/PleSunatReportModal';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useBizlinksDocuments } from '@/hooks/useBizlinks';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore } from '@/store/auth';
import {
  BizlinksDocumentArtifact,
  BizlinksDocumentListItem,
  BizlinksDocumentsMeta,
  GetBizlinksDocumentsParams,
} from '@/types/bizlinks';
import { config } from '@/utils/config';
import { formatDateToString } from '@/utils/dateHelpers';
import { spacing, borderRadius } from '@/design-system/tokens';
import { Pagination } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

type Props = NativeStackScreenProps<any, 'BizlinksDocuments'>;

type ArtifactKind = 'pdf' | 'xml' | 'cdr';
type AvailabilityFilter = 'ALL' | 'WITH_PDF' | 'WITH_XML' | 'WITH_CDR' | 'WITHOUT_PDF';

type PaginationState = BizlinksDocumentsMeta;

const DEFAULT_LIMIT = 20;

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
  '01': '#3B82F6',
  '03': '#10B981',
  '07': '#F59E0B',
  '08': '#EF4444',
  '09': '#8B5CF6',
  '31': '#6366F1',
  '20': '#EC4899',
  '40': '#14B8A6',
};

const STATUS_SUNAT_COLORS: Record<string, string> = {
  AC_03: '#10B981',
  RC_05: '#EF4444',
  PE_02: '#F59E0B',
  ED_06: '#F97316',
  SIGNED: '#3B82F6',
  PENDIENTE_ENVIO: '#94A3B8',
  PENDIENTE_RESPUESTA: '#F59E0B',
  ACEPTADO: '#10B981',
  RECHAZADO: '#EF4444',
  ANULADO: '#64748B',
  FAILED: '#DC2626',
};

const STATUS_LABELS: Record<string, string> = {
  AC_03: 'Aceptado SUNAT',
  RC_05: 'Rechazado SUNAT',
  PE_02: 'Pendiente',
  ED_06: 'Error envío',
  SIGNED: 'Firmado',
  ACCEPTED: 'Aceptado',
  REJECTED: 'Rechazado',
  ERROR: 'Error',
  QUEUED: 'En cola',
  SENDING: 'Enviando',
  FAILED: 'Fallido',
};

const isDocumentFailed = (document: BizlinksDocumentListItem): boolean => {
  const status = String(document.status || '').toUpperCase();
  return status === 'FAILED';
};

const documentTypeOptions = [
  { value: 'ALL', label: 'Todos', color: '#6366F1' },
  { value: '01', label: 'Facturas', color: DOCUMENT_TYPE_COLORS['01'] },
  { value: '03', label: 'Boletas', color: DOCUMENT_TYPE_COLORS['03'] },
  { value: '07', label: 'N. Crédito', color: DOCUMENT_TYPE_COLORS['07'] },
  { value: '08', label: 'N. Débito', color: DOCUMENT_TYPE_COLORS['08'] },
  { value: '09', label: 'Guías', color: DOCUMENT_TYPE_COLORS['09'] },
];

// Nota: el valor 'FAILED' filtra por el campo general `status` (no por statusSunat).
// El resto filtra por `statusSunat`. El distingo se hace en buildParams.
const sunatStatusOptions = [
  { value: 'ALL', label: 'Todos', color: '#6366F1' },
  { value: 'AC_03', label: 'Aceptados', color: STATUS_SUNAT_COLORS.AC_03 },
  { value: 'RC_05', label: 'Rechazados', color: STATUS_SUNAT_COLORS.RC_05 },
  { value: 'PE_02', label: 'Pendientes', color: STATUS_SUNAT_COLORS.PE_02 },
  { value: 'ED_06', label: 'Errores', color: STATUS_SUNAT_COLORS.ED_06 },
  { value: 'FAILED', label: 'Fallidos', color: STATUS_SUNAT_COLORS.FAILED },
];

const availabilityOptions: {
  value: AvailabilityFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'ALL', label: 'Todos', icon: 'albums-outline' },
  { value: 'WITH_PDF', label: 'Con PDF', icon: 'document-text-outline' },
  { value: 'WITH_XML', label: 'Con XML', icon: 'code-slash-outline' },
  { value: 'WITH_CDR', label: 'Con CDR', icon: 'archive-outline' },
  { value: 'WITHOUT_PDF', label: 'Sin PDF', icon: 'document-outline' },
];

const sortOptions: {
  value: NonNullable<GetBizlinksDocumentsParams['sortBy']>;
  label: string;
}[] = [
  { value: 'createdAt', label: 'Registro' },
  { value: 'fecha', label: 'Emisión' },
  { value: 'serieNumero', label: 'Serie' },
  { value: 'total', label: 'Total' },
];

const initialPagination: PaginationState = {
  total: 0,
  page: 1,
  limit: DEFAULT_LIMIT,
  offset: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
  sortBy: 'createdAt',
  sortOrder: 'DESC',
};

export const BizlinksDocumentsScreen: React.FC<Props> = ({ navigation }) => {
  const { currentCompany, currentSite, token } = useAuthStore();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [selectedDocumentType, setSelectedDocumentType] = useState('ALL');
  const [selectedStatusSunat, setSelectedStatusSunat] = useState('ALL');
  const [selectedAvailability, setSelectedAvailability] = useState<AvailabilityFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [sortBy, setSortBy] =
    useState<NonNullable<GetBizlinksDocumentsParams['sortBy']>>('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [documents, setDocuments] = useState<BizlinksDocumentListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationState>(initialPagination);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showRegistroVentasPleModal, setShowRegistroVentasPleModal] = useState(false);
  const [showKardexPleModal, setShowKardexPleModal] = useState(false);
  const [showKardexDetalladoModal, setShowKardexDetalladoModal] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm.trim(), 500);
  const { getDocuments, retryDocument } = useBizlinksDocuments();

  const activeFiltersCount = useMemo(() => {
    return [
      selectedDocumentType !== 'ALL',
      selectedStatusSunat !== 'ALL',
      selectedAvailability !== 'ALL',
      !!debouncedSearchTerm,
      !!fromDate,
      !!toDate,
    ].filter(Boolean).length;
  }, [
    debouncedSearchTerm,
    fromDate,
    selectedAvailability,
    selectedDocumentType,
    selectedStatusSunat,
    toDate,
  ]);

  const buildParams = useCallback((): GetBizlinksDocumentsParams => {
    const params: GetBizlinksDocumentsParams = {
      page,
      limit,
      sortBy,
      sortOrder,
      companyId: currentCompany?.id,
      siteId: currentSite?.id,
    };

    if (selectedDocumentType !== 'ALL') {
      params.documentType = selectedDocumentType;
    }

    if (selectedStatusSunat === 'FAILED') {
      // FAILED no es un statusSunat, va por el status general del documento
      params.status = 'FAILED';
    } else if (selectedStatusSunat !== 'ALL') {
      params.statusSunat = selectedStatusSunat;
    }

    if (debouncedSearchTerm) {
      params.search = debouncedSearchTerm;
    }

    if (fromDate) {
      params.fromDate = fromDate;
    }

    if (toDate) {
      params.toDate = toDate;
    }

    if (selectedAvailability === 'WITH_PDF') {
      params.hasPdf = true;
    } else if (selectedAvailability === 'WITHOUT_PDF') {
      params.hasPdf = false;
    } else if (selectedAvailability === 'WITH_XML') {
      params.hasXml = true;
    } else if (selectedAvailability === 'WITH_CDR') {
      params.hasCdr = true;
    }

    return params;
  }, [
    currentCompany?.id,
    currentSite?.id,
    debouncedSearchTerm,
    fromDate,
    limit,
    page,
    selectedAvailability,
    selectedDocumentType,
    selectedStatusSunat,
    sortBy,
    sortOrder,
    toDate,
  ]);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getDocuments(buildParams());
      setDocuments(response.items || []);
      setPagination(response.meta || initialPagination);
    } catch (error) {
      console.error('Error loading tax documents:', error);
      Alert.alert('Error', 'No se pudieron cargar los documentos tributarios');
    } finally {
      setLoading(false);
    }
  }, [buildParams, getDocuments]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useFocusEffect(
    useCallback(() => {
      void loadDocuments();
    }, [loadDocuments])
  );

  const resetToFirstPage = useCallback(() => {
    setPage(1);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await loadDocuments();
    setRefreshing(false);
  }, [loadDocuments]);

  const handlePreviousPage = useCallback(() => {
    if (pagination.hasPreviousPage || page > 1) {
      setPage((current) => Math.max(current - 1, 1));
    }
  }, [page, pagination.hasPreviousPage]);

  const handleNextPage = useCallback(() => {
    if (pagination.hasNextPage || page < pagination.totalPages) {
      setPage((current) => current + 1);
    }
  }, [page, pagination.hasNextPage, pagination.totalPages]);

  const handleClearFilters = useCallback(() => {
    setSelectedDocumentType('ALL');
    setSelectedStatusSunat('ALL');
    setSelectedAvailability('ALL');
    setSearchTerm('');
    setFromDate('');
    setToDate('');
    setPage(1);
  }, []);

  const handleFromDateConfirm = useCallback((date: Date) => {
    setFromDate(formatDateToString(date));
    setShowFromDatePicker(false);
    setPage(1);
  }, []);

  const handleToDateConfirm = useCallback((date: Date) => {
    setToDate(formatDateToString(date));
    setShowToDatePicker(false);
    setPage(1);
  }, []);

  const getDocumentTypeCode = (document: BizlinksDocumentListItem) =>
    document.tipo?.code || document.documentType || 'OTRO';

  const getDocumentTypeName = (document: BizlinksDocumentListItem) => {
    const code = getDocumentTypeCode(document);
    return document.tipo?.name || DOCUMENT_TYPE_LABELS[code] || String(code);
  };

  const getStatusCode = (document: BizlinksDocumentListItem) =>
    document.estadoSunat?.code || document.statusSunat || document.status || 'PENDIENTE';

  const getStatusLabel = (document: BizlinksDocumentListItem) => {
    const code = String(getStatusCode(document));
    return STATUS_LABELS[code] || code;
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount?: number, currency = 'PEN') => {
    if (amount === null || amount === undefined) return '-';

    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const buildDownloadUrl = (document: BizlinksDocumentListItem, artifactKind: ArtifactKind) => {
    const artifact = document[artifactKind] as BizlinksDocumentArtifact | undefined;
    const candidateUrl =
      artifact?.downloadUrl ||
      artifact?.url ||
      `/bizlinks/documents/${document.id}/${artifactKind}`;

    if (candidateUrl.startsWith('http')) {
      return candidateUrl;
    }

    const baseUrl = config.API_URL.replace(/\/$/, '');
    const path = candidateUrl.startsWith('/') ? candidateUrl : `/${candidateUrl}`;
    return `${baseUrl}${path}`;
  };

  const buildAuthHeaders = () => {
    const headers: Record<string, string> = {
      'X-App-Id': config.APP_ID,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (currentCompany?.id) {
      headers['X-Company-Id'] = currentCompany.id;
    }
    if (currentSite?.id) {
      headers['X-Site-Id'] = currentSite.id;
    }

    return headers;
  };

  const handleDownloadArtifact = async (
    document: BizlinksDocumentListItem,
    artifactKind: ArtifactKind,
    mimeType: string,
    event: any
  ) => {
    event.stopPropagation();

    const artifact = document[artifactKind] as BizlinksDocumentArtifact | undefined;
    if (artifact && !artifact.available) {
      Alert.alert(
        'Archivo no disponible',
        `El ${artifactKind.toUpperCase()} aún no está disponible para este documento.`
      );
      return;
    }

    const downloadKey = `${document.id}-${artifactKind}`;
    setDownloadingKey(downloadKey);

    try {
      const downloadUrl = buildDownloadUrl(document, artifactKind);
      const fileName = `${document.serieNumero || document.id}.${artifactKind}`;

      // Descargar con headers de auth (funciona en web/electron y móvil)
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: buildAuthHeaders(),
      });

      if (!response.ok) {
        Alert.alert('Error', `Error del servidor: ${response.status}`);
        return;
      }

      const blob = await response.blob();

      await saveAndShareFile({
        blob,
        fileName,
        mimeType,
        dialogTitle: `${artifactKind.toUpperCase()} ${document.serieNumero}`,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || `Error al descargar ${artifactKind.toUpperCase()}`);
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleDocumentPress = (document: BizlinksDocumentListItem) => {
    navigation.navigate('BizlinksDocumentDetail', { documentId: document.id });
  };

  const handleRetryDocument = (document: BizlinksDocumentListItem, event: any) => {
    event?.stopPropagation?.();

    const serie = document.serieNumero || `${document.serie || ''}-${document.numero || ''}`;
    Alert.alert(
      'Reintentar documento',
      `¿Deseas reintentar el envío de ${serie}? Se reseteará el contador y se re-encolará la tarea fiscal.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reintentar',
          onPress: async () => {
            try {
              setRetryingId(document.id);
              await retryDocument(document.id);
              Alert.alert(
                'Reintento encolado',
                'El documento se re-encoló. El scheduler lo procesará en el próximo ciclo (~30s).'
              );
              await loadDocuments();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error?.response?.data?.message ||
                  error?.message ||
                  'No se pudo reintentar el documento'
              );
            } finally {
              setRetryingId(null);
            }
          },
        },
      ]
    );
  };

  const handleOpenRegistroVentas = useCallback(() => {
    setShowRegistroVentasPleModal(true);
  }, []);

  const handleOpenKardexExport = useCallback(() => {
    setShowKardexPleModal(true);
  }, []);

  const handleOpenKardexDetallado = useCallback(() => {
    setShowKardexDetalladoModal(true);
  }, []);

  const renderFilterChip = (
    option: { value: string; label: string; color?: string; icon?: keyof typeof Ionicons.glyphMap },
    selectedValue: string,
    onSelect: (value: string) => void
  ) => (
    <TouchableOpacity
      key={option.value}
      style={[styles.filterChip, selectedValue === option.value && styles.filterChipActive]}
      onPress={() => {
        onSelect(option.value);
        resetToFirstPage();
      }}
    >
      {option.icon ? (
        <Ionicons
          name={option.icon}
          size={14}
          color={selectedValue === option.value ? theme.color.text.inverse : theme.color.text.muted}
        />
      ) : (
        <View
          style={[styles.filterDot, { backgroundColor: option.color || theme.color.brand.accent }]}
        />
      )}
      <Text
        style={[
          styles.filterChipText,
          selectedValue === option.value && styles.filterChipTextActive,
        ]}
      >
        {option.label}
      </Text>
    </TouchableOpacity>
  );

  const renderArtifactButton = (
    document: BizlinksDocumentListItem,
    artifactKind: ArtifactKind,
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    buttonStyle: any,
    mimeType: string
  ) => {
    const artifact = document[artifactKind] as BizlinksDocumentArtifact | undefined;
    const available = artifact?.available || !!artifact?.downloadUrl || !!artifact?.url;
    const isDownloading = downloadingKey === `${document.id}-${artifactKind}`;

    return (
      <TouchableOpacity
        style={[
          styles.actionButton,
          buttonStyle,
          (!available || isDownloading) && styles.actionButtonDisabled,
        ]}
        onPress={(event) => handleDownloadArtifact(document, artifactKind, mimeType, event)}
        disabled={!available || isDownloading}
      >
        {isDownloading ? (
          <ActivityIndicator size="small" color={theme.color.text.inverse} />
        ) : (
          <>
            <Ionicons name={icon} size={16} color={theme.color.text.inverse} />
            <Text style={styles.actionButtonText}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderDocumentCard = (document: BizlinksDocumentListItem) => {
    const documentTypeCode = String(getDocumentTypeCode(document));
    const documentTypeColor = DOCUMENT_TYPE_COLORS[documentTypeCode] || '#6B7280';
    const statusCode = String(getStatusCode(document));
    const statusColor = STATUS_SUNAT_COLORS[statusCode] || '#64748B';
    const sunatMessage = document.estadoSunat?.message?.mensaje || document.messageSunat?.mensaje;

    return (
      <TouchableOpacity
        key={document.id}
        style={[styles.card, isTablet && styles.cardTablet]}
        onPress={() => handleDocumentPress(document)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[
                styles.documentTypeBadge,
                { backgroundColor: `${documentTypeColor}20`, borderColor: documentTypeColor },
              ]}
            >
              <Text style={[styles.documentTypeText, { color: documentTypeColor }]}>
                {getDocumentTypeName(document)}
              </Text>
            </View>
            <Text style={[styles.serieNumero, isTablet && styles.serieNumeroTablet]}>
              {document.serieNumero || `${document.serie || ''}-${document.numero || ''}`}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${statusColor}20`, borderColor: statusColor },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(document)}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Cliente:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]} numberOfLines={1}>
              {document.cliente || document.razonSocialAdquiriente || '-'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>DNI/RUC:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {document.dniRuc || document.numeroDocumentoAdquiriente || '-'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Total:</Text>
            <Text
              style={[styles.infoValue, styles.totalAmount, isTablet && styles.infoValueTablet]}
            >
              {formatCurrency(
                document.total ?? document.totalVenta,
                document.moneda || String(document.tipoMoneda || 'PEN')
              )}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Emisión:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {formatDate(document.fecha || document.fechaEmision)}
            </Text>
          </View>

          {!!sunatMessage && (
            <View style={styles.messageBox}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={theme.color.icon.muted}
              />
              <Text style={styles.messageText} numberOfLines={2}>
                {sunatMessage}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.cardActions}>
            {renderArtifactButton(
              document,
              'pdf',
              'PDF',
              'document-text',
              styles.pdfButton,
              'application/pdf'
            )}
            {renderArtifactButton(
              document,
              'xml',
              'XML',
              'code-slash',
              styles.xmlButton,
              'application/xml'
            )}
            {renderArtifactButton(
              document,
              'cdr',
              'CDR',
              'archive',
              styles.cdrButton,
              'application/zip'
            )}
            {isDocumentFailed(document) && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.retryButton,
                  retryingId === document.id && styles.actionButtonDisabled,
                ]}
                onPress={(event) => handleRetryDocument(document, event)}
                disabled={retryingId === document.id}
              >
                {retryingId === document.id ? (
                  <ActivityIndicator size="small" color={theme.color.text.inverse} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={16} color={theme.color.text.inverse} />
                    <Text style={styles.actionButtonText}>Reintentar</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <Ionicons name="chevron-forward" size={20} color={theme.color.icon.disabled} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing && documents.length === 0) {
    return (
      <ScreenLayout navigation={navigation as any}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
            <Text style={styles.loadingText}>Cargando documentos tributarios...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="documents" size={22} color={theme.color.brand.onHeader} />
                </View>
                <Text style={[styles.title, isTablet && styles.titleTablet]}>
                  Documentos Tributarios
                </Text>
              </View>
              <Text style={styles.subtitle}>Consulta de comprobantes electrónicos SUNAT</Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pagination.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons
                name="search"
                size={20}
                color={theme.color.icon.disabled}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                value={searchTerm}
                onChangeText={(value) => {
                  setSearchTerm(value);
                  setPage(1);
                }}
                placeholder="Buscar por serie, cliente, DNI/RUC..."
                placeholderTextColor={theme.color.text.placeholder}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color={theme.color.icon.disabled} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.filterButton, showAdvancedFilters && styles.filterButtonActive]}
              onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Ionicons
                name="options"
                size={20}
                color={showAdvancedFilters ? theme.color.brand.onHeader : theme.color.text.muted}
              />
              {activeFiltersCount > 0 && (
                <View style={styles.filterCounter}>
                  <Text style={styles.filterCounterText}>{activeFiltersCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.quickFiltersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickFiltersContent}
          >
            {documentTypeOptions.map((option) =>
              renderFilterChip(option, selectedDocumentType, setSelectedDocumentType)
            )}
          </ScrollView>
        </View>

        <View style={styles.quickFiltersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickFiltersContent}
          >
            {sunatStatusOptions.map((option) =>
              renderFilterChip(option, selectedStatusSunat, setSelectedStatusSunat)
            )}
          </ScrollView>
        </View>

        {showAdvancedFilters && (
          <View style={styles.advancedFiltersPanel}>
            <Text style={styles.filterSectionTitle}>Archivos disponibles</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.availabilityContent}
            >
              {availabilityOptions.map((option) =>
                renderFilterChip(option, selectedAvailability, (value) =>
                  setSelectedAvailability(value as AvailabilityFilter)
                )
              )}
            </ScrollView>

            <View style={styles.dateRangePickers}>
              <View style={styles.datePickerWrapper}>
                <DatePickerButton
                  label="Desde creación"
                  value={fromDate}
                  onPress={() => setShowFromDatePicker(true)}
                  placeholder="Seleccionar"
                  icon="calendar-outline"
                />
              </View>
              <View style={styles.datePickerWrapper}>
                <DatePickerButton
                  label="Hasta creación"
                  value={toDate}
                  onPress={() => setShowToDatePicker(true)}
                  placeholder="Seleccionar"
                  icon="calendar-outline"
                />
              </View>
            </View>

            <View style={styles.sortRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sortOptionsContent}
              >
                {sortOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.sortChip, sortBy === option.value && styles.sortChipActive]}
                    onPress={() => {
                      setSortBy(option.value);
                      setPage(1);
                    }}
                  >
                    <Text
                      style={[
                        styles.sortChipText,
                        sortBy === option.value && styles.sortChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.sortOrderButton}
                onPress={() => {
                  setSortOrder((current) => (current === 'DESC' ? 'ASC' : 'DESC'));
                  setPage(1);
                }}
              >
                <Ionicons
                  name={sortOrder === 'DESC' ? 'arrow-down' : 'arrow-up'}
                  size={16}
                  color={theme.color.brand.accent}
                />
                <Text style={styles.sortOrderText}>{sortOrder}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.advancedFooter}>
              <TouchableOpacity
                style={styles.limitButton}
                onPress={() =>
                  setLimit((current) => (current === 20 ? 50 : current === 50 ? 100 : 20))
                }
              >
                <Ionicons name="list-outline" size={16} color={theme.color.icon.default} />
                <Text style={styles.limitButtonText}>{limit} por página</Text>
              </TouchableOpacity>

              {activeFiltersCount > 0 && (
                <TouchableOpacity style={styles.clearFiltersButton} onPress={handleClearFilters}>
                  <Ionicons name="close-circle" size={18} color={theme.color.icon.danger} />
                  <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            isTablet && styles.contentContainerTablet,
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {loading && documents.length > 0 && (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={theme.color.brand.accent} />
              <Text style={styles.inlineLoadingText}>Actualizando...</Text>
            </View>
          )}

          {documents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyIcon, isTablet && styles.emptyIconTablet]}>📄</Text>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay documentos tributarios
              </Text>
              <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                Ajusta los filtros o intenta actualizar la consulta
              </Text>
            </View>
          ) : (
            documents.map(renderDocumentCard)
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {pagination.total > 0 && (
          <Pagination
            currentPage={page}
            totalPages={pagination.totalPages || 1}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={setPage}
            loading={loading}
          />
        )}

        <DatePicker
          visible={showFromDatePicker}
          date={fromDate ? new Date(fromDate) : new Date()}
          onConfirm={handleFromDateConfirm}
          onCancel={() => setShowFromDatePicker(false)}
          title="Seleccionar Fecha Inicial"
        />

        <DatePicker
          visible={showToDatePicker}
          date={toDate ? new Date(toDate) : new Date()}
          onConfirm={handleToDateConfirm}
          onCancel={() => setShowToDatePicker(false)}
          title="Seleccionar Fecha Final"
        />

        <PleSunatReportModal
          visible={showRegistroVentasPleModal}
          onClose={() => setShowRegistroVentasPleModal(false)}
          libro="14.1"
        />

        <PleSunatReportModal
          visible={showKardexPleModal}
          onClose={() => setShowKardexPleModal(false)}
          libro="12.1"
        />

        <PleSunatReportModal
          visible={showKardexDetalladoModal}
          onClose={() => setShowKardexDetalladoModal(false)}
          libro="12.1-detallado"
        />

        <ProtectedFAB
          actions={[
            {
              icon: 'receipt-outline',
              label: 'Registro de Ventas 14.1',
              onPress: handleOpenRegistroVentas,
              requiredPermissions: ['bizlinks.documents.view', 'sales.read'],
            },
            {
              icon: 'cube-outline',
              label: 'Kardex 12.1 (Salidas)',
              onPress: handleOpenKardexExport,
              requiredPermissions: ['bizlinks.documents.view', 'inventory.read'],
            },
            {
              icon: 'list-outline',
              label: 'Kardex 12.1 Detallado',
              onPress: handleOpenKardexDetallado,
              requiredPermissions: ['bizlinks.documents.view', 'inventory.read'],
            },
          ]}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: spacing[4],
      fontSize: 16,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
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
      gap: spacing[3],
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
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing[3],
    },
    title: {
      flex: 1,
      fontSize: 22,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
      letterSpacing: 0.3,
    },
    titleTablet: {
      fontSize: 28,
    },
    subtitle: {
      fontSize: 14,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      marginLeft: spacing[12],
    },
    statsContainer: {
      alignItems: 'flex-end',
    },
    statItem: {
      alignItems: 'center',
      backgroundColor: theme.color.brand.headerBadge,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.lg,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
    },
    statLabel: {
      fontSize: 11,
      color: theme.color.brand.onHeaderMuted,
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
      backgroundColor: theme.color.surface.base,
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
      color: theme.color.text.heading,
    },
    searchInputTablet: {
      fontSize: 16,
      paddingVertical: spacing[3.5],
    },
    clearButton: {
      padding: spacing[1],
    },
    filterButton: {
      width: 48,
      height: 48,
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterButtonActive: {
      backgroundColor: theme.color.brand.accent,
    },
    filterCounter: {
      position: 'absolute',
      top: 5,
      right: 5,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.color.action.danger.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    filterCounterText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
    quickFiltersContainer: {
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
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
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: spacing[1.5],
    },
    filterChipActive: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.color.text.muted,
    },
    filterChipTextActive: {
      color: theme.color.text.inverse,
    },
    filterDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    advancedFiltersPanel: {
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: spacing[3],
    },
    filterSectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.muted,
      textTransform: 'uppercase',
    },
    availabilityContent: {
      gap: spacing[2],
      flexDirection: 'row',
      alignItems: 'center',
    },
    dateRangePickers: {
      flexDirection: 'row',
      gap: spacing[3],
      alignItems: 'center',
    },
    datePickerWrapper: {
      flex: 1,
    },
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    sortOptionsContent: {
      gap: spacing[2],
    },
    sortChip: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    sortChipActive: {
      backgroundColor: theme.color.brand.accentSoft,
      borderColor: theme.color.brand.accent,
    },
    sortChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    sortChipTextActive: {
      color: theme.color.brand.accent,
    },
    sortOrderButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.brand.accentSoft,
    },
    sortOrderText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    advancedFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[3],
    },
    limitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1.5],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.surface.muted,
    },
    limitButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    clearFiltersButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1.5],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    clearFiltersText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.danger,
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
    inlineLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: spacing[2],
      marginBottom: spacing[3],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.surface.base,
    },
    inlineLoadingText: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius['2xl'],
      marginBottom: spacing[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      ...theme.shadow.sm,
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
      borderBottomColor: theme.color.background.muted,
      backgroundColor: theme.color.background.subtle,
      gap: spacing[3],
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
      color: theme.color.text.heading,
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
      color: theme.color.text.subtle,
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
      color: theme.color.text.heading,
      fontWeight: '600',
    },
    infoValueTablet: {
      fontSize: 16,
    },
    totalAmount: {
      color: theme.color.text.success,
      fontSize: 16,
      fontWeight: '700',
    },
    messageBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
      marginTop: spacing[2],
      padding: spacing[2.5],
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.background.subtle,
    },
    messageText: {
      flex: 1,
      fontSize: 12,
      color: theme.color.text.muted,
      lineHeight: 17,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing[4],
      paddingTop: spacing[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.background.muted,
      backgroundColor: theme.color.background.subtle,
    },
    cardActions: {
      flexDirection: 'row',
      gap: spacing[2],
      flexWrap: 'wrap',
      flex: 1,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.lg,
      minWidth: 52,
      justifyContent: 'center',
    },
    actionButtonDisabled: {
      opacity: 0.45,
    },
    pdfButton: {
      backgroundColor: theme.color.action.danger.background,
    },
    xmlButton: {
      backgroundColor: theme.color.icon.warning,
    },
    cdrButton: {
      backgroundColor: theme.color.brand.accent,
    },
    retryButton: {
      backgroundColor: theme.color.action.danger.backgroundHover,
    },
    actionButtonText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: spacing[20],
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
      color: theme.color.text.body,
      marginBottom: spacing[2],
      fontWeight: '600',
    },
    emptyTextTablet: {
      fontSize: 20,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
    },
    emptySubtextTablet: {
      fontSize: 16,
    },
    bottomSpacer: {
      height: 100,
    },
    paginationContainer: {
      backgroundColor: theme.color.brand.primary,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[4],
    },
    paginationInfo: {
      alignItems: 'center',
      minWidth: 120,
    },
    paginationText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.brand.onHeader,
    },
    paginationSubtext: {
      fontSize: 12,
      color: theme.color.brand.onHeaderMuted,
      marginTop: spacing[0.5],
    },
    paginationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[2.5],
      paddingHorizontal: spacing[4],
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.brand.headerBadge,
      minWidth: 110,
      justifyContent: 'center',
    },
    paginationButtonDisabled: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    paginationButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.brand.onHeader,
    },
    paginationButtonTextDisabled: {
      color: theme.color.brand.headerBorder,
    },
  });
