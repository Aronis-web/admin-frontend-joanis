import { useEffect, useRef } from 'react';
import { trackScreen } from '@/utils/analytics';
import { logger } from '@/utils/logger';
import * as Sentry from '@sentry/react-native';

/**
 * Hook to automatically track screen views and time spent on screen
 * @param screenName - Name of the screen to track
 * @param screenClass - Optional class/component name
 * @param params - Optional additional parameters to track
 */
export const useScreenTracking = (
  screenName: string,
  screenClass?: string,
  params?: Record<string, any>
) => {
  const startTime = useRef(Date.now());
  const hasTracked = useRef(false);

  useEffect(() => {
    // Track screen view on mount
    if (!hasTracked.current) {
      trackScreen(screenName, screenClass, params);
      hasTracked.current = true;

      // Add Sentry breadcrumb
      Sentry.addBreadcrumb({
        category: 'navigation',
        message: `Screen viewed: ${screenName}`,
        level: 'info',
        data: params,
      });

      if (__DEV__) {
        logger.info(`📱 Screen Tracking: ${screenName}`, params);
      }
    }

    // Track time spent on screen when unmounting
    return () => {
      const timeSpent = Date.now() - startTime.current;
      const timeSpentSeconds = Math.round(timeSpent / 1000);

      if (__DEV__) {
        logger.info(`⏱️ Time on ${screenName}: ${timeSpentSeconds}s`);
      }

      // Add Sentry breadcrumb for time spent
      Sentry.addBreadcrumb({
        category: 'navigation',
        message: `Time on ${screenName}: ${timeSpentSeconds}s`,
        level: 'info',
        data: {
          screen_name: screenName,
          duration_seconds: timeSpentSeconds,
          duration_ms: timeSpent,
        },
      });

      // TODO: Track to analytics service
      // trackEvent('screen_time', {
      //   screen: screenName,
      //   duration_seconds: timeSpentSeconds,
      //   duration_ms: timeSpent,
      // });
    };
  }, [screenName, screenClass, params]);
};

/**
 * Hook to track user interactions on a screen
 * @param screenName - Name of the screen
 * @returns Object with tracking functions
 */
export const useInteractionTracking = (screenName: string) => {
  const trackInteraction = (
    interactionType: string,
    interactionTarget: string,
    metadata?: Record<string, any>
  ) => {
    const eventData = {
      screen: screenName,
      interaction_type: interactionType,
      interaction_target: interactionTarget,
      ...metadata,
    };

    if (__DEV__) {
      logger.info(`👆 Interaction: ${interactionType} on ${interactionTarget}`, eventData);
    }

    // Add Sentry breadcrumb
    Sentry.addBreadcrumb({
      category: 'user_interaction',
      message: `${interactionType}: ${interactionTarget}`,
      level: 'info',
      data: eventData,
    });

    // TODO: Track to analytics service
    // trackEvent('user_interaction', eventData);
  };

  const trackButtonPress = (buttonName: string, metadata?: Record<string, any>) => {
    trackInteraction('button_press', buttonName, metadata);
  };

  const trackFormSubmit = (formName: string, metadata?: Record<string, any>) => {
    trackInteraction('form_submit', formName, metadata);
  };

  const trackSearch = (searchTerm: string, resultsCount?: number) => {
    trackInteraction('search', searchTerm, { results_count: resultsCount });
  };

  const trackFilter = (filterType: string, filterValue: string) => {
    trackInteraction('filter', filterType, { filter_value: filterValue });
  };

  const trackSort = (sortField: string, sortDirection: 'asc' | 'desc') => {
    trackInteraction('sort', sortField, { sort_direction: sortDirection });
  };

  return {
    trackInteraction,
    trackButtonPress,
    trackFormSubmit,
    trackSearch,
    trackFilter,
    trackSort,
  };
};

/**
 * Hook to track errors on a screen
 * @param screenName - Name of the screen
 * @returns Function to track errors
 */
export const useErrorTracking = (screenName: string) => {
  const trackError = (
    errorType: string,
    errorMessage: string,
    errorDetails?: Record<string, any>
  ) => {
    const errorData = {
      screen: screenName,
      error_type: errorType,
      error_message: errorMessage,
      ...errorDetails,
    };

    logger.error(`Error on ${screenName}: ${errorMessage}`, errorData);

    // Capture in Sentry
    Sentry.captureMessage(`Screen Error: ${screenName} - ${errorMessage}`, {
      level: 'error',
      contexts: {
        screen: {
          name: screenName,
        },
        error: errorData,
      },
    });

    // TODO: Track to analytics service
    // trackEvent('screen_error', errorData);
  };

  return { trackError };
};
