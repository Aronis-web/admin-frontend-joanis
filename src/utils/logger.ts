/**
 * Logger utility for production-safe logging
 * Only logs in development mode to reduce overhead in production
 */

const isDevelopment = __DEV__;

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  error: (...args: any[]) => {
    // Always log errors, even in production
    console.error(...args);
  },

  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  // Performance logging - only in development
  perf: (label: string, startTime: number) => {
    if (isDevelopment) {
      const duration = Date.now() - startTime;
      console.log(`⏱️ [PERF] ${label}: ${duration}ms`);
    }
  },

  // Group logging - only in development
  group: (label: string, callback: () => void) => {
    if (isDevelopment) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  },
};

export default logger;
