import { apiClient } from './client';

/**
 * Location suggestion from autocomplete
 */
export interface LocationSuggestion {
  value: string;
  subtext?: string;
  type: 'place' | 'keyword';
  latitude?: number;
  longitude?: number;
  placeId?: string;
  dataId?: string;
}

/**
 * Autocomplete response
 */
export interface AutocompleteResponse {
  suggestions: LocationSuggestion[];
  query: string;
}

/**
 * GPS Coordinates
 */
export interface GpsCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Address component from Google Maps
 */
export interface AddressComponent {
  longName: string;
  shortName: string;
  types: string[];
}

/**
 * Location details from Google Maps
 */
export interface LocationDetails {
  formattedAddress: string;
  fullAddress: string;
  street?: string;
  district?: string;
  province?: string;
  department?: string;
  country?: string;
  postalCode?: string;
  ubigeo?: string;
  gpsCoordinates: GpsCoordinates;
  placeId: string;
  dataId?: string;
  addressComponents?: AddressComponent[];
  placeName?: string;
  placeType?: string;
}

/**
 * Autocomplete query parameters
 */
export interface AutocompleteParams {
  q: string;
  country?: string;
  language?: string;
}

/**
 * Place details query parameters
 */
export interface PlaceDetailsParams {
  place_id: string;
}

/**
 * Ubigeos map response
 */
export interface UbigeosMap {
  [key: string]: string;
}

/**
 * Locations API Service
 * Provides location search and autocomplete using Google Maps via SerpAPI
 */
export const locationsApi = {
  /**
   * Autocomplete locations based on search query
   * GET /api/locations/autocomplete?q=Av Larco Miraflores
   */
  async autocomplete(params: AutocompleteParams): Promise<AutocompleteResponse> {
    const queryParams = new URLSearchParams({
      q: params.q,
    });

    if (params.country) {
      queryParams.append('country', params.country);
    }

    if (params.language) {
      queryParams.append('language', params.language);
    }

    return apiClient.get<AutocompleteResponse>(`/locations/autocomplete?${queryParams.toString()}`);
  },

  /**
   * Get location details by place ID
   * GET /api/locations/details?place_id=ChIJd8BlQ2BZwokRAFUEcm_qrcA
   */
  async getDetails(params: PlaceDetailsParams): Promise<LocationDetails> {
    const queryParams = new URLSearchParams({
      place_id: params.place_id,
    });

    return apiClient.get<LocationDetails>(`/locations/details?${queryParams.toString()}`);
  },

  /**
   * Get all available ubigeos
   * GET /api/locations/ubigeos
   */
  async getUbigeos(): Promise<UbigeosMap> {
    return apiClient.get<UbigeosMap>('/locations/ubigeos');
  },
};

export default locationsApi;
