import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Vehicle, VehicleStatus } from '@/types/transport';
import { transportService } from '@/services/api';

interface VehicleSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (vehicle: Vehicle) => void;
  selectedVehicleId?: string;
}

export const VehicleSelectionModal: React.FC<VehicleSelectionModalProps> = ({
  visible,
  onClose,
  onSelect,
  selectedVehicleId,
}) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      loadVehicles();
    }
  }, [visible]);

  useEffect(() => {
    filterVehicles();
  }, [searchQuery, vehicles]);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const response = await transportService.getVehicles({
        status: VehicleStatus.ACTIVE,
        isActive: true,
        limit: 1000,
      });
      setVehicles(response.data);
      setFilteredVehicles(response.data);
    } catch (error: any) {
      console.error('Error loading vehicles:', error);
      Alert.alert('Error', 'No se pudieron cargar los vehículos');
    } finally {
      setLoading(false);
    }
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

  const handleSelect = (vehicle: Vehicle) => {
    onSelect(vehicle);
    onClose();
  };

  const renderVehicleItem = ({ item }: { item: Vehicle }) => {
    const isSelected = item.id === selectedVehicleId;

    return (
      <TouchableOpacity
        style={[styles.vehicleItem, isSelected && styles.vehicleItemSelected]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.vehicleIcon}>
          <Ionicons name="car-outline" size={24} color={isSelected ? '#6366F1' : '#6B7280'} />
        </View>
        <View style={styles.vehicleInfo}>
          <Text style={[styles.vehiclePlate, isSelected && styles.vehiclePlateSelected]}>
            {item.numeroPlaca}
          </Text>
          <Text style={styles.vehicleDetails}>
            {item.marca} {item.modelo} {item.anio ? `(${item.anio})` : ''}
          </Text>
          {item.color && <Text style={styles.vehicleColor}>Color: {item.color}</Text>}
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Seleccionar Vehículo</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por placa, marca o modelo..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>Cargando vehículos...</Text>
            </View>
          ) : filteredVehicles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No se encontraron vehículos' : 'No hay vehículos disponibles'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery
                  ? 'Intenta con otra búsqueda'
                  : 'Registra vehículos en Configuración'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredVehicles}
              renderItem={renderVehicleItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {filteredVehicles.length} vehículo{filteredVehicles.length !== 1 ? 's' : ''}{' '}
              disponible{filteredVehicles.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
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
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  vehicleItemSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehiclePlate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  vehiclePlateSelected: {
    color: '#6366F1',
  },
  vehicleDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  vehicleColor: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
