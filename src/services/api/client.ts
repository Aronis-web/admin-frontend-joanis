import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Platform } from 'react-native';
import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { authService } from '@/services/AuthService';
import { TenantContext } from '@/types/companies';
import logger from '@/utils/logger';
import { updateLastApiCall } from '@/hooks/useActivityTracker';

/**
 * En web con cookies HttpOnly, los tokens ya no viajan en JS. El backend
 * emite ademas una cookie `csrf_token` LEGIBLE por JS (no-HttpOnly) que el
 * cliente re-envia como header X-CSRF-Token en requests mutantes
 * (patron double-submit: un origen atacante puede provocar el envio de la
 * cookie de sesion pero NO puede leer csrf_token para replicarlo).
 */
const COOKIE_AUTH_WEB = config.USE_COOKIE_AUTH_WEB && Platform.OS === 'web';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const parts = document.cookie.split('; ');
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

class ApiClient {
  private client: AxiosInstance;
  private refreshAttempts = 0;
  private readonly maxRefreshAttempts = 2;
  private tenantContext: TenantContext = {};

  constructor() {
    this.client = axios.create({
      baseURL: config.API_URL,
      timeout: config.API_TIMEOUT,
      // Solo se envian cookies cross-site cuando el backend este configurado
      // para cookies HttpOnly + CORS con Access-Control-Allow-Credentials.
      withCredentials: COOKIE_AUTH_WEB,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Set the multi-tenant context for subsequent requests
   * This will add X-Company-Id, X-Site-Id, X-Warehouse-Id headers
   */
  setTenantContext(context: TenantContext): void {
    this.tenantContext = { ...this.tenantContext, ...context };
  }

  /**
   * Get the current tenant context
   */
  getTenantContext(): TenantContext {
    return { ...this.tenantContext };
  }

  /**
   * Clear the tenant context
   */
  clearTenantContext(): void {
    this.tenantContext = {};
  }

  /**
   * Clear specific tenant context fields
   */
  clearTenantContextFields(...fields: (keyof TenantContext)[]): void {
    fields.forEach((field) => {
      delete this.tenantContext[field];
    });
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (requestConfig) => {
        const authStore = useAuthStore.getState();
        const tenantStore = useTenantStore.getState();
        const { token, user, currentCompany, currentSite } = authStore;
        const { selectedCompany, selectedSite, selectedWarehouse } = tenantStore;

        // REMOVED: Proactive token refresh to prevent race conditions
        // Token refresh will only happen reactively on 401 errors
        // This prevents multiple simultaneous refresh calls

        // Detect if this is a FormData request
        const isFormData = requestConfig.data instanceof FormData;

        // If it's FormData, remove Content-Type to let React Native handle it
        // React Native's FormData will automatically set the correct Content-Type with boundary
        if (isFormData && requestConfig.headers) {
          // Delete any existing Content-Type - React Native will add it with boundary
          delete requestConfig.headers['Content-Type'];
          delete requestConfig.headers['content-type'];

          // Also remove from common header variations
          Object.keys(requestConfig.headers).forEach((key) => {
            if (key.toLowerCase() === 'content-type') {
              delete (requestConfig.headers as any)[key];
            }
          });

          logger.debug(
            '📦 FormData detected - removing Content-Type to let React Native handle boundary'
          );
          logger.debug('📋 Headers after cleanup:', Object.keys(requestConfig.headers));
        }

        // Add Authorization header if token is available
        // Prefer authService token, fallback to store token
        const currentToken = authService.getAccessToken() || token;
        if (COOKIE_AUTH_WEB) {
          // Cookie HttpOnly maneja la sesion. En mutaciones, patron double-submit CSRF.
          const method = (requestConfig.method || 'get').toUpperCase();
          if (MUTATING_METHODS.has(method)) {
            const csrf = readCookie('csrf_token');
            if (csrf) {
              requestConfig.headers['X-CSRF-Token'] = csrf;
            } else {
              logger.warn('⚠️ CSRF token cookie missing on mutating request');
            }
          }
        } else if (currentToken) {
          requestConfig.headers.Authorization = `Bearer ${currentToken}`;
          logger.debug('✅ Authorization header set with token length:', currentToken.length);
        } else {
          logger.warn('⚠️ No token available - user may not be authenticated');
        }

        // Special logging for /transfers endpoint to debug auth issues
        if (requestConfig.url?.includes('/transfers')) {
          logger.debug('🔍 /transfers Request Details:', {
            url: requestConfig.url,
            method: requestConfig.method,
            hasToken: !!currentToken,
            tokenLength: currentToken?.length || 0,
            authServiceToken: !!authService.getAccessToken(),
            storeToken: !!token,
            userId: user?.id,
            isAuthenticated: authStore.isAuthenticated,
          });
        }

        // Add X-App-Id header to all requests (required by API)
        const appId = config.APP_ID;
        if (!appId) {
          logger.error('❌ CRITICAL: X-App-Id is undefined! This will cause 400 errors.');
        }
        logger.debug('🔑 Setting X-App-Id header:', appId);
        // Setear una sola vez: los headers HTTP son case-insensitive y duplicar
        // la clave (X-App-Id + x-app-id) puede terminar en un valor doblado.
        requestConfig.headers['X-App-Id'] = appId;

        // Add X-App-Version header to all requests (for version control)
        const appVersion = config.APP_VERSION;
        logger.debug('📱 Setting X-App-Version header:', appVersion);
        requestConfig.headers['X-App-Version'] = appVersion;

        // Auto-sync tenant context from stores (prefer tenant store, fallback to auth store)
        const effectiveCompanyId =
          selectedCompany?.id || currentCompany?.id || this.tenantContext.companyId;
        const effectiveSiteId = selectedSite?.id || currentSite?.id || this.tenantContext.siteId;
        const effectiveWarehouseId = selectedWarehouse?.id || this.tenantContext.warehouseId;
        const effectiveUserId = user?.id || this.tenantContext.userId;

        // Add multi-tenant context headers
        if (effectiveUserId) {
          requestConfig.headers['X-User-Id'] = effectiveUserId;
        }
        if (effectiveCompanyId) {
          requestConfig.headers['X-Company-Id'] = effectiveCompanyId;
        }
        if (effectiveSiteId) {
          requestConfig.headers['X-Site-Id'] = effectiveSiteId;
        }
        if (effectiveWarehouseId) {
          requestConfig.headers['X-Warehouse-Id'] = effectiveWarehouseId;
        }

        // Debug logging to verify headers
        logger.api(requestConfig.method?.toUpperCase() || 'GET', requestConfig.url || '', {
          params: requestConfig.params,
          isFormData,
          hasAuth: !!requestConfig.headers.Authorization,
          companyId: requestConfig.headers['X-Company-Id'] || 'None',
          siteId: requestConfig.headers['X-Site-Id'] || 'None',
        });

        return requestConfig;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Reset refresh counter on successful response
        this.refreshAttempts = 0;

        // 🆕 Actualizar timestamp de última actividad API (para expiración por inactividad)
        // Esto evita heartbeats innecesarios cuando el usuario ya está haciendo API calls
        updateLastApiCall();

        logger.apiResponse(
          response.config.method?.toUpperCase() || 'GET',
          response.config.url || '',
          response.status,
          __DEV__ ? response.data : undefined // Only log data in dev
        );
        return response;
      },
      async (error) => {
        logger.apiError(error.config?.method?.toUpperCase() || 'UNKNOWN', error.config?.url || '', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          hasAuth: !!error.config?.headers?.Authorization,
        });

        // Enhanced debugging for 403 errors on /transfers endpoint
        if (error.response?.status === 403 && error.config?.url?.includes('/transfers')) {
          const authStore = useAuthStore.getState();
          logger.error('❌ 403 Forbidden on /transfers - Detailed Debug:', {
            url: error.config?.url,
            fullUrl: `${config.API_URL}${error.config?.url}`,
            errorMessage: error.response?.data?.message,
            hasToken: !!error.config?.headers?.Authorization,
            userId: authStore.user?.id,
            companyId: authStore.currentCompany?.id,
            siteId: authStore.currentSite?.id,
          });
        }

        // Simplified debugging for 401 errors
        if (error.response?.status === 401) {
          const token = useAuthStore.getState().token;
          logger.debug('401 Error - Token present:', !!token);
        }

        if (error.code === 'ECONNREFUSED') {
          error.code = 'NETWORK_ERROR';
          error.message =
            'No se puede conectar al servidor. Verifica que el backend esté en ejecución.';
        }

        const originalRequest = error.config;

        // Handle 401 errors - try to refresh token first
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Prevent infinite refresh loops
          if (this.refreshAttempts >= this.maxRefreshAttempts) {
            logger.error(
              `Max refresh attempts (${this.maxRefreshAttempts}) reached, logging out...`
            );
            this.refreshAttempts = 0;
            await useAuthStore.getState().logout();
            return Promise.reject(error);
          }

          this.refreshAttempts++;

          try {
            logger.info(
              `Attempting token refresh (${this.refreshAttempts}/${this.maxRefreshAttempts}) for 401 error...`
            );

            // Use the new authService for token refresh
            await authService.refreshToken();
            const newToken = authService.getAccessToken();

            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              logger.info('Token refreshed, retrying request...');
              this.refreshAttempts = 0; // Reset counter on successful refresh
              return this.client(originalRequest);
            } else {
              logger.warn('No new token after refresh, logging out...');
              this.refreshAttempts = 0;
              await useAuthStore.getState().logout();
            }
          } catch (refreshError) {
            logger.error('Token refresh failed:', refreshError);
            this.refreshAttempts = 0;
            await useAuthStore.getState().logout();
          }
        }

        // Handle 403 errors - permission denied
        if (error.response?.status === 403) {
          const errorMessage =
            error.response?.data?.message ||
            'No tienes los permisos necesarios para realizar esta acción.';

          // Extract required permissions from error message if available
          const requiredPermissionsMatch = errorMessage.match(/Se requieren los permisos: (.+)/);
          const requiredPermissions = requiredPermissionsMatch
            ? requiredPermissionsMatch[1].split(',').map((p: string) => p.trim())
            : [];

          logger.warn('403 Forbidden - Permission denied:', {
            message: errorMessage,
            requiredPermissions,
            url: error.config?.url,
          });

          // Enhance error object with permission details
          error.isPermissionError = true;
          error.permissionMessage = errorMessage;
          error.requiredPermissions = requiredPermissions;
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    // Add cache-busting headers instead of query params to avoid backend validation errors
    const cacheBustingConfig = {
      ...config,
      headers: {
        ...config?.headers,
        'X-Request-Time': Date.now().toString(),
      },
    };

    const response: AxiosResponse<T> = await this.client.get(url, cacheBustingConfig);

    logger.debug('📥 GET Response:', {
      url,
      status: response.status,
      dataType: typeof response.data,
      hasData: !!response.data,
    });

    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const isFormData = data instanceof FormData;
    logger.debug('📤 POST Request:', {
      url,
      hasData: !!data,
      isFormData,
      dataType: data?.constructor?.name,
    });

    // For FormData in React Native, use fetch directly to avoid axios Content-Type issues
    if (isFormData) {
      logger.debug('📦 Using fetch for FormData upload to bypass axios Content-Type issues');
      // Check if this is an OCR request to use unlimited timeout
      const isOcrRequest = url.includes('/ocr/scan');
      return this.formDataWithFetch<T>(url, data, 'POST', config, isOcrRequest);
    }

    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * Upload FormData using fetch instead of axios
   * This bypasses axios's Content-Type handling issues in React Native
   * Supports POST and PUT methods
   */
  /**
   * Construye los headers para uploads de FormData (auth + tenant context).
   * NO incluye Content-Type: lo setea automáticamente fetch/XHR con el boundary.
   */
  private buildFormDataHeaders(requestConfig?: AxiosRequestConfig): Record<string, string> {
    const authStore = useAuthStore.getState();
    const tenantStore = useTenantStore.getState();
    const { user, currentCompany, currentSite } = authStore;
    const { selectedCompany, selectedSite, selectedWarehouse } = tenantStore;

    // Get the current token
    const currentToken = authService.getAccessToken() || authStore.token;

    // Build headers
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };

    // Merge custom headers if provided (but filter out Content-Type for FormData)
    if (requestConfig?.headers) {
      Object.entries(requestConfig.headers).forEach(([key, value]) => {
        // Skip Content-Type - will be set automatically with proper boundary for FormData
        if (key.toLowerCase() === 'content-type') {
          return;
        }
        if (value !== null && value !== undefined) {
          headers[key] = String(value);
        }
      });
    }

    // Add auth header (Bearer) SOLO cuando NO usamos cookies HttpOnly.
    if (COOKIE_AUTH_WEB) {
      const csrf = readCookie('csrf_token');
      if (csrf) {
        headers['X-CSRF-Token'] = csrf;
      }
    } else if (currentToken) {
      headers.Authorization = `Bearer ${currentToken}`;
    }

    // Add tenant context headers (use imported config from @/utils/config)
    // IMPORTANTE: setear X-App-Id una sola vez. `fetch`/XHR combinan claves que
    // difieren solo en mayúsculas (X-App-Id + x-app-id) en un único header con
    // valor duplicado ("appId, appId"), lo que rompe validaciones UUID en backend.
    headers['X-App-Id'] = config.APP_ID;

    // Add version header
    headers['X-App-Version'] = config.APP_VERSION;

    const effectiveCompanyId =
      selectedCompany?.id || currentCompany?.id || this.tenantContext.companyId;
    const effectiveSiteId = selectedSite?.id || currentSite?.id || this.tenantContext.siteId;
    const effectiveWarehouseId = selectedWarehouse?.id || this.tenantContext.warehouseId;
    const effectiveUserId = user?.id || this.tenantContext.userId;

    // Solo añadir headers de tenant context si no fueron proporcionados en requestConfig
    // Esto permite que las llamadas individuales sobreescriban el contexto del tenant
    if (effectiveUserId && !headers['X-User-Id']) {
      headers['X-User-Id'] = effectiveUserId;
    }
    if (effectiveCompanyId && !headers['X-Company-Id']) {
      headers['X-Company-Id'] = effectiveCompanyId;
    }
    if (effectiveSiteId && !headers['X-Site-Id']) {
      headers['X-Site-Id'] = effectiveSiteId;
    }
    if (effectiveWarehouseId && !headers['X-Warehouse-Id']) {
      headers['X-Warehouse-Id'] = effectiveWarehouseId;
    }

    return headers;
  }

  private async formDataWithFetch<T = any>(
    url: string,
    formData: FormData,
    method: 'POST' | 'PUT' = 'POST',
    requestConfig?: AxiosRequestConfig,
    isOcrRequest: boolean = false
  ): Promise<T> {
    logger.debug(`🔍 [FETCH] formDataWithFetch called with method: ${method}`);
    logger.debug('🔍 [FETCH] URL:', url);
    logger.debug('🔍 [FETCH] isOcrRequest:', isOcrRequest);

    const headers = this.buildFormDataHeaders(requestConfig);

    // DO NOT set Content-Type - fetch will set it automatically with boundary for FormData
    const fullUrl = `${this.client.defaults.baseURL}${url}`;
    logger.debug('🌐 [FETCH] Full URL:', fullUrl);

    if (isOcrRequest) {
      logger.info(
        '⏱️ [FETCH] OCR Request detected - Using unlimited timeout for document scanning'
      );
    }

    try {
      // For OCR requests: No timeout - OCR processing can take several minutes or hours
      // For other requests: Use default fetch behavior
      const fetchOptions: RequestInit = {
        method: method,
        headers,
        body: formData,
        credentials: COOKIE_AUTH_WEB ? 'include' : 'same-origin',
      };

      logger.debug('🚀 [FETCH] Sending fetch request...');

      // Note: fetch in React Native doesn't have a built-in timeout option
      // The timeout is controlled by the underlying network stack
      // Setting signal to undefined ensures no AbortController timeout is applied
      const response = await fetch(fullUrl, fetchOptions);

      logger.debug('✅ [FETCH] Response received - Status:', response.status);

      if (!response.ok) {
        logger.error('❌ [FETCH] Response not OK, reading error text...');
        const errorText = await response.text();
        logger.error('❌ [FETCH] Error response:', errorText.substring(0, 200));

        // Enhanced error for 524 timeout
        if (response.status === 524) {
          const error: any = new Error(
            'El servidor tardó demasiado en procesar los documentos. Intenta con menos archivos o archivos más pequeños.'
          );
          error.isTimeout = true;
          error.status = 524;
          throw error;
        }

        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      logger.debug('✅ [FETCH] Response OK, parsing JSON...');
      const result = await response.json();
      logger.debug('✅ [FETCH] JSON parsed successfully');
      return result;
    } catch (error: any) {
      logger.error('❌ [FETCH] Fetch error:', {
        type: error.constructor.name,
        message: error.message,
        url: fullUrl,
      });

      // Log network-specific errors
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        logger.error('❌ [FETCH] Network request failed - Check backend server and connectivity');
      }

      throw error;
    }
  }

  /**
   * Sube un FormData usando XMLHttpRequest para obtener progreso real de subida.
   * `fetch` no expone progreso de upload, por eso para archivos grandes
   * (APK/EXE de cientos de MB) usamos XHR y su evento `upload.onprogress`.
   *
   * El callback `onProgress` recibe un entero 0-100.
   */
  async uploadFormData<T = any>(
    url: string,
    formData: FormData,
    onProgress?: (progress: number) => void,
    method: 'POST' | 'PUT' = 'POST',
    requestConfig?: AxiosRequestConfig
  ): Promise<T> {
    const headers = this.buildFormDataHeaders(requestConfig);
    const fullUrl = `${this.client.defaults.baseURL}${url}`;

    logger.debug('🚀 [XHR] uploadFormData:', { url: fullUrl, method });

    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, fullUrl);
      if (COOKIE_AUTH_WEB) {
        xhr.withCredentials = true;
      }

      // No seteamos Content-Type: XHR lo arma con el boundary correcto para FormData
      Object.entries(headers).forEach(([key, value]) => {
        if (key.toLowerCase() === 'content-type') return;
        try {
          xhr.setRequestHeader(key, value);
        } catch {
          // Algunos headers son de solo lectura en ciertos entornos; ignorar
        }
      });

      // Progreso real de subida (con logging throttled para diagnosticar estancamientos)
      let lastLoggedPercent = -1;
      const startedAt = Date.now();
      if (xhr.upload) {
        xhr.upload.onprogress = (event: ProgressEvent) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            if (onProgress) {
              // Reservamos el 100% para cuando el servidor confirme la respuesta
              onProgress(Math.min(99, percent));
            }
            // Log cada 5% para poder ver en consola si los bytes avanzan o se estancan
            if (percent >= lastLoggedPercent + 5 || percent === 100) {
              lastLoggedPercent = percent;
              const loadedMb = (event.loaded / (1024 * 1024)).toFixed(2);
              const totalMb = (event.total / (1024 * 1024)).toFixed(2);
              const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1);
              logger.debug(
                `📤 [XHR] Upload ${percent}% — ${loadedMb}/${totalMb} MB (${elapsedS}s)`
              );
            }
          }
        };
      }

      const buildError = (message: string): any => {
        const error: any = new Error(message);
        let parsedData: any;
        try {
          parsedData = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
        } catch {
          parsedData = xhr.responseText;
        }
        error.response = { status: xhr.status, data: parsedData };
        return error;
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100);
          let result: any;
          try {
            result = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
          } catch {
            result = xhr.responseText;
          }
          resolve(result as T);
        } else {
          let serverMsg =
            (() => {
              try {
                return JSON.parse(xhr.responseText)?.message;
              } catch {
                return undefined;
              }
            })() || `HTTP ${xhr.status}`;
          // 413: el archivo excede el límite de tamaño del servidor/proxy
          if (xhr.status === 413) {
            serverMsg =
              'El archivo supera el límite de tamaño permitido por el servidor. ' +
              'Aumenta el límite de subida en el backend/proxy (nginx client_max_body_size o el proxy/CDN).';
          }
          logger.error('❌ [XHR] Upload failed:', { status: xhr.status, message: serverMsg });
          reject(buildError(serverMsg));
        }
      };

      xhr.onerror = () => {
        logger.error('❌ [XHR] Network error during upload');
        reject(buildError('Error de red durante la subida del archivo'));
      };

      xhr.ontimeout = () => {
        logger.error('❌ [XHR] Upload timed out');
        reject(buildError('La subida del archivo superó el tiempo límite'));
      };

      xhr.send(formData);
    });
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const isFormData = data instanceof FormData;
    logger.debug('📤 PUT Request:', {
      url,
      hasData: !!data,
      isFormData,
      dataType: data?.constructor?.name,
    });

    // For FormData in React Native, use fetch directly to avoid axios Content-Type issues
    if (isFormData) {
      logger.debug('📦 Using fetch for FormData PUT to bypass axios Content-Type issues');
      return this.formDataWithFetch<T>(url, data, 'PUT', config);
    }

    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    logger.debug('📤 PATCH Request:', { url, hasData: !!data });
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    logger.debug('📥 PATCH Response:', { url, status: response.status });
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
