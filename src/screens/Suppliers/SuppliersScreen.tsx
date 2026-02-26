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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';

import { useMenuNavigation } from '@/hooks/useMenuNavigation';
import { suppliersService } from '@/services/api/suppliers';
import { Supplier } from '@/types/suppliers';
import { AddButton } from '@/components/Navigation/AddButton';
import { SUPPLIER_TYPE_LABELS, SUPPLIER_TYPE_ICONS, SUPPLIER_TYPE_COLORS } from '@/constants/supplierTypes';

interface SuppliersScreenProps {
  navigation: any;
}

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [chatBadge] = useState(3);
  const [notificationsBadge] = useState(7);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (!Array.isArray(suppliers)) {
      setFilteredSuppliers([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setFilteredSuppliers(suppliers);
    } else {
      const filtered = suppliers.filter(
        (supplier) =>
          (supplier.commercialName &&
            supplier.commercialName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (supplier.code && supplier.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (supplier.legalEntities &&
            supplier.legalEntities.some(
              (le) =>
                le.ruc.includes(searchQuery) ||
                le.legalName.toLowerCase().includes(searchQuery.toLowerCase())
            ))
      );
      setFilteredSuppliers(filtered);
    }
  }, [searchQuery, suppliers]);

  const loadSuppliers = async (page: number = 1) => {
    try {
      setLoading(true);
      const response = await suppliersService.getSuppliers({
        page,
        limit: pagination.limit,
        isActive: true,
      });

      setSuppliers(response.data);

      // Update pagination info - API returns flat structure
      const totalPages = Math.ceil(response.total / response.limit);
      setPagination({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: totalPages,
      });
    } catch (error: any) {
      console.error('Error loading suppliers:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudieron cargar los proveedores';
      Alert.alert('Error', errorMessage);
      setSuppliers([]);
      setFilteredSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSuppliers(1);
    setRefreshing(false);
  };

  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      loadSuppliers(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      loadSuppliers(pagination.page + 1);
    }
  };

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
          placeholder="Buscar por nombre, código o RUC..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Create Button */}
      <ProtectedElement requiredPermissions={['suppliers.create']} fallback={null}>
        <AddButton onPress={handleCreateSupplier} icon="🏢" />
      </ProtectedElement>

      {/* Suppliers List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={[styles.loadingText, isTablet && styles.loadingTextTablet]}>
              Cargando proveedores...
            </Text>
          </View>
        ) : filteredSuppliers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              {searchQuery ? 'No se encontraron proveedores' : 'No hay proveedores registrados'}
            </Text>
            {!searchQuery && (
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
            {filteredSuppliers.map(renderSupplierCard)}
          </View>
        )}
      </ScrollView>

      {/* Pagination Controls */}
      {!loading && pagination.total > 0 && !searchQuery && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[
              styles.paginationButton,
              pagination.page === 1 && styles.paginationButtonDisabled,
            ]}
            onPress={handlePreviousPage}
            disabled={pagination.page === 1}
          >
            <Text
              style={[
                styles.paginationButtonText,
                pagination.page === 1 && styles.paginationButtonTextDisabled,
              ]}
            >
              ← Anterior
            </Text>
          </TouchableOpacity>

          <View style={styles.paginationInfo}>
            <Text style={styles.paginationText}>
              Pág. {pagination.page}/{pagination.totalPages}
            </Text>
            <Text style={styles.paginationSubtext}>
              {filteredSuppliers.length} de {pagination.total}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.paginationButton,
              pagination.page >= pagination.totalPages && styles.paginationButtonDisabled,
            ]}
            onPress={handleNextPage}
            disabled={pagination.page >= pagination.totalPages}
          >
            <Text
              style={[
                styles.paginationButtonText,
                pagination.page >= pagination.totalPages && styles.paginationButtonTextDisabled,
              ]}
            >
              Siguiente →
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 24,
    color: '#475569',
  },
  menuIconTablet: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerTitleTablet: {
    fontSize: 24,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  headerSubtitleTablet: {
    fontSize: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchContainerTablet: {
    marginHorizontal: 32,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
  searchInputTablet: {
    fontSize: 17,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 18,
    color: '#94A3B8',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  contentContainerTablet: {
    paddingHorizontal: 32,
  },
  suppliersGrid: {
    gap: 16,
  },
  suppliersGridLandscape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  supplierCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  supplierCardTablet: {
    padding: 20,
    borderRadius: 20,
  },
  supplierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  supplierIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    color: '#1E293B',
    marginBottom: 2,
  },
  supplierNameTablet: {
    fontSize: 18,
  },
  supplierCode: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  supplierCodeTablet: {
    fontSize: 14,
  },
  supplierRuc: {
    fontSize: 12,
    color: '#94A3B8',
  },
  supplierRucTablet: {
    fontSize: 13,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  supplierDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailIcon: {
    fontSize: 14,
  },
  detailText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  detailTextTablet: {
    fontSize: 14,
  },
  debtSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  debtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debtLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  debtLabelTablet: {
    fontSize: 14,
  },
  debtAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  debtAmountTablet: {
    fontSize: 15,
  },
  debtAmountPositive: {
    color: '#EF4444',
  },
  debtAmountUnassigned: {
    color: '#F59E0B',
  },
  supplierFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
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
    marginTop: 16,
    fontSize: 15,
    color: '#64748B',
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
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 24,
  },
  emptyTextTablet: {
    fontSize: 18,
  },
  emptyButton: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  emptyButtonTablet: {
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyButtonTextTablet: {
    fontSize: 17,
  },
  paginationContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 60,
  },
  paginationInfo: {
    alignItems: 'center',
    minWidth: 100,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  paginationButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    minWidth: 110,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {
    color: '#94A3B8',
  },
  // v1.1.0 - Estilos para tipos de proveedor
  typesSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
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
    color: '#64748B',
    fontStyle: 'italic',
  },
  categorySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
});
