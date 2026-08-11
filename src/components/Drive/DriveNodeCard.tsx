/**
 * DriveNodeCard
 *
 * Tarjeta grande (grid) para representar carpetas y archivos del Drive.
 * Estilo tipo Google Drive: icono grande centrado, nombre y metadatos abajo,
 * botón contextual "..." en la esquina superior derecha.
 */

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/design-system/components';
import { activeOpacity } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import type { DriveNode } from '@/types/drive';
import { toBytesNumber } from '@/types/drive';

interface Props {
  node: DriveNode;
  onOpen: (node: DriveNode) => void;
  onMore?: (node: DriveNode) => void;
  /** Ancho fijo de la tarjeta (definido por el grid contenedor). */
  width: number;
}

const iconForMime = (
  kind: DriveNode['kind'],
  mime: string | null,
  name: string
): { name: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; color: string } => {
  if (kind === 'folder') return { name: 'folder', color: '#F59E0B' };
  const m = (mime || '').toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith('image/')) return { name: 'image', color: '#10B981' };
  if (m.startsWith('video/')) return { name: 'film', color: '#8B5CF6' };
  if (m.startsWith('audio/')) return { name: 'musical-notes', color: '#EC4899' };
  if (m === 'application/pdf' || n.endsWith('.pdf'))
    return { name: 'document-text', color: '#EF4444' };
  if (
    m.includes('spreadsheet') ||
    m.includes('excel') ||
    n.endsWith('.xlsx') ||
    n.endsWith('.xls') ||
    n.endsWith('.csv') ||
    m === 'text/csv'
  )
    return { name: 'grid', color: '#059669' };
  if (m.includes('word') || n.endsWith('.docx') || n.endsWith('.doc'))
    return { name: 'document', color: '#2563EB' };
  if (m.includes('zip') || m.includes('rar') || m.includes('compressed'))
    return { name: 'archive', color: '#6B7280' };
  if (m.startsWith('text/') || m.includes('json') || m.includes('xml'))
    return { name: 'code-slash', color: '#0EA5E9' };
  return { name: 'document-outline', color: '#6B7280' };
};

const humanBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const DriveNodeCard: React.FC<Props> = ({ node, onOpen, onMore, width }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const icon = iconForMime(node.kind, node.mimeType, node.name);
  const size = toBytesNumber(node.sizeBytes);
  const isFolder = node.kind === 'folder';
  const iconBoxSize = Math.max(48, Math.round(width * 0.42));

  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={() => onOpen(node)}
      activeOpacity={activeOpacity.medium}
      accessibilityLabel={node.name}
    >
      {onMore && (
        <TouchableOpacity
          onPress={() => onMore(node)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.moreBtn}
          accessibilityLabel="Más opciones"
        >
          <Ionicons name="ellipsis-vertical" size={18} color={theme.color.icon.muted} />
        </TouchableOpacity>
      )}
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: `${icon.color}18`,
            width: iconBoxSize,
            height: iconBoxSize,
            borderRadius: theme.radii.xl,
          },
        ]}
      >
        <Ionicons name={icon.name} size={Math.round(iconBoxSize * 0.55)} color={icon.color} />
      </View>
      <View style={styles.info}>
        <Text variant="bodyMedium" numberOfLines={2} align="center">
          {node.name}
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={1} align="center">
          {isFolder ? 'Carpeta' : humanBytes(size)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      justifyContent: 'flex-start',
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
    info: {
      alignItems: 'center',
      gap: 2,
      width: '100%',
    },
    moreBtn: {
      position: 'absolute',
      top: 6,
      right: 6,
      padding: 4,
      zIndex: 2,
    },
  });

export default DriveNodeCard;
