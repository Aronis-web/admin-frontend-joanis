import { apiClient } from './client';
import {
  AccountReceivable,
  AccountsReceivableResponse,
  QueryAccountsReceivableParams,
  CreateAccountReceivableRequest,
  UpdateAccountReceivableRequest,
} from '@/types/accounts-receivable';

/**
 * Accounts Receivable API Service
 */
class AccountsReceivableService {
  private readonly basePath = '/accounts-receivable';

  /**
   * Get all accounts receivable with optional filters and pagination
   * This is the standard endpoint with basic filtering
   */
  async getAccountsReceivable(params?: QueryAccountsReceivableParams): Promise<AccountsReceivableResponse> {
    return apiClient.get<AccountsReceivableResponse>(this.basePath, { params });
  }

  /**
   * Intelligent search with all details included
   * This endpoint always includes:
   * - Complete debtor data
   * - Collection history
   * - Status history
   * - Collection schedule
   * - Summary by currency and status
   * - Metadata with pagination info
   */
  async searchIntelligent(params?: QueryAccountsReceivableParams): Promise<AccountsReceivableResponse> {
    return apiClient.get<AccountsReceivableResponse>(`${this.basePath}/search/intelligent`, { params });
  }

  /**
   * Get a single account receivable by ID
   */
  async getAccountReceivable(id: string, includeDetails: boolean = true): Promise<AccountReceivable> {
    return apiClient.get<AccountReceivable>(`${this.basePath}/${id}`, {
      params: { includeDetails },
    });
  }

  /**
   * Create a new account receivable
   */
  async createAccountReceivable(data: CreateAccountReceivableRequest): Promise<AccountReceivable> {
    return apiClient.post<AccountReceivable>(this.basePath, data);
  }

  /**
   * Update an account receivable
   */
  async updateAccountReceivable(id: string, data: UpdateAccountReceivableRequest): Promise<AccountReceivable> {
    return apiClient.patch<AccountReceivable>(`${this.basePath}/${id}`, data);
  }

  /**
   * Delete an account receivable (soft delete)
   */
  async deleteAccountReceivable(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }

  /**
   * Get summary report
   */
  async getSummary(params?: QueryAccountsReceivableParams): Promise<any> {
    return apiClient.get<any>(`${this.basePath}/reports/summary`, { params });
  }

  /**
   * Get summary by debtor
   */
  async getSummaryByDebtor(params?: QueryAccountsReceivableParams): Promise<any> {
    return apiClient.get<any>(`${this.basePath}/reports/by-debtor`, { params });
  }

  /**
   * Get aging report
   */
  async getAgingReport(params?: QueryAccountsReceivableParams): Promise<any> {
    return apiClient.get<any>(`${this.basePath}/reports/aging`, { params });
  }

  /**
   * Get overdue accounts
   */
  async getOverdueAccounts(params?: QueryAccountsReceivableParams): Promise<any> {
    return apiClient.get<any>(`${this.basePath}/reports/overdue`, { params });
  }
}

// Export service instance
export const accountsReceivableService = new AccountsReceivableService();

// Re-export types for convenience
export type {
  AccountReceivable,
  AccountsReceivableResponse,
  QueryAccountsReceivableParams,
  CreateAccountReceivableRequest,
  UpdateAccountReceivableRequest,
} from '@/types/accounts-receivable';
