import { apiClient } from './client';
import {
  Customer,
  CustomersResponse,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  QueryCustomersParams,
  QueryCustomersAutocompleteParams,
  CustomersAutocompleteResponse,
  ApiPeruDniResponse,
  ApiPeruRucResponse,
} from '@/types/customers';

/**
 * Customers API Service
 */
class CustomersService {
  private readonly basePath = '/customers';

  // ============================================
  // Customers CRUD
  // ============================================

  /**
   * Get all customers with optional filters
   */
  async getCustomers(
    params?: QueryCustomersParams,
    signal?: AbortSignal
  ): Promise<CustomersResponse> {
    return apiClient.get<CustomersResponse>(this.basePath, { params, signal });
  }

  async getCustomersAutocomplete(
    params: QueryCustomersAutocompleteParams,
    signal?: AbortSignal
  ): Promise<CustomersAutocompleteResponse> {
    const query = params.query.trim();
    const limit = Math.min(50, Math.max(1, params.limit ?? 10));

    return apiClient.get<CustomersAutocompleteResponse>(`${this.basePath}/autocomplete`, {
      signal,
      params: { ...params, query, limit },
    });
  }

  /**
   * Get a single customer by ID
   */
  async getCustomer(id: string): Promise<Customer> {
    return apiClient.get<Customer>(`${this.basePath}/${id}`);
  }

  /**
   * Create a new customer
   */
  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    return apiClient.post<Customer>(this.basePath, data);
  }

  /**
   * Update a customer
   */
  async updateCustomer(id: string, data: UpdateCustomerRequest): Promise<Customer> {
    return apiClient.patch<Customer>(`${this.basePath}/${id}`, data);
  }

  /**
   * Delete a customer (soft delete)
   */
  async deleteCustomer(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }

  /**
   * Restore a deleted customer
   */
  async restoreCustomer(id: string): Promise<Customer> {
    return apiClient.post<Customer>(`${this.basePath}/${id}/restore`);
  }

  // ============================================
  // ApiPeru Integration
  // ============================================

  /**
   * Consultar DNI en ApiPeruDev
   */
  async consultarDni(dni: string): Promise<ApiPeruDniResponse> {
    return apiClient.get<ApiPeruDniResponse>(`${this.basePath}/apiperu/dni/${dni}`);
  }

  /**
   * Consultar RUC en ApiPeruDev
   */
  async consultarRuc(ruc: string): Promise<ApiPeruRucResponse> {
    return apiClient.get<ApiPeruRucResponse>(`${this.basePath}/apiperu/ruc/${ruc}`);
  }
}

export const customersService = new CustomersService();
export const customersApi = customersService;
export default customersService;
