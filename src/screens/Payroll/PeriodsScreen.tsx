import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
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

import { useCreatePayrollPeriod, usePayrollPeriods } from '@/hooks/api/usePayrollPeriods';
import { PeriodStatusChip } from '@/components/Payroll/PeriodStatusChip';
import type { CreatePeriodDto, PayType, PayrollPeriod, PeriodStatus } from '@/types/payroll';
import { MAIN_ROUTES } from '@/constants/routes';
import type { RootStackParamList } from '@/types/navigation';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollPeriods'>;

type StatusFilter = 'ALL' | PeriodStatus;

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Borrador', value: 'BORRADOR' },
  { label: 'Calculado', value: 'CALCULADO' },
  { label: 'Cerrado', value: 'CERRADO' },
  { label: 'Pagado', value: 'PAGADO' },
];

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

export const PayrollPeriodsScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState<string>('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [formOpen, setFormOpen] = useState(false);

  const params = useMemo(() => {
    const y = Number(year);
    const m = Number(month);
    return {
      year: Number.isFinite(y) && y > 0 ? y : undefined,
      month: Number.isFinite(m) && m >= 1 && m <= 12 ? m : undefined,
      status: status === 'ALL' ? undefined : status,
    };
  }, [year, month, status]);

  const { data, isLoading, isRefetching, isError, error, refetch } = usePayrollPeriods(params);
  const create = useCreatePayrollPeriod();
  const items = (data ?? []) as PayrollPeriod[];

  const handleCreate = async (dto: CreatePeriodDto) => {
    try {
      const created = await create.mutateAsync(dto);
      setFormOpen(false);
      Alert.alert('Periodo creado', 'Podes empezar agregando la asistencia.');
      if (created?.id) {
        navigation.navigate(MAIN_ROUTES.PAYROLL_PERIOD_DETAIL, { periodId: created.id });
      }
    } catch (err: any) {
      logger.error('createPayrollPeriod', err);
      Alert.alert('Error', err?.message ?? 'No se pudo crear el periodo.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenLayout navigation={navigation as any}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Title>Periodos de planilla</Title>
            <Button
              title="Nuevo"
              leftIcon="add-outline"
              size="small"
              onPress={() => setFormOpen(true)}
            />
          </View>

          <View style={styles.filtersRow}>
            <Input
              label="Anio"
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              size="small"
            />
            <Input
              label="Mes (1-12)"
              value={month}
              onChangeText={setMonth}
              keyboardType="number-pad"
              size="small"
            />
          </View>

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
              icon="calendar-outline"
              title="Sin periodos"
              description="Crea el primer periodo para empezar."
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
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate(MAIN_ROUTES.PAYROLL_PERIOD_DETAIL, { periodId: item.id })
                  }
                  activeOpacity={0.7}
                >
                  <Card style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Body style={styles.name}>
                        {MONTH_LABELS[item.month - 1] ?? item.month} · {item.year}
                        {item.fortnight ? ` · Q${item.fortnight}` : ''}
                      </Body>
                      <PeriodStatusChip status={item.status} />
                    </View>
                    <Caption>
                      {item.pay_type} · {item.period_start} → {item.period_end}
                    </Caption>
                    {item.site_id ? <Caption>Site: {item.site_id}</Caption> : null}
                  </Card>
                </TouchableOpacity>
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
            <PeriodForm
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
  submitting?: boolean;
  onSubmit: (dto: CreatePeriodDto) => void;
  onCancel: () => void;
}

const PAY_TYPES: { label: string; value: PayType }[] = [
  { label: 'Mensual', value: 'MENSUAL' },
  { label: 'Quincenal', value: 'QUINCENAL' },
];

const FORTNIGHTS: { label: string; value: '1' | '2' }[] = [
  { label: '1a quincena', value: '1' },
  { label: '2a quincena', value: '2' },
];

const PeriodForm: React.FC<FormProps> = ({ submitting, onSubmit, onCancel }) => {
  const styles = useThemedStyles(createStyles);
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [payType, setPayType] = useState<PayType>('QUINCENAL');
  const [fortnight, setFortnight] = useState<'1' | '2'>('1');
  const [siteId, setSiteId] = useState('');

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const y = Number(year);
    const m = Number(month);
    if (!Number.isFinite(y) || y < 2000) e.year = 'Anio invalido';
    if (!Number.isFinite(m) || m < 1 || m > 12) e.month = 'Mes 1-12';
    return e;
  }, [year, month]);

  const canSubmit = Object.keys(errors).length === 0 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      year: Number(year),
      month: Number(month),
      payType,
      fortnight: payType === 'QUINCENAL' ? (Number(fortnight) as 1 | 2) : undefined,
      siteId: siteId.trim() || undefined,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
      <Title>Nuevo periodo</Title>

      <Input
        label="Anio *"
        value={year}
        onChangeText={setYear}
        keyboardType="number-pad"
        error={errors.year}
      />
      <Input
        label="Mes (1-12) *"
        value={month}
        onChangeText={setMonth}
        keyboardType="number-pad"
        error={errors.month}
      />

      <Caption style={styles.label}>Tipo de pago</Caption>
      <ChipGroup
        options={PAY_TYPES}
        selected={[payType]}
        onChange={(sel) => setPayType((sel[0] as PayType) ?? 'QUINCENAL')}
        variant="filled"
        size="small"
      />

      {payType === 'QUINCENAL' && (
        <>
          <Caption style={styles.label}>Quincena</Caption>
          <ChipGroup
            options={FORTNIGHTS}
            selected={[fortnight]}
            onChange={(sel) => setFortnight((sel[0] as '1' | '2') ?? '1')}
            variant="filled"
            size="small"
          />
        </>
      )}

      <Input label="Site ID" value={siteId} onChangeText={setSiteId} autoCapitalize="none" />

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={onCancel} disabled={submitting} />
        <Button
          title="Crear periodo"
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
    filtersRow: { flexDirection: 'row', gap: spacing[2] },
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
    label: { fontWeight: '600', marginTop: spacing[2] },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
      marginTop: spacing[4],
    },
  });

export default PayrollPeriodsScreen;
