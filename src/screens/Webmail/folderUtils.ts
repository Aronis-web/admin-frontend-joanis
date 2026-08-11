import type { Ionicons } from '@expo/vector-icons';
import type { MailFolder } from '@/types/webmail';

type IonIcon = keyof typeof Ionicons.glyphMap;

/** Mapa de nombres amigables por specialUse. */
const SPECIAL_LABELS: Record<string, string> = {
  '\\Inbox': 'Bandeja de entrada',
  '\\Sent': 'Enviados',
  '\\Drafts': 'Borradores',
  '\\Archive': 'Archivo',
  '\\Junk': 'No deseado',
  '\\Trash': 'Papelera',
  '\\All': 'Todos',
  '\\Flagged': 'Destacados',
};

/** Icono Ionicons por specialUse. */
const SPECIAL_ICONS: Record<string, IonIcon> = {
  '\\Inbox': 'mail-outline',
  '\\Sent': 'paper-plane-outline',
  '\\Drafts': 'document-outline',
  '\\Archive': 'archive-outline',
  '\\Junk': 'warning-outline',
  '\\Trash': 'trash-outline',
  '\\All': 'albums-outline',
  '\\Flagged': 'flag-outline',
};

/** Orden preferido para renderizar carpetas del sistema. */
const SPECIAL_ORDER: string[] = [
  '\\Inbox',
  '\\Flagged',
  '\\Drafts',
  '\\Sent',
  '\\Archive',
  '\\Junk',
  '\\Trash',
  '\\All',
];

export const folderLabel = (f: MailFolder): string => {
  if (f.specialUse && SPECIAL_LABELS[f.specialUse]) return SPECIAL_LABELS[f.specialUse];
  // Nombres de carpetas anidadas → mostrar el último segmento
  const parts = f.name.split('/');
  return parts[parts.length - 1] || f.name;
};

export const folderIcon = (f: MailFolder): IonIcon => {
  if (f.specialUse && SPECIAL_ICONS[f.specialUse]) return SPECIAL_ICONS[f.specialUse];
  return 'folder-outline';
};

/** Ordena carpetas: primero especiales en orden preferido, luego el resto alfabético. */
export const sortFolders = (folders: MailFolder[]): MailFolder[] => {
  const rank = (f: MailFolder): number => {
    const idx = f.specialUse ? SPECIAL_ORDER.indexOf(f.specialUse) : -1;
    return idx === -1 ? SPECIAL_ORDER.length + 1 : idx;
  };
  return [...folders].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return folderLabel(a).localeCompare(folderLabel(b));
  });
};

/** Encuentra el path de una carpeta por specialUse. */
export const findFolderPath = (
  folders: MailFolder[] | undefined,
  specialUse: string
): string | null => {
  if (!folders) return null;
  return folders.find((f) => f.specialUse === specialUse)?.path ?? null;
};

/** Formatea bytes en KB/MB/GB. */
export const formatBytes = (bytes: number | null): string => {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/** Devuelve true si la carpeta actual es la Papelera. */
export const isTrash = (folder: string, folders?: MailFolder[]): boolean => {
  const trashPath = findFolderPath(folders, '\\Trash');
  return trashPath === folder || folder === 'INBOX.Trash';
};

/** Devuelve true si la carpeta actual es Spam / Junk. */
export const isSpam = (folder: string, folders?: MailFolder[]): boolean => {
  const junkPath = findFolderPath(folders, '\\Junk');
  return junkPath === folder || folder === 'INBOX.spam' || folder === 'INBOX.Junk';
};

/** Formatea fecha estilo bandeja (hora hoy, fecha corta ayer/otros). */
export const formatMailDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    if (now.getTime() - d.getTime() < oneWeek) {
      return d.toLocaleDateString(undefined, { weekday: 'short' });
    }
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
};

/**
 * Extrae el nombre "amigable" de un remitente "Nombre <email@x>".
 * Si no hay nombre, devuelve la parte local del email.
 */
export const parseSender = (raw: string): { name: string; email: string } => {
  if (!raw) return { name: '', email: '' };
  const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].replace(/^"|"$/g, '').trim(), email: match[2].trim() };
  }
  return { name: raw.split('@')[0] ?? raw, email: raw };
};
