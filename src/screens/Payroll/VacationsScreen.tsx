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

import { useCreatePayrollVacation, usePayrollVacations } from '@/hooks/api/usePayrollVacations';
import type {
  ApprovalStatus,
  CreateVacationDto,
  EmploymentRecord,
  VacationRequest,
  VacationRequestType,
} from '@/types/payroll';
import { ApprovalStatusChip } from '@/components/Payroll/ApprovalStatusChip';
import { EmployeePicker } from '@/components/Payroll/EmployeePicker';
import { VacationBalanceCard } from '@/components/Payroll/VacationBalanceCard';
import { PayrollDateRangeField } from '@/components/Payroll/PayrollDateField';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import type { RootStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollVacations'>;

type StatusFilter = 'ALL' | ApprovalStatus;

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Pendientes', value: 'PENDIENTE' },
  { label: 'Aprobados', value: 'APROBADO' },
  { label: 'Rechazados', value: 'RECHAZADO' },
];

const REQUEST_TYPES: { label: string; value: VacationRequestType }[] = [
  { label: 'Gozo', value: 'GOZO' },
  { label: 'Compra', value: 'COMPRA' },
  { label: 'Adelanto', value: 'ADELANTO' },
];

export const PayrollVacationsScreen: React.FC<Props> = ({ navigation }) => {
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

  const { data, isLoading, isRefetching, isError, error, refetch } = usePayrollVacations(params);
  const create = useCreatePayrollVacation();
  const items = (data ?? []) as VacationRequest[];

  const handleCreate = async (dto: CreateVacationDto) => {
    try {
      await create.mutateAsync(dto);
      setFormOpen(false);
      Alert.alert('Solicitud creada', 'Queda pendiente de aprobacion.');
    } catch (err: any) {
      logger.error('createPayrollVacation', err);
      Alert.alert('Error', err?.message ?? 'No se pudo crear la solicitud.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenLayout navigation={navigation as any}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Title>Vacaciones</Title>
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

          {selectedUser ? <VacationBalanceCard userId={selectedUser.user_id} /> : null}

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
              icon="airplane-outline"
              title="Sin solicitudes"
              description="Registra la primera solicitud de vacaciones."
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
                    <Body style={styles.name}>{item.request_type}</Body>
                    <ApprovalStatusChip status={item.status} />
                  </View>
                  <Caption>
                    {item.start_date} → {item.end_date} · {item.days} d
                  </Caption>
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
            <VacationForm
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
  onSubmit: (dto: CreateVacationDto) => void;
  onCancel: () => void;
}

const VacationForm: React.FC<FormProps> = ({ initialUser, submitting, onSubmit, onCancel }) => {
  const styles = useThemedStyles(createStyles);
  const [user, setUser] = useState<FormProps['initialUser']>(initialUser ?? null);
  const [requestType, setRequestType] = useState<VacationRequestType>('GOZO');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState('');
  const [notes, setNotes] = useState('');

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

  const handleSubmit = () => {
    if (!canSubmit || !user) return;
    onSubmit({
      userId: user.user_id,
      requestType,
      startDate,
      endDate,
      days: Number(days),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
      <Title style={styles.formTitle}>Nueva solicitud</Title>

      <EmployeePicker
        label="Trabajador"
        required
        selected={user}
        onChange={setUser}
        error={errors.user}
      />

      <Caption style={styles.label}>Tipo de solicitud</Caption>
      <ChipGroup
        options={REQUEST_TYPES}
        selected={[requestType]}
        onChange={(sel) => setRequestType((sel[0] as VacationRequestType) ?? 'GOZO')}
        variant="filled"
        size="small"
      />

      <PayrollDateRangeField
        label="Rango de vacaciones"
        startValue={startDate}
        endValue={endDate}
        onChange={(s, e) => {
          setStartDate(s);
          setEndDate(e);
        }}
        startError={errors.startDate}
        endError={errors.endDate}
        title="Seleccionar rango de vacaciones"
      />
      <Input
        label="Dias"
        value={days}
        onChangeText={setDays}
        keyboardType="decimal-pad"
        error={errors.days}
      />
      <Input label="Notas" value={notes} onChangeText={setNotes} multiline />

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={onCancel} disabled={submitting} />
        <Button
          title="Crear solicitud"
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

export default PayrollVacationsScreen;
