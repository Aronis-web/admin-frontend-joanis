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

import { useCreatePayrollAbsence, usePayrollAbsences } from '@/hooks/api/usePayrollAbsences';
import { ApprovalStatusChip } from '@/components/Payroll/ApprovalStatusChip';
import { EmployeePicker } from '@/components/Payroll/EmployeePicker';
import { PayrollDateRangeField } from '@/components/Payroll/PayrollDateField';
import {
  AbsenceUploadField,
  type AbsenceUploadValue,
} from '@/components/Payroll/AbsenceUploadField';
import type {
  AbsenceRequest,
  AbsenceType,
  ApprovalStatus,
  CreateAbsenceDto,
  EmploymentRecord,
} from '@/types/payroll';
import { isAbsenceDeductible } from '@/types/payroll';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import type { RootStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollAbsences'>;

type StatusFilter = 'ALL' | ApprovalStatus;

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Pendientes', value: 'PENDIENTE' },
  { label: 'Aprobados', value: 'APROBADO' },
  { label: 'Rechazados', value: 'RECHAZADO' },
];

const ABSENCE_TYPES: { label: string; value: AbsenceType }[] = [
  { label: 'Injustificada', value: 'INJUSTIFICADA' },
  { label: 'Justificada', value: 'JUSTIFICADA' },
  { label: 'Desc. medico', value: 'DESCANSO_MEDICO' },
  { label: 'Lic. c/goce', value: 'LICENCIA_CON_GOCE' },
  { label: 'Lic. s/goce', value: 'LICENCIA_SIN_GOCE' },
  { label: 'Subsidio', value: 'SUBSIDIO' },
];

export const PayrollAbsencesScreen: React.FC<Props> = ({ navigation }) => {
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

  const { data, isLoading, isRefetching, isError, error, refetch } = usePayrollAbsences(params);
  const create = useCreatePayrollAbsence();
  const items = (data ?? []) as AbsenceRequest[];

  const handleCreate = async (dto: CreateAbsenceDto, file?: AbsenceUploadValue | null) => {
    try {
      await create.mutateAsync({ data: dto, file: file ?? undefined });
      setFormOpen(false);
      Alert.alert('Falta registrada', 'Queda pendiente de aprobacion.');
    } catch (err: any) {
      logger.error('createPayrollAbsence', err);
      Alert.alert('Error', err?.message ?? 'No se pudo registrar la falta.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenLayout navigation={navigation as any}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Title>Faltas / Descanso medico</Title>
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
              icon="medkit-outline"
              title="Sin faltas"
              description="Registra la primera falta o descanso medico."
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
                    <Body style={styles.name}>{item.absence_type}</Body>
                    <ApprovalStatusChip status={item.status} />
                  </View>
                  <Caption>
                    {item.start_date} → {item.end_date} · {item.days} d
                  </Caption>
                  <View style={styles.metaRow}>
                    <Badge
                      variant={isAbsenceDeductible(item.absence_type) ? 'warning' : 'info'}
                      size="small"
                      label={isAbsenceDeductible(item.absence_type) ? 'Descontable' : 'Remunerado'}
                    />
                    {item.evidence_ref ? (
                      <Badge variant="success" size="small" label="Con evidencia" />
                    ) : null}
                  </View>
                  {item.reason ? <Caption>Motivo: {item.reason}</Caption> : null}
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
            <AbsenceForm
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
  onSubmit: (dto: CreateAbsenceDto, file?: AbsenceUploadValue | null) => void;
  onCancel: () => void;
}

const AbsenceForm: React.FC<FormProps> = ({ initialUser, submitting, onSubmit, onCancel }) => {
  const styles = useThemedStyles(createStyles);
  const [user, setUser] = useState<FormProps['initialUser']>(initialUser ?? null);
  const [absenceType, setAbsenceType] = useState<AbsenceType>('DESCANSO_MEDICO');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<AbsenceUploadValue | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!user?.user_id) e.user = 'Selecciona un trabajador';
    if (!startDate) e.startDate = 'Requerido';
    if (!endDate) e.endDate = 'Requerido';
    const d = Number(days);
    if (!days || !Number.isFinite(d) || d <= 0) e.days = 'Debe ser mayor a 0';
    return e;
  }, [user, startDate, endDate, days]);

  const canSubmit = Object.keys(errors).length === 0 && !submitting;
  const deductible = isAbsenceDeductible(absenceType);

  const handleSubmit = () => {
    if (!canSubmit || !user) return;
    onSubmit(
      {
        userId: user.user_id,
        absenceType,
        startDate,
        endDate,
        days: Number(days),
        reason: reason.trim() || undefined,
      },
      file
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
      <Title style={styles.formTitle}>Nueva falta</Title>

      <EmployeePicker
        label="Trabajador"
        required
        selected={user}
        onChange={setUser}
        error={errors.user}
      />

      <Caption style={styles.label}>Tipo</Caption>
      <ChipGroup
        options={ABSENCE_TYPES}
        selected={[absenceType]}
        onChange={(sel) => setAbsenceType((sel[0] as AbsenceType) ?? 'DESCANSO_MEDICO')}
        variant="filled"
        size="small"
      />
      <Caption>
        {deductible
          ? 'Este tipo descuenta de la remuneracion (afecta d_faltos).'
          : 'Este tipo se considera remunerado.'}
      </Caption>

      <PayrollDateRangeField
        label="Rango de faltas"
        startValue={startDate}
        endValue={endDate}
        onChange={(s, e) => {
          setStartDate(s);
          setEndDate(e);
        }}
        startError={errors.startDate}
        endError={errors.endDate}
        title="Seleccionar rango de faltas"
      />
      <Input
        label="Dias"
        value={days}
        onChangeText={setDays}
        keyboardType="decimal-pad"
        error={errors.days}
      />
      <Input label="Motivo" value={reason} onChangeText={setReason} multiline />

      <AbsenceUploadField
        value={file}
        fileName={fileName}
        onChange={(f, meta) => {
          setFile(f);
          setFileName(meta?.name ?? null);
        }}
        helperText={
          absenceType === 'DESCANSO_MEDICO' || absenceType === 'SUBSIDIO'
            ? 'Adjunta el CITT o evidencia del descanso.'
            : 'Opcional para este tipo.'
        }
      />

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={onCancel} disabled={submitting} />
        <Button
          title="Registrar falta"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </View>
    </ScrollView>
  );
};

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
    metaRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
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

export default PayrollAbsencesScreen;
