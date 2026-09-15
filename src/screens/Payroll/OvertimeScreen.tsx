import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Input,
  Title,
} from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';

import { useCreatePayrollOvertime, usePayrollOvertime } from '@/hooks/api/usePayrollOvertime';
import { ApprovalStatusChip } from '@/components/Payroll/ApprovalStatusChip';
import { EmployeePicker } from '@/components/Payroll/EmployeePicker';
import type {
  ApprovalStatus,
  CreateOvertimeDto,
  EmploymentRecord,
  OvertimeRateCode,
  OvertimeRequest,
} from '@/types/payroll';
import { OVERTIME_FACTORS, fortnightOf } from '@/types/payroll';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import type { RootStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollOvertime'>;

type StatusFilter = 'ALL' | ApprovalStatus;

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Pendientes', value: 'PENDIENTE' },
  { label: 'Aprobados', value: 'APROBADO' },
  { label: 'Rechazados', value: 'RECHAZADO' },
];

const RATE_CODES: { label: string; value: OvertimeRateCode }[] = [
  { label: '25%', value: 'HHEE_25' },
  { label: '35%', value: 'HHEE_35' },
  { label: '100%', value: 'HHEE_100' },
  { label: '200%', value: 'HHEE_200' },
  { label: '300%', value: 'HHEE_300' },
];

export const PayrollOvertimeScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [status, setStatus] = useState<StatusFilter>('PENDIENTE');
  const [selectedUser, setSelectedUser] = useState<Pick<
    EmploymentRecord,
    'user_id' | 'full_name' | 'employee_code'
  > | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const params = useMemo(
    () => ({
      status: status === 'ALL' ? undefined : status,
      userId: selectedUser?.user_id,
    }),
    [status, selectedUser?.user_id]
  );

  const { data, isLoading, isRefetching, isError, error, refetch } = usePayrollOvertime(params);
  const create = useCreatePayrollOvertime();
  const items = (data ?? []) as OvertimeRequest[];

  const handleCreate = async (dto: CreateOvertimeDto) => {
    try {
      await create.mutateAsync(dto);
      setFormOpen(false);
      Alert.alert('HH.EE. registrada', 'Queda pendiente de aprobacion.');
    } catch (err: any) {
      logger.error('createPayrollOvertime', err);
      Alert.alert('Error', err?.message ?? 'No se pudo registrar la HH.EE.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenLayout navigation={navigation as any}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Title>Horas extra</Title>
            <Button
              title="Nueva"
              leftIcon="add-outline"
              size="small"
              onPress={() => setFormOpen(true)}
            />
          </View>

          <EmployeePicker
            label="Filtrar por trabajador"
            selected={selectedUser}
            onChange={setSelectedUser}
          />

          <ChipGroup
            options={STATUS_FILTERS}
            selected={[status]}
            onChange={(sel) => setStatus((sel[0] as StatusFilter) ?? 'ALL')}
            variant="filled"
            size="small"
          />

          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.color.brand.accent} />
            </View>
          ) : isError ? (
            <ErrorState
              title="No se pudo cargar"
              description={(error as any)?.message}
              onRetry={() => refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon="time-outline"
              title="Sin HH.EE."
              description="Registra las horas extra del periodo."
            />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
              }
              renderItem={({ item }) => (
                <Card style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Body style={styles.name}>
                      {rateLabel(item.rate_code)} · {item.hours} h
                    </Body>
                    <ApprovalStatusChip status={item.status} />
                  </View>
                  <View style={styles.metaRow}>
                    <Caption>{item.work_date}</Caption>
                    <Badge variant="info" size="small" label={`Quincena ${item.fortnight}`} />
                    <Caption>x{OVERTIME_FACTORS[item.rate_code]}</Caption>
                  </View>
                  <Caption>User: {item.user_id}</Caption>
                  {item.notes ? <Caption>Notas: {item.notes}</Caption> : null}
                </Card>
              )}
            />
          )}
        </View>

        <Modal
          visible={formOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setFormOpen(false)}
        >
          <SafeAreaView style={styles.safe}>
            <OvertimeForm
              initialUser={selectedUser}
              submitting={create.isPending}
              onSubmit={handleCreate}
              onCancel={() => setFormOpen(false)}
            />
          </SafeAreaView>
        </Modal>
      </ScreenLayout>
    </SafeAreaView>
  );
};

// ---------- Form ----------------------------------------------------------

interface FormProps {
  initialUser?: Pick<EmploymentRecord, 'user_id' | 'full_name' | 'employee_code'> | null;
  submitting?: boolean;
  onSubmit: (dto: CreateOvertimeDto) => void;
  onCancel: () => void;
}

const OvertimeForm: React.FC<FormProps> = ({ initialUser, submitting, onSubmit, onCancel }) => {
  const styles = useThemedStyles(createStyles);
  const [user, setUser] = useState<FormProps['initialUser']>(initialUser ?? null);
  const [rateCode, setRateCode] = useState<OvertimeRateCode>('HHEE_25');
  const [workDate, setWorkDate] = useState('');
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!user?.user_id) e.user = 'Selecciona un trabajador';
    if (!workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) e.workDate = 'Formato YYYY-MM-DD';
    const h = Number(hours);
    if (!hours || !Number.isFinite(h) || h <= 0) e.hours = 'Debe ser mayor a 0';
    return e;
  }, [user, workDate, hours]);

  const canSubmit = Object.keys(errors).length === 0 && !submitting;
  const previewFortnight =
    workDate && /^\d{4}-\d{2}-\d{2}$/.test(workDate) ? fortnightOf(workDate) : null;

  const handleSubmit = () => {
    if (!canSubmit || !user) return;
    onSubmit({
      userId: user.user_id,
      workDate,
      rateCode,
      hours: Number(hours),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
      <Title style={styles.formTitle}>Nueva HH.EE.</Title>

      <EmployeePicker
        label="Trabajador"
        required
        selected={user}
        onChange={setUser}
        error={errors.user}
      />

      <Caption style={styles.label}>Tarifa</Caption>
      <ChipGroup
        options={RATE_CODES}
        selected={[rateCode]}
        onChange={(sel) => setRateCode((sel[0] as OvertimeRateCode) ?? 'HHEE_25')}
        variant="filled"
        size="small"
      />
      <Caption>Factor aplicado: x{OVERTIME_FACTORS[rateCode]}</Caption>

      <Input
        label="Fecha (YYYY-MM-DD)"
        value={workDate}
        onChangeText={setWorkDate}
        autoCapitalize="none"
        error={errors.workDate}
      />
      {previewFortnight ? <Caption>Quincena estimada: {previewFortnight}</Caption> : null}

      <Input
        label="Horas"
        value={hours}
        onChangeText={setHours}
        keyboardType="decimal-pad"
        error={errors.hours}
      />
      <Input label="Notas" value={notes} onChangeText={setNotes} multiline />

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={onCancel} disabled={submitting} />
        <Button
          title="Registrar HH.EE."
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </View>
    </ScrollView>
  );
};

function rateLabel(code: OvertimeRateCode): string {
  const opt = RATE_CODES.find((r) => r.value === code);
  return opt?.label ?? code;
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.color.background.canvas },
    container: { flex: 1, padding: spacing[4], gap: spacing[2] },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { paddingVertical: spacing[2], gap: spacing[2] },
    card: { padding: spacing[3], marginBottom: spacing[2], gap: spacing[1] },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    metaRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap', alignItems: 'center' },
    name: { fontWeight: '600' },
    formContainer: { padding: spacing[4], gap: spacing[2] },
    formTitle: { marginBottom: spacing[2] },
    label: { fontWeight: '600', marginTop: spacing[2] },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
      marginTop: spacing[4],
    },
  });

export default PayrollOvertimeScreen;
