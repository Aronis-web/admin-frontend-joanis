import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { purchasesService } from '@/services/api';
import {
  PurchaseAutocompleteSuggestion,
  PurchaseStatusLabels,
  PurchaseStatusColors,
} from '@/types/purchases';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchBarWithAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onSuggestionSelect?: (suggestion: PurchaseAutocompleteSuggestion) => void;
  onSubmit?: (text: string) => void;
  style?: any;
  autoFocus?: boolean;
  minChars?: number;
  maxSuggestions?: number;
}

export const SearchBarWithAutocomplete: React.FC<SearchBarWithAutocompleteProps> = ({
  value,
  onChangeText,
  placeholder = 'Buscar...',
  onClear,
  onSuggestionSelect,
  onSubmit,
  style,
  autoFocus = false,
  minChars = 2,
  maxSuggestions = 10,
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const [suggestions, setSuggestions] = useState<PurchaseAutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Sync internal value with external value when it changes externally (e.g., clear)
  useEffect(() => {
    if (value === '') {
      setInternalValue('');
    }
  }, [value]);

  // Debounce internal search term for autocomplete only
  const debouncedSearchTerm = useDebounce(internalValue, 300);

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(async (searchTerm: string) => {
    if (searchTerm.length < minChars) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await purchasesService.getAutocomplete(searchTerm, maxSuggestions);
      setSuggestions(response.suggestions);
      setShowSuggestions(response.suggestions.length > 0);
    } catch (error) {
      console.error('Error fetching autocomplete suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  }, [minChars, maxSuggestions]);

  // Fetch suggestions when debounced search term changes
  useEffect(() => {
    if (isFocused && debouncedSearchTerm) {
      fetchSuggestions(debouncedSearchTerm);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [debouncedSearchTerm, isFocused, fetchSuggestions]);

  const handleClear = () => {
    setInternalValue('');
    onChangeText('');
    setSuggestions([]);
    setShowSuggestions(false);
    onClear?.();
  };

  const handleSuggestionPress = (suggestion: PurchaseAutocompleteSuggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setInternalValue('');
    onSuggestionSelect?.(suggestion);
  };

  const handleInternalChange = (text: string) => {
    setInternalValue(text);
    // Only update parent when user submits or clears, not on every keystroke
  };

  const handleSubmitEditing = () => {
    // Update parent search term when user presses Enter
    onChangeText(internalValue);
    setShowSuggestions(false);
    onSubmit?.(internalValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (internalValue.length >= minChars && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Delay to allow suggestion press to register
    // Increased delay to allow scrolling
    setTimeout(() => {
      setIsFocused(false);
      setShowSuggestions(false);
    }, 300);
  };

  const getMatchTypeIcon = (matchType: string) => {
    switch (matchType) {
      case 'purchase':
        return '📋';
      case 'supplier':
        return '🏢';
      case 'product':
        return '📦';
      default:
        return '🔍';
    }
  };

  const getMatchTypeLabel = (matchType: string) => {
    switch (matchType) {
      case 'purchase':
        return 'Compra';
      case 'supplier':
        return 'Proveedor';
      case 'product':
        return 'Producto';
      default:
        return '';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const renderSuggestion = ({ item }: { item: PurchaseAutocompleteSuggestion }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSuggestionPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.suggestionHeader}>
        <View style={styles.suggestionLeft}>
          <Text style={styles.suggestionIcon}>{getMatchTypeIcon(item.matchType)}</Text>
          <View style={styles.suggestionInfo}>
            <Text style={styles.suggestionCode}>{item.code}</Text>
            <Text style={styles.suggestionSupplier} numberOfLines={1}>
              {item.supplierName}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: PurchaseStatusColors[item.status] + '20' },
            { borderColor: PurchaseStatusColors[item.status] },
          ]}
        >
          <Text
            style={[styles.statusText, { color: PurchaseStatusColors[item.status] }]}
          >
            {PurchaseStatusLabels[item.status]}
          </Text>
        </View>
      </View>
      <View style={styles.suggestionDetails}>
        <Text style={styles.suggestionGuide}>Guía: {item.guideNumber}</Text>
        <Text style={styles.suggestionDate}>{formatDate(item.guideDate)}</Text>
      </View>
      {item.matchedProduct && (
        <View style={styles.matchedProductContainer}>
          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          <Text style={styles.matchedProductText} numberOfLines={1}>
            {item.matchedProduct}
          </Text>
        </View>
      )}
      <View style={styles.matchTypeContainer}>
        <Text style={styles.matchTypeText}>
          Coincidencia: {getMatchTypeLabel(item.matchType)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={internalValue}
          onChangeText={handleInternalChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="search"
        />
        {isLoading && (
          <ActivityIndicator size="small" color="#6366F1" style={styles.loadingIndicator} />
        )}
        {internalValue.length > 0 && !isLoading && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            style={styles.suggestionsList}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            {suggestions.map((item) => (
              <View key={item.id}>
                {renderSuggestion({ item })}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* No results message */}
      {showSuggestions && !isLoading && internalValue.length >= minChars && suggestions.length === 0 && (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsText}>No se encontraron resultados</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1001,
    overflow: 'hidden',
  },
  suggestionsList: {
    flexGrow: 0,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  suggestionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  suggestionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  suggestionSupplier: {
    fontSize: 12,
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  suggestionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  suggestionGuide: {
    fontSize: 11,
    color: '#64748B',
  },
  suggestionDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  matchedProductContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  matchedProductText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
    marginLeft: 4,
    flex: 1,
  },
  matchTypeContainer: {
    marginTop: 2,
  },
  matchTypeText: {
    fontSize: 10,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  noResultsContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1001,
  },
  noResultsText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});
