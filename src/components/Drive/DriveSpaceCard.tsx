/**
 * DriveSpaceCard
 *
 * Tarjeta para representar un espacio (personal o compartido) en la vista
 * "Espacios". Muestra icono grande, nombre, uso vs cuota y una barra
 * de progreso compacta.
 */

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/design-system/components';
import { activeOpacity } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import type { DriveSpace } from '@/types/drive';
import { toBytesNumber } from '@/types/drive';

interface Props {
  space: DriveSpace;
  onOpen: (space: DriveSpace) => void;
  onMore?: (space: DriveSpace) => void;
  width: number;
}

const humanBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const DriveSpaceCard: React.FC<Props> = ({ space, onOpen, onMore, width }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const used = toBytesNumber(space.usedBytes);
  const quota = toBytesNumber(space.quotaBytes);
  const ratio = quota > 0 ? Math.min(1, used / quota) : 0;

  const barColor =
    ratio > 0.95
      ? theme.color.state.danger.text
      : ratio > 0.8
        ? theme.color.state.warning.text
        : theme.color.brand.primary;

  const iconBoxSize = Math.max(48, Math.round(width * 0.38));

  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={() => onOpen(space)}
      activeOpacity={activeOpacity.medium}
    >
      {onMore && (
        <TouchableOpacity
          onPress={() => onMore(space)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.moreBtn}
          accessibilityLabel="Más opciones del espacio"
        >
          <Ionicons name="ellipsis-vertical" size={18} color={theme.color.icon.muted} />
        </TouchableOpacity>
      )}
      <View
        style={[
          styles.iconWrap,
          {
            width: iconBoxSize,
            height: iconBoxSize,
            borderRadius: theme.radii.xl,
            backgroundColor: `${theme.color.brand.primary}18`,
          },
        ]}
      >
        <Ionicons
          name={space.type === 'personal' ? 'cloud' : 'people'}
          size={Math.round(iconBoxSize * 0.55)}
          color={theme.color.brand.primary}
        />
      </View>
      <View style={styles.info}>
        <Text variant="bodyMedium" numberOfLines={2} align="center">
          {space.name}
        </Text>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.round(ratio * 100)}%`, backgroundColor: barColor },
            ]}
          />
        </View>
        <Text variant="caption" color="secondary" align="center" numberOfLines={1}>
          {humanBytes(used)} / {humanBytes(quota)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      paddingVertical: theme.space[4],
      paddingHorizontal: theme.space[2],
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.base,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border.subtle,
      gap: theme.space[2],
      minHeight: 160,
    },
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreBtn: {
      position: 'absolute',
      top: 6,
      right: 6,
      padding: 4,
      zIndex: 2,
    },
    info: {
      alignItems: 'center',
      gap: 4,
      width: '100%',
      paddingHorizontal: theme.space[2],
    },
    barTrack: {
      width: '100%',
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
      backgroundColor: theme.color.surface.muted,
      marginTop: 2,
    },
    barFill: {
      height: '100%',
      borderRadius: 2,
    },
  });

export default DriveSpaceCard;
