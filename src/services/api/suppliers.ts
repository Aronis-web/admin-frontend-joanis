import { apiClient } from './client';
import {
  Supplier,
  SuppliersResponse,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  QuerySuppliersParams,
  SupplierLegalEntity,
  CreateSupplierLegalEntityDto,
  UpdateLegalEntityRequest,
  SupplierContact,
  CreateSupplierContactDto,
  UpdateContactRequest,
  SupplierBankAccount,
  CreateBankAccountRequest,
  UpdateBankAccountRequest,
  SupplierDebtTransaction,
  CreateDebtTransactionRequest,
  UpdateDebtTransactionRequest,
  AssignCompanyRequest,
  TransactionsResponse,
  QueryTransactionsParams,
  SupplierDebtSummaryResponse,
  SupplierPayment,
  CreatePaymentRequest,
  PaymentsResponse,
  QueryPaymentsParams,
  PaymentMethod,
  CreatePaymentMethodRequest,
  UpdatePaymentMethodRequest,
} from '@/types/suppliers';

/**
 * Suppliers API Service
 */
class SuppliersService {
  private readonly basePath = '/suppliers';

  // ============================================
  // Suppliers CRUD
  // ============================================

  /**
   * Get all suppliers with optional filters
   */
  async getSuppliers(params?: QuerySuppliersParams): Promise<SuppliersResponse> {
    return apiClient.get<SuppliersResponse>(this.basePath, { params });
  }

  /**
   * Search suppliers with intelligent ranking (v1.1.0)
   */
  async searchSuppliers(params?: QuerySuppliersParams): Promise<SuppliersResponse> {
    return apiClient.get<SuppliersResponse>(`${this.basePath}/search`, { params });
  }

  /**
   * Autocomplete suppliers (v1.1.0)
   */
  async autocompleteSuppliers(query: string, limit: number = 10, includeInactive: boolean = false): Promise<SuppliersResponse> {
    return apiClient.get<SuppliersResponse>(`${this.basePath}/autocomplete`, {
      params: { query, limit, includeInactive }
    });
  }

  /**
   * Get a single supplier by ID
   */
  async getSupplier(id: string): Promise<Supplier> {
    return apiClient.get<Supplier>(`${this.basePath}/${id}`);
  }

  /**
   * Create a new supplier
   */
  async createSupplier(data: CreateSupplierRequest): Promise<Supplier> {
    return apiClient.post<Supplier>(this.basePath, data);
  }

  /**
   * Update a supplier
   */
  async updateSupplier(id: string, data: UpdateSupplierRequest): Promise<Supplier> {
    return apiClient.patch<Supplier>(`${this.basePath}/${id}`, data);
  }

  /**
   * Delete a supplier (soft delete)
   */
  async deleteSupplier(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }

  /**
   * Restore a deleted supplier
   */
  async restoreSupplier(id: string): Promise<Supplier> {
    return apiClient.post<Supplier>(`${this.basePath}/${id}/restore`);
  }

  // ============================================
  // Legal Entities (Razones Sociales)
  // ============================================

  /**
   * Add a legal entity to a supplier
   */
  async addLegalEntity(
    supplierId: string,
    data: CreateSupplierLegalEntityDto
  ): Promise<SupplierLegalEntity> {
    return apiClient.post<SupplierLegalEntity>(
      `${this.basePath}/${supplierId}/legal-entities`,
      data
    );
  }

  /**
   * Update a legal entity
   */
  async updateLegalEntity(
    supplierId: string,
    entityId: string,
    data: UpdateLegalEntityRequest
  ): Promise<SupplierLegalEntity> {
    return apiClient.patch<SupplierLegalEntity>(
      `${this.basePath}/${supplierId}/legal-entities/${entityId}`,
      data
    );
  }

  /**
   * Delete a legal entity
   */
  async deleteLegalEntity(supplierId: string, entityId: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${supplierId}/legal-entities/${entityId}`);
  }

  /**
   * Set a legal entity as primary
   */
  async setPrimaryLegalEntity(supplierId: string, entityId: string): Promise<SupplierLegalEntity> {
    return apiClient.post<SupplierLegalEntity>(
      `${this.basePath}/${supplierId}/legal-entities/${entityId}/set-primary`
    );
  }

  // ============================================
  // Contacts
  // ============================================

  /**
   * Add a contact to a supplier
   */
  async addContact(supplierId: string, data: CreateSupplierContactDto): Promise<SupplierContact> {
    return apiClient.post<SupplierContact>(`${this.basePath}/${supplierId}/contacts`, data);
  }

  /**
   * Update a contact
   */
  async updateContact(
    supplierId: string,
    contactId: string,
    data: UpdateContactRequest
  ): Promise<SupplierContact> {
    return apiClient.patch<SupplierContact>(
      `${this.basePath}/${supplierId}/contacts/${contactId}`,
      data
    );
  }

  /**
   * Delete a contact
   */
  async deleteContact(supplierId: string, contactId: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${supplierId}/contacts/${contactId}`);
  }

  // ============================================
  // Bank Accounts
  // ============================================

  /**
   * Get all bank accounts for a supplier
   */
  async getBankAccounts(supplierId: string): Promise<SupplierBankAccount[]> {
    return apiClient.get<SupplierBankAccount[]>(`${this.basePath}/${supplierId}/bank-accounts`);
  }

  /**
   * Get a single bank account
   */
  async getBankAccount(supplierId: string, accountId: string): Promise<SupplierBankAccount> {
    return apiClient.get<SupplierBankAccount>(
      `${this.basePath}/${supplierId}/bank-accounts/${accountId}`
    );
  }

  /**
   * Add a bank account to a supplier
   */
  async addBankAccount(
    supplierId: string,
    data: CreateBankAccountRequest
  ): Promise<SupplierBankAccount> {
    return apiClient.post<SupplierBankAccount>(
      `${this.basePath}/${supplierId}/bank-accounts`,
      data
    );
  }

  /**
   * Update a bank account
   */
  async updateBankAccount(
    supplierId: string,
    accountId: string,
    data: UpdateBankAccountRequest
  ): Promise<SupplierBankAccount> {
    return apiClient.patch<SupplierBankAccount>(
      `${this.basePath}/${supplierId}/bank-accounts/${accountId}`,
      data
    );
  }

  /**
   * Deactivate a bank account
   */
  async deactivateBankAccount(supplierId: string, accountId: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${supplierId}/bank-accounts/${accountId}`);
  }

  /**
   * Set a bank account as preferred
   */
  async setPreferredBankAccount(
    supplierId: string,
    accountId: string
  ): Promise<SupplierBankAccount> {
    return apiClient.post<SupplierBankAccount>(
      `${this.basePath}/${supplierId}/bank-accounts/${accountId}/set-preferred`
    );
  }

  // ============================================
  // Debts & Transactions
  // ============================================

  /**
   * Get debt summary for a supplier
   */
  async getDebtSummary(supplierId: string): Promise<SupplierDebtSummaryResponse> {
    return apiClient.get<SupplierDebtSummaryResponse>(
      `${this.basePath}/${supplierId}/debts/summary`
    );
  }

  /**
   * Get all transactions for a supplier
   */
  async getTransactions(
    supplierId: string,
    params?: QueryTransactionsParams
  ): Promise<TransactionsResponse> {
    return apiClient.get<TransactionsResponse>(
      `${this.basePath}/${supplierId}/debts/transactions`,
      { params }
    );
  }

  /**
   * Get unassigned transactions for a supplier
   */
  async getUnassignedTransactions(supplierId: string): Promise<{ transactions: SupplierDebtTransaction[]; unassignedBalanceCents: string }> {
    return apiClient.get<{ transactions: SupplierDebtTransaction[]; unassignedBalanceCents: string }>(
      `${this.basePath}/${supplierId}/debts/unassigned`
    );
  }

  /**
   * Get a single transaction
   */
  async getTransaction(supplierId: string, transactionId: string): Promise<SupplierDebtTransaction> {
    return apiClient.get<SupplierDebtTransaction>(
      `${this.basePath}/${supplierId}/debts/transactions/${transactionId}`
    );
  }

  /**
   * Create a debt transaction
   */
  async createTransaction(
    supplierId: string,
    data: CreateDebtTransactionRequest
  ): Promise<SupplierDebtTransaction> {
    return apiClient.post<SupplierDebtTransaction>(
      `${this.basePath}/${supplierId}/debts/transactions`,
      data
    );
  }

  /**
   * Update a debt transaction
   */
  async updateTransaction(
    supplierId: string,
    transactionId: string,
    data: UpdateDebtTransactionRequest
  ): Promise<SupplierDebtTransaction> {
    return apiClient.patch<SupplierDebtTransaction>(
      `${this.basePath}/${supplierId}/debts/transactions/${transactionId}`,
      data
    );
  }

  /**
   * Delete a debt transaction
   */
  async deleteTransaction(supplierId: string, transactionId: string): Promise<void> {
    return apiClient.delete<void>(
      `${this.basePath}/${supplierId}/debts/transactions/${transactionId}`
    );
  }

  /**
   * Assign a transaction to a company
   */
  async assignTransactionToCompany(
    supplierId: string,
    transactionId: string,
    data: AssignCompanyRequest
  ): Promise<SupplierDebtTransaction> {
    return apiClient.post<SupplierDebtTransaction>(
      `${this.basePath}/${supplierId}/debts/transactions/${transactionId}/assign-company`,
      data
    );
  }

  // ============================================
  // Payments
  // ============================================

  /**
   * Get all payments for a supplier
   */
  async getPayments(supplierId: string, params?: QueryPaymentsParams): Promise<PaymentsResponse> {
    return apiClient.get<PaymentsResponse>(`${this.basePath}/${supplierId}/payments`, { params });
  }

  /**
   * Get unassigned payments for a supplier
   */
  async getUnassignedPayments(supplierId: string): Promise<SupplierPayment[]> {
    return apiClient.get<SupplierPayment[]>(`${this.basePath}/${supplierId}/payments/unassigned`);
  }

  /**
   * Get a single payment
   */
  async getPayment(supplierId: string, paymentId: string): Promise<SupplierPayment> {
    return apiClient.get<SupplierPayment>(`${this.basePath}/${supplierId}/payments/${paymentId}`);
  }

  /**
   * Create a payment
   */
  async createPayment(supplierId: string, data: CreatePaymentRequest): Promise<SupplierPayment> {
    return apiClient.post<SupplierPayment>(`${this.basePath}/${supplierId}/payments`, data);
  }

  /**
   * Assign a payment to a company
   */
  async assignPaymentToCompany(
    supplierId: string,
    paymentId: string,
    data: AssignCompanyRequest
  ): Promise<SupplierPayment> {
    return apiClient.post<SupplierPayment>(
      `${this.basePath}/${supplierId}/payments/${paymentId}/assign-company`,
      data
    );
  }

  /**
   * Approve a payment
   */
  async approvePayment(supplierId: string, paymentId: string): Promise<SupplierPayment> {
    return apiClient.post<SupplierPayment>(
      `${this.basePath}/${supplierId}/payments/${paymentId}/approve`
    );
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(supplierId: string, paymentId: string): Promise<SupplierPayment> {
    return apiClient.post<SupplierPayment>(
      `${this.basePath}/${supplierId}/payments/${paymentId}/cancel`
    );
  }
}

/**
 * Payment Methods API Service
 */
class PaymentMethodsService {
  private readonly basePath = '/payment-methods';

  /**
   * Get all payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return apiClient.get<PaymentMethod[]>(this.basePath);
  }

  /**
   * Get a single payment method
   */
  async getPaymentMethod(id: string): Promise<PaymentMethod> {
    return apiClient.get<PaymentMethod>(`${this.basePath}/${id}`);
  }

  /**
   * Create a payment method
   */
  async createPaymentMethod(data: CreatePaymentMethodRequest): Promise<PaymentMethod> {
    return apiClient.post<PaymentMethod>(this.basePath, data);
  }

  /**
   * Update a payment method
   */
  async updatePaymentMethod(id: string, data: UpdatePaymentMethodRequest): Promise<PaymentMethod> {
    return apiClient.patch<PaymentMethod>(`${this.basePath}/${id}`, data);
  }

  /**
   * Deactivate a payment method
   */
  async deactivatePaymentMethod(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }
}

// Export service instances
export const suppliersService = new SuppliersService();
export const paymentMethodsService = new PaymentMethodsService();
