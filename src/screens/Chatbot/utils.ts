/**
 * Helpers compartidos del módulo Chatbot.
 */
import type { BadgeVariant } from '@/design-system';
import type { PurchaseStage } from '@/types/chatbot';

/** Etiqueta legible del estado de compra (embudo). */
export const PURCHASE_STAGE_LABEL: Record<PurchaseStage, string> = {
  NUEVO: 'Nuevo',
  EXPLORANDO: 'Explorando',
  NEGOCIANDO: 'Negociando',
  POR_PAGAR: 'Por pagar',
  EN_VALIDACION: 'En validación',
  COMPRADO: 'Comprado',
  POSTVENTA: 'Postventa',
  SOPORTE: 'Soporte',
  PERDIDO: 'Perdido',
};

/** Variante de Badge para cada estado de compra. */
export const PURCHASE_STAGE_VARIANT: Record<PurchaseStage, BadgeVariant> = {
  NUEVO: 'info',
  EXPLORANDO: 'default',
  NEGOCIANDO: 'primary',
  POR_PAGAR: 'warning',
  EN_VALIDACION: 'pending',
  COMPRADO: 'success',
  POSTVENTA: 'active',
  SOPORTE: 'danger',
  PERDIDO: 'cancelled',
};

/** Lista ordenada de estados para renderizar filtros. */
export const PURCHASE_STAGES: PurchaseStage[] = [
  'NUEVO',
  'EXPLORANDO',
  'NEGOCIANDO',
  'POR_PAGAR',
  'EN_VALIDACION',
  'COMPRADO',
  'POSTVENTA',
  'SOPORTE',
  'PERDIDO',
];

/** Convierte totalCents (bigint como string) a un string con formato de soles. */
export const formatSolesFromCents = (cents: string | null | undefined): string => {
  if (cents === null || cents === undefined || cents === '') return '-';
  const num = Number(cents) / 100;
  if (Number.isNaN(num)) return '-';
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `S/ ${num.toFixed(2)}`;
  }
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
};

export const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `hace ${days} d`;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
};
