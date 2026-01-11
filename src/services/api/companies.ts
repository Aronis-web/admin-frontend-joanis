import { apiClient } from './client';
import {
  Company,
  CompaniesResponse,
  CreateCompanyRequest,
  UpdateCompanyRequest,
  GetCompaniesParams,
  AssignUserToCompanyRequest,
  AssignUserToSitesRequest,
  UserCompaniesResponse,
  UserSitesResponse,
  UserCompany,
  UserCompanySite,
  PaymentMethod,
  CreatePaymentMethodRequest,
  UpdatePaymentMethodRequest,
  BankAccount,
  CreateBankAccountRequest,
  UpdateBankAccountRequest,
} from '@/types/companies';
import {
  Site,
  CreateSiteRequest,
  UpdateSiteRequest,
  GetSitesParams,
  SitesResponse,
  AddAdminRequest,
} from '@/types/sites';

/**
 * Companies API Service
 * Handles all company-related operations for multi-tenancy
 */
export const companiesApi = {
  /**
   * Get companies with pagination and filtering
   * GET /companies
   */
  async getCompanies(params: GetCompaniesParams = {}): Promise<CompaniesResponse> {
    const {
      q,
      isActive,
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

    if (q) {
      queryParams.append('q', q);
    }

    if (isActive !== undefined) {
      queryParams.append('isActive', isActive.toString());
    }

    const queryString = queryParams.toString();
    const url = `/companies${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<CompaniesResponse>(url);
  },

  /**
   * Get a single company by ID
   * GET /companies/:id
   */
  async getCompanyById(id: string): Promise<Company> {
    return apiClient.get<Company>(`/companies/${id}`);
  },

  /**
   * Create a new company
   * POST /companies
   */
  async createCompany(companyData: CreateCompanyRequest): Promise<Company> {
    return apiClient.post<Company>('/companies', companyData);
  },

  /**
   * Update an existing company
   * PATCH /companies/:id
   */
  async updateCompany(id: string, companyData: UpdateCompanyRequest): Promise<Company> {
    return apiClient.patch<Company>(`/companies/${id}`, companyData);
  },

  /**
   * Delete a company
   * DELETE /companies/:id
   */
  async deleteCompany(id: string): Promise<void> {
    return apiClient.delete<void>(`/companies/${id}`);
  },

  /**
   * Get all active companies (helper method)
   */
  async getActiveCompanies(): Promise<Company[]> {
    const response = await this.getCompanies({ isActive: true, limit: 100 });
    return response.data;
  },

  /**
   * Search companies by name or RUC
   */
  async searchCompanies(query: string): Promise<Company[]> {
    const response = await this.getCompanies({ q: query, limit: 50 });
    return response.data;
  },

  // ============================================
  // User-Company Management
  // ============================================

  /**
   * Assign a user to a company
   * POST /companies/:id/users
   */
  async assignUserToCompany(
    companyId: string,
    userData: AssignUserToCompanyRequest
  ): Promise<UserCompany> {
    return apiClient.post<UserCompany>(`/companies/${companyId}/users`, userData);
  },

  /**
   * Remove a user from a company
   * DELETE /companies/:id/users/:userId
   */
  async removeUserFromCompany(companyId: string, userId: string): Promise<void> {
    return apiClient.delete<void>(`/companies/${companyId}/users/${userId}`);
  },

  /**
   * Get all users of a company
   * GET /companies/:id/users
   */
  async getCompanyUsers(companyId: string): Promise<UserCompaniesResponse> {
    return apiClient.get<UserCompaniesResponse>(`/companies/${companyId}/users`);
  },

  // ============================================
  // User-Site Management
  // ============================================

  /**
   * Assign a user to multiple sites within a company
   * POST /companies/:id/sites/assign
   */
  async assignUserToSites(
    companyId: string,
    assignData: AssignUserToSitesRequest
  ): Promise<void> {
    return apiClient.post<void>(`/companies/${companyId}/sites/assign`, assignData);
  },

  /**
   * Remove a user from a specific site
   * DELETE /companies/:id/sites/:siteId/users/:userId
   */
  async removeUserFromSite(
    companyId: string,
    siteId: string,
    userId: string
  ): Promise<void> {
    return apiClient.delete<void>(
      `/companies/${companyId}/sites/${siteId}/users/${userId}`
    );
  },

  /**
   * Get all sites accessible by a user within a company
   * GET /companies/:id/users/:userId/sites
   */
  async getUserSites(companyId: string, userId: string): Promise<UserSitesResponse> {
    return apiClient.get<UserSitesResponse>(
      `/companies/${companyId}/users/${userId}/sites`
    );
  },

  // ============================================
  // Helper Methods for Current User
  // ============================================

  /**
   * Get companies for the current authenticated user
   * GET /companies?userId=:userId
   */
  async getUserCompanies(userId: string): Promise<Company[]> {
    const response = await apiClient.get<CompaniesResponse>(
      `/companies?userId=${userId}`
    );
    return response.data;
  },

  /**
   * Get sites for the current user in a specific company
   * GET /companies/:companyId/users/:userId/sites
   */
  async getUserSitesInCompany(companyId: string, userId: string): Promise<UserCompanySite[]> {
    const response = await apiClient.get<UserCompanySite[]>(
      `/companies/${companyId}/users/${userId}/sites`
    );
    // The API returns the array directly, not wrapped in a data property
    return Array.isArray(response) ? response : [];
  },

  // ============================================
  // Sites Management (within Company context)
  // ============================================

  /**
   * Get sites of a company
   * GET /sites?companyId=:companyId
   */
  async getCompanySites(companyId: string, params: Omit<GetSitesParams, 'companyId'> = {}): Promise<SitesResponse> {
    const queryParams = new URLSearchParams({
      companyId,
      page: (params.page || 1).toString(),
      limit: (params.limit || 20).toString(),
      orderBy: params.orderBy || 'name',
      orderDir: params.orderDir || 'ASC',
    });

    if (params.q) queryParams.append('q', params.q);
    if (params.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
    if (params.district) queryParams.append('district', params.district);
    if (params.province) queryParams.append('province', params.province);
    if (params.department) queryParams.append('department', params.department);

    return apiClient.get<SitesResponse>(`/sites?${queryParams.toString()}`);
  },

  /**
   * Create a site for a company
   * POST /sites
   */
  async createSite(siteData: CreateSiteRequest): Promise<Site> {
    return apiClient.post<Site>('/sites', siteData);
  },

  /**
   * Get a site by ID
   * GET /sites/:id
   */
  async getSiteById(siteId: string): Promise<Site> {
    return apiClient.get<Site>(`/sites/${siteId}`);
  },

  /**
   * Update a site
   * PATCH /sites/:id
   */
  async updateSite(siteId: string, siteData: UpdateSiteRequest): Promise<Site> {
    return apiClient.patch<Site>(`/sites/${siteId}`, siteData);
  },

  /**
   * Delete a site
   * DELETE /sites/:id
   */
  async deleteSite(siteId: string): Promise<void> {
    return apiClient.delete<void>(`/sites/${siteId}`);
  },

  /**
   * Add admin to site
   * POST /sites/:id/admins
   */
  async addSiteAdmin(siteId: string, adminData: AddAdminRequest): Promise<void> {
    return apiClient.post<void>(`/sites/${siteId}/admins`, adminData);
  },

  /**
   * Remove admin from site
   * DELETE /sites/:id/admins/:userId
   */
  async removeSiteAdmin(siteId: string, userId: string): Promise<void> {
    return apiClient.delete<void>(`/sites/${siteId}/admins/${userId}`);
  },

  // ============================================
  // Payment Methods Management
  // ============================================

  /**
   * Get payment methods of a company
   * GET /companies/:id/payment-methods
   */
  async getPaymentMethods(companyId: string): Promise<PaymentMethod[]> {
    return apiClient.get<PaymentMethod[]>(`/companies/${companyId}/payment-methods`);
  },

  /**
   * Get a payment method by ID
   * GET /companies/:id/payment-methods/:paymentMethodId
   */
  async getPaymentMethodById(companyId: string, paymentMethodId: string): Promise<PaymentMethod> {
    return apiClient.get<PaymentMethod>(`/companies/${companyId}/payment-methods/${paymentMethodId}`);
  },

  /**
   * Create a payment method
   * POST /companies/:id/payment-methods
   */
  async createPaymentMethod(companyId: string, data: CreatePaymentMethodRequest): Promise<PaymentMethod> {
    return apiClient.post<PaymentMethod>(`/companies/${companyId}/payment-methods`, data);
  },

  /**
   * Update a payment method
   * PATCH /companies/:id/payment-methods/:paymentMethodId
   */
  async updatePaymentMethod(
    companyId: string,
    paymentMethodId: string,
    data: UpdatePaymentMethodRequest
  ): Promise<PaymentMethod> {
    return apiClient.patch<PaymentMethod>(`/companies/${companyId}/payment-methods/${paymentMethodId}`, data);
  },

  /**
   * Delete a payment method
   * DELETE /companies/:id/payment-methods/:paymentMethodId
   */
  async deletePaymentMethod(companyId: string, paymentMethodId: string): Promise<void> {
    return apiClient.delete<void>(`/companies/${companyId}/payment-methods/${paymentMethodId}`);
  },

  // ============================================
  // Bank Accounts Management
  // ============================================

  /**
   * Get accounts of a payment method
   * GET /companies/:id/payment-methods/:paymentMethodId/accounts
   */
  async getPaymentMethodAccounts(companyId: string, paymentMethodId: string): Promise<BankAccount[]> {
    return apiClient.get<BankAccount[]>(`/companies/${companyId}/payment-methods/${paymentMethodId}/accounts`);
  },

  /**
   * Add account to payment method
   * POST /companies/:id/payment-methods/:paymentMethodId/accounts
   */
  async addBankAccount(
    companyId: string,
    paymentMethodId: string,
    data: CreateBankAccountRequest
  ): Promise<BankAccount> {
    return apiClient.post<BankAccount>(`/companies/${companyId}/payment-methods/${paymentMethodId}/accounts`, data);
  },

  /**
   * Update a bank account
   * PATCH /companies/:id/payment-methods/:paymentMethodId/accounts/:accountId
   */
  async updateBankAccount(
    companyId: string,
    paymentMethodId: string,
    accountId: string,
    data: UpdateBankAccountRequest
  ): Promise<BankAccount> {
    return apiClient.patch<BankAccount>(
      `/companies/${companyId}/payment-methods/${paymentMethodId}/accounts/${accountId}`,
      data
    );
  },

  /**
   * Delete a bank account
   * DELETE /companies/:id/payment-methods/:paymentMethodId/accounts/:accountId
   */
  async deleteBankAccount(companyId: string, paymentMethodId: string, accountId: string): Promise<void> {
    return apiClient.delete<void>(`/companies/${companyId}/payment-methods/${paymentMethodId}/accounts/${accountId}`);
  },
};

export default companiesApi;
