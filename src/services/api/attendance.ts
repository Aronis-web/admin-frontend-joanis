import { apiClient } from './client';
import {
  AttendanceTerminal,
  QueryTerminalsParams,
  CreateTerminalRequest,
  UpdateTerminalRequest,
  GenerateTerminalTokenRequest,
  GenerateTerminalTokenResult,
  TerminalTokenInfo,
  TerminalAccessLog,
  AttendanceWorker,
  AttendanceWorkersQuery,
  AttendanceWorkersResponse,
} from '@/types/attendance';

/**
 * Servicio de gestión de terminales de asistencia (lado Admin).
 * Todos los endpoints devuelven `{ success: true, ... }`; aquí se extrae el payload útil.
 * Prefijo backend: /attendance/terminals
 */
export const attendanceTerminalsApi = {
  /** GET /attendance/terminals — Lista de terminales con filtros opcionales. */
  async getTerminals(params: QueryTerminalsParams = {}): Promise<AttendanceTerminal[]> {
    const queryParams = new URLSearchParams();

    if (params.companyId) queryParams.append('companyId', params.companyId);
    if (params.siteId) queryParams.append('siteId', params.siteId);
    if (params.status) queryParams.append('status', params.status);
    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const url = `/attendance/terminals${queryString ? `?${queryString}` : ''}`;

    const res = await apiClient.get<{
      success: boolean;
      terminals: AttendanceTerminal[];
      total: number;
    }>(url);
    return res.terminals ?? [];
  },

  /** GET /attendance/terminals/:id — Detalle de un terminal. */
  async getTerminalById(id: string): Promise<AttendanceTerminal> {
    const res = await apiClient.get<{ success: boolean; terminal: AttendanceTerminal }>(
      `/attendance/terminals/${id}`
    );
    return res.terminal;
  },

  /** POST /attendance/terminals — Crea un terminal. */
  async createTerminal(payload: CreateTerminalRequest): Promise<AttendanceTerminal> {
    const res = await apiClient.post<{
      success: boolean;
      terminal: AttendanceTerminal;
      message?: string;
    }>('/attendance/terminals', payload);
    return res.terminal;
  },

  /** PUT /attendance/terminals/:id — Actualiza un terminal. */
  async updateTerminal(id: string, payload: UpdateTerminalRequest): Promise<AttendanceTerminal> {
    const res = await apiClient.put<{
      success: boolean;
      terminal: AttendanceTerminal;
      message?: string;
    }>(`/attendance/terminals/${id}`, payload);
    return res.terminal;
  },

  /** DELETE /attendance/terminals/:id — Eliminación lógica (soft delete). */
  async deleteTerminal(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message?: string }>(`/attendance/terminals/${id}`);
  },

  /** POST /attendance/terminals/:id/token — Genera token (se muestra una sola vez). */
  async generateToken(
    id: string,
    payload: GenerateTerminalTokenRequest = {}
  ): Promise<GenerateTerminalTokenResult> {
    const res = await apiClient.post<{ success: boolean } & GenerateTerminalTokenResult>(
      `/attendance/terminals/${id}/token`,
      payload
    );
    return {
      terminalId: res.terminalId,
      terminalCode: res.terminalCode,
      deviceToken: res.deviceToken,
      generatedAt: res.generatedAt,
      message: res.message,
    };
  },

  /** DELETE /attendance/terminals/:id/token — Revoca el token del terminal. */
  async revokeToken(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message?: string }>(
      `/attendance/terminals/${id}/token`
    );
  },

  /** GET /attendance/terminals/:id/token-info — Info del token sin revelarlo. */
  async getTokenInfo(id: string): Promise<TerminalTokenInfo> {
    const res = await apiClient.get<{ success: boolean; tokenInfo: TerminalTokenInfo }>(
      `/attendance/terminals/${id}/token-info`
    );
    return res.tokenInfo;
  },

  /** GET /attendance/terminals/:id/logs — Logs de acceso del terminal. */
  async getTerminalLogs(id: string, limit = 100): Promise<TerminalAccessLog[]> {
    const res = await apiClient.get<{ success: boolean; logs: TerminalAccessLog[]; total: number }>(
      `/attendance/terminals/${id}/logs?limit=${limit}`
    );
    return res.logs ?? [];
  },
};

export default attendanceTerminalsApi;

/**
 * Servicio de consulta de trabajadores en jornada (lado Admin).
 * Endpoints:
 *   GET /attendance/active-workers   → trabajadores dentro / en refrigerio
 *   GET /attendance/finished-workers → trabajadores que ya salieron
 */
export const attendanceWorkersApi = {
  /** GET /attendance/active-workers — trabajadores activos por sede. */
  async getActiveWorkers(params: AttendanceWorkersQuery): Promise<AttendanceWorkersResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('siteId', params.siteId);
    if (params.date) queryParams.append('date', params.date);

    const res = await apiClient.get<{ success: boolean } & AttendanceWorkersResponse>(
      `/attendance/active-workers?${queryParams.toString()}`
    );

    return {
      siteId: res.siteId,
      date: res.date,
      total: res.total ?? 0,
      workers: res.workers ?? [],
    };
  },

  /** GET /attendance/finished-workers — trabajadores que ya salieron. */
  async getFinishedWorkers(params: AttendanceWorkersQuery): Promise<AttendanceWorkersResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('siteId', params.siteId);
    if (params.date) queryParams.append('date', params.date);

    const res = await apiClient.get<{ success: boolean } & AttendanceWorkersResponse>(
      `/attendance/finished-workers?${queryParams.toString()}`
    );

    return {
      siteId: res.siteId,
      date: res.date,
      total: res.total ?? 0,
      workers: res.workers ?? [],
    };
  },
};

export type { AttendanceWorker };
