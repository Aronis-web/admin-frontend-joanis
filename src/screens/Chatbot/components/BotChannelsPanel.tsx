import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Body, Button, Caption, useTheme, useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useBotSettings, useUpdateBotSettings } from '@/hooks/api/useChatbotSettings';
import type { BotChannel, BotChannelConfig } from '@/types/chatbot';
import Alert from '@/utils/alert';

interface Props {
  visible: boolean;
}

const CHANNELS: Array<{ key: BotChannel; label: string; placeholder: string }> = [
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/51999999999' },
  { key: 'messenger', label: 'Messenger', placeholder: 'https://m.me/tupagina' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://ig.me/m/tucuenta' },
];

const DEFAULT: BotChannelConfig = {
  whatsapp: { bot: true, catalog: true, link: null },
  messenger: { bot: true, catalog: true, link: null },
  instagram: { bot: true, catalog: true, link: null },
};

/**
 * Bot y ventas por red social. Con el bot prendido y las ventas apagadas en una
 * red, el bot sigue atendiendo dudas y pedidos, y a quien quiere comprar le
 * manda botones a las redes donde sí se vende (con el link de cada una).
 *
 * Endpoints: GET/PUT /chatbot/settings { channelConfig }
 */
export const BotChannelsPanel: React.FC<Props> = ({ visible }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const settingsQuery = useBotSettings({ enabled: visible });
  const updateMutation = useUpdateBotSettings();
  const [cfg, setCfg] = useState<BotChannelConfig>(DEFAULT);

  useEffect(() => {
    const c = settingsQuery.data?.channelConfig;
    if (c) setCfg({ ...DEFAULT, ...c });
  }, [settingsQuery.data]);

  const saved = settingsQuery.data?.channelConfig ?? DEFAULT;
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(cfg), [saved, cfg]);
  const defaults = settingsQuery.data?.channelLinkDefaults ?? {};

  const patch = (ch: BotChannel, p: Partial<BotChannelConfig[BotChannel]>) =>
    setCfg((prev) => ({ ...prev, [ch]: { ...prev[ch], ...p } }));

  const save = () => {
    const bad = CHANNELS.find((c) => {
      const l = cfg[c.key].link?.trim();
      return !!l && !/^https:\/\/\S+$/i.test(l);
    });
    if (bad) {
      Alert.alert('Link inválido', `El link de ${bad.label} debe empezar con https://`);
      return;
    }
    const body: BotChannelConfig = { ...cfg };
    for (const c of CHANNELS) {
      const l = cfg[c.key].link?.trim();
      body[c.key] = { ...cfg[c.key], link: l ? l : null };
    }
    updateMutation.mutate(
      { channelConfig: body },
      {
        onSuccess: () => Alert.alert('Listo', 'Se guardó la configuración por red.'),
        onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo guardar'),
      }
    );
  };

  if (settingsQuery.isLoading) return <ActivityIndicator color={theme.color.text.muted} />;

  const selling = CHANNELS.filter((c) => cfg[c.key].bot && cfg[c.key].catalog);

  return (
    <View style={{ gap: spacing[3] }}>
      <Caption color={theme.color.text.muted}>
        Con el bot prendido y las ventas apagadas, el bot sigue respondiendo dudas, preguntas
        frecuentes y consultas de pedidos; a quien quiere comprar le dice que por esa red no se
        está vendiendo y le manda botones a las redes donde sí.
      </Caption>
      {CHANNELS.map((c) => {
        const row = cfg[c.key];
        const linkMissing = row.bot && row.catalog && !row.link && !defaults[c.key];
        return (
          <View key={c.key} style={[styles.card, !row.bot && styles.cardOff]}>
            <Body style={{ fontWeight: '700' }}>{c.label}</Body>
            <View style={styles.row}>
              <Caption style={{ flex: 1 }}>Bot responde</Caption>
              <Switch value={row.bot} onValueChange={(v) => patch(c.key, { bot: v })} />
            </View>
            <View style={styles.row}>
              <Caption style={{ flex: 1 }}>Ventas y catálogo</Caption>
              <Switch
                value={row.catalog}
                disabled={!row.bot}
                onValueChange={(v) => patch(c.key, { catalog: v })}
              />
            </View>
            <Caption color={theme.color.text.muted}>
              {!row.bot
                ? 'El bot no responde por aquí: los mensajes quedan para un asesor.'
                : row.catalog
                  ? 'Vende normalmente.'
                  : 'Atiende dudas y pedidos; las compras se derivan a las otras redes.'}
            </Caption>
            <TextInput
              style={styles.input}
              value={row.link ?? ''}
              onChangeText={(t) => patch(c.key, { link: t })}
              placeholder={defaults[c.key] ?? c.placeholder}
              placeholderTextColor={theme.color.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {linkMissing ? (
              <Caption color={theme.color.text.danger}>
                Sin link: no se ofrecerá como botón desde las otras redes.
              </Caption>
            ) : null}
          </View>
        );
      })}
      {selling.length === 0 ? (
        <Caption color={theme.color.text.danger}>
          Ninguna red está vendiendo: a quien quiera comprar se le enviará el aviso de campaña.
        </Caption>
      ) : null}
      <View style={styles.actionsRow}>
        <Button
          title="Guardar"
          onPress={save}
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
    row: {
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
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
  });
