/**
 * Production-Safe Logger Utility
 *
 * Conditional logging based on environment:
 * - Development: All logs enabled
 * - Production: Only errors and critical warnings
 *
 * Features:
 * - Automatic sanitization of sensitive data (tokens, passwords)
 * - Timestamp formatting
 * - Environment-aware logging
 * - Sentry integration for error tracking
 *
 * Usage:
 *   logger.info('User logged in', { userId: user.id });
 *   logger.error('API call failed', error);
 *   logger.debug('Debug info', data);
 */

import { captureException, captureMessage, addSentryBreadcrumb } from '@/config/sentry';

// Determine environment - check multiple sources for reliability
const isDevelopment = __DEV__;
const isProduction = !__DEV__;

/**
 * Format log message with timestamp and context
 */
function formatMessage(level: string, ...args: any[]): any[] {
  if (!isDevelopment) {
    // In production, don't add extra formatting to reduce overhead
    return args;
  }
  const timestamp = new Date().toISOString();
  return [`[${timestamp}] [${level}]`, ...args];
}

/**
 * Sanitize sensitive data from logs
 * Removes tokens, passwords, and other sensitive information
 */
function sanitizeArgs(args: any[]): any[] {
  if (!isProduction) {
    // In development, don't sanitize for easier debugging
    return args;
  }

  return args.map((arg) => {
    if (typeof arg === 'object' && arg !== null) {
      const sanitized = { ...arg };

      // Remove sensitive fields
      const sensitiveKeys = [
        'token',
        'password',
        'accessToken',
        'refreshToken',
        'authorization',
        'apiKey',
        'secret',
        'credential',
      ];

      for (const key in sanitized) {
        if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
          sanitized[key] = '[REDACTED]';
        }
      }

      return sanitized;
    }
    return arg;
  });
}

export const logger = {
  /**
   * General logging - only in development
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...formatMessage('LOG', ...args));
    }
  },

  /**
   * Info level - general information
   * Only logged in development
   * Adds breadcrumb to Sentry for context
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...formatMessage('INFO', ...args));
    }
    // Add breadcrumb for Sentry context
    if (typeof args[0] === 'string') {
      addSentryBreadcrumb(args[0], 'info', 'info', args[1]);
    }
  },

  /**
   * Warning level - potential issues
   * Logged in development, critical warnings in production
   * Critical warnings sent to Sentry
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...formatMessage('WARN', ...args));
    } else if (isProduction) {
      // Only log critical warnings in production
      const message = args[0];
      if (
        typeof message === 'string' &&
        (message.includes('CRITICAL') || message.includes('Security') || message.includes('Auth'))
      ) {
        console.warn(...formatMessage('WARN', ...sanitizeArgs(args)));
        // Send critical warnings to Sentry
        captureMessage(message, 'warning', args[1]);
      }
    }
  },

  /**
   * Error level - errors and exceptions
   * Always logged (development and production) with sanitized data
   * Also sent to Sentry in production
   */
  error: (...args: any[]) => {
    console.error(...formatMessage('ERROR', ...sanitizeArgs(args)));

    // Send to Sentry if it's an Error object
    if (args[0] instanceof Error) {
      const error = args[0];
      const context = args[1] && typeof args[1] === 'object' ? args[1] : undefined;
      captureException(error, context);
    } else if (typeof args[0] === 'string') {
      // If it's a string message, capture as message
      captureMessage(args[0], 'error', args[1]);
    }
  },

  /**
   * Debug level - detailed debugging information
   * Only logged in development
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...formatMessage('DEBUG', ...args));
    }
  },

  /**
   * Performance logging
   * Only logged in development
   */
  perf: (label: string, startTime: number) => {
    if (isDevelopment) {
      const duration = Date.now() - startTime;
      console.log(...formatMessage('PERF', `${label}: ${duration}ms`));
    }
  },

  /**
   * Group logging - only in development
   */
  group: (label: string, callback: () => void) => {
    if (isDevelopment) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  },

  /**
   * Network logging - API calls, responses
   * Only logged in development
   */
  network: (method: string, url: string, data?: any) => {
    if (isDevelopment) {
      console.log(...formatMessage('NETWORK', `${method} ${url}`, data || ''));
    }
  },

  /**
   * Security logging - authentication, authorization events
   * Always logged but with sanitized data
   */
  security: (...args: any[]) => {
    console.log(...formatMessage('SECURITY', ...sanitizeArgs(args)));
  },
};

export default logger;
