import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { locationsApi, LocationDetails, LocationSuggestion } from '@/services/api';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

// Conditional import for react-native-maps (only on native platforms)
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.warn('react-native-maps not available');
  }
}

export interface LocationData {
  latitude?: number;
  longitude?: number;
  addressLine1?: string;
  numberExt?: string;
  district?: string;
  province?: string;
  department?: string;
  country?: string;
  postalCode?: string;
  ubigeo?: string;
  fullAddress?: string;
}

interface LocationSearchInputProps {
  onLocationSelected: (location: LocationData) => void;
  placeholder?: string;
  initialValue?: string;
  disabled?: boolean;
  country?: string;
  language?: string;
}

/**
 * Componente reutilizable de búsqueda de ubicaciones con Google Maps
 * Usa la API de SerpAPI del backend para autocompletar y obtener detalles
 */
export const LocationSearchInput: React.FC<LocationSearchInputProps> = ({
  onLocationSelected,
  placeholder = 'Buscar dirección...',
  initialValue = '',
  disabled = false,
  country = 'pe',
  language = 'es',
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [searchText, setSearchText] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    setSearchText(initialValue);
  }, [initialValue]);

  // Debounced search
  useEffect(() => {
    if (searchText.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(searchText);
    }, 500); // 500ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText]);

  const searchLocations = async (query: string) => {
    if (query.length < 3) {
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 [LocationSearch] Buscando ubicaciones:', query);

      const response = await locationsApi.autocomplete({
        q: query,
        country,
        language,
      });

      console.log('✅ [LocationSearch] Sugerencias recibidas:', response.suggestions.length);
      console.log('📋 [LocationSearch] Primera sugerencia:', JSON.stringify(response.suggestions[0], null, 2));
      setSuggestions(response.suggestions);
      setShowSuggestions(true);
    } catch (error: any) {
      console.error('❌ [LocationSearch] Error buscando ubicaciones:', error);
      const errorMessage = error.response?.data?.message || 'Error al buscar ubicaciones';
      Alert.alert('Error', errorMessage);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionPress = async (suggestion: LocationSuggestion) => {
    // Intentar obtener el ID del lugar (puede ser placeId o dataId)
    const placeIdentifier = suggestion.placeId || suggestion.dataId;

    console.log('🔍 [LocationSearch] Sugerencia seleccionada:', JSON.stringify(suggestion, null, 2));

    // Si no hay placeId, generar uno a partir de las coordenadas
    let finalPlaceId = placeIdentifier;
    if (!finalPlaceId && suggestion.latitude && suggestion.longitude) {
      finalPlaceId = `coords:${suggestion.latitude},${suggestion.longitude}`;
      console.log('ℹ️ [LocationSearch] Generando placeId desde coordenadas:', finalPlaceId);
    }

    if (!finalPlaceId) {
      Alert.alert('Error', 'No se pudo obtener el ID del lugar ni las coordenadas');
      return;
    }

    try {
      setLoadingDetails(true);
      setSearchText(suggestion.value);
      setShowSuggestions(false);
      setSuggestions([]);
      Keyboard.dismiss();

      // Construir la dirección completa combinando value y subtext
      const fullAddress = suggestion.subtext
        ? `${suggestion.value}, ${suggestion.subtext}`
        : suggestion.value;

      console.log('🎯 [LocationSearch] Obteniendo detalles del lugar:', finalPlaceId);
      console.log('📍 [LocationSearch] Dirección completa:', fullAddress);

      const details: LocationDetails = await locationsApi.getDetails({
        place_id: finalPlaceId,
        address: fullAddress,
      });

      console.log('✅ [LocationSearch] Detalles recibidos:', details);

      // Extraer número de la calle si está disponible
      const streetNumber = extractStreetNumber(details.street);

      // Intentar extraer código postal de addressComponents si está disponible
      let postalCode = details.postalCode;
      if (!postalCode && details.addressComponents && Array.isArray(details.addressComponents)) {
        const postalComponent = details.addressComponents.find((component: any) =>
          component.types && component.types.includes('postal_code')
        );
        if (postalComponent) {
          postalCode = postalComponent.longName || postalComponent.shortName;
          console.log('📮 [LocationSearch] Código postal extraído de addressComponents:', postalCode);
        }
      }

      // Si el backend devuelve coordenadas 0,0, usar las de la sugerencia original
      let finalLatitude: number | string = details.gpsCoordinates.latitude;
      let finalLongitude: number | string = details.gpsCoordinates.longitude;

      if (
        (Number(finalLatitude) === 0) &&
        (Number(finalLongitude) === 0) &&
        suggestion.latitude &&
        suggestion.longitude
      ) {
        console.log('⚠️ [LocationSearch] Backend devolvió coordenadas 0,0. Usando coordenadas de la sugerencia.');
        finalLatitude = Number(suggestion.latitude);
        finalLongitude = Number(suggestion.longitude);
      }

      const locationData: LocationData = {
        latitude: typeof finalLatitude === 'number' ? finalLatitude : parseFloat(String(finalLatitude)),
        longitude: typeof finalLongitude === 'number' ? finalLongitude : parseFloat(String(finalLongitude)),
        addressLine1: details.street || details.fullAddress,
        numberExt: streetNumber,
        district: details.district,
        province: details.province,
        department: details.department,
        country: details.country,
        postalCode: postalCode,
        ubigeo: details.ubigeo,
        fullAddress: details.formattedAddress,
      };

      console.log('📍 [LocationSearch] Datos de ubicación procesados:', locationData);

      // Actualizar coordenadas del mapa
      const lat = parseFloat(finalLatitude.toString());
      const lng = parseFloat(finalLongitude.toString());

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        setSelectedCoordinates({ latitude: lat, longitude: lng });

        // Animar el mapa a la nueva ubicación
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 1000);
        }
      }

      // Mostrar información al usuario
      if (details.ubigeo) {
        Alert.alert(
          'Ubicación Encontrada',
          `✅ Dirección: ${details.formattedAddress}\n\n` +
            `📍 Distrito: ${details.district || 'N/A'}\n` +
            `🏙️ Provincia: ${details.province || 'N/A'}\n` +
            `🗺️ Departamento: ${details.department || 'N/A'}\n` +
            `📮 Código Postal: ${details.postalCode || 'N/A'}\n` +
            `🔢 Ubigeo SUNAT: ${details.ubigeo}\n\n` +
            `Los campos de dirección se han autocompletado.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Ubicación Encontrada',
          `✅ Dirección: ${details.formattedAddress}\n\n` +
            `⚠️ No se encontró el ubigeo SUNAT para este distrito.\n` +
            `Puedes ingresarlo manualmente si es necesario.\n\n` +
            `Los demás campos se han autocompletado.`,
          [{ text: 'OK' }]
        );
      }

      onLocationSelected(locationData);
    } catch (error: any) {
      console.error('❌ [LocationSearch] Error obteniendo detalles:', error);
      const errorMessage = error.response?.data?.message || 'Error al obtener detalles de la ubicación';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoadingDetails(false);
    }
  };

  const extractStreetNumber = (street?: string): string | undefined => {
    if (!street) return undefined;

    // Intentar extraer el número de la calle
    // Ejemplos: "Av. José Larco 1301" -> "1301"
    const match = street.match(/\d+[A-Za-z]?$/);
    return match ? match[0] : undefined;
  };

  const handleClearSearch = () => {
    setSearchText('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const renderSuggestion = ({ item }: { item: LocationSuggestion }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSuggestionPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.suggestionIcon}>
        <Text style={styles.suggestionIconText}>📍</Text>
      </View>
      <View style={styles.suggestionContent}>
        <Text style={styles.suggestionValue}>{item.value}</Text>
        {item.subtext && <Text style={styles.suggestionSubtext}>{item.subtext}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <View style={styles.searchIcon}>
          <Text style={styles.searchIconText}>🔍</Text>
        </View>
        <TextInput
          style={[styles.input, disabled && styles.inputDisabled]}
          placeholder={placeholder}
          placeholderTextColor={theme.color.text.placeholder}
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          editable={!disabled && !loadingDetails}
          keyboardType="default"
          returnKeyType="search"
        />
        {loading && (
          <View style={styles.loadingIcon}>
            <ActivityIndicator size="small" color={theme.color.brand.primary} />
          </View>
        )}
        {!loading && searchText.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loadingDetails && (
        <View style={styles.loadingDetailsContainer}>
          <ActivityIndicator size="small" color={theme.color.brand.primary} />
          <Text style={styles.loadingDetailsText}>Obteniendo detalles de la ubicación...</Text>
        </View>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => item.placeId || `suggestion-${index}`}
            renderItem={renderSuggestion}
            ItemSeparatorComponent={() => <View style={styles.suggestionSeparator} />}
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          />
        </View>
      )}

      {searchText.length > 0 && searchText.length < 3 && (
        <Text style={styles.hintText}>Escribe al menos 3 caracteres para buscar</Text>
      )}

      {/* Mapa para visualizar la ubicación seleccionada - Solo en plataformas nativas */}
      {selectedCoordinates && Platform.OS !== 'web' && MapView && (
        <View style={styles.mapContainer}>
          <Text style={styles.mapTitle}>📍 Ubicación Seleccionada</Text>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: selectedCoordinates.latitude,
              longitude: selectedCoordinates.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            zoomEnabled={true}
            scrollEnabled={true}
          >
            <Marker
              coordinate={{
                latitude: selectedCoordinates.latitude,
                longitude: selectedCoordinates.longitude,
              }}
              title="Ubicación seleccionada"
              pinColor={theme.color.brand.primary}
            />
          </MapView>
          <View style={styles.mapInfo}>
            <Text style={styles.mapInfoText}>
              📌 Lat: {selectedCoordinates.latitude.toFixed(6)}, Lng: {selectedCoordinates.longitude.toFixed(6)}
            </Text>
          </View>
        </View>
      )}

      {/* Información de coordenadas en web (sin mapa) */}
      {selectedCoordinates && Platform.OS === 'web' && (
        <View style={styles.mapContainer}>
          <Text style={styles.mapTitle}>📍 Ubicación Seleccionada</Text>
          <View style={styles.webCoordinatesContainer}>
            <Text style={styles.webCoordinatesText}>
              📌 Latitud: {selectedCoordinates.latitude.toFixed(6)}
            </Text>
            <Text style={styles.webCoordinatesText}>
              📌 Longitud: {selectedCoordinates.longitude.toFixed(6)}
            </Text>
            <Text style={styles.webCoordinatesHint}>
              (El mapa interactivo solo está disponible en la versión móvil)
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    marginBottom: theme.space[4],
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.background.subtle,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: theme.radii.xl,
    paddingHorizontal: theme.space[3],
    height: 48,
  },
  searchIcon: {
    marginRight: theme.space[2],
  },
  searchIconText: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: theme.color.text.body,
    paddingVertical: 0,
  },
  inputDisabled: {
    color: theme.color.text.disabled,
  },
  loadingIcon: {
    marginLeft: theme.space[2],
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.action.secondary.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.space[2],
  },
  clearButtonText: {
    fontSize: 14,
    color: theme.color.text.muted,
    fontWeight: '600',
  },
  loadingDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[3],
    backgroundColor: theme.color.brand.accentSoft,
    borderRadius: theme.radii.lg,
    marginTop: theme.space[2],
  },
  loadingDetailsText: {
    fontSize: 13,
    color: theme.color.brand.primary,
    marginLeft: theme.space[2],
    fontWeight: '500',
  },
  suggestionsContainer: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    marginTop: theme.space[2],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    maxHeight: 300,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsList: {
    borderRadius: theme.radii.xl,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[3],
    minHeight: 56,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.brand.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  suggestionIconText: {
    fontSize: 16,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text.heading,
    marginBottom: 2,
  },
  suggestionSubtext: {
    fontSize: 13,
    color: theme.color.text.muted,
  },
  suggestionSeparator: {
    height: 1,
    backgroundColor: theme.color.border.subtle,
    marginHorizontal: theme.space[3],
  },
  hintText: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginTop: 6,
    marginLeft: theme.space[1],
    fontStyle: 'italic',
  },
  mapContainer: {
    marginTop: theme.space[4],
    borderRadius: theme.radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    backgroundColor: theme.color.surface.base,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text.heading,
    paddingHorizontal: theme.space[3],
    paddingVertical: 10,
    backgroundColor: theme.color.background.subtle,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  map: {
    width: '100%',
    height: 200,
  },
  mapInfo: {
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    backgroundColor: theme.color.background.subtle,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  mapInfoText: {
    fontSize: 12,
    color: theme.color.text.muted,
    fontWeight: '500',
  },
  webCoordinatesContainer: {
    padding: theme.space[4],
    backgroundColor: theme.color.background.subtle,
  },
  webCoordinatesText: {
    fontSize: 14,
    color: theme.color.text.body,
    fontWeight: '500',
    marginBottom: theme.space[2],
  },
  webCoordinatesHint: {
    fontSize: 12,
    color: theme.color.text.subtle,
    fontStyle: 'italic',
    marginTop: theme.space[2],
  },
});

export default LocationSearchInput;
