/**
 * Sentry Configuration - DISABLED
 *
 * Sentry has been completely removed from the project.
 * All functions are no-ops (stubs).
 */

export const initSentry = () => {
  console.log('🔕 Sentry is disabled');
};

export const setSentryUser = (user: {
  id: string;
  email?: string;
  username?: string;
  companyId?: string;
  siteId?: string;
}) => {
  // No-op stub
};

export const clearSentryUser = () => {
  // No-op stub
};

export const addSentryBreadcrumb = (
  message: string,
  category: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  data?: Record<string, any>
) => {
  // No-op stub
};

export const captureException = (error: Error, context?: Record<string, any>) => {
  // No-op stub - just log to console
  console.error('Exception:', error, context);
};

export const captureMessage = (
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: Record<string, any>
) => {
  // No-op stub - just log to console
  console.log(`[${level}] ${message}`, context);
};

export const trackPerformance = (name: string, duration: number, metadata?: Record<string, any>) => {
  // No-op stub
};

export default null;
