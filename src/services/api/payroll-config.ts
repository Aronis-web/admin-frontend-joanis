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
 * Los `list*` devuelven arrays desempaquetados; los `upsert*` devuelven el item.
 */
class PayrollConfigService {
  private readonly base = '/payroll/config';

  async listAfpRates(): Promise<AfpRate[]> {
    const res = await apiClient.get<ApiSuccess<AfpRate>>(`${this.base}/afp-rates`);
    return res.items ?? [];
  }

  async upsertAfpRate(data: UpsertAfpRateDto): Promise<AfpRate | null> {
    const res = await apiClient.put<ApiSuccess<AfpRate>>(`${this.base}/afp-rates`, data);
    return (res.item as AfpRate) ?? null;
  }

  async listParameters(): Promise<PayrollParameter[]> {
    const res = await apiClient.get<ApiSuccess<PayrollParameter>>(`${this.base}/parameters`);
    return res.items ?? [];
  }

  async upsertParameter(data: UpsertParameterDto): Promise<PayrollParameter | null> {
    const res = await apiClient.put<ApiSuccess<PayrollParameter>>(`${this.base}/parameters`, data);
    return (res.item as PayrollParameter) ?? null;
  }

  async listTaxBrackets(year: number): Promise<TaxBracket[]> {
    const res = await apiClient.get<ApiSuccess<TaxBracket>>(`${this.base}/tax-brackets`, {
      params: { year },
    });
    return res.items ?? [];
  }

  async upsertTaxBracket(data: UpsertTaxBracketDto): Promise<TaxBracket | null> {
    const res = await apiClient.put<ApiSuccess<TaxBracket>>(`${this.base}/tax-brackets`, data);
    return (res.item as TaxBracket) ?? null;
  }

  async listConcepts(): Promise<PayrollConcept[]> {
    const res = await apiClient.get<ApiSuccess<PayrollConcept>>(`${this.base}/concepts`);
    return res.items ?? [];
  }

  async upsertConcept(data: UpsertConceptDto): Promise<PayrollConcept | null> {
    const res = await apiClient.put<ApiSuccess<PayrollConcept>>(`${this.base}/concepts`, data);
    return (res.item as PayrollConcept) ?? null;
  }
}

export const payrollConfigApi = new PayrollConfigService();
export default payrollConfigApi;
