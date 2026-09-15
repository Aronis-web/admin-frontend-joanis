import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Body, Caption, Card, ErrorState, Title } from '@/design-system';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';
import { usePayrollVacationBalances } from '@/hooks/api/usePayrollVacations';
import { parseDecimal } from '@/types/payroll';

interface Props {
  userId: string;
}

/**
 * Muestra saldos de vacaciones agrupados por periodo del trabajador.
 */
export const VacationBalanceCard: React.FC<Props> = ({ userId }) => {
  const styles = useThemedStyles(createStyles);
  const { data, isLoading, isError, error, refetch } = usePayrollVacationBalances(userId);
  const balances = data ?? [];

  if (isLoading) {
    return (
      <Card style={styles.card}>
        <ActivityIndicator />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card style={styles.card}>
        <ErrorState
          title="No se pudo cargar el saldo"
          description={(error as any)?.message ?? 'Reintentar.'}
          onRetry={() => refetch()}
        />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Title style={styles.title}>Saldos de vacaciones</Title>
      {balances.length === 0 ? (
        <Caption>Sin registros de saldo.</Caption>
      ) : (
        balances.map((b) => {
          const earned = parseDecimal(b.earned_days);
          const taken = parseDecimal(b.taken_days);
          const remaining = earned - taken;
          return (
            <View key={b.period_label} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Body style={styles.period}>{b.period_label}</Body>
                <Caption>Al {b.as_of_date}</Caption>
              </View>
              <View style={styles.metrics}>
                <Caption>Ganados: {earned.toFixed(2)}</Caption>
                <Caption>Tomados: {taken.toFixed(2)}</Caption>
                <Body style={styles.remaining}>{remaining.toFixed(2)} d</Body>
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
};

const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    card: { padding: spacing[4], gap: spacing[2] },
    title: { fontSize: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing[1],
      gap: spacing[2],
    },
    period: { fontWeight: '600' },
    metrics: { alignItems: 'flex-end', gap: 2 },
    remaining: { fontWeight: '700' },
  });

export default VacationBalanceCard;
