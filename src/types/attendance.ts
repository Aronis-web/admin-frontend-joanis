/**
 * Tipos del módulo de Asistencia (lado Admin).
 * Cubre la gestión de terminales de marcación y sus tokens.
 * Prefijo de rutas backend: /attendance
 */

export type TerminalStatus = 'active' | 'inactive' | 'maintenance' | 'blocked';

export interface TerminalLocationInfo {
  floor?: string;
  area?: string;
  description?: string;
  [key: string]: unknown;
}

export interface AttendanceTerminal {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  companyId: string;
  siteId: string;
  status: TerminalStatus;
  ipRestriction?: string[] | null;
  locationInfo?: TerminalLocationInfo | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface QueryTerminalsParams {
  companyId?: string;
  siteId?: string;
  status?: TerminalStatus;
  search?: string;
}

export interface CreateTerminalRequest {
  code: string;
  name: string;
  description?: string;
  companyId: string;
  siteId: string;
  ipRestriction?: string[];
  locationInfo?: TerminalLocationInfo;
  metadata?: Record<string, unknown>;
}

export interface UpdateTerminalRequest {
  name?: string;
  description?: string;
  siteId?: string;
  status?: TerminalStatus;
  ipRestriction?: string[];
  locationInfo?: TerminalLocationInfo;
  metadata?: Record<string, unknown>;
}

export interface GenerateTerminalTokenRequest {
  /** Si se envía, actualiza las IPs permitidas antes de generar el token. */
  ipRestriction?: string[];
}

/** Respuesta al generar un token. El token se muestra una única vez. */
export interface GenerateTerminalTokenResult {
  terminalId: string;
  terminalCode: string;
  deviceToken: string;
  generatedAt: string;
  message?: string;
}

export interface TerminalTokenInfo {
  hasToken: boolean;
  generatedAt?: string | null;
  generatedBy?: string | null;
  generatedByUsername?: string | null;
}

export interface TerminalAccessLog {
  id: string;
  action: string;
  ipAddress?: string | null;
  success: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

// ============================================
// Trabajadores en jornada (active-workers / finished-workers)
// ============================================

export type ActiveWorkerStatus = 'working' | 'on_break';
export type FinishedWorkerStatus = 'exit' | 'early_exit';
export type AttendanceWorkerStatus = ActiveWorkerStatus | FinishedWorkerStatus;

export interface AttendanceLastEvent {
  /**
   * ID del registro de asistencia (evento). Requerido para consultar el
   * video de evidencia en `GET /attendance/records/:id/evidence`.
   */
  id?: string;
  code: string;
  time: string;
  /** Indica si el evento cuenta con video de evidencia asociado. */
  hasEvidence?: boolean;
}

export interface AttendanceWorker {
  userId: string;
  username: string;
  fullName: string;
  documentNumber?: string | null;
  siteId: string;
  siteName?: string | null;
  firstEntry: string;
  lastEvent: AttendanceLastEvent;
  status: AttendanceWorkerStatus;
  workedSeconds: number;
  workedHours: number;
  workedHoursLabel: string;
  breakSeconds: number;
  breakHours: number;
  breakHoursLabel: string;
}

export interface AttendanceWorkersQuery {
  /** UUID de la sede a consultar. Requerido por el backend. */
  siteId: string;
  /** Fecha YYYY-MM-DD. Por defecto hoy (Lima). */
  date?: string;
}

export interface AttendanceWorkersResponse {
  siteId: string;
  date: string;
  total: number;
  workers: AttendanceWorker[];
}
