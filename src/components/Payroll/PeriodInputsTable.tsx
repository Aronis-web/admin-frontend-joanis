import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Badge, Body, Caption, Card } from '@/design-system';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';
import type { HHEEMap, OvertimeRateCode, PeriodInput } from '@/types/payroll';
import { parseDecimal } from '@/types/payroll';

interface Props {
  inputs: PeriodInput[];
  editable?: boolean;
  onRowPress?: (input: PeriodInput) => void;
}

const RATE_LABEL: Record<OvertimeRateCode, string> = {
  HHEE_25: '25%',
  HHEE_35: '35%',
  HHEE_100: '100%',
  HHEE_200: '200%',
  HHEE_300: '300%',
};

/** Tabla de inputs (proposed vs final) para el periodo. */
export const PeriodInputsTable: React.FC<Props> = ({ inputs, editable, onRowPress }) => {
  const styles = useThemedStyles(createStyles);

  if (inputs.length === 0) {
    return <Caption>Sin inputs. Ejecuta "Agregar asistencia" para poblar la tabla.</Caption>;
  }

  return (
    <View style={styles.wrap}>
      {inputs.map((row) => (
        <TouchableOpacity
          key={row.user_id}
          onPress={() => (editable && onRowPress ? onRowPress(row) : undefined)}
          activeOpacity={editable ? 0.7 : 1}
        >
          <Card
            style={row.is_overridden ? { ...styles.card, ...styles.cardOverridden } : styles.card}
          >
            <View style={styles.headerRow}>
              <Body style={styles.userId} numberOfLines={1}>
                {row.user_id}
              </Body>
              {row.is_overridden ? (
                <Badge variant="warning" size="small" label="Override" />
              ) : (
                <Badge variant="info" size="small" label="Propuesto" />
              )}
            </View>

            <View style={styles.metrics}>
              <Metric label="Trab." proposed={row.d_trab_proposed} final={row.d_trab_final} />
              <Metric label="Faltas" proposed={row.d_faltos_proposed} final={row.d_faltos_final} />
              <Metric
                label="Desc. med."
                proposed={row.d_desc_med_proposed}
                final={row.d_desc_med_final}
              />
              <Metric label="Vac." proposed={row.d_vac_proposed} final={row.d_vac_final} />
            </View>

            <HHEEChips hhee={row.hhee_final} />
            {row.override_reason ? (
              <Caption style={styles.reason}>Motivo: {row.override_reason}</Caption>
            ) : null}
          </Card>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const Metric: React.FC<{ label: string; proposed: string; final: string }> = ({
  label,
  proposed,
  final,
}) => {
  const styles = useThemedStyles(createStyles);
  const changed = parseDecimal(proposed) !== parseDecimal(final);
  return (
    <View style={styles.metric}>
      <Caption>{label}</Caption>
      <Body style={changed ? styles.metricChanged : styles.metricValue}>
        {parseDecimal(final).toFixed(2)}
      </Body>
      {changed ? (
        <Caption style={styles.strike}>{parseDecimal(proposed).toFixed(2)}</Caption>
      ) : null}
    </View>
  );
};

const HHEEChips: React.FC<{ hhee: HHEEMap }> = ({ hhee }) => {
  const styles = useThemedStyles(createStyles);
  const entries = Object.entries(hhee) as [OvertimeRateCode, number | undefined][];
  const nonZero = entries.filter(([, v]) => (v ?? 0) > 0);
  if (nonZero.length === 0) return null;
  return (
    <View style={styles.hheeRow}>
      {nonZero.map(([code, hours]) => (
        <Badge key={code} variant="info" size="small" label={`${RATE_LABEL[code]}: ${hours}h`} />
      ))}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: spacing[2] },
    card: { padding: spacing[3], gap: spacing[1] },
    cardOverridden: {
      borderWidth: 1,
      borderColor: theme.color.border.error,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    userId: { fontFamily: 'monospace', fontSize: 12, flex: 1 },
    metrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[3],
      marginTop: spacing[1],
    },
    metric: { minWidth: 72 },
    metricValue: { fontWeight: '600' },
    metricChanged: {
      fontWeight: '700',
      color: theme.color.text.warning ?? theme.color.text.heading,
    },
    strike: { textDecorationLine: 'line-through' },
    hheeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
    reason: { marginTop: spacing[1], fontStyle: 'italic' },
  });

export default PeriodInputsTable;
