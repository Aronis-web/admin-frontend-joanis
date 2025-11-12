import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';
import { authService } from '@/services/AuthService';

class ApiClient {
  private client: AxiosInstance;
  private refreshAttempts = 0;
  private readonly maxRefreshAttempts = 2;

  constructor() {
    this.client = axios.create({
      baseURL: config.API_URL,
      timeout: config.API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (requestConfig) => {
        const authStore = useAuthStore.getState();
        const { token } = authStore;

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

        // Debug logging to verify headers
        console.log('API Request:', {
          url: requestConfig.url,
          method: requestConfig.method,
          headers: {
            ...requestConfig.headers,
            'Authorization': requestConfig.headers.Authorization ? 'Bearer [REDACTED]' : 'None'
          },
          'X-App-Id': requestConfig.headers['X-App-Id'],
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
        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {

    const response: AxiosResponse<T> = await this.client.get(url, config);

    return response.data;
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
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
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
