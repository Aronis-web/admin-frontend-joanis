import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Caption, Text, useTheme, useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { spacing, borderRadius } from '@/design-system/tokens';
import type { ProductVariant } from '@/services/api/product-variants';

interface VariantStockSelectorProps {
  /** Variantes con stock propio (tracksStock=true) del producto. */
  stockVariants: ProductVariant[];
  /** Variante elegida en el formulario ('' = sin variante). */
  value: string;
  /** Variante elegida resuelta (puede ser descriptiva si la fila ya la tenia). */
  selectedVariant: ProductVariant | null;
  onChange: (variantId: string) => void;
}

/**
 * Selector de variante (color) para el catalogo/cajon del bot.
 *
 * Solo se muestra si el producto tiene variantes con stock propio. "Sin
 * variante" vende el saldo del producto; cada variante con stock propio vende
 * su saldo. Las variantes descriptivas no se ofrecen (el bot las vende contra
 * el saldo del producto).
 */
export const VariantStockSelector: React.FC<VariantStockSelectorProps> = ({
  stockVariants,
  value,
  selectedVariant,
  onChange,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const selectedIsDescriptive =
    !!value && !!selectedVariant && (!selectedVariant.tracksStock || !!selectedVariant.deletedAt);

  if (stockVariants.length === 0 && !selectedIsDescriptive) return null;

  const options: Array<{ id: string; label: string }> = [
    { id: '', label: 'Sin variante (saldo del producto)' },
    ...stockVariants.map((v) => ({ id: v.id, label: v.name })),
  ];
  if (selectedIsDescriptive && selectedVariant) {
    options.push({ id: selectedVariant.id, label: `${selectedVariant.name} (sin stock propio)` });
  }

  return (
    <View>
      <Caption color={theme.color.text.muted} style={styles.groupLabel}>
        Variante (color)
      </Caption>
      <View style={styles.chipRow}>
        {options.map((o) => {
          const active = value === o.id;
          return (
            <TouchableOpacity
              key={o.id || 'sin-variante'}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(o.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selectedIsDescriptive && value === selectedVariant?.id ? (
        <Caption color={theme.color.text.muted} style={styles.hint}>
          Esta variante no lleva stock propio: se vende contra el saldo del producto.
        </Caption>
      ) : null}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    groupLabel: {
      marginBottom: spacing[2],
    },
    hint: {
      marginTop: spacing[2],
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    chip: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    chipActive: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.brand.accentSoft,
    },
    chipText: {
      fontSize: 13,
      color: theme.color.text.body,
    },
    chipTextActive: {
      color: theme.color.brand.accent,
      fontWeight: '600',
    },
  });
