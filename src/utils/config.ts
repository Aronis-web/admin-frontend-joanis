export const config = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080',
  API_TIMEOUT: 30000,
  APP_ID: 'e28208b8-89b4-4682-80dc-925059424b1f',
  STORAGE_KEYS: {
    AUTH_TOKEN: '@joanis:auth_token',
    REFRESH_TOKEN: '@joanis:refresh_token',
    USER: '@joanis:user',
    TOKEN_EXPIRES_AT: '@joanis:token_expires_at',
    CART: '@joanis:cart',
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
