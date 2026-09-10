import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { Customer, CustomerType } from '@/types/customers';
import { useCustomers, useDeleteCustomer } from '@/hooks/api/useCustomers';
import { useCustomerLevels, useAssignCustomerLevel } from '@/hooks/api/useCustomerLevels';
import { Modal } from 'react-native';
import { useDebounce } from '@/hooks/useDebounce';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { Pagination } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

interface CustomersScreenProps {
  navigation: {
    navigate: (screen: string, params: { customerId?: string }) => void;
  };
}

export const CustomersScreen: React.FC<CustomersScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchQuery, 300).trim();
  const limit = 20;
  const {
    data: customersResponse,
    isLoading,
    isFetching,
    isRefetching,
    isError,
    refetch,
  } = useCustomers({
    page,
    limit,
    search: debouncedSearch || undefined,
    isActive: true,
  });
  const deleteCustomer = useDeleteCustomer();
  const { data: levels = [] } = useCustomerLevels();
  const assignLevel = useAssignCustomerLevel();
  const [levelPickerFor, setLevelPickerFor] = useState<Customer | null>(null);
  const levelsById = React.useMemo(
    () => Object.fromEntries(levels.map((l) => [l.id, l])),
    [levels]
  );
  const sortedLevelsForPicker = React.useMemo(
    () =>
      [...levels]
        .filter((l) => l.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [levels]
  );
  const customers = customersResponse?.data ?? [];
  const pagination = customersResponse?.meta ?? {
    page,
    limit,
    total: 0,
    totalPages: 0,
  };

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  const handleMenuToggle = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setPage(1);
  };

  const onRefresh = async () => {
    await refetch();
  };

  const handleAddCustomer = () => {
    navigation.navigate('CustomerDetail', {});
  };

  const handleCustomerPress = (customer: Customer) => {
    navigation.navigate('CustomerDetail', { customerId: customer.id });
  };

  const handleDeleteCustomer = (customer: Customer) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de que deseas eliminar al cliente "${customer.fullName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomer.mutateAsync(customer.id);
              Alert.alert('Éxito', 'Cliente eliminado correctamente');
              if (customers.length === 1 && page > 1) {
                setPage(page - 1);
              }
            } catch (error) {
              logger.error('Error deleting customer:', error);
              Alert.alert('Error', 'No se pudo eliminar el cliente');
            }
          },
        },
      ]
    );
  };

  const handleAssignLevel = async (customer: Customer, levelId: string | null) => {
    try {
      await assignLevel.mutateAsync({ customerId: customer.id, customerLevelId: levelId });
      setLevelPickerFor(null);
      Alert.alert('Éxito', 'Nivel actualizado');
    } catch (error: any) {
      logger.error('Error asignando nivel', error);
      const message =
        error?.response?.data?.message || error?.message || 'No se pudo actualizar el nivel';
      Alert.alert('Error', String(message));
    }
  };

  const renderCustomerCard = (customer: Customer) => {
    const isPersona = customer.customerType === CustomerType.PERSONA;
    const currentLevel = customer.customerLevelId
      ? levelsById[customer.customerLevelId]
      : undefined;

    return (
      <TouchableOpacity
        key={customer.id}
        style={styles.customerCard}
        onPress={() => handleCustomerPress(customer)}
      >
        <View style={styles.customerHeader}>
          <View style={styles.customerTypeContainer}>
            <View
              style={[
                styles.customerTypeBadge,
                isPersona ? styles.personaBadge : styles.empresaBadge,
              ]}
            >
              <Text style={styles.customerTypeText}>{isPersona ? '👤 PERSONA' : '🏢 EMPRESA'}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                customer.status === 'ACTIVE'
                  ? styles.statusActive
                  : customer.status === 'INACTIVE'
                    ? styles.statusInactive
                    : styles.statusBlocked,
              ]}
            >
              <Text style={styles.statusText}>
                {customer.status === 'ACTIVE'
                  ? 'Activo'
                  : customer.status === 'INACTIVE'
                    ? 'Inactivo'
                    : 'Bloqueado'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{customer.fullName}</Text>
          <Text style={styles.customerDocument}>
            {customer.documentType}: {customer.documentNumber}
          </Text>

          {customer.email && <Text style={styles.customerDetail}>📧 {customer.email}</Text>}
          {customer.mobile && <Text style={styles.customerDetail}>📱 {customer.mobile}</Text>}
          {customer.direccion && (
            <Text style={styles.customerDetail} numberOfLines={1}>
              📍 {customer.direccion}
            </Text>
          )}
        </View>

        <View style={styles.levelRow}>
          <Text style={styles.levelLabel}>Nivel:</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>
              {currentLevel ? currentLevel.name : 'Por defecto'}
            </Text>
          </View>
          <ProtectedElement requiredPermissions={['customers.assign_level']}>
            <TouchableOpacity
              style={styles.levelChangeButton}
              onPress={(e) => {
                e.stopPropagation?.();
                setLevelPickerFor(customer);
              }}
            >
              <Text style={styles.levelChangeButtonText}>Cambiar</Text>
            </TouchableOpacity>
          </ProtectedElement>
        </View>

        <View style={styles.customerActions}>
          <ProtectedElement requiredPermissions={['customers.delete']}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteCustomer(customer)}
            >
              <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
            </TouchableOpacity>
          </ProtectedElement>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;

    return (
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        itemsPerPage={pagination.limit}
        onPageChange={setPage}
        loading={isFetching}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleMenuToggle} style={styles.menuButton}>
            <Text style={[styles.menuIcon, isTablet && styles.menuIconTablet]}>☰</Text>
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>Clientes</Text>
            <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
              Gestión de Clientes
            </Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, isTablet && styles.searchContainerTablet]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, isTablet && styles.searchInputTablet]}
          placeholder="Buscar por nombre, documento, email..."
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholderTextColor={theme.color.text.placeholder}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearchChange('')} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Total: {pagination.total} cliente{pagination.total !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.accent} />
          <Text style={styles.loadingText}>Cargando clientes...</Text>
        </View>
      ) : isError ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No se pudieron cargar los clientes</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => refetch()}>
            <Text style={styles.emptyButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No se encontraron clientes' : 'No hay clientes registrados'}
          </Text>
          <ProtectedElement requiredPermissions={['customers.create']}>
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddCustomer}>
              <Text style={styles.emptyButtonText}>+ Agregar Cliente</Text>
            </TouchableOpacity>
          </ProtectedElement>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        >
          {customers.map(renderCustomerCard)}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}
      {renderPagination()}

      {/* Level Picker Modal */}
      <Modal
        visible={!!levelPickerFor}
        transparent
        animationType="fade"
        onRequestClose={() => setLevelPickerFor(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cambiar nivel · {levelPickerFor?.fullName ?? ''}</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              <TouchableOpacity
                style={[
                  styles.levelOption,
                  !levelPickerFor?.customerLevelId && styles.levelOptionActive,
                ]}
                onPress={() => levelPickerFor && handleAssignLevel(levelPickerFor, null)}
                disabled={assignLevel.isPending}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.levelOptionName}>Sin nivel (por defecto)</Text>
                  <Text style={styles.levelOptionMeta}>Usa el nivel default del sistema.</Text>
                </View>
                {!levelPickerFor?.customerLevelId && <Text style={styles.levelOptionCheck}>✓</Text>}
              </TouchableOpacity>
              {sortedLevelsForPicker.map((l) => {
                const active = levelPickerFor?.customerLevelId === l.id;
                return (
                  <TouchableOpacity
                    key={l.id}
                    style={[styles.levelOption, active && styles.levelOptionActive]}
                    onPress={() => levelPickerFor && handleAssignLevel(levelPickerFor, l.id)}
                    disabled={assignLevel.isPending}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.levelOptionName}>{l.name}</Text>
                      <Text style={styles.levelOptionMeta}>
                        {l.code} · Desc. {Number(l.discountPct).toFixed(1)}% ·{' '}
                        {l.whatsappEnabled ? 'WhatsApp ON' : 'WhatsApp OFF'}
                      </Text>
                    </View>
                    {active && <Text style={styles.levelOptionCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.levelCancelButton}
              onPress={() => setLevelPickerFor(null)}
              disabled={assignLevel.isPending}
            >
              <Text style={styles.levelCancelButtonText}>
                {assignLevel.isPending ? 'Guardando…' : 'Cerrar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Button */}
      <ProtectedFAB
        actions={[
          {
            icon: 'person-add-outline',
            label: 'Crear Cliente',
            onPress: handleAddCustomer,
            requiredPermissions: ['customers.create'],
          },
        ]}
      />
    </SafeAreaView>
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
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    headerTablet: {
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    menuButton: {
      padding: 8,
    },
    menuIcon: {
      fontSize: 24,
      color: theme.color.text.muted,
    },
    menuIconTablet: {
      fontSize: 28,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 2,
    },
    headerTitleTablet: {
      fontSize: 24,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    headerSubtitleTablet: {
      fontSize: 14,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: 12,
    },
    searchContainerTablet: {
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    searchIcon: {
      fontSize: 20,
      color: theme.color.text.placeholder,
    },
    searchInput: {
      flex: 1,
      backgroundColor: theme.color.surface.subtle,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.color.text.heading,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    searchInputTablet: {
      paddingVertical: 12,
      fontSize: 16,
    },
    clearButton: {
      padding: 8,
    },
    clearButtonText: {
      fontSize: 18,
      color: theme.color.text.placeholder,
      fontWeight: '600',
    },
    statsContainer: {
      padding: 12,
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    statsText: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
    },
    customerCard: {
      backgroundColor: theme.color.surface.base,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 8,
      padding: 16,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    customerHeader: {
      marginBottom: 12,
    },
    customerTypeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    customerTypeBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    personaBadge: {
      backgroundColor: theme.color.state.info.background,
    },
    empresaBadge: {
      backgroundColor: theme.color.state.warning.background,
    },
    customerTypeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    statusActive: {
      backgroundColor: theme.color.state.success.background,
    },
    statusInactive: {
      backgroundColor: theme.color.state.warning.background,
    },
    statusBlocked: {
      backgroundColor: theme.color.state.danger.background,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    customerInfo: {
      marginBottom: 12,
    },
    customerName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: 4,
    },
    customerDocument: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginBottom: 8,
    },
    customerDetail: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginTop: 4,
    },
    customerActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    deleteButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: theme.color.state.danger.background,
    },
    deleteButtonText: {
      color: theme.color.state.danger.border,
      fontSize: 14,
      fontWeight: '600',
    },
    paginationContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      marginTop: 16,
    },
    paginationButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: theme.color.brand.accent,
    },
    paginationButtonDisabled: {
      backgroundColor: theme.color.border.default,
    },
    paginationButtonText: {
      color: theme.color.text.onAction,
      fontSize: 14,
      fontWeight: '600',
    },
    paginationButtonTextDisabled: {
      color: theme.color.text.subtle,
    },
    paginationText: {
      fontSize: 14,
      color: theme.color.text.muted,
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
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: theme.color.text.muted,
      marginBottom: 16,
      textAlign: 'center',
    },
    emptyButton: {
      backgroundColor: theme.color.brand.accent,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    emptyButtonText: {
      color: theme.color.text.onAction,
      fontSize: 16,
      fontWeight: '600',
    },
    bottomPadding: {
      height: 100,
    },
    levelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    levelLabel: {
      fontSize: 13,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    levelBadge: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: theme.color.brand.accentSoft,
    },
    levelBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.brand.accent,
    },
    levelChangeButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.color.state.info.border,
    },
    levelChangeButtonText: {
      color: theme.color.text.inverse,
      fontSize: 12,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: 20,
      padding: 20,
      width: '100%',
      maxWidth: 480,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 16,
      textAlign: 'center',
    },
    levelOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: 8,
    },
    levelOptionActive: {
      backgroundColor: theme.color.brand.accentSoft,
      borderRadius: 8,
    },
    levelOptionName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    levelOptionMeta: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    levelOptionCheck: {
      fontSize: 18,
      color: theme.color.brand.accent,
      fontWeight: '700',
    },
    levelCancelButton: {
      marginTop: 12,
      backgroundColor: theme.color.surface.muted,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    levelCancelButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.body,
    },
  });
