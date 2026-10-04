import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Caption, useTheme, useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useBotSettings, useUpdateBotSettings } from '@/hooks/api/useChatbotSettings';
import type { BotPaymentMethod, BotPaymentMethodType } from '@/types/chatbot';
import Alert from '@/utils/alert';

interface Props {
  visible: boolean;
}

const TYPES: Array<{ value: BotPaymentMethodType; label: string }> = [
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'YAPE', label: 'Yape' },
  { value: 'PLIN', label: 'Plin' },
  { value: 'OTHER', label: 'Otro' },
];

const newMethod = (): BotPaymentMethod => ({
  id: `pm-${Date.now().toString(36)}`,
  type: 'TRANSFER',
  label: 'Transferencia bancaria',
  bank: '',
  holder: '',
  accountNumber: '',
  cci: '',
  phone: '',
  notes: '',
  enabled: true,
});

/** Campos vacios -> null (asi coincide con lo que guarda el backend). */
const clean = (m: BotPaymentMethod): BotPaymentMethod => {
  const t = (v: string | null) => (v && v.trim() ? v.trim() : null);
  return {
    ...m,
    label: m.label.trim() || 'Medio de pago',
    bank: t(m.bank),
    holder: t(m.holder),
    accountNumber: t(m.accountNumber),
    cci: t(m.cci),
    phone: t(m.phone),
    notes: t(m.notes),
  };
};

/**
 * Medios de pago que el bot envia al confirmar el pedido. Solo los ACTIVOS se
 * muestran al cliente; desactivar uno lo oculta sin borrarlo.
 *
 * Endpoints:
 * - GET /chatbot/settings            (paymentMethods)
 * - PUT /chatbot/settings  { paymentMethods }
 */
export const BotPaymentMethodsPanel: React.FC<Props> = ({ visible }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const settingsQuery = useBotSettings({ enabled: visible });
  const updateMutation = useUpdateBotSettings();
  const [methods, setMethods] = useState<BotPaymentMethod[]>([]);

  useEffect(() => {
    if (settingsQuery.data) setMethods(settingsQuery.data.paymentMethods ?? []);
  }, [settingsQuery.data]);

  const draft = useMemo(() => methods.map(clean), [methods]);
  const dirty = JSON.stringify(settingsQuery.data?.paymentMethods ?? []) !== JSON.stringify(draft);

  const patch = (idx: number, change: Partial<BotPaymentMethod>) =>
    setMethods((prev) => prev.map((m, i) => (i === idx ? { ...m, ...change } : m)));

  const handleSave = () => {
    const incomplete = draft.find((m) =>
      m.type === 'TRANSFER'
        ? !m.accountNumber && !m.cci
        : m.type === 'YAPE' || m.type === 'PLIN'
          ? !m.phone
          : !m.accountNumber && !m.phone && !m.notes
    );
    if (incomplete) {
      Alert.alert(
        'Faltan datos',
        `Completa los datos de pago de "${incomplete.label}" (cuenta/CCI o celular).`
      );
      return;
    }
    if (!draft.some((m) => m.enabled)) {
      Alert.alert(
        'Sin medios activos',
        'Con todos desactivados el bot dirá que un asesor enviará los datos de pago.'
      );
    }
    updateMutation.mutate(
      { paymentMethods: draft },
      {
        onSuccess: () => Alert.alert('Guardado', 'Medios de pago actualizados.'),
        onError: (err: any) =>
          Alert.alert('Error', err?.message ?? 'No se pudieron guardar los medios de pago'),
      }
    );
  };

  if (settingsQuery.isLoading) return <ActivityIndicator color={theme.color.text.muted} />;

  const input = (
    idx: number,
    key: keyof BotPaymentMethod,
    placeholder: string,
    keyboardType: 'default' | 'number-pad' | 'phone-pad' = 'default'
  ) => (
    <TextInput
      style={styles.input}
      value={(methods[idx][key] as string | null) ?? ''}
      onChangeText={(t) => patch(idx, { [key]: t } as Partial<BotPaymentMethod>)}
      placeholder={placeholder}
      placeholderTextColor={theme.color.text.muted}
      keyboardType={keyboardType}
    />
  );

  return (
    <View style={{ gap: spacing[3] }}>
      <Caption color={theme.color.text.muted}>
        Datos de pago que el bot envía al cliente cuando confirma su pedido. Solo se muestran los
        activos; desactívalos para ocultarlos sin borrarlos.
      </Caption>

      {methods.map((m, idx) => (
        <View key={m.id} style={[styles.card, !m.enabled && styles.cardOff]}>
          <View style={styles.cardHeader}>
            <TextInput
              style={[styles.input, styles.labelInput]}
              value={m.label}
              onChangeText={(t) => patch(idx, { label: t })}
              placeholder="Nombre (ej. Transferencia BBVA)"
              placeholderTextColor={theme.color.text.muted}
            />
            <Caption color={theme.color.text.muted}>{m.enabled ? 'Activo' : 'Inactivo'}</Caption>
            <Switch value={m.enabled} onValueChange={(v) => patch(idx, { enabled: v })} />
            <Pressable
              hitSlop={8}
              onPress={() =>
                Alert.alert('Eliminar medio de pago', `¿Eliminar "${m.label}"?`, [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: () => setMethods((prev) => prev.filter((_, i) => i !== idx)),
                  },
                ])
              }
            >
              <Ionicons name="trash-outline" size={18} color={theme.color.text.muted} />
            </Pressable>
          </View>

          <View style={styles.chipsRow}>
            {TYPES.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => patch(idx, { type: t.value })}
                style={[styles.chip, m.type === t.value && styles.chipActive]}
              >
                <Caption
                  color={m.type === t.value ? theme.color.text.heading : theme.color.text.muted}
                >
                  {m.type === t.value ? '✓ ' : ''}
                  {t.label}
                </Caption>
              </Pressable>
            ))}
          </View>

          {m.type === 'TRANSFER' ? (
            <>
              {input(idx, 'bank', 'Banco (ej. BBVA)')}
              {input(idx, 'holder', 'Titular (ej. GRIT LABS SAC)')}
              {input(idx, 'accountNumber', 'N° de cuenta')}
              {input(idx, 'cci', 'CCI')}
            </>
          ) : m.type === 'YAPE' || m.type === 'PLIN' ? (
            <>
              {input(idx, 'phone', 'Celular', 'phone-pad')}
              {input(idx, 'holder', 'Titular')}
            </>
          ) : (
            <>
              {input(idx, 'holder', 'Titular')}
              {input(idx, 'accountNumber', 'N° de cuenta (opcional)')}
              {input(idx, 'phone', 'Celular (opcional)', 'phone-pad')}
            </>
          )}
          {input(idx, 'notes', 'Nota para el cliente (opcional)')}
        </View>
      ))}

      <View style={styles.actionsRow}>
        <Button
          title="Agregar medio de pago"
          variant="outline"
          leftIcon="add"
          onPress={() => setMethods((prev) => [...prev, newMethod()])}
        />
        <Button
          title="Guardar"
          onPress={handleSave}
          disabled={!dirty}
          loading={updateMutation.isPending}
          leftIcon="save-outline"
        />
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: spacing[2],
      padding: spacing[3],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.lg,
    },
    cardOff: {
      opacity: 0.6,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    labelInput: {
      flex: 1,
      fontWeight: '600',
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border.default,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      backgroundColor: theme.color.surface.base,
      color: theme.color.text.body,
      minHeight: 40,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    chip: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.surface.base,
    },
    chipActive: {
      backgroundColor: theme.color.brand.accent + '30',
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
  });
