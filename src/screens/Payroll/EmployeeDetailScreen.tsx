import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Title,
} from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';

import type { RootStackParamList } from '@/types/navigation';
import {
  useCreatePayrollBenefitChange,
  usePayrollBenefitChanges,
  usePayrollEmployee,
  usePayrollEmployeeHistory,
  usePayrollSalaryHistory,
  usePayrollSchedule,
  useUpdatePayrollEmployee,
  useUpdatePayrollSchedule,
} from '@/hooks/api/usePayrollEmployment';
import type {
  BenefitChange,
  BenefitChangeValue,
  EmploymentHistoryEntry,
  SalaryHistoryEntry,
  UpdateScheduleDto,
} from '@/types/payroll';
import { formatPen } from '@/utils/payrollFormat';
import { PayrollTabs } from '@/components/Payroll/PayrollTabs';
import { PayrollEmployeeForm } from '@/components/Payroll/PayrollEmployeeForm';
import { BenefitChangeForm } from '@/components/Payroll/BenefitChangeForm';
import { ApprovalStatusChip } from '@/components/Payroll/ApprovalStatusChip';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollEmployeeDetail'>;

type TabKey = 'info' | 'history' | 'salary' | 'schedule' | 'benefits';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'info', label: 'Info' },
  { key: 'history', label: 'Historial' },
  { key: 'salary', label: 'Sueldos' },
  { key: 'schedule', label: 'Jornada' },
  { key: 'benefits', label: 'Beneficios' },
];

export const PayrollEmployeeDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { userId } = route.params;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [tab, setTab] = useState<TabKey>('info');
  const [editOpen, setEditOpen] = useState(false);
  const [benefitOpen, setBenefitOpen] = useState(false);

  const employeeQ = usePayrollEmployee(userId);
  const historyQ = usePayrollEmployeeHistory(userId, tab === 'history');
  const salaryQ = usePayrollSalaryHistory(userId, tab === 'salary');
  const scheduleQ = usePayrollSchedule(userId, tab === 'schedule');
  const benefitsQ = usePayrollBenefitChanges(userId, tab === 'benefits');

  const update = useUpdatePayrollEmployee();
  const updateSchedule = useUpdatePayrollSchedule();
  const createBenefit = useCreatePayrollBenefitChange();

  const employee = employeeQ.data;

  const handleEdit = async (data: Parameters<typeof update.mutateAsync>[0]['data']) => {
    try {
      await update.mutateAsync({ userId, data });
      setEditOpen(false);
      Alert.alert('Guardado', 'Datos actualizados.');
    } catch (err: any) {
      logger.error('updatePayrollEmployee', err);
      Alert.alert('Error', err?.message ?? 'No se pudo guardar.');
    }
  };

  const handleCreateBenefit = async (
    dto: Parameters<typeof createBenefit.mutateAsync>[0]['data']
  ) => {
    try {
      await createBenefit.mutateAsync({ userId, data: dto });
      setBenefitOpen(false);
      Alert.alert('Solicitud creada', 'El cambio queda pendiente de aprobacion.');
    } catch (err: any) {
      logger.error('createPayrollBenefitChange', err);
      Alert.alert('Error', err?.message ?? 'No se pudo crear el cambio.');
    }
  };

  if (employeeQ.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenLayout navigation={navigation as any}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.color.brand.accent} />
          </View>
        </ScreenLayout>
      </SafeAreaView>
    );
  }

  if (employeeQ.isError || !employee) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenLayout navigation={navigation as any}>
          <ErrorState
            title="No se pudo cargar el trabajador"
            description={(employeeQ.error as any)?.message ?? 'Verifica el ID.'}
            onRetry={() => employeeQ.refetch()}
          />
        </ScreenLayout>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenLayout navigation={navigation as any}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Title>{employee.full_name ?? employee.user_id}</Title>
              <Caption>
                {(employee.employee_code ?? '—') +
                  (employee.position_name ? ` · ${employee.position_name}` : '')}
              </Caption>
            </View>
            <Badge
              variant={employee.is_active ? 'success' : 'default'}
              size="small"
              label={employee.is_active ? 'Activo' : 'Inactivo'}
            />
          </View>

          <PayrollTabs tabs={TABS} active={tab} onChange={setTab} />

          {tab === 'info' && (
            <InfoTab
              employee={employee}
              onEdit={() => setEditOpen(true)}
              onNewBenefit={() => {
                setTab('benefits');
                setBenefitOpen(true);
              }}
            />
          )}

          {tab === 'history' && (
            <HistoryTab
              loading={historyQ.isLoading}
              error={historyQ.isError}
              entries={(historyQ.data ?? []) as EmploymentHistoryEntry[]}
              onRetry={() => historyQ.refetch()}
            />
          )}

          {tab === 'salary' && (
            <SalaryTab
              loading={salaryQ.isLoading}
              error={salaryQ.isError}
              entries={(salaryQ.data ?? []) as SalaryHistoryEntry[]}
              onRetry={() => salaryQ.refetch()}
            />
          )}

          {tab === 'schedule' && (
            <ScheduleTab
              loading={scheduleQ.isLoading}
              schedule={scheduleQ.data ?? null}
              onSave={async (dto) => {
                try {
                  await updateSchedule.mutateAsync({ userId, data: dto });
                  Alert.alert('Guardado', 'Jornada actualizada.');
                } catch (err: any) {
                  logger.error('updatePayrollSchedule', err);
                  Alert.alert('Error', err?.message ?? 'No se pudo guardar.');
                }
              }}
              saving={updateSchedule.isPending}
            />
          )}

          {tab === 'benefits' && (
            <BenefitsTab
              loading={benefitsQ.isLoading}
              error={benefitsQ.isError}
              entries={(benefitsQ.data ?? []) as BenefitChange[]}
              onNew={() => setBenefitOpen(true)}
              onRetry={() => benefitsQ.refetch()}
            />
          )}
        </ScrollView>

        <Modal
          visible={editOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setEditOpen(false)}
        >
          <SafeAreaView style={styles.safe}>
            <PayrollEmployeeForm
              initial={employee}
              editMode
              submitting={update.isPending}
              onSubmit={(data) =>
                handleEdit({
                  employeeCode: data.employeeCode,
                  hireDate: data.hireDate,
                  positionName: data.positionName,
                  costCenter: data.costCenter,
                  area: data.area,
                  siteId: data.siteId,
                  contractType: data.contractType,
                  hasFamilyAllowance: data.hasFamilyAllowance,
                  childrenCount: data.childrenCount,
                  pensionSystem: data.pensionSystem,
                  afpCode: data.afpCode,
                  afpRegime: data.afpRegime,
                  cuspp: data.cuspp,
                  hasEps: data.hasEps,
                  bankName: data.bankName,
                  bankAccount: data.bankAccount,
                  bankCci: data.bankCci,
                })
              }
              onCancel={() => setEditOpen(false)}
            />
          </SafeAreaView>
        </Modal>

        <Modal
          visible={benefitOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setBenefitOpen(false)}
        >
          <SafeAreaView style={styles.safe}>
            <BenefitChangeForm
              submitting={createBenefit.isPending}
              onSubmit={handleCreateBenefit}
              onCancel={() => setBenefitOpen(false)}
            />
          </SafeAreaView>
        </Modal>
      </ScreenLayout>
    </SafeAreaView>
  );
};

// ---------- Tabs -----------------------------------------------------------

const InfoTab: React.FC<{
  employee: NonNullable<ReturnType<typeof usePayrollEmployee>['data']>;
  onEdit: () => void;
  onNewBenefit: () => void;
}> = ({ employee, onEdit, onNewBenefit }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.tabWrap}>
      <Card style={styles.card}>
        <FieldRow label="User ID" value={employee.user_id} />
        <FieldRow label="Codigo" value={employee.employee_code ?? '—'} />
        <FieldRow label="Ingreso" value={employee.hire_date ?? '—'} />
        <FieldRow label="Puesto" value={employee.position_name ?? '—'} />
        <FieldRow label="Area" value={employee.area ?? '—'} />
        <FieldRow label="Centro de costo" value={employee.cost_center ?? '—'} />
        <FieldRow label="Site" value={employee.site_id ?? '—'} />
        <FieldRow label="Contrato" value={employee.contract_type ?? '—'} />
      </Card>

      <Card style={styles.card}>
        <Title style={styles.cardTitle}>Remuneracion</Title>
        <FieldRow label="Sueldo basico" value={formatPen(employee.basic_salary)} />
        <FieldRow label="Movilidad" value={formatPen(employee.movilidad_amount)} />
        <FieldRow label="Asig. familiar" value={employee.has_family_allowance ? 'Si' : 'No'} />
        <FieldRow label="Hijos" value={String(employee.children_count ?? 0)} />
        <Button
          title="Crear cambio de beneficio"
          variant="outline"
          size="small"
          onPress={onNewBenefit}
        />
      </Card>

      <Card style={styles.card}>
        <Title style={styles.cardTitle}>Sistema pensionario</Title>
        <FieldRow label="Sistema" value={employee.pension_system} />
        {employee.pension_system === 'AFP' && (
          <>
            <FieldRow label="AFP" value={employee.afp_code ?? '—'} />
            <FieldRow label="Regimen" value={employee.afp_regime ?? '—'} />
            <FieldRow label="CUSPP" value={employee.cuspp ?? '—'} />
          </>
        )}
        <FieldRow label="EPS" value={employee.has_eps ? 'Si' : 'No'} />
      </Card>

      <Card style={styles.card}>
        <Title style={styles.cardTitle}>Cuenta bancaria</Title>
        <FieldRow label="Banco" value={employee.bank_name ?? '—'} />
        <FieldRow label="Cuenta" value={employee.bank_account ?? '—'} />
        <FieldRow label="CCI" value={employee.bank_cci ?? '—'} />
      </Card>

      <Button title="Editar datos" onPress={onEdit} />
    </View>
  );
};

const HistoryTab: React.FC<{
  loading: boolean;
  error: boolean;
  entries: EmploymentHistoryEntry[];
  onRetry: () => void;
}> = ({ loading, error, entries, onRetry }) => {
  const styles = useThemedStyles(createStyles);
  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (entries.length === 0) {
    return (
      <EmptyState icon="time-outline" title="Sin historial" description="No hay eventos aun." />
    );
  }
  return (
    <View style={styles.tabWrap}>
      {entries.map((e, idx) => (
        <Card key={idx} style={styles.card}>
          <View style={styles.rowBetween}>
            <Body style={{ fontWeight: '600' }}>{e.field_name}</Body>
            <Badge variant="info" size="small" label={e.change_type} />
          </View>
          <Caption>{(e.old_value ?? '—') + ' → ' + (e.new_value ?? '—')}</Caption>
          <Caption>
            {e.changed_by} · {new Date(e.created_at).toLocaleString('es-PE')}
          </Caption>
        </Card>
      ))}
    </View>
  );
};

const SalaryTab: React.FC<{
  loading: boolean;
  error: boolean;
  entries: SalaryHistoryEntry[];
  onRetry: () => void;
}> = ({ loading, error, entries, onRetry }) => {
  const styles = useThemedStyles(createStyles);
  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (entries.length === 0) {
    return (
      <EmptyState
        icon="cash-outline"
        title="Sin variaciones"
        description="No hay historial de sueldos."
      />
    );
  }
  return (
    <View style={styles.tabWrap}>
      {entries.map((e, idx) => (
        <Card key={idx} style={styles.card}>
          <View style={styles.rowBetween}>
            <Body style={{ fontWeight: '600' }}>{formatPen(e.basic_salary)}</Body>
            <Caption>
              {e.effective_from} · {e.effective_to ?? 'vigente'}
            </Caption>
          </View>
          <Caption>Movilidad: {formatPen(e.movilidad_amount)}</Caption>
          {e.reason && <Caption>Motivo: {e.reason}</Caption>}
        </Card>
      ))}
    </View>
  );
};

const ScheduleTab: React.FC<{
  loading: boolean;
  schedule: any;
  onSave: (dto: UpdateScheduleDto) => Promise<void>;
  saving: boolean;
}> = ({ loading, schedule, onSave, saving }) => {
  const styles = useThemedStyles(createStyles);
  const [daysPerWeek, setDaysPerWeek] = useState(String(schedule?.days_per_week ?? 6));
  const [dailyHours, setDailyHours] = useState(String(schedule?.daily_hours ?? '8'));
  const [entryTime, setEntryTime] = useState(schedule?.entry_time ?? '09:00');
  const [exitTime, setExitTime] = useState(schedule?.exit_time ?? '18:00');
  const [effectiveFrom, setEffectiveFrom] = useState(
    schedule?.effective_from ?? new Date().toISOString().slice(0, 10)
  );

  const canSave = useMemo(() => {
    return !!daysPerWeek && !!dailyHours && !!entryTime && !!exitTime && !!effectiveFrom && !saving;
  }, [daysPerWeek, dailyHours, entryTime, exitTime, effectiveFrom, saving]);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  return (
    <View style={styles.tabWrap}>
      <Card style={styles.card}>
        <Title style={styles.cardTitle}>Jornada actual</Title>
        <Input
          label="Dias por semana"
          value={daysPerWeek}
          onChangeText={setDaysPerWeek}
          keyboardType="number-pad"
        />
        <Input
          label="Horas por dia"
          value={dailyHours}
          onChangeText={setDailyHours}
          keyboardType="decimal-pad"
        />
        <Input label="Hora de entrada (HH:mm)" value={entryTime} onChangeText={setEntryTime} />
        <Input label="Hora de salida (HH:mm)" value={exitTime} onChangeText={setExitTime} />
        <Input
          label="Vigente desde (YYYY-MM-DD)"
          value={effectiveFrom}
          onChangeText={setEffectiveFrom}
          autoCapitalize="none"
        />
        <Button
          title="Guardar jornada"
          onPress={() =>
            onSave({
              daysPerWeek: Number(daysPerWeek) || 6,
              dailyHours: Number(dailyHours) || 8,
              entryTime,
              exitTime,
              effectiveFrom,
            })
          }
          disabled={!canSave}
          loading={saving}
        />
      </Card>
    </View>
  );
};

const BenefitsTab: React.FC<{
  loading: boolean;
  error: boolean;
  entries: BenefitChange[];
  onNew: () => void;
  onRetry: () => void;
}> = ({ loading, error, entries, onNew, onRetry }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.tabWrap}>
      <Button title="Nuevo cambio" leftIcon="add-outline" onPress={onNew} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : error ? (
        <ErrorState onRetry={onRetry} />
      ) : entries.length === 0 ? (
        <EmptyState icon="swap-horizontal-outline" title="Sin cambios" />
      ) : (
        entries.map((e) => (
          <Card key={e.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Body style={{ fontWeight: '600' }}>{e.change_type}</Body>
              <ApprovalStatusChip status={e.status} />
            </View>
            <Caption>Efectiva: {e.effective_date}</Caption>
            <Caption>{describeBenefitValue(e.new_value)}</Caption>
            {e.notes && <Caption>Notas: {e.notes}</Caption>}
          </Card>
        ))
      )}
    </View>
  );
};

// ---------- Helpers --------------------------------------------------------

function describeBenefitValue(v: BenefitChangeValue): string {
  if ('basic_salary' in v) return `Sueldo: ${formatPen(v.basic_salary as number)}`;
  if ('movilidad_amount' in v) return `Movilidad: ${formatPen(v.movilidad_amount as number)}`;
  if ('children_count' in v) return `Hijos: ${v.children_count}`;
  if ('has_family_allowance' in v) return `Asig. familiar: ${v.has_family_allowance ? 'Si' : 'No'}`;
  if ('afp_code' in v) return `AFP: ${v.afp_code} · ${v.afp_regime}`;
  if ('pension_system' in v) return `Sistema: ${v.pension_system}`;
  return JSON.stringify(v);
}

const FieldRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.fieldRow}>
      <Caption>{label}</Caption>
      <Body>{value}</Body>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.color.background.canvas },
    container: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    tabWrap: { gap: spacing.sm },
    card: { padding: spacing.md, gap: spacing.xs, marginBottom: spacing.sm },
    cardTitle: { fontSize: 16 },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    fieldRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
  });

export default PayrollEmployeeDetailScreen;
