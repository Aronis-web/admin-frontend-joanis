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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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
          <Ionicons name="car-outline" size={24} color={isSelected ? colors.accent[500] : colors.neutral[500]} />
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
          <Ionicons name="checkmark-circle" size={24} color={colors.accent[500]} />
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
              <Ionicons name="close" size={24} color={colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por placa, marca o modelo..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={colors.neutral[400]} />
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent[500]} />
              <Text style={styles.loadingText}>Cargando vehículos...</Text>
            </View>
          ) : filteredVehicles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={64} color={colors.neutral[300]} />
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
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '80%',
    paddingBottom: spacing[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.neutral[800],
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    marginBottom: spacing[3],
    paddingHorizontal: spacing[3],
  },
  searchIcon: {
    marginRight: spacing[2],
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.neutral[800],
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
    marginTop: spacing[3],
    fontSize: 16,
    color: colors.neutral[500],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: spacing[4],
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  emptySubtext: {
    marginTop: spacing[2],
    fontSize: 14,
    color: colors.neutral[400],
  },
  listContent: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[2],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  vehicleItemSelected: {
    backgroundColor: colors.accent[50],
    borderColor: colors.accent[500],
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  vehicleInfo: {
    flex: 1,
  },
  vehiclePlate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  vehiclePlateSelected: {
    color: colors.accent[500],
  },
  vehicleDetails: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  vehicleColor: {
    fontSize: 12,
    color: colors.neutral[400],
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  footerText: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
});
