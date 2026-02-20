import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { transportService } from '@/services/api';
import { Driver, DriverStatus } from '@/types/transport';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';

interface DriversScreenProps {
  navigation: any;
}

export const DriversScreen: React.FC<DriversScreenProps> = ({ navigation }) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    filterDrivers();
  }, [searchQuery, drivers]);

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const response = await transportService.getDrivers({ limit: 1000 });
      setDrivers(response.data);
      setFilteredDrivers(response.data);
    } catch (error: any) {
      console.error('Error loading drivers:', error);
      Alert.alert('Error', 'No se pudieron cargar los conductores');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDrivers();
    setRefreshing(false);
  };

  const filterDrivers = () => {
    if (!searchQuery.trim()) {
      setFilteredDrivers(drivers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = drivers.filter(
      (driver) =>
        driver.nombre.toLowerCase().includes(query) ||
        driver.apellido.toLowerCase().includes(query) ||
        driver.numeroDocumento.includes(query) ||
        driver.numeroLicencia.toLowerCase().includes(query)
    );
    setFilteredDrivers(filtered);
  };

  const getStatusColor = (status: DriverStatus) => {
    switch (status) {
      case DriverStatus.ACTIVE:
        return '#10B981';
      case DriverStatus.INACTIVE:
        return '#6B7280';
      case DriverStatus.SUSPENDED:
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: DriverStatus) => {
    switch (status) {
      case DriverStatus.ACTIVE:
        return 'Activo';
      case DriverStatus.INACTIVE:
        return 'Inactivo';
      case DriverStatus.SUSPENDED:
        return 'Suspendido';
      default:
        return status;
    }
  };

  const renderDriverItem = ({ item }: { item: Driver }) => {
    const fullName = `${item.nombre} ${item.apellido}`;

    return (
      <TouchableOpacity
        style={styles.driverCard}
        onPress={() => {
          // TODO: Navigate to driver detail/edit screen
          Alert.alert('Conductor', fullName);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.driverHeader}>
          <View style={styles.driverIcon}>
            <Ionicons name="person-outline" size={24} color="#6366F1" />
          </View>
          <View style={styles.driverMainInfo}>
            <Text style={styles.driverName}>{fullName}</Text>
            <Text style={styles.driverDocument}>Doc: {item.numeroDocumento}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.driverDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>Licencia: {item.numeroLicencia}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="ribbon-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>Categoría: {item.categoriaLicencia}</Text>
          </View>
          {item.telefono && (
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={16} color="#6B7280" />
              <Text style={styles.detailText}>{item.telefono}</Text>
            </View>
          )}
          {item.email && (
            <View style={styles.detailRow}>
              <Ionicons name="mail-outline" size={16} color="#6B7280" />
              <Text style={styles.detailText}>{item.email}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ScreenLayout navigation={navigation}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Cargando conductores...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Conductores</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              // TODO: Navigate to create driver screen
              Alert.alert('Próximamente', 'Función de agregar conductor en desarrollo');
            }}
          >
            <Ionicons name="add" size={24} color="#6366F1" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre, documento o licencia..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* List */}
        {filteredDrivers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="person-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No se encontraron conductores' : 'No hay conductores registrados'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Intenta con otra búsqueda' : 'Agrega tu primer conductor'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredDrivers}
            renderItem={renderDriverItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#6366F1']} />
            }
          />
        )}
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  addButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  clearButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
  },
  listContent: {
    padding: 16,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverMainInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  driverDocument: {
    fontSize: 14,
    color: '#6B7280',
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
  driverDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
