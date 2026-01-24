import * as Sentry from '@sentry/react-native';
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

export const initSentry = () => {
  // Only initialize Sentry in production or if explicitly enabled
  const shouldInitialize = !__DEV__ || config.SENTRY_ENABLED;

  if (!shouldInitialize) {
    console.log('🔕 Sentry disabled in development');
    return;
  }

  const sentryDsn = config.SENTRY_DSN;

  if (!sentryDsn) {
    console.warn('⚠️ Sentry DSN not configured. Skipping Sentry initialization.');
    return;
  }

  try {
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

      // Integrations
      integrations: [
        new Sentry.ReactNativeTracing({
          // Routing instrumentation for React Navigation
          routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),

          // Track user interactions
          tracingOrigins: ['localhost', config.API_URL],

          // Enable automatic performance monitoring
          enableUserInteractionTracing: true,
          enableStallTracking: true,
        }),
      ],

      // Before send hook - filter sensitive data
      beforeSend(event: Sentry.Event, hint?: Sentry.EventHint) {
        // Remove sensitive data from events
        if (event.request) {
          // Remove authorization headers
          if (event.request.headers) {
            delete event.request.headers['Authorization'];
            delete event.request.headers['X-Auth-Token'];
          }

          // Remove sensitive query parameters
          if (event.request.query_string) {
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
      beforeBreadcrumb(breadcrumb: Sentry.Breadcrumb, hint?: Sentry.BreadcrumbHint) {
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

    console.log('✅ Sentry initialized successfully');
    console.log(`📊 Environment: ${config.ENVIRONMENT || 'production'}`);
    console.log(`🏷️ Release: ${config.APP_VERSION}`);
  } catch (error) {
    console.error('❌ Failed to initialize Sentry:', error);
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
};

/**
 * Clear user context from Sentry
 * Call this on logout
 */
export const clearSentryUser = () => {
  Sentry.setUser(null);
  Sentry.setContext('company', null);
  Sentry.setContext('site', null);
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
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
};

/**
 * Capture exception manually
 */
export const captureException = (error: Error, context?: Record<string, any>) => {
  if (context) {
    Sentry.setContext('error_context', context);
  }
  Sentry.captureException(error);
};

/**
 * Capture message manually
 */
export const captureMessage = (
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: Record<string, any>
) => {
  if (context) {
    Sentry.setContext('message_context', context);
  }
  Sentry.captureMessage(message, level);
};

/**
 * Start a performance transaction
 */
export const startTransaction = (name: string, op: string) => {
  return Sentry.startTransaction({
    name,
    op,
  });
};

export default Sentry;
