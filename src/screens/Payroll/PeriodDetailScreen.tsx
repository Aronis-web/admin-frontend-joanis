import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
  Title,
} from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';

import {
  useAggregateAttendance,
  useCalculatePayrollPeriod,
  useClosePayrollPeriod,
  useOverridePayrollInput,
  usePayrollPeriod,
  usePayrollPeriodInputs,
  usePayrollPeriodSlips,
} from '@/hooks/api/usePayrollPeriods';
import { PeriodStatusChip } from '@/components/Payroll/PeriodStatusChip';
import { PeriodInputsTable } from '@/components/Payroll/PeriodInputsTable';
import { InputOverrideModal } from '@/components/Payroll/InputOverrideModal';
import { ManualConceptsEditor } from '@/components/Payroll/ManualConceptsEditor';
import type {
  CalculatePeriodDto,
  ManualConcepts,
  OverrideInputDto,
  PeriodInput,
  SlipSummary,
} from '@/types/payroll';
import { isPeriodEditable } from '@/types/payroll';
import { formatPen } from '@/utils/payrollFormat';
import { MAIN_ROUTES } from '@/constants/routes';
import type { RootStackParamList } from '@/types/navigation';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollPeriodDetail'>;

type TabKey = 'inputs' | 'slips';

const TABS: { label: string; value: TabKey }[] = [
  { label: 'Inputs', value: 'inputs' },
  { label: 'Boletas', value: 'slips' },
];

const MONTH_LABELS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const PayrollPeriodDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { periodId } = route.params;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [tab, setTab] = useState<TabKey>('inputs');
  const [overrideTarget, setOverrideTarget] = useState<PeriodInput | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const periodQ = usePayrollPeriod(periodId);
  const inputsQ = usePayrollPeriodInputs(periodId, tab === 'inputs');
  const slipsQ = usePayrollPeriodSlips(periodId, tab === 'slips');

  const aggregate = useAggregateAttendance();
  const override = useOverridePayrollInput();
  const calculate = useCalculatePayrollPeriod();
  const close = useClosePayrollPeriod();

  const period = periodQ.data;
  const editable = isPeriodEditable(period?.status);
  const canCalculate = editable;
  const canClose = period?.status === 'CALCULADO';

  const handleAggregate = async () => {
    try {
      const res = await aggregate.mutateAsync(periodId);
      Alert.alert('Asistencia agregada', `Procesados: ${res.processed}`);
    } catch (err: any) {
      logger.error('aggregateAttendance', err);
      Alert.alert('Error', err?.message ?? 'No se pudo agregar la asistencia.');
    }
  };

  const handleOverride = async (dto: OverrideInputDto) => {
    if (!overrideTarget) return;
    try {
      await override.mutateAsync({ id: periodId, userId: overrideTarget.user_id, data: dto });
      setOverrideTarget(null);
      Alert.alert('Guardado', 'El input fue actualizado.');
    } catch (err: any) {
      logger.error('overridePayrollInput', err);
      Alert.alert('Error', err?.message ?? 'No se pudo guardar el override.');
    }
  };

  const handleCalculate = async (manualConcepts: ManualConcepts) => {
    try {
      const dto: CalculatePeriodDto | undefined =
        Object.keys(manualConcepts).length > 0 ? { manualConcepts } : undefined;
      const res = await calculate.mutateAsync({ id: periodId, data: dto });
      setManualOpen(false);
      Alert.alert(
        'Calculo completo',
        `Boletas: ${res.calculated}\nIngresos: ${formatPen(res.totals.ingresos)}\nDescuentos: ${formatPen(
          res.totals.descuentos
        )}\nNeto: ${formatPen(res.totals.neto)}`
      );
      setTab('slips');
    } catch (err: any) {
      logger.error('calculatePayrollPeriod', err);
      Alert.alert('Error', err?.message ?? 'No se pudo calcular el periodo.');
    }
  };

  const handleClose = () => {
    Alert.alert(
      'Cerrar periodo',
      'Al cerrar, el periodo queda INMUTABLE. Esta accion no se puede deshacer. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar periodo',
          style: 'destructive',
          onPress: async () => {
            try {
              await close.mutateAsync(periodId);
              Alert.alert('Cerrado', 'El periodo quedo cerrado.');
            } catch (err: any) {
              logger.error('closePayrollPeriod', err);
              Alert.alert('Error', err?.message ?? 'No se pudo cerrar el periodo.');
            }
          },
        },
      ]
    );
  };

  if (periodQ.isLoading) {
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

  if (periodQ.isError || !period) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenLayout navigation={navigation as any}>
          <ErrorState
            title="No se pudo cargar el periodo"
            description={(periodQ.error as any)?.message}
            onRetry={() => periodQ.refetch()}
          />
        </ScreenLayout>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenLayout navigation={navigation as any}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.headerCard}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Title>
                  {MONTH_LABELS[period.month - 1] ?? period.month} {period.year}
                  {period.fortnight ? ` · ${period.fortnight}a quincena` : ''}
                </Title>
                <Caption>
                  {period.pay_type} · {period.period_start} → {period.period_end}
                </Caption>
                {period.site_id ? <Caption>Site: {period.site_id}</Caption> : null}
                {period.closed_at ? (
                  <Caption>Cerrado: {new Date(period.closed_at).toLocaleString('es-PE')}</Caption>
                ) : null}
              </View>
              <PeriodStatusChip status={period.status} />
            </View>

            <View style={styles.toolbar}>
              <Button
                title="Agregar asistencia"
                leftIcon="download-outline"
                variant="outline"
                size="small"
                onPress={handleAggregate}
                disabled={!editable}
                loading={aggregate.isPending}
              />
              <Button
                title="Calcular"
                leftIcon="calculator-outline"
                size="small"
                onPress={() => setManualOpen(true)}
                disabled={!canCalculate || calculate.isPending}
              />
              <Button
                title="Cerrar periodo"
                leftIcon="lock-closed-outline"
                variant="danger"
                size="small"
                onPress={handleClose}
                disabled={!canClose}
                loading={close.isPending}
              />
            </View>
          </Card>

          <ChipGroup
            options={TABS}
            selected={[tab]}
            onChange={(sel) => setTab((sel[0] as TabKey) ?? 'inputs')}
            variant="filled"
            size="small"
          />

          {tab === 'inputs' ? (
            <InputsTab
              loading={inputsQ.isLoading}
              error={inputsQ.isError}
              inputs={(inputsQ.data ?? []) as PeriodInput[]}
              editable={editable}
              onRowPress={setOverrideTarget}
              onRetry={() => inputsQ.refetch()}
              refreshing={inputsQ.isRefetching}
            />
          ) : (
            <SlipsTab
              loading={slipsQ.isLoading}
              error={slipsQ.isError}
              slips={(slipsQ.data ?? []) as SlipSummary[]}
              onRetry={() => slipsQ.refetch()}
              refreshing={slipsQ.isRefetching}
              onOpen={(slip) =>
                navigation.navigate(MAIN_ROUTES.PAYROLL_SLIP_DETAIL, {
                  slipId: slip.id,
                  periodId,
                })
              }
            />
          )}
        </ScrollView>

        <InputOverrideModal
          visible={!!overrideTarget}
          input={overrideTarget}
          submitting={override.isPending}
          onSubmit={handleOverride}
          onClose={() => setOverrideTarget(null)}
        />

        <ManualConceptsEditor
          visible={manualOpen}
          submitting={calculate.isPending}
          onSubmit={handleCalculate}
          onClose={() => setManualOpen(false)}
        />
      </ScreenLayout>
    </SafeAreaView>
  );
};

// ---------- Tabs ----------------------------------------------------------

const InputsTab: React.FC<{
  loading: boolean;
  error: boolean;
  inputs: PeriodInput[];
  editable: boolean;
  onRowPress: (input: PeriodInput) => void;
  onRetry: () => void;
  refreshing: boolean;
}> = ({ loading, error, inputs, editable, onRowPress, onRetry }) => {
  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (error) return <ErrorState onRetry={onRetry} />;
  return <PeriodInputsTable inputs={inputs} editable={editable} onRowPress={onRowPress} />;
};

const SlipsTab: React.FC<{
  loading: boolean;
  error: boolean;
  slips: SlipSummary[];
  onRetry: () => void;
  refreshing: boolean;
  onOpen: (slip: SlipSummary) => void;
}> = ({ loading, error, slips, onRetry, refreshing, onOpen }) => {
  const styles = useThemedStyles(createStyles);
  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (slips.length === 0) {
    return (
      <EmptyState
        icon="document-outline"
        title="Sin boletas"
        description="Calcula el periodo para generar boletas."
      />
    );
  }
  return (
    <FlatList
      data={slips}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      contentContainerStyle={{ gap: spacing[2] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRetry} />}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => onOpen(item)} activeOpacity={0.7}>
          <Card style={styles.card}>
            <View style={styles.rowBetween}>
              <Body style={styles.name}>{item.full_name ?? item.user_id}</Body>
              <PeriodStatusChip status={item.status} />
            </View>
            <View style={styles.slipMetrics}>
              <Caption>Ingresos: {formatPen(item.total_ingresos)}</Caption>
              <Caption>Descuentos: {formatPen(item.total_descuentos)}</Caption>
              <Caption>Aportes: {formatPen(item.total_aportes)}</Caption>
              <Body style={styles.net}>Neto: {formatPen(item.neto)}</Body>
            </View>
          </Card>
        </TouchableOpacity>
      )}
    />
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.color.background.canvas },
    scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[6] },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    headerCard: { padding: spacing[4], gap: spacing[3] },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    toolbar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    card: { padding: spacing[3], gap: spacing[1] },
    name: { fontWeight: '600' },
    slipMetrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[3],
      marginTop: spacing[1],
      alignItems: 'center',
    },
    net: { fontWeight: '700' },
  });

export default PayrollPeriodDetailScreen;
