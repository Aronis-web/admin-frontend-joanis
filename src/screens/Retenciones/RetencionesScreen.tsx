import React, { useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/auth';
import { bizlinksApi } from '@/services/api/bizlinks';
import { Retencion, GetRetencionesParams } from '@/types/bizlinks';
import { formatDateToString } from '@/utils/dateHelpers';
import { SearchBar } from '@/components/common/SearchBar';
import { useDebounce } from '@/hooks/useDebounce';

type Props = NativeStackScreenProps<any, 'Retenciones'>;

const STATUS_COLORS: Record<string, string> = {
  QUEUED: '#94A3B8',
  SENDING: '#F59E0B',
  SENT: '#3B82F6',
  ACCEPTED: '#10B981',
  REJECTED: '#EF4444',
  ERROR: '#DC2626',
};

const STATUS_LABELS: Record<string, string> = {
  QUEUED: 'En Cola',
  SENDING: 'Enviando',
  SENT: 'Enviado',
  ACCEPTED: 'Aceptado',
  REJECTED: 'Rechazado',
  ERROR: 'Error',
};

export const RetencionesScreen: React.FC<Props> = ({ navigation }) => {
  const { currentCompany, currentSite } = useAuthStore();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Estados
  const [retenciones, setRetenciones] = useState<Retencion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Helper para obtener valores numéricos seguros
  const getSafeNumber = (value: number | undefined, defaultValue: number = 0): number => {
    return typeof value === 'number' ? value : defaultValue;
  };

  // Helper para parsear datos del XML
  const parseXmlData = (xml: string, tag: string): string | null => {
    const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
  };

  const parseXmlNumber = (xml: string, tag: string): number => {
    const value = parseXmlData(xml, tag);
    return value ? parseFloat(value) : 0;
  };

  // Helper para enriquecer datos de la retención con datos del XML
  const enrichRetencionData = (retencion: Retencion): Retencion => {
    if (!retencion.payloadXml) return retencion;

    const xml = retencion.payloadXml;

    // Parsear datos del proveedor si no están presentes
    if (!retencion.razonSocialProveedor) {
      retencion.razonSocialProveedor = parseXmlData(xml, 'razonSocialProveedor') || undefined;
    }
    if (!retencion.numeroDocumentoProveedor) {
      retencion.numeroDocumentoProveedor = parseXmlData(xml, 'numeroDocumentoProveedor') || undefined;
    }
    if (!retencion.direccionProveedor) {
      retencion.direccionProveedor = parseXmlData(xml, 'direccionProveedor') || undefined;
    }

    // Parsear datos numéricos si no están presentes
    if (!retencion.tasaRetencion) {
      retencion.tasaRetencion = parseXmlNumber(xml, 'tasaRetencion');
    }
    if (!retencion.importeTotalRetenido) {
      retencion.importeTotalRetenido = parseXmlNumber(xml, 'importeTotalRetenido');
    }
    if (!retencion.importeTotalPagado) {
      retencion.importeTotalPagado = parseXmlNumber(xml, 'importeTotalPagado');
    }
    if (!retencion.tipoMoneda) {
      retencion.tipoMoneda = (parseXmlData(xml, 'tipoMonedaTotalPagado') as 'PEN' | 'USD') || 'PEN';
    }
    if (!retencion.regimenRetencion) {
      retencion.regimenRetencion = parseXmlData(xml, 'regimenRetencion') || undefined;
    }

    return retencion;
  };

  // Cargar retenciones
  const loadRetenciones = useCallback(async () => {
    if (!currentCompany || !currentSite) return;

    try {
      setLoading(true);
      console.log('🔄 Loading retenciones...');
      const params: GetRetencionesParams = {
        companyId: currentCompany.id,
        siteId: currentSite.id,
        limit: 100,
      };

      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }

      if (debouncedSearchTerm) {
        params.numeroDocumentoProveedor = debouncedSearchTerm;
      }

      const data = await bizlinksApi.getRetenciones(params);
      console.log(`📦 Received ${data.length} retenciones from API`);

      // Enriquecer cada retención con datos del XML
      const enrichedData = data.map((retencion, index) => {
        const enriched = enrichRetencionData(retencion);
        console.log(`✨ Enriched retencion ${index + 1}/${data.length}:`, {
          serieNumero: enriched.serieNumero,
          razonSocialProveedor: enriched.razonSocialProveedor,
          numeroDocumentoProveedor: enriched.numeroDocumentoProveedor,
          importeTotalRetenido: enriched.importeTotalRetenido,
          importeTotalPagado: enriched.importeTotalPagado,
          hasPayloadXml: !!enriched.payloadXml,
        });
        return enriched;
      });

      console.log('✅ All retenciones enriched successfully');
      setRetenciones(enrichedData);
    } catch (error: any) {
      console.error('❌ Error loading retenciones:', error);
      Alert.alert('Error', error.message || 'Error al cargar retenciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentCompany, currentSite, selectedStatus, debouncedSearchTerm]);

  // Cargar al montar y al hacer focus
  useFocusEffect(
    useCallback(() => {
      loadRetenciones();
    }, [loadRetenciones])
  );

  // Recargar cuando cambie el término de búsqueda
  useEffect(() => {
    if (!loading) {
      loadRetenciones();
    }
  }, [debouncedSearchTerm, selectedStatus]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRetenciones();
  };

  const handleCreateRetencion = () => {
    navigation.navigate('CreateRetencion');
  };

  const handleRetencionPress = (retencion: Retencion) => {
    navigation.navigate('RetencionDetail', { retencionId: retencion.id });
  };

  const renderRetencionCard = (retencion: Retencion) => {
    const statusColor = STATUS_COLORS[retencion.status] || '#6B7280';
    const statusLabel = STATUS_LABELS[retencion.status] || retencion.status;

    return (
      <TouchableOpacity
        key={retencion.id}
        style={styles.card}
        onPress={() => handleRetencionPress(retencion)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.documentTypeBadge, { backgroundColor: '#EC4899' }]}>
              <Text style={styles.documentTypeText}>RET</Text>
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.serieNumero}>{retencion.serieNumero}</Text>
              <Text style={styles.fechaEmision}>
                {formatDateToString(new Date(retencion.fechaEmision))}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: retencion.isReversed ? '#EF4444' : statusColor }]}>
            <Text style={styles.statusText}>{retencion.isReversed ? 'ANULADA' : statusLabel}</Text>
          </View>
        </View>

        {retencion.isReversed && (
          <View style={styles.reversedBanner}>
            <Ionicons name="warning" size={16} color="#DC2626" />
            <Text style={styles.reversedBannerText}>
              Anulada - {retencion.reversalReason}
            </Text>
          </View>
        )}

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={16} color="#6B7280" />
            <Text style={styles.infoLabel}>Proveedor:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {retencion.proveedor?.razonSocialProveedor || retencion.razonSocialProveedor || '-'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={16} color="#6B7280" />
            <Text style={styles.infoLabel}>RUC:</Text>
            <Text style={styles.infoValue}>
              {retencion.proveedor?.numeroDocumentoProveedor || retencion.numeroDocumentoProveedor || '-'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={16} color="#6B7280" />
            <Text style={styles.infoLabel}>Documentos:</Text>
            <Text style={styles.infoValue}>{retencion.items?.length || 0}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Total Retenido:</Text>
            <Text style={styles.amountValue}>
              {retencion.tipoMoneda || 'PEN'} {getSafeNumber(retencion.importeTotalRetenido).toFixed(2)}
            </Text>
          </View>
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Total Pagado:</Text>
            <Text style={styles.amountValue}>
              {retencion.tipoMoneda || 'PEN'} {getSafeNumber(retencion.importeTotalPagado).toFixed(2)}
            </Text>
          </View>
        </View>

        {retencion.messageSunat && (
          <View style={styles.sunatMessage}>
            <Text style={styles.sunatMessageText}>
              {retencion.messageSunat.codigo}: {retencion.messageSunat.mensaje}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyStateTitle}>No hay retenciones</Text>
      <Text style={styles.emptyStateText}>
        Crea tu primera retención electrónica
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={handleCreateRetencion}>
        <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
        <Text style={styles.emptyButtonText}>Crear Retención</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Retenciones</Text>
          <TouchableOpacity onPress={handleCreateRetencion} style={styles.addButton}>
            <Ionicons name="add-circle" size={28} color="#8B5CF6" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <SearchBar
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Buscar por RUC del proveedor..."
        />

        {/* Status Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {['ALL', 'QUEUED', 'SENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'ERROR'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                selectedStatus === status && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedStatus === status && styles.filterButtonTextActive,
                ]}
              >
                {status === 'ALL' ? 'Todos' : STATUS_LABELS[status] || status}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Cargando retenciones...</Text>
          </View>
        ) : retenciones.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.list}>
            {retenciones.map(renderRetencionCard)}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      {!loading && retenciones.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={handleCreateRetencion}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    padding: 8,
  },
  filterContainer: {
    marginTop: 12,
  },
  filterContent: {
    paddingRight: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
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
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  documentTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardHeaderInfo: {
    flex: 1,
  },
  serieNumero: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  fechaEmision: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardBody: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  amountContainer: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  sunatMessage: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
  },
  sunatMessageText: {
    fontSize: 11,
    color: '#92400E',
  },
  reversedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  reversedBannerText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});
