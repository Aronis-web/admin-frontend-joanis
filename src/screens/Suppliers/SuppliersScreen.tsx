import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';

import { useMenuNavigation } from '@/hooks/useMenuNavigation';
import { suppliersService } from '@/services/api/suppliers';
import { Supplier, SupplierType } from '@/types/suppliers';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { SUPPLIER_TYPE_LABELS, SUPPLIER_TYPE_ICONS, SUPPLIER_TYPE_COLORS } from '@/constants/supplierTypes';
import { Pagination } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface SuppliersScreenProps {
  navigation: any;
}

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, logout } = useAuthStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<keyof typeof SupplierType | 'ALL'>('ALL');
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [chatBadge] = useState(3);
  const [notificationsBadge] = useState(7);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      // Reset to page 1 when search changes
      if (searchQuery !== debouncedSearchQuery) {
        setPage(1);
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Load suppliers when page, search, or type filter changes
  useEffect(() => {
    loadSuppliers();
  }, [page, debouncedSearchQuery, selectedType]);

  // Reset to page 1 when type filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedType]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);

      // Build search params
      const params: any = {
        page,
        limit: 20,
        isActive: true,
      };

      // Add search query if present
      if (debouncedSearchQuery.trim()) {
        params.query = debouncedSearchQuery.trim();
      }

      // Add type filter if selected
      if (selectedType !== 'ALL') {
        params.primaryType = selectedType;
      }

      // Use standard endpoint (search endpoint not yet implemented in backend)
      const response = await suppliersService.getSuppliers(params);

      console.log('🔍 Suppliers search results:', {
        query: debouncedSearchQuery,
        type: selectedType,
        page: response.page,
        total: response.total,
        totalPages: response.totalPages,
        itemsInPage: response.data.length,
      });

      setSuppliers(response.data);

      // Update pagination from meta
      setPagination({
        page: response.page || page,
        limit: response.limit || 20,
        total: response.total || 0,
        totalPages: response.totalPages || 0,
      });
    } catch (error: any) {
      console.error('❌ Error loading suppliers:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudieron cargar los proveedores';
      Alert.alert('Error', errorMessage);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await loadSuppliers();
    setRefreshing(false);
  }, [debouncedSearchQuery, selectedType]);

  const handlePreviousPage = useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    }
  }, [page]);

  const handleNextPage = useCallback(() => {
    if (page < pagination.totalPages) {
      setPage(page + 1);
    }
  }, [page, pagination.totalPages]);

  const handleMenuToggle = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  // Use the shared navigation hook for consistent menu navigation
  const navigateFromMenu = useMenuNavigation(navigation);

  const handleMenuSelect = (menuId: string) => {
    setIsMenuVisible(false);
    navigateFromMenu(menuId);
  };

  const handleLogout = async () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleSupplierPress = (supplier: Supplier) => {
    navigation.navigate('SupplierDetail', { supplierId: supplier.id });
  };

  const handleCreateSupplier = () => {
    navigation.navigate('SupplierDetail', { supplierId: null });
  };

  const formatCurrency = (cents?: number) => {
    if (cents === undefined || cents === null) {
      return 'S/ 0.00';
    }
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  const getPrimaryLegalEntity = (supplier: Supplier) => {
    return supplier.legalEntities?.find((le) => le.isPrimary);
  };

  const renderSupplierCard = (supplier: Supplier) => {
    const primaryEntity = getPrimaryLegalEntity(supplier);
    const totalDebt =
      supplier.companyDebts?.reduce((sum, debt) => sum + debt.totalDebtCents, 0) || 0;
    const unassignedBalance = supplier.unassignedBalance?.unassignedBalanceCents || 0;

    return (
      <TouchableOpacity
        key={supplier.id}
        style={[styles.supplierCard, isTablet && styles.supplierCardTablet]}
        onPress={() => handleSupplierPress(supplier)}
        activeOpacity={0.7}
      >
        <View style={styles.supplierHeader}>
          <View style={styles.supplierIcon}>
            <Text style={styles.supplierIconText}>🏭</Text>
          </View>
          <View style={styles.supplierInfo}>
            <Text style={[styles.supplierName, isTablet && styles.supplierNameTablet]}>
              {supplier.commercialName}
            </Text>
            <Text style={[styles.supplierCode, isTablet && styles.supplierCodeTablet]}>
              {supplier.code}
            </Text>
            {primaryEntity && (
              <Text style={[styles.supplierRuc, isTablet && styles.supplierRucTablet]}>
                RUC: {primaryEntity.ruc}
              </Text>
            )}
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{supplier.isActive ? '✓' : '✗'}</Text>
          </View>
        </View>

        {/* v1.1.0 - Tipos de Proveedor */}
        {supplier.primaryType && (
          <View style={styles.typesSection}>
            <View style={[styles.typeBadge, { backgroundColor: SUPPLIER_TYPE_COLORS[supplier.primaryType] + '20' }]}>
              <Text style={styles.typeBadgeIcon}>{SUPPLIER_TYPE_ICONS[supplier.primaryType]}</Text>
              <Text style={[styles.typeBadgeText, { color: SUPPLIER_TYPE_COLORS[supplier.primaryType] }]}>
                {SUPPLIER_TYPE_LABELS[supplier.primaryType]}
              </Text>
            </View>
            {supplier.supplierTypes && supplier.supplierTypes.length > 1 && (
              <Text style={styles.additionalTypesText}>
                +{supplier.supplierTypes.length - 1} más
              </Text>
            )}
          </View>
        )}

        {/* v1.1.0 - Categoría */}
        {supplier.category && (
          <View style={styles.categorySection}>
            <Text style={styles.categoryText}>📂 {supplier.category}</Text>
            {supplier.rating && (
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingText}>⭐ {supplier.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.supplierDetails}>
          {supplier.email && (
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>📧</Text>
              <Text style={[styles.detailText, isTablet && styles.detailTextTablet]}>
                {supplier.email}
              </Text>
            </View>
          )}
          {supplier.phone && (
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>📱</Text>
              <Text style={[styles.detailText, isTablet && styles.detailTextTablet]}>
                {supplier.phone}
              </Text>
            </View>
          )}
          {supplier.addressLine1 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>📍</Text>
              <Text
                style={[styles.detailText, isTablet && styles.detailTextTablet]}
                numberOfLines={1}
              >
                {supplier.addressLine1}
                {supplier.district && `, ${supplier.district}`}
              </Text>
            </View>
          )}
        </View>

        {(totalDebt !== 0 || unassignedBalance !== 0) && (
          <View style={styles.debtSection}>
            <View style={styles.debtRow}>
              <Text style={[styles.debtLabel, isTablet && styles.debtLabelTablet]}>
                Deuda Total:
              </Text>
              <Text
                style={[
                  styles.debtAmount,
                  isTablet && styles.debtAmountTablet,
                  totalDebt > 0 && styles.debtAmountPositive,
                ]}
              >
                {formatCurrency(totalDebt)}
              </Text>
            </View>
            {unassignedBalance !== 0 && (
              <View style={styles.debtRow}>
                <Text style={[styles.debtLabel, isTablet && styles.debtLabelTablet]}>
                  Sin Asignar:
                </Text>
                <Text
                  style={[
                    styles.debtAmount,
                    isTablet && styles.debtAmountTablet,
                    styles.debtAmountUnassigned,
                  ]}
                >
                  {formatCurrency(unassignedBalance)}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.supplierFooter}>
          <Text style={[styles.footerText, isTablet && styles.footerTextTablet]}>
            {supplier.legalEntities?.length || 0} Razón(es) Social(es)
          </Text>
          <Text style={[styles.footerText, isTablet && styles.footerTextTablet]}>
            {supplier.contacts?.length || 0} Contacto(s)
          </Text>
        </View>
      </TouchableOpacity>
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
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Proveedores
            </Text>
            <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
              Gestión de Proveedores
            </Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, isTablet && styles.searchContainerTablet]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, isTablet && styles.searchInputTablet]}
          placeholder="Buscar por nombre, código, RUC, categoría..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.color.text.placeholder}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
        {searchQuery !== debouncedSearchQuery && (
          <ActivityIndicator size="small" color={theme.color.brand.accent} style={styles.searchLoader} />
        )}
      </View>

      {/* Type Filter */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Tipo:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'ALL' && styles.filterChipActive]}
            onPress={() => setSelectedType('ALL')}
          >
            <Text style={[styles.filterChipText, selectedType === 'ALL' && styles.filterChipTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'MERCHANDISE' && styles.filterChipActive]}
            onPress={() => setSelectedType('MERCHANDISE')}
          >
            <Text style={styles.filterChipIcon}>{SUPPLIER_TYPE_ICONS.MERCHANDISE}</Text>
            <Text style={[styles.filterChipText, selectedType === 'MERCHANDISE' && styles.filterChipTextActive]}>
              Mercadería
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'SERVICES' && styles.filterChipActive]}
            onPress={() => setSelectedType('SERVICES')}
          >
            <Text style={styles.filterChipIcon}>{SUPPLIER_TYPE_ICONS.SERVICES}</Text>
            <Text style={[styles.filterChipText, selectedType === 'SERVICES' && styles.filterChipTextActive]}>
              Servicios
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'UTILITIES' && styles.filterChipActive]}
            onPress={() => setSelectedType('UTILITIES')}
          >
            <Text style={styles.filterChipIcon}>{SUPPLIER_TYPE_ICONS.UTILITIES}</Text>
            <Text style={[styles.filterChipText, selectedType === 'UTILITIES' && styles.filterChipTextActive]}>
              Servicios Públicos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'RENT' && styles.filterChipActive]}
            onPress={() => setSelectedType('RENT')}
          >
            <Text style={styles.filterChipIcon}>{SUPPLIER_TYPE_ICONS.RENT}</Text>
            <Text style={[styles.filterChipText, selectedType === 'RENT' && styles.filterChipTextActive]}>
              Alquiler
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'PAYROLL' && styles.filterChipActive]}
            onPress={() => setSelectedType('PAYROLL')}
          >
            <Text style={styles.filterChipIcon}>{SUPPLIER_TYPE_ICONS.PAYROLL}</Text>
            <Text style={[styles.filterChipText, selectedType === 'PAYROLL' && styles.filterChipTextActive]}>
              Nómina
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'TAXES' && styles.filterChipActive]}
            onPress={() => setSelectedType('TAXES')}
          >
            <Text style={styles.filterChipIcon}>{SUPPLIER_TYPE_ICONS.TAXES}</Text>
            <Text style={[styles.filterChipText, selectedType === 'TAXES' && styles.filterChipTextActive]}>
              Impuestos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'LOANS' && styles.filterChipActive]}
            onPress={() => setSelectedType('LOANS')}
          >
            <Text style={styles.filterChipIcon}>{SUPPLIER_TYPE_ICONS.LOANS}</Text>
            <Text style={[styles.filterChipText, selectedType === 'LOANS' && styles.filterChipTextActive]}>
              Préstamos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'INSURANCE' && styles.filterChipActive]}
            onPress={() => setSelectedType('INSURANCE')}
          >
            <Text style={styles.filterChipIcon}>{SUPPLIER_TYPE_ICONS.INSURANCE}</Text>
            <Text style={[styles.filterChipText, selectedType === 'INSURANCE' && styles.filterChipTextActive]}>
              Seguros
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'MAINTENANCE' && styles.filterChipActive]}
            onPress={() => setSelectedType('MAINTENANCE')}
          >
            <Text style={styles.filterChipIcon}>{SUPPLIER_TYPE_ICONS.MAINTENANCE}</Text>
            <Text style={[styles.filterChipText, selectedType === 'MAINTENANCE' && styles.filterChipTextActive]}>
              Mantenimiento
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'TRANSPORT' && styles.filterChipActive]}
            onPress={() => setSelectedType('TRANSPORT')}
          >
            <Text style={styles.filterChipIcon}>{SUPPLIER_TYPE_ICONS.TRANSPORT}</Text>
            <Text style={[styles.filterChipText, selectedType === 'TRANSPORT' && styles.filterChipTextActive]}>
              Transporte
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === 'OTHER' && styles.filterChipActive]}
            onPress={() => setSelectedType('OTHER')}
          >
            <Text style={styles.filterChipIcon}>{SUPPLIER_TYPE_ICONS.OTHER}</Text>
            <Text style={[styles.filterChipText, selectedType === 'OTHER' && styles.filterChipTextActive]}>
              Otros
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Suppliers List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
            <Text style={[styles.loadingText, isTablet && styles.loadingTextTablet]}>
              Cargando proveedores...
            </Text>
          </View>
        ) : suppliers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              {debouncedSearchQuery || selectedType !== 'ALL'
                ? 'No se encontraron proveedores con los filtros aplicados'
                : 'No hay proveedores registrados'}
            </Text>
            {!debouncedSearchQuery && selectedType === 'ALL' && (
              <ProtectedElement requiredPermissions={['suppliers.create']} fallback={null}>
                <TouchableOpacity
                  style={[styles.emptyButton, isTablet && styles.emptyButtonTablet]}
                  onPress={handleCreateSupplier}
                >
                  <Text style={[styles.emptyButtonText, isTablet && styles.emptyButtonTextTablet]}>
                    Crear Primer Proveedor
                  </Text>
                </TouchableOpacity>
              </ProtectedElement>
            )}
          </View>
        ) : (
          <View
            style={[styles.suppliersGrid, isTablet && isLandscape && styles.suppliersGridLandscape]}
          >
            {suppliers.map(renderSupplierCard)}
          </View>
        )}
      </ScrollView>

      {/* Pagination Controls */}
      {!loading && pagination.total > 0 && (
        <Pagination
          currentPage={page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={setPage}
          loading={loading}
        />
      )}

      {/* Create Button */}
      <ProtectedFAB
        actions={[
          {
            icon: 'business-outline',
            label: 'Crear Proveedor',
            onPress: handleCreateSupplier,
            requiredPermissions: ['suppliers.create'],
          },
        ]}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  headerTablet: {
    paddingHorizontal: theme.space[8],
    paddingVertical: theme.space[5],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[4],
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.surface.muted,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  headerTitleTablet: {
    fontSize: 24,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.color.text.muted,
    marginTop: 2,
  },
  headerSubtitleTablet: {
    fontSize: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    marginHorizontal: theme.space[5],
    marginVertical: theme.space[4],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
  },
  searchContainerTablet: {
    marginHorizontal: theme.space[8],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3.5],
  },
  searchIcon: {
    fontSize: 20,
    marginRight: theme.space[3],
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.color.text.body,
  },
  searchInputTablet: {
    fontSize: 17,
  },
  clearButton: {
    padding: theme.space[1],
  },
  clearButtonText: {
    fontSize: 18,
    color: theme.color.text.placeholder,
  },
  searchLoader: {
    marginLeft: theme.space[2],
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.muted,
    marginRight: theme.space[3],
  },
  filterScroll: {
    flex: 1,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.muted,
    marginRight: theme.space[2],
    gap: theme.space[1],
  },
  filterChipActive: {
    backgroundColor: theme.color.brand.accent,
  },
  filterChipIcon: {
    fontSize: 14,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.text.muted,
  },
  filterChipTextActive: {
    color: theme.color.text.inverse,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.space[5],
    paddingBottom: 100,
  },
  contentContainerTablet: {
    paddingHorizontal: theme.space[8],
  },
  suppliersGrid: {
    gap: theme.space[4],
  },
  suppliersGridLandscape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[5],
  },
  supplierCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii['2xl'],
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  supplierCardTablet: {
    padding: theme.space[5],
    borderRadius: theme.radii['2xl'],
  },
  supplierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[3],
  },
  supplierIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.surface.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  supplierIconText: {
    fontSize: 24,
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 2,
  },
  supplierNameTablet: {
    fontSize: 18,
  },
  supplierCode: {
    fontSize: 13,
    color: theme.color.text.muted,
    marginBottom: 2,
  },
  supplierCodeTablet: {
    fontSize: 14,
  },
  supplierRuc: {
    fontSize: 12,
    color: theme.color.text.subtle,
  },
  supplierRucTablet: {
    fontSize: 13,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.state.success.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadgeText: {
    color: theme.color.text.inverse,
    fontSize: 16,
    fontWeight: '700',
  },
  supplierDetails: {
    gap: theme.space[2],
    marginBottom: theme.space[3],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
  },
  detailIcon: {
    fontSize: 14,
  },
  detailText: {
    fontSize: 13,
    color: theme.color.text.muted,
    flex: 1,
  },
  detailTextTablet: {
    fontSize: 14,
  },
  debtSection: {
    backgroundColor: theme.color.background.subtle,
    borderRadius: theme.radii.md,
    padding: theme.space[3],
    marginBottom: theme.space[3],
    gap: theme.space[1.5],
  },
  debtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debtLabel: {
    fontSize: 13,
    color: theme.color.text.muted,
    fontWeight: '500',
  },
  debtLabelTablet: {
    fontSize: 14,
  },
  debtAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  debtAmountTablet: {
    fontSize: 15,
  },
  debtAmountPositive: {
    color: theme.color.text.danger,
  },
  debtAmountUnassigned: {
    color: theme.color.text.warning,
  },
  supplierFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.space[3],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  footerText: {
    fontSize: 12,
    color: theme.color.text.subtle,
  },
  footerTextTablet: {
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: theme.space[4],
    fontSize: 15,
    color: theme.color.text.muted,
  },
  loadingTextTablet: {
    fontSize: 17,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.space[4],
  },
  emptyText: {
    fontSize: 16,
    color: theme.color.text.muted,
    marginBottom: theme.space[6],
  },
  emptyTextTablet: {
    fontSize: 18,
  },
  emptyButton: {
    backgroundColor: theme.color.brand.accent,
    paddingVertical: theme.space[3.5],
    paddingHorizontal: theme.space[8],
    borderRadius: theme.radii.lg,
  },
  emptyButtonTablet: {
    paddingVertical: theme.space[4],
    paddingHorizontal: theme.space[10],
  },
  emptyButtonText: {
    color: theme.color.text.inverse,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyButtonTextTablet: {
    fontSize: 17,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.color.surface.base,
    borderTopWidth: 2,
    borderTopColor: theme.color.brand.accent,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space[4],
    ...theme.shadow.md,
  },
  paginationInfo: {
    alignItems: 'center',
    minWidth: 120,
    flex: 1,
  },
  paginationText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  paginationSubtext: {
    fontSize: 13,
    color: theme.color.text.muted,
    marginTop: 4,
    fontWeight: '500',
  },
  paginationButton: {
    paddingVertical: theme.space[3.5],
    paddingHorizontal: theme.space[6],
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.brand.accent,
    minWidth: 120,
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  paginationButtonDisabled: {
    backgroundColor: theme.color.surface.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  paginationButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.text.inverse,
  },
  paginationButtonTextDisabled: {
    color: theme.color.text.disabled,
  },
  typesSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[2],
    gap: theme.space[2],
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[2.5],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.lg,
    gap: theme.space[1],
  },
  typeBadgeIcon: {
    fontSize: 14,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  additionalTypesText: {
    fontSize: 11,
    color: theme.color.text.muted,
    fontStyle: 'italic',
  },
  categorySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space[2],
  },
  categoryText: {
    fontSize: 12,
    color: theme.color.text.muted,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: theme.color.text.warning,
    fontWeight: '600',
  },
});
