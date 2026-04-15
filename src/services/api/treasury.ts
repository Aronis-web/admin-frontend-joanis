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
  ): Promise<BankAccountsResponse> => {
    const queryParams = new URLSearchParams();

    if (params.companyId) queryParams.append('companyId', params.companyId);
    if (params.bankId) queryParams.append('bankId', params.bankId);
    if (params.accountType) queryParams.append('accountType', params.accountType);
    if (params.currency) queryParams.append('currency', params.currency);
    if (params.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const url = `/treasury/bank-accounts${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<BankAccountsResponse>(url);
  },

  /**
   * Get all active bank accounts (simplified)
   * GET /treasury/bank-accounts?isActive=true
   */
  getActiveBankAccounts: async (): Promise<BankAccount[]> => {
    const response = await apiClient.get<BankAccountsResponse>(
      '/treasury/bank-accounts?isActive=true&limit=100'
    );
    return response.data || [];
  },

  /**
   * Get a single bank account by ID
   * GET /treasury/bank-accounts/:id
   */
  getBankAccountById: async (id: string): Promise<BankAccount> => {
    return apiClient.get<BankAccount>(`/treasury/bank-accounts/${id}`);
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
