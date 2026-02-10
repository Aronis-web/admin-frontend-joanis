import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { useMenuNavigation } from '@/hooks/useMenuNavigation';
import {
  billingApi,
  DocumentCorrelative,
  DocumentSeries,
} from '@/services/api';

interface DocumentCorrelativesScreenProps {
  navigation: any;
}

export const DocumentCorrelativesScreen: React.FC<DocumentCorrelativesScreenProps> = ({ navigation }) => {
  const { logout } = useAuthStore();
  const { selectedSite } = useTenantStore();
  const [correlatives, setCorrelatives] = useState<DocumentCorrelative[]>([]);
  const [series, setSeries] = useState<DocumentSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCorrelatives, setFilteredCorrelatives] = useState<DocumentCorrelative[]>([]);
  const [selectedSeriesFilter, setSelectedSeriesFilter] = useState<string>('all');
  const [showVoided, setShowVoided] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    loadData();
  }, [selectedSite, selectedSeriesFilter, showVoided]);

  useEffect(() => {
    if (!Array.isArray(correlatives)) {
      setFilteredCorrelatives([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setFilteredCorrelatives(correlatives);
    } else {
      const filtered = correlatives.filter(
        (c) =>
          (c.documentNumber && c.documentNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (c.referenceType && c.referenceType.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (c.user?.name && c.user.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredCorrelatives(filtered);
    }
  }, [searchQuery, correlatives]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load series for current site
      if (selectedSite?.id) {
        const seriesData = await billingApi.getDocumentSeries({
          siteId: selectedSite.id,
          isActive: true,
        });
        setSeries(seriesData);

        // Load correlatives
        const params: any = {};

        if (selectedSeriesFilter !== 'all') {
          params.seriesId = selectedSeriesFilter;
        }

        if (!showVoided) {
          params.isVoided = false;
        }

        const correlativesData = await billingApi.getCorrelatives(params);
        console.log('🔢 Correlatives loaded:', correlativesData.length);
        setCorrelatives(correlativesData);
        setFilteredCorrelatives(correlativesData);
      } else {
        setSeries([]);
        setCorrelatives([]);
        setFilteredCorrelatives([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading correlatives:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudieron cargar los correlativos';
      Alert.alert('Error', errorMessage);
      setCorrelatives([]);
      setFilteredCorrelatives([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMenuToggle = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const navigateFromMenu = useMenuNavigation(navigation);

  const handleMenuSelect = (menuId: string) => {
    setIsMenuVisible(false);
    navigateFromMenu(menuId);
  };

  const handleLogout = () => {
    setIsMenuVisible(false);
    logout();
  };

  const handleVoidCorrelative = (correlative: DocumentCorrelative) => {
    Alert.prompt(
      'Anular Correlativo',
      `¿Estás seguro de anular el documento ${correlative.documentNumber}?\n\nIngresa el motivo de anulación:`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Anular',
          style: 'destructive',
          onPress: async (voidReason) => {
            if (!voidReason || voidReason.trim() === '') {
              Alert.alert('Error', 'Debes ingresar un motivo de anulación');
              return;
            }

            try {
              await billingApi.voidCorrelative(correlative.id, { voidReason: voidReason.trim() });
              Alert.alert('Éxito', 'Correlativo anulado correctamente');
              loadData();
            } catch (error: any) {
              console.error('❌ Error voiding correlative:', error);
              const errorMessage =
                error.response?.data?.message || error.message || 'Error al anular el correlativo';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderCorrelativeCard = (correlative: DocumentCorrelative) => (
    <View key={correlative.id} style={[styles.card, correlative.isVoided && styles.cardVoided]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={[styles.cardNumber, correlative.isVoided && styles.cardNumberVoided]}>
            {correlative.documentNumber}
          </Text>
          <Text style={styles.cardSeries}>
            {correlative.series?.documentType?.name || 'N/A'}
          </Text>
        </View>
        <View style={styles.cardHeaderRight}>
          {correlative.isVoided ? (
            <View style={styles.voidedBadge}>
              <Text style={styles.voidedBadgeText}>Anulado</Text>
            </View>
          ) : (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Activo</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Número correlativo:</Text>
          <Text style={styles.detailValue}>
            {correlative.correlativeNumber.toString().padStart(8, '0')}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Serie:</Text>
          <Text style={styles.detailValue}>{correlative.series?.series || 'N/A'}</Text>
        </View>
        {correlative.referenceType && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tipo de referencia:</Text>
            <Text style={styles.detailValue}>{correlative.referenceType}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Generado por:</Text>
          <Text style={styles.detailValue}>{correlative.user?.name || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Fecha de creación:</Text>
          <Text style={styles.detailValue}>{formatDate(correlative.createdAt)}</Text>
        </View>
      </View>

      {correlative.isVoided && (
        <View style={styles.voidInfo}>
          <Text style={styles.voidInfoTitle}>Información de anulación:</Text>
          <Text style={styles.voidInfoText}>Motivo: {correlative.voidReason}</Text>
          <Text style={styles.voidInfoText}>
            Anulado por: {correlative.voidedByUser?.name || 'N/A'}
          </Text>
          {correlative.voidedAt && (
            <Text style={styles.voidInfoText}>Fecha: {formatDate(correlative.voidedAt)}</Text>
          )}
        </View>
      )}

      {!correlative.isVoided && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.voidButton}
            onPress={() => handleVoidCorrelative(correlative)}
          >
            <Text style={styles.voidButtonText}>🚫 Anular</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Correlativos</Text>
            {selectedSite && <Text style={styles.headerSubtitle}>{selectedSite.name}</Text>}
          </View>
          <TouchableOpacity onPress={handleMenuToggle} style={styles.menuButton}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterChip, selectedSeriesFilter === 'all' && styles.filterChipSelected]}
              onPress={() => setSelectedSeriesFilter('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedSeriesFilter === 'all' && styles.filterChipTextSelected,
                ]}
              >
                Todas las series
              </Text>
            </TouchableOpacity>
            {series.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.filterChip, selectedSeriesFilter === s.id && styles.filterChipSelected]}
                onPress={() => setSelectedSeriesFilter(s.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedSeriesFilter === s.id && styles.filterChipTextSelected,
                  ]}
                >
                  {s.series}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowVoided(!showVoided)}
          >
            <Text style={styles.toggleButtonText}>
              {showVoided ? '✓ Mostrar anulados' : '☐ Mostrar anulados'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por número, tipo o usuario..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {!selectedSite ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>🏢</Text>
            <Text style={styles.emptyTitle}>No hay sede seleccionada</Text>
            <Text style={styles.emptySubtitle}>Selecciona una sede para ver sus correlativos</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando correlativos...</Text>
          </View>
        ) : filteredCorrelatives.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>🔢</Text>
            <Text style={styles.emptyTitle}>No hay correlativos</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'No se encontraron resultados'
                : 'Los correlativos se generan automáticamente al crear documentos'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {filteredCorrelatives.map(renderCorrelativeCard)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#6366F1',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 24,
    color: '#6366F1',
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  filterChipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  toggleContainer: {
    marginBottom: 8,
  },
  toggleButton: {
    paddingVertical: 8,
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  searchContainer: {
    marginTop: 8,
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  cardsContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardVoided: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardHeaderRight: {
    marginLeft: 12,
  },
  cardNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6366F1',
    marginBottom: 4,
  },
  cardNumberVoided: {
    color: '#DC2626',
    textDecorationLine: 'line-through',
  },
  cardSeries: {
    fontSize: 14,
    color: '#6B7280',
  },
  cardDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
  },
  voidedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  voidedBadgeText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
  },
  voidInfo: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  voidInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 6,
  },
  voidInfoText: {
    fontSize: 13,
    color: '#DC2626',
    marginBottom: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  voidButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  voidButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
});
