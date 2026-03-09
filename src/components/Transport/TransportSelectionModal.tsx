import React, { useState, useEffect, useMemo } from 'react';
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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Vehicle,
  Driver,
  VehicleStatus,
  DriverStatus,
  Transporter,
  TransporterStatus,
  CreateVehicleRequest,
  CreateDriverRequest,
  CreateTransporterRequest,
  VehicleType,
  DocumentType,
  TransporterDocumentType,
} from '@/types/transport';
import { transportService } from '@/services/api';

interface TransportSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (vehicle: Vehicle | null, driver: Driver | null, transporter: Transporter | null) => void;
}

export const TransportSelectionModal: React.FC<TransportSelectionModalProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [selectedTransporter, setSelectedTransporter] = useState<Transporter | null>(null);
  const [loading, setLoading] = useState(false);
  const [transportType, setTransportType] = useState<'public' | 'private' | null>(null);

  // Search states
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [transporterSearch, setTransporterSearch] = useState('');

  // Create modals states
  const [showCreateVehicle, setShowCreateVehicle] = useState(false);
  const [showCreateDriver, setShowCreateDriver] = useState(false);
  const [showCreateTransporter, setShowCreateTransporter] = useState(false);

  // Dropdown visibility states
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [showTransporterDropdown, setShowTransporterDropdown] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
    } else {
      // Reset selections when modal closes
      setSelectedVehicle(null);
      setSelectedDriver(null);
      setSelectedTransporter(null);
      setTransportType(null);
      setVehicleSearch('');
      setDriverSearch('');
      setTransporterSearch('');
      setShowVehicleDropdown(false);
      setShowDriverDropdown(false);
      setShowTransporterDropdown(false);
    }
  }, [visible]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load vehicles, drivers, and transporters in parallel
      const [vehiclesResponse, driversResponse, transportersResponse] = await Promise.all([
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
        transportService.getTransporters({
          status: TransporterStatus.ACTIVE,
          isActive: true,
          limit: 1000,
        }),
      ]);

      setVehicles(vehiclesResponse.data);
      setDrivers(driversResponse.data);
      setTransporters(transportersResponse.data);
    } catch (error: any) {
      console.error('Error loading transport data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos de transporte');
    } finally {
      setLoading(false);
    }
  };

  // Filtered lists based on search
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch.trim()) return vehicles;
    const search = vehicleSearch.toLowerCase();
    return vehicles.filter(
      (v) =>
        v.numeroPlaca.toLowerCase().includes(search) ||
        v.marca.toLowerCase().includes(search) ||
        v.modelo.toLowerCase().includes(search)
    );
  }, [vehicles, vehicleSearch]);

  const filteredDrivers = useMemo(() => {
    if (!driverSearch.trim()) return drivers;
    const search = driverSearch.toLowerCase();
    return drivers.filter(
      (d) =>
        d.nombre.toLowerCase().includes(search) ||
        d.apellido.toLowerCase().includes(search) ||
        d.numeroDocumento.includes(search) ||
        d.numeroLicencia.toLowerCase().includes(search)
    );
  }, [drivers, driverSearch]);

  const filteredTransporters = useMemo(() => {
    if (!transporterSearch.trim()) return transporters;
    const search = transporterSearch.toLowerCase();
    return transporters.filter(
      (t) =>
        t.razonSocial.toLowerCase().includes(search) ||
        t.numeroRuc.includes(search)
    );
  }, [transporters, transporterSearch]);

  const handleConfirm = () => {
    if (!transportType) {
      Alert.alert('Error', 'Debes seleccionar un tipo de transporte');
      return;
    }

    if (transportType === 'public') {
      // Para transporte público, validar que se haya seleccionado un transportista
      if (!selectedTransporter) {
        Alert.alert('Error', 'Debes seleccionar un transportista para transporte público');
        return;
      }
      // Enviar null para vehículo y conductor, pero el transportista seleccionado
      onConfirm(null, null, selectedTransporter);
      return;
    }

    // Para transporte privado, validar vehículo y conductor
    if (!selectedVehicle) {
      Alert.alert('Error', 'Debes seleccionar un vehículo');
      return;
    }
    if (!selectedDriver) {
      Alert.alert('Error', 'Debes seleccionar un conductor');
      return;
    }

    // Enviar vehículo y conductor, sin transportista
    onConfirm(selectedVehicle, selectedDriver, null);
  };

  const handleSelectTransportType = (type: 'public' | 'private') => {
    setTransportType(type);

    if (type === 'public') {
      // Limpiar selecciones de vehículo y conductor
      setSelectedVehicle(null);
      setSelectedDriver(null);
      setVehicleSearch('');
      setDriverSearch('');
    } else {
      // Limpiar transportista
      setSelectedTransporter(null);
      setTransporterSearch('');
    }
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setVehicleSearch(`${vehicle.numeroPlaca} - ${vehicle.marca} ${vehicle.modelo}`);
    setShowVehicleDropdown(false);
  };

  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    setDriverSearch(`${driver.nombre} ${driver.apellido} - Lic: ${driver.numeroLicencia}`);
    setShowDriverDropdown(false);
  };

  const handleSelectTransporter = (transporter: Transporter) => {
    setSelectedTransporter(transporter);
    setTransporterSearch(`${transporter.razonSocial} - RUC: ${transporter.numeroRuc}`);
    setShowTransporterDropdown(false);
  };

  const handleCreateVehicle = () => {
    setShowCreateVehicle(true);
  };

  const handleCreateDriver = () => {
    setShowCreateDriver(true);
  };

  const handleCreateTransporter = () => {
    setShowCreateTransporter(true);
  };

  const handleVehicleCreated = async (data: CreateVehicleRequest) => {
    try {
      const newVehicle = await transportService.createVehicle(data);
      setVehicles([...vehicles, newVehicle]);
      handleSelectVehicle(newVehicle);
      setShowCreateVehicle(false);
      Alert.alert('Éxito', 'Vehículo creado exitosamente');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo crear el vehículo');
    }
  };

  const handleDriverCreated = async (data: CreateDriverRequest) => {
    try {
      const newDriver = await transportService.createDriver(data);
      setDrivers([...drivers, newDriver]);
      handleSelectDriver(newDriver);
      setShowCreateDriver(false);
      Alert.alert('Éxito', 'Conductor creado exitosamente');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo crear el conductor');
    }
  };

  const handleTransporterCreated = async (data: CreateTransporterRequest) => {
    try {
      const newTransporter = await transportService.createTransporter(data);
      setTransporters([...transporters, newTransporter]);
      handleSelectTransporter(newTransporter);
      setShowCreateTransporter(false);
      Alert.alert('Éxito', 'Transportista creado exitosamente');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'No se pudo crear el transportista');
    }
  };

  return (
    <>
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
                {/* Transport Type Selection */}
                <View style={styles.transportTypeContainer}>
                  <Text style={styles.transportTypeLabel}>Tipo de Transporte *</Text>
                  <View style={styles.transportTypeButtons}>
                    {/* Public Transport Option */}
                    <TouchableOpacity
                      style={[
                        styles.transportTypeCard,
                        transportType === 'public' && styles.transportTypeCardActive,
                      ]}
                      onPress={() => handleSelectTransportType('public')}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="business"
                        size={24}
                        color={transportType === 'public' ? '#10B981' : '#6B7280'}
                      />
                      <Text
                        style={[
                          styles.transportTypeTitle,
                          transportType === 'public' && styles.transportTypeTitleActive,
                        ]}
                      >
                        Transporte Público
                      </Text>
                      <Text style={styles.transportTypeSubtext}>Transportista externo</Text>
                    </TouchableOpacity>

                    {/* Private Transport Option */}
                    <TouchableOpacity
                      style={[
                        styles.transportTypeCard,
                        transportType === 'private' && styles.transportTypeCardActive,
                      ]}
                      onPress={() => handleSelectTransportType('private')}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="car"
                        size={24}
                        color={transportType === 'private' ? '#10B981' : '#6B7280'}
                      />
                      <Text
                        style={[
                          styles.transportTypeTitle,
                          transportType === 'private' && styles.transportTypeTitleActive,
                        ]}
                      >
                        Transporte Privado
                      </Text>
                      <Text style={styles.transportTypeSubtext}>Vehículo y conductor propios</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Transporter Selection - Only visible when Public Transport is selected */}
                {transportType === 'public' && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="business" size={24} color="#6366F1" />
                      <Text style={styles.sectionTitle}>Transportista</Text>
                      <TouchableOpacity
                        style={styles.createButton}
                        onPress={handleCreateTransporter}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add-circle" size={24} color="#10B981" />
                        <Text style={styles.createButtonText}>Crear Nuevo</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Search Input */}
                    <View style={styles.searchContainer}>
                      <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar por razón social o RUC..."
                        value={transporterSearch}
                        onChangeText={setTransporterSearch}
                        onFocus={() => setShowTransporterDropdown(true)}
                      />
                      {transporterSearch.length > 0 && (
                        <TouchableOpacity
                          onPress={() => {
                            setTransporterSearch('');
                            setSelectedTransporter(null);
                          }}
                        >
                          <Ionicons name="close-circle" size={20} color="#6B7280" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Dropdown */}
                    {showTransporterDropdown && filteredTransporters.length > 0 && (
                      <View style={styles.dropdown}>
                        <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                          {filteredTransporters.map((transporter) => (
                            <TouchableOpacity
                              key={transporter.id}
                              style={styles.dropdownItem}
                              onPress={() => handleSelectTransporter(transporter)}
                            >
                              <Text style={styles.dropdownItemTitle}>
                                {transporter.razonSocial}
                              </Text>
                              <Text style={styles.dropdownItemSubtitle}>
                                RUC: {transporter.numeroRuc}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {/* Transporter Details */}
                    {selectedTransporter && (
                      <View style={styles.detailsCard}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Razón Social:</Text>
                          <Text style={styles.detailValue}>{selectedTransporter.razonSocial}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>RUC:</Text>
                          <Text style={styles.detailValue}>{selectedTransporter.numeroRuc}</Text>
                        </View>
                        {selectedTransporter.numeroRegistroMTC && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Registro MTC:</Text>
                            <Text style={styles.detailValue}>
                              {selectedTransporter.numeroRegistroMTC}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

              {/* Vehicle Selection - Only visible when Private Transport is selected */}
              {transportType === 'private' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="car" size={24} color="#6366F1" />
                  <Text style={styles.sectionTitle}>Vehículo</Text>
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleCreateVehicle}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle" size={24} color="#10B981" />
                    <Text style={styles.createButtonText}>Crear Nuevo</Text>
                  </TouchableOpacity>
                </View>

                {/* Search Input */}
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por placa, marca o modelo..."
                    value={vehicleSearch}
                    onChangeText={setVehicleSearch}
                    onFocus={() => setShowVehicleDropdown(true)}
                  />
                  {vehicleSearch.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setVehicleSearch('');
                        setSelectedVehicle(null);
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Dropdown */}
                {showVehicleDropdown && filteredVehicles.length > 0 && (
                  <View style={styles.dropdown}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                      {filteredVehicles.map((vehicle) => (
                        <TouchableOpacity
                          key={vehicle.id}
                          style={styles.dropdownItem}
                          onPress={() => handleSelectVehicle(vehicle)}
                        >
                          <Text style={styles.dropdownItemTitle}>
                            {vehicle.numeroPlaca} - {vehicle.marca} {vehicle.modelo}
                          </Text>
                          <Text style={styles.dropdownItemSubtitle}>
                            {vehicle.color && `Color: ${vehicle.color}`}
                            {vehicle.anio && ` • Año: ${vehicle.anio}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

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
              </View>
              )}

              {/* Driver Selection - Only visible when Private Transport is selected */}
              {transportType === 'private' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="person" size={24} color="#6366F1" />
                  <Text style={styles.sectionTitle}>Conductor</Text>
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleCreateDriver}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle" size={24} color="#10B981" />
                    <Text style={styles.createButtonText}>Crear Nuevo</Text>
                  </TouchableOpacity>
                </View>

                {/* Search Input */}
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por nombre, documento o licencia..."
                    value={driverSearch}
                    onChangeText={setDriverSearch}
                    onFocus={() => setShowDriverDropdown(true)}
                  />
                  {driverSearch.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setDriverSearch('');
                        setSelectedDriver(null);
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color="#6B7280" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Dropdown */}
                {showDriverDropdown && filteredDrivers.length > 0 && (
                  <View style={styles.dropdown}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                      {filteredDrivers.map((driver) => (
                        <TouchableOpacity
                          key={driver.id}
                          style={styles.dropdownItem}
                          onPress={() => handleSelectDriver(driver)}
                        >
                          <Text style={styles.dropdownItemTitle}>
                            {driver.nombre} {driver.apellido}
                          </Text>
                          <Text style={styles.dropdownItemSubtitle}>
                            Lic: {driver.numeroLicencia} • Doc: {driver.numeroDocumento}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

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
              </View>
              )}
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
                (!transportType ||
                  (transportType === 'public' && !selectedTransporter) ||
                  (transportType === 'private' && (!selectedVehicle || !selectedDriver)) ||
                  loading) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={
                !transportType ||
                (transportType === 'public' && !selectedTransporter) ||
                (transportType === 'private' && (!selectedVehicle || !selectedDriver)) ||
                loading
              }
              activeOpacity={0.7}
            >
              <Text style={styles.confirmButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Create Vehicle Modal */}
    {showCreateVehicle && (
      <CreateVehicleModal
        visible={showCreateVehicle}
        onClose={() => setShowCreateVehicle(false)}
        onSubmit={handleVehicleCreated}
      />
    )}

    {/* Create Driver Modal */}
    {showCreateDriver && (
      <CreateDriverModal
        visible={showCreateDriver}
        onClose={() => setShowCreateDriver(false)}
        onSubmit={handleDriverCreated}
      />
    )}

    {/* Create Transporter Modal */}
    {showCreateTransporter && (
      <CreateTransporterModal
        visible={showCreateTransporter}
        onClose={() => setShowCreateTransporter(false)}
        onSubmit={handleTransporterCreated}
      />
    )}
  </>
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
    height: '85%',
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
    flex: 1,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    gap: 4,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: 4,
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 200,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  dropdownItemSubtitle: {
    fontSize: 14,
    color: '#6B7280',
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
  transportTypeContainer: {
    marginBottom: 20,
  },
  transportTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  transportTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  transportTypeCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  transportTypeCardActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  transportTypeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 8,
    textAlign: 'center',
  },
  transportTypeTitleActive: {
    color: '#10B981',
  },
  transportTypeSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
});













// Placeholder components for create modals - these will be simple forms
const CreateVehicleModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateVehicleRequest) => void;
}> = ({ visible, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CreateVehicleRequest>({
    numeroPlaca: '',
    tipoVehiculo: VehicleType.PRINCIPAL,
    marca: '',
    modelo: '',
    status: VehicleStatus.ACTIVE,
    isActive: true,
  });

  const handleSubmit = () => {
    if (!formData.numeroPlaca || !formData.marca || !formData.modelo) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }
    onSubmit(formData);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContent, { height: 'auto', maxHeight: '80%' }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Crear Vehículo</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Placa *
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Ej: ABC-123"
                value={formData.numeroPlaca}
                onChangeText={(text) => setFormData({ ...formData, numeroPlaca: text.toUpperCase() })}
                autoCapitalize="characters"
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Marca *
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Ej: Toyota"
                value={formData.marca}
                onChangeText={(text) => setFormData({ ...formData, marca: text })}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Modelo *
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Ej: Hilux"
                value={formData.modelo}
                onChangeText={(text) => setFormData({ ...formData, modelo: text })}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Año
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Ej: 2023"
                value={formData.anio?.toString() || ''}
                onChangeText={(text) => setFormData({ ...formData, anio: parseInt(text) || undefined })}
                keyboardType="numeric"
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Color
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Ej: Blanco"
                value={formData.color || ''}
                onChangeText={(text) => setFormData({ ...formData, color: text })}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleSubmit}>
              <Text style={styles.confirmButtonText}>Crear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const CreateDriverModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDriverRequest) => void;
}> = ({ visible, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CreateDriverRequest>({
    tipoDocumento: DocumentType.DNI,
    numeroDocumento: '',
    nombre: '',
    apellido: '',
    numeroLicencia: '',
    categoriaLicencia: '',
    fechaVencimientoLicencia: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: DriverStatus.ACTIVE,
    isActive: true,
  });

  const handleSubmit = () => {
    if (
      !formData.numeroDocumento ||
      !formData.nombre ||
      !formData.apellido ||
      !formData.numeroLicencia ||
      !formData.categoriaLicencia
    ) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }
    onSubmit(formData);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContent, { height: 'auto', maxHeight: '80%' }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Crear Conductor</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Nombre *
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Nombre"
                value={formData.nombre}
                onChangeText={(text) => setFormData({ ...formData, nombre: text })}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Apellido *
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Apellido"
                value={formData.apellido}
                onChangeText={(text) => setFormData({ ...formData, apellido: text })}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Número de Documento *
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="DNI"
                value={formData.numeroDocumento}
                onChangeText={(text) => setFormData({ ...formData, numeroDocumento: text })}
                keyboardType="numeric"
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Número de Licencia *
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Ej: Q12345678"
                value={formData.numeroLicencia}
                onChangeText={(text) => setFormData({ ...formData, numeroLicencia: text.toUpperCase() })}
                autoCapitalize="characters"
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Categoría de Licencia *
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Ej: A-IIIb"
                value={formData.categoriaLicencia}
                onChangeText={(text) => setFormData({ ...formData, categoriaLicencia: text })}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Teléfono
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Ej: 987654321"
                value={formData.telefono || ''}
                onChangeText={(text) => setFormData({ ...formData, telefono: text })}
                keyboardType="phone-pad"
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleSubmit}>
              <Text style={styles.confirmButtonText}>Crear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const CreateTransporterModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTransporterRequest) => void;
}> = ({ visible, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CreateTransporterRequest>({
    numeroRuc: '',
    tipoDocumento: TransporterDocumentType.RUC,
    razonSocial: '',
    status: TransporterStatus.ACTIVE,
    isActive: true,
  });

  const handleSubmit = () => {
    if (!formData.numeroRuc || !formData.razonSocial) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }
    onSubmit(formData);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContent, { height: 'auto', maxHeight: '80%' }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Crear Transportista</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                RUC *
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Ej: 20123456789"
                value={formData.numeroRuc}
                onChangeText={(text) => setFormData({ ...formData, numeroRuc: text })}
                keyboardType="numeric"
                maxLength={11}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Razón Social *
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Nombre de la empresa"
                value={formData.razonSocial}
                onChangeText={(text) => setFormData({ ...formData, razonSocial: text })}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Registro MTC
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Número de registro MTC"
                value={formData.numeroRegistroMTC || ''}
                onChangeText={(text) => setFormData({ ...formData, numeroRegistroMTC: text })}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Teléfono
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Ej: 987654321"
                value={formData.telefono || ''}
                onChangeText={(text) => setFormData({ ...formData, telefono: text })}
                keyboardType="phone-pad"
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Dirección
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Dirección de la empresa"
                value={formData.direccion || ''}
                onChangeText={(text) => setFormData({ ...formData, direccion: text })}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleSubmit}>
              <Text style={styles.confirmButtonText}>Crear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
