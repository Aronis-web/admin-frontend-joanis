// TEMPORARY: Sentry import disabled due to EAS Build issues
// import * as Sentry from '@sentry/react-native';
import { config } from '@/utils/config';

/**
 * Sentry Configuration for Error Tracking and Performance Monitoring
 *
 * Features:
 * - Automatic error tracking
 * - Performance monitoring
 * - Breadcrumbs for debugging
 * - Release tracking
 * - Environment-based configuration
 *
 * NOTE: Sentry is temporarily disabled due to build issues
 */

export const initSentry = () => {
  console.log('⚠️ Sentry temporarily disabled due to build issues');
  return;
};

/**
 * Set user context for Sentry
 * Call this after successful login
 */
export const setSentryUser = (user: {
  id: string;
  email?: string;
  username?: string;
  companyId?: string;
  siteId?: string;
}) => {
  // Sentry.setUser({
  //   id: user.id,
  //   email: user.email,
  //   username: user.username,
  // });

  // // Set additional context
  // Sentry.setContext('company', {
  //   companyId: user.companyId,
  // });

  // Sentry.setContext('site', {
  //   siteId: user.siteId,
  // });
};

/**
 * Clear user context from Sentry
 * Call this on logout
 */
export const clearSentryUser = () => {
  // Sentry.setUser(null);
  // Sentry.setContext('company', null);
  // Sentry.setContext('site', null);
};

/**
 * Add custom breadcrumb
 */
export const addSentryBreadcrumb = (
  message: string,
  category: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  data?: Record<string, any>
) => {
  // Sentry.addBreadcrumb({
  //   message,
  //   category,
  //   level,
  //   data,
  //   timestamp: Date.now() / 1000,
  // });
};

/**
 * Capture exception manually
 */
export const captureException = (error: Error, context?: Record<string, any>) => {
  // if (context) {
  //   Sentry.setContext('error_context', context);
  // }
  // Sentry.captureException(error);
  console.error('Exception:', error, context);
};

/**
 * Capture message manually
 */
export const captureMessage = (
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: Record<string, any>
) => {
  // if (context) {
  //   Sentry.setContext('message_context', context);
  // }
  // Sentry.captureMessage(message, level);
  console.log(`[${level}] ${message}`, context);
};

/**
 * Add a performance breadcrumb
 */
export const trackPerformance = (name: string, duration: number, metadata?: Record<string, any>) => {
  // Sentry.addBreadcrumb({
  //   category: 'performance',
  //   message: `${name} - ${duration}ms`,
  //   level: 'info',
  //   data: {
  //     duration_ms: duration,
  //     ...metadata,
  //   },
  // });
};

// Export a dummy Sentry object to maintain compatibility
export default {
  init: () => {},
  setUser: () => {},
  setContext: () => {},
  addBreadcrumb: () => {},
  captureException: (error: Error) => console.error(error),
  captureMessage: (message: string) => console.log(message),
};
