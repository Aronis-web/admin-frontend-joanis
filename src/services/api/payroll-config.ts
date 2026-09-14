import { apiClient } from './client';
import type {
  AfpRate,
  ApiSuccess,
  PayrollConcept,
  PayrollParameter,
  TaxBracket,
  UpsertAfpRateDto,
  UpsertConceptDto,
  UpsertParameterDto,
  UpsertTaxBracketDto,
} from '@/types/payroll';

/**
 * Configuracion global de planilla: /payroll/config/*
 * Permiso: payroll.config.manage
 */
class PayrollConfigService {
  private readonly base = '/payroll/config';

  async listAfpRates(): Promise<ApiSuccess<AfpRate>> {
    return apiClient.get(`${this.base}/afp-rates`);
  }

  async upsertAfpRate(data: UpsertAfpRateDto): Promise<ApiSuccess<AfpRate>> {
    return apiClient.put(`${this.base}/afp-rates`, data);
  }

  async listParameters(): Promise<ApiSuccess<PayrollParameter>> {
    return apiClient.get(`${this.base}/parameters`);
  }

  async upsertParameter(data: UpsertParameterDto): Promise<ApiSuccess<PayrollParameter>> {
    return apiClient.put(`${this.base}/parameters`, data);
  }

  async listTaxBrackets(year: number): Promise<ApiSuccess<TaxBracket>> {
    return apiClient.get(`${this.base}/tax-brackets`, { params: { year } });
  }

  async upsertTaxBracket(data: UpsertTaxBracketDto): Promise<ApiSuccess<TaxBracket>> {
    return apiClient.put(`${this.base}/tax-brackets`, data);
  }

  async listConcepts(): Promise<ApiSuccess<PayrollConcept>> {
    return apiClient.get(`${this.base}/concepts`);
  }

  async upsertConcept(data: UpsertConceptDto): Promise<ApiSuccess<PayrollConcept>> {
    return apiClient.put(`${this.base}/concepts`, data);
  }
}

export const payrollConfigApi = new PayrollConfigService();
export default payrollConfigApi;
