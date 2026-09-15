import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Body, Button, Caption, Card, EmptyState, ErrorState, Input, Title } from '@/design-system';
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
}

/**
 * Selector de trabajador con modal de busqueda.
 * Reutiliza `usePayrollEmployees` para listar/filtrar.
 */
export const EmployeePicker: React.FC<Props> = ({
  label = 'Trabajador',
  value,
  selected,
  onChange,
  error,
  disabled,
  required,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300).trim();

  const params = useMemo(
    () => ({ search: debounced || undefined, isActive: true, limit: 30, offset: 0 }),
    [debounced]
  );

  const { data, isLoading, isError, refetch } = usePayrollEmployees(params, open);
  const employees = (data ?? []) as EmploymentRecord[];

  const handleSelect = (item: EmploymentRecord) => {
    onChange({
      user_id: item.user_id,
      full_name: item.full_name ?? null,
      employee_code: item.employee_code,
    });
    setOpen(false);
    setSearch('');
  };

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Caption style={styles.label}>
          {label}
          {required ? ' *' : ''}
        </Caption>
      ) : null}
      <TouchableOpacity
        style={[styles.field, error && styles.fieldError, disabled && styles.fieldDisabled]}
        activeOpacity={0.7}
        onPress={() => !disabled && setOpen(true)}
      >
        {selected || value ? (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Body style={styles.name}>{selected?.full_name ?? value}</Body>
              {selected?.employee_code ? <Caption>Cod. {selected.employee_code}</Caption> : null}
            </View>
            {!disabled && (
              <TouchableOpacity onPress={() => onChange(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={theme.color.icon.subtle} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.row}>
            <Ionicons name="person-outline" size={18} color={theme.color.icon.subtle} />
            <Caption style={styles.placeholder}>Seleccionar trabajador…</Caption>
          </View>
        )}
      </TouchableOpacity>
      {error ? <Caption style={styles.errorText}>{error}</Caption> : null}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalHeader}>
            <Title>Buscar trabajador</Title>
            <Button title="Cerrar" variant="ghost" size="small" onPress={() => setOpen(false)} />
          </View>
          <View style={{ paddingHorizontal: spacing[4] }}>
            <Input
              placeholder="Nombre o codigo"
              value={search}
              onChangeText={setSearch}
              leftIcon="search-outline"
              size="small"
              autoFocus
            />
          </View>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.color.brand.accent} />
            </View>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : employees.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="Sin resultados"
              description="Ajusta la busqueda."
            />
          ) : (
            <FlatList
              data={employees}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleSelect(item)} activeOpacity={0.7}>
                  <Card style={styles.card}>
                    <Body style={styles.name}>{item.full_name ?? item.user_id}</Body>
                    <Caption>
                      {(item.employee_code ?? '—') +
                        (item.position_name ? ` · ${item.position_name}` : '')}
                    </Caption>
                  </Card>
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: { gap: spacing[1] },
    label: { fontWeight: '600' },
    field: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      backgroundColor: theme.color.surface.subtle,
      minHeight: 48,
      justifyContent: 'center',
    },
    fieldError: { borderColor: theme.color.border.error },
    fieldDisabled: { opacity: 0.5 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    placeholder: { color: theme.color.text.placeholder },
    name: { fontWeight: '600' },
    errorText: { color: theme.color.text.danger },
    safe: { flex: 1, backgroundColor: theme.color.background.canvas },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing[4],
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: spacing[4], gap: spacing[2] },
    card: { padding: spacing[3], marginBottom: spacing[2], gap: 2 },
  });

export default EmployeePicker;
