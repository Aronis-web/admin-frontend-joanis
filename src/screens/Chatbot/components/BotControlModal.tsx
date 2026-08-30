import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Body, Button, Caption, Title, useTheme, useThemedStyles } from '@/design-system';
import type { BadgeVariant } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useBotStatus, useToggleBot } from '@/hooks/api/useChatbotSession';
import { useBotSettings, useUpdateBotSettings } from '@/hooks/api/useChatbotSettings';
import type { BotEmojiLevel, BotFaqRule, UpdateBotSettingsBody } from '@/types/chatbot';
import Alert from '@/utils/alert';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Tab = 'estado' | 'personalidad' | 'faq';

/** Fila editable de FAQ en el UI (usa string CSV de keywords). */
interface FaqRow {
  keywordsRaw: string;
  reply: string;
}

const toFaqRows = (rules: BotFaqRule[] | undefined): FaqRow[] =>
  (rules ?? []).map((r) => ({ keywordsRaw: (r.keywords ?? []).join(', '), reply: r.reply ?? '' }));

const fromFaqRows = (rows: FaqRow[]): BotFaqRule[] =>
  rows
    .map((r) => ({
      keywords: r.keywordsRaw
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
      reply: r.reply.trim(),
    }))
    .filter((r) => r.keywords.length > 0 && r.reply.length > 0);

const EMOJI_LEVELS: BotEmojiLevel[] = ['none', 'low', 'high'];
const EMOJI_LABEL: Record<BotEmojiLevel, string> = {
  none: 'Sin emojis',
  low: 'Pocos',
  high: 'Muchos',
};

/**
 * Modal para prender/apagar la respuesta automática del bot y editar su
 * configuración (personalidad + FAQ por palabras clave).
 *
 * Endpoints:
 * - GET  /chatbot/bot/status
 * - POST /chatbot/bot/toggle   { active }
 * - GET  /chatbot/settings
 * - PUT  /chatbot/settings     { botName, persona, tone, customInstructions,
 *                                emojiLevel, maxLines, faqKeywords, isActive }
 */
export const BotControlModal: React.FC<Props> = ({ visible, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [tab, setTab] = useState<Tab>('estado');

  // ---------- Estado on/off ----------
  const statusQuery = useBotStatus({ enabled: visible });
  const toggleMutation = useToggleBot();
  const active = statusQuery.data?.active ?? false;
  const scanning = statusQuery.data?.scanning ?? false;
  const wa = statusQuery.data?.whatsapp;

  const tone: BadgeVariant = active ? 'success' : 'danger';
  const statusLabel = active ? 'Activo' : 'Pausado';

  const handleToggle = (next: boolean) => {
    if (!next) {
      Alert.alert(
        'Pausar bot',
        'El bot dejará de responder mensajes y de consumir tokens. Los pedidos ya en curso no se afectan.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Pausar',
            style: 'destructive',
            onPress: () =>
              toggleMutation.mutate(false, {
                onError: (err: any) =>
                  Alert.alert('Error', err?.message ?? 'No se pudo pausar el bot'),
              }),
          },
        ]
      );
      return;
    }
    toggleMutation.mutate(true, {
      onError: (err: any) => Alert.alert('Error', err?.message ?? 'No se pudo activar el bot'),
    });
  };

  // ---------- Configuración ----------
  const settingsQuery = useBotSettings({ enabled: visible });
  const updateMutation = useUpdateBotSettings();

  const [botName, setBotName] = useState('');
  const [persona, setPersona] = useState('');
  const [toneText, setToneText] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [emojiLevel, setEmojiLevel] = useState<BotEmojiLevel>('low');
  const [maxLines, setMaxLines] = useState('3');
  const [faq, setFaq] = useState<FaqRow[]>([]);

  // Rehidrata el formulario cuando llegan settings del backend.
  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setBotName(s.botName ?? '');
    setPersona(s.persona ?? '');
    setToneText(s.tone ?? '');
    setCustomInstructions(s.customInstructions ?? '');
    setEmojiLevel(s.emojiLevel ?? 'low');
    setMaxLines(String(s.maxLines ?? 3));
    setFaq(toFaqRows(s.faqKeywords));
  }, [settingsQuery.data]);

  const dirty = useMemo(() => {
    const s = settingsQuery.data;
    if (!s) return false;
    return (
      (s.botName ?? '') !== botName ||
      (s.persona ?? '') !== persona ||
      (s.tone ?? '') !== toneText ||
      (s.customInstructions ?? '') !== customInstructions ||
      s.emojiLevel !== emojiLevel ||
      String(s.maxLines ?? 3) !== maxLines ||
      JSON.stringify(s.faqKeywords ?? []) !== JSON.stringify(fromFaqRows(faq))
    );
  }, [
    settingsQuery.data,
    botName,
    persona,
    toneText,
    customInstructions,
    emojiLevel,
    maxLines,
    faq,
  ]);

  const handleSaveSettings = () => {
    const parsedMax = Number.parseInt(maxLines, 10);
    const body: UpdateBotSettingsBody = {
      botName: botName.trim() || null,
      persona: persona.trim() || null,
      tone: toneText.trim() || null,
      customInstructions: customInstructions.trim() || null,
      emojiLevel,
      maxLines: Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 3,
      faqKeywords: fromFaqRows(faq),
    };
    updateMutation.mutate(body, {
      onError: (err: any) =>
        Alert.alert('Error', err?.message ?? 'No se pudo guardar la configuración'),
    });
  };

  const addFaqRow = () => setFaq((prev) => [...prev, { keywordsRaw: '', reply: '' }]);
  const updateFaqRow = (idx: number, patch: Partial<FaqRow>) =>
    setFaq((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const removeFaqRow = (idx: number) => setFaq((prev) => prev.filter((_, i) => i !== idx));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons
                  name={active ? 'sparkles' : 'pause-circle-outline'}
                  size={22}
                  color={active ? '#10B981' : theme.color.text.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Title>Bot de ventas</Title>
                <Caption color={theme.color.text.muted}>
                  Encendido/apagado global y configuración
                </Caption>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.color.text.muted} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['estado', 'personalidad', 'faq'] as Tab[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tab, tab === t && styles.tabActive]}
              >
                <Caption
                  color={tab === t ? theme.color.text.heading : theme.color.text.muted}
                  style={tab === t ? styles.tabTextActive : undefined}
                >
                  {t === 'estado' ? 'Estado' : t === 'personalidad' ? 'Personalidad' : 'FAQ'}
                </Caption>
              </Pressable>
            ))}
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {tab === 'estado' ? (
              <View style={{ gap: spacing[3] }}>
                <View style={styles.statusRow}>
                  <Badge variant={tone} label={statusLabel} />
                  {scanning ? <Badge variant="info" label="Procesando" /> : null}
                  {statusQuery.isFetching ? (
                    <ActivityIndicator size="small" color={theme.color.text.muted} />
                  ) : null}
                </View>
                <View style={styles.stateBox}>
                  <Ionicons
                    name={active ? 'chatbubbles' : 'chatbubbles-outline'}
                    size={32}
                    color={active ? '#10B981' : theme.color.text.muted}
                  />
                  <Body color={active ? theme.color.text.body : theme.color.text.muted}>
                    {active
                      ? 'El bot está respondiendo automáticamente a los clientes.'
                      : 'El bot está pausado. Los mensajes entrantes NO reciben respuesta automática.'}
                  </Body>
                  {wa ? (
                    <Caption color={theme.color.text.muted}>
                      WhatsApp: {wa.status}
                      {wa.me ? ` · ${wa.me}` : ''}
                    </Caption>
                  ) : null}
                </View>
                <View style={styles.actionsRow}>
                  {active ? (
                    <Button
                      title="Pausar bot"
                      variant="outline"
                      onPress={() => handleToggle(false)}
                      loading={toggleMutation.isPending}
                      leftIcon="pause"
                    />
                  ) : (
                    <Button
                      title="Activar bot"
                      onPress={() => handleToggle(true)}
                      loading={toggleMutation.isPending}
                      leftIcon="play"
                    />
                  )}
                </View>
              </View>
            ) : tab === 'personalidad' ? (
              <View style={{ gap: spacing[3] }}>
                {settingsQuery.isLoading ? (
                  <ActivityIndicator color={theme.color.text.muted} />
                ) : null}

                <Field label="Nombre del bot" hint="Cómo se presenta al cliente.">
                  <TextInput
                    style={styles.input}
                    value={botName}
                    onChangeText={setBotName}
                    placeholder="Ej. Rosa"
                    placeholderTextColor={theme.color.text.muted}
                  />
                </Field>

                <Field label="Personalidad" hint="Descripción del rol/estilo.">
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    value={persona}
                    onChangeText={setPersona}
                    placeholder="Ej. Vendedora cercana y rápida de la distribuidora"
                    placeholderTextColor={theme.color.text.muted}
                    multiline
                  />
                </Field>

                <Field label="Tono / vocabulario">
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    value={toneText}
                    onChangeText={setToneText}
                    placeholder="Ej. Tutea, usa 'casero/a', evita tecnicismos"
                    placeholderTextColor={theme.color.text.muted}
                    multiline
                  />
                </Field>

                <Field label="Instrucciones (Do/Don't)">
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    value={customInstructions}
                    onChangeText={setCustomInstructions}
                    placeholder="Ej. Nunca discutas precio; ofrece el combo."
                    placeholderTextColor={theme.color.text.muted}
                    multiline
                  />
                </Field>

                <Field label="Uso de emojis">
                  <View style={styles.chipsRow}>
                    {EMOJI_LEVELS.map((lvl) => (
                      <Pressable
                        key={lvl}
                        onPress={() => setEmojiLevel(lvl)}
                        style={[styles.chip, emojiLevel === lvl && styles.chipActive]}
                      >
                        <Caption
                          color={
                            emojiLevel === lvl ? theme.color.text.heading : theme.color.text.muted
                          }
                        >
                          {EMOJI_LABEL[lvl]}
                        </Caption>
                      </Pressable>
                    ))}
                  </View>
                </Field>

                <Field label="Líneas máximas por respuesta">
                  <TextInput
                    style={styles.input}
                    value={maxLines}
                    onChangeText={(t) => setMaxLines(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder="3"
                    placeholderTextColor={theme.color.text.muted}
                  />
                </Field>

                <View style={styles.actionsRow}>
                  <Button
                    title="Guardar configuración"
                    onPress={handleSaveSettings}
                    disabled={!dirty}
                    loading={updateMutation.isPending}
                    leftIcon="save-outline"
                  />
                </View>
              </View>
            ) : (
              <View style={{ gap: spacing[3] }}>
                <Caption color={theme.color.text.muted}>
                  Respuestas exactas por palabras clave. Si el mensaje del cliente contiene alguna
                  keyword (sin tildes, sin distinguir mayúsculas), el bot responde el texto sin
                  llamar al modelo.
                </Caption>

                {faq.length === 0 ? (
                  <View style={styles.emptyFaq}>
                    <Ionicons name="help-buoy-outline" size={24} color={theme.color.text.muted} />
                    <Caption color={theme.color.text.muted}>Sin reglas configuradas</Caption>
                  </View>
                ) : (
                  faq.map((row, idx) => (
                    <View key={idx} style={styles.faqCard}>
                      <View style={styles.faqCardHeader}>
                        <Caption color={theme.color.text.muted}>Regla #{idx + 1}</Caption>
                        <Pressable onPress={() => removeFaqRow(idx)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={16} color={theme.color.text.muted} />
                        </Pressable>
                      </View>
                      <TextInput
                        style={styles.input}
                        value={row.keywordsRaw}
                        onChangeText={(t) => updateFaqRow(idx, { keywordsRaw: t })}
                        placeholder="Keywords separadas por coma (horario, atienden)"
                        placeholderTextColor={theme.color.text.muted}
                      />
                      <TextInput
                        style={[styles.input, styles.inputMulti]}
                        value={row.reply}
                        onChangeText={(t) => updateFaqRow(idx, { reply: t })}
                        placeholder="Respuesta exacta"
                        placeholderTextColor={theme.color.text.muted}
                        multiline
                      />
                    </View>
                  ))
                )}

                <View style={styles.actionsRow}>
                  <Button
                    title="Agregar regla"
                    variant="outline"
                    onPress={addFaqRow}
                    leftIcon="add"
                  />
                  <Button
                    title="Guardar FAQ"
                    onPress={handleSaveSettings}
                    disabled={!dirty}
                    loading={updateMutation.isPending}
                    leftIcon="save-outline"
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.field}>
      <Caption color={theme.color.text.heading} style={styles.fieldLabel}>
        {label}
      </Caption>
      {hint ? <Caption color={theme.color.text.muted}>{hint}</Caption> : null}
      {children}
    </View>
  );
};

// Silencia unused import cuando el DS no expone Switch por default aún.
void Switch;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing[4],
    },
    card: {
      width: '100%',
      maxWidth: 560,
      maxHeight: '90%',
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[5],
      gap: spacing[3],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing[3],
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: spacing[3],
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.lg,
      backgroundColor: theme.color.background.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabs: {
      flexDirection: 'row',
      gap: spacing[1],
      padding: spacing[1],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.lg,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing[2],
      borderRadius: borderRadius.md,
    },
    tabActive: {
      backgroundColor: theme.color.surface.base,
    },
    tabTextActive: {
      fontWeight: '600',
    },
    scroll: {
      maxHeight: 480,
    },
    scrollContent: {
      paddingVertical: spacing[2],
      gap: spacing[3],
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      flexWrap: 'wrap',
    },
    stateBox: {
      alignItems: 'center',
      gap: spacing[2],
      padding: spacing[4],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.lg,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
    field: {
      gap: spacing[1],
    },
    fieldLabel: {
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
    inputMulti: {
      minHeight: 72,
      textAlignVertical: 'top',
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
      backgroundColor: theme.color.background.subtle,
    },
    chipActive: {
      backgroundColor: theme.color.brand.accent + '30',
    },
    emptyFaq: {
      alignItems: 'center',
      gap: spacing[1],
      padding: spacing[4],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.lg,
    },
    faqCard: {
      gap: spacing[2],
      padding: spacing[3],
      backgroundColor: theme.color.background.subtle,
      borderRadius: borderRadius.lg,
    },
    faqCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });
