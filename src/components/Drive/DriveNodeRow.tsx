import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/design-system/components';
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import type { DriveNode } from '@/types/drive';
import { toBytesNumber } from '@/types/drive';

interface Props {
  node: DriveNode;
  onOpen: (node: DriveNode) => void;
  onMore?: (node: DriveNode) => void;
}

const iconForMime = (
  kind: DriveNode['kind'],
  mime: string | null
): { name: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; color: string } => {
  if (kind === 'folder') return { name: 'folder', color: '#F59E0B' };
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return { name: 'image', color: '#10B981' };
  if (m.startsWith('video/')) return { name: 'film', color: '#8B5CF6' };
  if (m.startsWith('audio/')) return { name: 'musical-notes', color: '#EC4899' };
  if (m === 'application/pdf') return { name: 'document-text', color: '#EF4444' };
  if (m.includes('spreadsheet') || m.includes('excel') || m.endsWith('.csv') || m === 'text/csv')
    return { name: 'grid', color: '#059669' };
  if (m.includes('word') || m.includes('document')) return { name: 'document', color: '#2563EB' };
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

export const DriveNodeRow: React.FC<Props> = ({ node, onOpen, onMore }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const icon = iconForMime(node.kind, node.mimeType);
  const size = toBytesNumber(node.sizeBytes);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onOpen(node)}
      activeOpacity={activeOpacity.medium}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${icon.color}18` }]}>
        <Ionicons name={icon.name} size={iconSizes.md} color={icon.color} />
      </View>
      <View style={styles.info}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {node.name}
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={1}>
          {node.kind === 'folder' ? 'Carpeta' : humanBytes(size)}
        </Text>
      </View>
      {onMore && (
        <TouchableOpacity
          onPress={() => onMore(node)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.moreBtn}
          accessibilityLabel="Más opciones"
        >
          <Ionicons name="ellipsis-vertical" size={iconSizes.md} color={theme.color.icon.muted} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    moreBtn: {
      padding: theme.space[1],
    },
  });

export default DriveNodeRow;
