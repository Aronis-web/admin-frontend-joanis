import { useQuery } from '@tanstack/react-query';
import { attendanceWorkersApi } from '@/services/api/attendance';
import type { AttendanceWorkersQuery } from '@/types/attendance';

/** Devuelve la fecha de hoy en zona horaria America/Lima como YYYY-MM-DD. */
export const getTodayLimaDate = (): string => {
  // en-CA produce el formato YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
};

// Query keys para trabajadores en jornada
export const attendanceWorkersKeys = {
  all: ['attendance', 'workers'] as const,
  active: (params: AttendanceWorkersQuery) =>
    [...attendanceWorkersKeys.all, 'active', params.siteId, params.date ?? 'today'] as const,
  finished: (params: AttendanceWorkersQuery) =>
    [...attendanceWorkersKeys.all, 'finished', params.siteId, params.date ?? 'today'] as const,
};

/** Trabajadores activos (dentro o en refrigerio) para una sede y día. */
export const useActiveAttendanceWorkers = (
  params: Partial<AttendanceWorkersQuery> & { enabled?: boolean } = {}
) => {
  const { siteId, date, enabled = true } = params;
  const canRun = enabled && !!siteId;

  return useQuery({
    queryKey: attendanceWorkersKeys.active({ siteId: siteId ?? '', date }),
    queryFn: () => attendanceWorkersApi.getActiveWorkers({ siteId: siteId as string, date }),
    enabled: canRun,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Refresca en vivo cuando la vista es de hoy (útil para pantalla operativa)
    refetchInterval: canRun ? 60 * 1000 : false,
  });
};

/** Trabajadores que ya salieron de la sede para el día indicado. */
export const useFinishedAttendanceWorkers = (
  params: Partial<AttendanceWorkersQuery> & { enabled?: boolean } = {}
) => {
  const { siteId, date, enabled = true } = params;
  const canRun = enabled && !!siteId;

  return useQuery({
    queryKey: attendanceWorkersKeys.finished({ siteId: siteId ?? '', date }),
    queryFn: () => attendanceWorkersApi.getFinishedWorkers({ siteId: siteId as string, date }),
    enabled: canRun,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: canRun ? 2 * 60 * 1000 : false,
  });
};
