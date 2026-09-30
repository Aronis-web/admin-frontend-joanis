import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface TransfersHeaderProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  stat?: { value: number | string; label: string };
  /** Contenido a la derecha del título (p. ej. badge de estado); reemplaza a `stat`. */
  right?: React.ReactNode;
  /** Si se pasa, muestra botón atrás en lugar del icono (pantallas de detalle). */
  onBack?: () => void;
  /** Buscador dentro del degradado (mismo estilo que Inventario). */
  search?: {
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
  };
}

/**
 * Cabecera con degradado del módulo de traslados y recepciones.
 * Mismo diseño que la cabecera de Campañas.
 */
export const TransfersHeader: React.FC<TransfersHeaderProps> = ({
  icon,
  title,
  subtitle,
  stat,
  right,
  onBack,
  search,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <LinearGradient
      colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.headerGradient}
    >
      <View style={styles.headerTop}>
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerIconRow}>
            {onBack ? (
              <TouchableOpacity style={styles.headerIconContainer} onPress={onBack}>
                <Ionicons name="arrow-back" size={22} color={theme.color.brand.onHeader} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerIconContainer}>
                <Ionicons name={icon} size={22} color={theme.color.brand.onHeader} />
              </View>
            )}
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
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
            <TouchableOpacity onPress={() => search.onChangeText('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={theme.color.icon.subtle} />
            </TouchableOpacity>
          )}
        </View>
      )}
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
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
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
