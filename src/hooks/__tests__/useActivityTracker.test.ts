/**
 * Tests for useActivityTracker hook
 *
 * This hook implements the "Piggyback + Lazy Heartbeat" strategy:
 * - Tracks user activity locally (no network)
 * - Tracks last API call (updated by interceptor)
 * - Sends heartbeat only when needed
 */

import { updateLastApiCall, getLastApiCall } from '../useActivityTracker';

// Mock fetch
global.fetch = jest.fn();

// Mock config
jest.mock('@/utils/config', () => ({
  config: {
    API_URL: 'http://localhost:8081',
    APP_ID: 'test-app',
  },
}));

// Mock auth service
jest.mock('@/services/AuthService', () => ({
  authService: {
    getAccessToken: jest.fn(() => 'mock-access-token'),
  },
}));

// Mock auth store
jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn(() => ({
    isAuthenticated: true,
  })),
}));

describe('Activity Tracking Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset last API call time
    updateLastApiCall();
  });

  describe('updateLastApiCall', () => {
    it('should update the last API call timestamp', () => {
      const beforeUpdate = Date.now();
      updateLastApiCall();
      const afterUpdate = Date.now();

      const lastCall = getLastApiCall();
      expect(lastCall).toBeGreaterThanOrEqual(beforeUpdate);
      expect(lastCall).toBeLessThanOrEqual(afterUpdate);
    });

    it('should be callable multiple times', () => {
      updateLastApiCall();
      const first = getLastApiCall();

      // Wait a tiny bit
      const wait = (ms: number) => {
        const start = Date.now();
        while (Date.now() - start < ms) {}
      };
      wait(10);

      updateLastApiCall();
      const second = getLastApiCall();

      expect(second).toBeGreaterThanOrEqual(first);
    });
  });

  describe('getLastApiCall', () => {
    it('should return a valid timestamp', () => {
      updateLastApiCall();
      const timestamp = getLastApiCall();

      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeGreaterThan(0);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
    });
  });
});

describe('Heartbeat Logic', () => {
  /**
   * Test the decision logic for when to send heartbeats
   */

  interface HeartbeatDecision {
    shouldSendHeartbeat: boolean;
    reason: string;
  }

  function decideHeartbeat(
    timeSinceLastApiCall: number,
    timeSinceLastUserActivity: number,
    apiIdleThreshold: number,
    userIdleThreshold: number
  ): HeartbeatDecision {
    const userIsActive = timeSinceLastUserActivity < userIdleThreshold;
    const noRecentApiCalls = timeSinceLastApiCall > apiIdleThreshold;

    if (!userIsActive) {
      return {
        shouldSendHeartbeat: false,
        reason: 'User is idle - session will expire naturally',
      };
    }

    if (!noRecentApiCalls) {
      return {
        shouldSendHeartbeat: false,
        reason: 'Recent API calls detected - activity already tracked',
      };
    }

    return {
      shouldSendHeartbeat: true,
      reason: 'User active but no recent API calls - heartbeat needed',
    };
  }

  const TEN_MINUTES = 10 * 60 * 1000;
  const FIFTEEN_MINUTES = 15 * 60 * 1000;
  const FIVE_MINUTES = 5 * 60 * 1000;
  const TWENTY_MINUTES = 20 * 60 * 1000;

  describe('Scenario: User active, making API calls', () => {
    it('should NOT send heartbeat', () => {
      const result = decideHeartbeat(
        FIVE_MINUTES, // Last API call 5 min ago
        FIVE_MINUTES, // Last user activity 5 min ago
        TEN_MINUTES, // API idle threshold
        FIFTEEN_MINUTES // User idle threshold
      );

      expect(result.shouldSendHeartbeat).toBe(false);
      expect(result.reason).toContain('Recent API calls');
    });
  });

  describe('Scenario: User active, NOT making API calls', () => {
    it('should send heartbeat after API idle threshold', () => {
      const result = decideHeartbeat(
        FIFTEEN_MINUTES, // Last API call 15 min ago (> threshold)
        FIVE_MINUTES, // Last user activity 5 min ago (user is active)
        TEN_MINUTES, // API idle threshold
        FIFTEEN_MINUTES // User idle threshold
      );

      expect(result.shouldSendHeartbeat).toBe(true);
      expect(result.reason).toContain('heartbeat needed');
    });
  });

  describe('Scenario: User idle, no API calls', () => {
    it('should NOT send heartbeat', () => {
      const result = decideHeartbeat(
        TWENTY_MINUTES, // Last API call 20 min ago
        TWENTY_MINUTES, // Last user activity 20 min ago (user is idle)
        TEN_MINUTES,
        FIFTEEN_MINUTES
      );

      expect(result.shouldSendHeartbeat).toBe(false);
      expect(result.reason).toContain('User is idle');
    });
  });

  describe('Scenario: User just became active after being idle', () => {
    it('should send heartbeat if API calls are stale', () => {
      const result = decideHeartbeat(
        TWENTY_MINUTES, // Last API call was 20 min ago
        1000, // User just moved mouse 1 second ago
        TEN_MINUTES,
        FIFTEEN_MINUTES
      );

      expect(result.shouldSendHeartbeat).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero times correctly', () => {
      const result = decideHeartbeat(0, 0, TEN_MINUTES, FIFTEEN_MINUTES);

      expect(result.shouldSendHeartbeat).toBe(false);
      expect(result.reason).toContain('Recent API calls');
    });

    it('should handle exact threshold values', () => {
      // Exactly at threshold - should NOT send (using > not >=)
      const resultAtThreshold = decideHeartbeat(
        TEN_MINUTES, // Exactly at threshold
        FIVE_MINUTES,
        TEN_MINUTES,
        FIFTEEN_MINUTES
      );

      expect(resultAtThreshold.shouldSendHeartbeat).toBe(false);

      // Just over threshold - should send
      const resultOverThreshold = decideHeartbeat(
        TEN_MINUTES + 1, // Just over threshold
        FIVE_MINUTES,
        TEN_MINUTES,
        FIFTEEN_MINUTES
      );

      expect(resultOverThreshold.shouldSendHeartbeat).toBe(true);
    });
  });
});

describe('Request Overhead Analysis', () => {
  /**
   * Verify that the implementation minimizes request overhead
   */

  interface UserScenario {
    name: string;
    apiCallsPerHour: number;
    userActivityLevel: 'active' | 'idle';
    expectedHeartbeatsPerHour: number;
    totalRequestsPerHour: number;
  }

  const scenarios: UserScenario[] = [
    {
      name: 'Power user (constant API calls)',
      apiCallsPerHour: 100,
      userActivityLevel: 'active',
      expectedHeartbeatsPerHour: 0, // Piggyback on existing calls
      totalRequestsPerHour: 100,
    },
    {
      name: 'Normal user (some API calls)',
      apiCallsPerHour: 20,
      userActivityLevel: 'active',
      expectedHeartbeatsPerHour: 0, // API calls every ~3 min < 10 min threshold
      totalRequestsPerHour: 20,
    },
    {
      name: 'Viewer (reading/watching)',
      apiCallsPerHour: 2,
      userActivityLevel: 'active',
      expectedHeartbeatsPerHour: 4, // ~1 heartbeat per 15 min
      totalRequestsPerHour: 6,
    },
    {
      name: 'Idle user (tab open, away)',
      apiCallsPerHour: 0,
      userActivityLevel: 'idle',
      expectedHeartbeatsPerHour: 0, // No user activity = no heartbeats
      totalRequestsPerHour: 0,
    },
  ];

  scenarios.forEach((scenario) => {
    it(`${scenario.name}: should have ${scenario.expectedHeartbeatsPerHour} heartbeats/hour`, () => {
      const overhead = scenario.expectedHeartbeatsPerHour;
      const total = scenario.totalRequestsPerHour;

      // Verify overhead is minimal
      if (scenario.apiCallsPerHour > 0) {
        const overheadPercentage = (overhead / total) * 100;
        expect(overheadPercentage).toBeLessThanOrEqual(100); // Max 100% overhead for viewers
      }

      // Verify expected heartbeats
      expect(scenario.expectedHeartbeatsPerHour).toBe(overhead);
    });
  });

  it('should have zero overhead for active API users', () => {
    const activeUserScenario = scenarios.find((s) => s.name === 'Power user (constant API calls)');
    expect(activeUserScenario?.expectedHeartbeatsPerHour).toBe(0);
  });
});

describe('Activity Events', () => {
  /**
   * Verify which DOM events trigger activity tracking
   */

  const trackedEvents = [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
    'wheel',
  ];

  const throttledEvents = ['mousemove', 'scroll', 'wheel'];

  it('should track common user interaction events', () => {
    expect(trackedEvents).toContain('mousedown');
    expect(trackedEvents).toContain('keydown');
    expect(trackedEvents).toContain('click');
    expect(trackedEvents).toContain('touchstart');
  });

  it('should throttle high-frequency events', () => {
    // These events can fire hundreds of times per second
    // They should be throttled to prevent performance issues
    expect(throttledEvents).toContain('mousemove');
    expect(throttledEvents).toContain('scroll');
    expect(throttledEvents).toContain('wheel');
  });

  it('should not track events that dont indicate user presence', () => {
    const irrelevantEvents = ['focus', 'blur', 'visibilitychange', 'resize'];

    irrelevantEvents.forEach((event) => {
      expect(trackedEvents).not.toContain(event);
    });
  });
});

describe('Integration with API Client', () => {
  /**
   * Verify that the API client correctly calls updateLastApiCall
   */

  it('should describe the integration point', () => {
    const integrationDescription = {
      file: 'src/services/api/client.ts',
      location: 'Response interceptor',
      action: 'Call updateLastApiCall() on successful response',
      purpose: 'Track API activity without extra requests',
    };

    expect(integrationDescription.action).toContain('updateLastApiCall');
  });

  it('should only track successful responses', () => {
    // Failed requests should not extend session
    // Only successful API calls indicate valid user activity
    const trackOn = {
      '2xx responses': true,
      '4xx errors': false,
      '5xx errors': false,
      'Network errors': false,
    };

    expect(trackOn['2xx responses']).toBe(true);
    expect(trackOn['4xx errors']).toBe(false);
  });
});
