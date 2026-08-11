/**
 * DriveNodeActionSheet
 *
 * Bottom-sheet nativo cross-platform que muestra las acciones disponibles
 * sobre un nodo del Drive (abrir, renombrar, mover, copiar, papelera, etc.).
 * Reemplaza al Alert.alert original para tener más acciones y mejor UI.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/design-system/components';
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import type { DriveNode } from '@/types/drive';

export type NodeActionId =
  | 'open'
  | 'download'
  | 'rename'
  | 'move'
  | 'copy'
  | 'share'
  | 'trash'
  | 'restore'
  | 'delete-forever';

interface Props {
  visible: boolean;
  node: DriveNode | null;
  actions: NodeActionId[];
  onSelect: (action: NodeActionId, node: DriveNode) => void;
  onClose: () => void;
}

const ACTION_META: Record<
  NodeActionId,
  { label: string; icon: keyof typeof Ionicons.glyphMap; destructive?: boolean }
> = {
  open: { label: 'Abrir', icon: 'open-outline' },
  download: { label: 'Descargar', icon: 'download-outline' },
  rename: { label: 'Renombrar', icon: 'create-outline' },
  move: { label: 'Mover a...', icon: 'move-outline' },
  copy: { label: 'Copiar a...', icon: 'copy-outline' },
  share: { label: 'Compartir', icon: 'person-add-outline' },
  trash: { label: 'Enviar a papelera', icon: 'trash-outline', destructive: true },
  restore: { label: 'Restaurar', icon: 'arrow-undo-outline' },
  'delete-forever': { label: 'Borrar definitivo', icon: 'skull-outline', destructive: true },
};

export const DriveNodeActionSheet: React.FC<Props> = ({
  visible,
  node,
  actions,
  onSelect,
  onClose,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!node) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Ionicons
              name={node.kind === 'folder' ? 'folder' : 'document-outline'}
              size={iconSizes.md}
              color={node.kind === 'folder' ? '#F59E0B' : theme.color.icon.default}
            />
            <Text variant="bodyMedium" numberOfLines={1} style={styles.headerText}>
              {node.name}
            </Text>
          </View>
          <View style={styles.list}>
            {actions.map((id) => {
              const meta = ACTION_META[id];
              const tint = meta.destructive ? theme.color.state.danger.text : theme.color.text.body;
              return (
                <TouchableOpacity
                  key={id}
                  style={styles.row}
                  onPress={() => {
                    onSelect(id, node);
                    onClose();
                  }}
                  activeOpacity={activeOpacity.medium}
                  accessibilityLabel={meta.label}
                >
                  <Ionicons name={meta.icon} size={iconSizes.md} color={tint} />
                  <Text variant="bodyMedium" style={[styles.rowText, { color: tint }]}>
                    {meta.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: theme.radii.xl,
      borderTopRightRadius: theme.radii.xl,
      paddingBottom: theme.space[6],
      paddingTop: theme.space[2],
      ...theme.shadow.lg,
    },
    grabber: {
      width: 44,
      height: 4,
      backgroundColor: theme.color.border.subtle,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: theme.space[2],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.subtle,
    },
    headerText: { flex: 1 },
    list: {
      paddingVertical: theme.space[2],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[3],
    },
    rowText: {
      flex: 1,
    },
  });

export default DriveNodeActionSheet;
