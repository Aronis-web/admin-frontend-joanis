/**
 * ProductSearchAutocomplete
 *
 * Dropdown de sugerencias (typeahead) para el buscador de productos.
 * Consume `GET /admin/products/autocomplete` vía `useProductsAutocomplete`.
 *
 * Se renderiza inline (como el buscador de campañas: sin `position: absolute`)
 * para evitar recortes por ancestros con overflow (LinearGradient del header).
 * Tiene scroll interno con `maxHeight` y respeta el teclado con
 * `keyboardShouldPersistTaps="handled"`.
 *
 * Reglas de negocio (backend):
 * - Mínimo 2 caracteres (con menos devuelve `[]`).
 * - Matchea nombre, alias, SKU, código de barras (incluye variantes),
 *   correlativo numérico y full-text search en español.
 * - Si el término matchea una variante, el item devuelto es el producto padre.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Text, Caption } from '@/design-system/components';
import { useProductsAutocomplete } from '@/hooks/api/useProducts';
import type { ProductAutocompleteItem } from '@/services/api/products';

interface ProductSearchAutocompleteProps {
  /** Término crudo del input. El componente debounce internamente (~300ms). */
  query: string;
  /** Máximo de resultados (default 8). */
  limit?: number;
  /** Debounce interno en ms (default 300). Pon 0 si ya viene debounced. */
  debounceMs?: number;
  /** Callback al elegir una sugerencia. */
  onSelect: (item: ProductAutocompleteItem) => void;
  /** Permite ocultar el dropdown desde afuera (blur, click-away, etc). */
  visible?: boolean;
  /** Altura máxima del contenedor (default 320). */
  maxHeight?: number;
  /** Estilos extra para el contenedor. */
  style?: any;
  /**
   * Slot opcional a la derecha de cada sugerencia. Si se provee, reemplaza
   * el precio por defecto. Útil para mostrar stock disponible por sede,
   * badge de estado, etc. sin acoplar el componente a un dominio específico.
   */
  renderRight?: (item: ProductAutocompleteItem) => React.ReactNode;
}

export const ProductSearchAutocomplete: React.FC<ProductSearchAutocompleteProps> = ({
  query,
  limit = 8,
  debounceMs = 300,
  onSelect,
  visible = true,
  maxHeight = 320,
  style,
  renderRight,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  // Debounce interno para no saturar el endpoint mientras el usuario tipea.
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    if (debounceMs <= 0) {
      setDebouncedQuery(query);
      return;
    }
    const id = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(id);
  }, [query, debounceMs]);

  const trimmed = debouncedQuery.trim();
  const isValid = trimmed.length >= 2;
  const { data, isFetching } = useProductsAutocomplete(trimmed, limit, visible && isValid);

  if (!visible || !isValid) return null;

  const items = data ?? [];
  // Solo mostramos el estado "Buscando…" en el arranque (sin datos aún).
  // Mientras haya sugerencias previas visibles (placeholderData), el refetch
  // se comunica con un spinner discreto en la esquina para no reflashear.
  const showInitialLoader = isFetching && items.length === 0;
  const showEmpty = !isFetching && items.length === 0;

  return (
    <View style={[styles.container, { maxHeight }, style]}>
      {isFetching && items.length > 0 && (
        <View style={styles.inlineSpinner} pointerEvents="none">
          <ActivityIndicator size="small" color={theme.color.brand.accent} />
        </View>
      )}
      {showInitialLoader ? (
        <View style={styles.stateRow}>
          <ActivityIndicator size="small" color={theme.color.brand.accent} />
          <Caption color="tertiary" style={styles.stateText}>
            Buscando…
          </Caption>
        </View>
      ) : showEmpty ? (
        <View style={styles.stateRow}>
          <Ionicons name="search" size={16} color={theme.color.icon.subtle} />
          <Caption color="tertiary" style={styles.stateText}>
            Sin resultados para “{trimmed}”
          </Caption>
        </View>
      ) : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {items.map((item) => {
            const thumb = item.photos?.[0];
            const priceCents = item.priceProfiles?.[0]?.prices?.[0]?.priceCents;
            const currency = item.priceProfiles?.[0]?.prices?.[0]?.currency ?? item.currency;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.itemRow}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={styles.thumbPlaceholder}>
                    <Text style={styles.thumbPlaceholderText}>📦</Text>
                  </View>
                )}

                <View style={styles.itemBody}>
                  <Text variant="labelLarge" color="primary" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Caption color="tertiary" numberOfLines={1}>
                    #{item.correlativeNumber} · SKU {item.sku}
                    {item.barcode ? ` · ${item.barcode}` : ''}
                  </Caption>
                </View>

                {renderRight ? (
                  renderRight(item)
                ) : typeof priceCents === 'number' ? (
                  <Text variant="labelMedium" color={theme.color.brand.accent}>
                    {currency} {(priceCents / 100).toFixed(2)}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 12,
      elevation: 6,
    },
    list: {
      flexGrow: 0,
    },
    inlineSpinner: {
      position: 'absolute',
      top: theme.space[2],
      right: theme.space[3],
      zIndex: 5,
    },
    stateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.space[3],
      gap: theme.space[2],
    },
    stateText: {
      marginLeft: theme.space[1],
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
    thumb: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
    },
    thumbPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbPlaceholderText: {
      fontSize: 20,
    },
    itemBody: {
      flex: 1,
      minWidth: 0,
    },
  });

export default ProductSearchAutocomplete;
