import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Caption, useTheme, useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import {
  useBotFulfillmentSites,
  useBotSettings,
  useUpdateBotSettings,
} from '@/hooks/api/useChatbotSettings';
import type { BotAgencyOption, BotFulfillmentConfig } from '@/types/chatbot';
import Alert from '@/utils/alert';

interface Props {
  visible: boolean;
}

/** Fila editable de tarifa por distancia (strings para los inputs). */
interface BandRow {
  upToKm: string;
  fee: string;
}

/** Fila editable de agencia (tarifa en soles como string). */
interface AgencyRow {
  code: string;
  name: string;
  fee: string;
  enabled: boolean;
}

const DEFAULT_AGENCIES: BotAgencyOption[] = [
  { code: 'SHALOM', name: 'Shalom', feeCents: 0, enabled: true },
  { code: 'FLORES', name: 'Flores', feeCents: 0, enabled: true },
  { code: 'MARVISUR', name: 'Marvisur', feeCents: 0, enabled: true },
];

const toSoles = (cents: number) => (cents > 0 ? (cents / 100).toFixed(2) : '0');
const toCents = (soles: string) => {
  const n = Number.parseFloat((soles || '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};

/**
 * Configuracion de la ENTREGA del bot: el catalogo es unico y, al cerrar el
 * pedido, el cliente elige recojo en un punto (sin costo) o delivery (Lima por
 * distancia desde la sede de despacho, provincia por agencia).
 *
 * Endpoints:
 * - GET /chatbot/settings/fulfillment/sites
 * - PUT /chatbot/settings  { fulfillmentConfig }
 */
export const BotFulfillmentPanel: React.FC<Props> = ({ visible }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const settingsQuery = useBotSettings({ enabled: visible });
  const sitesQuery = useBotFulfillmentSites({ enabled: visible });
  const updateMutation = useUpdateBotSettings();

  const [pickupSiteIds, setPickupSiteIds] = useState<string[]>([]);
  const [limaEnabled, setLimaEnabled] = useState(false);
  const [originSiteId, setOriginSiteId] = useState<string | null>(null);
  const [bands, setBands] = useState<BandRow[]>([]);
  // FIXED = un solo costo para todo Lima/Callao; BANDS = tarifa por distancia.
  const [limaMode, setLimaMode] = useState<'FIXED' | 'BANDS'>('FIXED');
  const [fixedFee, setFixedFee] = useState('');
  const [agencyEnabled, setAgencyEnabled] = useState(false);
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);

  const current = settingsQuery.data?.fulfillmentConfig ?? null;

  // Rehidrata el formulario con la configuracion guardada.
  useEffect(() => {
    if (!settingsQuery.data) return;
    const c = settingsQuery.data.fulfillmentConfig;
    setPickupSiteIds(c?.pickupSiteIds ?? []);
    setLimaEnabled(c?.lima?.enabled ?? false);
    setOriginSiteId(c?.lima?.originSiteId ?? null);
    setBands(
      (c?.lima?.bands ?? []).map((b) => ({ upToKm: String(b.upToKm), fee: toSoles(b.feeCents) }))
    );
    const fixed = c?.lima?.fixedFeeCents;
    const hasBands = (c?.lima?.bands?.length ?? 0) > 0;
    setLimaMode(fixed != null || !hasBands ? 'FIXED' : 'BANDS');
    setFixedFee(fixed != null ? toSoles(fixed) : '');
    setAgencyEnabled(c?.agency?.enabled ?? false);
    setAgencies(
      (c?.agency?.agencies?.length ? c.agency.agencies : DEFAULT_AGENCIES).map((a) => ({
        code: a.code,
        name: a.name,
        fee: toSoles(a.feeCents),
        enabled: a.enabled,
      }))
    );
  }, [settingsQuery.data]);

  const draft: BotFulfillmentConfig = useMemo(
    () => ({
      pickupSiteIds,
      lima: {
        enabled: limaEnabled,
        originSiteId,
        bands: bands
          .map((b) => ({ upToKm: Number.parseFloat(b.upToKm), feeCents: toCents(b.fee) }))
          .filter((b) => Number.isFinite(b.upToKm) && b.upToKm > 0)
          .sort((a, b) => a.upToKm - b.upToKm),
        fixedFeeCents: limaMode === 'FIXED' ? toCents(fixedFee) : null,
      },
      agency: {
        enabled: agencyEnabled,
        agencies: agencies
          .filter((a) => a.name.trim())
          .map((a) => ({
            code: (a.code || a.name)
              .toUpperCase()
              .replace(/[^A-Z0-9_]/g, '')
              .slice(0, 20),
            name: a.name.trim(),
            feeCents: toCents(a.fee),
            enabled: a.enabled,
          })),
      },
    }),
    [pickupSiteIds, limaEnabled, originSiteId, bands, limaMode, fixedFee, agencyEnabled, agencies]
  );

  const dirty = JSON.stringify(current) !== JSON.stringify(draft);
  const sites = sitesQuery.data ?? [];
  const siteName = (id: string | null) => sites.find((s) => s.id === id)?.name ?? '—';

  const togglePickup = (id: string) =>
    setPickupSiteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = () => {
    if (
      draft.lima.enabled &&
      limaMode === 'BANDS' &&
      (!draft.lima.originSiteId || !draft.lima.bands.length)
    ) {
      Alert.alert(
        'Delivery Lima incompleto',
        'Elige la sede de despacho y al menos un tramo de distancia con su tarifa.'
      );
      return;
    }
    updateMutation.mutate(
      { fulfillmentConfig: draft },
      {
        onSuccess: () => Alert.alert('Guardado', 'Configuración de entrega actualizada.'),
        onError: (err: any) =>
          Alert.alert('Error', err?.message ?? 'No se pudo guardar la configuración de entrega'),
      }
    );
  };

  if (settingsQuery.isLoading || sitesQuery.isLoading) {
    return <ActivityIndicator color={theme.color.text.muted} />;
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <Caption color={theme.color.text.muted}>
        El catálogo es único (no por tienda). Al cerrar el pedido el bot pregunta cómo recibirlo:
        recojo en tienda (sin costo) o delivery. La tarifa del envío se suma al total que paga el
        cliente; los pedidos con envío se emiten manualmente en POS.
      </Caption>

      {/* ---------- Recojo ---------- */}
      <View style={styles.section}>
        <Caption color={theme.color.text.heading} style={styles.sectionTitle}>
          🏪 Puntos de recojo (sin costo)
        </Caption>
        <Caption color={theme.color.text.muted}>
          Toca para habilitar. Con una sola tienda el bot la asigna sin preguntar.
        </Caption>
        <View style={styles.chipsRow}>
          {sites.map((s) => {
            const on = pickupSiteIds.includes(s.id);
            return (
              <Pressable
                key={s.id}
                onPress={() => togglePickup(s.id)}
                style={[styles.chip, on && styles.chipActive]}
              >
                <Caption color={on ? theme.color.text.heading : theme.color.text.muted}>
                  {on ? '✓ ' : ''}
                  {s.name}
                  {s.hasCoords ? '' : ' (sin mapa)'}
                </Caption>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ---------- Delivery Lima ---------- */}
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Caption color={theme.color.text.heading} style={styles.sectionTitle}>
            🛵 Delivery Lima / Callao
          </Caption>
          <Switch value={limaEnabled} onValueChange={setLimaEnabled} />
        </View>
        {limaEnabled ? (
          <View style={styles.chipsRow}>
            {(
              [
                ['FIXED', 'Costo fijo'],
                ['BANDS', 'Por distancia'],
              ] as const
            ).map(([mode, label]) => (
              <Pressable
                key={mode}
                onPress={() => setLimaMode(mode)}
                style={[styles.chip, limaMode === mode && styles.chipActive]}
              >
                <Caption
                  color={limaMode === mode ? theme.color.text.heading : theme.color.text.muted}
                >
                  {limaMode === mode ? '✓ ' : ''}
                  {label}
                </Caption>
              </Pressable>
            ))}
          </View>
        ) : null}
        {limaEnabled && limaMode === 'FIXED' ? (
          <>
            <Caption color={theme.color.text.muted}>
              Un solo costo de envío para todo Lima y Callao. Se suma al carrito y al pedido.
            </Caption>
            <View style={styles.inlineRow}>
              <Caption color={theme.color.text.muted}>Costo de envío S/</Caption>
              <TextInput
                style={[styles.input, styles.inputSmall]}
                value={fixedFee}
                onChangeText={(t) => setFixedFee(t.replace(/[^0-9.,]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="10.00"
                placeholderTextColor={theme.color.text.muted}
              />
            </View>
          </>
        ) : null}
        {limaEnabled && limaMode === 'BANDS' ? (
          <>
            <Caption color={theme.color.text.muted}>
              Sede de despacho (desde donde se mide la distancia en línea recta):{' '}
              {siteName(originSiteId)}
            </Caption>
            <View style={styles.chipsRow}>
              {sites
                .filter((s) => s.hasCoords)
                .map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setOriginSiteId(s.id)}
                    style={[styles.chip, originSiteId === s.id && styles.chipActive]}
                  >
                    <Caption
                      color={
                        originSiteId === s.id ? theme.color.text.heading : theme.color.text.muted
                      }
                    >
                      {s.name}
                    </Caption>
                  </Pressable>
                ))}
            </View>
            <Caption color={theme.color.text.muted}>
              Tramos: hasta X km cuesta S/ Y. Más allá del último tramo no hay cobertura (se ofrece
              recojo).
            </Caption>
            {bands.map((b, idx) => (
              <View key={idx} style={styles.inlineRow}>
                <Caption color={theme.color.text.muted}>Hasta</Caption>
                <TextInput
                  style={[styles.input, styles.inputSmall]}
                  value={b.upToKm}
                  onChangeText={(t) =>
                    setBands((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, upToKm: t.replace(/[^0-9.]/g, '') } : x
                      )
                    )
                  }
                  keyboardType="decimal-pad"
                  placeholder="5"
                  placeholderTextColor={theme.color.text.muted}
                />
                <Caption color={theme.color.text.muted}>km · S/</Caption>
                <TextInput
                  style={[styles.input, styles.inputSmall]}
                  value={b.fee}
                  onChangeText={(t) =>
                    setBands((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, fee: t.replace(/[^0-9.,]/g, '') } : x
                      )
                    )
                  }
                  keyboardType="decimal-pad"
                  placeholder="8.00"
                  placeholderTextColor={theme.color.text.muted}
                />
                <Pressable
                  onPress={() => setBands((prev) => prev.filter((_, i) => i !== idx))}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.color.text.muted} />
                </Pressable>
              </View>
            ))}
            <View style={styles.actionsRow}>
              <Button
                title="Agregar tramo"
                variant="outline"
                leftIcon="add"
                onPress={() => setBands((prev) => [...prev, { upToKm: '', fee: '' }])}
              />
            </View>
          </>
        ) : null}
      </View>

      {/* ---------- Provincia por agencia ---------- */}
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Caption color={theme.color.text.heading} style={styles.sectionTitle}>
            🚚 Provincia por agencia
          </Caption>
          <Switch value={agencyEnabled} onValueChange={setAgencyEnabled} />
        </View>
        {agencyEnabled ? (
          <>
            <Caption color={theme.color.text.muted}>
              Tarifa = lo que cobramos por llevar el pedido a la agencia (0 = sin costo). El envío a
              destino lo paga el cliente contraentrega.
            </Caption>
            {agencies.map((a, idx) => (
              <View key={a.code || idx} style={styles.inlineRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={a.name}
                  onChangeText={(t) =>
                    setAgencies((prev) => prev.map((x, i) => (i === idx ? { ...x, name: t } : x)))
                  }
                  placeholder="Agencia"
                  placeholderTextColor={theme.color.text.muted}
                />
                <Caption color={theme.color.text.muted}>S/</Caption>
                <TextInput
                  style={[styles.input, styles.inputSmall]}
                  value={a.fee}
                  onChangeText={(t) =>
                    setAgencies((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, fee: t.replace(/[^0-9.,]/g, '') } : x
                      )
                    )
                  }
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={theme.color.text.muted}
                />
                <Switch
                  value={a.enabled}
                  onValueChange={(v) =>
                    setAgencies((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, enabled: v } : x))
                    )
                  }
                />
              </View>
            ))}
            <View style={styles.actionsRow}>
              <Button
                title="Agregar agencia"
                variant="outline"
                leftIcon="add"
                onPress={() =>
                  setAgencies((prev) => [...prev, { code: '', name: '', fee: '', enabled: true }])
                }
              />
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.actionsRow}>
        <Button
          title="Guardar entrega"
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
    section: {
      gap: spacing[2],
      padding: spacing[3],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.lg,
    },
    sectionTitle: {
      fontWeight: '600',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    inlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
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
    inputSmall: {
      width: 80,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
  });
