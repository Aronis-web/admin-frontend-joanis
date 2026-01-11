import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { authService } from '@/services/AuthService';
import { TenantContext } from '@/types/companies';

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
        'Pragma': 'no-cache',
        'Expires': '0',
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
    fields.forEach(field => {
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

        // Check if we need to refresh token proactively
        if (authService.shouldRefreshToken() && authService.getAccessToken()) {
          try {
            await authService.refreshToken();
          } catch (error) {
            console.warn('Proactive token refresh failed:', error);
          }
        }

        // Add Authorization header if token is available
        const currentToken = authService.getAccessToken() || token;
        if (currentToken) {
          requestConfig.headers.Authorization = `Bearer ${currentToken}`;
        }

        // Add X-App-Id header to all requests (required by API)
        requestConfig.headers['X-App-Id'] = config.APP_ID;

        // Auto-sync tenant context from stores (prefer tenant store, fallback to auth store)
        const effectiveCompanyId = selectedCompany?.id || currentCompany?.id || this.tenantContext.companyId;
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
        console.log('API Request:', {
          url: requestConfig.url,
          method: requestConfig.method,
          headers: {
            ...requestConfig.headers,
            'Authorization': requestConfig.headers.Authorization ? 'Bearer [REDACTED]' : 'None'
          },
          'X-App-Id': requestConfig.headers['X-App-Id'],
          'X-Company-Id': requestConfig.headers['X-Company-Id'] || 'None',
          'X-Site-Id': requestConfig.headers['X-Site-Id'] || 'None',
          'X-Warehouse-Id': requestConfig.headers['X-Warehouse-Id'] || 'None',
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

        console.log('API Response:', {
          url: response.config.url,
          status: response.status,
          method: response.config.method,
          data: response.data
        });
        return response;
      },
      async (error) => {
        console.log('API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          method: error.config?.method,
          headers: error.config?.headers,
          authorization: error.config?.headers?.Authorization ? 'Present' : 'Missing'
        });

        // Simplified debugging for 401 errors
        if (error.response?.status === 401) {
          const token = useAuthStore.getState().token;
          console.log('401 Error - Token present:', !!token);
        }

        if (error.code === 'ECONNREFUSED') {
          error.code = 'NETWORK_ERROR';
          error.message = 'No se puede conectar al servidor. Verifica que el backend esté en ejecución.';
        }

        const originalRequest = error.config;

        // Handle 401 errors - try to refresh token first
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Prevent infinite refresh loops
          if (this.refreshAttempts >= this.maxRefreshAttempts) {
            console.error(`Max refresh attempts (${this.maxRefreshAttempts}) reached, logging out...`);
            this.refreshAttempts = 0;
            await useAuthStore.getState().logout();
            return Promise.reject(error);
          }

          this.refreshAttempts++;

          try {
            console.log(`Attempting token refresh (${this.refreshAttempts}/${this.maxRefreshAttempts}) for 401 error...`);

            // Use the new authService for token refresh
            await authService.refreshToken();
            const newToken = authService.getAccessToken();

            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              console.log('Token refreshed, retrying request...');
              this.refreshAttempts = 0; // Reset counter on successful refresh
              return this.client(originalRequest);
            } else {
              console.log('No new token after refresh, logging out...');
              this.refreshAttempts = 0;
              await useAuthStore.getState().logout();
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            this.refreshAttempts = 0;
            await useAuthStore.getState().logout();
          }
        }

        // Handle 403 errors - permission denied
        if (error.response?.status === 403) {
          const errorMessage = error.response?.data?.message || 'No tienes los permisos necesarios para realizar esta acción.';

          // Extract required permissions from error message if available
          const requiredPermissionsMatch = errorMessage.match(/Se requieren los permisos: (.+)/);
          const requiredPermissions = requiredPermissionsMatch
            ? requiredPermissionsMatch[1].split(',').map((p: string) => p.trim())
            : [];

          console.log('403 Forbidden - Permission denied:', {
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

    console.log('📥 GET Response:', {
      url,
      status: response.status,
      dataType: typeof response.data,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : [],
      fullData: response.data
    });

    return response.data;
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    console.log('📤 POST Request:', {
      url,
      data,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : []
    });
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    console.log('📤 PATCH Request:', {
      url,
      data,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      dataValues: data ? Object.values(data) : []
    });
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    console.log('📥 PATCH Response:', {
      url,
      status: response.status,
      data: response.data
    });
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
