import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { driveApi } from '@/services/api/drive';
import type { UploadOptions } from '@/services/api/drive';
import type {
  CreateDriveFolderDto,
  CreateDriveShareDto,
  CreateDriveSpaceDto,
  DriveChildrenParams,
  DriveNode,
  MoveDriveNodeDto,
  RenameDriveNodeDto,
  UpdateDriveSpaceDto,
} from '@/types/drive';
import { logger } from '@/utils/logger';

// ============================================================================
// Query keys
// ============================================================================

export const driveKeys = {
  all: ['drive'] as const,

  spaces: () => [...driveKeys.all, 'spaces'] as const,
  spaceUsage: (spaceId: string) => [...driveKeys.all, 'space-usage', spaceId] as const,

  spaceChildren: (spaceId: string, params: DriveChildrenParams = {}) =>
    [...driveKeys.all, 'space-children', spaceId, !!params.includeTrashed] as const,
  folderChildren: (folderId: string, params: DriveChildrenParams = {}) =>
    [...driveKeys.all, 'folder-children', folderId, !!params.includeTrashed] as const,

  node: (nodeId: string) => [...driveKeys.all, 'node', nodeId] as const,

  versions: (nodeId: string) => [...driveKeys.all, 'versions', nodeId] as const,
  shares: (nodeId: string) => [...driveKeys.all, 'shares', nodeId] as const,

  trash: (spaceId: string) => [...driveKeys.all, 'trash', spaceId] as const,

  sharedWithMe: () => [...driveKeys.all, 'shared-with-me'] as const,
};

// ============================================================================
// Queries
// ============================================================================

export const useDriveSpaces = (enabled = true) =>
  useQuery({
    queryKey: driveKeys.spaces(),
    queryFn: () => driveApi.listSpaces(),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useDriveSpaceUsage = (spaceId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: driveKeys.spaceUsage(spaceId ?? ''),
    queryFn: () => driveApi.getSpaceUsage(spaceId as string),
    enabled: enabled && !!spaceId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

/**
 * Contenido de la raíz de un espacio. Usa `useDriveFolderChildren` para
 * navegar dentro de una carpeta.
 */
export const useDriveSpaceChildren = (
  spaceId: string | undefined,
  params: DriveChildrenParams = {},
  enabled = true
) =>
  useQuery({
    queryKey: driveKeys.spaceChildren(spaceId ?? '', params),
    queryFn: () => driveApi.listSpaceChildren(spaceId as string, params),
    enabled: enabled && !!spaceId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useDriveFolderChildren = (
  folderId: string | undefined,
  params: DriveChildrenParams = {},
  enabled = true
) =>
  useQuery({
    queryKey: driveKeys.folderChildren(folderId ?? '', params),
    queryFn: () => driveApi.listFolderChildren(folderId as string, params),
    enabled: enabled && !!folderId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useDriveNode = (nodeId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: driveKeys.node(nodeId ?? ''),
    queryFn: () => driveApi.getNode(nodeId as string),
    enabled: enabled && !!nodeId,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useDriveVersions = (nodeId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: driveKeys.versions(nodeId ?? ''),
    queryFn: () => driveApi.listVersions(nodeId as string),
    enabled: enabled && !!nodeId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useDriveShares = (nodeId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: driveKeys.shares(nodeId ?? ''),
    queryFn: () => driveApi.listShares(nodeId as string),
    enabled: enabled && !!nodeId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useDriveTrash = (spaceId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: driveKeys.trash(spaceId ?? ''),
    queryFn: () => driveApi.listTrash(spaceId as string),
    enabled: enabled && !!spaceId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useDriveSharedWithMe = (enabled = true) =>
  useQuery({
    queryKey: driveKeys.sharedWithMe(),
    queryFn: () => driveApi.listSharedWithMe(),
    enabled,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

// ============================================================================
// Invalidaciones helper
// ============================================================================

type QC = ReturnType<typeof useQueryClient>;

const invalidateContainer = (qc: QC, node: Pick<DriveNode, 'spaceId' | 'parentId'>) => {
  if (node.parentId) {
    void qc.invalidateQueries({ queryKey: ['drive', 'folder-children', node.parentId] });
  } else {
    void qc.invalidateQueries({ queryKey: ['drive', 'space-children', node.spaceId] });
  }
};

const invalidateSpaceMeta = (qc: QC, spaceId: string) => {
  void qc.invalidateQueries({ queryKey: driveKeys.spaceUsage(spaceId) });
  void qc.invalidateQueries({ queryKey: driveKeys.spaces() });
};

// ============================================================================
// Mutations - Espacios
// ============================================================================

export const useCreateDriveSpace = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDriveSpaceDto) => driveApi.createSpace(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: driveKeys.spaces() });
    },
    onError: (e) => logger.error('Error creando espacio Drive:', e),
  });
};

export const useUpdateDriveSpace = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDriveSpaceDto }) =>
      driveApi.updateSpace(id, dto),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: driveKeys.spaces() });
      void qc.invalidateQueries({ queryKey: driveKeys.spaceUsage(id) });
    },
    onError: (e) => logger.error('Error actualizando espacio Drive:', e),
  });
};

// ============================================================================
// Mutations - Carpetas / nodos
// ============================================================================

export const useCreateDriveFolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDriveFolderDto) => driveApi.createFolder(dto),
    onSuccess: (node) => invalidateContainer(qc, node),
    onError: (e) => logger.error('Error creando carpeta:', e),
  });
};

export const useRenameDriveNode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, dto }: { nodeId: string; dto: RenameDriveNodeDto }) =>
      driveApi.renameNode(nodeId, dto),
    onSuccess: (node) => {
      qc.setQueryData(driveKeys.node(node.id), (prev: unknown) => {
        if (prev && typeof prev === 'object' && 'node' in prev) {
          return {
            ...(prev as { node: DriveNode; breadcrumb: unknown[] }),
            node,
          };
        }
        return prev;
      });
      invalidateContainer(qc, node);
    },
    onError: (e) => logger.error('Error renombrando nodo:', e),
  });
};

export const useMoveDriveNode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      nodeId: string;
      dto: MoveDriveNodeDto;
      /** Padre anterior para invalidar el contenedor origen. */
      previousParentId: string | null;
      spaceId: string;
    }) => driveApi.moveNode(vars.nodeId, vars.dto),
    onSuccess: (node, vars) => {
      // Invalidar origen
      if (vars.previousParentId) {
        void qc.invalidateQueries({
          queryKey: ['drive', 'folder-children', vars.previousParentId],
        });
      } else {
        void qc.invalidateQueries({
          queryKey: ['drive', 'space-children', vars.spaceId],
        });
      }
      // Invalidar destino
      invalidateContainer(qc, node);
      void qc.invalidateQueries({ queryKey: driveKeys.node(node.id) });
    },
    onError: (e) => logger.error('Error moviendo nodo:', e),
  });
};

// ============================================================================
// Mutations - Subida
// ============================================================================

type UploadArgs =
  | {
      target: 'space';
      spaceId: string;
      file: Blob | File | { uri: string; name: string; type: string };
      filename?: string;
      options?: UploadOptions;
    }
  | {
      target: 'folder';
      folderId: string;
      spaceId: string;
      file: Blob | File | { uri: string; name: string; type: string };
      filename?: string;
      options?: UploadOptions;
    };

export const useUploadDriveFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: UploadArgs) => {
      if (args.target === 'folder') {
        return driveApi.uploadToFolder(args.folderId, args.file, args.filename, args.options);
      }
      return driveApi.uploadToSpace(args.spaceId, args.file, args.filename, args.options);
    },
    onSuccess: (node, vars) => {
      invalidateContainer(qc, node);
      invalidateSpaceMeta(qc, vars.spaceId);
    },
    onError: (e) => logger.error('Error subiendo archivo:', e),
  });
};

export const useUploadDriveVersion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      nodeId,
      file,
      filename,
      options,
    }: {
      nodeId: string;
      spaceId: string;
      file: Blob | File | { uri: string; name: string; type: string };
      filename?: string;
      options?: UploadOptions;
    }) => driveApi.uploadNewVersion(nodeId, file, filename, options),
    onSuccess: (node, vars) => {
      void qc.invalidateQueries({ queryKey: driveKeys.versions(node.id) });
      void qc.invalidateQueries({ queryKey: driveKeys.node(node.id) });
      invalidateContainer(qc, node);
      invalidateSpaceMeta(qc, vars.spaceId);
    },
    onError: (e) => logger.error('Error subiendo versión:', e),
  });
};

export const useRestoreDriveVersion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, versionId }: { nodeId: string; versionId: string }) =>
      driveApi.restoreVersion(nodeId, versionId),
    onSuccess: (node) => {
      void qc.invalidateQueries({ queryKey: driveKeys.versions(node.id) });
      void qc.invalidateQueries({ queryKey: driveKeys.node(node.id) });
      invalidateContainer(qc, node);
    },
    onError: (e) => logger.error('Error restaurando versión:', e),
  });
};

// ============================================================================
// Mutations - Papelera
// ============================================================================

export const useTrashDriveNode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId }: { nodeId: string; spaceId: string; parentId: string | null }) =>
      driveApi.trashNode(nodeId),
    onSuccess: (_res, vars) => {
      invalidateContainer(qc, { spaceId: vars.spaceId, parentId: vars.parentId });
      void qc.invalidateQueries({ queryKey: driveKeys.trash(vars.spaceId) });
      invalidateSpaceMeta(qc, vars.spaceId);
    },
    onError: (e) => logger.error('Error enviando a papelera:', e),
  });
};

export const useRestoreDriveNode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId }: { nodeId: string; spaceId: string }) => driveApi.restoreNode(nodeId),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: driveKeys.trash(vars.spaceId) });
      void qc.invalidateQueries({ queryKey: ['drive', 'space-children', vars.spaceId] });
      void qc.invalidateQueries({ queryKey: ['drive', 'folder-children'] });
      invalidateSpaceMeta(qc, vars.spaceId);
    },
    onError: (e) => logger.error('Error restaurando desde papelera:', e),
  });
};

export const usePermanentDeleteDriveNode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId }: { nodeId: string; spaceId: string }) =>
      driveApi.permanentDeleteNode(nodeId),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: driveKeys.trash(vars.spaceId) });
      invalidateSpaceMeta(qc, vars.spaceId);
    },
    onError: (e) => logger.error('Error borrando definitivamente:', e),
  });
};

// ============================================================================
// Mutations - Compartir
// ============================================================================

export const useCreateDriveShare = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, dto }: { nodeId: string; dto: CreateDriveShareDto }) =>
      driveApi.createShare(nodeId, dto),
    onSuccess: (_res, { nodeId }) => {
      void qc.invalidateQueries({ queryKey: driveKeys.shares(nodeId) });
      void qc.invalidateQueries({ queryKey: driveKeys.sharedWithMe() });
    },
    onError: (e) => logger.error('Error compartiendo nodo:', e),
  });
};

export const useRevokeDriveShare = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shareId }: { shareId: string; nodeId: string }) => driveApi.revokeShare(shareId),
    onSuccess: (_res, { nodeId }) => {
      void qc.invalidateQueries({ queryKey: driveKeys.shares(nodeId) });
      void qc.invalidateQueries({ queryKey: driveKeys.sharedWithMe() });
    },
    onError: (e) => logger.error('Error revocando comparticion:', e),
  });
};
