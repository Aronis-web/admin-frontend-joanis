/**
 * ThemePlaygroundScreen
 *
 * Pantalla de prueba del sistema de temas. Permite cambiar el modo
 * (light/dark/system) y forzar un tema concreto, y previsualiza los tokens
 * semanticos: acciones, estados, texto, superficies y chart.
 */

import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  themes,
  useThemeValue,
  useThemeActions,
  useThemedStyles,
  type Theme,
  type ThemeMode,
  type ThemeName,
} from '@/design-system';

const MODES: ThemeMode[] = ['light', 'dark', 'system'];
const THEME_NAMES = Object.keys(themes) as ThemeName[];

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.color.background.canvas },
    container: { padding: theme.space[4], gap: theme.space[6] },
    section: { gap: theme.space[2] },
    sectionTitle: { ...theme.text.titleMedium, color: theme.color.text.heading },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] },
    chip: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    chipActive: {
      backgroundColor: theme.color.action.primary.background,
      borderColor: theme.color.action.primary.border,
    },
    chipText: { ...theme.text.bodySmall, color: theme.color.text.body },
    chipTextActive: { color: theme.color.action.primary.text },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.semantic.card,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      padding: theme.space[4],
      gap: theme.space[2],
    },
    actionButton: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.semantic.button,
      borderWidth: 1,
      alignItems: 'center',
    },
    badge: {
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[0.5],
      borderRadius: theme.radii.full,
      borderWidth: 1,
    },
    badgeText: { ...theme.text.caption },
    swatch: {
      width: 48,
      height: 48,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    swatchLabel: { ...theme.text.caption, color: theme.color.text.muted },
    swatchItem: { alignItems: 'center', gap: theme.space[1], width: 64 },
  });

const SURFACE_KEYS = ['canvas', 'subtle', 'muted', 'elevated'] as const;
type SurfaceKey = (typeof SURFACE_KEYS)[number];

export const ThemePlaygroundScreen: React.FC = () => {
  const { theme, themeName, mode } = useThemeValue();
  const { setMode, setThemeOverride } = useThemeActions();
  const styles = useThemedStyles(createStyles);

  const actionKeys = Object.keys(theme.color.action) as Array<keyof typeof theme.color.action>;
  const stateKeys = Object.keys(theme.color.state) as Array<keyof typeof theme.color.state>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Modo ({mode})</Text>
          <View style={styles.row}>
            {MODES.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, mode === m && styles.chipActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.chipText, mode === m && styles.chipTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tema activo: {themeName}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.chip} onPress={() => setThemeOverride(null)}>
              <Text style={styles.chipText}>auto (segun modo)</Text>
            </TouchableOpacity>
            {THEME_NAMES.map((name) => (
              <TouchableOpacity
                key={name}
                style={[styles.chip, themeName === name && styles.chipActive]}
                onPress={() => setThemeOverride(name)}
              >
                <Text style={[styles.chipText, themeName === name && styles.chipTextActive]}>
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acciones</Text>
          <View style={styles.row}>
            {actionKeys.map((key) => {
              const a = theme.color.action[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.actionButton, { backgroundColor: a.background, borderColor: a.border }]}
                >
                  <Text style={{ ...theme.text.buttonMedium, color: a.text }}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estados</Text>
          <View style={styles.row}>
            {stateKeys.map((key) => {
              const s = theme.color.state[key];
              return (
                <View
                  key={key}
                  style={[styles.badge, { backgroundColor: s.background, borderColor: s.border }]}
                >
                  <Text style={[styles.badgeText, { color: s.text }]}>{key}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Texto</Text>
          <View style={styles.card}>
            <Text style={{ ...theme.text.headingLarge, color: theme.color.text.heading }}>
              Heading large
            </Text>
            <Text style={{ ...theme.text.headingSmall, color: theme.color.text.heading }}>
              Heading small
            </Text>
            <Text style={{ ...theme.text.bodyMedium, color: theme.color.text.body }}>Body</Text>
            <Text style={{ ...theme.text.bodySmall, color: theme.color.text.muted }}>Muted</Text>
            <Text style={{ ...theme.text.caption, color: theme.color.text.subtle }}>Subtle</Text>
            <Text style={{ ...theme.text.bodyMedium, color: theme.color.text.link }}>Link</Text>
            <Text style={{ ...theme.text.bodyMedium, color: theme.color.text.danger }}>Danger</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Superficies y chart</Text>
          <View style={styles.row}>
            {SURFACE_KEYS.map((key: SurfaceKey) => (
              <View key={key} style={styles.swatchItem}>
                <View style={[styles.swatch, { backgroundColor: theme.color.background[key] }]} />
                <Text style={styles.swatchLabel}>{key}</Text>
              </View>
            ))}
            {theme.color.chart.categorical.map((c, idx) => (
              <View key={`${c}-${idx}`} style={styles.swatchItem}>
                <View style={[styles.swatch, { backgroundColor: c }]} />
                <Text style={styles.swatchLabel}>cat{idx + 1}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ThemePlaygroundScreen;
