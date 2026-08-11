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
import { Driver, DriverStatus } from '@/types/transport';
import { transportService } from '@/services/api';
import Alert from '@/utils/alert';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
          <Ionicons name="person-outline" size={24} color={isSelected ? theme.color.brand.accent : theme.color.text.muted} />
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
            <Text style={styles.headerTitle}>Seleccionar Conductor</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.color.text.muted} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={theme.color.text.placeholder} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre, documento o licencia..."
              placeholderTextColor={theme.color.text.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
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
              <Text style={styles.loadingText}>Cargando conductores...</Text>
            </View>
          ) : filteredDrivers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="person-outline" size={64} color={theme.color.border.default} />
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
    driverItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[2],
      borderWidth: 2,
      borderColor: 'transparent',
    },
    driverItemSelected: {
      backgroundColor: theme.color.brand.accentSoft,
      borderColor: theme.color.brand.accent,
    },
    driverIcon: {
      width: 48,
      height: 48,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.base,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    driverInfo: {
      flex: 1,
    },
    driverName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    driverNameSelected: {
      color: theme.color.brand.accent,
    },
    driverDetails: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginBottom: 2,
    },
    driverLicense: {
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
