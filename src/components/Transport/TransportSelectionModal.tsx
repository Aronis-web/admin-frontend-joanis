import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
import Alert from '@/utils/alert';

interface TransportSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (vehicle: Vehicle | null, driver: Driver | null, transporter: Transporter | null) => void;
}

const TransportSelectionModalComponent: React.FC<TransportSelectionModalProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  // Usar ref para trackear si ya se cargaron los datos
  const dataLoadedRef = useRef(false);
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

  const loadData = useCallback(async () => {
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
  }, []);

  // Efecto para cargar datos y resetear al abrir/cerrar
  useEffect(() => {
    if (visible) {
      // Solo cargar datos si no se han cargado antes o si el modal se abre de nuevo
      if (!dataLoadedRef.current) {
        loadData();
        dataLoadedRef.current = true;
      }
    } else {
      // Reset selections when modal closes
      dataLoadedRef.current = false;
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
  }, [visible, loadData]);

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

  const handleConfirm = useCallback(() => {
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
  }, [transportType, selectedTransporter, selectedVehicle, selectedDriver, onConfirm]);

  const handleSelectTransportType = useCallback((type: 'public' | 'private') => {
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
  }, []);

  const handleSelectVehicle = useCallback((vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setVehicleSearch(`${vehicle.numeroPlaca} - ${vehicle.marca} ${vehicle.modelo}`);
    setShowVehicleDropdown(false);
  }, []);

  const handleSelectDriver = useCallback((driver: Driver) => {
    setSelectedDriver(driver);
    setDriverSearch(`${driver.nombre} ${driver.apellido} - Lic: ${driver.numeroLicencia}`);
    setShowDriverDropdown(false);
  }, []);

  const handleSelectTransporter = useCallback((transporter: Transporter) => {
    setSelectedTransporter(transporter);
    setTransporterSearch(`${transporter.razonSocial} - RUC: ${transporter.numeroRuc}`);
    setShowTransporterDropdown(false);
  }, []);

  const handleCreateVehicle = useCallback(() => {
    setShowCreateVehicle(true);
  }, []);

  const handleCreateDriver = useCallback(() => {
    setShowCreateDriver(true);
  }, []);

  const handleCreateTransporter = useCallback(() => {
    setShowCreateTransporter(true);
  }, []);

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
        animationType="fade"
        transparent={true}
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Seleccionar Transporte</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.color.text.muted} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.color.brand.accent} />
                <Text style={styles.loadingText}>Cargando datos...</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
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
                        color={transportType === 'public' ? theme.color.text.success : theme.color.text.muted}
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
                        color={transportType === 'private' ? theme.color.text.success : theme.color.text.muted}
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
                      <Ionicons name="business" size={24} color={theme.color.brand.accent} />
                      <Text style={styles.sectionTitle}>Transportista</Text>
                      <TouchableOpacity
                        style={styles.createButton}
                        onPress={handleCreateTransporter}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add-circle" size={24} color={theme.color.text.success} />
                        <Text style={styles.createButtonText}>Crear Nuevo</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Search Input */}
                    <View style={styles.searchContainer}>
                      <Ionicons name="search" size={20} color={theme.color.text.muted} style={styles.searchIcon} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar por razón social o RUC..."
                        placeholderTextColor={theme.color.text.placeholder}
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
                          <Ionicons name="close-circle" size={20} color={theme.color.text.muted} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Dropdown */}
                    {showTransporterDropdown && filteredTransporters.length > 0 && (
                      <View style={styles.dropdown}>
                        <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
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
                  <Ionicons name="car" size={24} color={theme.color.brand.accent} />
                  <Text style={styles.sectionTitle}>Vehículo</Text>
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleCreateVehicle}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle" size={24} color={theme.color.text.success} />
                    <Text style={styles.createButtonText}>Crear Nuevo</Text>
                  </TouchableOpacity>
                </View>

                {/* Search Input */}
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color={theme.color.text.muted} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por placa, marca o modelo..."
                    placeholderTextColor={theme.color.text.placeholder}
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
                      <Ionicons name="close-circle" size={20} color={theme.color.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Dropdown */}
                {showVehicleDropdown && filteredVehicles.length > 0 && (
                  <View style={styles.dropdown}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
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
                  <Ionicons name="person" size={24} color={theme.color.brand.accent} />
                  <Text style={styles.sectionTitle}>Conductor</Text>
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleCreateDriver}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle" size={24} color={theme.color.text.success} />
                    <Text style={styles.createButtonText}>Crear Nuevo</Text>
                  </TouchableOpacity>
                </View>

                {/* Search Input */}
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color={theme.color.text.muted} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por nombre, documento o licencia..."
                    placeholderTextColor={theme.color.text.placeholder}
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
                      <Ionicons name="close-circle" size={20} color={theme.color.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Dropdown */}
                {showDriverDropdown && filteredDrivers.length > 0 && (
                  <View style={styles.dropdown}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
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
      </View>
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

// Exportar con React.memo para evitar re-renders innecesarios desde el componente padre
export const TransportSelectionModal = React.memo(TransportSelectionModalComponent);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      width: '90%',
      maxWidth: 600,
      height: '85%',
      shadowColor: theme.color.shadow,
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
    content: {
      flex: 1,
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[2],
    },
    section: {
      marginTop: theme.space[3],
      marginBottom: theme.space[3],
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginLeft: theme.space[2],
      flex: 1,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      backgroundColor: theme.color.state.success.background,
      borderRadius: theme.radii.lg,
      gap: theme.space[1],
    },
    createButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.success,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      marginBottom: theme.space[2],
    },
    searchIcon: {
      marginRight: theme.space[2],
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.color.text.heading,
      paddingVertical: theme.space[1],
    },
    dropdown: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      maxHeight: 200,
      marginBottom: theme.space[2],
      shadowColor: theme.color.shadow,
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
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.surface.muted,
    },
    dropdownItemTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    dropdownItemSubtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    detailsCard: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[3],
      marginTop: theme.space[2],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[1],
    },
    detailLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    detailValue: {
      fontSize: 14,
      color: theme.color.text.heading,
      fontWeight: '600',
      flex: 1,
      textAlign: 'right',
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[4],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: theme.color.surface.muted,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    confirmButton: {
      backgroundColor: theme.color.brand.accent,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    buttonDisabled: {
      backgroundColor: theme.color.border.default,
      opacity: 0.6,
    },
    publicTransportCard: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[4],
      borderWidth: 2,
      borderColor: theme.color.border.subtle,
    },
    publicTransportCardActive: {
      backgroundColor: theme.color.state.success.background,
      borderColor: theme.color.text.success,
    },
    publicTransportHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    publicTransportTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginLeft: theme.space[2],
    },
    publicTransportTitleActive: {
      color: theme.color.text.success,
    },
    publicTransportSubtext: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginLeft: theme.space[8],
    },
    sectionDisabled: {
      opacity: 0.4,
    },
    transportTypeContainer: {
      marginBottom: theme.space[5],
    },
    transportTypeLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
    },
    transportTypeButtons: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    transportTypeCard: {
      flex: 1,
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      borderWidth: 2,
      borderColor: theme.color.border.subtle,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 120,
    },
    transportTypeCardActive: {
      backgroundColor: theme.color.state.success.background,
      borderColor: theme.color.text.success,
    },
    transportTypeTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginTop: theme.space[2],
      textAlign: 'center',
    },
    transportTypeTitleActive: {
      color: theme.color.text.success,
    },
    transportTypeSubtext: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
      textAlign: 'center',
    },
    // Estilos para modales secundarios (modal sobre modal)
    secondaryModalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      width: '85%',
      maxWidth: 500,
      height: '70%',
      shadowColor: theme.color.shadow,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 10,
    },
    formInput: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[3],
      paddingVertical: 10,
      fontSize: 16,
      color: theme.color.text.heading,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
      marginBottom: theme.space[2],
    },
    formGroup: {
      marginBottom: theme.space[4],
    },
  });









// Placeholder components for create modals - these will be simple forms
const CreateVehicleModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateVehicleRequest) => void;
}> = ({ visible, onClose, onSubmit }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
              <Ionicons name="close" size={24} color={theme.color.text.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Placa *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: ABC-123"
                placeholderTextColor={theme.color.text.placeholder}
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
                placeholderTextColor={theme.color.text.placeholder}
                value={formData.marca}
                onChangeText={(text) => setFormData({ ...formData, marca: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Modelo *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: Hilux"
                placeholderTextColor={theme.color.text.placeholder}
                value={formData.modelo}
                onChangeText={(text) => setFormData({ ...formData, modelo: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Año</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: 2023"
                placeholderTextColor={theme.color.text.placeholder}
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
                placeholderTextColor={theme.color.text.placeholder}
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
              <Ionicons name="close" size={24} color={theme.color.text.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nombre *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Nombre"
                placeholderTextColor={theme.color.text.placeholder}
                value={formData.nombre}
                onChangeText={(text) => setFormData({ ...formData, nombre: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Apellido *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Apellido"
                placeholderTextColor={theme.color.text.placeholder}
                value={formData.apellido}
                onChangeText={(text) => setFormData({ ...formData, apellido: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Número de Documento *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="DNI"
                placeholderTextColor={theme.color.text.placeholder}
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
                placeholderTextColor={theme.color.text.placeholder}
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
                placeholderTextColor={theme.color.text.placeholder}
                value={formData.categoriaLicencia}
                onChangeText={(text) => setFormData({ ...formData, categoriaLicencia: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Teléfono</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: 987654321"
                placeholderTextColor={theme.color.text.placeholder}
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
              <Ionicons name="close" size={24} color={theme.color.text.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>RUC *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: 20123456789"
                placeholderTextColor={theme.color.text.placeholder}
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
                placeholderTextColor={theme.color.text.placeholder}
                value={formData.razonSocial}
                onChangeText={(text) => setFormData({ ...formData, razonSocial: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Registro MTC</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Número de registro MTC"
                placeholderTextColor={theme.color.text.placeholder}
                value={formData.numeroRegistroMTC || ''}
                onChangeText={(text) => setFormData({ ...formData, numeroRegistroMTC: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Teléfono</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: 987654321"
                placeholderTextColor={theme.color.text.placeholder}
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
                placeholderTextColor={theme.color.text.placeholder}
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
