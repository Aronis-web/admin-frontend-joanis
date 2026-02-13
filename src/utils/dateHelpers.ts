/**
 * Date Helper Functions
 * Utilities to handle date formatting without timezone issues
 */

/**
 * Formats a Date object to YYYY-MM-DD string without timezone offset issues
 * @param date - The date to format
 * @returns String in YYYY-MM-DD format
 */
export const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Gets today's date as YYYY-MM-DD string
 * @returns Today's date in YYYY-MM-DD format
 */
export const getTodayString = (): string => {
  return formatDateToString(new Date());
};

/**
 * Formats a date for display in Spanish locale
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Formatted date string (e.g., "15 dic 2024")
 */
export const formatDisplayDate = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Gets the first day of the current month as YYYY-MM-DD string
 * @returns First day of current month
 */
export const getFirstDayOfMonth = (): string => {
  const date = new Date();
  return formatDateToString(new Date(date.getFullYear(), date.getMonth(), 1));
};

/**
 * Gets the last day of the current month as YYYY-MM-DD string
 * @returns Last day of current month
 */
export const getLastDayOfMonth = (): string => {
  const date = new Date();
  return formatDateToString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};

/**
 * Gets the first day of the current year as YYYY-MM-DD string
 * @returns First day of current year
 */
export const getFirstDayOfYear = (): string => {
  const date = new Date();
  return formatDateToString(new Date(date.getFullYear(), 0, 1));
};

/**
 * Gets the last day of the current year as YYYY-MM-DD string
 * @returns Last day of current year
 */
export const getLastDayOfYear = (): string => {
  const date = new Date();
  return formatDateToString(new Date(date.getFullYear(), 11, 31));
};
