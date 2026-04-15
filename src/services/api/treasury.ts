/**
 * Treasury API Service
 *
 * Service for bank operations and treasury management
 */

import { apiClient } from './client';
import {
  BankTransaction,
  BankTransactionsResponse,
  QueryBankTransactionsParams,
  BankAccount,
  BankAccountsResponse,
  QueryBankAccountsParams,
  BankInfo,
  BankAccountsSummary,
  CreateBankAccountRequest,
  UpdateBankAccountRequest,
} from '@/types/treasury';

/**
 * Treasury API endpoints
 */
export const treasuryApi = {
  // ==================== Bank Accounts ====================

  /**
   * Get bank accounts with filters and pagination
   * GET /treasury/bank-accounts
   */
  getBankAccounts: async (
    params: QueryBankAccountsParams = {}
  ): Promise<BankAccount[]> => {
    const queryParams = new URLSearchParams();

    if (params.companyId) queryParams.append('companyId', params.companyId);
    if (params.bankId) queryParams.append('bankId', params.bankId);
    if (params.accountType) queryParams.append('accountType', params.accountType);
    if (params.currency) queryParams.append('currency', params.currency);
    if (params.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
    if (params.includeDeleted !== undefined) queryParams.append('includeDeleted', params.includeDeleted.toString());
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const url = `/treasury/bank-accounts${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient.get<BankAccount[] | BankAccountsResponse>(url);

    // Handle both cases: response could be the array directly or wrapped in { data: [] }
    return Array.isArray(response) ? response : (response?.data || []);
  },

  /**
   * Get all active bank accounts (simplified)
   * GET /treasury/bank-accounts?isActive=true
   */
  getActiveBankAccounts: async (): Promise<BankAccount[]> => {
    console.log('🏦 [Treasury] Fetching active bank accounts...');
    console.log('🏦 [Treasury] URL: /treasury/bank-accounts?isActive=true&limit=100');

    try {
      const response = await apiClient.get<BankAccountsResponse>(
        '/treasury/bank-accounts?isActive=true&limit=100'
      );

      console.log('🏦 [Treasury] Raw response:', JSON.stringify(response, null, 2));
      console.log('🏦 [Treasury] Response type:', typeof response);
      console.log('🏦 [Treasury] Response.data:', response?.data);
      console.log('🏦 [Treasury] Is array?:', Array.isArray(response));
      console.log('🏦 [Treasury] Is data array?:', Array.isArray(response?.data));

      // Handle both cases: response could be the array directly or wrapped in { data: [] }
      const accounts = Array.isArray(response) ? response : (response?.data || []);
      console.log('🏦 [Treasury] Final accounts count:', accounts.length);

      return accounts;
    } catch (error: any) {
      console.error('🏦 [Treasury] Error fetching bank accounts:', error);
      console.error('🏦 [Treasury] Error response:', error?.response?.data);
      console.error('🏦 [Treasury] Error status:', error?.response?.status);
      throw error;
    }
  },

  /**
   * Get a single bank account by ID
   * GET /treasury/bank-accounts/:id
   */
  getBankAccountById: async (id: string): Promise<BankAccount> => {
    return apiClient.get<BankAccount>(`/treasury/bank-accounts/${id}`);
  },

  /**
   * Create a new bank account
   * POST /treasury/bank-accounts
   */
  createBankAccount: async (data: CreateBankAccountRequest): Promise<BankAccount> => {
    console.log('🏦 [Treasury] Creating bank account:', data);
    return apiClient.post<BankAccount>('/treasury/bank-accounts', data);
  },

  /**
   * Update a bank account
   * PUT /treasury/bank-accounts/:id
   */
  updateBankAccount: async (id: string, data: UpdateBankAccountRequest): Promise<BankAccount> => {
    console.log('🏦 [Treasury] Updating bank account:', id, data);
    return apiClient.put<BankAccount>(`/treasury/bank-accounts/${id}`, data);
  },

  /**
   * Delete a bank account (soft delete)
   * DELETE /treasury/bank-accounts/:id
   */
  deleteBankAccount: async (id: string): Promise<{ message: string }> => {
    console.log('🏦 [Treasury] Deleting bank account:', id);
    return apiClient.delete<{ message: string }>(`/treasury/bank-accounts/${id}`);
  },

  /**
   * Get available banks list
   * GET /treasury/bank-accounts/banks
   */
  getAvailableBanks: async (): Promise<BankInfo[]> => {
    console.log('🏦 [Treasury] Fetching available banks...');
    const response = await apiClient.get<BankInfo[]>('/treasury/bank-accounts/banks');
    return Array.isArray(response) ? response : [];
  },

  /**
   * Get bank accounts summary by company
   * GET /treasury/bank-accounts/summary/:companyId
   */
  getBankAccountsSummary: async (companyId: string): Promise<BankAccountsSummary> => {
    console.log('🏦 [Treasury] Fetching bank accounts summary for company:', companyId);
    return apiClient.get<BankAccountsSummary>(`/treasury/bank-accounts/summary/${companyId}`);
  },

  // ==================== Bank Transactions ====================

  /**
   * Get bank transactions with filters and pagination
   */
  getTransactions: async (
    params: QueryBankTransactionsParams = {}
  ): Promise<BankTransactionsResponse> => {
    const queryParams = new URLSearchParams();

    if (params.bankAccountId) queryParams.append('bankAccountId', params.bankAccountId);
    if (params.companyId) queryParams.append('companyId', params.companyId);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.direction) queryParams.append('direction', params.direction);
    if (params.movementType) queryParams.append('movementType', params.movementType);
    if (params.assignmentStatus) queryParams.append('assignmentStatus', params.assignmentStatus);
    if (params.batchNumber) queryParams.append('batchNumber', params.batchNumber);
    if (params.search) queryParams.append('search', params.search);
    if (params.minAmountCents !== undefined) queryParams.append('minAmountCents', params.minAmountCents.toString());
    if (params.maxAmountCents !== undefined) queryParams.append('maxAmountCents', params.maxAmountCents.toString());
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const queryString = queryParams.toString();
    const url = `/treasury/transactions${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<BankTransactionsResponse>(url);
  },

  /**
   * Get a single transaction by ID
   */
  getTransactionById: async (id: string): Promise<BankTransaction> => {
    return apiClient.get<BankTransaction>(`/treasury/transactions/${id}`);
  },
};

export default treasuryApi;
