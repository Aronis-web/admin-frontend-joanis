import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Caption, Card, Input, Title } from '@/design-system';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';

import type { HHEEMap, OverrideInputDto, OvertimeRateCode, PeriodInput } from '@/types/payroll';
import { parseDecimal } from '@/types/payroll';

interface Props {
  visible: boolean;
  input: PeriodInput | null;
  submitting?: boolean;
  onSubmit: (dto: OverrideInputDto) => void;
  onClose: () => void;
}

const RATE_KEYS: OvertimeRateCode[] = ['HHEE_25', 'HHEE_35', 'HHEE_100', 'HHEE_200', 'HHEE_300'];
const RATE_LABEL: Record<OvertimeRateCode, string> = {
  HHEE_25: '25%',
  HHEE_35: '35%',
  HHEE_100: '100%',
  HHEE_200: '200%',
  HHEE_300: '300%',
};

export const InputOverrideModal: React.FC<Props> = ({
  visible,
  input,
  submitting,
  onSubmit,
  onClose,
}) => {
  const styles = useThemedStyles(createStyles);
  const [dTrab, setDTrab] = useState('');
  const [dFaltos, setDFaltos] = useState('');
  const [dDescMed, setDDescMed] = useState('');
  const [dVac, setDVac] = useState('');
  const [hhee, setHhee] = useState<Record<OvertimeRateCode, string>>({
    HHEE_25: '',
    HHEE_35: '',
    HHEE_100: '',
    HHEE_200: '',
    HHEE_300: '',
  });
  const [reason, setReason] = useState('');

  // Seed values whenever a new input is opened.
  React.useEffect(() => {
    if (!input) return;
    setDTrab(String(parseDecimal(input.d_trab_final)));
    setDFaltos(String(parseDecimal(input.d_faltos_final)));
    setDDescMed(String(parseDecimal(input.d_desc_med_final)));
    setDVac(String(parseDecimal(input.d_vac_final)));
    const seed: Record<OvertimeRateCode, string> = {
      HHEE_25: String(input.hhee_final.HHEE_25 ?? ''),
      HHEE_35: String(input.hhee_final.HHEE_35 ?? ''),
      HHEE_100: String(input.hhee_final.HHEE_100 ?? ''),
      HHEE_200: String(input.hhee_final.HHEE_200 ?? ''),
      HHEE_300: String(input.hhee_final.HHEE_300 ?? ''),
    };
    setHhee(seed);
    setReason(input.override_reason ?? '');
  }, [input]);

  const canSubmit = useMemo(() => !!reason.trim() && !submitting, [reason, submitting]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const hheeDto: HHEEMap = {};
    RATE_KEYS.forEach((k) => {
      const n = Number(hhee[k]);
      if (Number.isFinite(n) && n > 0) hheeDto[k] = n;
    });
    onSubmit({
      dTrab: dTrab === '' ? undefined : Number(dTrab),
      dFaltos: dFaltos === '' ? undefined : Number(dFaltos),
      dDescMed: dDescMed === '' ? undefined : Number(dDescMed),
      dVac: dVac === '' ? undefined : Number(dVac),
      hhee: Object.keys(hheeDto).length > 0 ? hheeDto : undefined,
      overrideReason: reason.trim(),
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Title>Override de input</Title>
          {input ? (
            <Card style={styles.card}>
              <Caption>Trabajador</Caption>
              <Body style={styles.mono}>{input.user_id}</Body>
              <Caption>Propuesto (referencia)</Caption>
              <Body>
                Trab: {input.d_trab_proposed} · Faltas: {input.d_faltos_proposed} · Desc.med:{' '}
                {input.d_desc_med_proposed} · Vac: {input.d_vac_proposed}
              </Body>
            </Card>
          ) : null}

          <View style={styles.grid}>
            <Input
              label="Dias trabajados"
              value={dTrab}
              onChangeText={setDTrab}
              keyboardType="decimal-pad"
            />
            <Input
              label="Dias faltos"
              value={dFaltos}
              onChangeText={setDFaltos}
              keyboardType="decimal-pad"
            />
            <Input
              label="Desc. medico"
              value={dDescMed}
              onChangeText={setDDescMed}
              keyboardType="decimal-pad"
            />
            <Input
              label="Vacaciones"
              value={dVac}
              onChangeText={setDVac}
              keyboardType="decimal-pad"
            />
          </View>

          <Title style={styles.section}>HH.EE. (horas)</Title>
          {RATE_KEYS.map((code) => (
            <Input
              key={code}
              label={`${RATE_LABEL[code]} (${code})`}
              value={hhee[code]}
              onChangeText={(v) => setHhee((prev) => ({ ...prev, [code]: v }))}
              keyboardType="decimal-pad"
            />
          ))}

          <Input
            label="Motivo del override *"
            value={reason}
            onChangeText={setReason}
            placeholder="Justifica el ajuste (obligatorio)"
            multiline
          />

          <View style={styles.actions}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} disabled={submitting} />
            <Button
              title="Guardar override"
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.color.background.canvas },
    container: { padding: spacing[4], gap: spacing[2] },
    card: { padding: spacing[3], gap: spacing[1] },
    mono: { fontFamily: 'monospace', fontSize: 12 },
    grid: { gap: spacing[2] },
    section: { fontSize: 16, marginTop: spacing[2] },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
      marginTop: spacing[4],
    },
  });

export default InputOverrideModal;
