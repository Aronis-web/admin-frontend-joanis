import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { authService } from '@/services/AuthService';
import { TenantContext } from '@/types/companies';
import logger from '@/utils/logger';

class ApiClient {
  private client: AxiosInstance;
  private refreshAttempts = 0;
  private readonly maxRefreshAttempts = 2;
  private tenantContext: TenantContext = {};

  constructor() {
    this.client = axios.create({
      baseURL: config.API_URL,
      timeout: config.API_TIMEOUT,
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
        if (currentToken) {
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
        requestConfig.headers['X-App-Id'] = appId;
        requestConfig.headers['x-app-id'] = appId; // Also set lowercase for compatibility

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
        logger.api(
          requestConfig.method?.toUpperCase() || 'GET',
          requestConfig.url || '',
          {
            params: requestConfig.params,
            isFormData,
            hasAuth: !!requestConfig.headers.Authorization,
            companyId: requestConfig.headers['X-Company-Id'] || 'None',
            siteId: requestConfig.headers['X-Site-Id'] || 'None',
          }
        );

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

        logger.apiResponse(
          response.config.method?.toUpperCase() || 'GET',
          response.config.url || '',
          response.status,
          __DEV__ ? response.data : undefined // Only log data in dev
        );
        return response;
      },
      async (error) => {
        logger.apiError(
          error.config?.method?.toUpperCase() || 'UNKNOWN',
          error.config?.url || '',
          {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            hasAuth: !!error.config?.headers?.Authorization,
          }
        );

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
      return this.postFormDataWithFetch<T>(url, data, config, isOcrRequest);
    }

    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * Upload FormData using fetch instead of axios
   * This bypasses axios's Content-Type handling issues in React Native
   */
  private async postFormDataWithFetch<T = any>(
    url: string,
    formData: FormData,
    requestConfig?: AxiosRequestConfig,
    isOcrRequest: boolean = false
  ): Promise<T> {
    logger.debug('🔍 [FETCH] postFormDataWithFetch called');
    logger.debug('🔍 [FETCH] URL:', url);
    logger.debug('🔍 [FETCH] isOcrRequest:', isOcrRequest);

    const authStore = useAuthStore.getState();
    const tenantStore = useTenantStore.getState();
    const { user, currentCompany, currentSite } = authStore;
    const { selectedCompany, selectedSite, selectedWarehouse } = tenantStore;

    // Get the current token
    const currentToken = authService.getAccessToken() || authStore.token;
    logger.debug('🔍 [FETCH] Token available:', !!currentToken);

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
        // Skip Content-Type - fetch will set it automatically with proper boundary for FormData
        if (key.toLowerCase() === 'content-type') {
          logger.debug('⚠️ [FETCH] Skipping Content-Type header - will be set automatically for FormData');
          return;
        }
        if (value !== null && value !== undefined) {
          headers[key] = String(value);
        }
      });
    }

    // Add auth header
    if (currentToken) {
      headers.Authorization = `Bearer ${currentToken}`;
    }

    // Add tenant context headers (use imported config from @/utils/config)
    const appId = config.APP_ID;
    headers['X-App-Id'] = appId;
    headers['x-app-id'] = appId;

    // Add version header
    const appVersion = config.APP_VERSION;
    headers['X-App-Version'] = appVersion;

    const effectiveCompanyId =
      selectedCompany?.id || currentCompany?.id || this.tenantContext.companyId;
    const effectiveSiteId = selectedSite?.id || currentSite?.id || this.tenantContext.siteId;
    const effectiveWarehouseId = selectedWarehouse?.id || this.tenantContext.warehouseId;
    const effectiveUserId = user?.id || this.tenantContext.userId;

    if (effectiveUserId) {
      headers['X-User-Id'] = effectiveUserId;
    }
    if (effectiveCompanyId) {
      headers['X-Company-Id'] = effectiveCompanyId;
    }
    if (effectiveSiteId) {
      headers['X-Site-Id'] = effectiveSiteId;
    }
    if (effectiveWarehouseId) {
      headers['X-Warehouse-Id'] = effectiveWarehouseId;
    }

    // DO NOT set Content-Type - fetch will set it automatically with boundary for FormData
    const fullUrl = `${this.client.defaults.baseURL}${url}`;
    logger.debug('🌐 [FETCH] Full URL:', fullUrl);

    if (isOcrRequest) {
      logger.info('⏱️ [FETCH] OCR Request detected - Using unlimited timeout for document scanning');
    }

    try {
      // For OCR requests: No timeout - OCR processing can take several minutes or hours
      // For other requests: Use default fetch behavior
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers,
        body: formData,
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

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
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
