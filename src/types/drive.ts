/**
 * Tipos del módulo Drive (gestor de archivos tipo Google Drive).
 *
 * Basado en el contrato de API del backend svc-admin (/drive).
 * Notas:
 *  - quotaBytes / usedBytes / sizeBytes pueden llegar como string o number
 *    (el backend documenta string para BigInt); los normalizamos como
 *    number|string en el tipo crudo y exponemos helpers para leerlos.
 */

/** Envoltorio estándar de respuesta del backend. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

/** Byte-count crudo: puede venir como string (BigInt serializado) o number. */
export type ByteSize = number | string;

// ============================================================================
// Espacios
// ============================================================================

export type DriveSpaceType = 'personal' | 'shared';

export interface DriveSpace {
  id: string;
  type: DriveSpaceType;
  name: string;
  quotaBytes: ByteSize;
  usedBytes: ByteSize;
  ownerUserId: string;
}

export interface DriveSpaceUsage {
  spaceId: string;
  quotaBytes: ByteSize;
  usedBytes: ByteSize;
  freeBytes: ByteSize;
}

export interface CreateDriveSpaceDto {
  name: string;
  quotaBytes: number;
}

export interface UpdateDriveSpaceDto {
  name?: string;
  quotaBytes?: number;
}

// ============================================================================
// Nodos (carpetas / archivos)
// ============================================================================

export type DriveNodeKind = 'folder' | 'file';

export interface DriveNode {
  id: string;
  spaceId: string;
  parentId: string | null;
  kind: DriveNodeKind;
  name: string;
  mimeType: string | null;
  sizeBytes: ByteSize;
  isTrashed: boolean;
  currentVersionId: string | null;
  createdAt: string;
}

export interface DriveBreadcrumbItem {
  id: string;
  name: string;
}

export interface DriveNodeWithBreadcrumb {
  node: DriveNode;
  breadcrumb: DriveBreadcrumbItem[];
}

export interface CreateDriveFolderDto {
  spaceId: string;
  parentId: string | null;
  name: string;
}

export interface RenameDriveNodeDto {
  name: string;
}

export interface MoveDriveNodeDto {
  targetParentId: string | null;
}

// ============================================================================
// Listados
// ============================================================================

export interface DriveChildrenParams {
  includeTrashed?: boolean;
}

// ============================================================================
// Versiones
// ============================================================================

export interface DriveVersion {
  id: string;
  nodeId: string;
  versionNo: number;
  sizeBytes: ByteSize;
  mimeType: string | null;
  createdAt: string;
  createdByUserId?: string | null;
  isCurrent?: boolean;
}

// ============================================================================
// Compartición
// ============================================================================

export type DriveShareRole = 'viewer' | 'editor' | 'owner';

export interface DriveShareUser {
  id: string;
  name?: string | null;
  email?: string | null;
  username?: string | null;
}

export interface DriveShare {
  id: string;
  nodeId: string;
  granteeUserId: string;
  role: DriveShareRole;
  createdAt?: string;
  grantee?: DriveShareUser | null;
}

export interface CreateDriveShareDto {
  granteeUserId: string;
  role: Exclude<DriveShareRole, 'owner'>;
}

export interface DriveSharedWithMeItem {
  node: DriveNode;
  sharedRole: DriveShareRole;
  shareId?: string;
  ownerUserId?: string;
  sharedAt?: string;
  sharedBy?: DriveShareUser | null;
}

// ============================================================================
// Respuestas de operaciones
// ============================================================================

export interface DriveAffectedResponse {
  affected: number;
}

export interface DrivePermanentDeleteResponse {
  freedBytes: ByteSize;
}

// ============================================================================
// Helpers
// ============================================================================

/** Convierte un ByteSize (string|number) a number seguro para cálculos JS. */
export const toBytesNumber = (v: ByteSize | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
};
