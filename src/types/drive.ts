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
// Niveles de acceso (compartición y membresía)
// ============================================================================

/**
 * Los 4 niveles acumulables que se asignan al compartir un nodo o al agregar
 * un miembro a un espacio. Son idénticos para ambos flujos:
 *  - preview:  solo previsualizar (sin descargar). En backend equivale a
 *    `download`; el frontend oculta el botón de descarga.
 *  - download: previsualizar + descargar.
 *  - editor:   descarga + subir versiones, crear carpetas, renombrar, mover y
 *    re-compartir. NO elimina.
 *  - remover:  editor + enviar a papelera y restaurar.
 */
export type DriveAccessLevel = 'preview' | 'download' | 'editor' | 'remover';

/**
 * Nivel efectivo con el que se navega/gatea un elemento. Añade `owner` (dueño
 * del espacio), que siempre tiene acceso total.
 */
export type DriveEffectiveLevel = DriveAccessLevel | 'owner';

/** Ranking de permisividad para comparar niveles (mayor = más permisivo). */
const ACCESS_RANK: Record<DriveEffectiveLevel, number> = {
  preview: 0,
  download: 1,
  editor: 2,
  remover: 3,
  owner: 4,
};

/** ¿`level` es al menos tan permisivo como `min`? */
export const accessAtLeast = (
  level: DriveEffectiveLevel | null | undefined,
  min: DriveEffectiveLevel
): boolean => {
  if (!level) return false;
  return ACCESS_RANK[level] >= ACCESS_RANK[min];
};

/** Combina varios niveles y devuelve el más permisivo (o null si ninguno). */
export const maxAccessLevel = (
  ...levels: Array<DriveEffectiveLevel | null | undefined>
): DriveEffectiveLevel | null => {
  let best: DriveEffectiveLevel | null = null;
  for (const l of levels) {
    if (!l) continue;
    if (best === null || ACCESS_RANK[l] > ACCESS_RANK[best]) best = l;
  }
  return best;
};

/** Etiqueta legible (ES) para mostrar un nivel en la UI. */
export const ACCESS_LEVEL_LABEL: Record<DriveEffectiveLevel, string> = {
  preview: 'Solo lectura',
  download: 'Ver y descargar',
  editor: 'Editor',
  remover: 'Editor y eliminar',
  owner: 'Propietario',
};

// ============================================================================
// Compartición
// ============================================================================

/** Rol de una compartición de nodo. Alias del conjunto unificado de niveles. */
export type DriveShareRole = DriveAccessLevel;

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
  role: DriveAccessLevel;
}

export interface DriveSharedWithMeItem {
  node: DriveNode;
  sharedRole: DriveShareRole;
  shareId?: string;
  ownerUserId?: string;
  sharedAt?: string;
  sharedBy?: DriveShareUser | null;
}

/**
 * Espacio compartido donde el usuario actual es miembro (Shared Drive).
 * Incluye todos los campos de `DriveSpace` más metadatos de la membresía.
 */
export interface DriveSharedSpace extends DriveSpace {
  myRole: DriveSpaceMemberRole;
  joinedAt?: string;
  owner?: DriveShareUser | null;
}

/**
 * Vista unificada de "Compartido conmigo" (GET /drive/shared): nodos sueltos
 * compartidos directamente + espacios completos donde el usuario es miembro.
 */
export interface DriveSharedResponse {
  nodes: DriveSharedWithMeItem[];
  spaces: DriveSharedSpace[];
}

// ============================================================================
// Miembros de espacio (Shared Drives)
// ============================================================================

/**
 * Rol base de un miembro dentro de un espacio compartido. Usa el mismo conjunto
 * unificado de 4 niveles que el compartir por nodo. Se hereda por todos los
 * nodos del espacio y se combina con el compartir por nodo (gana el más
 * permisivo). La gestión de miembros es exclusiva del dueño del espacio.
 */
export type DriveSpaceMemberRole = DriveAccessLevel;

export interface DriveSpaceMember {
  id: string;
  role: DriveSpaceMemberRole;
  grantedBy?: string | null;
  createdAt?: string;
  user: DriveShareUser;
}

export interface AddDriveSpaceMemberDto {
  userId: string;
  role: DriveSpaceMemberRole;
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
