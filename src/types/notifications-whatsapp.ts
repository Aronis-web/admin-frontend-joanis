/**
 * WhatsApp de Notificaciones — Tipos compartidos.
 *
 * Sesión del número saliente de notificaciones (reparto, documentos de
 * empleados, exports, campañas). Es una sesión independiente del chatbot de
 * ventas, gestionada por Baileys en el backend.
 *
 * API base: `/notifications/whatsapp`.
 */

export type NotifWaStatus = 'DISCONNECTED' | 'CONNECTING' | 'QR' | 'CONNECTED';

export interface NotifWaSessionStatus {
  status: NotifWaStatus;
  me: string | null;
}

export interface NotifWaQrResponse {
  qr: string | null;
}

/** Código de emparejamiento para vincular por número (sin QR). */
export interface NotifWaPairResponse {
  /** Código de 8 caracteres, formateado `XXXX-XXXX`. */
  code: string;
  /** Número normalizado (sólo dígitos, con código de país). */
  phone: string;
}
