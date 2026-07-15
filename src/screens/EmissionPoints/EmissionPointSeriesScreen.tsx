import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useAuthStore } from '@/store/auth';
import { emissionPointsApi, DocumentSeries } from '@/services/api/emission-points';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import logger from '@/utils/logger';
import Alert from '@/utils/alert';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
              {
                backgroundColor: seriesItem.isActive
                  ? theme.color.state.success.background
                  : theme.color.state.danger.background,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: seriesItem.isActive
                    ? theme.color.text.success
                    : theme.color.text.danger,
                },
              ]}
            >
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
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
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
      marginTop: 12,
      fontSize: 16,
      color: theme.color.text.muted,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
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
      color: theme.color.text.heading,
    },
    headerTitleTablet: {
      fontSize: 32,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginTop: 4,
    },
    headerSubtitleTablet: {
      fontSize: 16,
    },
    createButton: {
      backgroundColor: theme.color.brand.accent,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
    },
    createButtonTablet: {
      paddingHorizontal: 24,
      paddingVertical: 14,
    },
    createButtonText: {
      color: theme.color.text.inverse,
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
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      padding: 16,
      shadowColor: theme.color.shadow,
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
      color: theme.color.text.heading,
    },
    seriesTitleTablet: {
      fontSize: 20,
    },
    seriesDescription: {
      fontSize: 14,
      color: theme.color.text.muted,
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
      color: theme.color.text.muted,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    highlightValue: {
      color: theme.color.brand.accent,
      fontSize: 16,
    },
    badgesContainer: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: 8,
    },
    defaultBadge: {
      backgroundColor: theme.color.state.warning.background,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    defaultBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.state.warning.text,
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
      borderTopColor: theme.color.border.subtle,
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
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    secondaryButtonText: {
      color: theme.color.text.body,
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
      color: theme.color.text.heading,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 32,
    },
    emptyButton: {
      backgroundColor: theme.color.brand.accent,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    emptyButtonText: {
      color: theme.color.text.inverse,
      fontSize: 16,
      fontWeight: '600',
    },
  });
