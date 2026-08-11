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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Vehicle, VehicleStatus } from '@/types/transport';
import { transportService } from '@/services/api';
import Alert from '@/utils/alert';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
          <Ionicons name="car-outline" size={24} color={isSelected ? theme.color.brand.accent : theme.color.text.muted} />
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
          <Ionicons name="checkmark-circle" size={24} color={theme.color.brand.accent} />
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
              <Ionicons name="close" size={24} color={theme.color.text.muted} />
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
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.color.brand.accent} />
              <Text style={styles.loadingText}>Cargando vehículos...</Text>
            </View>
          ) : filteredVehicles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={64} color={theme.color.border.default} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: theme.radii['2xl'],
      borderTopRightRadius: theme.radii['2xl'],
      maxHeight: '80%',
      paddingBottom: theme.space[5],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    closeButton: {
      padding: 4,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.muted,
      borderRadius: theme.radii.xl,
      marginHorizontal: theme.space[5],
      marginTop: theme.space[4],
      marginBottom: theme.space[3],
      paddingHorizontal: theme.space[3],
    },
    searchIcon: {
      marginRight: theme.space[2],
    },
    searchInput: {
      flex: 1,
      paddingVertical: theme.space[3],
      fontSize: 16,
      color: theme.color.text.heading,
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
      marginTop: theme.space[3],
      fontSize: 16,
      color: theme.color.text.muted,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyText: {
      marginTop: theme.space[4],
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    emptySubtext: {
      marginTop: theme.space[2],
      fontSize: 14,
      color: theme.color.text.placeholder,
    },
    listContent: {
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[2],
    },
    vehicleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[2],
      borderWidth: 2,
      borderColor: 'transparent',
    },
    vehicleItemSelected: {
      backgroundColor: theme.color.brand.accentSoft,
      borderColor: theme.color.brand.accent,
    },
    vehicleIcon: {
      width: 48,
      height: 48,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.base,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    vehicleInfo: {
      flex: 1,
    },
    vehiclePlate: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    vehiclePlateSelected: {
      color: theme.color.brand.accent,
    },
    vehicleDetails: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginBottom: 2,
    },
    vehicleColor: {
      fontSize: 12,
      color: theme.color.text.placeholder,
    },
    footer: {
      paddingHorizontal: theme.space[5],
      paddingTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    footerText: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
    },
  });
