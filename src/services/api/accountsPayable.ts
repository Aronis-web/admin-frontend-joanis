import { apiClient } from './client';
import {
  AccountPayable,
  AccountsPayableResponse,
  CreateAccountPayableRequest,
  UpdateAccountPayableRequest,
  CancelAccountPayableRequest,
  QueryAccountsPayableParams,
  AccountPayablePayment,
  CreateAccountPayablePaymentRequest,
  AccountPayablePaymentsResponse,
  AccountPayableSchedule,
  CreateAccountPayableScheduleRequest,
  AccountPayableReportBySupplierResponse,
  AccountPayableAgingReport,
  AccountPayableSummaryReport,
  AccountPayableOverdueReport,
  AccountPayablePaymentProjectionReport,
  QueryAccountPayableReportsParams,
} from '@/types/suppliers';

/**
 * Accounts Payable API Service
 * Servicio para gestionar Cuentas por Pagar
 */
class AccountsPayableService {
  private readonly basePath = '/accounts-payable';

  // ============================================
  // ACCOUNTS PAYABLE CRUD
  // ============================================

  /**
   * Get all accounts payable with optional filters
   * Obtiene todas las cuentas por pagar con filtros opcionales
   */
  async getAccountsPayable(params?: QueryAccountsPayableParams): Promise<AccountsPayableResponse> {
    return apiClient.get<AccountsPayableResponse>(this.basePath, { params });
  }

  /**
   * Get a single account payable by ID
   * Obtiene una cuenta por pagar por ID
   */
  async getAccountPayable(id: string): Promise<AccountPayable> {
    return apiClient.get<AccountPayable>(`${this.basePath}/${id}`);
  }

  /**
   * Create a new account payable
   * Crea una nueva cuenta por pagar
   */
  async createAccountPayable(data: CreateAccountPayableRequest): Promise<AccountPayable> {
    return apiClient.post<AccountPayable>(this.basePath, data);
  }

  /**
   * Update an account payable
   * Actualiza una cuenta por pagar
   */
  async updateAccountPayable(id: string, data: UpdateAccountPayableRequest): Promise<AccountPayable> {
    return apiClient.patch<AccountPayable>(`${this.basePath}/${id}`, data);
  }

  /**
   * Cancel an account payable
   * Cancela una cuenta por pagar
   */
  async cancelAccountPayable(id: string, data: CancelAccountPayableRequest): Promise<AccountPayable> {
    return apiClient.post<AccountPayable>(`${this.basePath}/${id}/cancel`, data);
  }

  /**
   * Delete an account payable (soft delete)
   * Elimina una cuenta por pagar (soft delete)
   */
  async deleteAccountPayable(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }

  // ============================================
  // PAYMENTS
  // ============================================

  /**
   * Get all payments for an account payable
   * Obtiene todos los pagos de una cuenta por pagar
   */
  async getPayments(accountPayableId: string): Promise<AccountPayablePaymentsResponse> {
    return apiClient.get<AccountPayablePaymentsResponse>(
      `${this.basePath}/${accountPayableId}/payments`
    );
  }

  /**
   * Get a single payment by ID
   * Obtiene un pago por ID
   */
  async getPayment(accountPayableId: string, paymentId: string): Promise<AccountPayablePayment> {
    return apiClient.get<AccountPayablePayment>(
      `${this.basePath}/${accountPayableId}/payments/${paymentId}`
    );
  }

  /**
   * Register a payment for an account payable
   * Registra un pago para una cuenta por pagar
   */
  async createPayment(
    accountPayableId: string,
    data: CreateAccountPayablePaymentRequest
  ): Promise<AccountPayablePayment> {
    return apiClient.post<AccountPayablePayment>(
      `${this.basePath}/${accountPayableId}/payments`,
      data
    );
  }

  /**
   * Delete a payment (soft delete)
   * Elimina un pago (soft delete)
   */
  async deletePayment(accountPayableId: string, paymentId: string): Promise<void> {
    return apiClient.delete<void>(
      `${this.basePath}/${accountPayableId}/payments/${paymentId}`
    );
  }

  // ============================================
  // SCHEDULES (CRONOGRAMAS)
  // ============================================

  /**
   * Get all schedules for an account payable
   * Obtiene todos los cronogramas de una cuenta por pagar
   */
  async getSchedules(accountPayableId: string): Promise<AccountPayableSchedule[]> {
    return apiClient.get<AccountPayableSchedule[]>(
      `${this.basePath}/${accountPayableId}/schedules`
    );
  }

  /**
   * Create a schedule for an account payable
   * Crea un cronograma para una cuenta por pagar
   */
  async createSchedule(
    accountPayableId: string,
    data: CreateAccountPayableScheduleRequest
  ): Promise<AccountPayableSchedule> {
    return apiClient.post<AccountPayableSchedule>(
      `${this.basePath}/${accountPayableId}/schedules`,
      data
    );
  }

  /**
   * Delete a schedule
   * Elimina un cronograma
   */
  async deleteSchedule(accountPayableId: string, scheduleId: string): Promise<void> {
    return apiClient.delete<void>(
      `${this.basePath}/${accountPayableId}/schedules/${scheduleId}`
    );
  }

  // ============================================
  // REPORTS
  // ============================================

  /**
   * Get summary by supplier report
   * Obtiene resumen agrupado por proveedor
   */
  async getReportBySupplier(
    params?: QueryAccountPayableReportsParams
  ): Promise<AccountPayableReportBySupplierResponse> {
    return apiClient.get<AccountPayableReportBySupplierResponse>(
      `${this.basePath}/reports/by-supplier`,
      { params }
    );
  }

  /**
   * Get aging report
   * Obtiene reporte de antigüedad
   */
  async getAgingReport(
    params?: QueryAccountPayableReportsParams
  ): Promise<AccountPayableAgingReport> {
    return apiClient.get<AccountPayableAgingReport>(
      `${this.basePath}/reports/aging`,
      { params }
    );
  }

  /**
   * Get summary report
   * Obtiene resumen general
   */
  async getSummaryReport(
    params?: QueryAccountPayableReportsParams
  ): Promise<AccountPayableSummaryReport> {
    return apiClient.get<AccountPayableSummaryReport>(
      `${this.basePath}/reports/summary`,
      { params }
    );
  }

  /**
   * Get overdue accounts report
   * Obtiene reporte de cuentas vencidas
   */
  async getOverdueReport(
    params?: QueryAccountPayableReportsParams
  ): Promise<AccountPayableOverdueReport> {
    return apiClient.get<AccountPayableOverdueReport>(
      `${this.basePath}/reports/overdue`,
      { params }
    );
  }

  /**
   * Get payment projection report
   * Obtiene proyección de pagos
   */
  async getPaymentProjectionReport(
    params?: QueryAccountPayableReportsParams
  ): Promise<AccountPayablePaymentProjectionReport> {
    return apiClient.get<AccountPayablePaymentProjectionReport>(
      `${this.basePath}/reports/payment-projection`,
      { params }
    );
  }
}

export const accountsPayableService = new AccountsPayableService();
