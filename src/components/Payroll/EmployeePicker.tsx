import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Body, Caption, Input } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';

import { useDebounce } from '@/hooks/useDebounce';
import { usePayrollEmployees } from '@/hooks/api/usePayrollEmployment';
import type { EmploymentRecord } from '@/types/payroll';

interface Props {
  label?: string;
  value?: string; // userId
  selected?: Pick<EmploymentRecord, 'user_id' | 'full_name' | 'employee_code'> | null;
  onChange: (
    record: Pick<EmploymentRecord, 'user_id' | 'full_name' | 'employee_code'> | null
  ) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}

/**
 * Buscador inteligente de trabajador (typeahead inline).
 * Muestra sugerencias en un dropdown flotante mientras el usuario escribe.
 * API pública compatible con la versión anterior basada en modal.
 */
export const EmployeePicker: React.FC<Props> = ({
  label = 'Trabajador',
  value,
  selected,
  onChange,
  error,
  disabled,
  required,
  placeholder = 'Buscar por nombre o codigo…',
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounced = useDebounce(query, 250).trim();
  const enabled = focused && debounced.length >= 2 && !selected && !value;

  const params = useMemo(
    () => ({ search: debounced || undefined, isActive: true, limit: 15, offset: 0 }),
    [debounced]
  );

  const { data, isFetching } = usePayrollEmployees(params, enabled);
  const suggestions = (data ?? []) as EmploymentRecord[];

  useEffect(() => {
    return () => {
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, []);

  const handleSelect = (item: EmploymentRecord) => {
    onChange({
      user_id: item.user_id,
      full_name: item.full_name ?? null,
      employee_code: item.employee_code,
    });
    setQuery('');
    setFocused(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
  };

  const handleFocus = () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setFocused(true);
  };

  const handleBlur = () => {
    // Delay para que el tap en una sugerencia pueda registrarse antes de ocultar.
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    blurTimeout.current = setTimeout(() => setFocused(false), 180);
  };

  const showChip = Boolean(selected || value);
  const showDropdown = focused && !showChip && debounced.length >= 2;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Caption style={styles.label}>
          {label}
          {required ? ' *' : ''}
        </Caption>
      ) : null}

      {showChip ? (
        <View style={[styles.chip, error && styles.chipError, disabled && styles.chipDisabled]}>
          <Ionicons name="person" size={16} color={theme.color.brand.primary} />
          <View style={{ flex: 1 }}>
            <Body style={styles.chipName} numberOfLines={1}>
              {selected?.full_name ?? value}
            </Body>
            {selected?.employee_code ? (
              <Caption style={styles.chipMeta}>Cod. {selected.employee_code}</Caption>
            ) : null}
          </View>
          {!disabled && (
            <TouchableOpacity onPress={handleClear} hitSlop={8} accessibilityLabel="Quitar">
              <Ionicons name="close-circle" size={20} color={theme.color.icon.subtle} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.searchWrap}>
          <Input
            placeholder={placeholder}
            value={query}
            onChangeText={setQuery}
            leftIcon="search-outline"
            size="small"
            editable={!disabled}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={handleFocus}
            onBlur={handleBlur}
            error={error}
          />

          {showDropdown && (
            <Pressable style={styles.dropdown} onPress={(e) => e.stopPropagation()}>
              {isFetching ? (
                <View style={styles.dropdownState}>
                  <ActivityIndicator size="small" color={theme.color.brand.accent} />
                  <Caption style={styles.dropdownStateText}>Buscando…</Caption>
                </View>
              ) : suggestions.length === 0 ? (
                <View style={styles.dropdownState}>
                  <Ionicons name="search-outline" size={18} color={theme.color.icon.subtle} />
                  <Caption style={styles.dropdownStateText}>Sin resultados</Caption>
                </View>
              ) : (
                <ScrollView
                  style={styles.dropdownList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {suggestions.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.suggestion}
                      activeOpacity={0.7}
                      onPress={() => handleSelect(item)}
                    >
                      <View style={styles.suggestionIcon}>
                        <Ionicons
                          name="person-circle-outline"
                          size={22}
                          color={theme.color.icon.subtle}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Body style={styles.suggestionName} numberOfLines={1}>
                          {item.full_name ?? item.user_id}
                        </Body>
                        <Caption numberOfLines={1}>
                          {(item.employee_code ?? '—') +
                            (item.position_name ? ` · ${item.position_name}` : '')}
                        </Caption>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: { gap: spacing[1], position: 'relative', zIndex: 100 },
    label: { fontWeight: '600' },

    // Chip (trabajador ya seleccionado)
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      borderWidth: 1,
      borderColor: theme.color.brand.primary,
      backgroundColor: theme.color.brand.primarySoft,
      borderRadius: theme.radii.lg,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      minHeight: 48,
    },
    chipError: { borderColor: theme.color.border.error },
    chipDisabled: { opacity: 0.5 },
    chipName: { fontWeight: '600', color: theme.color.text.heading },
    chipMeta: { color: theme.color.text.muted },

    // Buscador inline
    searchWrap: { position: 'relative', zIndex: 100 },

    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: spacing[1],
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      maxHeight: 260,
      overflow: 'hidden',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 200,
    },
    dropdownList: { flexGrow: 0 },
    dropdownState: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
    },
    dropdownStateText: { color: theme.color.text.muted },

    suggestion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    suggestionIcon: {
      width: 28,
      alignItems: 'center',
    },
    suggestionName: { fontWeight: '600' },
  });

export default EmployeePicker;
