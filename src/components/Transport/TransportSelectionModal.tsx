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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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
                <Ionicons name="close" size={24} color={colors.neutral[500]} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accent[500]} />
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
                        color={transportType === 'public' ? colors.success[500] : colors.neutral[500]}
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
                        color={transportType === 'private' ? colors.success[500] : colors.neutral[500]}
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
                      <Ionicons name="business" size={24} color={colors.accent[500]} />
                      <Text style={styles.sectionTitle}>Transportista</Text>
                      <TouchableOpacity
                        style={styles.createButton}
                        onPress={handleCreateTransporter}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add-circle" size={24} color={colors.success[500]} />
                        <Text style={styles.createButtonText}>Crear Nuevo</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Search Input */}
                    <View style={styles.searchContainer}>
                      <Ionicons name="search" size={20} color={colors.neutral[500]} style={styles.searchIcon} />
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
                          <Ionicons name="close-circle" size={20} color={colors.neutral[500]} />
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
                  <Ionicons name="car" size={24} color={colors.accent[500]} />
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
                  <Ionicons name="person" size={24} color={colors.accent[500]} />
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
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius['2xl'],
    width: '90%',
    maxWidth: 600,
    height: '85%',
    shadowColor: colors.neutral[900],
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
  content: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
  },
  section: {
    marginTop: spacing[3],
    marginBottom: spacing[3],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[800],
    marginLeft: spacing[2],
    flex: 1,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.lg,
    gap: spacing[1],
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success[500],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginBottom: spacing[2],
  },
  searchIcon: {
    marginRight: spacing[2],
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.neutral[800],
    paddingVertical: spacing[1],
  },
  dropdown: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    maxHeight: 200,
    marginBottom: spacing[2],
    shadowColor: colors.neutral[900],
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
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  dropdownItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  dropdownItemSubtitle: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  detailsCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.xl,
    padding: spacing[3],
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  detailLabel: {
    fontSize: 14,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: colors.neutral[800],
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing[3],
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.neutral[100],
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  confirmButton: {
    backgroundColor: colors.accent[500],
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  buttonDisabled: {
    backgroundColor: colors.neutral[300],
    opacity: 0.6,
  },
  publicTransportCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 2,
    borderColor: colors.neutral[200],
  },
  publicTransportCardActive: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[500],
  },
  publicTransportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  publicTransportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginLeft: spacing[2],
  },
  publicTransportTitleActive: {
    color: colors.success[500],
  },
  publicTransportSubtext: {
    fontSize: 13,
    color: colors.neutral[500],
    marginLeft: spacing[8],
  },
  sectionDisabled: {
    opacity: 0.4,
  },
  transportTypeContainer: {
    marginBottom: spacing[5],
  },
  transportTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[3],
  },
  transportTypeButtons: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  transportTypeCard: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  transportTypeCardActive: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[500],
  },
  transportTypeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    marginTop: spacing[2],
    textAlign: 'center',
  },
  transportTypeTitleActive: {
    color: colors.success[500],
  },
  transportTypeSubtext: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[1],
    textAlign: 'center',
  },
  // Estilos para modales secundarios (modal sobre modal)
  secondaryModalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius['2xl'],
    width: '85%',
    maxWidth: 500,
    height: '70%',
    shadowColor: colors.neutral[900],
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  formInput: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: spacing[3],
    paddingVertical: 10,
    fontSize: 16,
    color: colors.neutral[800],
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
    marginBottom: spacing[2],
  },
  formGroup: {
    marginBottom: spacing[4],
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
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.secondaryModalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Crear Vehículo</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Placa *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: ABC-123"
                value={formData.numeroPlaca}
                onChangeText={(text) => setFormData({ ...formData, numeroPlaca: text.toUpperCase() })}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Marca *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: Toyota"
                value={formData.marca}
                onChangeText={(text) => setFormData({ ...formData, marca: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Modelo *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: Hilux"
                value={formData.modelo}
                onChangeText={(text) => setFormData({ ...formData, modelo: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Año</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: 2023"
                value={formData.anio?.toString() || ''}
                onChangeText={(text) => setFormData({ ...formData, anio: parseInt(text) || undefined })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Color</Text>
              <TextInput
                style={styles.formInput}
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
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.secondaryModalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Crear Conductor</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nombre *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre"
                value={formData.nombre}
                onChangeText={(text) => setFormData({ ...formData, nombre: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Apellido *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Apellido"
                value={formData.apellido}
                onChangeText={(text) => setFormData({ ...formData, apellido: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Número de Documento *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="DNI"
                value={formData.numeroDocumento}
                onChangeText={(text) => setFormData({ ...formData, numeroDocumento: text })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Número de Licencia *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: Q12345678"
                value={formData.numeroLicencia}
                onChangeText={(text) => setFormData({ ...formData, numeroLicencia: text.toUpperCase() })}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Categoría de Licencia *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: A-IIIb"
                value={formData.categoriaLicencia}
                onChangeText={(text) => setFormData({ ...formData, categoriaLicencia: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Teléfono</Text>
              <TextInput
                style={styles.formInput}
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
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.secondaryModalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Crear Transportista</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>RUC *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: 20123456789"
                value={formData.numeroRuc}
                onChangeText={(text) => setFormData({ ...formData, numeroRuc: text })}
                keyboardType="numeric"
                maxLength={11}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Razón Social *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre de la empresa"
                value={formData.razonSocial}
                onChangeText={(text) => setFormData({ ...formData, razonSocial: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Registro MTC</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Número de registro MTC"
                value={formData.numeroRegistroMTC || ''}
                onChangeText={(text) => setFormData({ ...formData, numeroRegistroMTC: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Teléfono</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: 987654321"
                value={formData.telefono || ''}
                onChangeText={(text) => setFormData({ ...formData, telefono: text })}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Dirección</Text>
              <TextInput
                style={styles.formInput}
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
