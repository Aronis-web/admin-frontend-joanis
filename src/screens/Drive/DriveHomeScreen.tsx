/**
 * DriveHomeScreen
 *
 * Pantalla principal del módulo Drive (fase 1):
 *  - BottomBar siempre visible (Mi unidad, Espacios, Compartido conmigo, Papelera)
 *  - Breadcrumb + navegación por carpetas
 *  - Listado de nodos (carpetas + archivos)
 *  - FAB rojo con speed-dial: Subir archivo / Nueva carpeta / Nuevo espacio
 *  - Subida con progreso (via XHR) y toast simple
 *  - Visor básico para imagen / pdf / video / texto
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { EmptyState, Text } from '@/design-system/components';
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';
import { useOnReload } from '@/hooks/useOnReload';
import { useQueryClient } from '@tanstack/react-query';

import {
  driveKeys,
  useCreateDriveFolder,
  useDriveFolderChildren,
  useDriveSharedWithMe,
  useDriveSpaceChildren,
  useDriveSpaceUsage,
  useDriveSpaces,
  useDriveTrash,
  usePermanentDeleteDriveNode,
  useRestoreDriveNode,
  useTrashDriveNode,
  useUploadDriveFile,
} from '@/hooks/api/useDrive';
import type { DriveNode, DriveSpace } from '@/types/drive';
import { toBytesNumber } from '@/types/drive';

import DriveBottomBar, { type DriveBottomTab } from '@/components/Drive/DriveBottomBar';
import DriveFAB, { type DriveFABActionId } from '@/components/Drive/DriveFAB';
import DriveBreadcrumb, { type BreadcrumbItem } from '@/components/Drive/DriveBreadcrumb';
import DriveNodeRow from '@/components/Drive/DriveNodeRow';
import DriveFileViewerModal from '@/components/Drive/DriveFileViewerModal';
import NewFolderModal from '@/components/Drive/NewFolderModal';
import { pickFilesForUpload } from '@/components/Drive/pickFileCrossPlatform';

interface Props {
  navigation: unknown;
}

const humanBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DriveHomeScreen: React.FC<Props> = (_props) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { hasPermission } = usePermissions();
  const qc = useQueryClient();

  const canUpload = hasPermission(PERMISSIONS.DRIVE.UPLOAD);
  const canManage = hasPermission(PERMISSIONS.DRIVE.MANAGE);

  const [tab, setTab] = useState<DriveBottomTab>('my-unit');
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  /** Stack de carpetas navegadas dentro del space activo. null en root. */
  const [folderStack, setFolderStack] = useState<BreadcrumbItem[]>([]);

  const [newFolderVisible, setNewFolderVisible] = useState(false);
  const [viewerNode, setViewerNode] = useState<DriveNode | null>(null);
  const [uploading, setUploading] = useState<{ name: string; ratio: number } | null>(null);

  const spacesQ = useDriveSpaces();
  const personalSpace: DriveSpace | undefined = useMemo(
    () => spacesQ.data?.find((s) => s.type === 'personal'),
    [spacesQ.data]
  );
  const sharedSpaces = useMemo(
    () => spacesQ.data?.filter((s) => s.type === 'shared') ?? [],
    [spacesQ.data]
  );

  // Auto-seleccionar espacio personal al entrar en "Mi unidad"
  React.useEffect(() => {
    if (tab === 'my-unit' && personalSpace && !activeSpaceId) {
      setActiveSpaceId(personalSpace.id);
    }
  }, [tab, personalSpace, activeSpaceId]);

  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null;

  // Queries de contenido según tab
  const isSpaceRoot = currentFolderId === null;
  const spaceChildrenQ = useDriveSpaceChildren(
    activeSpaceId ?? undefined,
    {},
    tab !== 'shared-with-me' && tab !== 'trash' && isSpaceRoot && !!activeSpaceId
  );
  const folderChildrenQ = useDriveFolderChildren(
    currentFolderId ?? undefined,
    {},
    tab !== 'shared-with-me' && tab !== 'trash' && !isSpaceRoot && !!currentFolderId
  );
  const trashQ = useDriveTrash(activeSpaceId ?? undefined, tab === 'trash' && !!activeSpaceId);
  const sharedQ = useDriveSharedWithMe(tab === 'shared-with-me');
  const usageQ = useDriveSpaceUsage(activeSpaceId ?? undefined, !!activeSpaceId);

  const spaceName = useMemo(() => {
    if (!activeSpaceId) return '';
    return spacesQ.data?.find((s) => s.id === activeSpaceId)?.name ?? '';
  }, [activeSpaceId, spacesQ.data]);

  const breadcrumb: BreadcrumbItem[] = useMemo(
    () => [{ id: null, name: spaceName || 'Mi unidad' }, ...folderStack],
    [spaceName, folderStack]
  );

  // Mutations
  const createFolder = useCreateDriveFolder();
  const uploadFile = useUploadDriveFile();
  const trashNode = useTrashDriveNode();
  const restoreNode = useRestoreDriveNode();
  const permanentDelete = usePermanentDeleteDriveNode();

  // Reload global
  useOnReload(async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: driveKeys.all })]);
  });

  // ----- Handlers -----

  const handleSelectTab = (t: DriveBottomTab) => {
    setTab(t);
    setFolderStack([]);
    if (t === 'my-unit' && personalSpace) setActiveSpaceId(personalSpace.id);
    if (t === 'spaces' && sharedSpaces.length > 0) setActiveSpaceId(sharedSpaces[0].id);
    if (t === 'trash' && !activeSpaceId && personalSpace) setActiveSpaceId(personalSpace.id);
  };

  const handleOpenNode = (node: DriveNode) => {
    if (node.kind === 'folder') {
      setFolderStack((s) => [...s, { id: node.id, name: node.name }]);
    } else {
      setViewerNode(node);
    }
  };

  const handleBreadcrumbNavigate = (item: BreadcrumbItem, index: number) => {
    // index 0 => raíz del espacio (folderStack = [])
    if (index === 0) {
      setFolderStack([]);
    } else {
      setFolderStack((s) => s.slice(0, index));
    }
  };

  const handleFabAction = async (id: DriveFABActionId) => {
    if (id === 'new-folder') {
      setNewFolderVisible(true);
      return;
    }
    if (id === 'upload-file' || id === 'upload-folder') {
      if (!activeSpaceId) {
        Alert.alert('Drive', 'Selecciona primero un espacio.');
        return;
      }
      try {
        const files = await pickFilesForUpload({ multiple: false });
        if (files.length === 0) return;
        const file = files[0];
        setUploading({ name: file.name, ratio: 0 });
        const args = currentFolderId
          ? {
              target: 'folder' as const,
              folderId: currentFolderId,
              spaceId: activeSpaceId,
              file: file.payload,
              filename: file.name,
              options: {
                onProgress: (p: { ratio: number }) =>
                  setUploading({ name: file.name, ratio: p.ratio }),
              },
            }
          : {
              target: 'space' as const,
              spaceId: activeSpaceId,
              file: file.payload,
              filename: file.name,
              options: {
                onProgress: (p: { ratio: number }) =>
                  setUploading({ name: file.name, ratio: p.ratio }),
              },
            };
        await uploadFile.mutateAsync(args);
      } catch (e) {
        logger.error('Error subiendo archivo:', e);
        const err = e as { status?: number; message?: string };
        if (err.status === 409) {
          Alert.alert('No se pudo subir', 'Nombre duplicado o cuota excedida.');
        } else {
          Alert.alert('No se pudo subir', err.message || 'Error desconocido.');
        }
      } finally {
        setUploading(null);
      }
      return;
    }
    if (id === 'new-space') {
      Alert.alert(
        'Próximamente',
        'La creación de espacios compartidos llega en el siguiente release.'
      );
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!activeSpaceId) return;
    try {
      await createFolder.mutateAsync({
        spaceId: activeSpaceId,
        parentId: currentFolderId,
        name,
      });
      setNewFolderVisible(false);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 409) {
        Alert.alert('No se pudo crear', 'Ya existe una carpeta con ese nombre aquí.');
      } else {
        Alert.alert('No se pudo crear', err.message || 'Error desconocido.');
      }
    }
  };

  const handleNodeMore = (node: DriveNode) => {
    if (tab === 'trash') {
      if (!canManage) return;
      Alert.alert(node.name, '¿Qué deseas hacer?', [
        {
          text: 'Restaurar',
          onPress: () =>
            restoreNode.mutate(
              { nodeId: node.id, spaceId: node.spaceId },
              {
                onError: (e) => Alert.alert('Error', (e as Error).message),
              }
            ),
        },
        {
          text: 'Borrar definitivo',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Borrado definitivo', 'Esta acción es irreversible.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Borrar',
                style: 'destructive',
                onPress: () => permanentDelete.mutate({ nodeId: node.id, spaceId: node.spaceId }),
              },
            ]),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]);
      return;
    }
    if (!canManage) return;
    Alert.alert(node.name, '¿Qué deseas hacer?', [
      {
        text: 'Enviar a papelera',
        style: 'destructive',
        onPress: () =>
          trashNode.mutate({
            nodeId: node.id,
            spaceId: node.spaceId,
            parentId: node.parentId,
          }),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // ----- Data seleccionada según tab -----

  const listData: DriveNode[] = useMemo(() => {
    if (tab === 'shared-with-me') {
      return (sharedQ.data ?? []).map((s) => s.node);
    }
    if (tab === 'trash') {
      return trashQ.data ?? [];
    }
    if (isSpaceRoot) {
      return spaceChildrenQ.data ?? [];
    }
    return folderChildrenQ.data ?? [];
  }, [tab, isSpaceRoot, sharedQ.data, trashQ.data, spaceChildrenQ.data, folderChildrenQ.data]);

  const isLoading =
    (tab === 'shared-with-me' && sharedQ.isLoading) ||
    (tab === 'trash' && trashQ.isLoading) ||
    (tab !== 'shared-with-me' && tab !== 'trash' && isSpaceRoot && spaceChildrenQ.isLoading) ||
    (tab !== 'shared-with-me' && tab !== 'trash' && !isSpaceRoot && folderChildrenQ.isLoading);

  const isRefreshing =
    (tab === 'shared-with-me' && sharedQ.isFetching && !sharedQ.isLoading) ||
    (tab === 'trash' && trashQ.isFetching && !trashQ.isLoading) ||
    (isSpaceRoot && spaceChildrenQ.isFetching && !spaceChildrenQ.isLoading) ||
    (!isSpaceRoot && folderChildrenQ.isFetching && !folderChildrenQ.isLoading);

  const onRefresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: driveKeys.all });
  }, [qc]);

  const fabActions: DriveFABActionId[] = useMemo(() => {
    if (tab === 'shared-with-me' || tab === 'trash') return [];
    const acts: DriveFABActionId[] = [];
    if (canUpload) {
      acts.push('upload-file');
      if (Platform.OS === 'web') acts.push('upload-folder');
      acts.push('new-folder');
    }
    if (canManage && tab === 'spaces') acts.push('new-space');
    return acts;
  }, [canManage, canUpload, tab]);

  // ----- Header info -----

  const usedRatio = useMemo(() => {
    if (!usageQ.data) return null;
    const used = toBytesNumber(usageQ.data.usedBytes);
    const quota = toBytesNumber(usageQ.data.quotaBytes);
    return quota > 0 ? used / quota : 0;
  }, [usageQ.data]);

  return (
    <ScreenLayout navigation={{} as never}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Ionicons name="cloud-outline" size={iconSizes.lg} color={theme.color.brand.primary} />
            <Text variant="titleMedium" style={styles.headerTitle}>
              Drive
            </Text>
            {tab !== 'shared-with-me' &&
              tab !== 'trash' &&
              sharedSpaces.length > 0 &&
              tab === 'spaces' && (
                <TouchableOpacity
                  style={styles.spaceSwitcher}
                  onPress={() => {
                    // Ciclo simple entre spaces compartidos
                    const idx = sharedSpaces.findIndex((s) => s.id === activeSpaceId);
                    const next = sharedSpaces[(idx + 1) % sharedSpaces.length];
                    if (next) {
                      setActiveSpaceId(next.id);
                      setFolderStack([]);
                    }
                  }}
                  activeOpacity={activeOpacity.medium}
                >
                  <Ionicons
                    name="swap-horizontal"
                    size={iconSizes.sm}
                    color={theme.color.icon.default}
                  />
                  <Text variant="caption" numberOfLines={1} style={styles.spaceSwitcherText}>
                    {spaceName || 'Elegir espacio'}
                  </Text>
                </TouchableOpacity>
              )}
          </View>

          {/* Barra de cuota */}
          {tab !== 'shared-with-me' && usageQ.data && usedRatio !== null && (
            <View style={styles.quotaRow}>
              <View style={styles.quotaBarTrack}>
                <View
                  style={[
                    styles.quotaBarFill,
                    {
                      width: `${Math.min(100, Math.round(usedRatio * 100))}%`,
                      backgroundColor:
                        usedRatio > 0.95
                          ? theme.color.state.danger.text
                          : usedRatio > 0.8
                            ? theme.color.state.warning.text
                            : theme.color.brand.primary,
                    },
                  ]}
                />
              </View>
              <Text variant="caption" color="secondary">
                {humanBytes(toBytesNumber(usageQ.data.usedBytes))} /{' '}
                {humanBytes(toBytesNumber(usageQ.data.quotaBytes))}
              </Text>
            </View>
          )}

          {tab !== 'shared-with-me' && tab !== 'trash' && (
            <DriveBreadcrumb items={breadcrumb} onNavigate={handleBreadcrumbNavigate} />
          )}
          {tab === 'trash' && (
            <View style={styles.trashBanner}>
              <Ionicons name="trash-outline" size={iconSizes.md} color={theme.color.icon.default} />
              <Text variant="bodySmall" color="secondary">
                Papelera del espacio: {spaceName}
              </Text>
            </View>
          )}
          {tab === 'shared-with-me' && (
            <View style={styles.trashBanner}>
              <Ionicons
                name="share-social-outline"
                size={iconSizes.md}
                color={theme.color.icon.default}
              />
              <Text variant="bodySmall" color="secondary">
                Elementos compartidos contigo
              </Text>
            </View>
          )}
        </View>

        {/* Lista */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.color.brand.primary} />
          </View>
        ) : listData.length === 0 ? (
          <View style={styles.center}>
            <EmptyState
              icon="folder-open-outline"
              title={
                tab === 'trash'
                  ? 'Papelera vacía'
                  : tab === 'shared-with-me'
                    ? 'Aún no te han compartido nada'
                    : 'Esta carpeta está vacía'
              }
              description={
                canUpload && tab !== 'trash' && tab !== 'shared-with-me'
                  ? 'Usa el botón + para subir un archivo o crear una carpeta.'
                  : undefined
              }
            />
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(n) => n.id}
            renderItem={({ item }) => (
              <DriveNodeRow node={item} onOpen={handleOpenNode} onMore={handleNodeMore} />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={theme.color.brand.primary}
              />
            }
          />
        )}

        {/* Overlay progreso subida */}
        {uploading && (
          <View style={styles.uploadOverlay} pointerEvents="none">
            <View style={styles.uploadCard}>
              <Text variant="bodySmall" numberOfLines={1}>
                Subiendo: {uploading.name}
              </Text>
              <View style={styles.uploadBarTrack}>
                <View
                  style={[styles.uploadBarFill, { width: `${Math.round(uploading.ratio * 100)}%` }]}
                />
              </View>
              <Text variant="caption" color="secondary">
                {Math.round(uploading.ratio * 100)}%
              </Text>
            </View>
          </View>
        )}

        {/* Bottom bar */}
        <DriveBottomBar active={tab} onSelect={handleSelectTab} />

        {/* FAB rojo */}
        <DriveFAB onAction={handleFabAction} actions={fabActions} visible={fabActions.length > 0} />

        {/* Modales */}
        <NewFolderModal
          visible={newFolderVisible}
          loading={createFolder.isPending}
          onClose={() => setNewFolderVisible(false)}
          onSubmit={handleCreateFolder}
        />
        <DriveFileViewerModal
          visible={!!viewerNode}
          node={viewerNode}
          onClose={() => setViewerNode(null)}
        />
      </View>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
    },
    header: {
      paddingTop: theme.space[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.space[4],
      gap: theme.space[2],
    },
    headerTitle: {
      flex: 1,
    },
    spaceSwitcher: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: theme.space[2],
      paddingVertical: 4,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.muted,
      maxWidth: 180,
    },
    spaceSwitcherText: {
      maxWidth: 140,
    },
    quotaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingHorizontal: theme.space[4],
      paddingTop: theme.space[2],
    },
    quotaBarTrack: {
      flex: 1,
      height: 6,
      backgroundColor: theme.color.surface.muted,
      borderRadius: 3,
      overflow: 'hidden',
    },
    quotaBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    trashBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
    },
    listContent: {
      paddingBottom: 140, // deja espacio para BottomBar + FAB
    },
    uploadOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 100,
      alignItems: 'center',
      zIndex: 500,
    },
    uploadCard: {
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      minWidth: 260,
      maxWidth: '90%',
      gap: 6,
      ...theme.shadow.lg,
    },
    uploadBarTrack: {
      height: 4,
      backgroundColor: theme.color.surface.muted,
      borderRadius: 2,
      overflow: 'hidden',
    },
    uploadBarFill: {
      height: '100%',
      backgroundColor: theme.color.brand.primary,
      borderRadius: 2,
    },
  });

export default DriveHomeScreen;
