import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Body, Button, Caption, Card, ChipGroup, EmptyState, Input, Title } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';

import { EmployeePicker } from '@/components/Payroll/EmployeePicker';
import type { ConceptCode, EmploymentRecord, ManualConcepts } from '@/types/payroll';

interface Props {
  visible: boolean;
  submitting?: boolean;
  onSubmit: (manualConcepts: ManualConcepts) => void;
  onClose: () => void;
}

/** Solo conceptos que tiene sentido inyectar manualmente en un `calculate`. */
const CONCEPT_OPTIONS: { label: string; value: ConceptCode }[] = [
  { label: 'Bono regular', value: 'BONO_REGULAR' },
  { label: 'Bono extraord.', value: 'BONO_EXTRAORDINARIO' },
  { label: 'Comision', value: 'COMISION' },
  { label: 'Reint. movilidad', value: 'REINT_MOV' },
  { label: 'Prestamo', value: 'PRESTAMO' },
  { label: 'Adelanto', value: 'ADELANTO' },
  { label: 'Dcto. varios', value: 'DCTO_VARIOS' },
];

interface Draft {
  key: string;
  user: Pick<EmploymentRecord, 'user_id' | 'full_name' | 'employee_code'> | null;
  concept: ConceptCode;
  amount: string;
}

export const ManualConceptsEditor: React.FC<Props> = ({
  visible,
  submitting,
  onSubmit,
  onClose,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  React.useEffect(() => {
    if (!visible) setDrafts([]);
  }, [visible]);

  const addRow = () =>
    setDrafts((prev) => [
      ...prev,
      { key: `${Date.now()}-${Math.random()}`, user: null, concept: 'BONO_REGULAR', amount: '' },
    ]);

  const updateRow = (key: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const removeRow = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));

  const validRows = useMemo(
    () =>
      drafts.filter(
        (d) =>
          d.user?.user_id && d.concept && Number.isFinite(Number(d.amount)) && Number(d.amount) > 0
      ),
    [drafts]
  );

  const manualConcepts: ManualConcepts = useMemo(() => {
    const map: ManualConcepts = {};
    validRows.forEach((r) => {
      if (!r.user?.user_id) return;
      const bucket = map[r.user.user_id] ?? {};
      bucket[r.concept] = Number(r.amount);
      map[r.user.user_id] = bucket;
    });
    return map;
  }, [validRows]);

  const handleCalculate = () => onSubmit(manualConcepts);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Title>Calcular periodo</Title>
          <Caption>
            Podes agregar conceptos manuales (bonos, prestamos, adelantos, etc.). Si no necesitas
            ajustes, calcula directamente.
          </Caption>

          {drafts.length === 0 ? (
            <Card style={styles.card}>
              <EmptyState
                icon="cash-outline"
                title="Sin conceptos manuales"
                description="Agrega una fila si necesitas inyectar montos por trabajador."
              />
            </Card>
          ) : (
            drafts.map((d) => (
              <Card key={d.key} style={styles.card}>
                <View style={styles.rowHeader}>
                  <Body style={styles.rowTitle}>Concepto manual</Body>
                  <TouchableOpacity onPress={() => removeRow(d.key)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={theme.color.icon.subtle} />
                  </TouchableOpacity>
                </View>
                <EmployeePicker
                  label="Trabajador"
                  required
                  selected={d.user}
                  onChange={(u) => updateRow(d.key, { user: u })}
                />
                <Caption style={styles.label}>Concepto</Caption>
                <ChipGroup
                  options={CONCEPT_OPTIONS}
                  selected={[d.concept]}
                  onChange={(sel) =>
                    updateRow(d.key, { concept: (sel[0] as ConceptCode) ?? 'BONO_REGULAR' })
                  }
                  variant="filled"
                  size="small"
                />
                <Input
                  label="Monto (S/)"
                  value={d.amount}
                  onChangeText={(v) => updateRow(d.key, { amount: v })}
                  keyboardType="decimal-pad"
                />
              </Card>
            ))
          )}

          <Button
            title="Agregar concepto manual"
            leftIcon="add-outline"
            variant="outline"
            onPress={addRow}
          />

          <Caption style={styles.summary}>
            {validRows.length} fila(s) validas · {Object.keys(manualConcepts).length} trabajador(es)
          </Caption>

          <View style={styles.actions}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} disabled={submitting} />
            <Button
              title={validRows.length > 0 ? 'Calcular con conceptos' : 'Calcular'}
              onPress={handleCalculate}
              loading={submitting}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.color.background.canvas },
    container: { padding: spacing[4], gap: spacing[2] },
    card: { padding: spacing[3], gap: spacing[2] },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowTitle: { fontWeight: '600' },
    label: { fontWeight: '600', marginTop: spacing[1] },
    summary: { textAlign: 'right' },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
      marginTop: spacing[4],
    },
  });

export default ManualConceptsEditor;
