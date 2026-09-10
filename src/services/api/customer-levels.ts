import { apiClient } from './client';
import type {
  CustomerLevel,
  CreateCustomerLevelRequest,
  UpdateCustomerLevelRequest,
  GetCustomerLevelsParams,
} from '@/types/customer-levels';

/**
 * Customer Levels API Service
 * Endpoints /customers/levels — gestión del catálogo de niveles comerciales.
 */
class CustomerLevelsService {
  private readonly basePath = '/customers/levels';

  async getLevels(
    params?: GetCustomerLevelsParams,
    signal?: AbortSignal
  ): Promise<CustomerLevel[]> {
    return apiClient.get<CustomerLevel[]>(this.basePath, { params, signal });
  }

  async getLevel(id: string, signal?: AbortSignal): Promise<CustomerLevel> {
    return apiClient.get<CustomerLevel>(`${this.basePath}/${id}`, { signal });
  }

  async createLevel(data: CreateCustomerLevelRequest): Promise<CustomerLevel> {
    return apiClient.post<CustomerLevel>(this.basePath, data);
  }

  async updateLevel(id: string, data: UpdateCustomerLevelRequest): Promise<CustomerLevel> {
    return apiClient.patch<CustomerLevel>(`${this.basePath}/${id}`, data);
  }

  async deleteLevel(id: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}

export const customerLevelsApi = new CustomerLevelsService();
export const customerLevelsService = customerLevelsApi;
export default customerLevelsApi;
