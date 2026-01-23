import { apiClient } from './client';
import {
  Site,
  SitesResponse,
  CreateSiteRequest,
  UpdateSiteRequest,
  GetSitesParams,
  AddAdminRequest,
} from '@/types/sites';

export const sitesApi = {
  /**
   * Get sites with pagination and filtering
   * Supports multi-tenancy via companyId parameter or X-Company-Id header
   */
  async getSites(params: GetSitesParams = {}): Promise<SitesResponse> {
    const {
      companyId,
      userId,
      q,
      isActive,
      district,
      province,
      department,
      page = 1,
      limit = 20,
      orderBy = 'name',
      orderDir = 'ASC',
    } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      orderBy,
      orderDir,
    });

    if (companyId) {
      queryParams.append('companyId', companyId);
    }

    if (userId) {
      queryParams.append('userId', userId);
    }

    if (q) {
      queryParams.append('q', q);
    }

    if (isActive !== undefined) {
      queryParams.append('isActive', isActive.toString());
    }

    if (district) {
      queryParams.append('district', district);
    }

    if (province) {
      queryParams.append('province', province);
    }

    if (department) {
      queryParams.append('department', department);
    }

    const queryString = queryParams.toString();
    const url = `/sites${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<SitesResponse>(url);
  },

  /**
   * Get a single site by ID or code
   */
  async getSiteById(id: string, by: 'id' | 'code' = 'id'): Promise<Site> {
    const queryParams = by === 'code' ? '?by=code' : '';
    return apiClient.get<Site>(`/sites/${id}${queryParams}`);
  },

  /**
   * Create a new site
   */
  async createSite(siteData: CreateSiteRequest): Promise<Site> {
    return apiClient.post<Site>('/sites', siteData);
  },

  /**
   * Update an existing site
   */
  async updateSite(id: string, siteData: UpdateSiteRequest): Promise<Site> {
    return apiClient.patch<Site>(`/sites/${id}`, siteData);
  },

  /**
   * Delete a site
   */
  async deleteSite(id: string): Promise<void> {
    return apiClient.delete<void>(`/sites/${id}`);
  },

  /**
   * Add an administrator to a site
   */
  async addAdmin(siteId: string, adminData: AddAdminRequest): Promise<void> {
    return apiClient.post<void>(`/sites/${siteId}/admins`, adminData);
  },

  /**
   * Remove an administrator from a site
   */
  async removeAdmin(siteId: string, userId: string): Promise<void> {
    return apiClient.delete<void>(`/sites/${siteId}/admins/${userId}`);
  },

  /**
   * Get all active sites (helper method)
   * Optionally filter by company
   */
  async getActiveSites(companyId?: string): Promise<Site[]> {
    const response = await this.getSites({ companyId, isActive: true, limit: 100 });
    return response.data;
  },

  /**
   * Search sites by name or address
   */
  async searchSites(query: string): Promise<Site[]> {
    const response = await this.getSites({ q: query, limit: 50 });
    return response.data;
  },
};

// Alias for backward compatibility
export const sitesService = sitesApi;

export default sitesApi;
