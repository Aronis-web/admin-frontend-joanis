import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { locationsApi, LocationDetails, LocationSuggestion } from '@/services/api';

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
  const [searchText, setSearchText] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    if (!suggestion.placeId) {
      Alert.alert('Error', 'No se pudo obtener el ID del lugar');
      return;
    }

    try {
      setLoadingDetails(true);
      setSearchText(suggestion.value);
      setShowSuggestions(false);
      setSuggestions([]);
      Keyboard.dismiss();

      console.log('🎯 [LocationSearch] Obteniendo detalles del lugar:', suggestion.placeId);

      const details: LocationDetails = await locationsApi.getDetails({
        place_id: suggestion.placeId,
      });

      console.log('✅ [LocationSearch] Detalles recibidos:', details);

      // Extraer número de la calle si está disponible
      const streetNumber = extractStreetNumber(details.street);

      const locationData: LocationData = {
        latitude: details.gpsCoordinates.latitude,
        longitude: details.gpsCoordinates.longitude,
        addressLine1: details.street || details.fullAddress,
        numberExt: streetNumber,
        district: details.district,
        province: details.province,
        department: details.department,
        country: details.country,
        postalCode: details.postalCode,
        ubigeo: details.ubigeo,
        fullAddress: details.formattedAddress,
      };

      console.log('📍 [LocationSearch] Datos de ubicación procesados:', locationData);

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
          placeholderTextColor="#94A3B8"
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          editable={!disabled && !loadingDetails}
          returnKeyType="search"
        />
        {loading && (
          <View style={styles.loadingIcon}>
            <ActivityIndicator size="small" color="#3B82F6" />
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
          <ActivityIndicator size="small" color="#3B82F6" />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchIconText: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    paddingVertical: 0,
  },
  inputDisabled: {
    color: '#94A3B8',
  },
  loadingIcon: {
    marginLeft: 8,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  loadingDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    marginTop: 8,
  },
  loadingDetailsText: {
    fontSize: 13,
    color: '#3B82F6',
    marginLeft: 8,
    fontWeight: '500',
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsList: {
    borderRadius: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 56,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    color: '#1E293B',
    marginBottom: 2,
  },
  suggestionSubtext: {
    fontSize: 13,
    color: '#64748B',
  },
  suggestionSeparator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 12,
  },
  hintText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
    marginLeft: 4,
    fontStyle: 'italic',
  },
});

export default LocationSearchInput;
