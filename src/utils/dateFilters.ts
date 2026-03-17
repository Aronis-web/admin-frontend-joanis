/**
 * Utilidades para filtros de fecha
 * Proporciona rangos predefinidos para evitar consultas sin filtro de fecha
 */

export interface DateRange {
  fromDate: string;
  toDate: string;
  label: string;
}

/**
 * Formatea una fecha a string YYYY-MM-DD
 */
export const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Obtiene la fecha de ayer
 */
export const getYesterday = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date;
};

/**
 * Obtiene la fecha de hoy
 */
export const getToday = (): Date => {
  return new Date();
};

/**
 * Obtiene el rango de fechas para "Ayer"
 */
export const getYesterdayRange = (): DateRange => {
  const yesterday = getYesterday();
  const dateStr = formatDateToString(yesterday);
  return {
    fromDate: dateStr,
    toDate: dateStr,
    label: 'Ayer',
  };
};

/**
 * Obtiene el rango de fechas para "Hoy"
 */
export const getTodayRange = (): DateRange => {
  const today = getToday();
  const dateStr = formatDateToString(today);
  return {
    fromDate: dateStr,
    toDate: dateStr,
    label: 'Hoy',
  };
};

/**
 * Obtiene el rango de fechas para "Últimos 7 días"
 */
export const getLast7DaysRange = (): DateRange => {
  const today = getToday();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  return {
    fromDate: formatDateToString(sevenDaysAgo),
    toDate: formatDateToString(today),
    label: 'Últimos 7 días',
  };
};

/**
 * Obtiene el rango de fechas para "Últimos 15 días"
 */
export const getLast15DaysRange = (): DateRange => {
  const today = getToday();
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(today.getDate() - 15);

  return {
    fromDate: formatDateToString(fifteenDaysAgo),
    toDate: formatDateToString(today),
    label: 'Últimos 15 días',
  };
};

/**
 * Obtiene el rango de fechas para "Últimos 30 días"
 */
export const getLast30DaysRange = (): DateRange => {
  const today = getToday();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  return {
    fromDate: formatDateToString(thirtyDaysAgo),
    toDate: formatDateToString(today),
    label: 'Últimos 30 días',
  };
};

/**
 * Obtiene el rango de fechas para "Este mes"
 */
export const getThisMonthRange = (): DateRange => {
  const today = getToday();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    fromDate: formatDateToString(firstDayOfMonth),
    toDate: formatDateToString(today),
    label: 'Este mes',
  };
};

/**
 * Obtiene el rango de fechas para "Mes anterior"
 */
export const getLastMonthRange = (): DateRange => {
  const today = getToday();
  const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  return {
    fromDate: formatDateToString(firstDayOfLastMonth),
    toDate: formatDateToString(lastDayOfLastMonth),
    label: 'Mes anterior',
  };
};

/**
 * Valida que un rango de fechas no exceda el máximo permitido (90 días)
 */
export const validateDateRange = (fromDate: string, toDate: string, maxDays: number = 90): { valid: boolean; message?: string } => {
  if (!fromDate || !toDate) {
    return {
      valid: false,
      message: 'Las fechas de inicio y fin son obligatorias',
    };
  }

  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return {
      valid: false,
      message: 'Formato de fecha inválido',
    };
  }

  if (from > to) {
    return {
      valid: false,
      message: 'La fecha de inicio no puede ser mayor a la fecha de fin',
    };
  }

  const diffTime = to.getTime() - from.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > maxDays) {
    return {
      valid: false,
      message: `El rango de fechas no puede ser mayor a ${maxDays} días`,
    };
  }

  return { valid: true };
};

/**
 * Filtros rápidos predefinidos
 */
export const QUICK_DATE_FILTERS = {
  YESTERDAY: 'yesterday',
  TODAY: 'today',
  LAST_7_DAYS: 'last7days',
  LAST_15_DAYS: 'last15days',
  LAST_30_DAYS: 'last30days',
  THIS_MONTH: 'thisMonth',
  LAST_MONTH: 'lastMonth',
  CUSTOM: 'custom',
} as const;

export type QuickDateFilter = typeof QUICK_DATE_FILTERS[keyof typeof QUICK_DATE_FILTERS];

/**
 * Obtiene el rango de fechas según el filtro rápido seleccionado
 */
export const getDateRangeByFilter = (filter: QuickDateFilter): DateRange | null => {
  switch (filter) {
    case QUICK_DATE_FILTERS.YESTERDAY:
      return getYesterdayRange();
    case QUICK_DATE_FILTERS.TODAY:
      return getTodayRange();
    case QUICK_DATE_FILTERS.LAST_7_DAYS:
      return getLast7DaysRange();
    case QUICK_DATE_FILTERS.LAST_15_DAYS:
      return getLast15DaysRange();
    case QUICK_DATE_FILTERS.LAST_30_DAYS:
      return getLast30DaysRange();
    case QUICK_DATE_FILTERS.THIS_MONTH:
      return getThisMonthRange();
    case QUICK_DATE_FILTERS.LAST_MONTH:
      return getLastMonthRange();
    case QUICK_DATE_FILTERS.CUSTOM:
      return null;
    default:
      return getYesterdayRange(); // Por defecto: ayer
  }
};

/**
 * Lista de filtros rápidos disponibles
 */
export const AVAILABLE_QUICK_FILTERS: Array<{ key: QuickDateFilter; label: string; icon: string }> = [
  { key: QUICK_DATE_FILTERS.YESTERDAY, label: 'Ayer', icon: '📅' },
  { key: QUICK_DATE_FILTERS.TODAY, label: 'Hoy', icon: '📆' },
  { key: QUICK_DATE_FILTERS.LAST_7_DAYS, label: '7 días', icon: '📊' },
  { key: QUICK_DATE_FILTERS.LAST_15_DAYS, label: '15 días', icon: '📈' },
  { key: QUICK_DATE_FILTERS.LAST_30_DAYS, label: '30 días', icon: '📉' },
  { key: QUICK_DATE_FILTERS.THIS_MONTH, label: 'Este mes', icon: '🗓️' },
  { key: QUICK_DATE_FILTERS.LAST_MONTH, label: 'Mes ant.', icon: '📋' },
];
