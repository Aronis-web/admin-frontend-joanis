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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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
          <Ionicons name="checkmark-circle" size={14} color={colors.success[500]} />
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
          <ActivityIndicator size="small" color={colors.accent[500]} style={styles.loadingIndicator} />
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
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    height: 44,
  },
  searchIcon: {
    marginRight: spacing[2],
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.neutral[800],
    paddingVertical: 0,
  },
  loadingIndicator: {
    marginLeft: spacing[2],
  },
  clearButton: {
    padding: spacing[1],
    marginLeft: spacing[2],
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    maxHeight: 400,
    shadowColor: colors.neutral[950],
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
    padding: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
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
    marginRight: spacing[2],
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionCode: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  suggestionSupplier: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginLeft: spacing[2],
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  suggestionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  suggestionGuide: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  suggestionDate: {
    fontSize: 11,
    color: colors.neutral[400],
  },
  matchedProductContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    marginBottom: spacing[1],
  },
  matchedProductText: {
    fontSize: 11,
    color: colors.success[500],
    fontWeight: '500',
    marginLeft: spacing[1],
    flex: 1,
  },
  matchTypeContainer: {
    marginTop: 2,
  },
  matchTypeText: {
    fontSize: 10,
    color: colors.neutral[400],
    fontStyle: 'italic',
  },
  noResultsContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: spacing[4],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1001,
  },
  noResultsText: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
});
