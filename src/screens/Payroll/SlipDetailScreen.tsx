import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { Body, Caption, Card, ErrorState, Title } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';

import { usePayrollSlip } from '@/hooks/api/usePayrollSlips';
import { PeriodStatusChip } from '@/components/Payroll/PeriodStatusChip';
import type { ConceptType, SlipDetailRow } from '@/types/payroll';
import { formatPen } from '@/utils/payrollFormat';
import type { RootStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollSlipDetail'>;

const SECTION_LABEL: Record<ConceptType, string> = {
  INGRESO: 'Ingresos',
  DESCUENTO: 'Descuentos',
  APORTE: 'Aportes empleador',
};

const SECTION_ORDER: ConceptType[] = ['INGRESO', 'DESCUENTO', 'APORTE'];

export const PayrollSlipDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { slipId } = route.params;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const { data: slip, isLoading, isError, error, refetch } = usePayrollSlip(slipId);

  const grouped = useMemo(() => {
    const acc: Record<ConceptType, SlipDetailRow[]> = {
      INGRESO: [],
      DESCUENTO: [],
      APORTE: [],
    };
    (slip?.details ?? []).forEach((row) => {
      acc[row.concept_type]?.push(row);
    });
    (Object.keys(acc) as ConceptType[]).forEach((k) => {
      acc[k].sort((a, b) => a.display_order - b.display_order);
    });
    return acc;
  }, [slip]);

  if (isLoading) {
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

  if (isError || !slip) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenLayout navigation={navigation as any}>
          <ErrorState
            title="No se pudo cargar la boleta"
            description={(error as any)?.message}
            onRetry={() => refetch()}
          />
        </ScreenLayout>
      </SafeAreaView>
    );
  }

  const snap = slip.employee_snapshot;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenLayout navigation={navigation as any}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.card}>
            <View style={styles.rowBetween}>
              <Title>{snap.full_name}</Title>
              <PeriodStatusChip status={slip.status} />
            </View>
            {snap.position_name ? <Caption>{snap.position_name}</Caption> : null}
            {snap.cost_center ? <Caption>Centro de costo: {snap.cost_center}</Caption> : null}
            <Caption>
              Sistema: {snap.pension_system}
              {snap.pension_system === 'AFP' && snap.afp_code ? ` · ${snap.afp_code}` : ''}
            </Caption>
            <Caption>Rem. computable: {formatPen(slip.rem_computable)}</Caption>
          </Card>

          {SECTION_ORDER.map((type) => {
            const rows = grouped[type];
            if (rows.length === 0) return null;
            return (
              <Card key={type} style={styles.card}>
                <Title style={styles.sectionTitle}>{SECTION_LABEL[type]}</Title>
                {rows.map((row) => (
                  <View key={`${type}-${row.concept_code}`} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Body>{row.concept_code}</Body>
                      {row.quantity !== null ? <Caption>Cantidad: {row.quantity}</Caption> : null}
                    </View>
                    <Body style={styles.amount}>{formatPen(row.amount)}</Body>
                  </View>
                ))}
              </Card>
            );
          })}

          <Card style={styles.footerCard}>
            <FooterRow label="Total ingresos" value={formatPen(slip.total_ingresos)} />
            <FooterRow label="Total descuentos" value={formatPen(slip.total_descuentos)} />
            <FooterRow label="Total aportes" value={formatPen(slip.total_aportes)} />
            <FooterRow label="Neto a pagar" value={formatPen(slip.neto)} strong />
          </Card>
        </ScrollView>
      </ScreenLayout>
    </SafeAreaView>
  );
};

const FooterRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.footerRow}>
      <Body style={strong ? styles.footerLabelStrong : undefined}>{label}</Body>
      <Body style={strong ? styles.footerValueStrong : styles.footerValue}>{value}</Body>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.color.background.canvas },
    scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[6] },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: { padding: spacing[4], gap: spacing[1] },
    sectionTitle: { fontSize: 16, marginBottom: spacing[1] },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing[1],
      gap: spacing[2],
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    amount: { fontWeight: '600' },
    footerCard: { padding: spacing[4], gap: spacing[1] },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing[1],
    },
    footerValue: { fontWeight: '600' },
    footerLabelStrong: { fontWeight: '700' },
    footerValueStrong: { fontWeight: '800', color: theme.color.text.heading },
  });

export default PayrollSlipDetailScreen;
