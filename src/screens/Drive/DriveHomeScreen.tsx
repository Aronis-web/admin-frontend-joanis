/**
 * DriveHomeScreen
 *
 * Pantalla principal del módulo Drive (fase 2):
 *  - BottomBar con 4 tabs (Mi unidad, Espacios, Compartido, Papelera).
 *  - "Mi unidad" navega el espacio personal.
 *  - "Espacios" muestra grid de espacios compartidos y permite entrar a cada uno.
 *  - Grid grande de carpetas/archivos (iconos grandes) con menú contextual.
 *  - Acciones por nodo: Renombrar, Mover a..., Copiar a..., Papelera, Restaurar,
 *    Borrar definitivo.
 *  - Subida con progreso, drag & drop (web/Electron), Ctrl+V para pegar archivos.
 *  - Detección de nombre duplicado: pregunta Reemplazar (nueva versión) o
 *    Renombrar (con sugerencia name (1)).
 *  - Visor + editor de Excel integrado en el DriveFileViewerModal.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
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
  useCreateDriveSpace,
  useDriveFolderChildren,
  useDriveSharedWithMe,
  useDriveSpaceChildren,
  useDriveSpaceUsage,
  useDriveSpaces,
  useDriveTrash,
  useMoveDriveNode,
  usePermanentDeleteDriveNode,
  useRenameDriveNode,
  useRestoreDriveNode,
  useTrashDriveNode,
  useUploadDriveFile,
  useUploadDriveVersion,
} from '@/hooks/api/useDrive';
import { driveApi } from '@/services/api/drive';
import type { DriveNode, DriveSpace } from '@/types/drive';
import { toBytesNumber } from '@/types/drive';

import DriveBottomBar, { type DriveBottomTab } from '@/components/Drive/DriveBottomBar';
import DriveFAB, { type DriveFABActionId } from '@/components/Drive/DriveFAB';
import DriveBreadcrumb, { type BreadcrumbItem } from '@/components/Drive/DriveBreadcrumb';
import DriveNodeCard from '@/components/Drive/DriveNodeCard';
import DriveSpaceCard from '@/components/Drive/DriveSpaceCard';
import DriveFileViewerModal from '@/components/Drive/DriveFileViewerModal';
import NewFolderModal from '@/components/Drive/NewFolderModal';
import RenameNodeModal from '@/components/Drive/RenameNodeModal';
import MoveCopyPickerModal, { type MoveCopyMode } from '@/components/Drive/MoveCopyPickerModal';
import UploadConflictModal, {
  type UploadConflictChoice,
} from '@/components/Drive/UploadConflictModal';
import DriveNodeActionSheet, { type NodeActionId } from '@/components/Drive/DriveNodeActionSheet';
import DriveFileOpenSheet, { type FileOpenAction } from '@/components/Drive/DriveFileOpenSheet';
import CreateSpaceModal from '@/components/Drive/CreateSpaceModal';
import { pickFilesForUpload } from '@/components/Drive/pickFileCrossPlatform';
import { useWebFileDrop } from '@/components/Drive/useWebFileDrop';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';

interface Props {
  navigation: unknown;
}

const humanBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/** Divide `name.ext` en base + extensión (con punto). Si no hay extensión, ext=''. */
const splitNameExt = (name: string): { base: string; ext: string } => {
  const idx = name.lastIndexOf('.');
  if (idx <= 0 || idx === name.length - 1) return { base: name, ext: '' };
  return { base: name.slice(0, idx), ext: name.slice(idx) };
};

/** Genera un nombre único al estilo Windows: "archivo (1).ext", (2), ... */
const suggestUniqueName = (name: string, existing: Set<string>): string => {
  if (!existing.has(name)) return name;
  const { base, ext } = splitNameExt(name);
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${base} (${i})${ext}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
};

interface PendingUpload {
  file: Blob | File | { uri: string; name: string; type: string };
  name: string;
  mimeType?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DriveHomeScreen: React.FC<Props> = (_props) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width: windowWidth } = useWindowDimensions();
  const { hasPermission } = usePermissions();
  const qc = useQueryClient();

  const canUpload = hasPermission(PERMISSIONS.DRIVE.UPLOAD);
  const canManage = hasPermission(PERMISSIONS.DRIVE.MANAGE);

  // --------------------------------------------------------------------------
  // Navegación
  // --------------------------------------------------------------------------

  const [tab, setTab] = useState<DriveBottomTab>('my-unit');
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<BreadcrumbItem[]>([]);

  // Modales
  const [newFolderVisible, setNewFolderVisible] = useState(false);
  const [newSpaceVisible, setNewSpaceVisible] = useState(false);
  const [viewerNode, setViewerNode] = useState<DriveNode | null>(null);
  const [openSheetNode, setOpenSheetNode] = useState<DriveNode | null>(null);
  const [actionSheetNode, setActionSheetNode] = useState<DriveNode | null>(null);
  const [renameNode, setRenameNode] = useState<DriveNode | null>(null);
  const [movePicker, setMovePicker] = useState<{ node: DriveNode; mode: MoveCopyMode } | null>(
    null
  );
  const [conflict, setConflict] = useState<{
    original: string;
    suggested: string;
    pending: PendingUpload;
    existingNode: DriveNode | null;
  } | null>(null);
  const [uploading, setUploading] = useState<{ name: string; ratio: number } | null>(null);
  const [copying, setCopying] = useState<{ name: string; ratio: number } | null>(null);

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  const spacesQ = useDriveSpaces();
  const personalSpace: DriveSpace | undefined = useMemo(
    () => spacesQ.data?.find((s) => s.type === 'personal'),
    [spacesQ.data]
  );
  const sharedSpaces = useMemo(
    () => spacesQ.data?.filter((s) => s.type === 'shared') ?? [],
    [spacesQ.data]
  );

  // Auto-seleccionar personal al entrar en "Mi unidad"
  useEffect(() => {
    if (tab === 'my-unit' && personalSpace && activeSpaceId !== personalSpace.id) {
      setActiveSpaceId(personalSpace.id);
      setFolderStack([]);
    }
  }, [tab, personalSpace, activeSpaceId]);

  // En "Espacios": si no hay space activo o el activo es el personal → mostrar grid.
  const spacesGridMode =
    tab === 'spaces' && (!activeSpaceId || activeSpaceId === personalSpace?.id);

  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null;
  const isSpaceRoot = currentFolderId === null;

  const browsingEnabled =
    (tab === 'my-unit' || (tab === 'spaces' && !spacesGridMode)) && !!activeSpaceId;

  const spaceChildrenQ = useDriveSpaceChildren(
    activeSpaceId ?? undefined,
    {},
    browsingEnabled && isSpaceRoot
  );
  const folderChildrenQ = useDriveFolderChildren(
    currentFolderId ?? undefined,
    {},
    browsingEnabled && !isSpaceRoot
  );
  const trashQ = useDriveTrash(activeSpaceId ?? undefined, tab === 'trash' && !!activeSpaceId);
  const sharedQ = useDriveSharedWithMe(tab === 'shared-with-me');
  const usageQ = useDriveSpaceUsage(activeSpaceId ?? undefined, browsingEnabled);

  const activeSpace = useMemo(
    () => spacesQ.data?.find((s) => s.id === activeSpaceId) ?? null,
    [spacesQ.data, activeSpaceId]
  );

  const breadcrumb: BreadcrumbItem[] = useMemo(
    () => [{ id: null, name: activeSpace?.name ?? 'Mi unidad' }, ...folderStack],
    [activeSpace?.name, folderStack]
  );

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  const createFolder = useCreateDriveFolder();
  const createSpace = useCreateDriveSpace();
  const uploadFile = useUploadDriveFile();
  const uploadVersion = useUploadDriveVersion();
  const renameNodeMut = useRenameDriveNode();
  const moveNodeMut = useMoveDriveNode();
  const trashNode = useTrashDriveNode();
  const restoreNode = useRestoreDriveNode();
  const permanentDelete = usePermanentDeleteDriveNode();

  // --------------------------------------------------------------------------
  // Data actual
  // --------------------------------------------------------------------------

  const listData: DriveNode[] = useMemo(() => {
    if (tab === 'shared-with-me') return (sharedQ.data ?? []).map((s) => s.node);
    if (tab === 'trash') return trashQ.data ?? [];
    if (!browsingEnabled) return [];
    if (isSpaceRoot) return spaceChildrenQ.data ?? [];
    return folderChildrenQ.data ?? [];
  }, [
    tab,
    isSpaceRoot,
    browsingEnabled,
    sharedQ.data,
    trashQ.data,
    spaceChildrenQ.data,
    folderChildrenQ.data,
  ]);

  // Ordenar: carpetas primero, luego archivos, por nombre.
  const sortedList = useMemo(() => {
    const arr = [...listData];
    arr.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
    return arr;
  }, [listData]);

  const existingNamesSet = useMemo(
    () => new Set(sortedList.filter((n) => !n.isTrashed).map((n) => n.name)),
    [sortedList]
  );

  const isLoading =
    (tab === 'shared-with-me' && sharedQ.isLoading) ||
    (tab === 'trash' && trashQ.isLoading) ||
    (browsingEnabled && isSpaceRoot && spaceChildrenQ.isLoading) ||
    (browsingEnabled && !isSpaceRoot && folderChildrenQ.isLoading);

  const isRefreshing =
    (tab === 'shared-with-me' && sharedQ.isFetching && !sharedQ.isLoading) ||
    (tab === 'trash' && trashQ.isFetching && !trashQ.isLoading) ||
    (browsingEnabled && isSpaceRoot && spaceChildrenQ.isFetching && !spaceChildrenQ.isLoading) ||
    (browsingEnabled && !isSpaceRoot && folderChildrenQ.isFetching && !folderChildrenQ.isLoading);

  const onRefresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: driveKeys.all });
  }, [qc]);

  useOnReload(async () => {
    await qc.invalidateQueries({ queryKey: driveKeys.all });
  });

  // --------------------------------------------------------------------------
  // Handlers de navegación
  // --------------------------------------------------------------------------

  const handleSelectTab = (t: DriveBottomTab) => {
    setTab(t);
    setFolderStack([]);
    if (t === 'my-unit' && personalSpace) setActiveSpaceId(personalSpace.id);
    if (t === 'spaces') {
      // Reseteamos para mostrar el grid de espacios
      setActiveSpaceId(null);
    }
    if (t === 'trash' && !activeSpaceId && personalSpace) setActiveSpaceId(personalSpace.id);
  };

  const handleOpenSpaceCard = (s: DriveSpace) => {
    setActiveSpaceId(s.id);
    setFolderStack([]);
  };

  const handleOpenNode = (node: DriveNode) => {
    if (node.kind === 'folder') {
      setFolderStack((s) => [...s, { id: node.id, name: node.name }]);
    } else {
      // Ya no renderizamos directo: mostramos un sheet con las opciones.
      setOpenSheetNode(node);
    }
  };

  const handleFileOpenAction = async (action: FileOpenAction, node: DriveNode) => {
    if (action === 'preview-in-erp') {
      setViewerNode(node);
      return;
    }
    if (action === 'download') {
      try {
        if (Platform.OS === 'web') {
          const blob = await driveApi.downloadNode(node.id, { disposition: 'attachment' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = node.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          const blob = await driveApi.downloadNode(node.id, { disposition: 'attachment' });
          const reader = new FileReader();
          const base64: string = await new Promise((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1] || '');
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
          const path = `${dir}${encodeURIComponent(node.name)}`;
          await FileSystem.writeAsStringAsync(path, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(path);
          }
        }
      } catch (e) {
        logger.error('Error descargando:', e);
        Alert.alert('No se pudo descargar', (e as Error).message || 'Error.');
      }
      return;
    }
    if (action === 'open-external') {
      try {
        const blob = await driveApi.downloadNode(node.id, { disposition: 'inline' });
        if (Platform.OS === 'web') {
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        } else {
          const reader = new FileReader();
          const base64: string = await new Promise((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1] || '');
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
          const path = `${dir}${encodeURIComponent(node.name)}`;
          await FileSystem.writeAsStringAsync(path, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(path);
          } else {
            await Linking.openURL(path);
          }
        }
      } catch (e) {
        logger.error('Error abriendo externo:', e);
        Alert.alert('No se pudo abrir', (e as Error).message || 'Error.');
      }
    }
  };

  const handleBreadcrumbNavigate = (item: BreadcrumbItem, index: number) => {
    if (index === 0) setFolderStack([]);
    else setFolderStack((s) => s.slice(0, index));
  };

  const handleBackToSpaces = () => {
    setActiveSpaceId(null);
    setFolderStack([]);
  };

  // --------------------------------------------------------------------------
  // Uploads
  // --------------------------------------------------------------------------

  const performUpload = useCallback(
    async (upload: PendingUpload) => {
      if (!activeSpaceId) return;
      setUploading({ name: upload.name, ratio: 0 });
      try {
        const opts = {
          onProgress: (p: { ratio: number }) => setUploading({ name: upload.name, ratio: p.ratio }),
        };
        const args = currentFolderId
          ? {
              target: 'folder' as const,
              folderId: currentFolderId,
              spaceId: activeSpaceId,
              file: upload.file,
              filename: upload.name,
              options: opts,
            }
          : {
              target: 'space' as const,
              spaceId: activeSpaceId,
              file: upload.file,
              filename: upload.name,
              options: opts,
            };
        await uploadFile.mutateAsync(args);
      } catch (e) {
        logger.error('Error subiendo archivo:', e);
        const err = e as { status?: number; message?: string };
        if (err.status === 409) {
          Alert.alert('No se pudo subir', 'Cuota excedida o nombre duplicado.');
        } else {
          Alert.alert('No se pudo subir', err.message || 'Error desconocido.');
        }
      } finally {
        setUploading(null);
      }
    },
    [activeSpaceId, currentFolderId, uploadFile]
  );

  const performReplace = useCallback(
    async (upload: PendingUpload, targetNode: DriveNode) => {
      setUploading({ name: upload.name, ratio: 0 });
      try {
        await uploadVersion.mutateAsync({
          nodeId: targetNode.id,
          spaceId: targetNode.spaceId,
          file: upload.file,
          filename: upload.name,
          options: {
            onProgress: (p: { ratio: number }) =>
              setUploading({ name: upload.name, ratio: p.ratio }),
          },
        });
      } catch (e) {
        logger.error('Error reemplazando archivo:', e);
        const err = e as { status?: number; message?: string };
        Alert.alert('No se pudo reemplazar', err.message || 'Error desconocido.');
      } finally {
        setUploading(null);
      }
    },
    [uploadVersion]
  );

  /** Punto único: recibe uno o varios archivos y los sube (con detección de conflictos). */
  const handleIncomingFiles = useCallback(
    async (files: PendingUpload[]) => {
      if (!activeSpaceId) {
        Alert.alert('Drive', 'Entra primero a un espacio para subir archivos.');
        return;
      }
      for (const upload of files) {
        const existing = sortedList.find((n) => n.name === upload.name && !n.isTrashed);
        if (existing) {
          // Espera a que el usuario resuelva el conflicto
          // eslint-disable-next-line no-await-in-loop
          await new Promise<void>((resolve) => {
            setConflict({
              original: upload.name,
              suggested: suggestUniqueName(upload.name, existingNamesSet),
              pending: upload,
              existingNode: existing,
            });
            // Guardamos el resolver en un ref implícito via cierre: cuando el
            // modal llame a onResolve, nosotros seteamos `conflict=null` y
            // resolvemos la promesa dentro del handler abajo.
            resolveConflictRef.current = resolve;
          });
        } else {
          // eslint-disable-next-line no-await-in-loop
          await performUpload(upload);
        }
      }
    },
    [activeSpaceId, sortedList, existingNamesSet, performUpload]
  );

  const resolveConflictRef = React.useRef<(() => void) | null>(null);

  const handleConflictResolve = async (choice: UploadConflictChoice) => {
    const current = conflict;
    if (!current) return;
    setConflict(null);
    try {
      if (choice.action === 'cancel') {
        return;
      }
      if (choice.action === 'replace' && current.existingNode) {
        await performReplace(current.pending, current.existingNode);
      } else if (choice.action === 'rename') {
        await performUpload({ ...current.pending, name: choice.name });
      }
    } finally {
      resolveConflictRef.current?.();
      resolveConflictRef.current = null;
    }
  };

  // Drag & drop + paste (solo web)
  const { isDragging } = useWebFileDrop({
    enabled: browsingEnabled && canUpload && Platform.OS === 'web',
    onFiles: (files) => {
      void handleIncomingFiles(
        files.map((f) => ({ file: f, name: f.name, mimeType: f.type || undefined }))
      );
    },
  });

  // --------------------------------------------------------------------------
  // FAB
  // --------------------------------------------------------------------------

  const handleFabAction = async (id: DriveFABActionId) => {
    if (id === 'new-folder') {
      setNewFolderVisible(true);
      return;
    }
    if (id === 'upload-file' || id === 'upload-folder') {
      if (!activeSpaceId) {
        Alert.alert('Drive', 'Entra primero a un espacio para subir archivos.');
        return;
      }
      try {
        const picked = await pickFilesForUpload({ multiple: true });
        if (picked.length === 0) return;
        await handleIncomingFiles(
          picked.map((p) => ({ file: p.payload, name: p.name, mimeType: p.mimeType }))
        );
      } catch (e) {
        logger.error('Error seleccionando archivo:', e);
      }
      return;
    }
    if (id === 'new-space') {
      setNewSpaceVisible(true);
    }
  };

  const handleCreateSpace = async (dto: { name: string; quotaBytes: number }) => {
    try {
      const created = await createSpace.mutateAsync(dto);
      setNewSpaceVisible(false);
      // Entrar al espacio recién creado
      setActiveSpaceId(created.id);
      setFolderStack([]);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      Alert.alert(
        'No se pudo crear el espacio',
        err.status === 409 ? 'Ya existe un espacio con ese nombre.' : err.message || 'Error.'
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

  // --------------------------------------------------------------------------
  // Menú contextual del nodo
  // --------------------------------------------------------------------------

  const nodeActions: NodeActionId[] = useMemo(() => {
    if (tab === 'trash') {
      if (!canManage) return [];
      return ['restore', 'delete-forever'];
    }
    const acts: NodeActionId[] = ['open'];
    if (canManage) {
      acts.push('rename', 'move');
    }
    // Copy solo si es archivo (F2 limitación)
    if (canUpload && actionSheetNode?.kind === 'file') acts.push('copy');
    if (canManage) acts.push('trash');
    return acts;
  }, [tab, canManage, canUpload, actionSheetNode?.kind]);

  const handleActionSheet = async (id: NodeActionId, node: DriveNode) => {
    if (id === 'open') {
      handleOpenNode(node);
      return;
    }
    if (id === 'rename') {
      setRenameNode(node);
      return;
    }
    if (id === 'move') {
      setMovePicker({ node, mode: 'move' });
      return;
    }
    if (id === 'copy') {
      if (node.kind === 'folder') {
        Alert.alert(
          'Próximamente',
          'La copia de carpetas completas se agrega en el siguiente release.'
        );
        return;
      }
      setMovePicker({ node, mode: 'copy' });
      return;
    }
    if (id === 'trash') {
      Alert.alert(node.name, '¿Enviar a la papelera?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          style: 'destructive',
          onPress: () =>
            trashNode.mutate({
              nodeId: node.id,
              spaceId: node.spaceId,
              parentId: node.parentId,
            }),
        },
      ]);
      return;
    }
    if (id === 'restore') {
      restoreNode.mutate(
        { nodeId: node.id, spaceId: node.spaceId },
        { onError: (e) => Alert.alert('Error', (e as Error).message) }
      );
      return;
    }
    if (id === 'delete-forever') {
      Alert.alert('Borrado definitivo', 'Esta acción es irreversible.', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () => permanentDelete.mutate({ nodeId: node.id, spaceId: node.spaceId }),
        },
      ]);
      return;
    }
  };

  const handleRenameSubmit = async (newName: string) => {
    if (!renameNode) return;
    try {
      await renameNodeMut.mutateAsync({ nodeId: renameNode.id, dto: { name: newName } });
      setRenameNode(null);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      Alert.alert(
        'No se pudo renombrar',
        err.status === 409 ? 'Ya existe algo con ese nombre.' : err.message || 'Error.'
      );
    }
  };

  const handleMoveCopySubmit = async (target: { spaceId: string; parentId: string | null }) => {
    if (!movePicker) return;
    const { node, mode } = movePicker;
    try {
      if (mode === 'move') {
        // NOTA: el backend actual mueve dentro del mismo espacio. Si el target
        // pertenece a otro espacio, informamos.
        if (target.spaceId !== node.spaceId) {
          Alert.alert(
            'Movimiento entre espacios',
            'Aún no se puede mover entre espacios. Usa Copiar para eso.'
          );
          return;
        }
        await moveNodeMut.mutateAsync({
          nodeId: node.id,
          dto: { targetParentId: target.parentId },
          previousParentId: node.parentId,
          spaceId: node.spaceId,
        });
      } else {
        // COPIAR: descargamos el blob y lo subimos al destino.
        if (node.kind === 'folder') {
          Alert.alert('Próximamente', 'Copia de carpetas próximamente.');
          return;
        }
        setCopying({ name: node.name, ratio: 0 });
        const blob = await driveApi.downloadNode(node.id, { disposition: 'attachment' });
        const opts = {
          onProgress: (p: { ratio: number }) => setCopying({ name: node.name, ratio: p.ratio }),
        };
        if (target.parentId) {
          await driveApi.uploadToFolder(target.parentId, blob, node.name, opts);
        } else {
          await driveApi.uploadToSpace(target.spaceId, blob, node.name, opts);
        }
        // Invalidar destino
        void qc.invalidateQueries({ queryKey: driveKeys.all });
      }
      setMovePicker(null);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      Alert.alert(
        movePicker.mode === 'move' ? 'No se pudo mover' : 'No se pudo copiar',
        err.status === 409
          ? 'Ya existe algo con ese nombre en el destino.'
          : err.message || 'Error.'
      );
    } finally {
      setCopying(null);
    }
  };

  // --------------------------------------------------------------------------
  // FAB actions
  // --------------------------------------------------------------------------

  const fabActions: DriveFABActionId[] = useMemo(() => {
    if (tab === 'shared-with-me' || tab === 'trash') return [];
    if (spacesGridMode) {
      const acts: DriveFABActionId[] = [];
      if (canManage) acts.push('new-space');
      return acts;
    }
    if (!activeSpaceId) return [];
    const acts: DriveFABActionId[] = [];
    if (canUpload) {
      acts.push('upload-file');
      if (Platform.OS === 'web') acts.push('upload-folder');
      acts.push('new-folder');
    }
    return acts;
  }, [tab, spacesGridMode, activeSpaceId, canManage, canUpload]);

  // --------------------------------------------------------------------------
  // Header meta
  // --------------------------------------------------------------------------

  const usedRatio = useMemo(() => {
    if (!usageQ.data) return null;
    const used = toBytesNumber(usageQ.data.usedBytes);
    const quota = toBytesNumber(usageQ.data.quotaBytes);
    return quota > 0 ? used / quota : 0;
  }, [usageQ.data]);

  // --------------------------------------------------------------------------
  // Layout de grid
  // --------------------------------------------------------------------------

  const GRID_PADDING = 16;
  const GRID_GAP = 12;
  const cardMinWidth = 140;
  const cardMaxWidth = 200;
  const availableWidth = windowWidth - GRID_PADDING * 2;
  const columns = Math.max(2, Math.floor((availableWidth + GRID_GAP) / (cardMinWidth + GRID_GAP)));
  const cardWidth = Math.min(
    cardMaxWidth,
    Math.floor((availableWidth - GRID_GAP * (columns - 1)) / columns)
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  const renderSpacesGrid = () => (
    <FlatList
      data={sharedSpaces}
      key={`spaces-${columns}`}
      keyExtractor={(s) => s.id}
      numColumns={columns}
      renderItem={({ item }) => (
        <View style={{ margin: GRID_GAP / 2 }}>
          <DriveSpaceCard space={item} onOpen={handleOpenSpaceCard} width={cardWidth} />
        </View>
      )}
      contentContainerStyle={styles.gridContent}
      columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
      ListEmptyComponent={
        <View style={styles.center}>
          <EmptyState
            icon="people-outline"
            title="No perteneces a espacios compartidos"
            description={
              canManage
                ? 'Crea uno con el botón + o pide que te agreguen.'
                : 'Pide a un administrador que te agregue a un espacio.'
            }
          />
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={spacesQ.isFetching && !spacesQ.isLoading}
          onRefresh={onRefresh}
          tintColor={theme.color.brand.primary}
        />
      }
    />
  );

  const renderNodesGrid = () => (
    <FlatList
      data={sortedList}
      key={`nodes-${columns}`}
      keyExtractor={(n) => n.id}
      numColumns={columns}
      renderItem={({ item }) => (
        <View style={{ margin: GRID_GAP / 2 }}>
          <DriveNodeCard
            node={item}
            onOpen={handleOpenNode}
            onMore={(n) => setActionSheetNode(n)}
            width={cardWidth}
          />
        </View>
      )}
      contentContainerStyle={styles.gridContent}
      columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={theme.color.brand.primary}
        />
      }
    />
  );

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
            {tab === 'spaces' && !spacesGridMode && (
              <TouchableOpacity
                onPress={handleBackToSpaces}
                style={styles.pillBtn}
                activeOpacity={activeOpacity.medium}
              >
                <Ionicons name="arrow-back" size={iconSizes.sm} color={theme.color.icon.default} />
                <Text variant="caption">Espacios</Text>
              </TouchableOpacity>
            )}
          </View>

          {browsingEnabled && usageQ.data && usedRatio !== null && (
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

          {browsingEnabled && (
            <DriveBreadcrumb items={breadcrumb} onNavigate={handleBreadcrumbNavigate} />
          )}
          {tab === 'trash' && (
            <View style={styles.banner}>
              <Ionicons name="trash-outline" size={iconSizes.md} color={theme.color.icon.default} />
              <Text variant="bodySmall" color="secondary">
                Papelera del espacio: {activeSpace?.name ?? ''}
              </Text>
            </View>
          )}
          {tab === 'shared-with-me' && (
            <View style={styles.banner}>
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
          {spacesGridMode && (
            <View style={styles.banner}>
              <Ionicons
                name="people-outline"
                size={iconSizes.md}
                color={theme.color.icon.default}
              />
              <Text variant="bodySmall" color="secondary">
                Espacios compartidos ({sharedSpaces.length})
              </Text>
            </View>
          )}
        </View>

        {/* Contenido */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.color.brand.primary} />
          </View>
        ) : spacesGridMode ? (
          renderSpacesGrid()
        ) : sortedList.length === 0 ? (
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
                canUpload && browsingEnabled
                  ? Platform.OS === 'web'
                    ? 'Usa el botón + para subir un archivo, arrastra archivos aquí o pega con Ctrl+V.'
                    : 'Usa el botón + para subir un archivo o crear una carpeta.'
                  : undefined
              }
            />
          </View>
        ) : (
          renderNodesGrid()
        )}

        {/* Drop overlay */}
        {isDragging && (
          <View style={styles.dropOverlay} pointerEvents="none">
            <View style={styles.dropCard}>
              <Ionicons name="cloud-upload-outline" size={48} color={theme.color.brand.primary} />
              <Text variant="titleSmall">Suelta los archivos para subir</Text>
            </View>
          </View>
        )}

        {/* Overlay progreso subida / copia */}
        {(uploading || copying) && (
          <View style={styles.uploadOverlay} pointerEvents="none">
            <View style={styles.uploadCard}>
              <Text variant="bodySmall" numberOfLines={1}>
                {uploading ? 'Subiendo' : 'Copiando'}: {uploading?.name ?? copying?.name}
              </Text>
              <View style={styles.uploadBarTrack}>
                <View
                  style={[
                    styles.uploadBarFill,
                    {
                      width: `${Math.round((uploading ?? copying)!.ratio * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text variant="caption" color="secondary">
                {Math.round((uploading ?? copying)!.ratio * 100)}%
              </Text>
            </View>
          </View>
        )}

        {/* BottomBar + FAB */}
        <DriveBottomBar active={tab} onSelect={handleSelectTab} />
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
        <DriveNodeActionSheet
          visible={!!actionSheetNode}
          node={actionSheetNode}
          actions={nodeActions}
          onSelect={(action, node) => {
            setActionSheetNode(null);
            void handleActionSheet(action, node);
          }}
          onClose={() => setActionSheetNode(null)}
        />
        <RenameNodeModal
          visible={!!renameNode}
          initialName={renameNode?.name ?? ''}
          loading={renameNodeMut.isPending}
          onClose={() => setRenameNode(null)}
          onSubmit={handleRenameSubmit}
        />
        <MoveCopyPickerModal
          visible={!!movePicker}
          mode={movePicker?.mode ?? 'move'}
          sourceNode={movePicker?.node ?? null}
          defaultSpaceId={movePicker?.node.spaceId ?? null}
          loading={moveNodeMut.isPending || !!copying}
          onClose={() => setMovePicker(null)}
          onSubmit={handleMoveCopySubmit}
        />
        <UploadConflictModal
          visible={!!conflict}
          originalName={conflict?.original ?? ''}
          suggestedName={conflict?.suggested ?? ''}
          existingIsFolder={conflict?.existingNode?.kind === 'folder'}
          onResolve={(choice) => void handleConflictResolve(choice)}
        />
        <DriveFileOpenSheet
          visible={!!openSheetNode}
          node={openSheetNode}
          onClose={() => setOpenSheetNode(null)}
          onSelect={(action, node) => {
            setOpenSheetNode(null);
            void handleFileOpenAction(action, node);
          }}
        />
        <CreateSpaceModal
          visible={newSpaceVisible}
          loading={createSpace.isPending}
          onClose={() => setNewSpaceVisible(false)}
          onSubmit={handleCreateSpace}
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
    pillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: theme.space[2],
      paddingVertical: 4,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.muted,
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
    banner: {
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
    gridContent: {
      paddingHorizontal: theme.space[3],
      paddingTop: theme.space[3],
      paddingBottom: 160, // BottomBar + FAB
    },
    gridRow: {
      justifyContent: 'flex-start',
    },
    dropOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: `${theme.color.brand.primary}25`,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 950,
    },
    dropCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[6],
      alignItems: 'center',
      gap: theme.space[2],
      borderWidth: 2,
      borderColor: theme.color.brand.primary,
      borderStyle: 'dashed',
      ...theme.shadow.lg,
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
