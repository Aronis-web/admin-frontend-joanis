import { logger } from './logger';

// Sentry has been removed - using stub
const Sentry: any = null;

/**
 * Performance Monitoring Utility
 *
 * This module provides utilities for measuring and tracking performance metrics
 * using Sentry's performance monitoring capabilities.
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, any>;
}

/**
 * Measure the performance of an async operation
 * @param operationName - Name of the operation being measured
 * @param operation - The async operation to measure
 * @param metadata - Optional metadata to attach to the transaction
 * @returns The result of the operation
 */
export const measurePerformance = async <T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> => {
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    if (__DEV__) {
      logger.info(`⚡ Performance: ${operationName} completed in ${duration}ms`, metadata);
    }

    // Log to Sentry as breadcrumb
    try {
      if (Sentry && typeof Sentry.addBreadcrumb === 'function') {
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `${operationName} - ${duration}ms`,
          level: 'info',
          data: {
            duration_ms: duration,
            ...metadata,
          },
        });
      }
    } catch (err) {
      // Silently fail if Sentry is not available
    }

    return result;
  } catch (error) {
    logger.error(`Performance measurement error for ${operationName}`, error);
    throw error;
  }
};

/**
 * Measure the performance of a synchronous operation
 * @param operationName - Name of the operation being measured
 * @param operation - The sync operation to measure
 * @param metadata - Optional metadata to attach
 * @returns The result of the operation
 */
export const measureSync = <T>(
  operationName: string,
  operation: () => T,
  metadata?: Record<string, any>
): T => {
  const startTime = Date.now();

  try {
    const result = operation();
    const duration = Date.now() - startTime;

    if (__DEV__) {
      logger.info(`⚡ Performance: ${operationName} completed in ${duration}ms`, metadata);
    }

    // Log to Sentry as breadcrumb
    try {
      if (Sentry && typeof Sentry.addBreadcrumb === 'function') {
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `${operationName} - ${duration}ms`,
          level: 'info',
          data: {
            duration_ms: duration,
            ...metadata,
          },
        });
      }
    } catch (err) {
      // Silently fail if Sentry is not available
    }

    return result;
  } catch (error) {
    logger.error(`Performance measurement error for ${operationName}`, error);
    throw error;
  }
};

/**
 * Create a performance measurement for a named operation
 * @param spanName - Name of the span
 * @param operation - The operation to perform
 * @returns The result of the operation
 */
export const createSpan = async <T>(
  spanName: string,
  operation: () => Promise<T>
): Promise<T> => {
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    try {
      if (Sentry && typeof Sentry.addBreadcrumb === 'function') {
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `Span: ${spanName} - ${duration}ms`,
          level: 'info',
          data: { duration_ms: duration },
        });
      }
    } catch (err) {
      // Silently fail if Sentry is not available
    }

    return result;
  } catch (error) {
    logger.error(`Span error: ${spanName}`, error);
    throw error;
  }
};

/**
 * Track API request performance
 * @param endpoint - API endpoint being called
 * @param method - HTTP method
 * @param operation - The API call operation
 * @returns The result of the API call
 */
export const measureApiCall = async <T>(
  endpoint: string,
  method: string,
  operation: () => Promise<T>
): Promise<T> => {
  return measurePerformance(
    `API ${method} ${endpoint}`,
    operation,
    {
      endpoint,
      method,
      type: 'api_call',
    }
  );
};

/**
 * Track screen load performance
 * @param screenName - Name of the screen being loaded
 * @param operation - The screen load operation
 * @returns The result of the operation
 */
export const measureScreenLoad = async <T>(
  screenName: string,
  operation: () => Promise<T>
): Promise<T> => {
  return measurePerformance(
    `Screen Load: ${screenName}`,
    operation,
    {
      screen_name: screenName,
      type: 'screen_load',
    }
  );
};

/**
 * Track database query performance
 * @param queryName - Name/description of the query
 * @param operation - The query operation
 * @returns The result of the query
 */
export const measureQuery = async <T>(
  queryName: string,
  operation: () => Promise<T>
): Promise<T> => {
  return measurePerformance(
    `Query: ${queryName}`,
    operation,
    {
      query_name: queryName,
      type: 'database_query',
    }
  );
};

/**
 * Simple timer class for manual performance tracking
 */
export class PerformanceTimer {
  private startTime: number;
  private name: string;
  private metadata?: Record<string, any>;

  constructor(name: string, metadata?: Record<string, any>) {
    this.name = name;
    this.metadata = metadata;
    this.startTime = Date.now();
  }

  /**
   * Stop the timer and log the duration
   */
  stop(): PerformanceMetric {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    const metric: PerformanceMetric = {
      name: this.name,
      duration,
      startTime: this.startTime,
      endTime,
      metadata: this.metadata,
    };

    if (__DEV__) {
      logger.info(`⏱️ Timer: ${this.name} - ${duration}ms`, this.metadata);
    }

    // Log to Sentry as breadcrumb
    try {
      if (Sentry && typeof Sentry.addBreadcrumb === 'function') {
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `${this.name} - ${duration}ms`,
          level: 'info',
          data: {
            duration_ms: duration,
            ...this.metadata,
          },
        });
      }
    } catch (err) {
      // Silently fail if Sentry is not available
    }

    return metric;
  }

  /**
   * Get elapsed time without stopping the timer
   */
  getElapsed(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Track memory usage (if available)
 */
export const trackMemoryUsage = () => {
  try {
    // @ts-ignore - performance.memory is not standard but available in some environments
    if (typeof performance !== 'undefined' && performance.memory) {
      // @ts-ignore
      const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;

      const memoryInfo = {
        used_mb: Math.round(usedJSHeapSize / 1048576),
        total_mb: Math.round(totalJSHeapSize / 1048576),
        limit_mb: Math.round(jsHeapSizeLimit / 1048576),
      };

      if (__DEV__) {
        logger.info('💾 Memory Usage:', memoryInfo);
      }

      try {
        if (Sentry && typeof Sentry.addBreadcrumb === 'function') {
          Sentry.addBreadcrumb({
            category: 'performance',
            message: 'Memory Usage',
            level: 'info',
            data: memoryInfo,
          });
        }
      } catch (err) {
        // Silently fail if Sentry is not available
      }

      return memoryInfo;
    }
  } catch (error) {
    logger.error('Memory tracking error', error);
  }
  return null;
};

/**
 * Mark a custom performance metric
 * @param metricName - Name of the metric
 * @param value - Value of the metric
 * @param unit - Unit of measurement
 */
export const markMetric = (metricName: string, value: number, unit: string = 'ms') => {
  if (__DEV__) {
    logger.info(`📊 Metric: ${metricName} = ${value}${unit}`);
  }

  try {
    if (Sentry && typeof Sentry.addBreadcrumb === 'function') {
      Sentry.addBreadcrumb({
        category: 'metric',
        message: `${metricName}: ${value}${unit}`,
        level: 'info',
        data: {
          metric_name: metricName,
          value,
          unit,
        },
      });
    }
  } catch (err) {
    // Silently fail if Sentry is not available
  }
};
