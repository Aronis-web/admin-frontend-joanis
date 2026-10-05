/**
 * GradientHeader
 *
 * Cabecera estándar de las pantallas del admin (diseño de Campañas/Finanzas):
 * degradado de marca, icono o botón "volver", título, subtítulo, una cifra o
 * contenido a la derecha y, opcionalmente, un buscador o filtros dentro del
 * degradado. Los textos usan `brand.onHeader`, legibles en tema claro y oscuro.
 *
 * El contenido interno se centra con el mismo ancho máximo que
 * `ContentContainer`, así el título queda alineado con el cuerpo en escritorio.
 */
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { CONTENT_MAX_WIDTH } from './ContentContainer';

export interface GradientHeaderProps {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  stat?: { value: number | string; label: string };
  /** Contenido a la derecha del título (acciones, badge); reemplaza a `stat`. */
  right?: React.ReactNode;
  /** Muestra el botón "volver" en lugar del icono (pantallas de detalle/formulario). */
  onBack?: () => void;
  /** Buscador dentro del degradado. */
  search?: {
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
  };
  /** Contenido extra bajo el título, dentro del degradado (filtros, chips). */
  children?: React.ReactNode;
}

export const GradientHeader: React.FC<GradientHeaderProps> = ({
  icon,
  title,
  subtitle,
  stat,
  right,
  onBack,
  search,
  children,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const hasLead = !!onBack || !!icon;

  return (
    <LinearGradient
      colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.headerGradient}
    >
      <View style={styles.inner}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerIconRow}>
              {onBack ? (
                <TouchableOpacity
                  style={styles.headerIconContainer}
                  onPress={onBack}
                  accessibilityRole="button"
                  accessibilityLabel="Volver"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="arrow-back" size={22} color={theme.color.brand.onHeader} />
                </TouchableOpacity>
              ) : icon ? (
                <View style={styles.headerIconContainer}>
                  <Ionicons name={icon} size={22} color={theme.color.brand.onHeader} />
                </View>
              ) : null}
              <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
            </View>
            {subtitle ? (
              <Text
                style={[styles.headerSubtitle, hasLead && styles.subtitleIndented]}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          {right}
          {!right && stat && (
            <View style={styles.statHeaderItem}>
              <Text style={styles.statHeaderValue}>{stat.value}</Text>
              <Text style={styles.statHeaderLabel}>{stat.label}</Text>
            </View>
          )}
        </View>

        {search && (
          <View style={styles.searchInputContainer}>
            <Ionicons
              name="search"
              size={20}
              color={theme.color.icon.subtle}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              value={search.value}
              onChangeText={search.onChangeText}
              placeholder={search.placeholder}
              placeholderTextColor={theme.color.text.placeholder}
            />
            {search.value.length > 0 && (
              <TouchableOpacity
                onPress={() => search.onChangeText('')}
                style={styles.clearButton}
                accessibilityLabel="Limpiar búsqueda"
              >
                <Ionicons name="close-circle" size={20} color={theme.color.icon.subtle} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {children}
      </View>
    </LinearGradient>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    headerGradient: {
      paddingHorizontal: theme.space[5],
      paddingTop: theme.space[4],
      paddingBottom: theme.space[4],
    },
    inner: {
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.space[3],
    },
    headerTitleContainer: {
      flex: 1,
    },
    headerIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[1],
    },
    headerIconContainer: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.brand.headerBadge,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    headerTitle: {
      flexShrink: 1,
      fontSize: 24,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
      letterSpacing: 0.3,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
    },
    subtitleIndented: {
      marginLeft: theme.space[12],
    },
    statHeaderItem: {
      alignItems: 'center',
      backgroundColor: theme.color.brand.headerBadge,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.lg,
    },
    statHeaderValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.brand.onHeader,
    },
    statHeaderLabel: {
      fontSize: 11,
      color: theme.color.brand.onHeaderMuted,
      fontWeight: '500',
      textTransform: 'uppercase',
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.space[4],
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      paddingHorizontal: theme.space[3],
    },
    searchIcon: {
      marginRight: theme.space[2],
    },
    searchInput: {
      flex: 1,
      paddingVertical: theme.space[3],
      fontSize: 15,
      color: theme.color.text.body,
    },
    clearButton: {
      padding: theme.space[1],
    },
  });

export default GradientHeader;
