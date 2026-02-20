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
import { Driver, DriverStatus } from '@/types/transport';
import { transportService } from '@/services/api';

interface DriverSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (driver: Driver) => void;
  selectedDriverId?: string;
}

export const DriverSelectionModal: React.FC<DriverSelectionModalProps> = ({
  visible,
  onClose,
  onSelect,
  selectedDriverId,
}) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      loadDrivers();
    }
  }, [visible]);

  useEffect(() => {
    filterDrivers();
  }, [searchQuery, drivers]);

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const response = await transportService.getDrivers({
        status: DriverStatus.ACTIVE,
        isActive: true,
        limit: 1000,
      });
      setDrivers(response.data);
      setFilteredDrivers(response.data);
    } catch (error: any) {
      console.error('Error loading drivers:', error);
      Alert.alert('Error', 'No se pudieron cargar los conductores');
    } finally {
      setLoading(false);
    }
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

  const handleSelect = (driver: Driver) => {
    onSelect(driver);
    onClose();
  };

  const renderDriverItem = ({ item }: { item: Driver }) => {
    const isSelected = item.id === selectedDriverId;
    const fullName = `${item.nombre} ${item.apellido}`;

    return (
      <TouchableOpacity
        style={[styles.driverItem, isSelected && styles.driverItemSelected]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.driverIcon}>
          <Ionicons name="person-outline" size={24} color={isSelected ? '#6366F1' : '#6B7280'} />
        </View>
        <View style={styles.driverInfo}>
          <Text style={[styles.driverName, isSelected && styles.driverNameSelected]}>
            {fullName}
          </Text>
          <Text style={styles.driverDetails}>
            Doc: {item.numeroDocumento} • Lic: {item.numeroLicencia}
          </Text>
          <Text style={styles.driverLicense}>Categoría: {item.categoriaLicencia}</Text>
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
            <Text style={styles.headerTitle}>Seleccionar Conductor</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
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
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>Cargando conductores...</Text>
            </View>
          ) : filteredDrivers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="person-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No se encontraron conductores' : 'No hay conductores disponibles'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery
                  ? 'Intenta con otra búsqueda'
                  : 'Registra conductores en Configuración'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredDrivers}
              renderItem={renderDriverItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {filteredDrivers.length} conductor{filteredDrivers.length !== 1 ? 'es' : ''}{' '}
              disponible{filteredDrivers.length !== 1 ? 's' : ''}
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
  driverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  driverItemSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  driverIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  driverNameSelected: {
    color: '#6366F1',
  },
  driverDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  driverLicense: {
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
