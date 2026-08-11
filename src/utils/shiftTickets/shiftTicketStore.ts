/**
 * Almacén local (base de datos local) de códigos de tickets de turno.
 *
 * Modelo por día (America/Lima):
 *   - La numeración de turnos se reinicia cada medianoche local (Lima, UTC-5,
 *     sin horario de verano).
 *   - Cada ticket queda identificado por la combinación (`date` + `shift`).
 *   - El código de barras incluye la fecha (`YYMMDD`) + turno (4) + random (4),
 *     14 dígitos aptos para Code128 modo C, para trazabilidad al escanear.
 *
 * Persiste con AsyncStorage, por lo que funciona en web/Electron (localStorage)
 * y en nativo (Android/iOS). Permite consultar luego el código por turno o por
 * el propio código escaneado.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';

const STORAGE_KEY = '@joanis/shift-tickets';
const LAST_PRINTED_BY_DATE_KEY = '@joanis/shift-tickets:last-printed-by-date';
/** Clave legacy (contador único global). Se conserva para migración. */
const LEGACY_LAST_PRINTED_KEY = '@joanis/shift-tickets:last-printed';

export interface ShiftTicketRecord {
  /** Fecha local (America/Lima) en formato `YYYY-MM-DD`. */
  date: string;
  /** Número de turno dentro de esa fecha (se reinicia cada día). */
  shift: number;
  /** Código único (numérico, apto para Code128 modo C) impreso como barras. */
  code: string;
  /** ISO timestamp de creación. */
  createdAt: string;
}

/**
 * Devuelve la fecha actual en zona `America/Lima` en formato `YYYY-MM-DD`.
 * Usa `en-CA` que emite justamente ese formato ISO corto.
 */
export const getTodayLima = (): string => {
  try {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    // Fallback manual: Lima es UTC-5 fijo (sin DST).
    const now = new Date();
    const limaMs = now.getTime() - 5 * 60 * 60 * 1000;
    const d = new Date(limaMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
};

/** Convierte un ISO datetime a fecha local Lima `YYYY-MM-DD`. */
const isoToLimaDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return getTodayLima();
  }
};

/**
 * Lee todos los tickets guardados. Migra registros legacy (sin `date`)
 * derivando la fecha del `createdAt`. Ordenados por fecha desc y turno asc.
 */
export const getAllShiftTickets = async (): Promise<ShiftTicketRecord[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<ShiftTicketRecord>>;
    if (!Array.isArray(parsed)) return [];

    let mutated = false;
    const migrated: ShiftTicketRecord[] = parsed
      .filter((r) => r && typeof r.shift === 'number' && typeof r.code === 'string')
      .map((r) => {
        if (r.date && typeof r.date === 'string') return r as ShiftTicketRecord;
        mutated = true;
        return {
          date: isoToLimaDate(r.createdAt ?? new Date().toISOString()),
          shift: r.shift as number,
          code: r.code as string,
          createdAt: r.createdAt ?? new Date().toISOString(),
        };
      });

    if (mutated) {
      await persistAll(migrated);
    }

    return migrated.sort((a, b) => {
      if (a.date === b.date) return a.shift - b.shift;
      return a.date < b.date ? 1 : -1;
    });
  } catch (error) {
    logger.error('Error leyendo tickets de turno locales', error);
    return [];
  }
};

/** Persiste la lista completa de tickets. */
const persistAll = async (records: ShiftTicketRecord[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

/**
 * Genera un código único de 14 dígitos: YYMMDD (6) + turno (4) + random (4).
 * Apto para Code128 modo C (par de dígitos por símbolo).
 */
const buildCandidateCode = (shift: number, date: string): string => {
  const compact = date.replace(/-/g, ''); // YYYYMMDD
  const datePart = compact.slice(2); // YYMMDD
  const shiftPart = String(Math.abs(Math.floor(shift)) % 10000).padStart(4, '0');
  let randomPart = '';
  for (let i = 0; i < 4; i++) randomPart += Math.floor(Math.random() * 10);
  return `${datePart}${shiftPart}${randomPart}`;
};

/**
 * Devuelve el código del turno `shift` en la fecha `date` (por defecto hoy
 * Lima). Si ya existe uno guardado lo reutiliza; si no, genera uno único (sin
 * colisionar con los existentes), lo guarda y lo devuelve.
 */
export const getOrCreateShiftTicket = async (
  shift: number,
  date: string = getTodayLima()
): Promise<ShiftTicketRecord> => {
  const records = await getAllShiftTickets();

  const existing = records.find((r) => r.date === date && r.shift === shift);
  if (existing) return existing;

  const usedCodes = new Set(records.map((r) => r.code));
  let code = buildCandidateCode(shift, date);
  for (let attempt = 0; attempt < 8 && usedCodes.has(code); attempt++) {
    code = buildCandidateCode(shift, date);
  }

  const record: ShiftTicketRecord = {
    date,
    shift,
    code,
    createdAt: new Date().toISOString(),
  };

  records.push(record);
  await persistAll(records);
  return record;
};

/** Busca un ticket por su código de barras (para consultar tras escanear). */
export const findShiftTicketByCode = async (code: string): Promise<ShiftTicketRecord | null> => {
  const target = code.trim();
  if (!target) return null;
  const records = await getAllShiftTickets();
  return records.find((r) => r.code === target) ?? null;
};

/** Elimina un ticket guardado por (fecha, turno). */
export const deleteShiftTicket = async (shift: number, date: string): Promise<void> => {
  const records = await getAllShiftTickets();
  await persistAll(records.filter((r) => !(r.date === date && r.shift === shift)));
};

/** Borra todos los tickets guardados. */
export const clearShiftTickets = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.removeItem(LAST_PRINTED_BY_DATE_KEY);
  await AsyncStorage.removeItem(LEGACY_LAST_PRINTED_KEY);
};

/** Lee el mapa completo `{ [date]: lastShift }` (con migración legacy). */
const readLastPrintedMap = async (): Promise<Record<string, number>> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_PRINTED_BY_DATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, number>;
      if (parsed && typeof parsed === 'object') return parsed;
    }
    // Migración: si existía el contador legacy, lo mapeamos al día de hoy Lima.
    const legacy = await AsyncStorage.getItem(LEGACY_LAST_PRINTED_KEY);
    if (legacy) {
      const value = parseInt(legacy, 10);
      if (!Number.isNaN(value)) {
        const migrated = { [getTodayLima()]: value };
        await AsyncStorage.setItem(LAST_PRINTED_BY_DATE_KEY, JSON.stringify(migrated));
        await AsyncStorage.removeItem(LEGACY_LAST_PRINTED_KEY);
        return migrated;
      }
    }
    return {};
  } catch (error) {
    logger.error('Error leyendo mapa de últimos turnos impresos', error);
    return {};
  }
};

/**
 * Guarda el último turno impreso para la fecha indicada (por defecto hoy Lima),
 * para continuar la numeración la próxima vez que se abra el módulo el mismo
 * día. Al cambiar de día, la numeración arranca en 1.
 */
export const setLastPrintedShift = async (
  shift: number,
  date: string = getTodayLima()
): Promise<void> => {
  try {
    const map = await readLastPrintedMap();
    map[date] = Math.floor(shift);
    await AsyncStorage.setItem(LAST_PRINTED_BY_DATE_KEY, JSON.stringify(map));
  } catch (error) {
    logger.error('Error guardando el último turno impreso', error);
  }
};

/**
 * Devuelve el último turno impreso en la fecha indicada (por defecto hoy Lima),
 * o `null` si aún no se ha impreso ninguno ese día.
 */
export const getLastPrintedShift = async (
  date: string = getTodayLima()
): Promise<number | null> => {
  try {
    const map = await readLastPrintedMap();
    const value = map[date];
    return typeof value === 'number' && !Number.isNaN(value) ? value : null;
  } catch (error) {
    logger.error('Error leyendo el último turno impreso', error);
    return null;
  }
};
