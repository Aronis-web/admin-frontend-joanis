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
 */

// Safe import of Sentry - wrapped in try-catch to prevent crashes
let Sentry: any = null;
let sentryInitialized = false;

try {
  Sentry = require('@sentry/react-native');
} catch (error) {
  console.warn('⚠️ Sentry module could not be loaded:', error);
}

export const initSentry = () => {
  // Only initialize Sentry in production or if explicitly enabled
  const shouldInitialize = !__DEV__ || config.SENTRY_ENABLED;

  if (!shouldInitialize) {
    console.log('🔕 Sentry disabled in development');
    return;
  }

  if (!Sentry) {
    console.warn('⚠️ Sentry module not available. Skipping initialization.');
    return;
  }

  const sentryDsn = config.SENTRY_DSN;

  if (!sentryDsn) {
    console.warn('⚠️ Sentry DSN not configured. Skipping Sentry initialization.');
    return;
  }

  try {
    // Check if Sentry.init is a function
    if (typeof Sentry.init !== 'function') {
      console.error('❌ Sentry.init is not a function. Sentry module may be corrupted.');
      return;
    }

    Sentry.init({
      dsn: sentryDsn,

      // Environment configuration
      environment: config.ENVIRONMENT || (__DEV__ ? 'development' : 'production'),

      // Release tracking (use app version from package.json or EAS build)
      release: config.APP_VERSION,
      dist: config.BUILD_NUMBER,

      // Performance Monitoring
      tracesSampleRate: __DEV__ ? 1.0 : 0.2, // 100% in dev, 20% in production
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000, // 30 seconds

      // Error tracking configuration
      enableNative: true,
      enableNativeCrashHandling: true,
      enableNativeNagger: false, // Don't show native crash dialog

      // Breadcrumbs
      maxBreadcrumbs: 100,
      attachStacktrace: true,

      // Network tracking
      enableAutoPerformanceTracing: true,
      enableOutOfMemoryTracking: true,

      // Before send hook - filter sensitive data
      beforeSend(event, hint) {
        // Remove sensitive data from events
        if (event.request) {
          // Remove authorization headers
          if (event.request.headers) {
            delete event.request.headers['Authorization'];
            delete event.request.headers['X-Auth-Token'];
          }

          // Remove sensitive query parameters
          if (event.request.query_string && typeof event.request.query_string === 'string') {
            event.request.query_string = event.request.query_string
              .replace(/token=[^&]*/gi, 'token=[REDACTED]')
              .replace(/password=[^&]*/gi, 'password=[REDACTED]');
          }
        }

        // Remove sensitive data from extra context
        if (event.extra) {
          delete event.extra.token;
          delete event.extra.password;
          delete event.extra.apiKey;
        }

        return event;
      },

      // Before breadcrumb hook - filter sensitive breadcrumbs
      beforeBreadcrumb(breadcrumb, hint) {
        // Don't log console.log breadcrumbs in production
        if (!__DEV__ && breadcrumb.category === 'console') {
          return null;
        }

        // Sanitize HTTP request breadcrumbs
        if (breadcrumb.category === 'http') {
          if (breadcrumb.data?.url) {
            breadcrumb.data.url = breadcrumb.data.url
              .replace(/token=[^&]*/gi, 'token=[REDACTED]')
              .replace(/password=[^&]*/gi, 'password=[REDACTED]');
          }
        }

        return breadcrumb;
      },
    });

    sentryInitialized = true;
    console.log('✅ Sentry initialized successfully');
    console.log(`📊 Environment: ${config.ENVIRONMENT || 'production'}`);
    console.log(`🏷️ Release: ${config.APP_VERSION}`);
  } catch (error) {
    console.error('❌ Failed to initialize Sentry:', error);
    sentryInitialized = false;
  }
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
  if (!Sentry || !sentryInitialized) return;

  try {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    // Set additional context
    Sentry.setContext('company', {
      companyId: user.companyId,
    });

    Sentry.setContext('site', {
      siteId: user.siteId,
    });
  } catch (error) {
    console.warn('⚠️ Failed to set Sentry user:', error);
  }
};

/**
 * Clear user context from Sentry
 * Call this on logout
 */
export const clearSentryUser = () => {
  if (!Sentry || !sentryInitialized) return;

  try {
    Sentry.setUser(null);
    Sentry.setContext('company', null);
    Sentry.setContext('site', null);
  } catch (error) {
    console.warn('⚠️ Failed to clear Sentry user:', error);
  }
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
  if (!Sentry || !sentryInitialized) return;

  try {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  } catch (error) {
    console.warn('⚠️ Failed to add Sentry breadcrumb:', error);
  }
};

/**
 * Capture exception manually
 */
export const captureException = (error: Error, context?: Record<string, any>) => {
  if (!Sentry || !sentryInitialized) {
    console.error('Exception (Sentry not available):', error, context);
    return;
  }

  try {
    if (context) {
      Sentry.setContext('error_context', context);
    }
    Sentry.captureException(error);
  } catch (err) {
    console.warn('⚠️ Failed to capture exception in Sentry:', err);
    console.error('Original exception:', error, context);
  }
};

/**
 * Capture message manually
 */
export const captureMessage = (
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: Record<string, any>
) => {
  if (!Sentry || !sentryInitialized) {
    console.log(`[${level}] ${message}`, context);
    return;
  }

  try {
    if (context) {
      Sentry.setContext('message_context', context);
    }
    Sentry.captureMessage(message, level);
  } catch (error) {
    console.warn('⚠️ Failed to capture message in Sentry:', error);
    console.log(`[${level}] ${message}`, context);
  }
};

/**
 * Add a performance breadcrumb
 */
export const trackPerformance = (name: string, duration: number, metadata?: Record<string, any>) => {
  if (!Sentry || !sentryInitialized) return;

  try {
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `${name} - ${duration}ms`,
      level: 'info',
      data: {
        duration_ms: duration,
        ...metadata,
      },
    });
  } catch (error) {
    console.warn('⚠️ Failed to track performance in Sentry:', error);
  }
};

export default Sentry;
