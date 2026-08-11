/**
 * MoveCopyPickerModal
 *
 * Modal para elegir una carpeta destino dentro de un espacio, navegando
 * carpeta por carpeta (breadcrumb + listado de subcarpetas). Se usa tanto
 * para "Mover" como para "Copiar".
 *
 * Reglas:
 *  - No se puede seleccionar como destino la propia carpeta ni una descendiente
 *    (para operaciones sobre carpetas). Esa validación queda en el caller.
 *  - Solo listamos carpetas.
 *  - `mode` cambia el label del botón principal.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '@/design-system/components';
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import {
  useDriveFolderChildren,
  useDriveSpaceChildren,
  useDriveSpaces,
} from '@/hooks/api/useDrive';
import type { DriveNode, DriveSpace } from '@/types/drive';

export type MoveCopyMode = 'move' | 'copy';

interface Props {
  visible: boolean;
  mode: MoveCopyMode;
  /** Nodo que se está moviendo/copiando (para no permitir moverlo a sí mismo). */
  sourceNode: DriveNode | null;
  /** Espacio de origen; por defecto el picker arranca ahí. */
  defaultSpaceId?: string | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (target: { spaceId: string; parentId: string | null }) => void;
}

interface CrumbItem {
  id: string | null;
  name: string;
}

export const MoveCopyPickerModal: React.FC<Props> = ({
  visible,
  mode,
  sourceNode,
  defaultSpaceId,
  loading,
  onClose,
  onSubmit,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const spacesQ = useDriveSpaces(visible);
  const [spaceId, setSpaceId] = useState<string | null>(defaultSpaceId ?? null);
  const [stack, setStack] = useState<CrumbItem[]>([]);

  React.useEffect(() => {
    if (visible) {
      setSpaceId(defaultSpaceId ?? null);
      setStack([]);
    }
  }, [visible, defaultSpaceId]);

  const currentFolderId = stack.length > 0 ? stack[stack.length - 1].id : null;
  const isSpaceRoot = currentFolderId === null;

  const spaceChildrenQ = useDriveSpaceChildren(
    spaceId ?? undefined,
    {},
    visible && !!spaceId && isSpaceRoot
  );
  const folderChildrenQ = useDriveFolderChildren(
    currentFolderId ?? undefined,
    {},
    visible && !!currentFolderId
  );

  const activeSpace: DriveSpace | undefined = useMemo(
    () => spacesQ.data?.find((s) => s.id === spaceId),
    [spacesQ.data, spaceId]
  );

  const folders: DriveNode[] = useMemo(() => {
    const raw = isSpaceRoot ? spaceChildrenQ.data : folderChildrenQ.data;
    return (raw ?? []).filter(
      (n) => n.kind === 'folder' && !n.isTrashed && n.id !== sourceNode?.id
    );
  }, [isSpaceRoot, spaceChildrenQ.data, folderChildrenQ.data, sourceNode?.id]);

  const isLoading = spaceId
    ? isSpaceRoot
      ? spaceChildrenQ.isLoading
      : folderChildrenQ.isLoading
    : spacesQ.isLoading;

  const handleSelectSpace = (s: DriveSpace) => {
    setSpaceId(s.id);
    setStack([]);
  };

  const handleEnterFolder = (n: DriveNode) => {
    setStack((s) => [...s, { id: n.id, name: n.name }]);
  };

  const handleCrumb = (index: number) => {
    if (index === -1) {
      // volver al selector de espacios
      setSpaceId(null);
      setStack([]);
    } else if (index === 0) {
      setStack([]);
    } else {
      setStack((s) => s.slice(0, index));
    }
  };

  const canSubmit =
    !!spaceId &&
    !!sourceNode &&
    // No permitir mover a la ubicación actual del propio nodo (si sourceNode ya vive ahí).
    !(mode === 'move' && sourceNode.parentId === currentFolderId && sourceNode.spaceId === spaceId);

  const handleSubmit = () => {
    if (!canSubmit || !spaceId) return;
    onSubmit({ spaceId, parentId: currentFolderId });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Ionicons
              name={mode === 'move' ? 'move-outline' : 'copy-outline'}
              size={iconSizes.md}
              color={theme.color.brand.primary}
            />
            <Text variant="titleSmall" style={styles.titleFlex}>
              {mode === 'move' ? 'Mover a...' : 'Copiar a...'}
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={activeOpacity.medium}>
              <Ionicons name="close" size={iconSizes.md} color={theme.color.icon.default} />
            </TouchableOpacity>
          </View>

          {/* Breadcrumb */}
          <View style={styles.crumbBar}>
            <TouchableOpacity
              onPress={() => handleCrumb(-1)}
              style={styles.crumbChip}
              activeOpacity={activeOpacity.medium}
            >
              <Ionicons
                name="albums-outline"
                size={iconSizes.sm}
                color={theme.color.icon.default}
              />
              <Text variant="caption">Espacios</Text>
            </TouchableOpacity>
            {activeSpace && (
              <>
                <Ionicons
                  name="chevron-forward"
                  size={iconSizes.xs}
                  color={theme.color.icon.muted}
                />
                <TouchableOpacity
                  onPress={() => handleCrumb(0)}
                  style={styles.crumbChip}
                  activeOpacity={activeOpacity.medium}
                >
                  <Text variant="caption" numberOfLines={1}>
                    {activeSpace.name}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {stack.map((c, i) => (
              <React.Fragment key={c.id ?? `root-${i}`}>
                <Ionicons
                  name="chevron-forward"
                  size={iconSizes.xs}
                  color={theme.color.icon.muted}
                />
                <TouchableOpacity
                  onPress={() => handleCrumb(i + 1)}
                  style={styles.crumbChip}
                  activeOpacity={activeOpacity.medium}
                >
                  <Text variant="caption" numberOfLines={1}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>

          {/* Listado */}
          <View style={styles.body}>
            {isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="small" color={theme.color.brand.primary} />
              </View>
            ) : !spaceId ? (
              <FlatList
                data={spacesQ.data ?? []}
                keyExtractor={(s) => s.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => handleSelectSpace(item)}
                    activeOpacity={activeOpacity.medium}
                  >
                    <Ionicons
                      name={item.type === 'personal' ? 'cloud' : 'people'}
                      size={iconSizes.md}
                      color={theme.color.brand.primary}
                    />
                    <Text variant="bodyMedium" style={styles.rowText} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={iconSizes.sm}
                      color={theme.color.icon.muted}
                    />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text variant="caption" color="secondary" align="center">
                    No hay espacios disponibles.
                  </Text>
                }
              />
            ) : folders.length === 0 ? (
              <View style={styles.center}>
                <Text variant="caption" color="secondary">
                  Sin subcarpetas aquí. Puedes seleccionar esta ubicación.
                </Text>
              </View>
            ) : (
              <FlatList
                data={folders}
                keyExtractor={(n) => n.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => handleEnterFolder(item)}
                    activeOpacity={activeOpacity.medium}
                  >
                    <Ionicons name="folder" size={iconSizes.md} color="#F59E0B" />
                    <Text variant="bodyMedium" style={styles.rowText} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={iconSizes.sm}
                      color={theme.color.icon.muted}
                    />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text variant="caption" color="secondary" numberOfLines={1} style={styles.destLabel}>
              Destino:{' '}
              {activeSpace
                ? stack.length > 0
                  ? `${activeSpace.name} / ${stack.map((c) => c.name).join(' / ')}`
                  : activeSpace.name
                : 'Elige un espacio'}
            </Text>
            <View style={styles.actions}>
              <Button title="Cancelar" variant="ghost" onPress={onClose} />
              <Button
                title={mode === 'move' ? 'Mover aquí' : 'Copiar aquí'}
                onPress={handleSubmit}
                disabled={!canSubmit || loading}
                loading={loading}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
    },
    card: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '85%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
      ...theme.shadow.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingHorizontal: theme.space[4],
      paddingTop: theme.space[4],
      paddingBottom: theme.space[2],
    },
    titleFlex: {
      flex: 1,
    },
    crumbBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: theme.space[4],
      paddingBottom: theme.space[2],
      flexWrap: 'wrap',
    },
    crumbChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: theme.space[2],
      paddingVertical: 4,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.muted,
      maxWidth: 160,
    },
    body: {
      flex: 1,
      minHeight: 200,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border.subtle,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.subtle,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
    },
    footer: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      gap: theme.space[2],
    },
    destLabel: {
      maxWidth: '100%',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[2],
    },
  });

export default MoveCopyPickerModal;
