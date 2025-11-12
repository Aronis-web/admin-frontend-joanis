import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

interface LocationData {
  latitude: number;
  longitude: number;
  addressLine1?: string;
  district?: string;
  province?: string;
  department?: string;
  country?: string;
  postalCode?: string;
}

interface LocationPickerModalProps {
  visible: boolean;
  initialLocation?: {
    latitude?: number;
    longitude?: number;
  };
  onClose: () => void;
  onLocationSelected: (location: LocationData) => void;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  visible,
  initialLocation,
  onClose,
  onLocationSelected,
}) => {
  console.log('🚀 [LocationPicker] Componente inicializado');
  console.log('🚀 [LocationPicker] Props recibidas:', { visible, initialLocation });

  // Default location: Lima, Peru
  const defaultLocation = {
    latitude: initialLocation?.latitude || -12.046374,
    longitude: initialLocation?.longitude || -77.042793,
  };

  console.log('🚀 [LocationPicker] Ubicación por defecto:', defaultLocation);

  const [selectedLocation, setSelectedLocation] = useState(defaultLocation);
  const [loading, setLoading] = useState(false);
  const [addressInfo, setAddressInfo] = useState<LocationData | null>(null);
  const mapRef = useRef<MapView>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    console.log('🎬 [LocationPicker] useEffect - visible cambió a:', visible);
    if (visible) {
      console.log('🎬 [LocationPicker] Modal abierto, solicitando permisos de ubicación');
      requestLocationPermission();
    }
  }, [visible]);

  const requestLocationPermission = async () => {
    try {
      console.log('🔐 [LocationPicker] Solicitando permisos de ubicación');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('🔐 [LocationPicker] Estado de permisos:', status);

      if (status !== 'granted') {
        console.log('⚠️ [LocationPicker] Permiso de ubicación denegado');
        Alert.alert(
          'Permiso Denegado',
          'Se necesita permiso de ubicación para usar el mapa'
        );
      } else {
        console.log('✅ [LocationPicker] Permiso de ubicación concedido');
      }
    } catch (error) {
      console.error('❌ [LocationPicker] Error requesting location permission:', error);
      console.error('❌ [LocationPicker] Error tipo:', typeof error);
      console.error('❌ [LocationPicker] Error mensaje:', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const getCurrentLocation = async () => {
    try {
      console.log('📍 [LocationPicker] Iniciando getCurrentLocation');
      setLoading(true);

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      console.log('📍 [LocationPicker] Ubicación obtenida:', location);
      console.log('📍 [LocationPicker] Coordenadas:', location.coords);

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      console.log('📍 [LocationPicker] Nueva ubicación:', newLocation);
      setSelectedLocation(newLocation);
      await reverseGeocode(newLocation.latitude, newLocation.longitude);
    } catch (error) {
      console.error('❌ [LocationPicker] Error getting current location:', error);
      console.error('❌ [LocationPicker] Error tipo:', typeof error);
      console.error('❌ [LocationPicker] Error mensaje:', error instanceof Error ? error.message : 'Unknown error');
      Alert.alert('Error', 'No se pudo obtener la ubicación actual');
    } finally {
      setLoading(false);
      console.log('📍 [LocationPicker] getCurrentLocation finalizado');
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      console.log('🗺️ [LocationPicker] Iniciando reverseGeocode con:', { latitude, longitude });
      setLoading(true);

      const results = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      console.log('🗺️ [LocationPicker] Resultados de reverseGeocode:', results);
      console.log('🗺️ [LocationPicker] Tipo de results:', typeof results);
      console.log('🗺️ [LocationPicker] Es array?:', Array.isArray(results));
      console.log('🗺️ [LocationPicker] Longitud:', results?.length);

      if (results && results.length > 0) {
        const address = results[0];
        console.log('🗺️ [LocationPicker] Dirección obtenida:', address);
        console.log('🗺️ [LocationPicker] address.street:', address.street);
        console.log('🗺️ [LocationPicker] address.streetNumber:', address.streetNumber);

        // Safely build address line with defensive checks
        const addressPartsArray = [address.street, address.streetNumber];
        console.log('🗺️ [LocationPicker] addressPartsArray antes de filter:', addressPartsArray);
        console.log('🗺️ [LocationPicker] Es addressPartsArray un array?:', Array.isArray(addressPartsArray));

        // Ensure we have an array before filtering
        const addressParts = Array.isArray(addressPartsArray)
          ? addressPartsArray.filter(part => part != null && part !== '')
          : [];

        console.log('🗺️ [LocationPicker] addressParts después de filter:', addressParts);

        const addressLine1 = addressParts.length > 0 ? addressParts.join(' ') : '';
        console.log('🗺️ [LocationPicker] addressLine1 final:', addressLine1);

        const locationData: LocationData = {
          latitude,
          longitude,
          addressLine1: addressLine1 || undefined,
          district: address.district || address.subregion || undefined,
          province: address.city || undefined,
          department: address.region || undefined,
          country: address.country || 'Perú',
          postalCode: address.postalCode || undefined,
        };

        console.log('🗺️ [LocationPicker] locationData creado:', locationData);
        setAddressInfo(locationData);
        console.log('🗺️ [LocationPicker] ✅ reverseGeocode completado exitosamente');
      } else {
        console.log('⚠️ [LocationPicker] No se obtuvieron resultados de reverseGeocode');
      }
    } catch (error) {
      console.error('❌ [LocationPicker] Error en reverseGeocode:', error);
      console.error('❌ [LocationPicker] Error tipo:', typeof error);
      console.error('❌ [LocationPicker] Error mensaje:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ [LocationPicker] Error stack:', error instanceof Error ? error.stack : 'No stack');
      Alert.alert('Error', 'No se pudo obtener la dirección de esta ubicación');
    } finally {
      setLoading(false);
      console.log('🗺️ [LocationPicker] reverseGeocode finalizado (finally)');
    }
  };

  const handleMapPress = async (event: any) => {
    try {
      console.log('🗺️ [LocationPicker] handleMapPress - evento recibido:', event);
      console.log('🗺️ [LocationPicker] handleMapPress - nativeEvent:', event?.nativeEvent);
      console.log('🗺️ [LocationPicker] handleMapPress - coordinate:', event?.nativeEvent?.coordinate);

      const { latitude, longitude } = event.nativeEvent.coordinate;
      console.log('🗺️ [LocationPicker] handleMapPress - coordenadas extraídas:', { latitude, longitude });

      setSelectedLocation({ latitude, longitude });
      await reverseGeocode(latitude, longitude);
    } catch (error) {
      console.error('❌ [LocationPicker] Error en handleMapPress:', error);
      console.error('❌ [LocationPicker] Error tipo:', typeof error);
      console.error('❌ [LocationPicker] Error mensaje:', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handlePlaceSelected = async (data: any, details: any) => {
    try {
      console.log('🔍 [LocationPicker] handlePlaceSelected - data:', data);
      console.log('🔍 [LocationPicker] handlePlaceSelected - details:', details);
      console.log('🔍 [LocationPicker] handlePlaceSelected - geometry:', details?.geometry);
      console.log('🔍 [LocationPicker] handlePlaceSelected - location:', details?.geometry?.location);

      if (details?.geometry?.location) {
        const { lat, lng } = details.geometry.location;
        console.log('🔍 [LocationPicker] handlePlaceSelected - coordenadas:', { lat, lng });

        const newLocation = {
          latitude: lat,
          longitude: lng,
        };

        setSelectedLocation(newLocation);
        Keyboard.dismiss();

        // Animate map to new location
        if (mapRef.current) {
          console.log('🔍 [LocationPicker] Animando mapa a nueva ubicación');
          mapRef.current.animateToRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        } else {
          console.log('⚠️ [LocationPicker] mapRef.current es null');
        }

        await reverseGeocode(lat, lng);
      } else {
        console.log('⚠️ [LocationPicker] No se encontró geometry.location en details');
      }
    } catch (error) {
      console.error('❌ [LocationPicker] Error en handlePlaceSelected:', error);
      console.error('❌ [LocationPicker] Error tipo:', typeof error);
      console.error('❌ [LocationPicker] Error mensaje:', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleConfirm = () => {
    if (addressInfo) {
      onLocationSelected(addressInfo);
      onClose();
    } else {
      // If no address info, just send coordinates
      onLocationSelected({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      });
      onClose();
    }
  };

  console.log('🎨 [LocationPicker] Renderizando componente');
  console.log('🎨 [LocationPicker] selectedLocation:', selectedLocation);
  console.log('🎨 [LocationPicker] loading:', loading);
  console.log('🎨 [LocationPicker] addressInfo:', addressInfo);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Seleccionar Ubicación</Text>
          <TouchableOpacity
            onPress={getCurrentLocation}
            style={styles.locationButton}
            disabled={loading}
          >
            <Text style={styles.locationButtonText}>📍</Text>
          </TouchableOpacity>
        </View>

        {/* Google Places Autocomplete Search */}
        <View style={styles.searchContainer}>
          <GooglePlacesAutocomplete
            ref={autocompleteRef}
            placeholder="Buscar lugares, negocios, direcciones..."
            onPress={handlePlaceSelected}
            query={{
              key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBWLYNj3GR7rtyYlenKw3Bvyg6_bUce3BA',
              language: 'es',
              components: 'country:pe', // Limitar a Perú, cambiar según necesidad
            }}
            fetchDetails={true}
            enablePoweredByContainer={false}
            listViewDisplayed={false}
            styles={{
              container: {
                flex: 1,
              },
              textInputContainer: {
                backgroundColor: '#F1F5F9',
                borderRadius: 12,
                paddingHorizontal: 12,
                height: 44,
              },
              textInput: {
                height: 44,
                fontSize: 15,
                color: '#1E293B',
                backgroundColor: 'transparent',
                paddingVertical: 0,
              },
              listView: {
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                marginTop: 4,
                elevation: 3,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
              },
              row: {
                backgroundColor: '#FFFFFF',
                padding: 13,
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
              },
              separator: {
                height: 1,
                backgroundColor: '#F1F5F9',
              },
              description: {
                fontSize: 14,
                color: '#1E293B',
              },
              predefinedPlacesDescription: {
                color: '#3B82F6',
              },
              poweredContainer: {
                display: 'none',
              },
            }}
            textInputProps={{
              placeholderTextColor: '#94A3B8',
              returnKeyType: 'search',
              leftIcon: { type: 'font-awesome', name: 'search' },
            }}
            renderLeftButton={() => (
              <Text style={styles.searchIcon}>🔍</Text>
            )}
            renderRightButton={() => (
              <TouchableOpacity
                onPress={getCurrentLocation}
                style={styles.currentLocationButton}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#3B82F6" />
                ) : (
                  <Text style={styles.currentLocationIcon}>📍</Text>
                )}
              </TouchableOpacity>
            )}
            debounce={300}
            minLength={2}
            nearbyPlacesAPI="GooglePlacesSearch"
            GooglePlacesSearchQuery={{
              rankby: 'distance',
            }}
            filterReverseGeocodingByTypes={[]}
            predefinedPlaces={[]}
          />
        </View>

        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
        >
          <Marker
            coordinate={selectedLocation}
            draggable
            onDragEnd={async (e) => {
              try {
                console.log('🎯 [LocationPicker] Marker onDragEnd - evento:', e);
                console.log('🎯 [LocationPicker] Marker onDragEnd - nativeEvent:', e?.nativeEvent);
                console.log('🎯 [LocationPicker] Marker onDragEnd - coordinate:', e?.nativeEvent?.coordinate);

                const { latitude, longitude } = e.nativeEvent.coordinate;
                console.log('🎯 [LocationPicker] Marker onDragEnd - coordenadas:', { latitude, longitude });

                setSelectedLocation({ latitude, longitude });
                await reverseGeocode(latitude, longitude);
              } catch (error) {
                console.error('❌ [LocationPicker] Error en Marker onDragEnd:', error);
                console.error('❌ [LocationPicker] Error tipo:', typeof error);
                console.error('❌ [LocationPicker] Error mensaje:', error instanceof Error ? error.message : 'Unknown error');
              }
            }}
          />
        </MapView>

        {/* Address Info */}
        <View style={styles.infoContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={styles.loadingText}>Obteniendo dirección...</Text>
            </View>
          ) : addressInfo ? (
            <View style={styles.addressContainer}>
              <Text style={styles.addressTitle}>Dirección Detectada:</Text>
              {addressInfo.addressLine1 && (
                <Text style={styles.addressText}>📍 {addressInfo.addressLine1}</Text>
              )}
              {addressInfo.district && (
                <Text style={styles.addressText}>🏘️ Distrito: {addressInfo.district}</Text>
              )}
              {addressInfo.province && (
                <Text style={styles.addressText}>🏙️ Provincia: {addressInfo.province}</Text>
              )}
              {addressInfo.department && (
                <Text style={styles.addressText}>🗺️ Departamento: {addressInfo.department}</Text>
              )}
              {addressInfo.country && (
                <Text style={styles.addressText}>🌎 País: {addressInfo.country}</Text>
              )}
              {addressInfo.postalCode && (
                <Text style={styles.addressText}>📮 C.P.: {addressInfo.postalCode}</Text>
              )}
              <Text style={styles.coordinatesText}>
                📌 {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </Text>
            </View>
          ) : (
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>
                👆 Toca el mapa para seleccionar una ubicación
              </Text>
              <Text style={styles.instructionsSubtext}>
                o arrastra el marcador a la posición deseada
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.confirmButton]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmButtonText}>Confirmar Ubicación</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        paddingTop: 50,
      },
      android: {
        paddingTop: 16,
      },
    }),
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  locationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationButtonText: {
    fontSize: 20,
  },
  map: {
    flex: 1,
  },
  infoContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    maxHeight: 250,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 8,
  },
  addressContainer: {
    padding: 16,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  addressText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 6,
    lineHeight: 20,
  },
  coordinatesText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  instructionsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  instructionsText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
  },
  instructionsSubtext: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 1000,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  currentLocationButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  currentLocationIcon: {
    fontSize: 18,
  },
});

export default LocationPickerModal;
