import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { transportService } from '@/services/api/transport';
import { usePermissions } from '@/hooks/usePermissions';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import type { Transporter, TransportersResponse } from '@/types/transport';

export const TransportersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { hasPermission } = usePermissions();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const canCreate = hasPermission('transport.transporters.create');
  const canUpdate = hasPermission('transport.transporters.update');
  const canDelete = hasPermission('transport.transporters.delete');

  const fetchTransporters = useCallback(async (pageNum: number = 1, search: string = '') => {
    try {
      setLoading(pageNum === 1);
      const response = await transportService.getTransporters({
        page: pageNum,
        limit: 20,
        search: search.trim() || undefined,
      });

      setTransporters(response.data);
      setTotalPages(response.meta.totalPages);
      setTotal(response.meta.total);
      setPage(pageNum);
    } catch (error: any) {
      console.error('Error fetching transporters:', error);
      Alert.alert('Error', error.message || 'No se pudieron cargar los transportistas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransporters(1, searchQuery);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransporters(1, searchQuery);
  }, [searchQuery, fetchTransporters]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    const timeoutId = setTimeout(() => {
      fetchTransporters(1, text);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [fetchTransporters]);

  const handleLoadMore = useCallback(() => {
    if (!loading && page < totalPages) {
      fetchTransporters(page + 1, searchQuery);
    }
  }, [loading, page, totalPages, searchQuery, fetchTransporters]);

  const handleCreateTransporter = () => {
    if (!canCreate) {
      Alert.alert('Sin permisos', 'No tienes permisos para crear transportistas');
      return;
    }
    (navigation as any).navigate('CreateTransporter');
  };

  const handleTransporterPress = (transporter: Transporter) => {
    (navigation as any).navigate('TransporterDetail', { transporterId: transporter.id });
  };

  const handleDeleteTransporter = async (transporter: Transporter) => {
    if (!canDelete) {
      Alert.alert('Sin permisos', 'No tienes permisos para eliminar transportistas');
      return;
    }

    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de eliminar el transportista "${transporter.razonSocial}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await transportService.deleteTransporter(transporter.id);
              Alert.alert('Éxito', 'Transportista eliminado correctamente');
              handleRefresh();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar el transportista');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return theme.color.action.success.background;
      case 'SUSPENDED':
        return theme.color.action.danger.background;
      case 'INACTIVE':
      default:
        return theme.color.text.muted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Activo';
      case 'INACTIVE':
        return 'Inactivo';
      case 'SUSPENDED':
        return 'Suspendido';
      default:
        return status;
    }
  };

  const renderTransporterItem = ({ item }: { item: Transporter }) => (
    <TouchableOpacity
      style={styles.transporterCard}
      onPress={() => handleTransporterPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.transporterHeader}>
        <View style={styles.transporterInfo}>
          <Text style={styles.transporterName} numberOfLines={1}>
            {item.razonSocial}
          </Text>
          <Text style={styles.transporterRuc}>RUC: {item.numeroRuc}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <View style={styles.transporterDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Registro MTC:</Text>
          <Text style={styles.detailValue}>{item.numeroRegistroMTC}</Text>
        </View>
        {item.numeroAutorizacion && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Autorización:</Text>
            <Text style={styles.detailValue}>{item.numeroAutorizacion}</Text>
          </View>
        )}
        {item.codigoAutorizado && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Código Autorizado:</Text>
            <Text style={styles.detailValue}>{item.codigoAutorizado}</Text>
          </View>
        )}
        {item.telefono && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Teléfono:</Text>
            <Text style={styles.detailValue}>{item.telefono}</Text>
          </View>
        )}
      </View>

      {canDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteTransporter(item)}
        >
          <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>🚛</Text>
      <Text style={styles.emptyStateTitle}>No hay transportistas</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery
          ? 'No se encontraron transportistas con ese criterio de búsqueda'
          : 'Aún no hay transportistas registrados'}
      </Text>
      {canCreate && !searchQuery && (
        <TouchableOpacity style={styles.emptyStateButton} onPress={handleCreateTransporter}>
          <Text style={styles.emptyStateButtonText}>+ Crear Transportista</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loading || page === 1) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.color.brand.accent} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transportistas</Text>
        <View style={styles.headerRight}>
          {canCreate && (
            <TouchableOpacity style={styles.addButton} onPress={handleCreateTransporter}>
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por RUC, razón social o registro MTC..."
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor={theme.color.text.placeholder}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Total: <Text style={styles.statsValue}>{total}</Text> transportistas
        </Text>
      </View>

      {/* List */}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.accent} />
          <Text style={styles.loadingText}>Cargando transportistas...</Text>
        </View>
      ) : (
        <FlatList
          data={transporters}
          renderItem={renderTransporterItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.color.brand.accent]}
              tintColor={theme.color.brand.accent}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButtonText: {
      fontSize: 24,
      color: theme.color.text.heading,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
      flex: 1,
      textAlign: 'center',
    },
    headerRight: {
      width: 40,
      alignItems: 'flex-end',
    },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.color.brand.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addButtonText: {
      fontSize: 24,
      color: theme.color.text.inverse,
      fontWeight: '600',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    searchIcon: {
      fontSize: 18,
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.color.text.heading,
    },
    clearIcon: {
      fontSize: 18,
      color: theme.color.text.placeholder,
      padding: 4,
    },
    statsContainer: {
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    statsText: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    statsValue: {
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    listContent: {
      padding: 20,
      paddingTop: 8,
    },
    transporterCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    transporterHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    transporterInfo: {
      flex: 1,
      marginRight: 12,
    },
    transporterName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 4,
    },
    transporterRuc: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    transporterDetails: {
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      paddingTop: 12,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    detailLabel: {
      fontSize: 13,
      color: theme.color.text.muted,
      flex: 1,
    },
    detailValue: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.color.text.heading,
      flex: 1,
      textAlign: 'right',
    },
    deleteButton: {
      marginTop: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.color.state.danger.background,
      borderRadius: 8,
      alignItems: 'center',
    },
    deleteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.danger,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 15,
      color: theme.color.text.muted,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyStateIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 8,
    },
    emptyStateText: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 40,
    },
    emptyStateButton: {
      backgroundColor: theme.color.brand.accent,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    emptyStateButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    footerLoader: {
      paddingVertical: 20,
      alignItems: 'center',
    },
  });
