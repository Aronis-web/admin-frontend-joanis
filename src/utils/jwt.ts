/**
 * JWT Token Utilities
 *
 * This module provides utilities for working with JWT tokens in the frontend.
 * It handles token parsing, validation, and user information extraction.
 */

export interface JWTPayload {
  sub: string; // Subject (user ID)
  iat: number; // Issued at
  exp: number; // Expiration
  email?: string;
  name?: string;
  username?: string;
  phone?: string;
  avatar?: string;
  [key: string]: any; // Allow additional claims
}

export interface UserFromToken {
  id: string;
  email: string | null;
  name: string;
  phone?: string;
  avatar?: string;
}

/**
 * Extract user information from a JWT token
 */
export const extractUserFromToken = (token: string): UserFromToken => {
  try {
    if (!token || typeof token !== 'string') {
      throw new Error('Token is required and must be a string');
    }

    // JWT tokens have 3 parts separated by dots: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format - expected 3 parts separated by dots');
    }

    // Decode the payload (second part)
    const payload = parts[1];

    // Handle URL-safe base64 encoding
    const base64Payload = payload.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    const paddedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, '=');

    let decodedPayload: JWTPayload;
    try {
      decodedPayload = JSON.parse(atob(paddedPayload));
    } catch (parseError) {
      throw new Error('Failed to parse JWT payload as JSON');
    }

    // Logs de JWT eliminados para reducir ruido

    // Extract user ID from 'sub' claim (standard JWT subject claim)
    const userId = decodedPayload.sub;
    if (!userId) {
      throw new Error('No user ID (sub claim) found in JWT token');
    }

    // Validate that it's a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error(`Invalid UUID format in token: ${userId}`);
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp && decodedPayload.exp < now) {
      throw new Error('JWT token has expired');
    }

    // Return user object with extracted information
    return {
      id: userId,
      email: decodedPayload.email || null,
      name: decodedPayload.name || decodedPayload.username || 'User',
      phone: decodedPayload.phone || undefined,
      avatar: decodedPayload.avatar || undefined,
    };
  } catch (error) {
    throw new Error(`Failed to extract user from JWT: ${error.message}`);
  }
};

/**
 * Parse JWT token without validation (for debugging)
 */
export const parseJWTToken = (token: string): JWTPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');

    return JSON.parse(atob(paddedPayload));
  } catch (error) {
    return null;
  }
};

/**
 * Check if JWT token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = parseJWTToken(token);
    if (!payload || !payload.exp) {
      return true; // If we can't parse or no exp, assume expired
    }

    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (error) {
    return true;
  }
};

/**
 * Get time until token expires (in seconds)
 */
export const getTokenExpirationTime = (token: string): number => {
  try {
    const payload = parseJWTToken(token);
    if (!payload || !payload.exp) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, payload.exp - now);
  } catch (error) {
    return 0;
  }
};

/**
 * Validate JWT token format
 */
export const validateJWTFormat = (token: string): boolean => {
  try {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Try to parse payload
    const payload = parseJWTToken(token);
    return payload !== null;
  } catch (error) {
    return false;
  }
};

export default {
  extractUserFromToken,
  parseJWTToken,
  isTokenExpired,
  getTokenExpirationTime,
  validateJWTFormat,
};
