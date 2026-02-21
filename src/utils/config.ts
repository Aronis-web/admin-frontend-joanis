export const config = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080',
  API_TIMEOUT: 30000,
  API_TIMEOUT_OCR: 0, // Sin límite de tiempo para escaneo OCR
  API_TIMEOUT_BIZLINKS: 60000, // 60 segundos para emisión de comprobantes (firma + consulta + descarga)
  API_TIMEOUT_REMISSION_GUIDE: 90000, // 90 segundos para generación de guías de remisión (incluye comunicación con SUNAT)
  APP_ID: process.env.EXPO_PUBLIC_APP_ID || 'e28208b8-89b4-4682-80dc-925059424b1f',

  // Sentry Configuration
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  SENTRY_ENABLED: process.env.EXPO_PUBLIC_SENTRY_ENABLED === 'true',
  ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT || 'production',
  APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
  BUILD_NUMBER: process.env.EXPO_PUBLIC_BUILD_NUMBER || '1',

  STORAGE_KEYS: {
    // Secure storage keys (expo-secure-store) - for sensitive data
    AUTH_TOKEN: 'auth_token',
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_EXPIRES_AT: 'token_expires_at',
    REMEMBER_ME: 'remember_me',

    // AsyncStorage keys - for non-sensitive data
    USER: '@joanis:user',
    CART: '@joanis:cart',
    CURRENT_COMPANY: '@joanis:current_company',
    CURRENT_SITE: '@joanis:current_site',
  },
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
  },
  IMAGE_QUALITY: {
    THUMBNAIL: 'thumbnail',
    MEDIUM: 'medium',
    LARGE: 'large',
  },
} as const;

export default config;
