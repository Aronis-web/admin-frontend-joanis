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
import { useQuery } from '@tanstack/react-query';

import { Body, Caption, Input } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';

import { useDebounce } from '@/hooks/useDebounce';
import { usersApi, type User } from '@/services/api/users';

export interface PickedUser {
  id: string;
  name: string;
  email?: string;
  document?: string;
}

const toPicked = (u: User): PickedUser => ({
  id: u.id,
  name:
    [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.name || u.username || u.email,
  email: u.email,
  document: u.document_number,
});

interface Props {
  label?: string;
  value?: string; // userId
  selected?: PickedUser | null;
  onChange: (user: PickedUser | null) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}

/**
 * Buscador inteligente de usuarios (typeahead inline).
 * Busca contra `usersApi.getUsers({ search })` y devuelve el usuario elegido.
 */
export const UserPicker: React.FC<Props> = ({
  label = 'Usuario',
  value,
  selected,
  onChange,
  error,
  disabled,
  required,
  placeholder = 'Buscar por nombre, email o documento…',
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounced = useDebounce(query, 250).trim();
  const enabled = focused && debounced.length >= 2 && !selected && !value;

  const { data, isFetching } = useQuery({
    queryKey: ['users', 'picker', debounced],
    queryFn: () => usersApi.getUsers({ search: debounced, limit: 15, status: 'active' }),
    enabled,
    staleTime: 30 * 1000,
  });

  const suggestions: User[] = Array.isArray((data as any)?.data)
    ? ((data as any).data as User[])
    : Array.isArray((data as any)?.items)
      ? ((data as any).items as User[])
      : Array.isArray(data)
        ? (data as unknown as User[])
        : [];

  useEffect(() => {
    return () => {
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, []);

  const handleSelect = (item: User) => {
    onChange(toPicked(item));
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
              {selected?.name ?? value}
            </Body>
            {selected?.email ? (
              <Caption style={styles.chipMeta} numberOfLines={1}>
                {selected.email}
                {selected.document ? ` · ${selected.document}` : ''}
              </Caption>
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
                  {suggestions.map((item) => {
                    const picked = toPicked(item);
                    return (
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
                            {picked.name}
                          </Body>
                          <Caption numberOfLines={1}>
                            {picked.email ?? ''}
                            {picked.document ? ` · ${picked.document}` : ''}
                          </Caption>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
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

export default UserPicker;
