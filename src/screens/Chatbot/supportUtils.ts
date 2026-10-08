import type { SupportCaseType } from '@/services/api/chatbot-support';

export const CASE_TYPE_LABEL: Record<SupportCaseType, string> = {
  DEVOLUCION: 'Devolución',
  PEDIDO_VENCIDO: 'Pedido vencido',
  RECLAMO: 'Reclamo',
  ASESOR: 'Pide asesor',
  CONSULTA: 'Consulta',
};

/** 75 -> "1 h 15 min"; 3000 -> "2 d 2 h". */
export const formatWait = (minutes: number): string => {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
};

/** "12.50" o "12,50" -> 1250; null si no es un monto valido. */
export const parseSolesToCents = (text: string): number | null => {
  const v = Number(String(text).trim().replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * 100);
};

export const soles = (cents: number | null | undefined): string =>
  cents == null ? '-' : `S/ ${(cents / 100).toFixed(2)}`;

export const MONEY_KIND_LABEL: Record<string, string> = {
  REFUND: 'Devolución',
  CREDIT_APPLY: 'Saldo a favor aplicado',
  PRIORITY_DELIVERY: 'Entrega prioritaria',
};

export const PII_LABEL: Record<string, string> = {
  document: 'Documento',
  phone: 'Celular',
  address: 'Dirección',
  email: 'Correo',
};

/** Etiquetas sugeridas para marcar chats. */
export const SUGGESTED_TAGS = [
  'vip',
  'mayorista',
  'reclamo',
  'no contactar',
  'devolución',
  'colegio',
];
