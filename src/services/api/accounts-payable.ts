import { apiClient } from './client';
import {
  AccountPayable,
  AccountsPayableResponse,
  QueryAccountsPayableParams,
  CreateAccountPayableRequest,
  UpdateAccountPayableRequest,
} from '@/types/accounts-payable';

/**
 * Accounts Payable API Service
 */
class AccountsPayableService {
  private readonly basePath = '/accounts-payable';

  /**
   * Get all accounts payable with optional filters and pagination
   * This is the standard endpoint with basic filtering
   */
  async getAccountsPayable(params?: QueryAccountsPayableParams): Promise<AccountsPayableResponse> {
    return apiClient.get<AccountsPayableResponse>(this.basePath, { params });
  }

  /**
   * Intelligent search with all details included
   * This endpoint always includes:
   * - Complete supplier data
   * - Legal entity and contacts
   * - Payment history
   * - Status history
   * - Payment schedule
   * - Summary by currency and status
   * - Metadata with pagination info
   */
  async searchIntelligent(params?: QueryAccountsPayableParams): Promise<AccountsPayableResponse> {
    return apiClient.get<AccountsPayableResponse>(`${this.basePath}/search/intelligent`, { params });
  }

  /**
   * Get a single account payable by ID
   */
  async getAccountPayable(id: string, includeDetails: boolean = true): Promise<AccountPayable> {
    return apiClient.get<AccountPayable>(`${this.basePath}/${id}`, {
      params: { includeDetails },
    });
  }

  /**
   * Create a new account payable
   */
  async createAccountPayable(data: CreateAccountPayableRequest): Promise<AccountPayable> {
    return apiClient.post<AccountPayable>(this.basePath, data);
  }

  /**
   * Update an account payable
   */
  async updateAccountPayable(id: string, data: UpdateAccountPayableRequest): Promise<AccountPayable> {
    return apiClient.patch<AccountPayable>(`${this.basePath}/${id}`, data);
  }

  /**
   * Delete an account payable (soft delete)
   */
  async deleteAccountPayable(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }

  /**
   * Get summary report
   */
  async getSummary(params?: QueryAccountsPayableParams): Promise<any> {
    return apiClient.get<any>(`${this.basePath}/reports/summary`, { params });
  }

  /**
   * Get summary by supplier
   */
  async getSummaryBySupplier(params?: QueryAccountsPayableParams): Promise<any> {
    return apiClient.get<any>(`${this.basePath}/reports/by-supplier`, { params });
  }
}

// Export service instance
export const accountsPayableService = new AccountsPayableService();
