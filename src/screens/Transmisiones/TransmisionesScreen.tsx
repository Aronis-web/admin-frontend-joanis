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
import { transmisionesApi } from '@/services/api';
import {
  Transmision,
  TransmisionStatus,
  getTransmisionStatusLabel,
  getTransmisionStatusColor,
} from '@/types/transmisiones';
import { useAuthStore } from '@/store/auth';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { Pagination } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface TransmisionesScreenProps {
  navigation: any;
}

export const TransmisionesScreen: React.FC<TransmisionesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [transmisiones, setTransmisiones] = useState<Transmision[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<TransmisionStatus | 'ALL'>('ALL');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const { currentCompany, currentSite } = useAuthStore();
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  const loadTransmisiones = useCallback(
    async (page: number = 1) => {
      try {
        setLoading(true);

        const params: any = {
          page,
          limit: pagination.limit,
          sortBy: 'createdAt',
          sortOrder: 'DESC',
        };

        if (selectedStatus !== 'ALL') {
          params.status = selectedStatus;
        }

        const response = await transmisionesApi.getTransmisiones(params);
        setTransmisiones(response.data);

        setPagination({
          page: response.page,
          limit: response.limit,
          total: response.total,
          totalPages: response.totalPages,
        });
      } catch (error: any) {
        console.error('Error loading transmisiones:', error);
        Alert.alert('Error', 'No se pudieron cargar las transmisiones');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedStatus, pagination.limit]
  );

  // Auto-reload transmisiones when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 TransmisionesScreen focused - reloading transmisiones...');
      setLoading(true);
      loadTransmisiones();
    }, [loadTransmisiones])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadTransmisiones(1);
  };

  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      loadTransmisiones(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      loadTransmisiones(pagination.page + 1);
    }
  };

  const handleCreateTransmision = () => {
    navigation.navigate('CreateTransmision');
  };

  const handleTransmisionPress = (transmision: Transmision) => {
    navigation.navigate('TransmisionDetail', { transmisionId: transmision.id });
  };

  const handleDeleteTransmision = async (transmision: Transmision) => {
    Alert.alert(
      'Eliminar Transmisión',
      `¿Estás seguro de que deseas eliminar la transmisión "${transmision.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await transmisionesApi.deleteTransmision(transmision.id);
              Alert.alert('Éxito', 'Transmisión eliminada correctamente');
              loadTransmisiones(pagination.page);
            } catch (error: any) {
              console.error('Error deleting transmision:', error);
              Alert.alert('Error', 'No se pudo eliminar la transmisión');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusBadgeStyle = (status: TransmisionStatus) => {
    return {
      backgroundColor: getTransmisionStatusColor(status) + '20',
      borderColor: getTransmisionStatusColor(status),
    };
  };

  const getStatusTextStyle = (status: TransmisionStatus) => {
    return {
      color: getTransmisionStatusColor(status),
    };
  };

  const renderStatusFilter = () => {
    const statuses: Array<TransmisionStatus | 'ALL'> = [
      'ALL',
      TransmisionStatus.DRAFT,
      TransmisionStatus.IN_PROGRESS,
      TransmisionStatus.COMPLETED,
      TransmisionStatus.CANCELLED,
    ];

    return (
      <View style={styles.filterWrapper}>
        <Text style={styles.filterLabel}>Estado:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {statuses.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                isTablet && styles.filterButtonTablet,
                selectedStatus === status && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  isTablet && styles.filterButtonTextTablet,
                  selectedStatus === status && styles.filterButtonTextActive,
                ]}
              >
                {status === 'ALL' ? 'Todos' : getTransmisionStatusLabel(status)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderTransmisionCard = (transmision: Transmision) => {
    return (
      <TouchableOpacity
        key={transmision.id}
        style={[styles.card, isTablet && styles.cardTablet]}
        onPress={() => handleTransmisionPress(transmision)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.cardTitle, isTablet && styles.cardTitleTablet]}>
              {transmision.name}
            </Text>
            <View style={[styles.statusBadge, getStatusBadgeStyle(transmision.status)]}>
              <Text style={[styles.statusText, getStatusTextStyle(transmision.status)]}>
                {getTransmisionStatusLabel(transmision.status)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteTransmision(transmision)}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>

        {transmision.description && (
          <Text style={[styles.cardDescription, isTablet && styles.cardDescriptionTablet]}>
            {transmision.description}
          </Text>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.cardFooterItem}>
            <Text style={styles.cardFooterLabel}>Creada:</Text>
            <Text style={styles.cardFooterValue}>{formatDate(transmision.createdAt)}</Text>
          </View>
          <View style={styles.cardFooterItem}>
            <Text style={styles.cardFooterLabel}>Actualizada:</Text>
            <Text style={styles.cardFooterValue}>{formatDate(transmision.updatedAt)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPagination = () => {
    if (pagination.totalPages <= 1) {
      return null;
    }

    return (
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        itemsPerPage={pagination.limit}
        onPageChange={loadTransmisiones}
        loading={loading}
      />
    );
  };

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Transmisiones
            </Text>
            <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
              Gestión de lotes de productos
            </Text>
          </View>
        </View>
        {renderStatusFilter()}

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
            <Text style={styles.loadingText}>Cargando transmisiones...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          >
            {transmisiones.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>📋</Text>
                <Text style={styles.emptyTitle}>No hay transmisiones</Text>
                <Text style={styles.emptySubtitle}>
                  {selectedStatus === 'ALL'
                    ? 'Crea tu primera transmisión para comenzar'
                    : 'No hay transmisiones con este estado'}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.summaryContainer}>
                  <Text style={styles.summaryText}>
                    Total: {pagination.total} transmision{pagination.total !== 1 ? 'es' : ''}
                  </Text>
                </View>

                {transmisiones.map(renderTransmisionCard)}
              </>
            )}
          </ScrollView>
        )}

        {!loading && renderPagination()}

        {/* Add Button */}
        <ProtectedFAB
          actions={[
            {
              icon: 'send-outline',
              label: 'Crear Transmisi\u00f3n',
              onPress: handleCreateTransmision,
              requiredPermissions: ['transmisiones.create'],
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
    header: {
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerTablet: {
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 4,
    },
    headerTitleTablet: {
      fontSize: 32,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    headerSubtitleTablet: {
      fontSize: 16,
    },
    filterWrapper: {
      backgroundColor: theme.color.surface.base,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    filterLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
      marginBottom: 8,
    },
    filterContent: {
      paddingRight: 16,
    },
    filterButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.color.surface.muted,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    filterButtonTablet: {
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    filterButtonActive: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    filterButtonText: {
      fontSize: 14,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    filterButtonTextTablet: {
      fontSize: 16,
    },
    filterButtonTextActive: {
      color: theme.color.text.inverse,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.color.text.muted,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    summaryContainer: {
      backgroundColor: theme.color.surface.base,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    summaryText: {
      fontSize: 14,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    cardTablet: {
      padding: 20,
      borderRadius: 16,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    cardHeaderLeft: {
      flex: 1,
      marginRight: 12,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 8,
    },
    cardTitleTablet: {
      fontSize: 22,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    deleteButton: {
      padding: 8,
    },
    deleteButtonText: {
      fontSize: 20,
    },
    cardDescription: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginBottom: 12,
      lineHeight: 20,
    },
    cardDescriptionTablet: {
      fontSize: 16,
      lineHeight: 24,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    cardFooterItem: {
      flex: 1,
    },
    cardFooterLabel: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: 4,
    },
    cardFooterValue: {
      fontSize: 14,
      color: theme.color.text.body,
      fontWeight: '500',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyText: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 16,
      color: theme.color.text.muted,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 8,
    },
    paginationButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.color.brand.accent,
    },
    paginationButtonDisabled: {
      backgroundColor: theme.color.surface.muted,
    },
    paginationButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    paginationText: {
      fontSize: 14,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
  });
