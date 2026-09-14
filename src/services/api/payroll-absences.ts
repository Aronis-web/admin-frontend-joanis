import { Platform } from 'react-native';
import { apiClient } from './client';
import type {
  AbsenceFileInput,
  AbsenceListParams,
  AbsenceRequest,
  ApiSuccess,
  CreateAbsenceDto,
} from '@/types/payroll';

/**
 * Faltas / descansos medicos: /payroll/absences
 * Permiso: payroll.absences.manage
 *
 * El POST admite `multipart/form-data` con un archivo opcional (evidencia CITT).
 */
class PayrollAbsencesService {
  private readonly base = '/payroll/absences';

  async list(
    params?: AbsenceListParams,
    signal?: AbortSignal
  ): Promise<ApiSuccess<AbsenceRequest>> {
    return apiClient.get(this.base, { params, signal });
  }

  /**
   * Alta de falta.
   * - Sin archivo: JSON simple.
   * - Con archivo: multipart/form-data (web: File; nativo: {uri,name,mimeType}).
   */
  async create(
    data: CreateAbsenceDto,
    file?: File | Blob | AbsenceFileInput
  ): Promise<ApiSuccess<AbsenceRequest>> {
    if (!file) {
      return apiClient.post(this.base, data);
    }

    const fd = new FormData();
    fd.append('userId', data.userId);
    fd.append('absenceType', data.absenceType);
    fd.append('startDate', data.startDate);
    fd.append('endDate', data.endDate);
    fd.append('days', String(data.days));
    if (data.reason) fd.append('reason', data.reason);

    // File / Blob (web) vs {uri, name, mimeType} (RN nativo)
    if (typeof File !== 'undefined' && file instanceof File) {
      fd.append('file', file, file.name);
    } else if (typeof Blob !== 'undefined' && file instanceof Blob) {
      fd.append('file', file);
    } else if (Platform.OS === 'web') {
      // Objeto tipo AbsenceFileInput en web (fallback raro): dejar que el runtime lo maneje
      fd.append('file', file as unknown as Blob);
    } else {
      const info = file as AbsenceFileInput;
      fd.append('file', {
        uri: info.uri,
        name: info.name,
        type: info.mimeType,
      } as any);
    }

    // No fijar Content-Type: axios agrega boundary automaticamente
    return apiClient.post(this.base, fd);
  }
}

export const payrollAbsencesApi = new PayrollAbsencesService();
export default payrollAbsencesApi;
