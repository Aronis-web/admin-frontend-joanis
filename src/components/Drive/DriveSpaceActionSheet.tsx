/**
 * DriveSpaceActionSheet
 *
 * Bottom-sheet con las acciones disponibles sobre un espacio compartido:
 * gestionar miembros (compartir), renombrar y eliminar.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/design-system/components';
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import type { DriveSpace } from '@/types/drive';

export type SpaceActionId = 'members' | 'rename' | 'delete';

interface Props {
  visible: boolean;
  space: DriveSpace | null;
  actions: SpaceActionId[];
  onSelect: (action: SpaceActionId, space: DriveSpace) => void;
  onClose: () => void;
}

const ACTION_META: Record<
  SpaceActionId,
  { label: string; icon: keyof typeof Ionicons.glyphMap; destructive?: boolean }
> = {
  members: { label: 'Miembros y acceso', icon: 'people-outline' },
  rename: { label: 'Renombrar', icon: 'create-outline' },
  delete: { label: 'Eliminar espacio', icon: 'trash-outline', destructive: true },
};

export const DriveSpaceActionSheet: React.FC<Props> = ({
  visible,
  space,
  actions,
  onSelect,
  onClose,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!space) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Ionicons
              name={space.type === 'personal' ? 'cloud' : 'people'}
              size={iconSizes.md}
              color={theme.color.brand.primary}
            />
            <Text variant="bodyMedium" numberOfLines={1} style={styles.headerText}>
              {space.name}
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
                    onSelect(id, space);
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

export default DriveSpaceActionSheet;
