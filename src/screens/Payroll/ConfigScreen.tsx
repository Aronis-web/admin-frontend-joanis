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
  ChipGroup,
  EmptyState,
  ErrorState,
  Input,
  Title,
} from '@/design-system';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { spacing } from '@/design-system/tokens';

import type { RootStackParamList } from '@/types/navigation';
import {
  usePayrollAfpRates,
  usePayrollConcepts,
  usePayrollParameters,
  usePayrollTaxBrackets,
  useUpsertAfpRate,
  useUpsertPayrollConcept,
  useUpsertPayrollParameter,
  useUpsertTaxBracket,
} from '@/hooks/api/usePayrollConfig';
import type {
  AfpCode,
  AfpRegime,
  ConceptType,
  PayrollParamKey,
  UpsertAfpRateDto,
  UpsertConceptDto,
  UpsertParameterDto,
  UpsertTaxBracketDto,
} from '@/types/payroll';
import { parseDecimal } from '@/types/payroll';
import { formatDecimal, formatPen, formatRate } from '@/utils/payrollFormat';
import { PayrollTabs } from '@/components/Payroll/PayrollTabs';
import { PayrollDateField } from '@/components/Payroll/PayrollDateField';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'PayrollConfig'>;

type TabKey = 'afp' | 'params' | 'brackets' | 'concepts';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'afp', label: 'AFP' },
  { key: 'params', label: 'Parametros' },
  { key: 'brackets', label: '5ta categoria' },
  { key: 'concepts', label: 'Conceptos' },
];

export const PayrollConfigScreen: React.FC<Props> = ({ navigation }) => {
  const styles = useThemedStyles(createStyles);
  const [tab, setTab] = useState<TabKey>('afp');

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenLayout navigation={navigation as any}>
        <ScrollView contentContainerStyle={styles.container}>
          <Title>Configuracion de Planilla</Title>
          <Caption>Tasas AFP, parametros, escalas 5ta y conceptos.</Caption>
          <PayrollTabs tabs={TABS} active={tab} onChange={setTab} />
          {tab === 'afp' && <AfpTab />}
          {tab === 'params' && <ParametersTab />}
          {tab === 'brackets' && <TaxBracketsTab />}
          {tab === 'concepts' && <ConceptsTab />}
        </ScrollView>
      </ScreenLayout>
    </SafeAreaView>
  );
};

// ---------- AFP ------------------------------------------------------------

const AFP_CODES: AfpCode[] = ['HABITAT', 'INTEGRA', 'PRIMA', 'PROFUTURO'];
const REGIMES: AfpRegime[] = ['flujo', 'mixta'];

const AfpTab: React.FC = () => {
  const styles = useThemedStyles(createStyles);
  const q = usePayrollAfpRates();
  const upsert = useUpsertAfpRate();
  const [open, setOpen] = useState(false);

  if (q.isLoading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const rates = q.data ?? [];

  return (
    <View style={styles.tabWrap}>
      <Button title="Nueva tasa" leftIcon="add-outline" onPress={() => setOpen(true)} />
      {rates.length === 0 ? (
        <EmptyState icon="wallet-outline" title="Sin tasas configuradas" />
      ) : (
        rates.map((r, i) => (
          <Card key={`${r.afp_code}-${r.regime}-${i}`} style={styles.card}>
            <View style={styles.rowBetween}>
              <Body style={{ fontWeight: '600' }}>
                {r.afp_code} · {r.regime}
              </Body>
              {r.effective_from && <Caption>Desde {r.effective_from}</Caption>}
            </View>
            <Caption>Comision: {formatRate(r.commission_rate)}</Caption>
            <Caption>Seguro: {formatRate(r.insurance_rate)}</Caption>
            <Caption>Fondo: {formatRate(r.fund_rate)}</Caption>
            <Caption>Tope: {formatPen(r.insurable_cap)}</Caption>
          </Card>
        ))
      )}

      <UpsertAfpModal
        visible={open}
        saving={upsert.isPending}
        onClose={() => setOpen(false)}
        onSubmit={async (dto) => {
          try {
            await upsert.mutateAsync(dto);
            setOpen(false);
            Alert.alert('Guardado', 'Tasa AFP actualizada.');
          } catch (err: any) {
            logger.error('upsertAfpRate', err);
            Alert.alert('Error', err?.message ?? 'No se pudo guardar.');
          }
        }}
      />
    </View>
  );
};

const UpsertAfpModal: React.FC<{
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (dto: UpsertAfpRateDto) => Promise<void>;
}> = ({ visible, saving, onClose, onSubmit }) => {
  const styles = useThemedStyles(createStyles);
  const [afpCode, setAfpCode] = useState<AfpCode>('INTEGRA');
  const [regime, setRegime] = useState<AfpRegime>('flujo');
  const [commissionRate, setCommissionRate] = useState('');
  const [insuranceRate, setInsuranceRate] = useState('');
  const [fundRate, setFundRate] = useState('0.10');
  const [insurableCap, setInsurableCap] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');

  const canSubmit =
    !!commissionRate && !!insuranceRate && !!fundRate && !!insurableCap && !!effectiveFrom;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[2] }}>
          <Title>Tasa AFP</Title>
          <Caption>AFP</Caption>
          <ChipGroup
            options={AFP_CODES.map((c) => ({ label: c, value: c }))}
            selected={[afpCode]}
            onChange={(sel) => setAfpCode((sel[0] as AfpCode) ?? 'INTEGRA')}
            variant="filled"
            size="small"
          />
          <Caption>Regimen</Caption>
          <ChipGroup
            options={REGIMES.map((r) => ({ label: r, value: r }))}
            selected={[regime]}
            onChange={(sel) => setRegime((sel[0] as AfpRegime) ?? 'flujo')}
            variant="filled"
            size="small"
          />
          <Input
            label="Comision (decimal, ej 0.017)"
            value={commissionRate}
            onChangeText={setCommissionRate}
            keyboardType="decimal-pad"
          />
          <Input
            label="Seguro (decimal)"
            value={insuranceRate}
            onChangeText={setInsuranceRate}
            keyboardType="decimal-pad"
          />
          <Input
            label="Fondo (decimal)"
            value={fundRate}
            onChangeText={setFundRate}
            keyboardType="decimal-pad"
          />
          <Input
            label="Tope asegurable (S/)"
            value={insurableCap}
            onChangeText={setInsurableCap}
            keyboardType="decimal-pad"
          />
          <PayrollDateField
            label="Vigente desde"
            value={effectiveFrom}
            onChange={setEffectiveFrom}
            title="Vigente desde"
          />
          <View style={styles.actions}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} disabled={saving} />
            <Button
              title="Guardar"
              onPress={() =>
                onSubmit({
                  afpCode,
                  regime,
                  commissionRate: parseDecimal(commissionRate),
                  insuranceRate: parseDecimal(insuranceRate),
                  fundRate: parseDecimal(fundRate),
                  insurableCap: parseDecimal(insurableCap),
                  effectiveFrom,
                })
              }
              disabled={!canSubmit || saving}
              loading={saving}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ---------- Parametros -----------------------------------------------------

const PARAM_KEYS: PayrollParamKey[] = [
  'UIT',
  'RMV',
  'ASIG_FAMILIAR_AMOUNT',
  'ONP_RATE',
  'ESSALUD_RATE',
  'SEGVIDALEY_RATE',
  'INSURABLE_CAP',
];

const ParametersTab: React.FC = () => {
  const styles = useThemedStyles(createStyles);
  const q = usePayrollParameters();
  const upsert = useUpsertPayrollParameter();
  const [open, setOpen] = useState(false);

  if (q.isLoading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const params = q.data ?? [];

  return (
    <View style={styles.tabWrap}>
      <Button title="Nuevo parametro" leftIcon="add-outline" onPress={() => setOpen(true)} />
      {params.length === 0 ? (
        <EmptyState icon="options-outline" title="Sin parametros" />
      ) : (
        params.map((p, i) => (
          <Card key={`${p.param_key}-${i}`} style={styles.card}>
            <View style={styles.rowBetween}>
              <Body style={{ fontWeight: '600' }}>{p.param_key}</Body>
              <Body>{formatDecimal(p.numeric_value, 4)}</Body>
            </View>
            {p.description && <Caption>{p.description}</Caption>}
            {p.effective_from && <Caption>Desde {p.effective_from}</Caption>}
          </Card>
        ))
      )}

      <UpsertParamModal
        visible={open}
        saving={upsert.isPending}
        onClose={() => setOpen(false)}
        onSubmit={async (dto) => {
          try {
            await upsert.mutateAsync(dto);
            setOpen(false);
            Alert.alert('Guardado', 'Parametro actualizado.');
          } catch (err: any) {
            logger.error('upsertPayrollParameter', err);
            Alert.alert('Error', err?.message ?? 'No se pudo guardar.');
          }
        }}
      />
    </View>
  );
};

const UpsertParamModal: React.FC<{
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (dto: UpsertParameterDto) => Promise<void>;
}> = ({ visible, saving, onClose, onSubmit }) => {
  const styles = useThemedStyles(createStyles);
  const [paramKey, setParamKey] = useState<PayrollParamKey>('UIT');
  const [numericValue, setNumericValue] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [description, setDescription] = useState('');

  const canSubmit = !!numericValue && !!effectiveFrom;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[2] }}>
          <Title>Parametro</Title>
          <Caption>Clave</Caption>
          <ChipGroup
            options={PARAM_KEYS.map((k) => ({ label: k, value: k }))}
            selected={[paramKey]}
            onChange={(sel) => setParamKey((sel[0] as PayrollParamKey) ?? 'UIT')}
            variant="filled"
            size="small"
          />
          <Input
            label="Valor numerico"
            value={numericValue}
            onChangeText={setNumericValue}
            keyboardType="decimal-pad"
          />
          <PayrollDateField
            label="Vigente desde"
            value={effectiveFrom}
            onChange={setEffectiveFrom}
            title="Vigente desde"
          />
          <Input label="Descripcion" value={description} onChangeText={setDescription} multiline />
          <View style={styles.actions}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} disabled={saving} />
            <Button
              title="Guardar"
              onPress={() =>
                onSubmit({
                  paramKey,
                  numericValue: parseDecimal(numericValue),
                  effectiveFrom,
                  description: description.trim() || undefined,
                })
              }
              disabled={!canSubmit || saving}
              loading={saving}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ---------- Escalas 5ta ---------------------------------------------------

const TaxBracketsTab: React.FC = () => {
  const styles = useThemedStyles(createStyles);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const q = usePayrollTaxBrackets(year);
  const upsert = useUpsertTaxBracket();
  const [open, setOpen] = useState(false);

  const brackets = q.data ?? [];

  return (
    <View style={styles.tabWrap}>
      <View style={styles.rowBetween}>
        <Input
          label="Anio"
          value={String(year)}
          onChangeText={(t) => setYear(Number(t) || currentYear)}
          keyboardType="number-pad"
          containerStyle={{ flex: 1 }}
        />
        <Button title="Nuevo tramo" leftIcon="add-outline" onPress={() => setOpen(true)} />
      </View>
      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : brackets.length === 0 ? (
        <EmptyState icon="stats-chart-outline" title="Sin tramos" />
      ) : (
        brackets.map((b, i) => (
          <Card key={`${b.year}-${b.bracket_order}-${i}`} style={styles.card}>
            <View style={styles.rowBetween}>
              <Body style={{ fontWeight: '600' }}>Tramo {b.bracket_order}</Body>
              <Badge variant="info" size="small" label={formatRate(b.rate)} />
            </View>
            <Caption>
              De {formatDecimal(b.lower_uit)} UIT a {formatDecimal(b.upper_uit)} UIT
            </Caption>
          </Card>
        ))
      )}

      <UpsertTaxBracketModal
        visible={open}
        year={year}
        saving={upsert.isPending}
        onClose={() => setOpen(false)}
        onSubmit={async (dto) => {
          try {
            await upsert.mutateAsync(dto);
            setOpen(false);
            Alert.alert('Guardado', 'Tramo actualizado.');
          } catch (err: any) {
            logger.error('upsertTaxBracket', err);
            Alert.alert('Error', err?.message ?? 'No se pudo guardar.');
          }
        }}
      />
    </View>
  );
};

const UpsertTaxBracketModal: React.FC<{
  visible: boolean;
  year: number;
  saving: boolean;
  onClose: () => void;
  onSubmit: (dto: UpsertTaxBracketDto) => Promise<void>;
}> = ({ visible, year, saving, onClose, onSubmit }) => {
  const styles = useThemedStyles(createStyles);
  const [bracketOrder, setBracketOrder] = useState('1');
  const [lowerUit, setLowerUit] = useState('0');
  const [upperUit, setUpperUit] = useState('5');
  const [rate, setRate] = useState('0.08');

  const canSubmit = !!bracketOrder && !!lowerUit && !!upperUit && !!rate;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[2] }}>
          <Title>Tramo {year}</Title>
          <Input
            label="Orden"
            value={bracketOrder}
            onChangeText={setBracketOrder}
            keyboardType="number-pad"
          />
          <Input
            label="Limite inferior (UIT)"
            value={lowerUit}
            onChangeText={setLowerUit}
            keyboardType="decimal-pad"
          />
          <Input
            label="Limite superior (UIT)"
            value={upperUit}
            onChangeText={setUpperUit}
            keyboardType="decimal-pad"
          />
          <Input
            label="Tasa (decimal, ej 0.08)"
            value={rate}
            onChangeText={setRate}
            keyboardType="decimal-pad"
          />
          <View style={styles.actions}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} disabled={saving} />
            <Button
              title="Guardar"
              onPress={() =>
                onSubmit({
                  year,
                  bracketOrder: Number(bracketOrder) || 1,
                  lowerUit: parseDecimal(lowerUit),
                  upperUit: parseDecimal(upperUit),
                  rate: parseDecimal(rate),
                })
              }
              disabled={!canSubmit || saving}
              loading={saving}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ---------- Conceptos -----------------------------------------------------

const CONCEPT_TYPES: ConceptType[] = ['INGRESO', 'DESCUENTO', 'APORTE'];

const ConceptsTab: React.FC = () => {
  const styles = useThemedStyles(createStyles);
  const q = usePayrollConcepts();
  const upsert = useUpsertPayrollConcept();
  const [open, setOpen] = useState(false);

  const concepts = q.data ?? [];
  const grouped = useMemo(() => {
    const g: Record<ConceptType, typeof concepts> = {
      INGRESO: [],
      DESCUENTO: [],
      APORTE: [],
    };
    for (const c of concepts) g[c.concept_type]?.push(c);
    return g;
  }, [concepts]);

  if (q.isLoading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <View style={styles.tabWrap}>
      <Button title="Nuevo concepto" leftIcon="add-outline" onPress={() => setOpen(true)} />
      {CONCEPT_TYPES.map((type) => {
        const list = grouped[type];
        if (!list?.length) return null;
        return (
          <View key={type} style={{ gap: spacing[1] }}>
            <Caption>{type}</Caption>
            {list.map((c) => (
              <Card key={c.code} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '600' }}>{c.code}</Body>
                    <Caption>{c.name}</Caption>
                  </View>
                  {c.is_active === false && (
                    <Badge variant="default" size="small" label="Inactivo" />
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: spacing[4], flexWrap: 'wrap' }}>
                  {c.affects_afp && <Caption>AFP</Caption>}
                  {c.affects_essalud && <Caption>EsSalud</Caption>}
                  {c.affects_income_tax && <Caption>Renta</Caption>}
                </View>
              </Card>
            ))}
          </View>
        );
      })}

      <UpsertConceptModal
        visible={open}
        saving={upsert.isPending}
        onClose={() => setOpen(false)}
        onSubmit={async (dto) => {
          try {
            await upsert.mutateAsync(dto);
            setOpen(false);
            Alert.alert('Guardado', 'Concepto actualizado.');
          } catch (err: any) {
            logger.error('upsertPayrollConcept', err);
            Alert.alert('Error', err?.message ?? 'No se pudo guardar.');
          }
        }}
      />
    </View>
  );
};

const UpsertConceptModal: React.FC<{
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (dto: UpsertConceptDto) => Promise<void>;
}> = ({ visible, saving, onClose, onSubmit }) => {
  const styles = useThemedStyles(createStyles);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [conceptType, setConceptType] = useState<ConceptType>('INGRESO');
  const [affectsAfp, setAffectsAfp] = useState(false);
  const [affectsEssalud, setAffectsEssalud] = useState(false);
  const [affectsIncomeTax, setAffectsIncomeTax] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const canSubmit = !!code.trim() && !!name.trim();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[2] }}>
          <Title>Concepto</Title>
          <Input
            label="Codigo *"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder="INC_HORAS_EXTRA_25"
          />
          <Input label="Nombre *" value={name} onChangeText={setName} />
          <Caption>Tipo</Caption>
          <ChipGroup
            options={CONCEPT_TYPES.map((t) => ({ label: t, value: t }))}
            selected={[conceptType]}
            onChange={(sel) => setConceptType((sel[0] as ConceptType) ?? 'INGRESO')}
            variant="filled"
            size="small"
          />
          <Caption>Afecta</Caption>
          <ChipGroup
            options={[
              { label: 'AFP', value: 'afp' },
              { label: 'EsSalud', value: 'essalud' },
              { label: 'Renta 5ta', value: 'tax' },
            ]}
            selected={[
              affectsAfp ? 'afp' : '',
              affectsEssalud ? 'essalud' : '',
              affectsIncomeTax ? 'tax' : '',
            ].filter(Boolean)}
            onChange={(sel) => {
              setAffectsAfp(sel.includes('afp'));
              setAffectsEssalud(sel.includes('essalud'));
              setAffectsIncomeTax(sel.includes('tax'));
            }}
            variant="filled"
            size="small"
            multiple
          />
          <Caption>Estado</Caption>
          <ChipGroup
            options={[
              { label: 'Activo', value: 'yes' },
              { label: 'Inactivo', value: 'no' },
            ]}
            selected={[isActive ? 'yes' : 'no']}
            onChange={(sel) => setIsActive(sel[0] === 'yes')}
            variant="filled"
            size="small"
          />
          <View style={styles.actions}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} disabled={saving} />
            <Button
              title="Guardar"
              onPress={() =>
                onSubmit({
                  code: code.trim(),
                  name: name.trim(),
                  conceptType,
                  affectsAfp,
                  affectsEssalud,
                  affectsIncomeTax,
                  isActive,
                })
              }
              disabled={!canSubmit || saving}
              loading={saving}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ---------- Styles ---------------------------------------------------------

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.color.background.canvas },
    container: { padding: spacing[4], gap: spacing[2], paddingBottom: spacing[6] },
    tabWrap: { gap: spacing[2] },
    card: { padding: spacing[4], gap: spacing[1], marginBottom: spacing[2] },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
      marginTop: spacing[5],
    },
  });

export default PayrollConfigScreen;
