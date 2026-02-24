import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Vehicle, Driver, VehicleStatus, DriverStatus } from '@/types/transport';
import { transportService } from '@/services/api';

interface TransportSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (vehicle: Vehicle | null, driver: Driver | null) => void;
}

export const TransportSelectionModal: React.FC<TransportSelectionModalProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPublicTransport, setIsPublicTransport] = useState(true);

  useEffect(() => {
    if (visible) {
      loadData();
    } else {
      // Reset selections when modal closes
      setSelectedVehicle(null);
      setSelectedDriver(null);
      setIsPublicTransport(true);
    }
  }, [visible]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load vehicles and drivers in parallel
      const [vehiclesResponse, driversResponse] = await Promise.all([
        transportService.getVehicles({
          status: VehicleStatus.ACTIVE,
          isActive: true,
          limit: 1000,
        }),
        transportService.getDrivers({
          status: DriverStatus.ACTIVE,
          isActive: true,
          limit: 1000,
        }),
      ]);

      setVehicles(vehiclesResponse.data);
      setDrivers(driversResponse.data);

      // Auto-select first items if available
      if (vehiclesResponse.data.length > 0) {
        setSelectedVehicle(vehiclesResponse.data[0]);
      }
      if (driversResponse.data.length > 0) {
        setSelectedDriver(driversResponse.data[0]);
      }
    } catch (error: any) {
      console.error('Error loading transport data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos de transporte');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (isPublicTransport) {
      // Para transporte público, enviar null en ambos
      onConfirm(null, null);
      return;
    }

    if (!selectedVehicle) {
      Alert.alert('Error', 'Debes seleccionar un vehículo');
      return;
    }
    if (!selectedDriver) {
      Alert.alert('Error', 'Debes seleccionar un conductor');
      return;
    }

    onConfirm(selectedVehicle, selectedDriver);
  };

  const handlePublicTransportToggle = () => {
    setIsPublicTransport(!isPublicTransport);
    if (!isPublicTransport) {
      // Si se activa transporte público, limpiar selecciones
      setSelectedVehicle(null);
      setSelectedDriver(null);
    }
  };

  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (vehicle) {
      setSelectedVehicle(vehicle);
    }
  };

  const handleDriverChange = (driverId: string) => {
    const driver = drivers.find((d) => d.id === driverId);
    if (driver) {
      setSelectedDriver(driver);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Seleccionar Transporte</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>Cargando datos...</Text>
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Public Transport Option */}
              <TouchableOpacity
                style={[
                  styles.publicTransportCard,
                  isPublicTransport && styles.publicTransportCardActive,
                ]}
                onPress={handlePublicTransportToggle}
                activeOpacity={0.7}
              >
                <View style={styles.publicTransportHeader}>
                  <Ionicons
                    name={isPublicTransport ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={isPublicTransport ? '#10B981' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.publicTransportTitle,
                      isPublicTransport && styles.publicTransportTitleActive,
                    ]}
                  >
                    🚌 Transporte Público
                  </Text>
                </View>
                <Text style={styles.publicTransportSubtext}>
                  Generar guía sin asignar conductor ni vehículo
                </Text>
              </TouchableOpacity>

              {/* Vehicle Selection */}
              <View style={[styles.section, isPublicTransport && styles.sectionDisabled]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="car" size={24} color="#6366F1" />
                  <Text style={styles.sectionTitle}>Vehículo</Text>
                </View>

                {vehicles.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="car-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyText}>No hay vehículos disponibles</Text>
                    <Text style={styles.emptySubtext}>
                      Registra vehículos en Configuración
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={[styles.pickerContainer, isPublicTransport && styles.pickerDisabled]}>
                      <Picker
                        selectedValue={selectedVehicle?.id || ''}
                        onValueChange={handleVehicleChange}
                        style={styles.picker}
                        enabled={!isPublicTransport}
                      >
                        {vehicles.map((vehicle) => (
                          <Picker.Item
                            key={vehicle.id}
                            label={`${vehicle.numeroPlaca} - ${vehicle.marca} ${vehicle.modelo}`}
                            value={vehicle.id}
                          />
                        ))}
                      </Picker>
                    </View>

                    {/* Vehicle Details */}
                    {selectedVehicle && (
                      <View style={styles.detailsCard}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Placa:</Text>
                          <Text style={styles.detailValue}>{selectedVehicle.numeroPlaca}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Marca/Modelo:</Text>
                          <Text style={styles.detailValue}>
                            {selectedVehicle.marca} {selectedVehicle.modelo}
                          </Text>
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Driver Selection */}
              <View style={[styles.section, isPublicTransport && styles.sectionDisabled]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="person" size={24} color="#6366F1" />
                  <Text style={styles.sectionTitle}>Conductor</Text>
                </View>

                {drivers.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="person-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyText}>No hay conductores disponibles</Text>
                    <Text style={styles.emptySubtext}>
                      Registra conductores en Configuración
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={[styles.pickerContainer, isPublicTransport && styles.pickerDisabled]}>
                      <Picker
                        selectedValue={selectedDriver?.id || ''}
                        onValueChange={handleDriverChange}
                        style={styles.picker}
                        enabled={!isPublicTransport}
                      >
                        {drivers.map((driver) => (
                          <Picker.Item
                            key={driver.id}
                            label={`${driver.nombre} ${driver.apellido} - Lic: ${driver.numeroLicencia}`}
                            value={driver.id}
                          />
                        ))}
                      </Picker>
                    </View>

                    {/* Driver Details */}
                    {selectedDriver && (
                      <View style={styles.detailsCard}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Nombre:</Text>
                          <Text style={styles.detailValue}>
                            {selectedDriver.nombre} {selectedDriver.apellido}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Licencia:</Text>
                          <Text style={styles.detailValue}>
                            {selectedDriver.numeroLicencia} ({selectedDriver.categoriaLicencia})
                          </Text>
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>
            </ScrollView>
          )}

          {/* Footer with buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                (!isPublicTransport && (!selectedVehicle || !selectedDriver) || loading) && styles.buttonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!isPublicTransport && (!selectedVehicle || !selectedDriver) || loading}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxWidth: 600,
    height: 600,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  section: {
    marginTop: 12,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  detailsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#9CA3AF',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmButton: {
    backgroundColor: '#6366F1',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    backgroundColor: '#D1D5DB',
    opacity: 0.6,
  },
  publicTransportCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  publicTransportCardActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  publicTransportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  publicTransportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  publicTransportTitleActive: {
    color: '#10B981',
  },
  publicTransportSubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 32,
  },
  sectionDisabled: {
    opacity: 0.4,
  },
  pickerDisabled: {
    opacity: 0.5,
  },
});
