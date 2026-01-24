import { apiClient } from './client';
import {
  Balance,
  BalanceOperation,
  BalanceSummary,
  CreateBalanceRequest,
  UpdateBalanceRequest,
  QueryBalanceRequest,
  CreateBalanceOperationRequest,
  UpdateBalanceOperationRequest,
  QueryBalanceOperationRequest,
  PaginatedResponse,
} from '@/types/balances';

/**
 * Balances API Service
 * Handles all balance and balance operation related operations
 */
export const balancesApi = {
  /**
   * Get balances with pagination and filtering
   * GET /admin/balances
   */
  async getBalances(params: QueryBalanceRequest = {}): Promise<PaginatedResponse<Balance>> {
    const {
      balanceType,
      receiverCompanyId,
      receiverSiteId,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
    });

    if (balanceType) {
      queryParams.append('balanceType', balanceType);
    }

    if (receiverCompanyId) {
      queryParams.append('receiverCompanyId', receiverCompanyId);
    }

    if (receiverSiteId) {
      queryParams.append('receiverSiteId', receiverSiteId);
    }

    if (startDate) {
      queryParams.append('startDate', startDate);
    }

    if (endDate) {
      queryParams.append('endDate', endDate);
    }

    if (status) {
      queryParams.append('status', status);
    }

    const queryString = queryParams.toString();
    const url = `/admin/balances${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<PaginatedResponse<Balance>>(url);
  },

  /**
   * Get a single balance by ID
   * GET /admin/balances/:id
   */
  async getBalanceById(id: string): Promise<Balance> {
    return apiClient.get<Balance>(`/admin/balances/${id}`);
  },

  /**
   * Create a new balance
   * POST /admin/balances
   */
  async createBalance(data: CreateBalanceRequest): Promise<Balance> {
    return apiClient.post<Balance>('/admin/balances', data);
  },

  /**
   * Update a balance
   * PATCH /admin/balances/:id
   */
  async updateBalance(id: string, data: UpdateBalanceRequest): Promise<Balance> {
    return apiClient.patch<Balance>(`/admin/balances/${id}`, data);
  },

  /**
   * Delete a balance (soft delete)
   * DELETE /admin/balances/:id
   */
  async deleteBalance(id: string): Promise<void> {
    return apiClient.delete<void>(`/admin/balances/${id}`);
  },

  /**
   * Activate a balance
   * POST /admin/balances/:id/activate
   */
  async activateBalance(id: string): Promise<Balance> {
    return apiClient.post<Balance>(`/admin/balances/${id}/activate`, {});
  },

  /**
   * Deactivate a balance
   * POST /admin/balances/:id/deactivate
   */
  async deactivateBalance(id: string): Promise<Balance> {
    return apiClient.post<Balance>(`/admin/balances/${id}/deactivate`, {});
  },

  /**
   * Close a balance
   * POST /admin/balances/:id/close
   */
  async closeBalance(id: string): Promise<Balance> {
    return apiClient.post<Balance>(`/admin/balances/${id}/close`, {});
  },

  /**
   * Get balance summary
   * GET /admin/balances/:id/summary
   */
  async getBalanceSummary(id: string): Promise<BalanceSummary> {
    return apiClient.get<BalanceSummary>(`/admin/balances/${id}/summary`);
  },

  /**
   * Get balances by receiver company
   * GET /admin/balances/receiver-company/:companyId
   */
  async getBalancesByReceiverCompany(companyId: string): Promise<Balance[]> {
    return apiClient.get<Balance[]>(`/admin/balances/receiver-company/${companyId}`);
  },

  /**
   * Get balances by receiver site
   * GET /admin/balances/receiver-site/:siteId
   */
  async getBalancesByReceiverSite(siteId: string): Promise<Balance[]> {
    return apiClient.get<Balance[]>(`/admin/balances/receiver-site/${siteId}`);
  },

  /**
   * Get operations for a balance
   * GET /admin/balances/:balanceId/operations
   */
  async getBalanceOperations(
    balanceId: string,
    params: QueryBalanceOperationRequest = {}
  ): Promise<PaginatedResponse<BalanceOperation>> {
    const {
      emitterCompanyId,
      emitterSiteId,
      operationType,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'operationDate',
      sortOrder = 'DESC',
    } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
    });

    if (emitterCompanyId) {
      queryParams.append('emitterCompanyId', emitterCompanyId);
    }

    if (emitterSiteId) {
      queryParams.append('emitterSiteId', emitterSiteId);
    }

    if (operationType) {
      queryParams.append('operationType', operationType);
    }

    if (startDate) {
      queryParams.append('startDate', startDate);
    }

    if (endDate) {
      queryParams.append('endDate', endDate);
    }

    const queryString = queryParams.toString();
    const url = `/admin/balances/${balanceId}/operations${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<PaginatedResponse<BalanceOperation>>(url);
  },

  /**
   * Get a single operation by ID
   * GET /admin/balances/:balanceId/operations/:id
   */
  async getBalanceOperationById(balanceId: string, operationId: string): Promise<BalanceOperation> {
    return apiClient.get<BalanceOperation>(
      `/admin/balances/${balanceId}/operations/${operationId}`
    );
  },

  /**
   * Create a new balance operation
   * POST /admin/balances/:balanceId/operations
   */
  async createBalanceOperation(
    balanceId: string,
    data: CreateBalanceOperationRequest
  ): Promise<BalanceOperation> {
    return apiClient.post<BalanceOperation>(`/admin/balances/${balanceId}/operations`, data);
  },

  /**
   * Update a balance operation
   * PATCH /admin/balances/:balanceId/operations/:id
   */
  async updateBalanceOperation(
    balanceId: string,
    operationId: string,
    data: UpdateBalanceOperationRequest
  ): Promise<BalanceOperation> {
    return apiClient.patch<BalanceOperation>(
      `/admin/balances/${balanceId}/operations/${operationId}`,
      data
    );
  },

  /**
   * Delete a balance operation
   * DELETE /admin/balances/:balanceId/operations/:id
   */
  async deleteBalanceOperation(balanceId: string, operationId: string): Promise<void> {
    return apiClient.delete<void>(`/admin/balances/${balanceId}/operations/${operationId}`);
  },

  /**
   * Get operations by type
   * GET /admin/balances/:balanceId/operations/type/:operationType
   */
  async getOperationsByType(balanceId: string, operationType: string): Promise<BalanceOperation[]> {
    return apiClient.get<BalanceOperation[]>(
      `/admin/balances/${balanceId}/operations/type/${operationType}`
    );
  },

  /**
   * Get operations by emitter
   * GET /admin/balances/:balanceId/operations/emitter
   */
  async getOperationsByEmitter(
    balanceId: string,
    params: { emitterCompanyId?: string; emitterSiteId?: string } = {}
  ): Promise<PaginatedResponse<BalanceOperation>> {
    const { emitterCompanyId, emitterSiteId } = params;

    const queryParams = new URLSearchParams();

    if (emitterCompanyId) {
      queryParams.append('emitterCompanyId', emitterCompanyId);
    }

    if (emitterSiteId) {
      queryParams.append('emitterSiteId', emitterSiteId);
    }

    const queryString = queryParams.toString();
    const url = `/admin/balances/${balanceId}/operations/emitter${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<PaginatedResponse<BalanceOperation>>(url);
  },

  /**
   * Get summary by operation type
   * GET /admin/balances/:balanceId/operations/summary
   */
  async getSummaryByType(balanceId: string): Promise<any[]> {
    return apiClient.get<any[]>(`/admin/balances/${balanceId}/operations/summary`);
  },

  /**
   * Get summary by emitter
   * GET /admin/balances/:balanceId/operations/summary-by-emitter
   */
  async getSummaryByEmitter(balanceId: string): Promise<any[]> {
    return apiClient.get<any[]>(`/admin/balances/${balanceId}/operations/summary-by-emitter`);
  },

  /**
   * Get unique emitters for a balance
   * GET /admin/balances/:balanceId/operations/emitters
   */
  async getUniqueEmitters(balanceId: string): Promise<any[]> {
    return apiClient.get<any[]>(`/admin/balances/${balanceId}/operations/emitters`);
  },

  /**
   * Get all operations from all balances
   * GET /admin/balance-operations
   */
  async getAllBalanceOperations(
    params: QueryBalanceOperationRequest = {}
  ): Promise<PaginatedResponse<BalanceOperation>> {
    const {
      balanceId,
      emitterCompanyId,
      emitterSiteId,
      operationType,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'operationDate',
      sortOrder = 'DESC',
    } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
    });

    if (balanceId) {
      queryParams.append('balanceId', balanceId);
    }

    if (emitterCompanyId) {
      queryParams.append('emitterCompanyId', emitterCompanyId);
    }

    if (emitterSiteId) {
      queryParams.append('emitterSiteId', emitterSiteId);
    }

    if (operationType) {
      queryParams.append('operationType', operationType);
    }

    if (startDate) {
      queryParams.append('startDate', startDate);
    }

    if (endDate) {
      queryParams.append('endDate', endDate);
    }

    const queryString = queryParams.toString();
    const url = `/admin/balance-operations${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<PaginatedResponse<BalanceOperation>>(url);
  },
};
