import { apiClient } from './client';
import {
  SiteContact,
  CreateSiteContactRequest,
  UpdateSiteContactRequest,
  GetSiteContactsParams,
  SiteContactsSummary,
  SiteNotificationType,
} from '@/types/site-contacts';

export const siteContactsApi = {
  /**
   * Get all contacts for a specific site
   */
  async getSiteContacts(siteId: string): Promise<SiteContact[]> {
    return apiClient.get<SiteContact[]>(`/sites/${siteId}/contacts`);
  },

  /**
   * Get all contacts with filters
   */
  async getAllContacts(params: GetSiteContactsParams = {}): Promise<SiteContact[]> {
    const queryParams = new URLSearchParams();

    if (params.siteId) {
      queryParams.append('siteId', params.siteId);
    }

    if (params.isActive !== undefined) {
      queryParams.append('isActive', params.isActive.toString());
    }

    if (params.notificationType) {
      queryParams.append('notificationType', params.notificationType);
    }

    if (params.q) {
      queryParams.append('q', params.q);
    }

    const queryString = queryParams.toString();
    const url = `/sites/contacts${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<SiteContact[]>(url);
  },

  /**
   * Get contacts by notification type for a site
   */
  async getContactsByType(
    siteId: string,
    notificationType: SiteNotificationType
  ): Promise<SiteContact[]> {
    return apiClient.get<SiteContact[]>(
      `/sites/${siteId}/contacts/by-type/${notificationType}`
    );
  },

  /**
   * Get summary of contacts for a site
   */
  async getSiteSummary(siteId: string): Promise<SiteContactsSummary> {
    return apiClient.get<SiteContactsSummary>(`/sites/${siteId}/contacts/summary`);
  },

  /**
   * Get a single contact by ID
   */
  async getContactById(contactId: string): Promise<SiteContact> {
    return apiClient.get<SiteContact>(`/sites/contacts/${contactId}`);
  },

  /**
   * Create a new contact for a site
   */
  async createContact(
    siteId: string,
    contactData: CreateSiteContactRequest
  ): Promise<SiteContact> {
    return apiClient.post<SiteContact>(`/sites/${siteId}/contacts`, contactData);
  },

  /**
   * Update an existing contact
   */
  async updateContact(
    contactId: string,
    contactData: UpdateSiteContactRequest
  ): Promise<SiteContact> {
    return apiClient.patch<SiteContact>(`/sites/contacts/${contactId}`, contactData);
  },

  /**
   * Deactivate a contact (soft delete)
   */
  async deactivateContact(contactId: string): Promise<void> {
    return apiClient.delete<void>(`/sites/contacts/${contactId}`);
  },

  /**
   * Permanently delete a contact
   */
  async deleteContactPermanently(contactId: string): Promise<void> {
    return apiClient.delete<void>(`/sites/contacts/${contactId}/hard`);
  },
};

export default siteContactsApi;
