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
import { useAuthStore } from '@/store/auth';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';

import {
  driveKeys,
  useCreateDriveFolder,
  useCreateDriveSpace,
  useDeleteDriveSpace,
  useDriveFolderChildren,
  useDriveShared,
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
  useUpdateDriveSpace,
  useUploadDriveVersion,
} from '@/hooks/api/useDrive';
import { driveApi } from '@/services/api/drive';
import type { DriveAccessLevel, DriveEffectiveLevel, DriveNode, DriveSpace } from '@/types/drive';
import { accessAtLeast, maxAccessLevel, toBytesNumber } from '@/types/drive';

import DriveBottomBar, { type DriveBottomTab } from '@/components/Drive/DriveBottomBar';
import { ProtectedFAB, type FABAction } from '@/components/ui/ProtectedFAB';
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
import ShareNodeModal from '@/components/Drive/ShareNodeModal';
import SpaceMembersModal from '@/components/Drive/SpaceMembersModal';
import DriveSpaceActionSheet, {
  type SpaceActionId,
} from '@/components/Drive/DriveSpaceActionSheet';
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

/**
 * Snapshot de la navegación interna de Drive (tab / espacio / carpetas) que
 * SOBREVIVE a remontes de la pantalla e incluso a recargas completas del PWA.
 *
 * En web la pantalla puede remontarse por causas ajenas al Drive (throttling/
 * refoco de pestaña, verificación de auth que muestra el loader global, etc.).
 * Y en el PWA de iOS, al volver del segundo plano, WebKit DESCARTA el proceso
 * y RECARGA la página entera: la navegación se restaura por la URL (linking),
 * pero cualquier estado en memoria (incluido este snapshot de módulo) se pierde
 * y el tab volvía a "Mi unidad", perdiendo la pestaña "Compartido".
 *
 * Por eso el snapshot se mantiene en dos niveles:
 *  - memoria de módulo: rápido, cubre remontes dentro del mismo contexto JS.
 *  - localStorage (solo web): durable, sobrevive a la recarga del PWA de iOS.
 */
interface DriveNavSnapshot {
  userId: string | null;
  tab: DriveBottomTab;
  activeSpaceId: string | null;
  folderStack: BreadcrumbItem[];
}

const driveNavMemory: DriveNavSnapshot = {
  userId: null,
  tab: 'my-unit',
  activeSpaceId: null,
  folderStack: [],
};

const DRIVE_TABS: DriveBottomTab[] = ['my-unit', 'spaces', 'shared-with-me', 'trash'];

const isDriveTab = (v: unknown): v is DriveBottomTab =>
  typeof v === 'string' && (DRIVE_TABS as string[]).includes(v);

const DRIVE_NAV_STORAGE_KEY = 'DRIVE_NAV_STATE_V1';

const getWebStorage = (): Storage | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    // Acceso a localStorage puede lanzar (modo privado, sandbox); lo ignoramos.
    return null;
  }
};

const readDriveNavSnapshot = (): DriveNavSnapshot | null => {
  // La memoria de módulo tiene prioridad: cubre remontes dentro del mismo
  // contexto JS y en nativo (donde no hay recargas) es suficiente.
  if (driveNavMemory.userId !== null) return driveNavMemory;

  const storage = getWebStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(DRIVE_NAV_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DriveNavSnapshot>;
    if (!parsed || typeof parsed.tab !== 'string') return null;
    return {
      userId: parsed.userId ?? null,
      tab: parsed.tab as DriveBottomTab,
      activeSpaceId: parsed.activeSpaceId ?? null,
      folderStack: Array.isArray(parsed.folderStack) ? parsed.folderStack : [],
    };
  } catch {
    return null;
  }
};

const writeDriveNavSnapshot = (snap: DriveNavSnapshot): void => {
  driveNavMemory.userId = snap.userId;
  driveNavMemory.tab = snap.tab;
  driveNavMemory.activeSpaceId = snap.activeSpaceId;
  driveNavMemory.folderStack = snap.folderStack;

  const storage = getWebStorage();
  if (!storage) return;
  try {
    storage.setItem(DRIVE_NAV_STORAGE_KEY, JSON.stringify(snap));
  } catch {
    // Cuota/modo privado: ignoramos, la memoria de módulo sigue vigente.
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DriveHomeScreen: React.FC<Props> = (_props) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width: windowWidth } = useWindowDimensions();
  const { hasPermission } = usePermissions();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const qc = useQueryClient();

  const canUpload = hasPermission(PERMISSIONS.DRIVE.UPLOAD);
  const canManage = hasPermission(PERMISSIONS.DRIVE.MANAGE);
  const canShare = hasPermission(PERMISSIONS.DRIVE.SHARE);
  const canRead = hasPermission(PERMISSIONS.DRIVE.READ);

  // --------------------------------------------------------------------------
  // Navegación
  // --------------------------------------------------------------------------

  // Fuente de verdad del tab en web: el query param de la URL. React Navigation
  // sincroniza `route.params` con la URL (vía linking), así que reflejar el tab
  // ahí hace que sobreviva NATIVAMENTE a la recarga completa del PWA de iOS
  // (WebKit descarta el proceso al volver del segundo plano y recarga la página;
  // la URL se conserva). Es más robusto que depender de memoria/localStorage,
  // que el service worker del PWA podría no haber refrescado aún.
  const navigation = useNavigation();
  const route = useRoute();
  const routeTab = (route.params as { driveTab?: unknown } | undefined)?.driveTab;

  // Estado de navegación: se inicializa priorizando el tab de la URL y, si no
  // hay, el snapshot persistido (memoria de módulo o localStorage en web) para
  // que un remonte de la pantalla NO reinicie al usuario a "Mi unidad".
  //
  // El snapshot solo se descarta cuando pertenece de forma inequívoca a OTRO
  // usuario (ambos ids presentes y distintos). Si `userId` aún es null porque la
  // auth se está re-verificando tras la recarga, conservamos el snapshot.
  const restoredNav = React.useRef(readDriveNavSnapshot()).current;
  const restorable =
    !!restoredNav &&
    (restoredNav.userId === null || userId === null || restoredNav.userId === userId);
  const initialNav = restorable ? restoredNav : null;

  const [tab, setTab] = useState<DriveBottomTab>(() =>
    isDriveTab(routeTab) ? routeTab : (initialNav?.tab ?? 'my-unit')
  );
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(
    () => initialNav?.activeSpaceId ?? null
  );
  const [folderStack, setFolderStack] = useState<BreadcrumbItem[]>(
    () => initialNav?.folderStack ?? []
  );

  // Reflejar el tab activo en la URL (query param) para que la recarga del PWA
  // lo restaure. Solo se actualiza si difiere, para no ensuciar el historial.
  //
  // IMPORTANTE: la sincronización es UNIDIRECCIONAL (estado -> URL). No hacemos
  // el camino inverso (URL -> setTab) de forma continua porque el eco/re-parseo
  // del query param en web podía disparar un `setTab(routeTab)` con un valor
  // previo ("my-unit") y REVERTIR la pestaña recién elegida (síntoma reportado
  // al entrar a "Compartido"). La URL solo se lee para el valor INICIAL (ver el
  // useState de `tab`), que es justo lo que se necesita tras una recarga.
  useEffect(() => {
    if (isDriveTab(routeTab) && routeTab === tab) return;
    (navigation as unknown as { setParams: (p: Record<string, unknown>) => void }).setParams({
      driveTab: tab,
    });
  }, [tab, routeTab, navigation]);

  // Persistir cada cambio (memoria de módulo + localStorage en web) para
  // sobrevivir a remontes y a la recarga del PWA de iOS.
  useEffect(() => {
    writeDriveNavSnapshot({ userId, tab, activeSpaceId, folderStack });
  }, [userId, tab, activeSpaceId, folderStack]);

  // Modales
  const [newFolderVisible, setNewFolderVisible] = useState(false);
  const [newSpaceVisible, setNewSpaceVisible] = useState(false);
  const [membersSpace, setMembersSpace] = useState<DriveSpace | null>(null);
  const [spaceActionSheet, setSpaceActionSheet] = useState<DriveSpace | null>(null);
  const [renameSpaceTarget, setRenameSpaceTarget] = useState<DriveSpace | null>(null);
  const [viewerNode, setViewerNode] = useState<DriveNode | null>(null);
  const [openSheetNode, setOpenSheetNode] = useState<DriveNode | null>(null);
  const [actionSheetNode, setActionSheetNode] = useState<DriveNode | null>(null);
  const [shareNode, setShareNode] = useState<DriveNode | null>(null);
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
  // Se habilita siempre: además de pintar "Compartido conmigo", provee el nivel
  // (myRole / sharedRole) para gatear acciones al navegar espacios/nodos ajenos.
  const sharedQ = useDriveShared();
  const sharedWithMeSpaces = useMemo<DriveSpace[]>(
    () => sharedQ.data?.spaces ?? [],
    [sharedQ.data]
  );

  // --------------------------------------------------------------------------
  // Nivel de acceso efectivo (compartición por nodo / membresía de espacio)
  // --------------------------------------------------------------------------

  /** spaceId -> nivel de miembro (myRole) en espacios compartidos donde soy miembro. */
  const sharedSpaceRoleMap = useMemo(() => {
    const m = new Map<string, DriveAccessLevel>();
    for (const sp of sharedQ.data?.spaces ?? []) m.set(sp.id, sp.myRole);
    return m;
  }, [sharedQ.data]);

  /** nodeId -> nivel recibido en nodos compartidos directamente conmigo. */
  const sharedNodeRoleMap = useMemo(() => {
    const m = new Map<string, DriveAccessLevel>();
    for (const it of sharedQ.data?.nodes ?? []) m.set(it.node.id, it.sharedRole);
    return m;
  }, [sharedQ.data]);

  /** Nivel efectivo del espacio: owner si es propio/personal, si no myRole. */
  const levelForSpaceId = useCallback(
    (spaceId: string | null | undefined): DriveEffectiveLevel | null => {
      if (!spaceId) return null;
      const sp =
        spacesQ.data?.find((s) => s.id === spaceId) ??
        (sharedQ.data?.spaces ?? []).find((s) => s.id === spaceId);
      if (sp?.ownerUserId && sp.ownerUserId === userId) return 'owner';
      if (sp?.type === 'personal') return 'owner';
      return sharedSpaceRoleMap.get(spaceId) ?? null;
    },
    [spacesQ.data, sharedQ.data, sharedSpaceRoleMap, userId]
  );

  /**
   * Nivel efectivo de un nodo: combina el compartir directo (si lo hay) con el
   * nivel heredado del espacio, quedándose con el más permisivo. Si no hay
   * información asumimos `preview` (mínimo) para no exponer acciones no
   * permitidas.
   */
  const levelForNode = useCallback(
    (node: DriveNode | null | undefined): DriveEffectiveLevel => {
      if (!node) return 'owner';
      const direct = sharedNodeRoleMap.get(node.id) ?? null;
      const spaceLevel = levelForSpaceId(node.spaceId);
      return maxAccessLevel(direct, spaceLevel) ?? 'preview';
    },
    [sharedNodeRoleMap, levelForSpaceId]
  );
  const usageQ = useDriveSpaceUsage(activeSpaceId ?? undefined, browsingEnabled);

  const activeSpace = useMemo(
    () =>
      spacesQ.data?.find((s) => s.id === activeSpaceId) ??
      sharedWithMeSpaces.find((s) => s.id === activeSpaceId) ??
      null,
    [spacesQ.data, sharedWithMeSpaces, activeSpaceId]
  );

  const breadcrumb: BreadcrumbItem[] = useMemo(
    () => [{ id: null, name: activeSpace?.name ?? 'Mi unidad' }, ...folderStack],
    [activeSpace?.name, folderStack]
  );

  /** Nivel efectivo del espacio que se está navegando ahora mismo. */
  const activeLevel: DriveEffectiveLevel = useMemo(() => {
    if (!activeSpace) return 'owner';
    if (activeSpace.ownerUserId === userId) return 'owner';
    if (activeSpace.type === 'personal') return 'owner';
    // Espacio compartido donde soy miembro: usar myRole; si aún no cargó, mínimo.
    return sharedSpaceRoleMap.get(activeSpace.id) ?? 'preview';
  }, [activeSpace, userId, sharedSpaceRoleMap]);

  const activeCanEdit = accessAtLeast(activeLevel, 'editor');

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  const createFolder = useCreateDriveFolder();
  const createSpace = useCreateDriveSpace();
  const updateSpace = useUpdateDriveSpace();
  const deleteSpace = useDeleteDriveSpace();
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
    if (tab === 'shared-with-me') return (sharedQ.data?.nodes ?? []).map((s) => s.node);
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
    // Calculamos el próximo activeSpaceId de forma síncrona para poder persistir
    // el snapshot ANTES de cualquier render/efecto.
    let nextSpaceId = activeSpaceId;
    if (t === 'my-unit' && personalSpace) nextSpaceId = personalSpace.id;
    if (t === 'spaces') nextSpaceId = null; // grid de espacios
    if (t === 'trash' && !activeSpaceId && personalSpace) nextSpaceId = personalSpace.id;

    // IMPORTANTE: persistir SINCRÓNICAMENTE (memoria + localStorage) en el mismo
    // gesto del tap. Si al entrar a "Compartido" algo provoca un reload en web
    // (p. ej. el LazyErrorBoundary de lazyLoad hace location.reload ante un error
    // de render/chunk), el `useEffect` de persistencia NO alcanza a correr y el
    // tab se perdía volviendo a "Mi unidad". Guardando aquí, tras el reload se
    // restaura la pestaña elegida desde el snapshot.
    writeDriveNavSnapshot({ userId, tab: t, activeSpaceId: nextSpaceId, folderStack: [] });

    setTab(t);
    setFolderStack([]);
    if (nextSpaceId !== activeSpaceId) setActiveSpaceId(nextSpaceId);
  };

  const handleOpenSpaceCard = (s: DriveSpace) => {
    setActiveSpaceId(s.id);
    setFolderStack([]);
  };

  /** Abre un espacio compartido desde la pestaña "Compartido conmigo". */
  const handleOpenSharedSpace = (s: DriveSpace) => {
    setTab('spaces');
    setActiveSpaceId(s.id);
    setFolderStack([]);
  };

  // --------------------------------------------------------------------------
  // Acciones sobre espacios (miembros / renombrar / eliminar)
  // --------------------------------------------------------------------------

  const spaceActions: SpaceActionId[] = useMemo(() => {
    const sp = spaceActionSheet;
    const acts: SpaceActionId[] = [];
    if (!sp) return acts;
    const isOwner = sp.ownerUserId === userId;
    // Ver miembros: dueño o miembro (drive.read).
    if (canRead) acts.push('members');
    // Renombrar/eliminar espacio son exclusivos del dueño.
    if (canManage && isOwner) acts.push('rename', 'delete');
    return acts;
  }, [spaceActionSheet, canRead, canManage, userId]);

  const handleSpaceAction = (id: SpaceActionId, space: DriveSpace) => {
    if (id === 'members') {
      setMembersSpace(space);
      return;
    }
    if (id === 'rename') {
      setRenameSpaceTarget(space);
      return;
    }
    if (id === 'delete') {
      Alert.alert(
        space.name,
        '¿Eliminar este espacio? Se perderá el acceso de todos sus miembros.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () =>
              deleteSpace.mutate(space.id, {
                onSuccess: () => {
                  if (activeSpaceId === space.id) {
                    setActiveSpaceId(null);
                    setFolderStack([]);
                  }
                },
                onError: (e) => {
                  const err = e as { message?: string };
                  Alert.alert('No se pudo eliminar', err.message || 'Error.');
                },
              }),
          },
        ]
      );
    }
  };

  const handleRenameSpaceSubmit = (name: string) => {
    if (!renameSpaceTarget) return;
    updateSpace.mutate(
      { id: renameSpaceTarget.id, dto: { name } },
      {
        onSuccess: () => setRenameSpaceTarget(null),
        onError: (e) => {
          const err = e as { status?: number; message?: string };
          Alert.alert(
            'No se pudo renombrar',
            err.status === 409 ? 'Ya existe un espacio con ese nombre.' : err.message || 'Error.'
          );
        },
      }
    );
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
    enabled: browsingEnabled && canUpload && activeCanEdit && Platform.OS === 'web',
    onFiles: (files) => {
      void handleIncomingFiles(
        files.map((f) => ({ file: f, name: f.name, mimeType: f.type || undefined }))
      );
    },
  });

  // --------------------------------------------------------------------------
  // FAB
  // --------------------------------------------------------------------------

  const handleUpload = useCallback(async () => {
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
  }, [activeSpaceId, handleIncomingFiles]);

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
    // Nivel efectivo del nodo sobre el que se abrió el menú (combina compartir
    // por nodo + membresía de espacio). Determina qué acciones se muestran.
    const level = levelForNode(actionSheetNode);
    const lvlDownload = accessAtLeast(level, 'download');
    const lvlEdit = accessAtLeast(level, 'editor');
    const lvlRemove = accessAtLeast(level, 'remover');
    const isOwner = level === 'owner';

    if (tab === 'trash') {
      const acts: NodeActionId[] = [];
      // Restaurar exige nivel remover (o dueño); borrado definitivo solo dueño.
      if (canManage && lvlRemove) acts.push('restore');
      if (canManage && isOwner) acts.push('delete-forever');
      return acts;
    }

    const acts: NodeActionId[] = ['open'];
    // Renombrar/mover exigen nivel editor.
    if (canManage && lvlEdit) acts.push('rename', 'move');
    // Copiar (solo archivos) requiere poder descargar el origen.
    if (canUpload && lvlDownload && actionSheetNode?.kind === 'file') acts.push('copy');
    // Re-compartir: solo dueño o nivel editor y con permiso drive.share.
    if (canShare && (isOwner || lvlEdit)) acts.push('share');
    // Enviar a papelera exige nivel remover.
    if (canManage && lvlRemove) acts.push('trash');
    return acts;
  }, [tab, canManage, canUpload, canShare, actionSheetNode, levelForNode]);

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
    if (id === 'share') {
      setShareNode(node);
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

  const fabActions: FABAction[] = useMemo(() => {
    if (tab === 'shared-with-me' || tab === 'trash') return [];
    if (spacesGridMode) {
      if (!canManage) return [];
      return [
        {
          icon: 'albums-outline',
          label: 'Nuevo espacio',
          onPress: () => setNewSpaceVisible(true),
        },
      ];
    }
    // Subir / crear carpeta requiere permiso drive.upload Y nivel editor+ sobre
    // el espacio actual (los espacios propios/personales son 'owner').
    if (!activeSpaceId || !canUpload || !activeCanEdit) return [];
    const acts: FABAction[] = [
      {
        icon: 'cloud-upload-outline',
        label: 'Subir archivo',
        onPress: () => void handleUpload(),
      },
    ];
    if (Platform.OS === 'web') {
      acts.push({
        icon: 'folder-open-outline',
        label: 'Subir carpeta',
        onPress: () => void handleUpload(),
      });
    }
    acts.push({
      icon: 'folder-outline',
      label: 'Nueva carpeta',
      onPress: () => setNewFolderVisible(true),
    });
    return acts;
  }, [tab, spacesGridMode, activeSpaceId, canManage, canUpload, activeCanEdit, handleUpload]);

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

  // Niveles efectivos para gatear los modales/sheets abiertos.
  const viewerLevel = levelForNode(viewerNode);
  const viewerCanDownload = accessAtLeast(viewerLevel, 'download');
  const viewerCanEdit = canUpload && accessAtLeast(viewerLevel, 'editor');

  const openSheetCanDownload = accessAtLeast(levelForNode(openSheetNode), 'download');

  const shareNodeLevel = levelForNode(shareNode);
  const canShareThisNode =
    canShare && (shareNodeLevel === 'owner' || accessAtLeast(shareNodeLevel, 'editor'));

  const canManageMembers = !!membersSpace && membersSpace.ownerUserId === userId && canShare;

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
          <DriveSpaceCard
            space={item}
            onOpen={handleOpenSpaceCard}
            onMore={canRead ? (s) => setSpaceActionSheet(s) : undefined}
            width={cardWidth}
          />
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

  /**
   * Pestaña "Compartido conmigo": muestra los espacios compartidos donde soy
   * miembro (cards) seguidos de los nodos sueltos compartidos directamente.
   */
  const renderSharedWithMe = () => (
    <FlatList
      data={sortedList}
      key={`shared-${columns}`}
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
      ListHeaderComponent={
        sharedWithMeSpaces.length > 0 ? (
          <View style={styles.sharedSection}>
            <Text variant="labelMedium" color="secondary" style={styles.sharedSectionLabel}>
              Espacios compartidos conmigo
            </Text>
            <View style={styles.sharedSpacesWrap}>
              {sharedWithMeSpaces.map((sp) => (
                <View key={sp.id} style={{ margin: GRID_GAP / 2 }}>
                  <DriveSpaceCard
                    space={sp}
                    onOpen={handleOpenSharedSpace}
                    onMore={canRead ? (s) => setSpaceActionSheet(s) : undefined}
                    width={cardWidth}
                  />
                </View>
              ))}
            </View>
            {sortedList.length > 0 && (
              <Text variant="labelMedium" color="secondary" style={styles.sharedSectionLabel}>
                Archivos y carpetas compartidos
              </Text>
            )}
          </View>
        ) : null
      }
      ListEmptyComponent={
        sharedWithMeSpaces.length === 0 ? (
          <View style={styles.center}>
            <EmptyState
              icon="share-social-outline"
              title="Aún no te han compartido nada"
              description="Los archivos, carpetas y espacios que te compartan aparecerán aquí."
            />
          </View>
        ) : null
      }
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
            {tab === 'spaces' && !spacesGridMode && activeSpace?.type === 'shared' && canRead && (
              <TouchableOpacity
                onPress={() => activeSpace && setMembersSpace(activeSpace)}
                style={styles.pillBtn}
                activeOpacity={activeOpacity.medium}
              >
                <Ionicons name="people" size={iconSizes.sm} color={theme.color.icon.default} />
                <Text variant="caption">Miembros</Text>
              </TouchableOpacity>
            )}
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
        ) : tab === 'shared-with-me' ? (
          renderSharedWithMe()
        ) : spacesGridMode ? (
          renderSpacesGrid()
        ) : sortedList.length === 0 ? (
          <View style={styles.center}>
            <EmptyState
              icon="folder-open-outline"
              title={tab === 'trash' ? 'Papelera vacía' : 'Esta carpeta está vacía'}
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
        <ProtectedFAB actions={fabActions} />

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
          canDownload={viewerCanDownload}
          canEdit={viewerCanEdit}
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
        <ShareNodeModal
          visible={!!shareNode}
          node={shareNode}
          canShare={canShareThisNode}
          onClose={() => setShareNode(null)}
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
          canDownload={openSheetCanDownload}
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
        <SpaceMembersModal
          visible={!!membersSpace}
          space={membersSpace}
          canManage={canManageMembers}
          onClose={() => setMembersSpace(null)}
        />
        <DriveSpaceActionSheet
          visible={!!spaceActionSheet}
          space={spaceActionSheet}
          actions={spaceActions}
          onSelect={(action, space) => {
            setSpaceActionSheet(null);
            handleSpaceAction(action, space);
          }}
          onClose={() => setSpaceActionSheet(null)}
        />
        <RenameNodeModal
          visible={!!renameSpaceTarget}
          initialName={renameSpaceTarget?.name ?? ''}
          loading={updateSpace.isPending}
          onClose={() => setRenameSpaceTarget(null)}
          onSubmit={handleRenameSpaceSubmit}
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
    sharedSection: {
      width: '100%',
    },
    sharedSectionLabel: {
      marginTop: theme.space[2],
      marginBottom: theme.space[1],
      marginLeft: theme.space[1.5],
    },
    sharedSpacesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
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
