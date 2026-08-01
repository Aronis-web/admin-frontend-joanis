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
