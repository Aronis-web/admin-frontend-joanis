import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { transportService } from '@/services/api';
import { Vehicle, VehicleStatus } from '@/types/transport';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { AddButton } from '@/components/Navigation/AddButton';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

interface VehiclesScreenProps {
  navigation: any;
}

export const VehiclesScreen: React.FC<VehiclesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    filterVehicles();
  }, [searchQuery, vehicles]);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const response = await transportService.getVehicles({ limit: 1000 });
      setVehicles(response.data);
      setFilteredVehicles(response.data);
    } catch (error: any) {
      console.error('Error loading vehicles:', error);
      Alert.alert('Error', 'No se pudieron cargar los vehículos');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVehicles();
    setRefreshing(false);
  };

  const filterVehicles = () => {
    if (!searchQuery.trim()) {
      setFilteredVehicles(vehicles);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = vehicles.filter(
      (vehicle) =>
        vehicle.numeroPlaca.toLowerCase().includes(query) ||
        vehicle.marca.toLowerCase().includes(query) ||
        vehicle.modelo.toLowerCase().includes(query)
    );
    setFilteredVehicles(filtered);
  };

  const getStatusColors = (status: VehicleStatus) => {
    switch (status) {
      case VehicleStatus.ACTIVE:
        return {
          bg: theme.color.state.success.background,
          text: theme.color.state.success.text,
        };
      case VehicleStatus.MAINTENANCE:
        return {
          bg: theme.color.state.warning.background,
          text: theme.color.state.warning.text,
        };
      case VehicleStatus.OUT_OF_SERVICE:
        return {
          bg: theme.color.state.danger.background,
          text: theme.color.state.danger.text,
        };
      case VehicleStatus.INACTIVE:
      default:
        return {
          bg: theme.color.surface.muted,
          text: theme.color.text.muted,
        };
    }
  };

  const getStatusLabel = (status: VehicleStatus) => {
    switch (status) {
      case VehicleStatus.ACTIVE:
        return 'Activo';
      case VehicleStatus.INACTIVE:
        return 'Inactivo';
      case VehicleStatus.MAINTENANCE:
        return 'Mantenimiento';
      case VehicleStatus.OUT_OF_SERVICE:
        return 'Fuera de Servicio';
      default:
        return status;
    }
  };

  const handleAddVehicle = () => {
    navigation.navigate('VehicleDetail', {});
  };

  const handleVehiclePress = (vehicle: Vehicle) => {
    navigation.navigate('VehicleDetail', { vehicleId: vehicle.id });
  };

  const renderVehicleItem = ({ item }: { item: Vehicle }) => {
    const statusColors = getStatusColors(item.status);
    return (
      <TouchableOpacity
        style={styles.vehicleCard}
        onPress={() => handleVehiclePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.vehicleHeader}>
          <View style={styles.vehicleIcon}>
            <Ionicons name="car-outline" size={24} color={theme.color.brand.accent} />
          </View>
          <View style={styles.vehicleMainInfo}>
            <Text style={styles.vehiclePlate}>{item.numeroPlaca}</Text>
            <Text style={styles.vehicleModel}>
              {item.marca} {item.modelo} {item.anio ? `(${item.anio})` : ''}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.vehicleDetails}>
          {item.color && (
            <View style={styles.detailRow}>
              <Ionicons name="color-palette-outline" size={16} color={theme.color.text.muted} />
              <Text style={styles.detailText}>Color: {item.color}</Text>
            </View>
          )}
          {item.capacidadCargaKg && (
            <View style={styles.detailRow}>
              <Ionicons name="cube-outline" size={16} color={theme.color.text.muted} />
              <Text style={styles.detailText}>Capacidad: {item.capacidadCargaKg} kg</Text>
            </View>
          )}
          {item.numeroAutorizacion && (
            <View style={styles.detailRow}>
              <Ionicons name="document-text-outline" size={16} color={theme.color.text.muted} />
              <Text style={styles.detailText}>Autorización: {item.numeroAutorizacion}</Text>
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
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
            <Text style={styles.loadingText}>Cargando vehículos...</Text>
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
            <Ionicons name="arrow-back" size={24} color={theme.color.text.heading} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vehículos</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddVehicle}
          >
            <Ionicons name="add" size={24} color={theme.color.brand.accent} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.color.text.placeholder} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por placa, marca o modelo..."
            placeholderTextColor={theme.color.text.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={theme.color.text.placeholder} />
            </TouchableOpacity>
          )}
        </View>

        {/* List */}
        {filteredVehicles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="car-outline" size={64} color={theme.color.border.default} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No se encontraron vehículos' : 'No hay vehículos registrados'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Intenta con otra búsqueda' : 'Agrega tu primer vehículo'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredVehicles}
            renderItem={renderVehicleItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.color.brand.accent]}
                tintColor={theme.color.brand.accent}
              />
            }
          />
        )}

        {/* Floating Add Button */}
        <AddButton onPress={handleAddVehicle} />
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
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    addButton: {
      padding: 8,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.color.text.heading,
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
      color: theme.color.text.muted,
    },
    emptySubtext: {
      marginTop: 8,
      fontSize: 14,
      color: theme.color.text.placeholder,
    },
    listContent: {
      padding: 16,
    },
    vehicleCard: {
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
    vehicleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    vehicleIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.color.brand.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    vehicleMainInfo: {
      flex: 1,
    },
    vehiclePlate: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: 4,
    },
    vehicleModel: {
      fontSize: 14,
      color: theme.color.text.muted,
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
    vehicleDetails: {
      gap: 8,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
  });
