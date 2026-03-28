/**
 * SearchBar Component
 *
 * Barra de búsqueda reutilizable.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../primitives/Text';
import { colors } from '../../tokens/colors';
import { spacing, borderRadius, iconSizes } from '../../tokens/spacing';
import { textVariants } from '../../tokens/typography';
import { activeOpacity, durations } from '../../tokens/animations';

export interface SearchBarProps {
  /**
   * Valor del input
   */
  value: string;

  /**
   * Callback al cambiar el valor
   */
  onChangeText: (text: string) => void;

  /**
   * Placeholder
   */
  placeholder?: string;

  /**
   * Callback al enviar búsqueda
   */
  onSubmit?: () => void;

  /**
   * Si está cargando
   */
  loading?: boolean;

  /**
   * Si el campo tiene autofocus
   */
  autoFocus?: boolean;

  /**
   * Callback al limpiar
   */
  onClear?: () => void;

  /**
   * Callback al cancelar (muestra botón cancelar)
   */
  onCancel?: () => void;

  /**
   * Estilos adicionales
   */
  style?: ViewStyle;

  /**
   * Si está deshabilitado
   */
  disabled?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Buscar...',
  onSubmit,
  loading = false,
  autoFocus = false,
  onClear,
  onCancel,
  style,
  disabled = false,
}) => {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const cancelAnim = useRef(new Animated.Value(onCancel ? 1 : 0)).current;

  useEffect(() => {
    if (onCancel) {
      Animated.timing(cancelAnim, {
        toValue: isFocused ? 1 : 0,
        duration: durations.fast,
        useNativeDriver: false,
      }).start();
    }
  }, [isFocused, onCancel]);

  const handleClear = () => {
    onChangeText('');
    onClear?.();
    inputRef.current?.focus();
  };

  const handleCancel = () => {
    onChangeText('');
    setIsFocused(false);
    inputRef.current?.blur();
    onCancel?.();
  };

  const showClearButton = value.length > 0 && !loading;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
        {/* Search Icon */}
        <View style={styles.iconContainer}>
          <Ionicons
            name="search"
            size={iconSizes.md}
            color={isFocused ? colors.icon.primary : colors.icon.tertiary}
          />
        </View>

        {/* Input */}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          autoFocus={autoFocus}
          editable={!disabled}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Loading / Clear Button */}
        {loading ? (
          <View style={styles.rightIconContainer}>
            <ActivityIndicator size="small" color={colors.primary[900]} />
          </View>
        ) : showClearButton ? (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={handleClear}
            activeOpacity={activeOpacity.medium}
          >
            <Ionicons name="close-circle" size={iconSizes.md} color={colors.icon.tertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Cancel Button */}
      {onCancel && (
        <Animated.View
          style={[
            styles.cancelContainer,
            {
              opacity: cancelAnim,
              width: cancelAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 70],
              }),
            },
          ]}
        >
          <TouchableOpacity onPress={handleCancel} activeOpacity={activeOpacity.medium}>
            <Text variant="buttonMedium" color={colors.primary[900]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

// ============================================
// SEARCH WITH FILTERS
// ============================================
export interface SearchWithFiltersProps extends SearchBarProps {
  /**
   * Número de filtros activos
   */
  activeFilters?: number;

  /**
   * Callback al presionar filtros
   */
  onFilterPress?: () => void;
}

export const SearchWithFilters: React.FC<SearchWithFiltersProps> = ({
  activeFilters = 0,
  onFilterPress,
  ...searchProps
}) => {
  return (
    <View style={styles.searchWithFilters}>
      <View style={styles.searchContainer}>
        <SearchBar {...searchProps} style={styles.searchFlex} />
      </View>

      {onFilterPress && (
        <TouchableOpacity
          style={[styles.filterButton, activeFilters > 0 && styles.filterButtonActive]}
          onPress={onFilterPress}
          activeOpacity={activeOpacity.medium}
        >
          <Ionicons
            name="options-outline"
            size={iconSizes.md}
            color={activeFilters > 0 ? colors.text.inverse : colors.icon.primary}
          />
          {activeFilters > 0 && (
            <View style={styles.filterBadge}>
              <Text variant="labelSmall" color={colors.primary[900]}>
                {activeFilters}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 44,
  },

  inputContainerFocused: {
    backgroundColor: colors.surface.primary,
    borderColor: colors.primary[900],
  },

  iconContainer: {
    paddingLeft: spacing[3],
    paddingRight: spacing[2],
  },

  input: {
    flex: 1,
    ...textVariants.bodyMedium,
    color: colors.text.primary,
    paddingVertical: spacing[2],
    paddingRight: spacing[2],
  },

  rightIconContainer: {
    paddingHorizontal: spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
  },

  cancelContainer: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },

  // Search with filters
  searchWithFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  searchContainer: {
    flex: 1,
  },

  searchFlex: {
    flex: 1,
  },

  filterButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterButtonActive: {
    backgroundColor: colors.primary[900],
  },

  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.full,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SearchBar;
