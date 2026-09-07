/**
 * SupplierPickerModal
 *
 * Modal cross-platform (web + nativo) para seleccionar 1..N proveedores.
 * Se usa tanto en la creación de un grupo (multi-select) como en la
 * acción "Agregar proveedores" del detalle de grupo.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import {
  Badge,
  Body,
  Button,
  Caption,
  Input,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useDebounce } from '@/hooks/useDebounce';
import { suppliersService } from '@/services/api/suppliers';
import type { Supplier } from '@/types/suppliers';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (supplierIds: string[]) => void;
  title?: string;
  confirmLabel?: string;
  initialSelectedIds?: string[];
  /** IDs a excluir (ya pertenecen al grupo actual, etc). */
  excludeIds?: string[];
  loading?: boolean;
}

export const SupplierPickerModal: React.FC<Props> = ({
  visible,
  onClose,
  onConfirm,
  title = 'Seleccionar proveedores',
  confirmLabel = 'Agregar',
  initialSelectedIds = [],
  excludeIds = [],
  loading = false,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const debouncedSearch = useDebounce(search.trim(), 300);

  useEffect(() => {
    if (visible) {
      setSelected(new Set(initialSelectedIds));
      setSearch('');
    }
  }, [visible, initialSelectedIds]);

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['smart-purchase', 'supplier-picker', debouncedSearch],
    queryFn: () =>
      suppliersService.getSuppliers({
        query: debouncedSearch || undefined,
        isActive: true,
        limit: 50,
      }),
    enabled: visible,
    staleTime: 60 * 1000,
  });

  const items: Supplier[] = useMemo(() => {
    const list = data?.data ?? [];
    return list.filter((s) => !excludeSet.has(s.id));
  }, [data, excludeSet]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (selected.size === 0) return;
    onConfirm(Array.from(selected));
  };

  const renderItem = ({ item }: { item: Supplier }) => {
    const isSelected = selected.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => toggle(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.rowInfo}>
          <Body style={{ fontWeight: '600' }} numberOfLines={1}>
            {item.commercialName}
          </Body>
          <Caption color="muted">
            {item.code}
            {item.email ? ` · ${item.email}` : ''}
          </Caption>
        </View>
        <View
          style={[
            styles.check,
            {
              borderColor: isSelected ? theme.color.brand.primary : theme.color.border.default,
              backgroundColor: isSelected ? theme.color.brand.primary : 'transparent',
            },
          ]}
        >
          {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Title>{title}</Title>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={theme.color.text.body} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Input
              leftIcon="search"
              placeholder="Buscar por nombre, RUC o código..."
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
          </View>

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.color.brand.primary} />
            </View>
          ) : isError ? (
            <View style={styles.centered}>
              <Body color="danger">No se pudieron cargar los proveedores.</Body>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.centered}>
              <Body color="muted">Sin resultados.</Body>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(s) => s.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: spacing[4] }}
              keyboardShouldPersistTaps="handled"
            />
          )}

          <View style={styles.footer}>
            <Badge variant="info" label={`${selected.size} seleccionado(s)`} />
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <Button title="Cancelar" variant="ghost" onPress={onClose} />
              <Button
                title={confirmLabel}
                variant="primary"
                onPress={handleConfirm}
                disabled={selected.size === 0 || loading}
                loading={loading}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: '85%',
      minHeight: '60%',
      paddingTop: spacing[4],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
    },
    searchWrap: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[6],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.subtle,
      gap: spacing[4],
    },
    rowSelected: {
      backgroundColor: theme.color.surface.subtle,
    },
    rowInfo: {
      flex: 1,
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 160,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing[6],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.subtle,
      gap: spacing[4],
    },
  });
