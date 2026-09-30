import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

export interface TransfersFilterOption {
  key: string;
  label: string;
}

interface TransfersFilterChipsProps {
  options: TransfersFilterOption[];
  selected: string;
  onSelect: (key: string) => void;
}

/**
 * Fila horizontal de chips de filtro del módulo de traslados y recepciones.
 * Mismo diseño que el filtro de estado de Campañas.
 */
export const TransfersFilterChips: React.FC<TransfersFilterChipsProps> = ({
  options,
  selected,
  onSelect,
}) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.filterWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
      >
        {options.map((option) => {
          const isActive = selected === option.key;
          return (
            <TouchableOpacity
              key={option.key || 'all'}
              style={[styles.filterButton, isActive && styles.filterButtonActive]}
              onPress={() => onSelect(option.key)}
            >
              <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    filterWrapper: {
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    filterContent: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      gap: theme.space[2],
    },
    filterButton: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      marginRight: theme.space[2],
    },
    filterButtonActive: {
      backgroundColor: theme.color.brand.primary,
    },
    filterButtonText: {
      fontSize: 14,
      color: theme.color.text.subtle,
      fontWeight: '500',
    },
    filterButtonTextActive: {
      color: theme.color.text.inverse,
    },
  });
