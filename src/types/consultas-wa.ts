/**
 * WhatsApp de Consultas — Tipos compartidos.
 *
 * Número interno donde el personal autorizado consulta ventas por WhatsApp y
 * recibe respuestas. Sesión independiente del chatbot de ventas y del número
 * de notificaciones.
 *
 * API base: `/consultas-wa`.
 */

export type ConsultaWaSessionState = 'DISCONNECTED' | 'CONNECTING' | 'QR' | 'CONNECTED';

export interface ConsultaWaSessionStatus {
  status: ConsultaWaSessionState;
  me: string | null;
}

export interface ConsultaWaQrResponse {
  qr: string | null;
}

export interface ConsultaWaUserOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface ConsultaWaSiteOption {
  id: string;
  name: string;
  isFranchise: boolean;
}

export interface ConsultaWaOptions {
  users: ConsultaWaUserOption[];
  sites: ConsultaWaSiteOption[];
}

export type ConsultaWaContactStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';

export interface ConsultaWaContact {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  phone: string;
  status: ConsultaWaContactStatus;
  /** Vacío = todas las sedes. */
  siteIds: string[];
  sites: Array<{ id: string; name: string }>;
  /** Permisos efectivos del usuario (para avisar si le falta `consultas_wa.usar`). */
  permissions: string[];
  codeSentAt: string | null;
  verifiedAt: string | null;
  lastQueryAt: string | null;
  createdAt: string;
}

export interface CreateConsultaWaContactDto {
  userId: string;
  phone: string;
  siteIds: string[];
}

export interface UpdateConsultaWaContactDto {
  siteIds: string[];
}

export type ConsultaWaQueryStatus = 'RECEIVED' | 'ANSWERED' | 'FAILED' | 'IGNORED' | 'RATE_LIMITED';

export interface ConsultaWaQuery {
  id: string;
  contactId: string | null;
  contactName: string | null;
  phone: string;
  question: string;
  answer: string | null;
  status: ConsultaWaQueryStatus;
  tools: string[];
  createdAt: string;
  answeredAt: string | null;
}
