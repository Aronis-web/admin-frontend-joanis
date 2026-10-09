/**
 * Selector múltiple de sedes con chips. Lista vacía = todas las sedes.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/design-system';
import { spacing } from '@/design-system/tokens';
import type { ConsultaWaSiteOption } from '@/types/consultas-wa';

export interface SiteMultiSelectProps {
  sites: ConsultaWaSiteOption[];
  value: string[];
  onChange: (siteIds: string[]) => void;
  disabled?: boolean;
}

export const SiteMultiSelect: React.FC<SiteMultiSelectProps> = ({
  sites,
  value,
  onChange,
  disabled,
}) => {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <View style={styles.wrap}>
      <Chip
        label="Todas las sedes"
        size="small"
        selected={value.length === 0}
        onPress={() => onChange([])}
        disabled={disabled}
      />
      {sites.map((site) => (
        <Chip
          key={site.id}
          label={site.isFranchise ? `${site.name} (franquicia)` : site.name}
          size="small"
          variant="outlined"
          selected={value.includes(site.id)}
          onPress={() => toggle(site.id)}
          disabled={disabled}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
});

export default SiteMultiSelect;
