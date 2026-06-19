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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/auth';
import { bizlinksApi } from '@/services/api/bizlinks';
import { Retencion, GetRetencionesParams } from '@/types/bizlinks';
import { formatDateToString } from '@/utils/dateHelpers';
import { useDebounce } from '@/hooks/useDebounce';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
      console.log('🔄 [RETENCIONES] Loading retenciones...', {
        timestamp: new Date().toISOString(),
        currentCompany: currentCompany.id,
        currentSite: currentSite.id,
        selectedStatus,
        debouncedSearchTerm,
      });
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
      console.log('👁️ [RETENCIONES] Screen focused - loading retenciones');
      loadRetenciones();
    }, [loadRetenciones])
  );

  // Recargar cuando cambie el término de búsqueda o el estado seleccionado
  // NOTA: Solo recargar si la pantalla ya está cargada (no en el primer render)
  useEffect(() => {
    // Skip en el primer render (loading será true)
    if (loading) {
      console.log('⏭️ [RETENCIONES] Skipping reload - still loading');
      return;
    }

    console.log('🔄 [RETENCIONES] Filter changed - reloading', {
      debouncedSearchTerm,
      selectedStatus,
    });
    loadRetenciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const statusColor = STATUS_COLORS[retencion.status] || theme.color.text.muted;
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
          <View style={[styles.statusBadge, { backgroundColor: retencion.isReversed ? theme.color.state.danger.border : statusColor }]}>
            <Text style={styles.statusText}>{retencion.isReversed ? 'ANULADA' : statusLabel}</Text>
          </View>
        </View>

        {retencion.isReversed && (
          <View style={styles.reversedBanner}>
            <Ionicons name="warning" size={16} color={theme.color.icon.danger} />
            <Text style={styles.reversedBannerText}>
              Anulada - {retencion.reversalReason}
            </Text>
          </View>
        )}

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={16} color={theme.color.icon.muted} />
            <Text style={styles.infoLabel}>Proveedor:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {retencion.proveedor?.razonSocialProveedor || retencion.razonSocialProveedor || '-'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={16} color={theme.color.icon.muted} />
            <Text style={styles.infoLabel}>RUC:</Text>
            <Text style={styles.infoValue}>
              {retencion.proveedor?.numeroDocumentoProveedor || retencion.numeroDocumentoProveedor || '-'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={16} color={theme.color.icon.muted} />
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
      <Ionicons name="document-text-outline" size={64} color={theme.color.icon.disabled} />
      <Text style={styles.emptyStateTitle}>No hay retenciones</Text>
      <Text style={styles.emptyStateText}>
        Crea tu primera retención electrónica
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={handleCreateRetencion}>
        <Ionicons name="add-circle-outline" size={20} color={theme.color.text.inverse} />
        <Text style={styles.emptyButtonText}>Crear Retención</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonGradient}>
              <Ionicons name="arrow-back" size={24} color={theme.color.text.inverse} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="receipt" size={22} color={theme.color.text.inverse} />
                </View>
                <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
                  Retenciones
                </Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Gestión de retenciones electrónicas
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{retenciones.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={theme.color.text.placeholder} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Buscar por RUC del proveedor..."
                placeholderTextColor={theme.color.text.placeholder}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color={theme.color.text.placeholder} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Quick Filters - Estado */}
        <View style={styles.quickFiltersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickFiltersContent}
          >
            {['ALL', 'QUEUED', 'SENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'ERROR'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterChip,
                  selectedStatus === status && styles.filterChipActive,
                ]}
                onPress={() => setSelectedStatus(status)}
              >
                <View style={[styles.filterDot, { backgroundColor: STATUS_COLORS[status] || theme.color.text.disabled }]} />
                <Text
                  style={[
                    styles.filterChipText,
                    selectedStatus === status && styles.filterChipTextActive,
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
            <ActivityIndicator size="large" color={theme.color.brand.primary} />
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
            <Ionicons name="add" size={28} color={theme.color.text.inverse} />
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  headerGradient: {
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[4],
    paddingBottom: theme.space[4],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.space[4],
  },
  backButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.text.inverse,
    letterSpacing: 0.3,
  },
  headerTitleTablet: {
    fontSize: 28,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    marginLeft: theme.space[12],
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: theme.color.brand.headerBadge,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.lg,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.inverse,
  },
  statLabel: {
    fontSize: 11,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.space[3],
  },
  searchIcon: {
    marginRight: theme.space[2],
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.space[3],
    fontSize: 15,
    color: theme.color.text.body,
  },
  searchInputTablet: {
    fontSize: 16,
    paddingVertical: theme.space[3.5],
  },
  clearButton: {
    padding: theme.space[1],
  },
  quickFiltersContainer: {
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  quickFiltersContent: {
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    gap: theme.space[2],
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1.5],
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.muted,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    gap: theme.space[1.5],
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.space[4],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.space[16],
  },
  loadingText: {
    marginTop: theme.space[3],
    fontSize: 14,
    color: theme.color.text.subtle,
    fontWeight: '500',
  },
  list: {
    gap: theme.space[3],
  },
  card: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii['2xl'],
    marginBottom: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    ...theme.shadow.sm,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.space[4],
    paddingBottom: theme.space[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    backgroundColor: theme.color.surface.subtle,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentTypeBadge: {
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.md,
    marginRight: theme.space[3],
  },
  documentTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.text.inverse,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  serieNumero: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.body,
  },
  fechaEmision: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginTop: theme.space[0.5],
  },
  statusBadge: {
    paddingHorizontal: theme.space[2.5],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.color.text.inverse,
  },
  cardBody: {
    padding: theme.space[4],
    gap: theme.space[2],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  infoLabel: {
    fontSize: 13,
    color: theme.color.text.subtle,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: theme.color.text.body,
    fontWeight: '600',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.space[4],
    paddingTop: theme.space[3],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
    backgroundColor: theme.color.surface.subtle,
  },
  amountContainer: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 11,
    color: theme.color.text.subtle,
    marginBottom: theme.space[0.5],
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.text.body,
  },
  sunatMessage: {
    marginTop: theme.space[3],
    padding: theme.space[2],
    backgroundColor: theme.color.state.warning.background,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.color.state.warning.border,
  },
  sunatMessageText: {
    fontSize: 11,
    color: theme.color.state.warning.text,
  },
  reversedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.state.danger.background,
    borderRadius: theme.radii.md,
    padding: theme.space[2],
    marginTop: theme.space[2],
    marginBottom: theme.space[2],
    gap: theme.space[2],
    borderWidth: 1,
    borderColor: theme.color.state.danger.border,
  },
  reversedBannerText: {
    fontSize: 12,
    color: theme.color.text.danger,
    fontWeight: '600',
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.space[16],
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.color.text.body,
    marginTop: theme.space[4],
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.color.text.subtle,
    marginTop: theme.space[2],
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.brand.primary,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.lg,
    marginTop: theme.space[6],
    gap: theme.space[2],
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.inverse,
  },
  fab: {
    position: 'absolute',
    right: theme.space[5],
    bottom: theme.space[5],
    width: 56,
    height: 56,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.lg,
  },
});
