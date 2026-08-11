import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

/**
 * Modelo interno de filtros de búsqueda de correo.
 * Se serializa a un string `q` con operadores que entiende el backend
 * (`/webmail/search?q=`).
 */
export interface WebmailSearchFilters {
  from: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  since: string;
  before: string;
  free: string;
  unread: boolean;
  read: boolean;
  starred: boolean;
  hasAttachment: boolean;
}

export const EMPTY_FILTERS: WebmailSearchFilters = {
  from: '',
  to: '',
  cc: '',
  subject: '',
  body: '',
  since: '',
  before: '',
  free: '',
  unread: false,
  read: false,
  starred: false,
  hasAttachment: false,
};

/**
 * Serializa el modelo de filtros al string `q` que espera el backend.
 * - Valores con espacios van entre comillas.
 * - Los flags (no-leidos, leidos, destacados) van sueltos, sin `:`.
 * - `con:adjunto` para adjuntos.
 * - El texto libre se agrega al final; si contiene espacios y no comillas
 *   ya, se envuelve en comillas para tratarlo como frase.
 */
export const buildQueryFromFilters = (f: WebmailSearchFilters): string => {
  const parts: string[] = [];
  const push = (op: string, value: string) => {
    const v = value.trim();
    if (!v) return;
    // Si el usuario ya escribió comillas, respetarlas. Si tiene espacios,
    // envolver. Si no, dejar tal cual.
    const alreadyQuoted = /^".*"$/.test(v);
    const needsQuotes = !alreadyQuoted && /\s/.test(v);
    parts.push(`${op}:${needsQuotes ? `"${v}"` : v}`);
  };
  push('de', f.from);
  push('para', f.to);
  push('cc', f.cc);
  push('asunto', f.subject);
  push('cuerpo', f.body);
  push('desde', f.since);
  push('hasta', f.before);
  if (f.hasAttachment) parts.push('con:adjunto');
  if (f.unread) parts.push('no-leidos');
  if (f.read) parts.push('leidos');
  if (f.starred) parts.push('destacados');

  const free = f.free.trim();
  if (free) {
    const alreadyQuoted = /^".*"$/.test(free);
    const hasOperator = /:/.test(free);
    if (!alreadyQuoted && !hasOperator && /\s/.test(free)) {
      parts.push(`"${free}"`);
    } else {
      parts.push(free);
    }
  }
  return parts.join(' ');
};

/**
 * Cuenta filtros activos (excluyendo texto libre) para mostrar badge.
 */
export const countActiveFilters = (f: WebmailSearchFilters): number => {
  let n = 0;
  if (f.from.trim()) n++;
  if (f.to.trim()) n++;
  if (f.cc.trim()) n++;
  if (f.subject.trim()) n++;
  if (f.body.trim()) n++;
  if (f.since.trim()) n++;
  if (f.before.trim()) n++;
  if (f.unread) n++;
  if (f.read) n++;
  if (f.starred) n++;
  if (f.hasAttachment) n++;
  return n;
};

interface Props {
  initial?: Partial<WebmailSearchFilters>;
  onApply: (filters: WebmailSearchFilters, query: string) => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Panel de filtros avanzados de correo. Renderizado inline debajo del
 * buscador — no es un modal.
 */
export const WebmailSearchFiltersPanel: React.FC<Props> = ({
  initial,
  onApply,
  onClear,
  onClose,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [filters, setFilters] = useState<WebmailSearchFilters>({
    ...EMPTY_FILTERS,
    ...initial,
  });

  const update = <K extends keyof WebmailSearchFilters>(key: K, value: WebmailSearchFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const preview = useMemo(() => buildQueryFromFilters(filters), [filters]);

  const handleApply = () => {
    onApply(filters, preview);
  };

  const handleClear = () => {
    setFilters(EMPTY_FILTERS);
    onClear();
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Filtros avanzados</Text>
        <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={theme.color.icon.default} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        <FilterField
          label="De"
          placeholder="juan@cliente.com"
          value={filters.from}
          onChangeText={(v) => update('from', v)}
        />
        <FilterField
          label="Para"
          placeholder="Destinatario"
          value={filters.to}
          onChangeText={(v) => update('to', v)}
        />
        <FilterField
          label="CC"
          placeholder="En copia"
          value={filters.cc}
          onChangeText={(v) => update('cc', v)}
        />
        <FilterField
          label="Asunto"
          placeholder="Contiene…"
          value={filters.subject}
          onChangeText={(v) => update('subject', v)}
        />
        <FilterField
          label="Cuerpo"
          placeholder="Contiene…"
          value={filters.body}
          onChangeText={(v) => update('body', v)}
        />
        <FilterField
          label="Desde"
          placeholder="2026-08-01, 7d, hoy…"
          value={filters.since}
          onChangeText={(v) => update('since', v)}
        />
        <FilterField
          label="Hasta"
          placeholder="2026-08-15, ayer…"
          value={filters.before}
          onChangeText={(v) => update('before', v)}
        />
        <FilterField
          label="Texto libre"
          placeholder='"nota de credito"'
          value={filters.free}
          onChangeText={(v) => update('free', v)}
        />
      </View>

      <View style={styles.toggles}>
        <ToggleChip
          label="No leídos"
          icon="mail-unread-outline"
          active={filters.unread}
          onPress={() => update('unread', !filters.unread)}
        />
        <ToggleChip
          label="Leídos"
          icon="mail-open-outline"
          active={filters.read}
          onPress={() => update('read', !filters.read)}
        />
        <ToggleChip
          label="Destacados"
          icon="star-outline"
          active={filters.starred}
          onPress={() => update('starred', !filters.starred)}
        />
        <ToggleChip
          label="Con adjunto"
          icon="attach-outline"
          active={filters.hasAttachment}
          onPress={() => update('hasAttachment', !filters.hasAttachment)}
        />
      </View>

      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Consulta:</Text>
          <Text style={styles.previewText} numberOfLines={2}>
            {preview}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button title="Limpiar" variant="ghost" size="small" onPress={handleClear} />
        <Button
          title="Aplicar filtros"
          leftIcon="search-outline"
          size="small"
          onPress={handleApply}
          disabled={!preview}
        />
      </View>
    </View>
  );
};

interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
}

const FilterField: React.FC<FieldProps> = ({ label, placeholder, value, onChangeText }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.text.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
};

interface ToggleChipProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}

const ToggleChip: React.FC<ToggleChipProps> = ({ label, icon, active, onPress }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Ionicons
        name={icon}
        size={14}
        color={active ? theme.color.text.onAction : theme.color.icon.muted}
      />
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    panel: {
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[3],
      gap: theme.space[3],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    closeBtn: {
      padding: 4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    field: {
      flexBasis: 220,
      flexGrow: 1,
      minWidth: 180,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    fieldInput: {
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[2],
      paddingVertical: Platform.OS === 'web' ? 6 : 8,
      fontSize: 13,
      color: theme.color.text.body,
      backgroundColor: theme.color.surface.subtle,
      outlineStyle: 'none' as any,
    },
    toggles: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.subtle,
    },
    chipActive: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    chipLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    chipLabelActive: {
      color: theme.color.text.onAction,
    },
    preview: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[2],
      gap: 4,
    },
    previewLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.color.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    previewText: {
      fontSize: 12,
      color: theme.color.text.body,
      fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[2],
    },
  });

export default WebmailSearchFiltersPanel;
