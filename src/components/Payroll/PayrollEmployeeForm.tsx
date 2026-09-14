import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Body, Button, Caption, ChipGroup, Input, Title } from '@/design-system';
import { spacing } from '@/design-system/tokens';
import type {
  AfpCode,
  AfpRegime,
  CreateEmploymentDto,
  EmploymentRecord,
  PensionSystem,
} from '@/types/payroll';
import { parseDecimal } from '@/types/payroll';

interface Props {
  initial?: Partial<EmploymentRecord> | null;
  /** Si es edicion, el userId ya esta bloqueado. */
  editMode?: boolean;
  submitting?: boolean;
  onSubmit: (data: CreateEmploymentDto) => void;
  onCancel: () => void;
}

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
 * Form maestro laboral (alta o edicion).
 * - Aplica validacion condicional: si pensionSystem === 'AFP', afpCode + afpRegime son obligatorios.
 * - En edicion se ocultan sueldo y movilidad (van via cambios de beneficio).
 */
export const PayrollEmployeeForm: React.FC<Props> = ({
  initial,
  editMode = false,
  submitting = false,
  onSubmit,
  onCancel,
}) => {
  const [userId, setUserId] = useState(initial?.user_id ?? '');
  const [employeeCode, setEmployeeCode] = useState(initial?.employee_code ?? '');
  const [hireDate, setHireDate] = useState(initial?.hire_date ?? '');
  const [positionName, setPositionName] = useState(initial?.position_name ?? '');
  const [area, setArea] = useState(initial?.area ?? '');
  const [costCenter, setCostCenter] = useState(initial?.cost_center ?? '');
  const [siteId, setSiteId] = useState(initial?.site_id ?? '');
  const [contractType, setContractType] = useState(initial?.contract_type ?? '');
  const [basicSalary, setBasicSalary] = useState(
    initial?.basic_salary ? String(parseDecimal(initial.basic_salary)) : ''
  );
  const [movilidad, setMovilidad] = useState(
    initial?.movilidad_amount ? String(parseDecimal(initial.movilidad_amount)) : '0'
  );
  const [hasFamilyAllowance, setHasFamilyAllowance] = useState(
    Boolean(initial?.has_family_allowance)
  );
  const [childrenCount, setChildrenCount] = useState(String(initial?.children_count ?? 0));
  const [pensionSystem, setPensionSystem] = useState<PensionSystem>(
    (initial?.pension_system as PensionSystem) ?? 'ONP'
  );
  const [afpCode, setAfpCode] = useState<AfpCode | undefined>(
    (initial?.afp_code as AfpCode) ?? undefined
  );
  const [afpRegime, setAfpRegime] = useState<AfpRegime | undefined>(
    (initial?.afp_regime as AfpRegime) ?? undefined
  );
  const [cuspp, setCuspp] = useState(initial?.cuspp ?? '');
  const [hasEps, setHasEps] = useState(Boolean(initial?.has_eps));
  const [bankName, setBankName] = useState(initial?.bank_name ?? '');
  const [bankAccount, setBankAccount] = useState(initial?.bank_account ?? '');
  const [bankCci, setBankCci] = useState(initial?.bank_cci ?? '');

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!editMode && !userId.trim()) e.userId = 'Requerido (uuid del usuario)';
    if (!editMode) {
      if (!basicSalary || parseDecimal(basicSalary) <= 0) e.basicSalary = 'Debe ser mayor a 0';
    }
    if (pensionSystem === 'AFP') {
      if (!afpCode) e.afpCode = 'Requerido cuando el sistema es AFP';
      if (!afpRegime) e.afpRegime = 'Requerido cuando el sistema es AFP';
    }
    if (childrenCount && Number.isNaN(Number(childrenCount))) e.childrenCount = 'Numero invalido';
    return e;
  }, [editMode, userId, basicSalary, pensionSystem, afpCode, afpRegime, childrenCount]);

  const canSubmit = Object.keys(errors).length === 0 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const data: CreateEmploymentDto = {
      userId: userId.trim(),
      employeeCode: employeeCode?.trim() || undefined,
      hireDate: hireDate?.trim() || undefined,
      positionName: positionName?.trim() || undefined,
      costCenter: costCenter?.trim() || undefined,
      area: area?.trim() || undefined,
      siteId: siteId?.trim() || undefined,
      contractType: contractType?.trim() || undefined,
      basicSalary: parseDecimal(basicSalary),
      movilidadAmount: parseDecimal(movilidad),
      hasFamilyAllowance,
      childrenCount: Number(childrenCount) || 0,
      pensionSystem,
      afpCode: pensionSystem === 'AFP' ? afpCode : undefined,
      afpRegime: pensionSystem === 'AFP' ? afpRegime : undefined,
      cuspp: pensionSystem === 'AFP' ? cuspp?.trim() || undefined : undefined,
      hasEps,
      bankName: bankName?.trim() || undefined,
      bankAccount: bankAccount?.trim() || undefined,
      bankCci: bankCci?.trim() || undefined,
    };
    onSubmit(data);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Title style={styles.title}>{editMode ? 'Editar trabajador' : 'Nuevo trabajador'}</Title>

      <SectionHeader title="Identificacion" />
      {!editMode && (
        <Input
          label="User ID *"
          placeholder="uuid del usuario"
          value={userId}
          onChangeText={setUserId}
          error={errors.userId}
          autoCapitalize="none"
        />
      )}
      <Input
        label="Codigo interno"
        placeholder="0001"
        value={employeeCode ?? ''}
        onChangeText={setEmployeeCode}
      />
      <Input
        label="Fecha de ingreso"
        placeholder="YYYY-MM-DD"
        value={hireDate ?? ''}
        onChangeText={setHireDate}
        autoCapitalize="none"
      />

      <SectionHeader title="Puesto" />
      <Input
        label="Puesto"
        value={positionName ?? ''}
        onChangeText={setPositionName}
        placeholder="Vendedor"
      />
      <Input label="Area" value={area ?? ''} onChangeText={setArea} />
      <Input label="Centro de costo" value={costCenter ?? ''} onChangeText={setCostCenter} />
      <Input label="Site ID" value={siteId ?? ''} onChangeText={setSiteId} autoCapitalize="none" />
      <Input
        label="Tipo de contrato"
        value={contractType ?? ''}
        onChangeText={setContractType}
        placeholder="INDEFINIDO"
      />

      {!editMode && (
        <>
          <SectionHeader title="Remuneracion" />
          <Input
            label="Sueldo basico (S/) *"
            value={basicSalary}
            onChangeText={setBasicSalary}
            keyboardType="decimal-pad"
            error={errors.basicSalary}
          />
          <Input
            label="Movilidad (S/)"
            value={movilidad}
            onChangeText={setMovilidad}
            keyboardType="decimal-pad"
          />
          <Caption>Para modificarlo despues, crear un cambio de beneficio.</Caption>
        </>
      )}

      <SectionHeader title="Familia" />
      <ChipGroup
        options={[
          { label: 'Con asignacion', value: 'yes' },
          { label: 'Sin asignacion', value: 'no' },
        ]}
        selected={[hasFamilyAllowance ? 'yes' : 'no']}
        onChange={(sel) => setHasFamilyAllowance(sel[0] === 'yes')}
        variant="filled"
        size="small"
      />
      <Input
        label="Numero de hijos"
        value={childrenCount}
        onChangeText={setChildrenCount}
        keyboardType="number-pad"
        error={errors.childrenCount}
      />

      <SectionHeader title="Sistema pensionario" />
      <ChipGroup
        options={PENSION_OPTIONS}
        selected={[pensionSystem]}
        onChange={(sel) => setPensionSystem((sel[0] as PensionSystem) ?? 'ONP')}
        variant="filled"
        size="small"
      />
      {pensionSystem === 'AFP' && (
        <View style={styles.afpBox}>
          <Caption>AFP *</Caption>
          <ChipGroup
            options={AFP_OPTIONS}
            selected={afpCode ? [afpCode] : []}
            onChange={(sel) => setAfpCode(sel[0] as AfpCode)}
            variant="filled"
            size="small"
          />
          {errors.afpCode && <Body style={styles.error}>{errors.afpCode}</Body>}

          <Caption style={styles.mt}>Regimen *</Caption>
          <ChipGroup
            options={REGIME_OPTIONS}
            selected={afpRegime ? [afpRegime] : []}
            onChange={(sel) => setAfpRegime(sel[0] as AfpRegime)}
            variant="filled"
            size="small"
          />
          {errors.afpRegime && <Body style={styles.error}>{errors.afpRegime}</Body>}

          <Input
            label="CUSPP"
            value={cuspp ?? ''}
            onChangeText={setCuspp}
            placeholder="123456789012"
            autoCapitalize="characters"
          />
        </View>
      )}
      <ChipGroup
        options={[
          { label: 'Con EPS', value: 'yes' },
          { label: 'Sin EPS', value: 'no' },
        ]}
        selected={[hasEps ? 'yes' : 'no']}
        onChange={(sel) => setHasEps(sel[0] === 'yes')}
        variant="filled"
        size="small"
      />

      <SectionHeader title="Cuenta bancaria" />
      <Input label="Banco" value={bankName ?? ''} onChangeText={setBankName} />
      <Input
        label="Cuenta"
        value={bankAccount ?? ''}
        onChangeText={setBankAccount}
        autoCapitalize="none"
      />
      <Input label="CCI" value={bankCci ?? ''} onChangeText={setBankCci} autoCapitalize="none" />

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={onCancel} disabled={submitting} />
        <Button
          title={editMode ? 'Guardar cambios' : 'Crear trabajador'}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </View>
    </ScrollView>
  );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Title style={styles.section}>{title}</Title>
);

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm },
  title: { marginBottom: spacing.sm },
  section: { marginTop: spacing.md, marginBottom: spacing.xs, fontSize: 16 },
  afpBox: { gap: spacing.xs, marginTop: spacing.xs },
  mt: { marginTop: spacing.xs },
  error: { color: '#c0392b', fontSize: 12 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
