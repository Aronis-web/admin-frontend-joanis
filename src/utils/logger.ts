/**
 * Logger utility with conditional logging based on environment
 * Only logs in development mode to improve production performance
 */

import { Platform } from 'react-native';

// Check if we're in development mode
const isDevelopment = __DEV__;

export const logger = {
  /**
   * Log informational messages (only in development)
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log error messages (always logged, even in production)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Log warning messages (only in development)
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Log debug messages (only in development)
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Log API requests (only in development)
   */
  api: (method: string, url: string, data?: any) => {
    if (isDevelopment) {
      console.log(`🌐 [API ${method}]`, url, data || '');
    }
  },

  /**
   * Log API responses (only in development)
   */
  apiResponse: (method: string, url: string, status: number, data?: any) => {
    if (isDevelopment) {
      console.log(`✅ [API ${method}] ${status}`, url, data || '');
    }
  },

  /**
   * Log API errors (always logged)
   */
  apiError: (method: string, url: string, error: any) => {
    console.error(`❌ [API ${method}]`, url, error);
  },
};

export default logger;
