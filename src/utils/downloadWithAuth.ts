import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { config } from './config';

/**
 * Helper to download files (PDFs, Excel, etc.) with automatic token refresh on 401
 * This ensures downloads don't fail due to expired tokens
 */
export const downloadWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Blob> => {
  const authStore = useAuthStore.getState();
  const tenantStore = useTenantStore.getState();

  // Get current context
  let token = authStore.token;
  const userId = authStore.user?.id;
  const companyId = tenantStore.selectedCompany?.id || authStore.currentCompany?.id;
  const siteId = tenantStore.selectedSite?.id || authStore.currentSite?.id;
  const warehouseId = tenantStore.selectedWarehouse?.id;

  if (!token) {
    throw new Error('No authentication token available');
  }

  // Build headers
  const buildHeaders = (currentToken: string): Record<string, string> => {
    const headers: Record<string, string> = {
      'X-App-Id': config.APP_ID,
      'X-App-Version': config.APP_VERSION,
      Authorization: `Bearer ${currentToken}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };

    if (userId) {
      headers['X-User-Id'] = userId;
    }
    if (companyId) {
      headers['X-Company-Id'] = companyId;
    }
    if (siteId) {
      headers['X-Site-Id'] = siteId;
    }
    if (warehouseId) {
      headers['X-Warehouse-Id'] = warehouseId;
    }

    return headers;
  };

  // First attempt
  console.log('📥 Downloading file with auth...');
  let response = await fetch(url, {
    ...options,
    headers: {
      ...buildHeaders(token),
      ...options.headers,
    },
  });

  // If 401, refresh token and retry once
  if (response.status === 401) {
    console.log('🔄 Token expired during download, refreshing...');

    const refreshSuccess = await authStore.refreshAccessToken();

    if (!refreshSuccess) {
      throw new Error('Failed to refresh token for download');
    }

    // Get fresh token
    token = useAuthStore.getState().token;

    if (!token) {
      throw new Error('No token available after refresh');
    }

    console.log('✅ Token refreshed, retrying download...');

    // Retry with fresh token
    response = await fetch(url, {
      ...options,
      headers: {
        ...buildHeaders(token),
        ...options.headers,
      },
    });
  }

  // Check if response is ok
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
  }

  console.log('✅ File downloaded successfully');
  return await response.blob();
};
