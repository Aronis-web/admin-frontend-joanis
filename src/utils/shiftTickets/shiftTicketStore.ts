/**
 * Almacén local (base de datos local) de códigos de tickets de turno.
 *
 * Guarda, por cada turno impreso, un código único que va codificado en el
 * ticket como código de barras (Code128). Persiste con AsyncStorage, por lo que
 * funciona en web/Electron (localStorage) y en nativo (Android/iOS). Permite
 * consultar luego el código por turno o por el propio código escaneado.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';

const STORAGE_KEY = '@joanis/shift-tickets';
const LAST_PRINTED_KEY = '@joanis/shift-tickets:last-printed';

export interface ShiftTicketRecord {
  /** Número de turno. */
  shift: number;
  /** Código único (numérico, apto para Code128 modo C) impreso como barras. */
  code: string;
  /** ISO timestamp de creación. */
  createdAt: string;
}

/** Lee todos los tickets guardados (ordenados por turno ascendente). */
export const getAllShiftTickets = async (): Promise<ShiftTicketRecord[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ShiftTicketRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => a.shift - b.shift);
  } catch (error) {
    logger.error('Error leyendo tickets de turno locales', error);
    return [];
  }
};

/** Persiste la lista completa de tickets. */
const persistAll = async (records: ShiftTicketRecord[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

/** Genera un código único de 12 dígitos: turno (4) + aleatorio (8). */
const buildCandidateCode = (shift: number): string => {
  const shiftPart = String(Math.abs(Math.floor(shift)) % 10000).padStart(4, '0');
  let randomPart = '';
  for (let i = 0; i < 8; i++) randomPart += Math.floor(Math.random() * 10);
  return `${shiftPart}${randomPart}`;
};

/**
 * Devuelve el código del turno indicado. Si ya existe uno guardado lo reutiliza
 * (para que el mismo turno mantenga siempre el mismo código); si no, genera uno
 * único (sin colisionar con los existentes), lo guarda y lo devuelve.
 */
export const getOrCreateShiftTicket = async (shift: number): Promise<ShiftTicketRecord> => {
  const records = await getAllShiftTickets();

  const existing = records.find((r) => r.shift === shift);
  if (existing) return existing;

  const usedCodes = new Set(records.map((r) => r.code));
  let code = buildCandidateCode(shift);
  for (let attempt = 0; attempt < 8 && usedCodes.has(code); attempt++) {
    code = buildCandidateCode(shift);
  }

  const record: ShiftTicketRecord = {
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

/** Elimina un ticket guardado por turno. */
export const deleteShiftTicket = async (shift: number): Promise<void> => {
  const records = await getAllShiftTickets();
  await persistAll(records.filter((r) => r.shift !== shift));
};

/** Borra todos los tickets guardados. */
export const clearShiftTickets = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};

/**
 * Guarda el último turno impreso, para poder continuar la numeración la próxima
 * vez que se abra el módulo.
 */
export const setLastPrintedShift = async (shift: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_PRINTED_KEY, String(Math.floor(shift)));
  } catch (error) {
    logger.error('Error guardando el último turno impreso', error);
  }
};

/** Devuelve el último turno impreso, o `null` si aún no se ha impreso ninguno. */
export const getLastPrintedShift = async (): Promise<number | null> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_PRINTED_KEY);
    if (!raw) return null;
    const value = parseInt(raw, 10);
    return Number.isNaN(value) ? null : value;
  } catch (error) {
    logger.error('Error leyendo el último turno impreso', error);
    return null;
  }
};
