import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Body, Button, Caption, ChipGroup, Input, Title } from '@/design-system';
import { spacing } from '@/design-system/tokens';
import type {
  AfpCode,
  AfpRegime,
  BenefitChangeType,
  BenefitChangeValue,
  CreateBenefitChangeDto,
  PensionSystem,
} from '@/types/payroll';
import { parseDecimal } from '@/types/payroll';

interface Props {
  submitting?: boolean;
  onSubmit: (dto: CreateBenefitChangeDto) => void;
  onCancel: () => void;
}

const TYPE_OPTIONS: { label: string; value: BenefitChangeType }[] = [
  { label: 'Sueldo', value: 'SUELDO' },
  { label: 'Movilidad', value: 'MOVILIDAD' },
  { label: 'Sistema pensionario', value: 'PENSION_SYSTEM' },
  { label: 'AFP', value: 'AFP' },
  { label: 'Asig. familiar', value: 'ASIGNACION_FAMILIAR' },
  { label: 'Hijos', value: 'HIJOS' },
];

const PENSION_OPTIONS: { label: string; value: PensionSystem }[] = [
  { label: 'AFP', value: 'AFP' },
  { label: 'ONP', value: 'ONP' },
  { label: 'Sin sistema', value: 'SIN' },
  { label: 'Jubilado', value: 'JUBILADO' },
];

const AFP_OPTIONS: { label: string; value: AfpCode }[] = [
  { label: 'Habitat', value: 'HABITAT' },
  { label: 'Integra', value: 'INTEGRA' },
  { label: 'Prima', value: 'PRIMA' },
  { label: 'ProFuturo', value: 'PROFUTURO' },
];

const REGIME_OPTIONS: { label: string; value: AfpRegime }[] = [
  { label: 'Flujo', value: 'flujo' },
  { label: 'Mixta', value: 'mixta' },
];

/**
 * Form para crear un cambio de beneficio.
 * newValue depende de `changeType`: se serializa segun la guia del backend.
 */
export const BenefitChangeForm: React.FC<Props> = ({ submitting = false, onSubmit, onCancel }) => {
  const [changeType, setChangeType] = useState<BenefitChangeType>('SUELDO');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [notes, setNotes] = useState('');

  // Campos condicionales
  const [amount, setAmount] = useState(''); // SUELDO | MOVILIDAD | HIJOS
  const [pensionSystem, setPensionSystem] = useState<PensionSystem>('AFP');
  const [afpCode, setAfpCode] = useState<AfpCode | undefined>();
  const [afpRegime, setAfpRegime] = useState<AfpRegime | undefined>();
  const [cuspp, setCuspp] = useState('');
  const [hasFamilyAllowance, setHasFamilyAllowance] = useState(true);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!effectiveDate.trim()) e.effectiveDate = 'Requerido (YYYY-MM-DD)';
    if (changeType === 'SUELDO' || changeType === 'MOVILIDAD') {
      if (!amount || parseDecimal(amount) < 0) e.amount = 'Debe ser >= 0';
    }
    if (changeType === 'HIJOS' && (!amount || Number.isNaN(Number(amount)))) {
      e.amount = 'Numero invalido';
    }
    if (changeType === 'AFP' && (!afpCode || !afpRegime)) {
      e.afp = 'Selecciona AFP y regimen';
    }
    if (changeType === 'PENSION_SYSTEM' && pensionSystem === 'AFP' && (!afpCode || !afpRegime)) {
      e.afp = 'Selecciona AFP y regimen';
    }
    return e;
  }, [changeType, effectiveDate, amount, afpCode, afpRegime, pensionSystem]);

  const canSubmit = Object.keys(errors).length === 0 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    let newValue: BenefitChangeValue;
    switch (changeType) {
      case 'SUELDO':
        newValue = { basic_salary: parseDecimal(amount) };
        break;
      case 'MOVILIDAD':
        newValue = { movilidad_amount: parseDecimal(amount) };
        break;
      case 'HIJOS':
        newValue = { children_count: Number(amount) };
        break;
      case 'ASIGNACION_FAMILIAR':
        newValue = { has_family_allowance: hasFamilyAllowance };
        break;
      case 'AFP':
        newValue = { afp_code: afpCode!, afp_regime: afpRegime!, cuspp: cuspp || undefined };
        break;
      case 'PENSION_SYSTEM':
        newValue = {
          pension_system: pensionSystem,
          afp_code: pensionSystem === 'AFP' ? afpCode : undefined,
          afp_regime: pensionSystem === 'AFP' ? afpRegime : undefined,
          cuspp: pensionSystem === 'AFP' ? cuspp || undefined : undefined,
        };
        break;
      default:
        newValue = {};
    }
    onSubmit({
      changeType,
      newValue,
      effectiveDate,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Title>Nuevo cambio de beneficio</Title>

      <Caption>Tipo</Caption>
      <ChipGroup
        options={TYPE_OPTIONS}
        selected={[changeType]}
        onChange={(sel) => setChangeType((sel[0] as BenefitChangeType) ?? 'SUELDO')}
        variant="filled"
        size="small"
      />

      <Input
        label="Fecha efectiva *"
        placeholder="YYYY-MM-DD"
        value={effectiveDate}
        onChangeText={setEffectiveDate}
        error={errors.effectiveDate}
        autoCapitalize="none"
      />

      {(changeType === 'SUELDO' || changeType === 'MOVILIDAD') && (
        <Input
          label={changeType === 'SUELDO' ? 'Nuevo sueldo (S/) *' : 'Nueva movilidad (S/) *'}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          error={errors.amount}
        />
      )}

      {changeType === 'HIJOS' && (
        <Input
          label="Numero de hijos *"
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          error={errors.amount}
        />
      )}

      {changeType === 'ASIGNACION_FAMILIAR' && (
        <>
          <Caption>Asignacion familiar</Caption>
          <ChipGroup
            options={[
              { label: 'Otorgar', value: 'yes' },
              { label: 'Quitar', value: 'no' },
            ]}
            selected={[hasFamilyAllowance ? 'yes' : 'no']}
            onChange={(sel) => setHasFamilyAllowance(sel[0] === 'yes')}
            variant="filled"
            size="small"
          />
        </>
      )}

      {(changeType === 'AFP' || changeType === 'PENSION_SYSTEM') && (
        <>
          {changeType === 'PENSION_SYSTEM' && (
            <>
              <Caption>Sistema pensionario</Caption>
              <ChipGroup
                options={PENSION_OPTIONS}
                selected={[pensionSystem]}
                onChange={(sel) => setPensionSystem((sel[0] as PensionSystem) ?? 'AFP')}
                variant="filled"
                size="small"
              />
            </>
          )}
          {(changeType === 'AFP' || pensionSystem === 'AFP') && (
            <>
              <Caption>AFP</Caption>
              <ChipGroup
                options={AFP_OPTIONS}
                selected={afpCode ? [afpCode] : []}
                onChange={(sel) => setAfpCode(sel[0] as AfpCode)}
                variant="filled"
                size="small"
              />
              <Caption>Regimen</Caption>
              <ChipGroup
                options={REGIME_OPTIONS}
                selected={afpRegime ? [afpRegime] : []}
                onChange={(sel) => setAfpRegime(sel[0] as AfpRegime)}
                variant="filled"
                size="small"
              />
              <Input
                label="CUSPP"
                value={cuspp}
                onChangeText={setCuspp}
                autoCapitalize="characters"
              />
              {errors.afp && <Body style={styles.error}>{errors.afp}</Body>}
            </>
          )}
        </>
      )}

      <Input
        label="Notas"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Motivo del cambio"
      />

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={onCancel} disabled={submitting} />
        <Button
          title="Crear cambio"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: spacing[4], gap: spacing[2] },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
    marginTop: spacing[5],
  },
  error: { color: '#c0392b', fontSize: 12 },
});
