import type {
  FamilyStatus,
  SmartPurchaseOrderStatus,
  SupplierViability,
} from '@/types/smartPurchase';

// ============================================
// Formateadores
// ============================================

export const formatDate = (iso?: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const formatRelative = (iso?: string | null): string => {
  if (!iso) return 'nunca';
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffMs = now - then;
    if (diffMs < 60_000) return 'ahora';
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs} h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `hace ${days} d`;
    return formatDate(iso);
  } catch {
    return formatDate(iso);
  }
};

/** Convierte cents (string decimal) a moneda PEN legible. */
export const formatCents = (cents?: string | number | null, currency = 'PEN'): string => {
  if (cents === undefined || cents === null || cents === '') return '—';
  const n = typeof cents === 'string' ? Number(cents) : cents;
  if (Number.isNaN(n)) return String(cents);
  const value = n / 100;
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

export const formatPct = (n?: number | null, digits = 1): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
};

export const formatNumber = (n?: number | null, digits = 0): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
};

/** Devuelve `n.toFixed(digits)` o `fallback` si `n` es null/undefined/NaN. */
export const safeFixed = (n?: number | null, digits = 2, fallback = '—'): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return fallback;
  return n.toFixed(digits);
};

// ============================================
// Viabilidad de proveedor
// ============================================

export const VIABILITY_LABEL: Record<SupplierViability, string> = {
  IDEAL: 'Ideal',
  VIABLE: 'Viable',
  CONDICIONADO: 'Condicionado',
  NO_RECOMENDADO: 'No recomendado',
};

export const VIABILITY_COLOR: Record<SupplierViability, string> = {
  IDEAL: '#10B981',
  VIABLE: '#3B82F6',
  CONDICIONADO: '#F59E0B',
  NO_RECOMENDADO: '#EF4444',
};

export const VIABILITY_OPTIONS: Array<{ label: string; value: SupplierViability | 'ALL' }> = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Ideal', value: 'IDEAL' },
  { label: 'Viable', value: 'VIABLE' },
  { label: 'Condicionado', value: 'CONDICIONADO' },
  { label: 'No recomendado', value: 'NO_RECOMENDADO' },
];

// ============================================
// Estado familia
// ============================================

export const FAMILY_STATUS_LABEL: Record<FamilyStatus, string> = {
  ACTIVE: 'Activa',
  BLOCKED: 'Bloqueada',
  EXCLUDED: 'Excluida',
};

export const FAMILY_STATUS_COLOR: Record<FamilyStatus, string> = {
  ACTIVE: '#10B981',
  BLOCKED: '#F59E0B',
  EXCLUDED: '#6B7280',
};

export const FAMILY_STATUS_OPTIONS: Array<{ label: string; value: FamilyStatus | 'ALL' }> = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Activas', value: 'ACTIVE' },
  { label: 'Bloqueadas', value: 'BLOCKED' },
  { label: 'Excluidas', value: 'EXCLUDED' },
];

// ============================================
// Estado de orden
// ============================================

export const ORDER_STATUS_LABEL: Record<SmartPurchaseOrderStatus, string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobada',
  SENT: 'Enviada',
  CANCELLED: 'Cancelada',
};

export const ORDER_STATUS_COLOR: Record<SmartPurchaseOrderStatus, string> = {
  DRAFT: '#6B7280',
  APPROVED: '#3B82F6',
  SENT: '#10B981',
  CANCELLED: '#EF4444',
};

export const ORDER_STATUS_OPTIONS: Array<{
  label: string;
  value: SmartPurchaseOrderStatus | 'ALL';
}> = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Borrador', value: 'DRAFT' },
  { label: 'Aprobada', value: 'APPROVED' },
  { label: 'Enviada', value: 'SENT' },
  { label: 'Cancelada', value: 'CANCELLED' },
];
