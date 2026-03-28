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
          <Ionicons name="person-outline" size={24} color={isSelected ? colors.accent[500] : colors.neutral[500]} />
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
            <Text style={styles.headerTitle}>Seleccionar Conductor</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre, documento o licencia..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
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
              <Text style={styles.loadingText}>Cargando conductores...</Text>
            </View>
          ) : filteredDrivers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="person-outline" size={64} color={colors.neutral[300]} />
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
  driverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[2],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  driverItemSelected: {
    backgroundColor: colors.accent[50],
    borderColor: colors.accent[500],
  },
  driverIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  driverNameSelected: {
    color: colors.accent[500],
  },
  driverDetails: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  driverLicense: {
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
