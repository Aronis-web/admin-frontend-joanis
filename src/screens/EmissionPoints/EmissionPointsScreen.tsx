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
import { emissionPointsApi, EmissionPoint, EmissionType } from '@/services/api/emission-points';
import logger from '@/utils/logger';

interface EmissionPointsScreenProps {
  navigation: any;
}

export const EmissionPointsScreen: React.FC<EmissionPointsScreenProps> = ({ navigation }) => {
  const [emissionPoints, setEmissionPoints] = useState<EmissionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { currentSite, currentCompany } = useAuthStore();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const loadEmissionPoints = useCallback(async () => {
    if (!currentSite?.id || !currentCompany?.id) {
      logger.warn('No hay sede o empresa seleccionada');
      return;
    }

    try {
      setLoading(true);
      const points = await emissionPointsApi.getEmissionPoints({
        siteId: currentSite.id,
        companyId: currentCompany.id,
      });
      setEmissionPoints(points);
    } catch (error: any) {
      logger.error('Error cargando puntos de emisión:', error);
      Alert.alert('Error', 'No se pudieron cargar los puntos de emisión');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentSite?.id, currentCompany?.id]);

  useFocusEffect(
    useCallback(() => {
      loadEmissionPoints();
    }, [loadEmissionPoints])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadEmissionPoints();
  };

  const handleCreateEmissionPoint = () => {
    navigation.navigate('CreateEmissionPoint');
  };

  const handleViewSeries = (emissionPoint: EmissionPoint) => {
    navigation.navigate('EmissionPointSeries', {
      emissionPointId: emissionPoint.id,
      emissionPointName: emissionPoint.name,
      emissionPointCode: emissionPoint.code,
    });
  };

  const handleEditEmissionPoint = (emissionPoint: EmissionPoint) => {
    navigation.navigate('EditEmissionPoint', { emissionPointId: emissionPoint.id });
  };

  const handleToggleActive = async (emissionPoint: EmissionPoint) => {
    const action = emissionPoint.isActive ? 'desactivar' : 'activar';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Punto de Emisión`,
      `¿Estás seguro de que deseas ${action} el punto de emisión "${emissionPoint.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await emissionPointsApi.updateEmissionPoint(emissionPoint.id, {
                isActive: !emissionPoint.isActive,
              });
              Alert.alert('Éxito', `Punto de emisión ${action}do exitosamente`);
              loadEmissionPoints();
            } catch (error: any) {
              logger.error(`Error al ${action} punto de emisión:`, error);
              Alert.alert('Error', `No se pudo ${action} el punto de emisión`);
            }
          },
        },
      ]
    );
  };

  const getEmissionTypeIcon = (type: EmissionType): string => {
    switch (type) {
      case 'POS':
        return '🏪';
      case 'CAMPAIGN':
        return '📢';
      case 'INDIVIDUAL_SALE':
        return '🛒';
      default:
        return '📄';
    }
  };

  const getEmissionTypeLabel = (type: EmissionType): string => {
    switch (type) {
      case 'POS':
        return 'POS';
      case 'CAMPAIGN':
        return 'CAMPAÑA';
      case 'INDIVIDUAL_SALE':
        return 'VENTAS INDIVIDUALES';
      default:
        return type;
    }
  };

  const renderEmissionPointCard = (point: EmissionPoint) => (
    <View key={point.id} style={[styles.card, isTablet && styles.cardTablet]}>
      <View style={styles.cardHeader}>
        <View style={styles.typeContainer}>
          <Text style={styles.typeIcon}>{getEmissionTypeIcon(point.emissionType)}</Text>
          <Text style={[styles.typeLabel, isTablet && styles.typeLabelTablet]}>
            {getEmissionTypeLabel(point.emissionType)}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: point.isActive ? '#10B98120' : '#EF444420' },
          ]}
        >
          <Text style={[styles.statusText, { color: point.isActive ? '#10B981' : '#EF4444' }]}>
            {point.isActive ? '✅ Activo' : '❌ Inactivo'}
          </Text>
        </View>
      </View>

      <Text style={[styles.pointName, isTablet && styles.pointNameTablet]}>
        {point.code} - {point.name}
      </Text>

      {point.description && (
        <Text style={[styles.description, isTablet && styles.descriptionTablet]}>
          {point.description}
        </Text>
      )}

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{point.seriesCount || 0}</Text>
          <Text style={styles.statLabel}>series configuradas</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{point.documentsCount || 0}</Text>
          <Text style={styles.statLabel}>documentos emitidos</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => handleViewSeries(point)}
        >
          <Text style={styles.primaryButtonText}>📄 Ver Series</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => handleEditEmissionPoint(point)}
        >
          <Text style={styles.secondaryButtonText}>✏️ Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => handleToggleActive(point)}
        >
          <Text style={styles.secondaryButtonText}>
            {point.isActive ? '🚫 Desactivar' : '✅ Activar'}
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
            <Text style={styles.loadingText}>Cargando puntos de emisión...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Puntos de Emisión
            </Text>
            <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
              {currentSite?.name || 'Sede'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.createButton, isTablet && styles.createButtonTablet]}
            onPress={handleCreateEmissionPoint}
          >
            <Text style={[styles.createButtonText, isTablet && styles.createButtonTextTablet]}>
              + Nuevo Punto de Emisión
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {emissionPoints.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyTitle}>No hay puntos de emisión</Text>
              <Text style={styles.emptyText}>
                Crea tu primer punto de emisión para comenzar a configurar series de documentos
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={handleCreateEmissionPoint}
              >
                <Text style={styles.emptyButtonText}>+ Crear Punto de Emisión</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cardsContainer}>
              {emissionPoints.map(renderEmissionPointCard)}
            </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeIcon: {
    fontSize: 24,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  typeLabelTablet: {
    fontSize: 14,
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
  pointName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  pointNameTablet: {
    fontSize: 20,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  descriptionTablet: {
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#6366F1',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
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
