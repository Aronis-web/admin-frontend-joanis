/**
 * Utilidades de formato para las pestañas de WhatsApp (notificaciones y
 * consultas).
 */

/** `51999888777:12@s.whatsapp.net` → `+51999888777`. */
export const formatWaJid = (jid: string | null): string | null => {
  if (!jid) return null;
  const raw = jid.split('@')[0]?.split(':')[0];
  return raw ? `+${raw}` : jid;
};

/** `51999888777` → `+51 999 888 777`; otros formatos → `+<dígitos>`. */
export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('51')) {
    return `+51 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return `+${digits}`;
};

/**
 * Normaliza un teléfono ingresado: sólo dígitos; si tiene 9 dígitos se asume
 * Perú y se antepone `51`. Devuelve `null` si no parece válido.
 */
export const normalizePhoneInput = (value: string): string | null => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 9) return `51${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Mensaje del backend (vía apiClient) o un texto por defecto. */
export const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object') {
    const e = err as {
      message?: unknown;
      permissionMessage?: unknown;
      response?: { data?: { message?: unknown } };
    };
    const fromData = e.response?.data?.message;
    if (typeof fromData === 'string' && fromData) return fromData;
    if (Array.isArray(fromData) && fromData.length) return fromData.join('\n');
    if (typeof e.permissionMessage === 'string' && e.permissionMessage) {
      return e.permissionMessage;
    }
    if (typeof e.message === 'string' && e.message) return e.message;
  }
  return fallback;
};
