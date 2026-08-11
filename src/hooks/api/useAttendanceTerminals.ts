import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceTerminalsApi } from '@/services/api/attendance';
import {
  QueryTerminalsParams,
  CreateTerminalRequest,
  UpdateTerminalRequest,
  GenerateTerminalTokenRequest,
} from '@/types/attendance';
import { logger } from '@/utils/logger';

// Query keys para terminales de asistencia
export const attendanceTerminalKeys = {
  all: ['attendance', 'terminals'] as const,
  lists: () => [...attendanceTerminalKeys.all, 'list'] as const,
  list: (params?: QueryTerminalsParams) => [...attendanceTerminalKeys.lists(), params] as const,
  details: () => [...attendanceTerminalKeys.all, 'detail'] as const,
  detail: (id: string) => [...attendanceTerminalKeys.details(), id] as const,
  tokenInfo: (id: string) => [...attendanceTerminalKeys.all, 'token-info', id] as const,
  logs: (id: string) => [...attendanceTerminalKeys.all, 'logs', id] as const,
};

/** Lista de terminales con filtros opcionales. */
export const useAttendanceTerminals = (params?: QueryTerminalsParams) => {
  return useQuery({
    queryKey: attendanceTerminalKeys.list(params),
    queryFn: () => attendanceTerminalsApi.getTerminals(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/** Detalle de un terminal por ID. */
export const useAttendanceTerminal = (id: string, enabled = true) => {
  return useQuery({
    queryKey: attendanceTerminalKeys.detail(id),
    queryFn: () => attendanceTerminalsApi.getTerminalById(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000,
  });
};

/** Información del token de un terminal (sin revelarlo). */
export const useTerminalTokenInfo = (id: string, enabled = true) => {
  return useQuery({
    queryKey: attendanceTerminalKeys.tokenInfo(id),
    queryFn: () => attendanceTerminalsApi.getTokenInfo(id),
    enabled: enabled && !!id,
    staleTime: 3 * 60 * 1000,
  });
};

/** Logs de acceso de un terminal. */
export const useTerminalLogs = (id: string, limit = 100, enabled = true) => {
  return useQuery({
    queryKey: attendanceTerminalKeys.logs(id),
    queryFn: () => attendanceTerminalsApi.getTerminalLogs(id, limit),
    enabled: enabled && !!id,
    staleTime: 60 * 1000,
  });
};

/** Crea un terminal e invalida la lista. */
export const useCreateAttendanceTerminal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTerminalRequest) => attendanceTerminalsApi.createTerminal(payload),
    onSuccess: (terminal) => {
      queryClient.invalidateQueries({ queryKey: attendanceTerminalKeys.lists() });
      queryClient.setQueryData(attendanceTerminalKeys.detail(terminal.id), terminal);
      logger.info('Terminal de asistencia creado', { terminalId: terminal.id });
    },
    onError: (error) => {
      logger.error('Error al crear terminal de asistencia', error);
    },
  });
};

/** Actualiza un terminal e invalida caché relacionado. */
export const useUpdateAttendanceTerminal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTerminalRequest }) =>
      attendanceTerminalsApi.updateTerminal(id, data),
    onSuccess: (terminal, variables) => {
      queryClient.setQueryData(attendanceTerminalKeys.detail(variables.id), terminal);
      queryClient.invalidateQueries({ queryKey: attendanceTerminalKeys.lists() });
      logger.info('Terminal de asistencia actualizado', { terminalId: variables.id });
    },
    onError: (error) => {
      logger.error('Error al actualizar terminal de asistencia', error);
    },
  });
};

/** Elimina (soft delete) un terminal. */
export const useDeleteAttendanceTerminal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => attendanceTerminalsApi.deleteTerminal(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: attendanceTerminalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: attendanceTerminalKeys.lists() });
      logger.info('Terminal de asistencia eliminado', { terminalId: id });
    },
    onError: (error) => {
      logger.error('Error al eliminar terminal de asistencia', error);
    },
  });
};

/** Genera (o regenera) el token de un terminal. Devuelve el token en claro una única vez. */
export const useGenerateTerminalToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: GenerateTerminalTokenRequest }) =>
      attendanceTerminalsApi.generateToken(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: attendanceTerminalKeys.tokenInfo(variables.id) });
      queryClient.invalidateQueries({ queryKey: attendanceTerminalKeys.lists() });
      logger.info('Token de terminal generado', { terminalId: variables.id });
    },
    onError: (error) => {
      logger.error('Error al generar token de terminal', error);
    },
  });
};

/** Revoca el token de un terminal. */
export const useRevokeTerminalToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => attendanceTerminalsApi.revokeToken(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: attendanceTerminalKeys.tokenInfo(id) });
      queryClient.invalidateQueries({ queryKey: attendanceTerminalKeys.lists() });
      logger.info('Token de terminal revocado', { terminalId: id });
    },
    onError: (error) => {
      logger.error('Error al revocar token de terminal', error);
    },
  });
};
