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
import { customersService } from '@/services/api/customers';
import { Customer, CustomerType } from '@/types/customers';
import { AddButton } from '@/components/Navigation/AddButton';

interface CustomersScreenProps {
  navigation: any;
}

export const CustomersScreen: React.FC<CustomersScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  const handleMenuToggle = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (!Array.isArray(customers)) {
      setFilteredCustomers([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter(
        (customer) =>
          (customer.fullName &&
            customer.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (customer.documentNumber && customer.documentNumber.includes(searchQuery)) ||
          (customer.email && customer.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (customer.razonSocial &&
            customer.razonSocial.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (customer.nombreComercial &&
            customer.nombreComercial.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredCustomers(filtered);
    }
  }, [searchQuery, customers]);

  const loadCustomers = async (page: number = 1) => {
    try {
      setLoading(true);
      const response = await customersService.getCustomers({
        page,
        limit: pagination.limit,
        isActive: true,
      });

      setCustomers(response.data);

      const totalPages = Math.ceil(response.total / response.limit);
      setPagination({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: totalPages,
      });
    } catch (error: any) {
      console.error('Error loading customers:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'No se pudieron cargar los clientes';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCustomers(1);
    setRefreshing(false);
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
              await customersService.deleteCustomer(customer.id);
              Alert.alert('Éxito', 'Cliente eliminado correctamente');
              loadCustomers(pagination.page);
            } catch (error: any) {
              console.error('Error deleting customer:', error);
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo eliminar el cliente'
              );
            }
          },
        },
      ]
    );
  };

  const renderCustomerCard = (customer: Customer) => {
    const isPersona = customer.customerType === CustomerType.PERSONA;

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
              <Text style={styles.customerTypeText}>
                {isPersona ? '👤 PERSONA' : '🏢 EMPRESA'}
              </Text>
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

          {customer.email && (
            <Text style={styles.customerDetail}>📧 {customer.email}</Text>
          )}
          {customer.mobile && (
            <Text style={styles.customerDetail}>📱 {customer.mobile}</Text>
          )}
          {customer.direccion && (
            <Text style={styles.customerDetail} numberOfLines={1}>
              📍 {customer.direccion}
            </Text>
          )}
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
      <View style={styles.paginationContainer}>
        <TouchableOpacity
          style={[styles.paginationButton, pagination.page === 1 && styles.paginationButtonDisabled]}
          onPress={() => loadCustomers(pagination.page - 1)}
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

        <Text style={styles.paginationText}>
          Página {pagination.page} de {pagination.totalPages}
        </Text>

        <TouchableOpacity
          style={[
            styles.paginationButton,
            pagination.page === pagination.totalPages && styles.paginationButtonDisabled,
          ]}
          onPress={() => loadCustomers(pagination.page + 1)}
          disabled={pagination.page === pagination.totalPages}
        >
          <Text
            style={[
              styles.paginationButtonText,
              pagination.page === pagination.totalPages && styles.paginationButtonTextDisabled,
            ]}
          >
            Siguiente →
          </Text>
        </TouchableOpacity>
      </View>
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
              Clientes
            </Text>
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
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
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
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando clientes...</Text>
        </View>
      ) : filteredCustomers.length === 0 ? (
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredCustomers.map(renderCustomerCard)}
          {renderPagination()}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}

      {/* Add Button */}
      <ProtectedElement requiredPermissions={['customers.create']} fallback={null}>
        <AddButton onPress={handleAddCustomer} icon="👥" />
      </ProtectedElement>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
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
    color: '#475569',
  },
  menuIconTablet: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  headerTitleTablet: {
    fontSize: 24,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  headerSubtitleTablet: {
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  searchContainerTablet: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  searchIcon: {
    fontSize: 20,
    color: '#94A3B8',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#94A3B8',
    fontWeight: '600',
  },
  statsContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  customerCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
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
    backgroundColor: '#E3F2FD',
  },
  empresaBadge: {
    backgroundColor: '#FFF3E0',
  },
  customerTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
  },
  statusInactive: {
    backgroundColor: '#FFF3E0',
  },
  statusBlocked: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  customerInfo: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  customerDocument: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  customerDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  customerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#FFEBEE',
  },
  deleteButtonText: {
    color: '#D32F2F',
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
    backgroundColor: '#007AFF',
  },
  paginationButtonDisabled: {
    backgroundColor: '#ccc',
  },
  paginationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  paginationButtonTextDisabled: {
    color: '#999',
  },
  paginationText: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 100,
  },
});
