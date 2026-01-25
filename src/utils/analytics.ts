import { logger } from './logger';

/**
 * Analytics Tracking Utility
 *
 * This module provides a centralized way to track user events and screen views.
 * Currently logs events to console and Sentry. Can be extended to support
 * Firebase Analytics, Mixpanel, or other analytics services.
 */

export interface AnalyticsEvent {
  name: string;
  params?: Record<string, any>;
  timestamp?: number;
}

export interface ScreenViewEvent {
  screenName: string;
  screenClass?: string;
  params?: Record<string, any>;
}

/**
 * Track a custom event
 * @param eventName - Name of the event to track
 * @param params - Optional parameters associated with the event
 */
export const trackEvent = async (
  eventName: string,
  params?: Record<string, any>
): Promise<void> => {
  try {
    const event: AnalyticsEvent = {
      name: eventName,
      params,
      timestamp: Date.now(),
    };

    // Log to console in development
    if (__DEV__) {
      logger.info(`📊 Analytics Event: ${eventName}`, params);
    }

    // TODO: Add Firebase Analytics integration
    // await analytics().logEvent(eventName, params);

    // TODO: Add Mixpanel integration
    // Mixpanel.track(eventName, params);

  } catch (error) {
    logger.error('Analytics tracking error', error);
  }
};

/**
 * Track a screen view
 * @param screenName - Name of the screen being viewed
 * @param screenClass - Optional class/component name of the screen
 * @param params - Optional additional parameters
 */
export const trackScreen = async (
  screenName: string,
  screenClass?: string,
  params?: Record<string, any>
): Promise<void> => {
  try {
    const event: ScreenViewEvent = {
      screenName,
      screenClass: screenClass || screenName,
      params,
    };

    // Log to console in development
    if (__DEV__) {
      logger.info(`📱 Screen View: ${screenName}`, params);
    }

    // TODO: Add Firebase Analytics integration
    // await analytics().logScreenView({
    //   screen_name: screenName,
    //   screen_class: screenClass || screenName,
    // });

  } catch (error) {
    logger.error('Screen tracking error', error);
  }
};

/**
 * Set user properties for analytics
 * @param properties - User properties to set
 */
export const setUserProperties = async (
  properties: Record<string, any>
): Promise<void> => {
  try {
    if (__DEV__) {
      logger.info('👤 User Properties:', properties);
    }

    // TODO: Add Firebase Analytics integration
    // await analytics().setUserProperties(properties);

  } catch (error) {
    logger.error('Set user properties error', error);
  }
};

/**
 * Set user ID for analytics
 * @param userId - User ID to set
 */
export const setUserId = async (userId: string): Promise<void> => {
  try {
    if (__DEV__) {
      logger.info('👤 User ID:', userId);
    }

    // TODO: Add Firebase Analytics integration
    // await analytics().setUserId(userId);

  } catch (error) {
    logger.error('Set user ID error', error);
  }
};

// ============================================
// Pre-defined Event Tracking Functions
// ============================================

// Authentication Events
export const trackLogin = (method: string = 'email') => {
  trackEvent('user_login', { method });
};

export const trackLogout = () => {
  trackEvent('user_logout');
};

export const trackLoginFailed = (reason?: string) => {
  trackEvent('login_failed', { reason });
};

// Product Events
export const trackProductViewed = (productId: string, productName: string, category?: string) => {
  trackEvent('product_viewed', {
    product_id: productId,
    product_name: productName,
    category,
  });
};

export const trackProductSearched = (searchTerm: string, resultsCount: number) => {
  trackEvent('product_searched', {
    search_term: searchTerm,
    results_count: resultsCount,
  });
};

export const trackProductFiltered = (filters: Record<string, any>) => {
  trackEvent('product_filtered', filters);
};

export const trackProductCreated = (productId: string, productName: string) => {
  trackEvent('product_created', {
    product_id: productId,
    product_name: productName,
  });
};

export const trackProductUpdated = (productId: string, productName: string) => {
  trackEvent('product_updated', {
    product_id: productId,
    product_name: productName,
  });
};

// Campaign Events
export const trackCampaignCreated = (campaignId: string, campaignName: string) => {
  trackEvent('campaign_created', {
    campaign_id: campaignId,
    campaign_name: campaignName,
  });
};

export const trackCampaignViewed = (campaignId: string, campaignName: string) => {
  trackEvent('campaign_viewed', {
    campaign_id: campaignId,
    campaign_name: campaignName,
  });
};

export const trackCampaignPublished = (campaignId: string, campaignName: string) => {
  trackEvent('campaign_published', {
    campaign_id: campaignId,
    campaign_name: campaignName,
  });
};

export const trackCampaignClosed = (campaignId: string, campaignName: string) => {
  trackEvent('campaign_closed', {
    campaign_id: campaignId,
    campaign_name: campaignName,
  });
};

// Cart Events
export const trackProductAddedToCart = (productId: string, productName: string, quantity: number) => {
  trackEvent('product_added_to_cart', {
    product_id: productId,
    product_name: productName,
    quantity,
  });
};

export const trackProductRemovedFromCart = (productId: string, productName: string) => {
  trackEvent('product_removed_from_cart', {
    product_id: productId,
    product_name: productName,
  });
};

export const trackCartCleared = (itemsCount: number) => {
  trackEvent('cart_cleared', {
    items_count: itemsCount,
  });
};

export const trackOrderCreated = (orderId: string, totalAmount: number, itemsCount: number) => {
  trackEvent('order_created', {
    order_id: orderId,
    total_amount: totalAmount,
    items_count: itemsCount,
  });
};

// Expense Events
export const trackExpenseCreated = (expenseId: string, amount: number, category?: string) => {
  trackEvent('expense_created', {
    expense_id: expenseId,
    amount,
    category,
  });
};

export const trackExpenseApproved = (expenseId: string, amount: number) => {
  trackEvent('expense_approved', {
    expense_id: expenseId,
    amount,
  });
};

export const trackExpenseRejected = (expenseId: string, amount: number, reason?: string) => {
  trackEvent('expense_rejected', {
    expense_id: expenseId,
    amount,
    reason,
  });
};

// Feature Usage Events
export const trackFeatureUsed = (featureName: string, params?: Record<string, any>) => {
  trackEvent('feature_used', {
    feature_name: featureName,
    ...params,
  });
};

// Error Events
export const trackError = (errorType: string, errorMessage: string, context?: Record<string, any>) => {
  trackEvent('error_occurred', {
    error_type: errorType,
    error_message: errorMessage,
    ...context,
  });
};
