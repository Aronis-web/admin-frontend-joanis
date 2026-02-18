import React, { useState, useCallback } from 'react';
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
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useAuthStore } from '@/store/auth';
import { emissionPointsApi, DocumentSeries } from '@/services/api/emission-points';
import logger from '@/utils/logger';

interface EmissionPointSeriesScreenProps {
  navigation: any;
  route: {
    params: {
      emissionPointId: string;
      emissionPointName: string;
      emissionPointCode: string;
    };
  };
}

export const EmissionPointSeriesScreen: React.FC<EmissionPointSeriesScreenProps> = ({
  navigation,
  route,
}) => {
  const { emissionPointId, emissionPointName, emissionPointCode } = route.params;
  const [series, setSeries] = useState<DocumentSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { currentSite, currentCompany } = useAuthStore();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const loadSeries = useCallback(async () => {
    if (!currentSite?.id || !currentCompany?.id) {
      logger.warn('No hay sede o empresa seleccionada');
      return;
    }

    try {
      setLoading(true);
      const seriesList = await emissionPointsApi.getSeries({
        emissionPointId,
        siteId: currentSite.id,
        companyId: currentCompany.id,
      });
      setSeries(seriesList);
    } catch (error: any) {
      logger.error('Error cargando series:', error);
      Alert.alert('Error', 'No se pudieron cargar las series');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [emissionPointId, currentSite?.id, currentCompany?.id]);

  useFocusEffect(
    useCallback(() => {
      loadSeries();
    }, [loadSeries])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadSeries();
  };

  const handleCreateSeries = () => {
    navigation.navigate('CreateSeries', {
      emissionPointId,
      emissionPointName,
      emissionPointCode,
    });
  };

  const handleEditSeries = (seriesItem: DocumentSeries) => {
    navigation.navigate('EditSeries', {
      seriesId: seriesItem.id,
      emissionPointId,
      emissionPointName,
      emissionPointCode,
    });
  };

  const handleToggleActive = async (seriesItem: DocumentSeries) => {
    const action = seriesItem.isActive ? 'desactivar' : 'activar';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Serie`,
      `¿Estás seguro de que deseas ${action} la serie "${seriesItem.series}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await emissionPointsApi.updateSeries(seriesItem.id, {
                isActive: !seriesItem.isActive,
              });
              Alert.alert('Éxito', `Serie ${action}da exitosamente`);
              loadSeries();
            } catch (error: any) {
              logger.error(`Error al ${action} serie:`, error);
              Alert.alert('Error', `No se pudo ${action} la serie`);
            }
          },
        },
      ]
    );
  };

  const formatSeriesNumber = (series: string, number: number): string => {
    return `${series}-${number.toString().padStart(8, '0')}`;
  };

  const renderSeriesCard = (seriesItem: DocumentSeries) => (
    <View key={seriesItem.id} style={[styles.card, isTablet && styles.cardTablet]}>
      <View style={styles.cardHeader}>
        <View style={styles.seriesInfo}>
          <Text style={styles.seriesIcon}>📄</Text>
          <View style={styles.seriesTitleContainer}>
            <Text style={[styles.seriesTitle, isTablet && styles.seriesTitleTablet]}>
              {seriesItem.series} - {seriesItem.documentType?.name || 'Documento'}
            </Text>
            {seriesItem.description && (
              <Text style={[styles.seriesDescription, isTablet && styles.seriesDescriptionTablet]}>
                {seriesItem.description}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.seriesDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>📊 Último número:</Text>
          <Text style={[styles.detailValue, styles.highlightValue]}>
            {formatSeriesNumber(seriesItem.series, seriesItem.currentNumber)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>🔢 Rango:</Text>
          <Text style={styles.detailValue}>
            {seriesItem.startNumber} - {seriesItem.maxNumber}
          </Text>
        </View>

        <View style={styles.badgesContainer}>
          {seriesItem.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>🎯 Serie por defecto</Text>
            </View>
          )}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: seriesItem.isActive ? '#10B98120' : '#EF444420' },
            ]}
          >
            <Text style={[styles.statusText, { color: seriesItem.isActive ? '#10B981' : '#EF4444' }]}>
              {seriesItem.isActive ? '✅ Activa' : '❌ Inactiva'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => handleEditSeries(seriesItem)}
        >
          <Text style={styles.secondaryButtonText}>✏️ Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => handleToggleActive(seriesItem)}
        >
          <Text style={styles.secondaryButtonText}>
            {seriesItem.isActive ? '🚫 Desactivar' : '✅ Activar'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <ScreenLayout navigation={navigation}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Cargando series...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Series - {emissionPointCode}
            </Text>
            <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
              {emissionPointName}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.createButton, isTablet && styles.createButtonTablet]}
            onPress={handleCreateSeries}
          >
            <Text style={[styles.createButtonText, isTablet && styles.createButtonTextTablet]}>
              + Nueva Serie
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {series.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyTitle}>No hay series configuradas</Text>
              <Text style={styles.emptyText}>
                Crea tu primera serie para comenzar a emitir documentos desde este punto de emisión
              </Text>
              <TouchableOpacity style={styles.emptyButton} onPress={handleCreateSeries}>
                <Text style={styles.emptyButtonText}>+ Crear Serie</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cardsContainer}>{series.map(renderSeriesCard)}</View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTablet: {
    padding: 24,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerTitleTablet: {
    fontSize: 32,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  headerSubtitleTablet: {
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonTablet: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  createButtonTextTablet: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTablet: {
    padding: 20,
  },
  cardHeader: {
    marginBottom: 16,
  },
  seriesInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  seriesIcon: {
    fontSize: 32,
  },
  seriesTitleContainer: {
    flex: 1,
  },
  seriesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  seriesTitleTablet: {
    fontSize: 20,
  },
  seriesDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  seriesDescriptionTablet: {
    fontSize: 16,
  },
  seriesDetails: {
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  highlightValue: {
    color: '#6366F1',
    fontSize: 16,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  defaultBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  emptyButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
